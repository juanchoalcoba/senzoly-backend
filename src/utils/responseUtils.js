/**
 * Helper de respuestas estandarizadas
 */

const successResponse = (res, data = null, message = '', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
};

const errorResponse = (res, message = 'Ocurrió un error', errors = [], statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = {
  successResponse,
  errorResponse,
};
