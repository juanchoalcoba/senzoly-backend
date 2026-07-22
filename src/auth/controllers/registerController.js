const { registerCompany } = require('../services/registerService');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const register = async (req, res) => {
  try {
    // El req.body ya viene validado y saneado por registerValidator
    await registerCompany(req.body);

    return successResponse(
      res, 
      null, 
      'Cuenta creada exitosamente. Por favor verifica tu correo electrónico.', 
      201
    );
  } catch (error) {
    if (error.message === 'El correo electrónico ya se encuentra registrado' || 
        error.message === 'El rubro seleccionado no es válido' ||
        error.message === 'No se encontró el plan de suscripción básico') {
      return errorResponse(res, error.message, [], 400);
    }
    
    console.error('Error in registerController:', error);
    return errorResponse(res, 'Error interno del servidor', [], 500);
  }
};

module.exports = {
  register,
};
