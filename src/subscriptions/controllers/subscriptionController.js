const subscriptionService = require('../services/subscriptionService');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getSubscriptionStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const details = await subscriptionService.getTenantSubscriptionDetails(tenantId);
    return successResponse(res, details, 'Estado de suscripción obtenido correctamente');
  } catch (error) {
    console.error('Error al obtener estado de suscripción:', error);
    return errorResponse(res, 'Error al obtener estado de suscripción', [], 500);
  }
};

const getAvailablePlans = async (req, res) => {
  try {
    const plans = await subscriptionService.getAvailablePlans();
    return successResponse(res, plans, 'Planes obtenidos correctamente');
  } catch (error) {
    console.error('Error al obtener planes:', error);
    return errorResponse(res, 'Error al obtener planes de suscripción', [], 500);
  }
};

const createPreference = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { planId } = req.body || {};

    const result = await subscriptionService.createPreferenceForTenant(tenantId, userId, planId);
    return successResponse(res, result, 'Preferencia de MercadoPago creada correctamente');
  } catch (error) {
    console.error('Error al crear preferencia de MercadoPago:', error);
    return errorResponse(res, error.message || 'Error al iniciar Checkout Pro', [], 400);
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const details = await subscriptionService.getTenantSubscriptionDetails(tenantId);
    return successResponse(res, details.history || [], 'Historial de pagos obtenido correctamente');
  } catch (error) {
    console.error('Error al obtener historial de pagos:', error);
    return errorResponse(res, 'Error al obtener historial de pagos', [], 500);
  }
};

const handleWebhook = async (req, res) => {
  try {
    console.log('[Webhook Endpoint] Notificación recibida de MercadoPago:', {
      query: req.query,
      body: req.body,
    });

    const result = await subscriptionService.handleWebhook(req.body, req.query);
    // Responder siempre 200 a MercadoPago
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[Webhook Endpoint] Error procesando webhook:', error);
    // MercadoPago reintenta si respondemos >= 400. Respondemos 200 con success: false para evitar bucles infinitos si es un payload con error irrecoverable o respondemos 200.
    return res.status(200).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSubscriptionStatus,
  getAvailablePlans,
  createPreference,
  getPaymentHistory,
  handleWebhook,
};
