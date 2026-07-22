const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/responseUtils');

const superAdminMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Acceso denegado: Token no proporcionado', [], 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Acceso denegado: Permisos insuficientes', [], 403);
    }

    // Guardar los datos del admin en la request para uso posterior
    req.superAdmin = decoded;
    next();
  } catch (error) {
    return errorResponse(res, 'Acceso denegado: Token inválido o expirado', [], 401);
  }
};

module.exports = superAdminMiddleware;
