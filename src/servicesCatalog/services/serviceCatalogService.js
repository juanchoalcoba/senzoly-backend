const serviceRepo = require('../repositories/serviceCatalogRepository');

const listServices = async (client, tenantId) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  return await serviceRepo.getServicesByTenant(client, tenantId);
};

const getServiceDetails = async (client, tenantId, id) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  const service = await serviceRepo.getServiceById(client, tenantId, id);
  if (!service) {
    throw new Error('Servicio no encontrado');
  }
  return service;
};

const addService = async (client, tenantId, serviceData) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  const { name, durationMinutes, price } = serviceData;

  if (!name || name.trim() === '') {
    throw new Error('El nombre del servicio es obligatorio');
  }

  const duration = parseInt(durationMinutes, 10);
  if (isNaN(duration) || duration <= 0) {
    throw new Error('La duración estimada debe ser un número mayor a cero (en minutos)');
  }

  const numericPrice = parseFloat(price);
  if (isNaN(numericPrice) || numericPrice < 0) {
    throw new Error('El precio debe ser un número mayor o igual a cero');
  }

  return await serviceRepo.createService(client, tenantId, {
    ...serviceData,
    name: name.trim(),
    durationMinutes: duration,
    price: numericPrice,
  });
};

const modifyService = async (client, id, tenantId, updateData) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');

  const existing = await serviceRepo.getServiceById(client, tenantId, id);
  if (!existing) {
    throw new Error('Servicio no encontrado');
  }

  if (updateData.name !== undefined && updateData.name.trim() === '') {
    throw new Error('El nombre del servicio no puede estar vacío');
  }

  if (updateData.durationMinutes !== undefined) {
    const duration = parseInt(updateData.durationMinutes, 10);
    if (isNaN(duration) || duration <= 0) {
      throw new Error('La duración estimada debe ser un número mayor a cero (en minutos)');
    }
    updateData.durationMinutes = duration;
  }

  if (updateData.price !== undefined) {
    const numericPrice = parseFloat(updateData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      throw new Error('El precio debe ser un número mayor o igual a cero');
    }
    updateData.price = numericPrice;
  }

  if (updateData.name) {
    updateData.name = updateData.name.trim();
  }

  return await serviceRepo.updateService(client, id, tenantId, updateData);
};

const getServiceOverview = async (client, tenantId) => {
  if (!tenantId) throw new Error('El ID de la empresa (tenant) es obligatorio');
  return await serviceRepo.getServiceStats(client, tenantId);
};

module.exports = {
  listServices,
  getServiceDetails,
  addService,
  modifyService,
  getServiceOverview,
};
