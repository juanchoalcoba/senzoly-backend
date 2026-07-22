const createSubscription = async (client, id, tenantId, planId, status = 'TRIAL') => {
  const query = `
    INSERT INTO subscriptions (id, tenant_id, plan_id, status, expires_at)
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')
    RETURNING *;
  `;
  const values = [id, tenantId, planId, status];
  
  const result = await client.query(query, values);
  return result.rows[0];
};

const getSubscriptionLimits = async (client, tenantId) => {
  const query = `
    SELECT p.max_users, p.max_locations, p.max_bookings 
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.tenant_id = $1 AND s.status = 'ACTIVE'
    LIMIT 1;
  `;
  const result = await client.query(query, [tenantId]);
  // Si no hay activa, probar TRIAL
  if (!result.rows[0]) {
    const trialQuery = `
      SELECT p.max_users, p.max_locations, p.max_bookings 
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.tenant_id = $1 AND s.status = 'TRIAL'
      LIMIT 1;
    `;
    const trialResult = await client.query(trialQuery, [tenantId]);
    return trialResult.rows[0] || null;
  }
  return result.rows[0];
};

module.exports = {
  createSubscription,
  getSubscriptionLimits,
};
