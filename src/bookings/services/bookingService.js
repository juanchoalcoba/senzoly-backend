const bookingRepo = require('../repositories/bookingRepository');

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'];

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

const changeBookingStatus = async (client, tenantId, id, status, completedBy = {}) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');

  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Estado inválido. Los valores permitidos son: ${VALID_STATUSES.join(', ')}`);
  }

  const existing = await bookingRepo.getBookingById(client, tenantId, id);
  if (!existing) throw new Error('Reserva no encontrada');

  if (existing.status === 'CANCELED') {
    throw new Error('No se puede modificar una reserva cancelada');
  }

  // Si ya está completada, no volvemos a generar el movimiento financiero
  if (existing.status === 'COMPLETED' && status === 'COMPLETED') {
    return existing;
  }

  // Si el nuevo estado es COMPLETED, ejecutamos la actualización y la creación del movimiento en una transacción atómica
  if (status === 'COMPLETED') {
    const grossAmount = parseFloat(existing.total_price || 0);
    const commissionType = existing.commission_type || null;
    const commissionRate = parseFloat(existing.commission_value || 0);
    let employeePayout = 0;

    if (commissionType === 'percentage') {
      employeePayout = (grossAmount * commissionRate) / 100;
    } else if (commissionType === 'fixed') {
      employeePayout = commissionRate;
    }

    // Asegurar que el pago al empleado no supere el bruto ni sea negativo
    employeePayout = Math.max(0, Math.min(grossAmount, employeePayout));
    const businessNetIncome = Math.max(0, grossAmount - employeePayout);

    const serviceNameSnapshot = existing.service_name || 'Servicio';
    const serviceDurationSnapshot = parseInt(existing.duration_minutes || 0, 10);
    const employeeNameSnapshot = existing.employee_first_name 
      ? `${existing.employee_first_name} ${existing.employee_last_name}`.trim() 
      : null;
    const customerNameSnapshot = `${existing.customer_first_name || ''} ${existing.customer_last_name || ''}`.trim() || 'Cliente';

    try {
      await client.query('BEGIN');

      const updatedBooking = await bookingRepo.updateBookingStatus(client, id, tenantId, status);

      await bookingRepo.createFinancialMovement(client, {
        tenant_id: tenantId,
        booking_id: existing.id,
        employee_id: existing.employee_id || null,
        customer_id: existing.customer_id || null,
        service_id: existing.service_id || null,
        type: 'INCOME',
        category: 'SERVICE_BOOKING',
        gross_amount: grossAmount,
        commission_type: commissionType,
        commission_rate: commissionRate,
        employee_payout: employeePayout,
        business_net_income: businessNetIncome,
        service_name_snapshot: serviceNameSnapshot,
        service_duration_snapshot: serviceDurationSnapshot,
        employee_name_snapshot: employeeNameSnapshot,
        customer_name_snapshot: customerNameSnapshot,
        payment_method: 'CASH',
        completed_by_type: completedBy.type || 'USER',
        completed_by_id: completedBy.id || null,
        completed_by_name: completedBy.name || null,
        notes: existing.notes || null,
      });

      await client.query('COMMIT');
      return updatedBooking;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al completar reserva y generar movimiento financiero:', error);
      throw error;
    }
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
