const db = require('../../config/db');
const serviceCatalogService = require('../services/serviceCatalogService');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getServices = async (req, res) => {
  const { tenantId } = req.user;
  const client = await db.getClient();
  try {
    const services = await serviceCatalogService.listServices(client, tenantId);
    return successResponse(res, services, 'Servicios obtenidos correctamente');
  } catch (error) {
    console.error('Error en getServices:', error);
    return errorResponse(res, 'Error al obtener servicios', [], 500);
  } finally {
    client.release();
  }
};

const getServiceStats = async (req, res) => {
  const { tenantId } = req.user;
  const client = await db.getClient();
  try {
    const stats = await serviceCatalogService.getServiceOverview(client, tenantId);
    return successResponse(res, stats, 'Estadísticas de servicios obtenidas correctamente');
  } catch (error) {
    console.error('Error en getServiceStats:', error);
    return errorResponse(res, 'Error al obtener estadísticas de servicios', [], 500);
  } finally {
    client.release();
  }
};

const getServiceById = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const client = await db.getClient();
  try {
    const service = await serviceCatalogService.getServiceDetails(client, tenantId, id);
    return successResponse(res, service, 'Detalle de servicio obtenido correctamente');
  } catch (error) {
    console.error('Error en getServiceById:', error);
    if (error.message === 'Servicio no encontrado') {
      return errorResponse(res, error.message, [], 404);
    }
    return errorResponse(res, 'Error al obtener servicio', [], 500);
  } finally {
    client.release();
  }
};

const createService = async (req, res) => {
  const { tenantId } = req.user;
  const { name, description, durationMinutes, price, isActive } = req.body;

  const client = await db.getClient();
  try {
    const newService = await serviceCatalogService.addService(client, tenantId, {
      name,
      description,
      durationMinutes,
      price,
      isActive,
    });
    return successResponse(res, newService, 'Servicio creado correctamente', 201);
  } catch (error) {
    console.error('Error en createService:', error);
    if (
      error.message.includes('obligatorio') ||
      error.message.includes('mayor') ||
      error.message.includes('número')
    ) {
      return errorResponse(res, error.message, [], 400);
    }
    return errorResponse(res, 'Error al crear servicio', [], 500);
  } finally {
    client.release();
  }
};

const patchService = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { name, description, durationMinutes, price, isActive } = req.body;

  const client = await db.getClient();
  try {
    const updatedService = await serviceCatalogService.modifyService(client, id, tenantId, {
      name,
      description,
      durationMinutes,
      price,
      isActive,
    });
    return successResponse(res, updatedService, 'Servicio actualizado correctamente');
  } catch (error) {
    console.error('Error en patchService:', error);
    if (error.message === 'Servicio no encontrado') {
      return errorResponse(res, error.message, [], 404);
    }
    if (
      error.message.includes('vacío') ||
      error.message.includes('mayor') ||
      error.message.includes('número')
    ) {
      return errorResponse(res, error.message, [], 400);
    }
    return errorResponse(res, 'Error al actualizar servicio', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getServices,
  getServiceStats,
  getServiceById,
  createService,
  patchService,
};
