const db = require('../../config/db');
const staffPortalRepo = require('../repositories/staffPortalRepository');
const bookingService = require('../../bookings/services/bookingService');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getStaffPortalData = async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return errorResponse(res, 'Token de enlace inválido', [], 400);
  }

  const client = await db.getClient();
  try {
    const employee = await staffPortalRepo.getEmployeeByToken(client, token);
    if (!employee) {
      return errorResponse(res, 'Enlace no válido o profesional inactivo', [], 444);
    }

    const bookings = await staffPortalRepo.getStaffBookingsToday(client, employee.tenant_id, employee.id);

    return successResponse(res, {
      employee: {
        id: employee.id,
        firstName: employee.first_name,
        lastName: employee.last_name,
        email: employee.email,
        phone: employee.phone,
      },
      tenant: {
        name: employee.tenant_name,
        slug: employee.tenant_slug,
        phone: employee.tenant_phone,
        address: employee.tenant_address,
      },
      bookings,
    }, 'Datos del portal profesional obtenidos correctamente');
  } catch (error) {
    console.error('Error en getStaffPortalData:', error);
    return errorResponse(res, 'Error al cargar portal del profesional', [], 500);
  } finally {
    client.release();
  }
};

const updateStaffBookingStatus = async (req, res) => {
  const { token, id: bookingId } = req.params;
  const { status } = req.body;

  if (!['IN_PROGRESS', 'COMPLETED'].includes(status)) {
    return errorResponse(res, 'Solo se permite cambiar el estado a IN_PROGRESS o COMPLETED', [], 400);
  }

  const client = await db.getClient();
  try {
    const employee = await staffPortalRepo.getEmployeeByToken(client, token);
    if (!employee) {
      return errorResponse(res, 'Enlace no válido o profesional inactivo', [], 403);
    }

    const completedBy = {
      type: 'EMPLOYEE',
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`.trim(),
    };

    const updated = await bookingService.changeBookingStatus(
      client,
      employee.tenant_id,
      bookingId,
      status,
      completedBy
    );

    return successResponse(res, updated, 'Estado de la reserva actualizado por el profesional');
  } catch (error) {
    console.error('Error en updateStaffBookingStatus:', error);
    if (error.message.includes('no encontrada') || error.message.includes('cancelada')) {
      return errorResponse(res, error.message, [], 400);
    }
    return errorResponse(res, 'Error al actualizar reserva desde el portal', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getStaffPortalData,
  updateStaffBookingStatus,
};
