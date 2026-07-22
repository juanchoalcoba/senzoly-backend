const bcrypt = require('bcrypt');
const { generateToken } = require('../../utils/jwtUtils');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const superAdminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 'Correo y contraseña son requeridos', [], 400);
  }

  const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
  const SUPER_ADMIN_PASSWORD_HASH = process.env.SUPER_ADMIN_PASSWORD_HASH;

  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD_HASH) {
    console.error('Super Admin credentials not configured in environment variables.');
    return errorResponse(res, 'Error de configuración del servidor', [], 500);
  }

  try {
    if (email !== SUPER_ADMIN_EMAIL) {
      return errorResponse(res, 'Credenciales incorrectas', [], 401);
    }

    const isValidPassword = await bcrypt.compare(password, SUPER_ADMIN_PASSWORD_HASH);
    
    if (!isValidPassword) {
      return errorResponse(res, 'Credenciales incorrectas', [], 401);
    }

    // Generar JWT para el Super Admin
    const token = generateToken({
      userId: 'super-admin-000',
      role: 'SUPER_ADMIN'
    });

    const userData = {
      id: 'super-admin-000',
      email: SUPER_ADMIN_EMAIL,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN'
    };

    return successResponse(res, { token, user: userData }, 'Inicio de sesión Super Admin exitoso');
  } catch (error) {
    console.error('Error en superAdminLogin:', error);
    return errorResponse(res, 'Error interno del servidor', [], 500);
  }
};

module.exports = {
  superAdminLogin,
};
