const { v4: uuidv4 } = require('uuid');

const createEmployee = async (client, tenantId, firstName, lastName, email, phone) => {
  const id = uuidv4();
  const query = `
    INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const result = await client.query(query, [id, tenantId, firstName, lastName, email, phone]);
  return result.rows[0];
};

const getEmployeesByTenant = async (client, tenantId) => {
  const query = `
    SELECT id, first_name, last_name, email, phone, is_active, created_at 
    FROM employees 
    WHERE tenant_id = $1 
    ORDER BY created_at DESC;
  `;
  const result = await client.query(query, [tenantId]);
  return result.rows;
};

const updateEmployee = async (client, id, tenantId, updates) => {
  const { firstName, lastName, email, phone, isActive } = updates;
  const query = `
    UPDATE employees 
    SET first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $6 AND tenant_id = $7
    RETURNING *;
  `;
  const result = await client.query(query, [firstName, lastName, email, phone, isActive, id, tenantId]);
  return result.rows[0] || null;
};

const deleteEmployee = async (client, id, tenantId) => {
  const query = `
    DELETE FROM employees WHERE id = $1 AND tenant_id = $2 RETURNING id;
  `;
  const result = await client.query(query, [id, tenantId]);
  return result.rows[0] || null;
};

const countEmployeesByTenant = async (client, tenantId) => {
  const query = `SELECT count(*) as count FROM employees WHERE tenant_id = $1 AND is_active = true`;
  const result = await client.query(query, [tenantId]);
  return parseInt(result.rows[0].count, 10);
};

module.exports = {
  createEmployee,
  getEmployeesByTenant,
  updateEmployee,
  deleteEmployee,
  countEmployeesByTenant
};
