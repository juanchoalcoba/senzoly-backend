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
    SELECT id, name, description, duration_minutes, price
    FROM services
    WHERE tenant_id = $1 AND is_active = true
    ORDER BY name ASC;
  `;
  const result = await client.query(query, [tenantId]);
  return result.rows;
};

const getTenantBusinessHourForDay = async (client, tenantId, dayOfWeek) => {
  const query = `
    SELECT open_time, close_time, is_closed
    FROM business_hours
    WHERE tenant_id = $1 AND day_of_week = $2;
  `;
  const result = await client.query(query, [tenantId, dayOfWeek]);
  return result.rows[0] || null;
};

const getExistingBookingsForDate = async (client, tenantId, date) => {
  const query = `
    SELECT id, service_id, start_time, end_time, status
    FROM bookings
    WHERE tenant_id = $1 
      AND booking_date = $2 
      AND status IN ('CONFIRMED', 'PENDING');
  `;
  const result = await client.query(query, [tenantId, date]);
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
  getTenantBusinessHourForDay,
  getExistingBookingsForDate,
  createBookingRecord,
};
