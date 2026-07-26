const db = require('../../config/db');
const settingsService = require('../services/settingsService');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getProfile = async (req, res) => {
  const { tenantId } = req.user;
  const client = await db.getClient();
  try {
    const profile = await settingsService.getProfile(client, tenantId);
    return successResponse(res, profile, 'Perfil comercial obtenido correctamente');
  } catch (error) {
    console.error('Error en getProfile:', error);
    return errorResponse(res, 'Error al obtener el perfil comercial', [], 500);
  } finally {
    client.release();
  }
};

const patchProfile = async (req, res) => {
  const { tenantId } = req.user;
  const { name, phone, address, description } = req.body;

  const client = await db.getClient();
  try {
    const updatedProfile = await settingsService.updateProfile(client, tenantId, {
      name,
      phone,
      address,
      description,
    });
    return successResponse(res, updatedProfile, 'Perfil comercial actualizado correctamente');
  } catch (error) {
    console.error('Error en patchProfile:', error);
    if (error.message.includes('vacío')) {
      return errorResponse(res, error.message, [], 400);
    }
    return errorResponse(res, 'Error al actualizar el perfil comercial', [], 500);
  } finally {
    client.release();
  }
};

const getHours = async (req, res) => {
  const { tenantId } = req.user;
  const client = await db.getClient();
  try {
    const hours = await settingsService.getHours(client, tenantId);
    return successResponse(res, hours, 'Horarios de atención obtenidos correctamente');
  } catch (error) {
    console.error('Error en getHours:', error);
    return errorResponse(res, 'Error al obtener los horarios de atención', [], 500);
  } finally {
    client.release();
  }
};

const patchHours = async (req, res) => {
  const { tenantId } = req.user;
  const { hours } = req.body; // Expects an array of day objects

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const updatedHours = await settingsService.updateHours(client, tenantId, hours);
    await client.query('COMMIT');
    return successResponse(res, updatedHours, 'Horarios de atención actualizados correctamente');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en patchHours:', error);
    if (
      error.message.includes('válida') ||
      error.message.includes('anterior') ||
      error.message.includes('especificar') ||
      error.message.includes('válido')
    ) {
      return errorResponse(res, error.message, [], 400);
    }
    return errorResponse(res, 'Error al actualizar los horarios de atención', [], 500);
  } finally {
    client.release();
  }
};

const getBookingRules = async (req, res) => {
  const client = await db.getClient();
  try {
    const rules = await settingsService.getBookingRules(client, req.user.tenantId);
    return successResponse(res, rules, 'Reglas de agenda obtenidas correctamente');
  } catch (error) {
    console.error('Error en getBookingRules:', error);
    return errorResponse(res, 'Error al obtener las reglas de agenda', [], 500);
  } finally {
    client.release();
  }
};

const patchBookingRules = async (req, res) => {
  const client = await db.getClient();
  try {
    const rules = await settingsService.updateBookingRules(client, req.user.tenantId, req.body);
    return successResponse(res, rules, 'Reglas de agenda actualizadas correctamente');
  } catch (error) {
    console.error('Error en patchBookingRules:', error);
    if (error.message.includes('intervalo') || error.message.includes('alineación')) {
      return errorResponse(res, error.message, [], 400);
    }
    return errorResponse(res, 'Error al actualizar las reglas de agenda', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getProfile,
  patchProfile,
  getHours,
  patchHours,
  getBookingRules,
  patchBookingRules,
};
