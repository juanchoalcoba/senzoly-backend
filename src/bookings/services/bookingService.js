const bookingRepo = require('../repositories/bookingRepository');

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED'];

const listBookings = async (client, tenantId, filters) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  return await bookingRepo.getBookingsByTenant(client, tenantId, filters);
};

const getBookingDetails = async (client, tenantId, id) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  const booking = await bookingRepo.getBookingById(client, tenantId, id);
  if (!booking) throw new Error('Reserva no encontrada');
  return booking;
};

const changeBookingStatus = async (client, tenantId, id, status) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');

  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Estado inválido. Los valores permitidos son: ${VALID_STATUSES.join(', ')}`);
  }

  const existing = await bookingRepo.getBookingById(client, tenantId, id);
  if (!existing) throw new Error('Reserva no encontrada');

  if (existing.status === 'CANCELED') {
    throw new Error('No se puede modificar una reserva cancelada');
  }

  return await bookingRepo.updateBookingStatus(client, id, tenantId, status);
};

const getBookingOverview = async (client, tenantId) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  return await bookingRepo.getBookingStats(client, tenantId);
};

module.exports = {
  listBookings,
  getBookingDetails,
  changeBookingStatus,
  getBookingOverview,
};
