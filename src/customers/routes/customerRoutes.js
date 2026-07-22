const express = require('express');
const { getCustomers, getCustomerById, patchCustomer, getCustomerStats } = require('../controllers/customerController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Todas las rutas de clientes requieren autenticación JWT
router.use(authMiddleware);

router.get('/', getCustomers);
router.get('/stats', getCustomerStats);
router.get('/:id', getCustomerById);
router.patch('/:id', patchCustomer);

module.exports = router;
