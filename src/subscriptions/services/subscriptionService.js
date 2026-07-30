const db = require('../../config/db');
const subscriptionRepo = require('../repositories/subscriptionRepository');
const tenantRepo = require('../../tenant/repositories/tenantRepository');
const userRepo = require('../../users/repositories/userRepository');
const mercadopagoService = require('./mercadopagoService');

const getAvailablePlans = async () => {
  const client = await db.getClient();
  try {
    const plans = await subscriptionRepo.getActivePlans(client);
    return plans;
  } finally {
    client.release();
  }
};

const getTenantSubscriptionDetails = async (tenantId) => {
  const client = await db.getClient();
  try {
    const subscription = await subscriptionRepo.getSubscriptionByTenantId(client, tenantId);
    const history = await subscriptionRepo.getSubscriptionHistory(client, tenantId);

    const now = new Date();
    let isExpired = false;
    let daysRemaining = 0;

    if (subscription && subscription.expires_at) {
      const expiresAt = new Date(subscription.expires_at);
      const diffTime = expiresAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      isExpired = diffTime <= 0;
    }

    return {
      subscription: subscription
        ? {
            id: subscription.id,
            status: isExpired ? 'SUSPENDED' : subscription.status,
            startsAt: subscription.starts_at,
            expiresAt: subscription.expires_at,
            nextBillingDate: subscription.next_billing_date,
            createdAt: subscription.created_at,
            plan: {
              id: subscription.plan_id,
              name: subscription.plan_name,
              slug: subscription.plan_slug,
              price: subscription.plan_price,
              billingPeriod: subscription.billing_period,
            },
            daysRemaining,
            isExpired,
          }
        : null,
      lastPayment: history.length > 0 ? history[0] : null,
      history,
    };
  } finally {
    client.release();
  }
};

