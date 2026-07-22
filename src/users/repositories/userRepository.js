const createUser = async (client, id, tenantId, firstName, lastName, email, passwordHash) => {
  const query = `
    INSERT INTO users (id, tenant_id, first_name, last_name, email, password_hash, role)
    VALUES ($1, $2, $3, $4, $5, $6, 'OWNER')
    RETURNING *;
  `;
  const values = [id, tenantId, firstName, lastName, email, passwordHash];
  
  const result = await client.query(query, values);
  return result.rows[0];
};

const findUserByEmail = async (client, email) => {
  const query = `
    SELECT id, email FROM users WHERE email = $1;
  `;
  const result = await client.query(query, [email]);
  return result.rows[0] || null;
};

const findUserByEmailForAuth = async (client, email) => {
  const query = `
    SELECT id, tenant_id, email, password_hash, role, first_name, last_name, is_active, email_verified 
    FROM users 
    WHERE email = $1;
  `;
  const result = await client.query(query, [email]);
  return result.rows[0] || null;
};

const verifyUserEmail = async (client, userId) => {
  const query = `
    UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1;
  `;
  await client.query(query, [userId]);
};

const getUserWithDetails = async (client, userId, tenantId) => {
  const query = `
    SELECT 
      u.id as user_id, u.first_name, u.last_name, u.email, u.role, u.is_active, u.email_verified,
      t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
      s.id as subscription_id, s.status as subscription_status, s.starts_at, s.expires_at,
      p.id as plan_id, p.name as plan_name, p.slug as plan_slug, p.max_users, p.max_locations, p.max_bookings
    FROM users u
    JOIN tenants t ON u.tenant_id = t.id
    LEFT JOIN subscriptions s ON t.id = s.tenant_id
    LEFT JOIN plans p ON s.plan_id = p.id
    WHERE u.id = $1 AND u.tenant_id = $2
    LIMIT 1;
  `;
  const result = await client.query(query, [userId, tenantId]);
  return result.rows[0] || null;
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserByEmailForAuth,
  verifyUserEmail,
  getUserWithDetails,
};
