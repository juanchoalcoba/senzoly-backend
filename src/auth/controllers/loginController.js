const bcrypt = require('bcrypt');
const db = require('../../config/db');
const { findUserByEmailForAuth } = require('../../users/repositories/userRepository');
const { generateToken } = require('../../utils/jwtUtils');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 'Correo y contraseña son requeridos', [], 400);
  }

  const client = await db.getClient();
  try {
    const user = await findUserByEmailForAuth(client, email);
    if (!user) {
      return errorResponse(res, 'Credenciales incorrectas', [], 401);
    }

    if (!user.is_active) {
      return errorResponse(res, 'La cuenta está desactivada', [], 403);
    }

    if (!user.email_verified) {
      return errorResponse(res, 'Debes verificar tu correo electrónico antes de iniciar sesión', [], 403);
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return errorResponse(res, 'Credenciales incorrectas', [], 401);
    }

    // Generar JWT
    const token = generateToken({
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role
    });

    // Actualizar last_login_at
    await client.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const userData = {
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
    };

    return successResponse(res, { token, user: userData }, 'Inicio de sesión exitoso');
  } catch (error) {
    console.error('Error en login:', error);
    return errorResponse(res, 'Error al iniciar sesión', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  login,
};
