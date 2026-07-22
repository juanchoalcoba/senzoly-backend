const db = require('../../config/db');
const { findVerificationByToken, deleteVerificationByUserId } = require('../repositories/verificationRepository');
const { verifyUserEmail } = require('../../users/repositories/userRepository');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return errorResponse(res, 'Token no proporcionado', [], 400);
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const verification = await findVerificationByToken(client, token);

    if (!verification) {
      await client.query('ROLLBACK');
      return errorResponse(res, 'Token inválido o expirado', [], 400);
    }

    if (new Date() > new Date(verification.expires_at)) {
      await client.query('ROLLBACK');
      return errorResponse(res, 'El token ha expirado', [], 400);
    }

    // Marcar usuario como verificado
    await verifyUserEmail(client, verification.user_id);

    // Eliminar el token usado
    await deleteVerificationByUserId(client, verification.user_id);

    await client.query('COMMIT');
    return successResponse(res, null, 'Correo verificado exitosamente');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in verifyEmail:', error);
    return errorResponse(res, 'Error al verificar el correo', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  verifyEmail,
};
