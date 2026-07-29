const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/responseUtils');
const db = require('../config/db');
const tenantRepo = require('../tenant/repositories/tenantRepository');
const subscriptionRepo = require('../subscriptions/repositories/subscriptionRepository');
const { isTenantOperational, getTenantAccessMessage } = require('../tenant/tenantStatus');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Acceso denegado: Token no proporcionado', [], 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.tenantId || !decoded.userId) {
      return errorResponse(res, 'Acceso denegado: Token inválido para operaciones de Tenant', [], 403);
    }

    // Consultar tenant y suscripción actual
    const tenant = await tenantRepo.findTenantStatusById(db, decoded.tenantId);
    let currentStatus = tenant?.status;

    if (tenant && isTenantOperational(currentStatus)) {
      const subscription = await subscriptionRepo.getSubscriptionByTenantId(db, decoded.tenantId);
      if (subscription && subscription.expires_at) {
        const expiresAt = new Date(subscription.expires_at);
        if (expiresAt < new Date()) {
          // Ha expirado -> suspender automáticamente
          await subscriptionRepo.updateSubscriptionStatusAndExpiration(
            db,
            decoded.tenantId,
            subscription.plan_id,
            'SUSPENDED',
            subscription.expires_at,
            subscription.next_billing_date
          );
          await tenantRepo.updateTenantStatus(db, decoded.tenantId, 'suspended');
          currentStatus = 'suspended';
        }
      }
    }

    // Permitir endpoints de suscripción y me/logout incluso si la cuenta está suspendida para permitir el pago
    const isSubscriptionRoute =
      req.originalUrl.includes('/api/subscriptions') ||
      req.originalUrl.includes('/api/payments') ||
      req.originalUrl.includes('/api/users/me');

    if (!isSubscriptionRoute && (!tenant || !isTenantOperational(currentStatus))) {
      return errorResponse(
        res,
        getTenantAccessMessage(currentStatus),
        [{ code: 'TENANT_UNAVAILABLE', tenantStatus: currentStatus, status: currentStatus }],
        403
      );
    }

    req.user = decoded;
    req.tenantStatus = currentStatus;
    next();
  } catch (error) {
    console.error('Error en authMiddleware:', error);
    return errorResponse(res, 'Acceso denegado: Token inválido o expirado', [], 401);
  }
};

module.exports = authMiddleware;
