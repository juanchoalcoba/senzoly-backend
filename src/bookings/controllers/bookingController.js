const db = require('../../config/db');
const bookingService = require('../services/bookingService');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getBookings = async (req, res) => {
  const { tenantId } = req.user;
  const { date, status, search } = req.query;

  const client = await db.getClient();
  try {
    const bookings = await bookingService.listBookings(client, tenantId, { date, status, search });
    return successResponse(res, bookings, 'Reservas obtenidas correctamente');
  } catch (error) {
    console.error('Error en getBookings:', error);
    return errorResponse(res, 'Error al obtener reservas', [], 500);
  } finally {
    client.release();
  }
};

const getBookingStats = async (req, res) => {
  const { tenantId } = req.user;
  const client = await db.getClient();
  try {
    const stats = await bookingService.getBookingOverview(client, tenantId);
    return successResponse(res, stats, 'Estadísticas de reservas obtenidas correctamente');
  } catch (error) {
    console.error('Error en getBookingStats:', error);
    return errorResponse(res, 'Error al obtener estadísticas', [], 500);
  } finally {
    client.release();
  }
};

const getBookingById = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const client = await db.getClient();
  try {
    const booking = await bookingService.getBookingDetails(client, tenantId, id);
    return successResponse(res, booking, 'Detalle de reserva obtenido correctamente');
  } catch (error) {
    console.error('Error en getBookingById:', error);
    if (error.message === 'Reserva no encontrada') {
      return errorResponse(res, error.message, [], 404);
    }
    return errorResponse(res, 'Error al obtener reserva', [], 500);
  } finally {
    client.release();
  }
};

const patchBookingStatus = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { status } = req.body;

  const client = await db.getClient();
  try {
    const updated = await bookingService.changeBookingStatus(client, tenantId, id, status);
    return successResponse(res, updated, 'Estado de reserva actualizado correctamente');
  } catch (error) {
    console.error('Error en patchBookingStatus:', error);
    if (error.message.includes('no encontrada') || error.message.includes('inválido') || error.message.includes('cancelada')) {
      return errorResponse(res, error.message, [], 400);
    }
    return errorResponse(res, 'Error al actualizar estado de reserva', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getBookings,
  getBookingStats,
  getBookingById,
  patchBookingStatus,
};
