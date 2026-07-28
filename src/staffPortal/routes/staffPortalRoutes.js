const express = require('express');
const { getStaffPortalData, updateStaffBookingStatus } = require('../controllers/staffPortalController');

const router = express.Router();

router.get('/:token', getStaffPortalData);
router.patch('/:token/bookings/:id/status', updateStaffBookingStatus);

module.exports = router;
