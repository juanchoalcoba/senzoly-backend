const express = require('express');
const { getBookings, getBookingStats, getBookingById, patchBookingStatus } = require('../controllers/bookingController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getBookings);
router.get('/stats', getBookingStats);
router.get('/:id', getBookingById);
router.patch('/:id/status', patchBookingStatus);

module.exports = router;
