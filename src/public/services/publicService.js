const publicRepo = require('../repositories/publicRepository');
const serviceRepo = require('../../servicesCatalog/repositories/serviceCatalogRepository');
const customerRepo = require('../../customers/repositories/customerRepository');

const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || 'America/Montevideo';

const getBusinessToday = () => {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).reduce((parts, part) => {
    if (part.type !== 'literal') parts[part.type] = part.value;
    return parts;
  }, {});

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
};

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
      businessType: {
        id: tenant.business_type_id,
        name: tenant.business_type_name,
        slug: tenant.business_type_slug,
      },
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

const validateBookingDate = (dateStr) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) {
    throw new Error('La fecha de reserva no es válida');
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const isValidDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValidDate) {
    throw new Error('La fecha de reserva no es válida');
  }

  if (dateStr < getBusinessToday()) {
    throw new Error('No se pueden realizar reservas en fechas pasadas');
  }
};

const getAvailableSlots = async (client, slug, serviceId, dateStr) => {
  validateBookingDate(dateStr);

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
  const bookingSettings = await publicRepo.getTenantBookingSettings(client, tenant.id);
  const slotIntervalMinutes = bookingSettings?.slot_interval_minutes || 30;
  const slotAlignment = bookingSettings?.slot_alignment || 'BUSINESS_OPEN';

  // Obtener reservas existentes para ese día
  const existingBookings = await publicRepo.getExistingBookingsForDate(client, tenant.id, dateStr);

  const slots = [];
  const firstSlot = slotAlignment === 'CLOCK_HOUR'
    ? Math.ceil(openMin / slotIntervalMinutes) * slotIntervalMinutes
    : openMin;

  for (let current = firstSlot; current + duration <= closeMin; current += slotIntervalMinutes) {
    const slotStart = current;
    const slotEnd = current + duration;

    // Verificar si se superpone con alguna reserva existente
    const hasConflict = existingBookings.some((b) => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);

      // Superposición: max(slotStart, bStart) < min(slotEnd, bEnd)
      return Math.max(slotStart, bStart) < Math.min(slotEnd, bEnd);
    });

    slots.push({
      time: minutesToTime(slotStart),
      available: !hasConflict,
    });
  }

  return slots;
};

const createPublicBooking = async (client, slug, bookingPayload) => {
  const { serviceId, bookingDate, startTime, customer, notes } = bookingPayload;

  if (!serviceId || !bookingDate || !startTime || !customer) {
    throw new Error('Todos los campos son obligatorios');
  }

  validateBookingDate(bookingDate);

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
  const slots = await getAvailableSlots(client, slug, serviceId, bookingDate);
  const normalizedStartTime = startTime.substring(0, 5);

  const selectedSlot = slots.find((slot) => slot.time === normalizedStartTime);
  if (!selectedSlot || !selectedSlot.available) {
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
