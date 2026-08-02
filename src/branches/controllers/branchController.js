const db = require('../../config/db');
const {
  listBranches,
  addBranch,
  modifyBranch,
  replaceBranchImage,
  removeBranchImage,
  removeBranch,
} = require('../services/branchService');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getBranches = async (req, res) => {
  const { tenantId } = req.user;
  const client = await db.getClient();
  try {
    const branches = await listBranches(client, tenantId);
    return successResponse(res, branches, 'Sucursales obtenidas correctamente');
  } catch (error) {
    console.error('Error en getBranches:', error);
    return errorResponse(res, 'Error al obtener sucursales', [], 500);
  } finally {
    client.release();
  }
};

const createNewBranch = async (req, res) => {
  const { tenantId } = req.user;
  const { name, address, phone, isActive, employeeIds, serviceIds } = req.body;

  const client = await db.getClient();
  try {
    const branch = await addBranch(client, tenantId, { name, address, phone, isActive, employeeIds, serviceIds });
    return successResponse(res, branch, 'Sucursal creada correctamente', 201);
  } catch (error) {
    console.error('Error en createNewBranch:', error);
    if (error.message.includes('Límite de sucursales alcanzado')) {
      return errorResponse(res, error.message, [], 403);
    }
    return errorResponse(res, error.message || 'Error al crear sucursal', [], 400);
  } finally {
    client.release();
  }
};

const updateExistingBranch = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const updates = req.body;

  const client = await db.getClient();
  try {
    const branch = await modifyBranch(client, id, tenantId, updates);
    return successResponse(res, branch, 'Sucursal actualizada correctamente');
  } catch (error) {
    console.error('Error en updateExistingBranch:', error);
    if (error.message === 'Sucursal no encontrada') {
      return errorResponse(res, error.message, [], 404);
    }
    return errorResponse(res, error.message || 'Error al actualizar sucursal', [], 400);
  } finally {
    client.release();
  }
};

const uploadImage = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const client = await db.getClient();
  try {
    const branch = await replaceBranchImage(client, id, tenantId, req.file);
    return successResponse(res, branch, 'Foto de la sucursal actualizada correctamente');
  } catch (error) {
    console.error('Error en uploadImage:', error);
    return errorResponse(res, error.message || 'Error al subir foto de la sucursal', [], 500);
  } finally {
    client.release();
  }
};

const deleteImage = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const client = await db.getClient();
  try {
    const branch = await removeBranchImage(client, id, tenantId);
    return successResponse(res, branch, 'Foto de la sucursal eliminada correctamente');
  } catch (error) {
    console.error('Error en deleteImage:', error);
    return errorResponse(res, error.message || 'Error al eliminar foto de la sucursal', [], 500);
  } finally {
    client.release();
  }
};

const deleteBranchController = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const client = await db.getClient();
  try {
    await removeBranch(client, id, tenantId);
    return successResponse(res, null, 'Sucursal eliminada correctamente');
  } catch (error) {
    console.error('Error en deleteBranchController:', error);
    if (error.message.includes('No se puede eliminar la sucursal principal')) {
      return errorResponse(res, error.message, [], 403);
    }
    return errorResponse(res, error.message || 'Error al eliminar sucursal', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getBranches,
  createNewBranch,
  updateExistingBranch,
  uploadImage,
  deleteImage,
  deleteBranchController,
};
