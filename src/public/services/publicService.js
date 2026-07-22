const publicRepo = require('../repositories/publicRepository');
const serviceRepo = require('../../servicesCatalog/repositories/serviceCatalogRepository');
const customerRepo = require('../../customers/repositories/customerRepository');

const getPublicTenant = async (client, slug) => {
  const tenant = await publicRepo.findTenantBySlug(client, slug);
  if (!tenant) {
    throw new Error('Negocio no encontrado');
  }

  const services = await publicRepo.getPublicActiveServices(client, tenant.id);
  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      country: tenant.country,
      phone: tenant.phone,
      address: tenant.address,
      description: tenant.description,
    },
    services,
  };
};

// Helper para convertir "HH:MM" o "HH:MM:SS" a minutos desde las 00:00
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
};

// Helper para convertir minutos a "HH:MM"
const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getAvailableSlots = async (client, slug, serviceId, dateStr) => {
  const tenant = await publicRepo.findTenantBySlug(client, slug);
  if (!tenant) throw new Error('Negocio no encontrado');

  const service = await serviceRepo.getServiceById(client, tenant.id, serviceId);
  if (!service || !service.is_active) {
    throw new Error('Servicio no encontrado o no disponible');
  }

  // Determinar día de la semana (0=Domingo ... 6=Sábado)
  // Usar parse local seguro evitando desplazamientos por zona horaria
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();

  // Obtener horario comercial para ese día
  const businessHour = await publicRepo.getTenantBusinessHourForDay(client, tenant.id, dayOfWeek);
  if (!businessHour || businessHour.is_closed) {
    return []; // El negocio está cerrado este día
  }

  const openMin = timeToMinutes(businessHour.open_time);
  const closeMin = timeToMinutes(businessHour.close_time);
  const duration = service.duration_minutes;

  // Obtener reservas existentes para ese día
  const existingBookings = await publicRepo.getExistingBookingsForDate(client, tenant.id, dateStr);

  const availableSlots = [];
  const step = 30; // Intervalos de 30 minutos

  for (let current = openMin; current + duration <= closeMin; current += step) {
    const slotStart = current;
    const slotEnd = current + duration;

    // Verificar si se superpone con alguna reserva existente
    const hasConflict = existingBookings.some((b) => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);

      // Superposición: max(slotStart, bStart) < min(slotEnd, bEnd)
      return Math.max(slotStart, bStart) < Math.min(slotEnd, bEnd);
    });

    if (!hasConflict) {
      availableSlots.push(minutesToTime(slotStart));
    }
  }

  return availableSlots;
};

const createPublicBooking = async (client, slug, bookingPayload) => {
  const { serviceId, bookingDate, startTime, customer, notes } = bookingPayload;

  if (!serviceId || !bookingDate || !startTime || !customer) {
    throw new Error('Todos los campos son obligatorios');
  }

  if (!customer.firstName || !customer.lastName || (!customer.email && !customer.phone)) {
    throw new Error('Nombre, apellido y al menos un método de contacto (email o teléfono) son obligatorios');
  }

  const tenant = await publicRepo.findTenantBySlug(client, slug);
  if (!tenant) throw new Error('Negocio no encontrado');

  const service = await serviceRepo.getServiceById(client, tenant.id, serviceId);
  if (!service || !service.is_active) {
    throw new Error('Servicio no disponible');
  }

  // 1. RE-VALIDACIÓN DE DISPONIBILIDAD EN BACKEND (Protección contra doble reserva)
  const availableSlots = await getAvailableSlots(client, slug, serviceId, bookingDate);
  const normalizedStartTime = startTime.substring(0, 5);

  if (!availableSlots.includes(normalizedStartTime)) {
    throw new Error('El horario seleccionado ya no se encuentra disponible. Por favor elige otro turno.');
  }

  // 2. Alta o Reutilización de cliente
  const customerRecord = await customerRepo.findOrCreateCustomer(client, tenant.id, {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    notes: customer.notes,
  });

  // 3. Cálculo de fin de cita y total
  const startMin = timeToMinutes(normalizedStartTime);
  const endMin = startMin + service.duration_minutes;
  const endTimeStr = `${minutesToTime(endMin)}:00`;
  const startTimeStr = `${normalizedStartTime}:00`;

  // 4. Inserción de la reserva
  const bookingRecord = await publicRepo.createBookingRecord(client, {
    tenantId: tenant.id,
    customerId: customerRecord.id,
    serviceId: service.id,
    employeeId: null,
    bookingDate,
    startTime: startTimeStr,
    endTime: endTimeStr,
    totalPrice: service.price,
    notes: notes || null,
    status: 'CONFIRMED',
  });

  return {
    booking: bookingRecord,
    customer: customerRecord,
    service,
    tenant,
  };
};

module.exports = {
  getPublicTenant,
  getAvailableSlots,
  createPublicBooking,
};
