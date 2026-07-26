const express = require('express');
const {
  getProfile,
  patchProfile,
  getHours,
  patchHours,
  getBookingRules,
  patchBookingRules,
} = require('../controllers/settingsController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Todas las rutas de configuración requieren autenticación JWT
router.use(authMiddleware);

router.get('/profile', getProfile);
router.patch('/profile', patchProfile);

router.get('/hours', getHours);
router.patch('/hours', patchHours);

router.get('/booking-rules', getBookingRules);
router.patch('/booking-rules', patchBookingRules);

module.exports = router;
