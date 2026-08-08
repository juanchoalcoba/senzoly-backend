const serviceRepo = require('../repositories/serviceCatalogRepository');
const tenantRepo = require('../../tenant/repositories/tenantRepository');
const cloudinaryService = require('../../services/cloudinaryService');

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

  const newService = await serviceRepo.createService(client, tenantId, {
    ...serviceData,
    name: name.trim(),
    durationMinutes: duration,
    price: numericPrice,
  });

  // Auto-assign new service to all active branches of the tenant
  try {
    const branchesRes = await client.query(
      'SELECT id FROM branches WHERE tenant_id = $1 AND is_active = true;',
      [tenantId]
    );
    if (branchesRes.rows.length > 0) {
      const values = branchesRes.rows
        .map((_, idx) => `($${idx + 2}, $1)`)
        .join(', ');
      const branchIds = branchesRes.rows.map((b) => b.id);
      await client.query(
        `INSERT INTO branch_services (branch_id, service_id) VALUES ${values} ON CONFLICT DO NOTHING;`,
        [newService.id, ...branchIds]
      );
    }
  } catch (err) {
    console.error('Error al auto-asignar servicio a sucursales:', err);
  }

  return newService;
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

const replaceServiceImage = async (client, serviceId, tenantId, file) => {
  const existing = await getServiceDetails(client, tenantId, serviceId);
  const tenant = await tenantRepo.findTenantSlugById(client, tenantId);
  if (!tenant) throw new Error('Empresa no encontrada');

  const uploadedImage = await cloudinaryService.uploadServiceImage({
    buffer: file.buffer,
    tenantSlug: tenant.slug,
    serviceId,
  });

  let updatedService;
  try {
    updatedService = await serviceRepo.updateServiceImage(client, serviceId, tenantId, uploadedImage);
  } catch (error) {
    try {
      await cloudinaryService.destroyImage(uploadedImage.imagePublicId);
    } catch (cleanupError) {
      console.error('No se pudo limpiar una imagen recién subida:', cleanupError);
    }
    throw error;
  }

  if (existing.image_public_id) {
    try {
      await cloudinaryService.destroyImage(existing.image_public_id);
    } catch (error) {
      console.error(`No se pudo eliminar la imagen anterior del servicio ${serviceId}:`, error);
    }
  }

  return updatedService;
};

const removeServiceImage = async (client, serviceId, tenantId) => {
  const existing = await getServiceDetails(client, tenantId, serviceId);
  if (!existing.image_url && !existing.image_public_id) return existing;

  const updatedService = await serviceRepo.updateServiceImage(client, serviceId, tenantId, {
    imageUrl: null,
    imagePublicId: null,
  });

  if (existing.image_public_id) {
    try {
      await cloudinaryService.destroyImage(existing.image_public_id);
    } catch (error) {
      console.error(`No se pudo eliminar la imagen de Cloudinary del servicio ${serviceId}:`, error);
    }
  }

  return updatedService;
};

module.exports = {
  listServices,
  getServiceDetails,
  addService,
  modifyService,
  getServiceOverview,
  replaceServiceImage,
  removeServiceImage,
};
