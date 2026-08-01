const getOverview = async (client, tenantId, startDate, endDate) => {
  const query = `
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN gross_amount ELSE 0 END), 0) AS gross_total,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN gross_amount ELSE 0 END), 0) AS expenses_total,
      COALESCE(SUM(business_net_income), 0) AS net_total,
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN employee_payout ELSE 0 END), 0) AS payout_total,
      COUNT(CASE WHEN type = 'INCOME' THEN id END)::int AS completed_services_count,
      COALESCE(AVG(CASE WHEN type = 'INCOME' THEN gross_amount END), 0) AS avg_ticket
    FROM financial_movements
    WHERE tenant_id = $1
      AND ($2::timestamp IS NULL OR created_at >= $2::timestamp)
      AND ($3::timestamp IS NULL OR created_at <= $3::timestamp);
  `;
  const result = await client.query(query, [tenantId, startDate || null, endDate || null]);
  const row = result.rows[0];
  return {
    grossTotal: parseFloat(row.gross_total),
    expensesTotal: parseFloat(row.expenses_total),
    netTotal: parseFloat(row.net_total),
    payoutTotal: parseFloat(row.payout_total),
    completedServicesCount: parseInt(row.completed_services_count, 10),
    avgTicket: parseFloat(row.avg_ticket),
  };
};

const getKPIs = async (client, tenantId) => {
  const topEmployeeQuery = `
    SELECT employee_id, employee_name_snapshot, SUM(gross_amount) AS total
    FROM financial_movements
    WHERE tenant_id = $1 AND type = 'INCOME' AND employee_name_snapshot IS NOT NULL
    GROUP BY employee_id, employee_name_snapshot
    ORDER BY total DESC
    LIMIT 1;
  `;

  const topServiceQuery = `
    SELECT service_id, service_name_snapshot, COUNT(id)::int AS count
    FROM financial_movements
    WHERE tenant_id = $1 AND type = 'INCOME' AND service_name_snapshot IS NOT NULL
    GROUP BY service_id, service_name_snapshot
    ORDER BY count DESC
    LIMIT 1;
  `;

  const topPaymentMethodQuery = `
    SELECT payment_method, COUNT(id)::int AS count
    FROM financial_movements
    WHERE tenant_id = $1
    GROUP BY payment_method
    ORDER BY count DESC
    LIMIT 1;
  `;

  const revenueTodayQuery = `
    SELECT COALESCE(SUM(business_net_income), 0) AS total
    FROM financial_movements
    WHERE tenant_id = $1 AND created_at >= CURRENT_DATE;
  `;

  const revenueMonthQuery = `
    SELECT COALESCE(SUM(business_net_income), 0) AS total
    FROM financial_movements
    WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE);
  `;

  const [topEmpRes, topSvcRes, topPayRes, revTodayRes, revMonthRes] = await Promise.all([
    client.query(topEmployeeQuery, [tenantId]),
    client.query(topServiceQuery, [tenantId]),
    client.query(topPaymentMethodQuery, [tenantId]),
    client.query(revenueTodayQuery, [tenantId]),
    client.query(revenueMonthQuery, [tenantId]),
  ]);

  return {
    topEmployee: topEmpRes.rows[0] ? {
      name: topEmpRes.rows[0].employee_name_snapshot,
      total: parseFloat(topEmpRes.rows[0].total),
    } : null,
    topService: topSvcRes.rows[0] ? {
      name: topSvcRes.rows[0].service_name_snapshot,
      count: topSvcRes.rows[0].count,
    } : null,
    topPaymentMethod: topPayRes.rows[0] ? {
      method: topPayRes.rows[0].payment_method,
      count: topPayRes.rows[0].count,
    } : null,
    revenueToday: parseFloat(revTodayRes.rows[0].total),
    revenueMonth: parseFloat(revMonthRes.rows[0].total),
  };
};

const getChartData = async (client, tenantId, startDate, endDate, grouping = 'daily', employeeId = null) => {
  let truncUnit = 'day';
  if (grouping === 'weekly') truncUnit = 'week';
  if (grouping === 'monthly') truncUnit = 'month';

  const query = `
    SELECT 
      DATE_TRUNC('${truncUnit}', created_at) AS date_group,
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN gross_amount ELSE 0 END), 0) AS gross_total,
      COALESCE(SUM(business_net_income), 0) AS net_total,
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN employee_payout ELSE 0 END), 0) AS payout_total,
      COUNT(CASE WHEN type = 'INCOME' THEN id END)::int AS count
    FROM financial_movements
    WHERE tenant_id = $1
      AND ($2::timestamp IS NULL OR created_at >= $2::timestamp)
      AND ($3::timestamp IS NULL OR created_at <= $3::timestamp)
      AND ($4::uuid IS NULL OR employee_id = $4::uuid)
    GROUP BY date_group
    ORDER BY date_group ASC;
  `;

  const result = await client.query(query, [
    tenantId,
    startDate || null,
    endDate || null,
    employeeId || null,
  ]);

  return result.rows.map((row) => ({
    date: row.date_group,
    grossTotal: parseFloat(row.gross_total),
    netTotal: parseFloat(row.net_total),
    payoutTotal: parseFloat(row.payout_total),
    count: parseInt(row.count, 10),
  }));
};

