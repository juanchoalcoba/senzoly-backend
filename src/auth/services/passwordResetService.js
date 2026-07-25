const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../../config/db');
const { findUserByEmail, updateUserPassword } = require('../../users/repositories/userRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');
const { sendPasswordResetEmail } = require('../../utils/emailService');

const PASSWORD_RESET_EXPIRATION_MS = 60 * 60 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const requestPasswordReset = async (email) => {
  const client = await db.getClient();

  try {
    const user = await findUserByEmail(client, email.toLowerCase().trim());
    if (!user || !user.is_active) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRATION_MS);

    await client.query('BEGIN');
    await passwordResetRepository.deleteActiveTokensByUserId(client, user.id);
    await passwordResetRepository.createPasswordResetToken(client, user.id, hashToken(token), expiresAt);
    await client.query('COMMIT');

    sendPasswordResetEmail(user.email, token).catch((error) => {
      console.error('Error no crítico al enviar recuperación de contraseña:', error);
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const resetPassword = async (token, password) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const resetToken = await passwordResetRepository.findActiveTokenByHash(client, hashToken(token));

    if (!resetToken || new Date() > new Date(resetToken.expires_at)) {
      throw new Error('El enlace para restablecer la contraseña es inválido o expiró');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await updateUserPassword(client, resetToken.user_id, passwordHash);
    await passwordResetRepository.markTokensAsUsedByUserId(client, resetToken.user_id);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  requestPasswordReset,
  resetPassword,
};
