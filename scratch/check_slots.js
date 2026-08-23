require('dotenv').config();
const db = require('../src/config/db');
const publicService = require('../src/public/services/publicService');
const publicRepo = require('../src/public/repositories/publicRepository');

async function checkSlots() {
  const client = await db.getClient();
  try {
    const tenant = await publicRepo.findTenantBySlug(client, 'negocio-prueba');
    const services = await publicRepo.getPublicActiveServices(client, tenant.id);
    const service = services[0];

    console.log('Tenant:', tenant.name, tenant.id);
    console.log('Servicio:', service.name, service.id);

    const todaySlots = await publicService.getAvailableSlots(client, 'negocio-prueba', service.id, null, '2026-08-21');
    console.log('Slots para HOY (2026-08-21):', todaySlots.length, 'turnos');

    const tomorrowSlots = await publicService.getAvailableSlots(client, 'negocio-prueba', service.id, null, '2026-08-22');
    console.log('Slots para MAÑANA (2026-08-22):', tomorrowSlots.length, 'turnos');
    if (tomorrowSlots.length > 0) {
      console.log('Primeros 3 turnos de mañana:', tomorrowSlots.slice(0, 3));
    }
  } catch (err) {
    console.error('Error al consultar slots:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkSlots();
