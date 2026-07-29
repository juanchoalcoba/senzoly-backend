const express = require('express');
const {
  getDashboardStats,
  getTenantsList,
  getTenantDetails,
  suspendTenant,
  reactivateTenant,
  deleteTenant,
  getSubscriptionsOverview,
  getPlansOverview,
} = require('../controllers/superAdminController');
const superAdminMiddleware = require('../../middlewares/superAdminMiddleware');

const router = express.Router();

// Todas las rutas del panel Super Admin quedan protegidas
router.use(superAdminMiddleware);

router.get('/stats', getDashboardStats);
router.get('/subscriptions', getSubscriptionsOverview);
router.get('/plans', getPlansOverview);
router.get('/tenants', getTenantsList);
router.get('/tenants/:id', getTenantDetails);
router.patch('/tenants/:id/suspend', suspendTenant);
router.patch('/tenants/:id/reactivate', reactivateTenant);
router.delete('/tenants/:id', deleteTenant);

module.exports = router;
