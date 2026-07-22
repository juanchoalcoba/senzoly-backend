const db = require('../../config/db');
const customerService = require('../services/customerService');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getCustomers = async (req, res) => {
  const { tenantId } = req.user;
  const { search } = req.query;

  const client = await db.getClient();
  try {
    const customers = await customerService.listCustomers(client, tenantId, search);
    return successResponse(res, customers, 'Clientes obtenidos correctamente');
  } catch (error) {
    console.error('Error en getCustomers:', error);
    return errorResponse(res, 'Error al obtener clientes', [], 500);
  } finally {
    client.release();
  }
};

const getCustomerById = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const client = await db.getClient();
  try {
    const customer = await customerService.getCustomerDetails(client, tenantId, id);
    return successResponse(res, customer, 'Detalle de cliente obtenido correctamente');
  } catch (error) {
    console.error('Error en getCustomerById:', error);
    if (error.message === 'Cliente no encontrado') {
      return errorResponse(res, error.message, [], 404);
    }
    return errorResponse(res, 'Error al obtener cliente', [], 500);
  } finally {
    client.release();
  }
};

const patchCustomer = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { firstName, lastName, email, phone, notes } = req.body;

  const client = await db.getClient();
  try {
    const updatedCustomer = await customerService.modifyCustomer(client, id, tenantId, {
      firstName,
      lastName,
      email,
      phone,
      notes,
    });
    return successResponse(res, updatedCustomer, 'Cliente actualizado correctamente');
  } catch (error) {
    console.error('Error en patchCustomer:', error);
    if (error.message === 'Cliente no encontrado') {
      return errorResponse(res, error.message, [], 404);
    }
    return errorResponse(res, 'Error al actualizar cliente', [], 500);
  } finally {
    client.release();
  }
};

const getCustomerStats = async (req, res) => {
  const { tenantId } = req.user;

  const client = await db.getClient();
  try {
    const stats = await customerService.getCustomerOverview(client, tenantId);
    return successResponse(res, stats, 'Estadísticas de clientes obtenidas correctamente');
  } catch (error) {
    console.error('Error en getCustomerStats:', error);
    return errorResponse(res, 'Error al obtener estadísticas de clientes', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  patchCustomer,
  getCustomerStats,
};
