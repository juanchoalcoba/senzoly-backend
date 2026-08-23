const { v4: uuidv4 } = require('uuid');

const findTenantBySlug = async (client, slug) => {
  const query = `
    SELECT
      t.id, t.name, t.slug, t.country, t.phone, t.address, t.description, t.status,
      bt.id AS business_type_id, bt.name AS business_type_name, bt.slug AS business_type_slug
    FROM tenants t
    JOIN business_types bt ON t.business_type_id = bt.id
    WHERE t.slug = $1;
  `;
  const result = await client.query(query, [slug]);
  return result.rows[0] || null;
};

const getPublicActiveBranches = async (client, tenantId) => {
  const query = `
    SELECT id, name, address, phone, image_url, is_main
    FROM branches
    WHERE tenant_id = $1 AND is_active = true
    ORDER BY is_main DESC, name ASC;
  `;
  const result = await client.query(query, [tenantId]);
  return result.rows;
};

const getPublicActiveServices = async (client, tenantId, branchId = null) => {
  let query = `
    SELECT s.id, s.name, s.description, s.duration_minutes, s.price, s.image_url
    FROM services s
    WHERE s.tenant_id = $1 AND s.is_active = true
  `;
  const params = [tenantId];

  if (branchId) {
    query += `
      AND EXISTS (
        SELECT 1 FROM branch_services bs WHERE bs.service_id = s.id AND bs.branch_id = $2
      )
    `;
    params.push(branchId);
  }

  query += ` ORDER BY s.name ASC;`;
  const result = await client.query(query, params);
  return result.rows;
};

const getPublicActiveEmployeesByService = async (client, tenantId, serviceId, branchId = null) => {
  let query = `
    SELECT e.id, e.first_name, e.last_name, e.avatar_url
    FROM employees e
    WHERE e.tenant_id = $1
      AND e.is_active = true
      AND (
        EXISTS (
          SELECT 1
          FROM employee_services es
          JOIN services s ON s.id = es.service_id
          WHERE es.employee_id = e.id
            AND es.service_id = $2
            AND s.tenant_id = $1
        )
        OR NOT EXISTS (
          SELECT 1 FROM employee_services es WHERE es.employee_id = e.id
        )
      )
  `;
  const params = [tenantId, serviceId];

  if (branchId) {
    query += `
      AND EXISTS (
        SELECT 1 FROM branch_employees be WHERE be.employee_id = e.id AND be.branch_id = $3
      )
    `;
    params.push(branchId);
  }

  query += ` ORDER BY e.first_name ASC, e.last_name ASC;`;
  const result = await client.query(query, params);
  return result.rows;
};

const getPublicActiveEmployeeForService = async (client, tenantId, serviceId, employeeId) => {
  const result = await client.query(`
    SELECT e.id, e.first_name, e.last_name, e.avatar_url
    FROM employees e
    WHERE e.id = $1
      AND e.tenant_id = $2
      AND e.is_active = true
      AND (
        EXISTS (
          SELECT 1
          FROM employee_services es
          JOIN services s ON s.id = es.service_id
          WHERE es.employee_id = e.id
            AND es.service_id = $3
            AND s.tenant_id = $2
        )
        OR NOT EXISTS (
          SELECT 1 FROM employee_services es WHERE es.employee_id = e.id
        )
      );
  `, [employeeId, tenantId, serviceId]);
  return result.rows[0] || null;
};

const getTenantBusinessHourForDay = async (client, tenantId, dayOfWeek) => {
  const result = await client.query(`
    SELECT open_time, close_time, is_closed, break_start, break_end
    FROM business_hours
    WHERE tenant_id = $1 AND day_of_week = $2;
  `, [tenantId, dayOfWeek]);
  return result.rows[0] || null;
};

