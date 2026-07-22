const getBookingsByTenant = async (client, tenantId, filters = {}) => {
  const { date, status, search } = filters;

  let query = `
    SELECT 
      b.id, b.tenant_id, b.booking_date, b.start_time, b.end_time, b.status, b.total_price, b.notes, b.created_at,
      c.id as customer_id, c.first_name as customer_first_name, c.last_name as customer_last_name, c.email as customer_email, c.phone as customer_phone,
      s.id as service_id, s.name as service_name, s.duration_minutes
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    JOIN services s ON b.service_id = s.id
    WHERE b.tenant_id = $1
  `;

  const queryParams = [tenantId];

  if (date) {
    queryParams.push(date);
    query += ` AND b.booking_date = $${queryParams.length}`;
  }

  if (status && status !== 'ALL') {
    queryParams.push(status);
    query += ` AND b.status = $${queryParams.length}`;
  }

  if (search && search.trim() !== '') {
    queryParams.push(`%${search.trim()}%`);
    query += ` AND (c.first_name ILIKE $${queryParams.length} OR c.last_name ILIKE $${queryParams.length} OR c.email ILIKE $${queryParams.length} OR s.name ILIKE $${queryParams.length})`;
  }

  query += ` ORDER BY b.booking_date DESC, b.start_time ASC;`;

  const result = await client.query(query, queryParams);
  return result.rows;
};

const getBookingById = async (client, tenantId, id) => {
  const query = `
    SELECT 
      b.id, b.tenant_id, b.booking_date, b.start_time, b.end_time, b.status, b.total_price, b.notes, b.created_at,
      c.id as customer_id, c.first_name as customer_first_name, c.last_name as customer_last_name, c.email as customer_email, c.phone as customer_phone,
      s.id as service_id, s.name as service_name, s.duration_minutes
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    JOIN services s ON b.service_id = s.id
    WHERE b.id = $1 AND b.tenant_id = $2;
  `;
  const result = await client.query(query, [id, tenantId]);
  return result.rows[0] || null;
};

const updateBookingStatus = async (client, id, tenantId, status) => {
  const query = `
    UPDATE bookings
    SET status = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3
    RETURNING *;
  `;
  const result = await client.query(query, [status, id, tenantId]);
  return result.rows[0] || null;
};

const getBookingStats = async (client, tenantId) => {
  const query = `
    SELECT 
      COUNT(*) AS total_bookings,
      COUNT(CASE WHEN booking_date = CURRENT_DATE THEN 1 END) AS today_bookings,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_bookings,
      COUNT(CASE WHEN status = 'CANCELED' THEN 1 END) AS canceled_bookings
    FROM bookings
    WHERE tenant_id = $1;
  `;
  const result = await client.query(query, [tenantId]);
  const row = result.rows[0];
  return {
    totalBookings: parseInt(row.total_bookings || 0, 10),
    todayBookings: parseInt(row.today_bookings || 0, 10),
    completedBookings: parseInt(row.completed_bookings || 0, 10),
    canceledBookings: parseInt(row.canceled_bookings || 0, 10),
  };
};

module.exports = {
  getBookingsByTenant,
  getBookingById,
  updateBookingStatus,
  getBookingStats,
};
