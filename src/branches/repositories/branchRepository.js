const { v4: uuidv4 } = require('uuid');

const getBranchesByTenant = async (client, tenantId) => {
  const query = `
    SELECT 
      b.id, b.tenant_id, b.name, b.address, b.phone, b.image_url, b.image_public_id,
      b.is_main, b.is_active, b.created_at, b.updated_at,
      (SELECT COUNT(*)::int FROM branch_employees be WHERE be.branch_id = b.id) AS employees_count,
      (SELECT COUNT(*)::int FROM branch_services bs WHERE bs.branch_id = b.id) AS services_count
    FROM branches b
    WHERE b.tenant_id = $1
    ORDER BY b.is_main DESC, b.created_at ASC;
  `;
  const result = await client.query(query, [tenantId]);

  // Fetch assigned employee_ids and service_ids for each branch
  const branches = result.rows;
  for (const branch of branches) {
    const empRes = await client.query(`SELECT employee_id FROM branch_employees WHERE branch_id = $1;`, [branch.id]);
    branch.employee_ids = empRes.rows.map((r) => r.employee_id);

    const srvRes = await client.query(`SELECT service_id FROM branch_services WHERE branch_id = $1;`, [branch.id]);
    branch.service_ids = srvRes.rows.map((r) => r.service_id);
  }

  return branches;
};

const getBranchById = async (client, branchId, tenantId) => {
  const query = `
    SELECT id, tenant_id, name, address, phone, image_url, image_public_id, is_main, is_active, created_at, updated_at
    FROM branches
    WHERE id = $1 AND tenant_id = $2;
  `;
  const result = await client.query(query, [branchId, tenantId]);
  if (result.rowCount === 0) return null;

  const branch = result.rows[0];
  const empRes = await client.query(`SELECT employee_id FROM branch_employees WHERE branch_id = $1;`, [branch.id]);
  branch.employee_ids = empRes.rows.map((r) => r.employee_id);

  const srvRes = await client.query(`SELECT service_id FROM branch_services WHERE branch_id = $1;`, [branch.id]);
  branch.service_ids = srvRes.rows.map((r) => r.service_id);

  return branch;
};

const createBranch = async (client, tenantId, { name, address, phone, isMain = false, isActive = true }) => {
  const id = uuidv4();
  const query = `
    INSERT INTO branches (id, tenant_id, name, address, phone, is_main, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const result = await client.query(query, [id, tenantId, name, address || '', phone || '', isMain, isActive]);
  return result.rows[0];
};

const updateBranch = async (client, branchId, tenantId, updates) => {
  const { name, address, phone, isActive, isMain } = updates;
  const query = `
    UPDATE branches
    SET name = COALESCE($1, name),
        address = COALESCE($2, address),
        phone = COALESCE($3, phone),
        is_active = COALESCE($4, is_active),
        is_main = COALESCE($5, is_main),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $6 AND tenant_id = $7
    RETURNING *;
  `;
  const result = await client.query(query, [name, address, phone, isActive, isMain, branchId, tenantId]);
  return result.rows[0] || null;
};

const updateBranchImage = async (client, branchId, tenantId, imageUrl, imagePublicId) => {
  const query = `
    UPDATE branches
    SET image_url = $1,
        image_public_id = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND tenant_id = $4
    RETURNING *;
  `;
  const result = await client.query(query, [imageUrl, imagePublicId, branchId, tenantId]);
  return result.rows[0] || null;
};

const deleteBranch = async (client, branchId, tenantId) => {
  const query = `DELETE FROM branches WHERE id = $1 AND tenant_id = $2 AND is_main = false RETURNING id;`;
  const result = await client.query(query, [branchId, tenantId]);
  return result.rows[0] || null;
};

const setBranchEmployees = async (client, branchId, employeeIds) => {
  await client.query(`DELETE FROM branch_employees WHERE branch_id = $1;`, [branchId]);
  if (Array.isArray(employeeIds) && employeeIds.length > 0) {
    const values = employeeIds.map((empId, idx) => `($1, $${idx + 2})`).join(', ');
    await client.query(`INSERT INTO branch_employees (branch_id, employee_id) VALUES ${values} ON CONFLICT DO NOTHING;`, [branchId, ...employeeIds]);
  }
};

const setBranchServices = async (client, branchId, serviceIds) => {
  await client.query(`DELETE FROM branch_services WHERE branch_id = $1;`, [branchId]);
  if (Array.isArray(serviceIds) && serviceIds.length > 0) {
    const values = serviceIds.map((srvId, idx) => `($1, $${idx + 2})`).join(', ');
    await client.query(`INSERT INTO branch_services (branch_id, service_id) VALUES ${values} ON CONFLICT DO NOTHING;`, [branchId, ...serviceIds]);
  }
};

const countBranchesByTenant = async (client, tenantId) => {
  const query = `SELECT COUNT(*)::int AS count FROM branches WHERE tenant_id = $1 AND is_active = true;`;
  const result = await client.query(query, [tenantId]);
  return result.rows[0].count;
};

module.exports = {
  getBranchesByTenant,
  getBranchById,
  createBranch,
  updateBranch,
  updateBranchImage,
  deleteBranch,
  setBranchEmployees,
  setBranchServices,
  countBranchesByTenant,
};