const getEmployeeWorkingHoursForDay = async (client, tenantId, employeeId, dayOfWeek) => {
  const query = `
    SELECT start_time, end_time
    FROM employee_working_hours
    WHERE tenant_id = $1
      AND employee_id IS NOT DISTINCT FROM $2::uuid
      AND day_of_week = $3
    ORDER BY start_time ASC;
  `;
  const result = await client.query(query, [tenantId, employeeId, dayOfWeek]);
  return result.rows;
};

const lockUnassignedBookingSchedule = async (client, tenantId, serviceId, date) => {
  await client.query(`
    SELECT pg_advisory_xact_lock(hashtext($1::text || ':' || $2::text || ':' || $3::text));
  `, [tenantId, serviceId, date]);
};

const getTenantBookingSettings = async (client, tenantId) => {
  const result = await client.query(`
    SELECT slot_interval_minutes, slot_alignment
    FROM booking_settings
    WHERE tenant_id = $1;
  `, [tenantId]);
  return result.rows[0] || null;
};

const getExistingBookingsForDate = async (client, tenantId, employeeId, serviceId, date) => {
  const query = `
    SELECT id, service_id, start_time, end_time, status
    FROM bookings
    WHERE tenant_id = $1
      AND booking_date = $4
      AND status IN ('CONFIRMED', 'PENDING')
      AND (
        ($2::uuid IS NOT NULL AND employee_id = $2::uuid)
        OR ($2::uuid IS NULL AND employee_id IS NULL AND service_id = $3::uuid)
      );
  `;
  const result = await client.query(query, [tenantId, employeeId, serviceId, date]);
  return result.rows;
};

const createBookingRecord = async (client, bookingData) => {
  const { tenantId, customerId, serviceId, employeeId, branchId, bookingDate, startTime, endTime, totalPrice, notes, manageTokenHash, status = 'CONFIRMED' } = bookingData;
  const id = uuidv4();

  const query = `
    INSERT INTO bookings (id, tenant_id, customer_id, service_id, employee_id, branch_id, booking_date, start_time, end_time, status, total_price, notes, manage_token_hash)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *;
  `;
  const result = await client.query(query, [
    id,
    tenantId,
    customerId,
    serviceId,
    employeeId || null,
    branchId || null,
    bookingDate,
    startTime,
    endTime,
    status,
    totalPrice,
    notes || null,
    manageTokenHash || null,
  ]);
  return result.rows[0];
};

const findBookingByTokenHash = async (client, tokenHash) => {
  const query = `
    SELECT b.id, b.tenant_id, b.customer_id, b.service_id, b.employee_id, b.branch_id,
           b.booking_date, b.start_time, b.end_time, b.status, b.total_price, b.notes,
           b.created_at, b.canceled_at,
           c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.email AS customer_email, c.phone AS customer_phone,
           s.name AS service_name, s.duration_minutes, s.price AS service_price,
           e.first_name AS employee_first_name, e.last_name AS employee_last_name,
           t.name AS tenant_name, t.slug AS tenant_slug, t.phone AS tenant_phone, t.address AS tenant_address
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    JOIN services s ON b.service_id = s.id
    JOIN tenants t ON b.tenant_id = t.id
    LEFT JOIN employees e ON b.employee_id = e.id
    WHERE b.manage_token_hash = $1;
  `;
  const result = await client.query(query, [tokenHash]);
  return result.rows[0] || null;
};

const cancelBookingRecord = async (client, bookingId, reason = null) => {
  const query = `
    UPDATE bookings
    SET status = 'CANCELED',
        canceled_at = CURRENT_TIMESTAMP,
        cancellation_reason = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `;
  const result = await client.query(query, [bookingId, reason]);
  return result.rows[0] || null;
};

module.exports = {
  findTenantBySlug,
  getPublicActiveBranches,
  getPublicActiveServices,
  getPublicActiveEmployeesByService,
  getPublicActiveEmployeeForService,
  getTenantBusinessHourForDay,
  getEmployeeWorkingHoursForDay,
  getTenantBookingSettings,
  getExistingBookingsForDate,
  lockUnassignedBookingSchedule,
  createBookingRecord,
  findBookingByTokenHash,
  cancelBookingRecord,
};
