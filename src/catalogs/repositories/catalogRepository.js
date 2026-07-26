const findPlanBySlug = async (client, slug) => {
  const query = `
    SELECT id FROM plans WHERE slug = $1 AND is_active = true;
  `;
  const result = await client.query(query, [slug]);
  return result.rows[0] || null;
};

const findBusinessTypeById = async (client, id) => {
  const query = `
    SELECT id, slug FROM business_types WHERE id = $1 AND is_active = true;
  `;
  const result = await client.query(query, [id]);
  return result.rows[0] || null;
};

const getAllBusinessTypes = async (client) => {
  const query = `
    SELECT id, name, slug, icon FROM business_types WHERE is_active = true ORDER BY name ASC;
  `;
  const result = await client.query(query);
  return result.rows;
};

module.exports = {
  findPlanBySlug,
  findBusinessTypeById,
  getAllBusinessTypes,
};
