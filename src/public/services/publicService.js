const publicRepo = require('../repositories/publicRepository');
const serviceRepo = require('../../servicesCatalog/repositories/serviceCatalogRepository');
const customerRepo = require('../../customers/repositories/customerRepository');
const { isTenantOperational, getTenantAccessMessage } = require('../../tenant/tenantStatus');

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

const assertTenantOperational = (tenant) => {
  if (!isTenantOperational(tenant.status)) {
    throw new Error(getTenantAccessMessage(tenant.status));
  }
};

const getPublicTenant = async (client, slug, branchId = null) => {
  const tenant = await publicRepo.findTenantBySlug(client, slug);
  if (!tenant) {
    throw new Error('Negocio no encontrado');
  }
  assertTenantOperational(tenant);

  const branches = await publicRepo.getPublicActiveBranches(client, tenant.id);
  const services = await publicRepo.getPublicActiveServices(client, tenant.id, branchId);
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
    branches,
    services,
  };
};

const getPublicBranches = async (client, slug) => {
  const tenant = await publicRepo.findTenantBySlug(client, slug);
  if (!tenant) throw new Error('Negocio no encontrado');
  assertTenantOperational(tenant);

  return await publicRepo.getPublicActiveBranches(client, tenant.id);
};

const getAvailableProfessionals = async (client, slug, serviceId, branchId = null) => {
  const tenant = await publicRepo.findTenantBySlug(client, slug);
  if (!tenant) throw new Error('Negocio no encontrado');
  assertTenantOperational(tenant);

  const service = await serviceRepo.getServiceById(client, tenant.id, serviceId);
  if (!service || !service.is_active) {
    throw new Error('Servicio no encontrado o no disponible');
  }

  return await publicRepo.getPublicActiveEmployeesByService(client, tenant.id, serviceId, branchId);
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

const getAvailableSlots = async (client, slug, serviceId, employeeId, dateStr) => {
  validateBookingDate(dateStr);

  const tenant = await publicRepo.findTenantBySlug(client, slug);
  if (!tenant) throw new Error('Negocio no encontrado');
  assertTenantOperational(tenant);

  const service = await serviceRepo.getServiceById(client, tenant.id, serviceId);
  if (!service || !service.is_active) {
    throw new Error('Servicio no encontrado o no disponible');
  }

  const employee = employeeId
    ? await publicRepo.getPublicActiveEmployeeForService(client, tenant.id, service.id, employeeId)
    : null;
  if (employeeId && !employee) {
    throw new Error('El profesional seleccionado no está disponible para este servicio');
  }

  // Determinar día de la semana (0=Domingo ... 6=Sábado)
  // Usar parse local seguro evitando desplazamientos por zona horaria
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();

  // Obtener horario general del negocio (para pausa y fallback)
  const businessHour = await publicRepo.getTenantBusinessHourForDay(client, tenant.id, dayOfWeek);

  // Sin profesional se conserva la agenda general del negocio. Con profesional,
  // se usan sus intervalos individuales, incluidos horarios partidos.
  let workingHours = employee
    ? await publicRepo.getEmployeeWorkingHoursForDay(client, tenant.id, employee.id, dayOfWeek)
    : (businessHour && !businessHour.is_closed
        ? [{ start_time: businessHour.open_time, end_time: businessHour.close_time }]
        : []);

  if (employee && workingHours.length === 0) {
    if (businessHour && !businessHour.is_closed) {
      workingHours = [{ start_time: businessHour.open_time, end_time: businessHour.close_time }];
    }
  }

  // Pausa opcional desde el horario general del negocio
  const breakStart = businessHour?.break_start;
  const breakEnd = businessHour?.break_end;
  const breakStartMin = breakStart ? timeToMinutes(breakStart) : null;
  const breakEndMin = breakEnd ? timeToMinutes(breakEnd) : null;

  if (workingHours.length === 0) return [];

  const duration = service.duration_minutes;
  const bookingSettings = await publicRepo.getTenantBookingSettings(client, tenant.id);
  const slotIntervalMinutes = bookingSettings?.slot_interval_minutes || 30;
  const slotAlignment = bookingSettings?.slot_alignment || 'BUSINESS_OPEN';

  // En reservas sin profesional se bloquea la agenda general del tenant; en
  // reservas con profesional, sólo bloquean las de ese mismo profesional.
  const existingBookings = await publicRepo.getExistingBookingsForDate(
    client,
    tenant.id,
    employee?.id || null,
    service.id,
    dateStr
  );

  const slots = [];
  for (const workingHour of workingHours) {
    const openMin = timeToMinutes(workingHour.start_time);
    const closeMin = timeToMinutes(workingHour.end_time);
    const firstSlot = slotAlignment === 'CLOCK_HOUR'
      ? Math.ceil(openMin / slotIntervalMinutes) * slotIntervalMinutes
      : openMin;

    for (let current = firstSlot; current + duration <= closeMin; current += slotIntervalMinutes) {
      const slotStart = current;
      const slotEnd = current + duration;

      // Excluir slots que solapan con la pausa (aunque sea parcialmente)
      if (breakStartMin !== null && breakEndMin !== null) {
        if (slotStart < breakEndMin && slotEnd > breakStartMin) {
          continue;
        }
      }

      const hasConflict = existingBookings.some((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        return Math.max(slotStart, bStart) < Math.min(slotEnd, bEnd);
      });

      slots.push({
        time: minutesToTime(slotStart),
        available: !hasConflict,
      });
    }
  }

  return slots;
};

const createPublicBooking = async (client, slug, bookingPayload) => {
  const { serviceId, employeeId, bookingDate, startTime, customer, notes } = bookingPayload;

  if (!serviceId || !bookingDate || !startTime || !customer) {
    throw new Error('Todos los campos son obligatorios');
  }

  validateBookingDate(bookingDate);

  if (!customer.firstName || !customer.lastName || !customer.phone || !customer.phone.trim()) {
    throw new Error('Nombre, apellido y teléfono son obligatorios');
  }

  const tenant = await publicRepo.findTenantBySlug(client, slug);
  if (!tenant) throw new Error('Negocio no encontrado');
  assertTenantOperational(tenant);

  const service = await serviceRepo.getServiceById(client, tenant.id, serviceId);
  if (!service || !service.is_active) {
    throw new Error('Servicio no disponible');
  }

  const employee = employeeId
    ? await publicRepo.getPublicActiveEmployeeForService(client, tenant.id, service.id, employeeId)
    : null;
  if (employeeId && !employee) {
    throw new Error('El profesional seleccionado no está disponible para este servicio');
  }

  // La constraint de exclusión protege las agendas profesionales. Las reservas
  // generales (employee_id NULL) se serializan para evitar dobles reservas.
  if (!employee) {
    await publicRepo.lockUnassignedBookingSchedule(client, tenant.id, service.id, bookingDate);
  }

  // 1. RE-VALIDACIÓN DE DISPONIBILIDAD EN BACKEND (Protección contra doble reserva)
  const slots = await getAvailableSlots(client, slug, serviceId, employeeId, bookingDate);
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
    employeeId: employee?.id || null,
    branchId: bookingPayload.branchId || null,
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
    employee,
    tenant,
  };
};

module.exports = {
  getPublicTenant,
  getPublicBranches,
  getAvailableProfessionals,
  getAvailableSlots,
  createPublicBooking,
};
