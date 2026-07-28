const getEmployeeByToken = async (client, token) => {
  const query = `
    SELECT 
      e.id, e.tenant_id, e.first_name, e.last_name, e.email, e.phone, e.is_active,
      t.name as tenant_name, t.slug as tenant_slug, t.phone as tenant_phone, t.address as tenant_address
    FROM employees e
    JOIN tenants t ON e.tenant_id = t.id
    WHERE e.portal_token = $1 AND e.is_active = true AND t.deleted_at IS NULL;
  `;
  const result = await client.query(query, [token]);
  return result.rows[0] || null;
};

const getStaffBookingsToday = async (client, tenantId, employeeId) => {
  const query = `
    SELECT 
      b.id, b.tenant_id, b.booking_date, b.start_time, b.end_time, b.status, b.total_price, b.notes, b.created_at,
      c.id as customer_id, c.first_name as customer_first_name, c.last_name as customer_last_name, c.phone as customer_phone, c.email as customer_email,
      s.id as service_id, s.name as service_name, s.duration_minutes
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    JOIN services s ON b.service_id = s.id
    WHERE b.tenant_id = $1 
      AND b.employee_id = $2
      AND b.booking_date >= CURRENT_DATE
    ORDER BY b.booking_date ASC, b.start_time ASC;
  `;
  const result = await client.query(query, [tenantId, employeeId]);
  return result.rows;
};

module.exports = {
  getEmployeeByToken,
  getStaffBookingsToday,
};
