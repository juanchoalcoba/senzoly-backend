const express = require('express');
const { getTenantBySlug, getBranches, getSlots, getProfessionals, createBooking } = require('../controllers/publicController');

const router = express.Router();

// Rutas públicas — Sin JWT
router.get('/tenant/:slug', getTenantBySlug);
router.get('/tenant/:slug/branches', getBranches);
router.get('/tenant/:slug/professionals', getProfessionals);
router.get('/tenant/:slug/slots', getSlots);
router.post('/tenant/:slug/bookings', createBooking);

module.exports = router;
