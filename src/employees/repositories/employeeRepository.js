const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const generatePortalToken = () => crypto.randomBytes(24).toString('hex');

const createEmployee = async (client, tenantId, firstName, lastName, email, phone, active, commissionType, commissionValue) => {
  const id = uuidv4();
  const portalToken = generatePortalToken();
  const query = `
    INSERT INTO employees (
      id, tenant_id, first_name, last_name, email, phone, is_active, commission_type, commission_value, portal_token
    )
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true), $8, $9, $10)
    RETURNING *, is_active AS active;
  `;
  const result = await client.query(query, [
    id,
    tenantId,
    firstName,
    lastName,
    email,
    phone,
    active,
    commissionType,
    commissionValue,
    portalToken,
  ]);
  return result.rows[0];
};

const copyBusinessHoursToEmployee = async (client, employeeId, tenantId) => {
  const businessHours = await client.query(`
    SELECT day_of_week, open_time, close_time
    FROM business_hours
    WHERE tenant_id = $1
      AND is_closed = false
    ORDER BY day_of_week ASC;
  `, [tenantId]);

  if (businessHours.rowCount === 0) return [];

  const values = [];
  const placeholders = businessHours.rows.map((hour, index) => {
    const offset = index * 6;
    values.push(
      uuidv4(),
      tenantId,
      employeeId,
      hour.day_of_week,
      hour.open_time,
      hour.close_time
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
  });

  const result = await client.query(`
    INSERT INTO employee_working_hours (
      id, tenant_id, employee_id, day_of_week, start_time, end_time
    )
    VALUES ${placeholders.join(', ')}
    RETURNING id, tenant_id, employee_id, day_of_week, start_time, end_time;
  `, values);

  return result.rows;
};

const getEmployeesByTenant = async (client, tenantId) => {
  const query = `
    SELECT id, first_name, last_name, email, phone, is_active, is_active AS active,
           commission_type, commission_value, portal_token, avatar_url, avatar_public_id, created_at
    FROM employees 
    WHERE tenant_id = $1 
    ORDER BY created_at DESC;
  `;
  const result = await client.query(query, [tenantId]);
  
  // Asegurar que si algún empleado antiguo no tenía portal_token, se le genere uno
  for (const emp of result.rows) {
    if (!emp.portal_token) {
      const newToken = generatePortalToken();
      await client.query('UPDATE employees SET portal_token = $1 WHERE id = $2', [newToken, emp.id]);
      emp.portal_token = newToken;
    }
  }

  const serviceAssignments = await client.query(`
    SELECT employee_services.employee_id, employee_services.service_id
    FROM employee_services
    JOIN employees ON employees.id = employee_services.employee_id
    WHERE employees.tenant_id = $1;
  `, [tenantId]);
  const serviceIdsByEmployee = new Map();

  for (const assignment of serviceAssignments.rows) {
    const serviceIds = serviceIdsByEmployee.get(assignment.employee_id) || [];
    serviceIds.push(assignment.service_id);
    serviceIdsByEmployee.set(assignment.employee_id, serviceIds);
  }

  return result.rows.map((employee) => ({
    ...employee,
    service_ids: serviceIdsByEmployee.get(employee.id) || [],
  }));
};

const getEmployeeById = async (client, id, tenantId) => {
  const query = `
    SELECT id, first_name, last_name, email, phone, is_active, commission_type, commission_value, portal_token, avatar_url, avatar_public_id
    FROM employees
    WHERE id = $1 AND tenant_id = $2;
  `;
  const result = await client.query(query, [id, tenantId]);
  return result.rows[0] || null;
};

const regenerateEmployeePortalToken = async (client, id, tenantId) => {
  const newToken = generatePortalToken();
  const query = `
    UPDATE employees
    SET portal_token = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3
    RETURNING id, first_name, last_name, portal_token;
  `;
  const result = await client.query(query, [newToken, id, tenantId]);
  return result.rows[0] || null;
};

const updateEmployee = async (client, id, tenantId, updates) => {
  const { firstName, lastName, email, phone, isActive, active, commissionType, commissionValue } = updates;
  const employeeActive = active ?? isActive;
  const query = `
    UPDATE employees 
    SET first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        is_active = COALESCE($5, is_active),
        commission_type = COALESCE($6, commission_type),
        commission_value = COALESCE($7, commission_value),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $8 AND tenant_id = $9
    RETURNING *, is_active AS active;
  `;
  const result = await client.query(query, [
    firstName,
    lastName,
    email,
    phone,
    employeeActive,
    commissionType,
    commissionValue,
    id,
    tenantId,
  ]);
  return result.rows[0] || null;
};

const replaceEmployeeServices = async (client, employeeId, tenantId, serviceIds) => {
  const uniqueServiceIds = [...new Set(serviceIds)];

  if (uniqueServiceIds.length > 0) {
    const tenantServices = await client.query(`
      SELECT id
      FROM services
      WHERE tenant_id = $1 AND id = ANY($2::uuid[]);
    `, [tenantId, uniqueServiceIds]);

    if (tenantServices.rowCount !== uniqueServiceIds.length) {
      throw new Error('Solo puedes asignar servicios de tu empresa');
    }
  }

  await client.query(`
    DELETE FROM employee_services
    WHERE employee_id = $1;
  `, [employeeId]);

  if (uniqueServiceIds.length > 0) {
    await client.query(`
      INSERT INTO employee_services (employee_id, service_id)
      SELECT $1, unnest($2::uuid[])
      ON CONFLICT (employee_id, service_id) DO NOTHING;
    `, [employeeId, uniqueServiceIds]);
  }
};

const deleteEmployee = async (client, id, tenantId) => {
  const query = `
    DELETE FROM employees WHERE id = $1 AND tenant_id = $2 RETURNING id;
  `;
  const result = await client.query(query, [id, tenantId]);
  return result.rows[0] || null;
};

const updateEmployeeAvatar = async (client, id, tenantId, avatarUrl, avatarPublicId) => {
  const query = `
    UPDATE employees
    SET avatar_url = $1,
        avatar_public_id = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND tenant_id = $4
    RETURNING *, is_active AS active;
  `;
  const result = await client.query(query, [avatarUrl, avatarPublicId, id, tenantId]);
  return result.rows[0] || null;
};

module.exports = {
  createEmployee,
  copyBusinessHoursToEmployee,
  getEmployeesByTenant,
  getEmployeeById,
  regenerateEmployeePortalToken,
  updateEmployee,
  updateEmployeeAvatar,
  replaceEmployeeServices,
  deleteEmployee,
  countEmployeesByTenant
};
