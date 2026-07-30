const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../../middlewares/authMiddleware');
const webhookSignatureMiddleware = require('../middlewares/webhookSignatureMiddleware');

// Endpoint público para webhook de MercadoPago
router.post('/webhook', webhookSignatureMiddleware, subscriptionController.handleWebhook);

// Endpoints protegidos para Tenants
router.get('/status', authMiddleware, subscriptionController.getSubscriptionStatus);
router.get('/plans', authMiddleware, subscriptionController.getAvailablePlans);
router.post('/create-preference', authMiddleware, subscriptionController.createPreference);
router.get('/history', authMiddleware, subscriptionController.getPaymentHistory);

module.exports = router;
