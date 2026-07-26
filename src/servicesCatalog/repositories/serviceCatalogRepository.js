const { v4: uuidv4 } = require('uuid');

const getServicesByTenant = async (client, tenantId) => {
  const query = `
    SELECT id, tenant_id, name, description, duration_minutes, price, is_active, image_url, image_public_id, created_at, updated_at
    FROM services
    WHERE tenant_id = $1
    ORDER BY created_at DESC;
  `;
  const result = await client.query(query, [tenantId]);
  return result.rows;
};

const getServiceById = async (client, tenantId, id) => {
  const query = `
    SELECT id, tenant_id, name, description, duration_minutes, price, is_active, image_url, image_public_id, created_at, updated_at
    FROM services
    WHERE id = $1 AND tenant_id = $2;
  `;
  const result = await client.query(query, [id, tenantId]);
  return result.rows[0] || null;
};

const updateServiceImage = async (client, id, tenantId, { imageUrl, imagePublicId }) => {
  const result = await client.query(`
    UPDATE services
    SET image_url = $1,
        image_public_id = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND tenant_id = $4
    RETURNING *;
  `, [imageUrl, imagePublicId, id, tenantId]);
  return result.rows[0] || null;
};

const createService = async (client, tenantId, serviceData) => {
  const id = uuidv4();
  const { name, description, durationMinutes, price, isActive = true } = serviceData;
  
  const query = `
    INSERT INTO services (id, tenant_id, name, description, duration_minutes, price, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const result = await client.query(query, [
    id,
    tenantId,
    name,
    description || null,
    durationMinutes,
    price || 0.00,
    isActive
  ]);
  return result.rows[0];
};

const updateService = async (client, id, tenantId, updates) => {
  const { name, description, durationMinutes, price, isActive } = updates;
  
  const query = `
    UPDATE services 
    SET name = COALESCE($1, name),
        description = COALESCE($2, description),
        duration_minutes = COALESCE($3, duration_minutes),
        price = COALESCE($4, price),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $6 AND tenant_id = $7
    RETURNING *;
  `;
  const result = await client.query(query, [
    name,
    description,
    durationMinutes,
    price,
    isActive,
    id,
    tenantId
  ]);
  return result.rows[0] || null;
};

const getServiceStats = async (client, tenantId) => {
  const query = `
    SELECT 
      COUNT(*) AS total_services,
      COUNT(CASE WHEN is_active = true THEN 1 END) AS active_services
    FROM services
    WHERE tenant_id = $1;
  `;
  const result = await client.query(query, [tenantId]);
  const row = result.rows[0];
  return {
    totalServices: parseInt(row.total_services || 0, 10),
    activeServices: parseInt(row.active_services || 0, 10),
  };
};

module.exports = {
  getServicesByTenant,
  getServiceById,
  createService,
  updateService,
  updateServiceImage,
  getServiceStats,
};
