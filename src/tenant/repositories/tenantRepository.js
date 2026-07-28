const createTenant = async (client, id, businessTypeId, name, slug, country) => {
  const query = `
    INSERT INTO tenants (id, business_type_id, name, slug, country)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [id, businessTypeId, name, slug, country];
  
  const result = await client.query(query, values);
  return result.rows[0];
};

const findTenantSlugById = async (client, tenantId) => {
  const result = await client.query(`
    SELECT slug
    FROM tenants
    WHERE id = $1;
  `, [tenantId]);
  return result.rows[0] || null;
};

const findTenantStatusById = async (client, tenantId) => {
  const result = await client.query(`
    SELECT status
    FROM tenants
    WHERE id = $1;
  `, [tenantId]);
  return result.rows[0] || null;
};

const listTenants = async (client) => {
  const result = await client.query(`
    SELECT
      t.id, t.name, t.slug, t.country, t.status, t.created_at,
      bt.name AS business_type_name,
      owner.email AS admin_email,
      owner.first_name || ' ' || owner.last_name AS admin_name,
      owner.last_login_at,
      subscription.status AS subscription_status,
      plan.name AS plan_name,
      (SELECT COUNT(*)::integer FROM bookings b WHERE b.tenant_id = t.id) AS bookings_count,
      (SELECT COUNT(*)::integer FROM customers c WHERE c.tenant_id = t.id) AS customers_count
    FROM tenants t
    JOIN business_types bt ON bt.id = t.business_type_id
    LEFT JOIN LATERAL (
      SELECT first_name, last_name, email, last_login_at
      FROM users
      WHERE tenant_id = t.id AND role = 'OWNER'
      ORDER BY created_at ASC
      LIMIT 1
    ) owner ON true
    LEFT JOIN LATERAL (
      SELECT plan_id, status
      FROM subscriptions
      WHERE tenant_id = t.id
      ORDER BY created_at DESC
      LIMIT 1
    ) subscription ON true
    LEFT JOIN plans plan ON plan.id = subscription.plan_id
    WHERE t.deleted_at IS NULL
    ORDER BY t.created_at DESC;
  `);
  return result.rows;
};

const getTenantDetails = async (client, tenantId) => {
  const result = await client.query(`
    SELECT
      t.id, t.name, t.slug, t.country, t.phone, t.address, t.description,
      t.status, t.deleted_at, t.created_at, t.updated_at,
      bt.id AS business_type_id, bt.name AS business_type_name, bt.slug AS business_type_slug,
      owner.email AS admin_email,
      owner.first_name || ' ' || owner.last_name AS admin_name,
      owner.last_login_at,
      subscription.status AS subscription_status,
      plan.id AS plan_id, plan.name AS plan_name, plan.slug AS plan_slug,
      (SELECT COUNT(*)::integer FROM bookings b WHERE b.tenant_id = t.id) AS bookings_count,
      (SELECT COUNT(*)::integer FROM customers c WHERE c.tenant_id = t.id) AS customers_count
    FROM tenants t
    JOIN business_types bt ON bt.id = t.business_type_id
    LEFT JOIN LATERAL (
      SELECT first_name, last_name, email, last_login_at
      FROM users
      WHERE tenant_id = t.id AND role = 'OWNER'
      ORDER BY created_at ASC
      LIMIT 1
    ) owner ON true
    LEFT JOIN LATERAL (
      SELECT plan_id, status
      FROM subscriptions
      WHERE tenant_id = t.id
      ORDER BY created_at DESC
      LIMIT 1
    ) subscription ON true
    LEFT JOIN plans plan ON plan.id = subscription.plan_id
    WHERE t.id = $1;
  `, [tenantId]);
  return result.rows[0] || null;
};

const updateTenantStatus = async (client, tenantId, status) => {
  const result = await client.query(`
    UPDATE tenants
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, name, status, deleted_at, updated_at;
  `, [status, tenantId]);
  return result.rows[0] || null;
};

const softDeleteTenant = async (client, tenantId, status) => {
  const result = await client.query(`
    UPDATE tenants
    SET status = $1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, name, status, deleted_at, updated_at;
  `, [status, tenantId]);
  return result.rows[0] || null;
};

module.exports = {
  createTenant,
  findTenantSlugById,
  findTenantStatusById,
  listTenants,
  getTenantDetails,
  updateTenantStatus,
  softDeleteTenant,
};
