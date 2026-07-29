const express = require('express');
const {
  getDashboardData,
  getChartSeriesData,
  getEmployeeRankingData,
  getEmployeeDetailData,
  getMovementsData,
  createExpenseData,
  createEmployeePayoutData,
  getEmployeePayoutsData,
} = require('../controllers/financeController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Todas las rutas financieras requieren autenticación de usuario/tenant
router.use(authMiddleware);

router.get('/dashboard', getDashboardData);
router.get('/charts', getChartSeriesData);
router.get('/employees', getEmployeeRankingData);
router.get('/employees/:id', getEmployeeDetailData);
router.get('/movements', getMovementsData);

// Fase 3: Egresos y Liquidaciones
router.post('/expenses', createExpenseData);
router.post('/payouts', createEmployeePayoutData);
router.get('/payouts', getEmployeePayoutsData);

module.exports = router;
