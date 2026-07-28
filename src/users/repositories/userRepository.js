const createUser = async (client, id, tenantId, firstName, lastName, email, passwordHash, termsVersion) => {
  const query = `
    INSERT INTO users (id, tenant_id, first_name, last_name, email, password_hash, role, terms_accepted_at, terms_version)
    VALUES ($1, $2, $3, $4, $5, $6, 'OWNER', CURRENT_TIMESTAMP, $7)
    RETURNING *;
  `;
  const values = [id, tenantId, firstName, lastName, email, passwordHash, termsVersion];
  
  const result = await client.query(query, values);
  return result.rows[0];
};

const findUserByEmail = async (client, email) => {
  const query = `
    SELECT id, email, is_active FROM users WHERE email = $1;
  `;
  const result = await client.query(query, [email]);
  return result.rows[0] || null;
};

const findUserByEmailForAuth = async (client, email) => {
  const query = `
    SELECT
      u.id, u.tenant_id, u.email, u.password_hash, u.role, u.first_name, u.last_name,
      u.is_active, u.email_verified, t.status AS tenant_status
    FROM users u
    JOIN tenants t ON t.id = u.tenant_id
    WHERE u.email = $1;
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

const updateUserPassword = async (client, userId, passwordHash) => {
  const query = `
    UPDATE users
    SET password_hash = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2;
  `;
  await client.query(query, [passwordHash, userId]);
};

const getUserWithDetails = async (client, userId, tenantId) => {
  const query = `
    SELECT 
      u.id as user_id, u.first_name, u.last_name, u.email, u.role, u.is_active, u.email_verified,
      t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
      bt.id as business_type_id, bt.name as business_type_name, bt.slug as business_type_slug,
      s.id as subscription_id, s.status as subscription_status, s.starts_at, s.expires_at,
      p.id as plan_id, p.name as plan_name, p.slug as plan_slug, p.max_users, p.max_locations, p.max_bookings
    FROM users u
    JOIN tenants t ON u.tenant_id = t.id
    JOIN business_types bt ON t.business_type_id = bt.id
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
  updateUserPassword,
  getUserWithDetails,
};
