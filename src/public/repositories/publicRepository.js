const { v4: uuidv4 } = require('uuid');

const findTenantBySlug = async (client, slug) => {
  const query = `
    SELECT
      t.id, t.name, t.slug, t.country, t.phone, t.address, t.description,
      bt.id AS business_type_id, bt.name AS business_type_name, bt.slug AS business_type_slug
    FROM tenants t
    JOIN business_types bt ON t.business_type_id = bt.id
    WHERE t.slug = $1;
  `;
  const result = await client.query(query, [slug]);
  return result.rows[0] || null;
};

const getPublicActiveServices = async (client, tenantId) => {
  const query = `
    SELECT id, name, description, duration_minutes, price, image_url
    FROM services
    WHERE tenant_id = $1 AND is_active = true
    ORDER BY name ASC;
  `;
  const result = await client.query(query, [tenantId]);
  return result.rows;
};

const getPublicActiveEmployeesByService = async (client, tenantId, serviceId) => {
  const result = await client.query(`
    SELECT e.id, e.first_name, e.last_name
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
    ORDER BY e.first_name ASC, e.last_name ASC;
  `, [tenantId, serviceId]);
  return result.rows;
};

const getPublicActiveEmployeeForService = async (client, tenantId, serviceId, employeeId) => {
  const result = await client.query(`
    SELECT e.id, e.first_name, e.last_name
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
    SELECT open_time, close_time, is_closed
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
  const { tenantId, customerId, serviceId, employeeId, bookingDate, startTime, endTime, totalPrice, notes, status = 'CONFIRMED' } = bookingData;
  const id = uuidv4();

  const query = `
    INSERT INTO bookings (id, tenant_id, customer_id, service_id, employee_id, booking_date, start_time, end_time, status, total_price, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;
  `;
  const result = await client.query(query, [
    id,
    tenantId,
    customerId,
    serviceId,
    employeeId || null,
    bookingDate,
    startTime,
    endTime,
    status,
    totalPrice,
    notes || null
  ]);
  return result.rows[0];
};

module.exports = {
  findTenantBySlug,
  getPublicActiveServices,
  getPublicActiveEmployeesByService,
  getPublicActiveEmployeeForService,
  getTenantBusinessHourForDay,
  getEmployeeWorkingHoursForDay,
  getTenantBookingSettings,
  getExistingBookingsForDate,
  lockUnassignedBookingSchedule,
  createBookingRecord,
};
