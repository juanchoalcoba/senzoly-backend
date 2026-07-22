const db = require('../../config/db');
const { getUserWithDetails } = require('../repositories/userRepository');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getMe = async (req, res) => {
  const { userId, tenantId } = req.user;

  const client = await db.getClient();
  try {
    const userDetails = await getUserWithDetails(client, userId, tenantId);
    
    if (!userDetails) {
      return errorResponse(res, 'Usuario no encontrado', [], 404);
    }

    const data = {
      user: {
        id: userDetails.user_id,
        firstName: userDetails.first_name,
        lastName: userDetails.last_name,
        email: userDetails.email,
        role: userDetails.role,
        isActive: userDetails.is_active,
        emailVerified: userDetails.email_verified,
      },
      tenant: {
        id: userDetails.tenant_id,
        name: userDetails.tenant_name,
        slug: userDetails.tenant_slug,
      },
      subscription: {
        id: userDetails.subscription_id,
        status: userDetails.subscription_status,
        startsAt: userDetails.starts_at,
        expiresAt: userDetails.expires_at,
        plan: {
          id: userDetails.plan_id,
          name: userDetails.plan_name,
          slug: userDetails.plan_slug,
          maxUsers: userDetails.max_users,
          maxLocations: userDetails.max_locations,
          maxBookings: userDetails.max_bookings,
        }
      }
    };

    return successResponse(res, data, 'Datos del usuario obtenidos correctamente');
  } catch (error) {
    console.error('Error en getMe:', error);
    return errorResponse(res, 'Error al obtener los datos del usuario', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getMe,
};