const getEmployeeRanking = async (client, tenantId, startDate, endDate, sortBy = 'netTotal', sortOrder = 'DESC') => {
  const columnMap = {
    employeeName: 'employee_name_snapshot',
    servicesCount: 'services_count',
    grossTotal: 'gross_total',
    payoutTotal: 'payout_total',
    netTotal: 'net_total',
    avgTicket: 'avg_ticket',
  };

  const sortCol = columnMap[sortBy] || 'net_total';
  const order = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const query = `
    SELECT 
      employee_id,
      COALESCE(employee_name_snapshot, 'Sin asignar') AS employee_name,
      COUNT(CASE WHEN type = 'INCOME' THEN id END)::int AS services_count,
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN gross_amount ELSE 0 END), 0) AS gross_total,
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN employee_payout ELSE 0 END), 0) AS payout_total,
      COALESCE(SUM(business_net_income), 0) AS net_total,
      COALESCE(AVG(CASE WHEN type = 'INCOME' THEN gross_amount END), 0) AS avg_ticket
    FROM financial_movements
    WHERE tenant_id = $1
      AND (type = 'INCOME' OR employee_id IS NOT NULL)
      AND ($2::timestamp IS NULL OR created_at >= $2::timestamp)
      AND ($3::timestamp IS NULL OR created_at <= $3::timestamp)
    GROUP BY employee_id, employee_name_snapshot
    ORDER BY ${sortCol} ${order};
  `;

  const result = await client.query(query, [tenantId, startDate || null, endDate || null]);

  return result.rows.map((row) => ({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    servicesCount: parseInt(row.services_count, 10),
    grossTotal: parseFloat(row.gross_total),
    payoutTotal: parseFloat(row.payout_total),
    netTotal: parseFloat(row.net_total),
    avgTicket: parseFloat(row.avg_ticket),
  }));
};

const getEmployeeDetail = async (client, tenantId, employeeId, startDate, endDate) => {
  const empQuery = `
    SELECT id, first_name, last_name, email, phone, portal_token
    FROM employees
    WHERE tenant_id = $1 AND id = $2;
  `;

  const statsQuery = `
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN gross_amount ELSE 0 END), 0) AS gross_total,
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN employee_payout ELSE 0 END), 0) AS payout_total,
      COALESCE(SUM(business_net_income), 0) AS net_total,
      COUNT(CASE WHEN type = 'INCOME' THEN id END)::int AS services_count,
      COALESCE(AVG(CASE WHEN type = 'INCOME' THEN gross_amount END), 0) AS avg_ticket
    FROM financial_movements
    WHERE tenant_id = $1 AND employee_id = $2
      AND ($3::timestamp IS NULL OR created_at >= $3::timestamp)
      AND ($4::timestamp IS NULL OR created_at <= $4::timestamp);
  `;

  const movementsQuery = `
    SELECT 
      id, booking_id, customer_name_snapshot, service_name_snapshot, 
      payment_method, gross_amount, employee_payout, business_net_income, 
      notes, created_at
    FROM financial_movements
    WHERE tenant_id = $1 AND employee_id = $2
      AND ($3::timestamp IS NULL OR created_at >= $3::timestamp)
      AND ($4::timestamp IS NULL OR created_at <= $4::timestamp)
    ORDER BY created_at DESC
    LIMIT 50;
  `;

  const [empRes, statsRes, movRes] = await Promise.all([
    client.query(empQuery, [tenantId, employeeId]),
    client.query(statsQuery, [tenantId, employeeId, startDate || null, endDate || null]),
    client.query(movementsQuery, [tenantId, employeeId, startDate || null, endDate || null]),
  ]);

  if (empRes.rowCount === 0) return null;

  const emp = empRes.rows[0];
  const stats = statsRes.rows[0];

  const chart = await getChartData(client, tenantId, startDate, endDate, 'daily', employeeId);

  return {
    employee: {
      id: emp.id,
      name: `${emp.first_name} ${emp.last_name}`,
      email: emp.email,
      phone: emp.phone,
    },
    overview: {
      grossTotal: parseFloat(stats.gross_total),
      payoutTotal: parseFloat(stats.payout_total),
      netTotal: parseFloat(stats.net_total),
      servicesCount: parseInt(stats.services_count, 10),
      avgTicket: parseFloat(stats.avg_ticket),
    },
    chart,
    movements: movRes.rows.map((m) => ({
      id: m.id,
      bookingId: m.booking_id,
      customerName: m.customer_name_snapshot,
      serviceName: m.service_name_snapshot,
      paymentMethod: m.payment_method,
      grossAmount: parseFloat(m.gross_amount),
      employeePayout: parseFloat(m.employee_payout),
      businessNetIncome: parseFloat(m.business_net_income),
      notes: m.notes,
      createdAt: m.created_at,
    })),
  };
};

