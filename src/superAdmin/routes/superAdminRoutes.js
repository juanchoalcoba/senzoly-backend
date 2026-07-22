const express = require('express');
const { getDashboardStats, getTenantsList } = require('../controllers/superAdminController');
const superAdminMiddleware = require('../../middlewares/superAdminMiddleware');

const router = express.Router();

// Todas las rutas del panel Super Admin quedan protegidas
router.use(superAdminMiddleware);

router.get('/stats', getDashboardStats);
router.get('/tenants', getTenantsList);

module.exports = router;
