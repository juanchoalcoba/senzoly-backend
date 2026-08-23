const express = require('express');
const {
  getTenantBySlug,
  getBranches,
  getSlots,
  getProfessionals,
  createBooking,
  saveFcmToken,
  getBookingByManageToken,
  cancelBookingByManageToken,
} = require('../controllers/publicController');

const router = express.Router();

// Rutas públicas — Sin JWT
router.get('/tenant/:slug', getTenantBySlug);
router.get('/tenant/:slug/branches', getBranches);
router.get('/tenant/:slug/professionals', getProfessionals);
router.get('/tenant/:slug/slots', getSlots);
router.post('/tenant/:slug/bookings', createBooking);

// Registro de tokens FCM (Navegadores / Clientes / Admins)
router.post('/fcm-token', saveFcmToken);

// Gestión y Cancelación de reservas por token único
router.get('/bookings/manage/:token', getBookingByManageToken);
router.post('/bookings/manage/:token/cancel', cancelBookingByManageToken);

module.exports = router;
