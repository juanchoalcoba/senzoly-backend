const createPreference = async ({ tenant, user, plan, returnUrls }) => {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado');
  }

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const notificationUrl = `${backendUrl}/api/payments/webhook`;

  const bodyPayload = {
    items: [
      {
        id: plan.id,
        title: `Senzoly - ${plan.name}`,
        description: `Suscripción mensual Senzoly (${plan.name})`,
        quantity: 1,
        unit_price: Number(plan.price),
        currency_id: 'ARS',
      },
    ],
    payer: {
      name: user.first_name || user.firstName || 'Usuario',
      surname: user.last_name || user.lastName || 'Senzoly',
      email: user.email,
    },
    external_reference: tenant.id,
    back_urls: {
      success: returnUrls.success,
      failure: returnUrls.failure,
      pending: returnUrls.pending,
    },
    auto_return: 'approved',
    notification_url: notificationUrl,
    metadata: {
      tenant_id: tenant.id,
      plan_id: plan.id,
      user_id: user.id,
    },
  };

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error al crear preferencia en MercadoPago:', errorText);
    throw new Error(`Error en MercadoPago API (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point,
    external_reference: data.external_reference,
  };
};

const getPaymentDetails = async (paymentId) => {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado');
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error al obtener pago ${paymentId} de MercadoPago:`, errorText);
    throw new Error(`Error en MercadoPago Payment API (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data;
};

module.exports = {
  createPreference,
  getPaymentDetails,
};
