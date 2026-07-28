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
      b.id, b.tenant_id, b.booking_date, b.start_time, b.end_time, b.status, b.total_price, b.notes, b.created_at, b.employee_id,
      c.id as customer_id, c.first_name as customer_first_name, c.last_name as customer_last_name, c.email as customer_email, c.phone as customer_phone,
      s.id as service_id, s.name as service_name, s.duration_minutes,
      e.first_name as employee_first_name, e.last_name as employee_last_name, e.commission_type, e.commission_value
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    JOIN services s ON b.service_id = s.id
    LEFT JOIN employees e ON b.employee_id = e.id
    WHERE b.id = $1 AND b.tenant_id = $2;
  `;
  const result = await client.query(query, [id, tenantId]);
  return result.rows[0] || null;
};

const createFinancialMovement = async (client, movementData) => {
  const query = `
    INSERT INTO financial_movements (
      tenant_id, booking_id, employee_id, customer_id, service_id,
      type, category, gross_amount, commission_type, commission_rate,
      employee_payout, business_net_income, service_name_snapshot,
      service_duration_snapshot, employee_name_snapshot, customer_name_snapshot,
      payment_method, completed_by_type, completed_by_id, completed_by_name, notes
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13,
      $14, $15, $16,
      $17, $18, $19, $20, $21
    )
    ON CONFLICT (booking_id) DO NOTHING
    RETURNING *;
  `;
  const values = [
    movementData.tenant_id,
    movementData.booking_id,
    movementData.employee_id || null,
    movementData.customer_id || null,
    movementData.service_id || null,
    movementData.type || 'INCOME',
    movementData.category || 'SERVICE_BOOKING',
    movementData.gross_amount,
    movementData.commission_type || null,
    movementData.commission_rate || null,
    movementData.employee_payout,
    movementData.business_net_income,
    movementData.service_name_snapshot,
    movementData.service_duration_snapshot,
    movementData.employee_name_snapshot || null,
    movementData.customer_name_snapshot || null,
    movementData.payment_method || 'CASH',
    movementData.completed_by_type || 'USER',
    movementData.completed_by_id || null,
    movementData.completed_by_name || null,
    movementData.notes || null,
  ];

  const result = await client.query(query, values);
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

// Las reservas se guardan como DATE. Por eso el "hoy" debe calcularse en la
// zona horaria del negocio, y no en la que tenga configurada PostgreSQL.
const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || 'America/Montevideo';

const getBookingStats = async (client, tenantId) => {
  const query = `
    SELECT 
      COUNT(*) AS total_bookings,
      COUNT(CASE WHEN booking_date = timezone($2, CURRENT_TIMESTAMP)::date THEN 1 END) AS today_bookings,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_bookings,
      COUNT(CASE WHEN status = 'CANCELED' THEN 1 END) AS canceled_bookings
    FROM bookings
    WHERE tenant_id = $1;
  `;
  const result = await client.query(query, [tenantId, BUSINESS_TIME_ZONE]);
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
  createFinancialMovement,
  getBookingStats,
};