const createPreferenceForTenant = async (tenantId, userId, planId) => {
  const client = await db.getClient();
  try {
    const tenant = await tenantRepo.getTenantDetails(client, tenantId);
    if (!tenant) {
      throw new Error('Empresa no encontrada');
    }

    const user = await userRepo.getUserWithDetails(client, userId, tenantId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Buscar plan solicitado o Plan Profesional por defecto
    let plan = null;
    if (planId) {
      plan = await subscriptionRepo.findPlanById(client, planId);
    }
    if (!plan) {
      const activePlans = await subscriptionRepo.getActivePlans(client);
      plan = activePlans[0];
    }

    if (!plan) {
      throw new Error('No existe un plan de suscripción disponible');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const returnUrls = {
      success: `${frontendUrl}/dashboard/subscription?payment=success`,
      failure: `${frontendUrl}/dashboard/subscription?payment=failure`,
      pending: `${frontendUrl}/dashboard/subscription?payment=pending`,
    };

    const preference = await mercadopagoService.createPreference({
      tenant: { id: tenant.id, name: tenant.name },
      user: { id: user.user_id, firstName: user.first_name, lastName: user.last_name, email: user.email },
      plan: { id: plan.id, name: plan.name, price: plan.price },
      returnUrls,
    });

    await subscriptionRepo.logWebhookEvent(client, {
      eventType: 'preference_created',
      preferenceId: preference.id,
      tenantId: tenant.id,
      payload: { planId: plan.id, preferenceId: preference.id },
      status: 'SUCCESS',
    });

    return {
      preferenceId: preference.id,
      initPoint: preference.init_point,
      plan,
    };
  } finally {
    client.release();
  }
};

const handleWebhook = async (body, query) => {
  const client = await db.getClient();
  try {
    const paymentId =
      body?.data?.id ||
      query?.['data.id'] ||
      query?.id ||
      body?.id ||
      (body?.resource ? body.resource.split('/').pop() : null);

    await subscriptionRepo.logWebhookEvent(client, {
      eventType: 'webhook_received',
      paymentId,
      payload: { body, query },
      status: 'RECEIVED',
    });

    if (!paymentId) {
      return { handled: true, message: 'Notificación sin payment_id' };
    }

    // Consultar MercadoPago por los detalles reales del pago
    let mpPayment;
    try {
      mpPayment = await mercadopagoService.getPaymentDetails(paymentId);
    } catch (err) {
      await subscriptionRepo.logWebhookEvent(client, {
        eventType: 'webhook_error',
        paymentId,
        errorMessage: err.message,
        status: 'ERROR',
      });
      throw err;
    }

    const tenantId = mpPayment.external_reference;
    if (!tenantId) {
      console.warn(`[Webhook] Pago ${paymentId} sin external_reference (tenant_id).`);
      return { handled: true, message: 'Pago sin external_reference' };
    }

    // Obtener suscripción actual
    const currentSub = await subscriptionRepo.getSubscriptionByTenantId(client, tenantId);
    const planId = mpPayment.metadata?.plan_id || (currentSub ? currentSub.plan_id : null);

    // IDEMPOTENCIA: Si el pago ya fue registrado con el MISMO estado, ignorar duplicado
    const existingPayment = await subscriptionRepo.findPaymentByMpId(client, paymentId);
    if (existingPayment && existingPayment.status === mpPayment.status) {
      console.log(`[Webhook] Pago ${paymentId} ya fue procesado con estado ${mpPayment.status}. Ignorado.`);
      await subscriptionRepo.logWebhookEvent(client, {
        eventType: 'webhook_duplicate_ignored',
        paymentId,
        tenantId,
        status: 'IGNORED',
      });
      return { handled: true, message: 'Estado ya procesado previamente' };
    }

    if (mpPayment.status === 'approved') {
      // Calcular nueva fecha de vencimiento: + 30 días desde max(NOW(), expires_at actual)
      const now = new Date();
      let baseDate = now;
      if (currentSub && currentSub.expires_at) {
        const currentExpires = new Date(currentSub.expires_at);
        if (currentExpires > now) {
          baseDate = currentExpires;
        }
      }

      const nextExpires = new Date(baseDate);
      nextExpires.setDate(nextExpires.getDate() + 30);

      await client.query('BEGIN');

      // 1. Actualizar Suscripción a ACTIVE
      let subId = currentSub?.id;
      if (currentSub) {
        await subscriptionRepo.updateSubscriptionStatusAndExpiration(
          client,
          tenantId,
          planId,
          'ACTIVE',
          nextExpires,
          nextExpires
        );
      } else {
        // Fallback si no tuviera suscripción creada
        const newSub = await subscriptionRepo.createSubscription(
          client,
          require('uuid').v7(),
          tenantId,
          planId,
          'ACTIVE',
          now,
          nextExpires
        );
        subId = newSub.id;
      }

      // 2. Actualizar Tenant a active
      await tenantRepo.updateTenantStatus(client, tenantId, 'active');

      // 3. Registrar Pago en subscription_payments (idempotente por UNIQUE payment_id)
      await subscriptionRepo.recordPayment(client, {
        tenantId,
        subscriptionId: subId,
        planId,
        paymentId: mpPayment.id,
        merchantOrderId: mpPayment.order?.id || null,
        preferenceId: mpPayment.preference_id || null,
        payerEmail: mpPayment.payer?.email || null,
        transactionAmount: mpPayment.transaction_amount,
        paymentMethod: mpPayment.payment_method_id || null,
        status: mpPayment.status,
        statusDetail: mpPayment.status_detail || null,
        dateApproved: mpPayment.date_approved || now,
        externalReference: tenantId,
        rawResponse: mpPayment,
      });

      await client.query('COMMIT');

      await subscriptionRepo.logWebhookEvent(client, {
        eventType: 'payment_approved',
        paymentId: mpPayment.id,
        tenantId,
        status: 'SUCCESS',
      });

      console.log(`[Webhook] Pago ${paymentId} APROBADO. Tenant ${tenantId} activado hasta ${nextExpires.toISOString()}`);
    } else if (['refunded', 'charged_back'].includes(mpPayment.status)) {
      // Reversión de pago: actualizar registro y suspender acceso
      await client.query('BEGIN');

      await subscriptionRepo.recordPayment(client, {
        tenantId,
        subscriptionId: currentSub?.id || null,
        planId: planId || currentSub?.plan_id || null,
        paymentId: mpPayment.id,
        merchantOrderId: mpPayment.order?.id || null,
        preferenceId: mpPayment.preference_id || null,
        payerEmail: mpPayment.payer?.email || null,
        transactionAmount: mpPayment.transaction_amount,
        paymentMethod: mpPayment.payment_method_id || null,
        status: mpPayment.status,
        statusDetail: mpPayment.status_detail || null,
        dateApproved: mpPayment.date_approved || null,
        externalReference: tenantId,
        rawResponse: mpPayment,
      });

      if (currentSub && ['ACTIVE', 'active', 'TRIAL', 'trial'].includes(currentSub.status)) {
        await subscriptionRepo.updateSubscriptionStatusAndExpiration(
          client,
          tenantId,
          currentSub.plan_id,
          'SUSPENDED',
          currentSub.expires_at,
          currentSub.next_billing_date
        );
        await tenantRepo.updateTenantStatus(client, tenantId, 'suspended');
      }

      await client.query('COMMIT');

      await subscriptionRepo.logWebhookEvent(client, {
        eventType: `payment_${mpPayment.status}`,
        paymentId: mpPayment.id,
        tenantId,
        status: 'REVERSED',
      });

      console.log(`[Webhook] Pago ${paymentId} ${mpPayment.status.toUpperCase()}. Tenant ${tenantId} suspendido.`);
    } else {
      // Registrar estado pendiente/rechazado sin cambiar estado de tenant
      if (currentSub) {
        await subscriptionRepo.recordPayment(client, {
          tenantId,
          subscriptionId: currentSub.id,
          planId: planId || currentSub.plan_id,
          paymentId: mpPayment.id,
          merchantOrderId: mpPayment.order?.id || null,
          preferenceId: mpPayment.preference_id || null,
          payerEmail: mpPayment.payer?.email || null,
          transactionAmount: mpPayment.transaction_amount,
          paymentMethod: mpPayment.payment_method_id || null,
          status: mpPayment.status,
          statusDetail: mpPayment.status_detail || null,
          dateApproved: mpPayment.date_approved || null,
          externalReference: tenantId,
          rawResponse: mpPayment,
        });
      }

      await subscriptionRepo.logWebhookEvent(client, {
        eventType: `payment_${mpPayment.status}`,
        paymentId: mpPayment.id,
        tenantId,
        status: 'LOGGED',
      });
    }

    return { handled: true, status: mpPayment.status };
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('Error al procesar webhook de MercadoPago:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAvailablePlans,
  getTenantSubscriptionDetails,
  createPreferenceForTenant,
  handleWebhook,
};
