const db = require('../../config/db');
const {
  getOverview,
  getKPIs,
  getChartData,
  getEmployeeRanking,
  getEmployeeDetail,
  getMovements,
  createExpense,
  createEmployeePayout,
  getEmployeePayouts,
} = require('../repositories/financeRepository');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getDashboardData = async (req, res) => {
  const { tenantId } = req.user;
  const { startDate, endDate, branchId } = req.query;
  const client = await db.getClient();
  try {
    const overview = await getOverview(client, tenantId, startDate, endDate, branchId);
    const kpis = await getKPIs(client, tenantId);
    return successResponse(res, { overview, kpis }, 'Métricas financieras obtenidas correctamente');
  } catch (error) {
    console.error('Error en getDashboardData:', error);
    return errorResponse(res, 'Error al obtener datos financieros', [], 500);
  } finally {
    client.release();
  }
};

const getChartSeriesData = async (req, res) => {
  const { tenantId } = req.user;
  const { startDate, endDate, grouping, employeeId } = req.query;
  const client = await db.getClient();
  try {
    const chart = await getChartData(client, tenantId, startDate, endDate, grouping, employeeId);
    return successResponse(res, chart, 'Evolución financiera obtenida correctamente');
  } catch (error) {
    console.error('Error en getChartSeriesData:', error);
    return errorResponse(res, 'Error al obtener gráfico financiero', [], 500);
  } finally {
    client.release();
  }
};

const getEmployeeRankingData = async (req, res) => {
  const { tenantId } = req.user;
  const { startDate, endDate, sortBy, sortOrder } = req.query;
  const client = await db.getClient();
  try {
    const ranking = await getEmployeeRanking(client, tenantId, startDate, endDate, sortBy, sortOrder);
    return successResponse(res, ranking, 'Ranking de empleados obtenido correctamente');
  } catch (error) {
    console.error('Error en getEmployeeRankingData:', error);
    return errorResponse(res, 'Error al obtener ranking de empleados', [], 500);
  } finally {
    client.release();
  }
};

const getEmployeeDetailData = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  const client = await db.getClient();
  try {
    const detail = await getEmployeeDetail(client, tenantId, id, startDate, endDate);
    if (!detail) {
      return errorResponse(res, 'Empleado no encontrado', [], 404);
    }
    return successResponse(res, detail, 'Detalle del empleado obtenido correctamente');
  } catch (error) {
    console.error('Error en getEmployeeDetailData:', error);
    return errorResponse(res, 'Error al obtener detalle del empleado', [], 500);
  } finally {
    client.release();
  }
};

const getMovementsData = async (req, res) => {
  const { tenantId } = req.user;
  const { startDate, endDate, employeeId, serviceId, paymentMethod, type, branchId, limit, offset } = req.query;
  const client = await db.getClient();
  try {
    const result = await getMovements(client, tenantId, {
      startDate,
      endDate,
      employeeId,
      serviceId,
      paymentMethod,
      type,
      branchId,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    return successResponse(res, result, 'Movimientos financieros obtenidos correctamente');
  } catch (error) {
    console.error('Error en getMovementsData:', error);
    return errorResponse(res, 'Error al obtener movimientos financieros', [], 500);
  } finally {
    client.release();
  }
};

const createExpenseData = async (req, res) => {
  const { tenantId } = req.user;
  const userId = req.user.userId || req.user.id || null;
  const firstName = req.user.firstName || '';
  const lastName = req.user.lastName || '';
  const createdByName = `${firstName} ${lastName}`.trim() || 'Propietario';
  const { amount, category, paymentMethod, notes } = req.body;

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return errorResponse(res, 'El monto del egreso debe ser mayor a 0', [], 400);
  }

  const client = await db.getClient();
  try {
    const expense = await createExpense(client, tenantId, {
      amount: parseFloat(amount),
      category,
      paymentMethod,
      notes,
      createdByUserId: userId,
      createdByName,
    });
    return successResponse(res, expense, 'Egreso registrado correctamente');
  } catch (error) {
    console.error('Error en createExpenseData:', error);
    return errorResponse(res, 'Error al registrar egreso', [], 500);
  } finally {
    client.release();
  }
};

const createEmployeePayoutData = async (req, res) => {
  const { tenantId } = req.user;
  const { employeeId, amount, paymentMethod, notes } = req.body;

  if (!employeeId || !amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return errorResponse(res, 'Empleado y monto son obligatorios', [], 400);
  }

  const client = await db.getClient();
  try {
    const payout = await createEmployeePayout(client, tenantId, {
      employeeId,
      amount: parseFloat(amount),
      paymentMethod,
      notes,
    });
    return successResponse(res, payout, 'Liquidación registrada correctamente');
  } catch (error) {
    console.error('Error en createEmployeePayoutData:', error);
    return errorResponse(res, 'Error al registrar liquidación', [], 500);
  } finally {
    client.release();
  }
};

const getEmployeePayoutsData = async (req, res) => {
  const { tenantId } = req.user;
  const { employeeId } = req.query;
  const client = await db.getClient();
  try {
    const payouts = await getEmployeePayouts(client, tenantId, employeeId);
    return successResponse(res, payouts, 'Historial de liquidaciones obtenido correctamente');
  } catch (error) {
    console.error('Error en getEmployeePayoutsData:', error);
    return errorResponse(res, 'Error al obtener liquidaciones', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getDashboardData,
  getChartSeriesData,
  getEmployeeRankingData,
  getEmployeeDetailData,
  getMovementsData,
  createExpenseData,
  createEmployeePayoutData,
  getEmployeePayoutsData,
};
