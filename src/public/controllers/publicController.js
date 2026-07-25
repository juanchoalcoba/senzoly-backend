const db = require('../../config/db');
const publicService = require('../services/publicService');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const isBookingConflict = (error) => error.code === '23P01';

const getTenantBySlug = async (req, res) => {
  const { slug } = req.params;
  const client = await db.getClient();
  try {
    const data = await publicService.getPublicTenant(client, slug);
    return successResponse(res, data, 'Información del negocio obtenida correctamente');
  } catch (error) {
    console.error('Error en getTenantBySlug:', error);
    if (error.message === 'Negocio no encontrado') {
      return errorResponse(res, error.message, [], 404);
    }
    return errorResponse(res, 'Error al obtener información del negocio', [], 500);
  } finally {
    client.release();
  }
};

const getSlots = async (req, res) => {
  const { slug } = req.params;
  const { serviceId, date } = req.query;

  if (!serviceId || !date) {
    return errorResponse(res, 'serviceId y date son parámetros obligatorios', [], 400);
  }

  const client = await db.getClient();
  try {
    const slots = await publicService.getAvailableSlots(client, slug, serviceId, date);
    return successResponse(res, slots, 'Horarios disponibles obtenidos correctamente');
  } catch (error) {
    console.error('Error en getSlots:', error);
    if (
      error.message.includes('encontrado') ||
      error.message.includes('disponible') ||
      error.message.includes('fecha') ||
      error.message.includes('pasadas')
    ) {
      return errorResponse(res, error.message, [], 400);
    }
    return errorResponse(res, 'Error al calcular horarios disponibles', [], 500);
  } finally {
    client.release();
  }
};

const createBooking = async (req, res) => {
  const { slug } = req.params;
  const { serviceId, bookingDate, startTime, customer, notes } = req.body;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await publicService.createPublicBooking(client, slug, {
      serviceId,
      bookingDate,
      startTime,
      customer,
      notes,
    });
    await client.query('COMMIT');
    return successResponse(res, result, 'Reserva confirmada exitosamente', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en createBooking público:', error);
    if (isBookingConflict(error)) {
      return errorResponse(res, 'El horario seleccionado acaba de ocuparse. Por favor elige otro turno.', [], 409);
    }
    if (
      error.message.includes('obligatorios') ||
      error.message.includes('disponible') ||
      error.message.includes('encontrado') ||
      error.message.includes('fecha') ||
      error.message.includes('pasadas')
    ) {
      return errorResponse(res, error.message, [], 400);
    }
    return errorResponse(res, 'Error al crear la reserva', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getTenantBySlug,
  getSlots,
  createBooking,
};