const getMovements = async (client, tenantId, { startDate, endDate, employeeId, serviceId, paymentMethod, type, limit = 50, offset = 0 }) => {
  const conditions = ['tenant_id = $1'];
  const params = [tenantId];
  let paramIdx = 2;

  if (startDate) {
    conditions.push(`created_at >= $${paramIdx}`);
    params.push(startDate);
    paramIdx++;
  }
  if (endDate) {
    conditions.push(`created_at <= $${paramIdx}`);
    params.push(endDate);
    paramIdx++;
  }
  if (employeeId) {
    conditions.push(`employee_id = $${paramIdx}`);
    params.push(employeeId);
    paramIdx++;
  }
  if (serviceId) {
    conditions.push(`service_id = $${paramIdx}`);
    params.push(serviceId);
    paramIdx++;
  }
  if (paymentMethod) {
    conditions.push(`payment_method = $${paramIdx}`);
    params.push(paymentMethod);
    paramIdx++;
  }
  if (type) {
    conditions.push(`type = $${paramIdx}`);
    params.push(type);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  const countQuery = `SELECT COUNT(id)::int AS total FROM financial_movements WHERE ${whereClause};`;
  const listQuery = `
    SELECT 
      id, booking_id, type, category, gross_amount, commission_type, commission_rate,
      employee_payout, business_net_income, service_name_snapshot, service_duration_snapshot,
      employee_name_snapshot, customer_name_snapshot, payment_method, completed_by_name,
      notes, created_at
    FROM financial_movements
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
  `;

  params.push(limit, offset);

  const [countRes, listRes] = await Promise.all([
    client.query(countQuery, params.slice(0, paramIdx - 1)),
    client.query(listQuery, params),
  ]);

  return {
    total: parseInt(countRes.rows[0].total, 10),
    movements: listRes.rows.map((row) => ({
      id: row.id,
      bookingId: row.booking_id,
      type: row.type,
      category: row.category,
      grossAmount: parseFloat(row.gross_amount),
      commissionType: row.commission_type,
      commissionRate: row.commission_rate ? parseFloat(row.commission_rate) : null,
      employeePayout: parseFloat(row.employee_payout),
      businessNetIncome: parseFloat(row.business_net_income),
      serviceName: row.service_name_snapshot,
      serviceDuration: row.service_duration_snapshot,
      employeeName: row.employee_name_snapshot,
      customerName: row.customer_name_snapshot,
      paymentMethod: row.payment_method,
      completedByName: row.completed_by_name,
      notes: row.notes,
      createdAt: row.created_at,
    })),
  };
};

const createExpense = async (client, tenantId, { amount, category, paymentMethod, notes, createdByUserId, createdByName }) => {
  const businessNetIncome = -Math.abs(parseFloat(amount) || 0);

  const query = `
    INSERT INTO financial_movements (
      tenant_id, type, category, gross_amount, employee_payout, business_net_income,
      service_name_snapshot, service_duration_snapshot, payment_method,
      completed_by_type, completed_by_id, completed_by_name, notes
    )
    VALUES ($1, 'EXPENSE', COALESCE($2, 'OPERATIONAL_EXPENSE'), $3, 0, $4, 'Egreso Operativo', 0, COALESCE($5, 'CASH'), 'USER', $6, $7, $8)
    RETURNING *;
  `;
  const result = await client.query(query, [
    tenantId,
    category || 'OPERATIONAL_EXPENSE',
    amount,
    businessNetIncome,
    paymentMethod || 'CASH',
    createdByUserId || null,
    createdByName || 'Propietario',
    notes || null,
  ]);
  return result.rows[0];
};

const createEmployeePayout = async (client, tenantId, { employeeId, amount, paymentMethod, notes }) => {
  const query = `
    INSERT INTO employee_payouts (
      tenant_id, employee_id, amount, payment_method, notes
    )
    VALUES ($1, $2, $3, COALESCE($4, 'TRANSFER'), $5)
    RETURNING *;
  `;
  const result = await client.query(query, [
    tenantId,
    employeeId,
    amount,
    paymentMethod || 'TRANSFER',
    notes || null,
  ]);
  return result.rows[0];
};

const getEmployeePayouts = async (client, tenantId, employeeId = null) => {
  const query = `
    SELECT 
      p.id, p.employee_id, p.amount, p.payment_method, p.notes, p.created_at,
      CONCAT(e.first_name, ' ', e.last_name) AS employee_name
    FROM employee_payouts p
    JOIN employees e ON p.employee_id = e.id
    WHERE p.tenant_id = $1
      AND ($2::uuid IS NULL OR p.employee_id = $2::uuid)
    ORDER BY p.created_at DESC;
  `;
  const result = await client.query(query, [tenantId, employeeId || null]);
  return result.rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    amount: parseFloat(row.amount),
    paymentMethod: row.payment_method,
    notes: row.notes,
    createdAt: row.created_at,
  }));
};

module.exports = {
  getOverview,
  getKPIs,
  getChartData,
  getEmployeeRanking,
  getEmployeeDetail,
  getMovements,
  createExpense,
  createEmployeePayout,
  getEmployeePayouts,
};

