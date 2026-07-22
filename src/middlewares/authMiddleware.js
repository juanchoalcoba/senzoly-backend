const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/responseUtils');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Acceso denegado: Token no proporcionado', [], 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-fallback-key-change-me-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.tenantId || !decoded.userId) {
      return errorResponse(res, 'Acceso denegado: Token inválido para operaciones de Tenant', [], 403);
    }

    // Guardar los datos del usuario y tenant en la request
    req.user = decoded;
    next();
  } catch (error) {
    return errorResponse(res, 'Acceso denegado: Token inválido o expirado', [], 401);
  }
};

module.exports = authMiddleware;
