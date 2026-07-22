const { v4: uuidv4 } = require('uuid');

const getTenantProfile = async (client, tenantId) => {
  const query = `
    SELECT id, name, slug, country, phone, address, description, created_at, updated_at
    FROM tenants
    WHERE id = $1;
  `;
  const result = await client.query(query, [tenantId]);
  return result.rows[0] || null;
};

const updateTenantProfile = async (client, tenantId, updates) => {
  const { name, phone, address, description } = updates;
  const query = `
    UPDATE tenants
    SET name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        address = COALESCE($3, address),
        description = COALESCE($4, description),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING id, name, slug, country, phone, address, description, updated_at;
  `;
  const result = await client.query(query, [name, phone, address, description, tenantId]);
  return result.rows[0] || null;
};

const getBusinessHours = async (client, tenantId) => {
  const query = `
    SELECT id, tenant_id, day_of_week, open_time, close_time, is_closed, created_at, updated_at
    FROM business_hours
    WHERE tenant_id = $1
    ORDER BY day_of_week ASC;
  `;
  const result = await client.query(query, [tenantId]);
  return result.rows;
};

const upsertBusinessHour = async (client, tenantId, dayData) => {
  const { dayOfWeek, openTime, closeTime, isClosed } = dayData;
  const id = uuidv4();

  const query = `
    INSERT INTO business_hours (id, tenant_id, day_of_week, open_time, close_time, is_closed)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (tenant_id, day_of_week) 
    DO UPDATE SET
      open_time = EXCLUDED.open_time,
      close_time = EXCLUDED.close_time,
      is_closed = EXCLUDED.is_closed,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, tenant_id, day_of_week, open_time, close_time, is_closed, updated_at;
  `;
  const result = await client.query(query, [
    id,
    tenantId,
    dayOfWeek,
    openTime || '09:00:00',
    closeTime || '19:00:00',
    isClosed ?? false
  ]);
  return result.rows[0];
};

module.exports = {
  getTenantProfile,
  updateTenantProfile,
  getBusinessHours,
  upsertBusinessHour,
};
