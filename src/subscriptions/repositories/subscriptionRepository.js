const { randomUUID: uuidv7 } = require('crypto');

const createSubscription = async (client, id, tenantId, planId, status = 'TRIAL', startsAt = null, expiresAt = null) => {
  const query = `
    INSERT INTO subscriptions (id, tenant_id, plan_id, status, starts_at, expires_at, next_billing_date)
    VALUES (
      $1,
      $2,
      $3,
      $4,
      COALESCE($5, CURRENT_TIMESTAMP),
      COALESCE($6, CURRENT_TIMESTAMP + INTERVAL '30 days'),
      COALESCE($6, CURRENT_TIMESTAMP + INTERVAL '30 days')
    )
    RETURNING *;
  `;
  const values = [id, tenantId, planId, status, startsAt, expiresAt];
  
  const result = await client.query(query, values);
  return result.rows[0];
};

const getSubscriptionByTenantId = async (client, tenantId) => {
  const query = `
    SELECT 
      s.id, s.tenant_id, s.plan_id, s.status, s.starts_at, s.expires_at, s.next_billing_date, s.created_at, s.updated_at,
      p.name AS plan_name, p.slug AS plan_slug, p.price AS plan_price, p.billing_period,
      p.max_users, p.max_locations, p.max_resources, p.max_bookings
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.tenant_id = $1
    ORDER BY s.created_at DESC
    LIMIT 1;
  `;
  const result = await client.query(query, [tenantId]);
  return result.rows[0] || null;
};

const updateSubscriptionStatusAndExpiration = async (client, tenantId, planId, status, expiresAt, nextBillingDate) => {
  const query = `
    UPDATE subscriptions
    SET 
      plan_id = COALESCE($2, plan_id),
      status = $3,
      expires_at = $4,
      next_billing_date = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1
    RETURNING *;
  `;
  const values = [tenantId, planId, status, expiresAt, nextBillingDate];
  const result = await client.query(query, values);
  return result.rows[0] || null;
};

const findPaymentByMpId = async (client, paymentId) => {
  const query = `
    SELECT * FROM subscription_payments
    WHERE payment_id = $1
    LIMIT 1;
  `;
  const result = await client.query(query, [String(paymentId)]);
  return result.rows[0] || null;
};

const recordPayment = async (client, paymentData) => {
  const {
    tenantId,
    subscriptionId,
    planId,
    paymentId,
    merchantOrderId,
    preferenceId,
    payerEmail,
    transactionAmount,
    paymentMethod,
    status,
    statusDetail,
    dateApproved,
    externalReference,
    rawResponse,
  } = paymentData;

  const query = `
    INSERT INTO subscription_payments (
      id, tenant_id, subscription_id, plan_id, payment_id,
      merchant_order_id, preference_id, payer_email, transaction_amount,
      payment_method, status, status_detail, date_approved, external_reference, raw_response
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (payment_id) DO UPDATE SET
      status = EXCLUDED.status,
      status_detail = EXCLUDED.status_detail,
      date_approved = EXCLUDED.date_approved,
      raw_response = EXCLUDED.raw_response,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const values = [
    uuidv7(),
    tenantId,
    subscriptionId,
    planId,
    String(paymentId),
    merchantOrderId || null,
    preferenceId || null,
    payerEmail || null,
    transactionAmount,
    paymentMethod || null,
    status,
    statusDetail || null,
    dateApproved ? new Date(dateApproved) : null,
    externalReference || null,
    JSON.stringify(rawResponse || {}),
  ];

  const result = await client.query(query, values);
  return result.rows[0];
};

const logWebhookEvent = async (client, logData) => {
  const { eventType, paymentId, preferenceId, tenantId, payload, status, errorMessage } = logData;
  const query = `
    INSERT INTO webhook_logs (id, event_type, payment_id, preference_id, tenant_id, payload, status, error_message)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;
  const values = [
    uuidv7(),
    eventType,
    paymentId ? String(paymentId) : null,
    preferenceId || null,
    tenantId || null,
    JSON.stringify(payload || {}),
    status || 'INFO',
    errorMessage || null,
  ];
  const result = await client.query(query, values);
  return result.rows[0];
};

const getActivePlans = async (client) => {
  const query = `
    SELECT id, name, slug, price, billing_period, max_users, max_locations, max_resources, max_bookings
    FROM plans
    WHERE is_active = true AND price > 0
    ORDER BY price ASC;
  `;
  const result = await client.query(query);
  return result.rows;
};

const findPlanById = async (client, planId) => {
  const query = `
    SELECT * FROM plans WHERE id = $1 AND is_active = true;
  `;
  const result = await client.query(query, [planId]);
  return result.rows[0] || null;
};

const getSubscriptionHistory = async (client, tenantId) => {
  const query = `
    SELECT 
      sp.id,
      sp.payment_id,
      sp.transaction_amount,
      sp.payment_method,
      sp.status,
      sp.date_approved,
      sp.created_at,
      p.name AS plan_name
    FROM subscription_payments sp
    JOIN plans p ON sp.plan_id = p.id
    WHERE sp.tenant_id = $1
    ORDER BY sp.created_at DESC;
  `;
  const result = await client.query(query, [tenantId]);
  return result.rows;
};

const getSubscriptionLimits = async (client, tenantId) => {
  const query = `
    SELECT p.max_users, p.max_locations, p.max_bookings 
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.tenant_id = $1 AND s.status IN ('ACTIVE', 'active', 'TRIAL', 'trial')
    ORDER BY s.created_at DESC
    LIMIT 1;
  `;
  const result = await client.query(query, [tenantId]);
  return result.rows[0] || null;
};

module.exports = {
  createSubscription,
  getSubscriptionByTenantId,
  updateSubscriptionStatusAndExpiration,
  findPaymentByMpId,
  recordPayment,
  logWebhookEvent,
  getActivePlans,
  findPlanById,
  getSubscriptionHistory,
  getSubscriptionLimits,
};
