const { z } = require('zod');
const { successResponse, errorResponse } = require('../../utils/responseUtils');
const passwordResetService = require('../services/passwordResetService');

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresa un correo electrónico válido'),
});

const resetSchema = z.object({
  token: z.string().min(1, 'El enlace de recuperación no es válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string().min(1, 'Debes confirmar la contraseña'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

const requestReset = async (req, res) => {
  const result = requestSchema.safeParse(req.body);
  if (!result.success) {
    return errorResponse(res, result.error.issues[0].message, [], 400);
  }

  try {
    await passwordResetService.requestPasswordReset(result.data.email);
    return successResponse(res, null, 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.');
  } catch (error) {
    console.error('Error al solicitar recuperación de contraseña:', error);
    return errorResponse(res, 'No fue posible procesar la solicitud. Inténtalo nuevamente.', [], 500);
  }
};

const confirmReset = async (req, res) => {
  const result = resetSchema.safeParse(req.body);
  if (!result.success) {
    return errorResponse(res, result.error.issues[0].message, [], 400);
  }

  try {
    await passwordResetService.resetPassword(result.data.token, result.data.password);
    return successResponse(res, null, 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.');
  } catch (error) {
    if (error.message.includes('inválido') || error.message.includes('expiró')) {
      return errorResponse(res, error.message, [], 400);
    }

    console.error('Error al restablecer contraseña:', error);
    return errorResponse(res, 'No fue posible actualizar la contraseña.', [], 500);
  }
};

module.exports = {
  requestReset,
  confirmReset,
};
