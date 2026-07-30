const settingsRepo = require('../repositories/settingsRepository');

const getProfile = async (client, tenantId) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  const profile = await settingsRepo.getTenantProfile(client, tenantId);
  if (!profile) throw new Error('Empresa no encontrada');
  return profile;
};

const updateProfile = async (client, tenantId, profileData) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  const { name, phone, address, description } = profileData;

  if (name !== undefined && name.trim() === '') {
    throw new Error('El nombre comercial no puede estar vacío');
  }

  return await settingsRepo.updateTenantProfile(client, tenantId, {
    name: name ? name.trim() : undefined,
    phone: phone ? phone.trim() : null,
    address: address ? address.trim() : null,
    description: description ? description.trim() : null,
  });
};

const getHours = async (client, tenantId) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  
  let hours = await settingsRepo.getBusinessHours(client, tenantId);

  // Si el tenant aún no tiene horarios guardados, inicializamos por defecto los 7 días (0-6)
  if (!hours || hours.length === 0) {
    const defaultSchedule = [
      { dayOfWeek: 0, openTime: '09:00:00', closeTime: '19:00:00', isClosed: true },  // Domingo
      { dayOfWeek: 1, openTime: '09:00:00', closeTime: '19:00:00', isClosed: false }, // Lunes
      { dayOfWeek: 2, openTime: '09:00:00', closeTime: '19:00:00', isClosed: false }, // Martes
      { dayOfWeek: 3, openTime: '09:00:00', closeTime: '19:00:00', isClosed: false }, // Miércoles
      { dayOfWeek: 4, openTime: '09:00:00', closeTime: '19:00:00', isClosed: false }, // Jueves
      { dayOfWeek: 5, openTime: '09:00:00', closeTime: '19:00:00', isClosed: false }, // Viernes
      { dayOfWeek: 6, openTime: '09:00:00', closeTime: '13:00:00', isClosed: false }, // Sábado
    ];

    for (const item of defaultSchedule) {
      await settingsRepo.upsertBusinessHour(client, tenantId, item);
    }

    hours = await settingsRepo.getBusinessHours(client, tenantId);
  }

  return hours;
};

const updateHours = async (client, tenantId, hoursArray) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  if (!Array.isArray(hoursArray) || hoursArray.length === 0) {
    throw new Error('Debe enviar una lista válida de horarios');
  }

  // Validaciones de consistencia
  for (const day of hoursArray) {
    const dayNum = parseInt(day.dayOfWeek, 10);
    if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
      throw new Error('Día de la semana no válido (debe estar entre 0 y 6)');
    }

    if (!day.isClosed) {
      if (!day.openTime || !day.closeTime) {
        throw new Error(`Debe especificar la hora de apertura y cierre para los días abiertos`);
      }
      if (day.openTime >= day.closeTime) {
        throw new Error(`La hora de apertura debe ser anterior a la hora de cierre`);
      }

      // Validación de pausa opcional
      const bs = day.breakStart ? day.breakStart.substring(0, 5) : '';
      const be = day.breakEnd ? day.breakEnd.substring(0, 5) : '';
      const hasBreakStart = bs !== '';
      const hasBreakEnd = be !== '';

      if (hasBreakStart !== hasBreakEnd) {
        throw new Error('Debe especificar tanto inicio como fin de la pausa');
      }
      if (hasBreakStart && hasBreakEnd) {
        if (bs >= be) {
          throw new Error('La hora de inicio de pausa debe ser anterior a la de fin');
        }
        const op = day.openTime.substring(0, 5);
        const cl = day.closeTime.substring(0, 5);
        if (bs < op || be > cl) {
          throw new Error('La pausa debe estar dentro del horario de apertura y cierre');
        }
      }
    }
  }

  // Guardado atómico
  const updatedHours = [];
  for (const day of hoursArray) {
    const saved = await settingsRepo.upsertBusinessHour(client, tenantId, {
      dayOfWeek: parseInt(day.dayOfWeek, 10),
      openTime: day.openTime,
      closeTime: day.closeTime,
      isClosed: Boolean(day.isClosed),
      breakStart: day.breakStart || null,
      breakEnd: day.breakEnd || null,
    });
    updatedHours.push(saved);
  }

  return updatedHours;
};

const getBookingRules = async (client, tenantId) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  const settings = await settingsRepo.getBookingSettings(client, tenantId);

  return settings || {
    slot_interval_minutes: 30,
    slot_alignment: 'BUSINESS_OPEN',
  };
};

const updateBookingRules = async (client, tenantId, rules) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  const slotIntervalMinutes = Number(rules.slotIntervalMinutes);
  const slotAlignment = rules.slotAlignment;

  if (![15, 30, 60].includes(slotIntervalMinutes)) {
    throw new Error('El intervalo de turnos debe ser de 15, 30 o 60 minutos');
  }

  if (!['BUSINESS_OPEN', 'CLOCK_HOUR'].includes(slotAlignment)) {
    throw new Error('La alineación de turnos no es válida');
  }

  return settingsRepo.upsertBookingSettings(client, tenantId, {
    slotIntervalMinutes,
    slotAlignment,
  });
};

module.exports = {
  getProfile,
  updateProfile,
  getHours,
  updateHours,
  getBookingRules,
  updateBookingRules,
};
