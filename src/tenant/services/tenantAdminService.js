const { randomUUID: uuidv7 } = require('crypto');
const tenantRepo = require('../repositories/tenantRepository');
const subscriptionRepo = require('../../subscriptions/repositories/subscriptionRepository');
const { TENANT_STATUSES } = require('../tenantStatus');

const listTenants = async (client) => tenantRepo.listTenants(client);

const getTenantDetails = async (client, tenantId) => {
  const tenant = await tenantRepo.getTenantDetails(client, tenantId);
  if (!tenant) throw new Error('Empresa no encontrada');
  return tenant;
};

const changeTenantStatus = async (client, tenantId, status) => {
  const tenant = await getTenantDetails(client, tenantId);
  if (tenant.status === TENANT_STATUSES.DELETED) {
    throw new Error('No se puede modificar una empresa eliminada');
  }

  return tenantRepo.updateTenantStatus(client, tenantId, status);
};

const suspendTenant = async (client, tenantId) => {
  const tenant = await getTenantDetails(client, tenantId);
  if (tenant.status === TENANT_STATUSES.DELETED) {
    throw new Error('No se puede modificar una empresa eliminada');
  }

  // Suspender suscripción si existe para mantener coherencia en límites y middleware
  const currentSub = await subscriptionRepo.getSubscriptionByTenantId(client, tenantId);
  if (currentSub) {
    await subscriptionRepo.updateSubscriptionStatusAndExpiration(
      client,
      tenantId,
      currentSub.plan_id,
      'SUSPENDED',
      currentSub.expires_at,
      currentSub.next_billing_date
    );
  }

  await tenantRepo.updateTenantStatus(client, tenantId, TENANT_STATUSES.SUSPENDED);
  return tenantRepo.getTenantDetails(client, tenantId);
};

const reactivateTenant = async (client, tenantId, options = {}) => {
  const { planId, durationDays = 30 } = options;

  const tenant = await getTenantDetails(client, tenantId);
  if (tenant.status === TENANT_STATUSES.DELETED) {
    throw new Error('No se puede modificar una empresa eliminada');
  }

  // 1. Determinar y validar plan objetivo
  let targetPlanId = planId;
  if (targetPlanId) {
    const plan = await subscriptionRepo.findPlanById(client, targetPlanId);
    if (!plan) throw new Error('El plan seleccionado no es válido o no está activo');
  } else {
    // Si no se envía planId, mantener el previo o asignar el primer plan activo
    if (tenant.plan_id) {
      targetPlanId = tenant.plan_id;
    } else {
      const activePlans = await subscriptionRepo.getActivePlans(client);
      targetPlanId = activePlans[0]?.id;
    }
  }

  if (!targetPlanId) {
    throw new Error('No se encontró un plan válido para reactivar la empresa');
  }

  // 2. Calcular nueva vigencia
  const days = parseInt(durationDays, 10) || 30;
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + days);

  // 3. Actualizar o crear suscripción a status ACTIVE
  const currentSub = await subscriptionRepo.getSubscriptionByTenantId(client, tenantId);
  if (currentSub) {
    await subscriptionRepo.updateSubscriptionStatusAndExpiration(
      client,
      tenantId,
      targetPlanId,
      'ACTIVE',
      expiresAt,
      expiresAt
    );
  } else {
    await subscriptionRepo.createSubscription(
      client,
      uuidv7(),
      tenantId,
      targetPlanId,
      'ACTIVE',
      now,
      expiresAt
    );
  }

  // 4. Actualizar estado del tenant a ACTIVE
  await tenantRepo.updateTenantStatus(client, tenantId, TENANT_STATUSES.ACTIVE);

  // 5. Retornar el detalle completo actualizado de la empresa
  return tenantRepo.getTenantDetails(client, tenantId);
};

const softDeleteTenant = async (client, tenantId) => {
  const tenant = await getTenantDetails(client, tenantId);
  if (tenant.status === TENANT_STATUSES.DELETED) return tenant;
  return tenantRepo.softDeleteTenant(client, tenantId, TENANT_STATUSES.DELETED);
};

module.exports = {
  listTenants,
  getTenantDetails,
  suspendTenant,
  reactivateTenant,
  softDeleteTenant,
};
