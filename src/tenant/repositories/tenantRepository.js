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

module.exports = {
  createTenant,
  findTenantSlugById,
};
