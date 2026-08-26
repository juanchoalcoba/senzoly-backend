const getCustomersByTenant = async (client, tenantId, search = '') => {
  let query = `
    SELECT id, first_name, last_name, email, phone, notes, created_at, updated_at
    FROM customers
    WHERE tenant_id = $1
  `;
  const queryParams = [tenantId];

  if (search && search.trim() !== '') {
    queryParams.push(`%${search.trim()}%`);
    query += ` AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR (first_name || ' ' || last_name) ILIKE $2)`;
  }

  query += ` ORDER BY created_at DESC;`;

  const result = await client.query(query, queryParams);
  return result.rows;
};

const getCustomerById = async (client, tenantId, id) => {
  const query = `
    SELECT id, first_name, last_name, email, phone, notes, created_at, updated_at
    FROM customers
    WHERE id = $1 AND tenant_id = $2;
  `;
  const result = await client.query(query, [id, tenantId]);
  return result.rows[0] || null;
};

const updateCustomer = async (client, id, tenantId, updates) => {
  const { firstName, lastName, email, phone, notes } = updates;
  const query = `
    UPDATE customers 
    SET first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        notes = COALESCE($5, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $6 AND tenant_id = $7
    RETURNING *;
  `;
  const result = await client.query(query, [firstName, lastName, email, phone, notes, id, tenantId]);
  return result.rows[0] || null;
};

const getCustomerStats = async (client, tenantId) => {
  const query = `
    SELECT 
      COUNT(*) AS total_customers,
      COUNT(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) AS new_this_month
    FROM customers
    WHERE tenant_id = $1;
  `;
  const result = await client.query(query, [tenantId]);
  const row = result.rows[0];
  return {
    totalCustomers: parseInt(row.total_customers || 0, 10),
    newThisMonth: parseInt(row.new_this_month || 0, 10),
  };
};

const findOrCreateCustomer = async (client, tenantId, customerData) => {
  const { firstName, lastName, email, phone, notes } = customerData;

  // Buscar cliente existente dentro del tenant por email o teléfono
  if (email || phone) {
    let findQuery = `SELECT * FROM customers WHERE tenant_id = $1 AND (`;
    const findParams = [tenantId];
    const conditions = [];

    if (email) {
      findParams.push(email.trim().toLowerCase());
      conditions.push(`LOWER(email) = $${findParams.length}`);
    }
    if (phone) {
      findParams.push(phone.trim());
      conditions.push(`phone = $${findParams.length}`);
    }

    findQuery += conditions.join(' OR ') + `) LIMIT 1;`;

    const existingRes = await client.query(findQuery, findParams);
    if (existingRes.rows.length > 0) {
      return existingRes.rows[0];
    }
  }

  // Si no existe, crear nuevo
  const { randomUUID: uuidv4 } = require('crypto');
  const id = uuidv4();
  const insertQuery = `
    INSERT INTO customers (id, tenant_id, first_name, last_name, email, phone, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const insertRes = await client.query(insertQuery, [
    id,
    tenantId,
    firstName.trim(),
    lastName.trim(),
    email ? email.trim() : null,
    phone ? phone.trim() : null,
    notes ? notes.trim() : null,
  ]);
  return insertRes.rows[0];
};

module.exports = {
  getCustomersByTenant,
  getCustomerById,
  updateCustomer,
  getCustomerStats,
  findOrCreateCustomer,
};
