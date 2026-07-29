const express = require('express');
const {
  getDashboardData,
  getChartSeriesData,
  getEmployeeRankingData,
  getEmployeeDetailData,
  getMovementsData,
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

module.exports = router;
