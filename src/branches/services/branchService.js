const {
  getBranchesByTenant,
  getBranchById,
  createBranch,
  updateBranch,
  updateBranchImage,
  deleteBranch: deleteBranchRepo,
  setBranchEmployees,
  setBranchServices,
  countBranchesByTenant,
} = require('../repositories/branchRepository');
const { getSubscriptionLimits } = require('../../subscriptions/repositories/subscriptionRepository');
const tenantRepo = require('../../tenant/repositories/tenantRepository');
const cloudinaryService = require('../../services/cloudinaryService');

const listBranches = async (client, tenantId) => {
  return await getBranchesByTenant(client, tenantId);
};

const addBranch = async (client, tenantId, branchData) => {
  const { name, address, phone, isActive, employeeIds, serviceIds } = branchData;

  if (!name || !name.trim()) {
    throw new Error('El nombre de la sucursal es obligatorio');
  }

  // Check subscription limits for max_locations
  const limits = await getSubscriptionLimits(client, tenantId);
  if (limits && limits.max_locations !== -1) {
    const currentCount = await countBranchesByTenant(client, tenantId);
    if (currentCount >= limits.max_locations) {
      throw new Error('Límite de sucursales alcanzado para tu plan actual. Actualiza a PRO+ para agregar más sucursales.');
    }
  }

  const branch = await createBranch(client, tenantId, { name, address, phone, isActive });

  if (Array.isArray(employeeIds)) {
    await setBranchEmployees(client, branch.id, employeeIds);
  }
  if (Array.isArray(serviceIds)) {
    await setBranchServices(client, branch.id, serviceIds);
  }

  return await getBranchById(client, branch.id, tenantId);
};

const modifyBranch = async (client, branchId, tenantId, updates) => {
  const existing = await getBranchById(client, branchId, tenantId);
  if (!existing) throw new Error('Sucursal no encontrada');

  const updatedBranch = await updateBranch(client, branchId, tenantId, updates);

  if (Array.isArray(updates.employeeIds)) {
    await setBranchEmployees(client, branchId, updates.employeeIds);
  }
  if (Array.isArray(updates.serviceIds)) {
    await setBranchServices(client, branchId, updates.serviceIds);
  }

  return await getBranchById(client, branchId, tenantId);
};

const replaceBranchImage = async (client, branchId, tenantId, file) => {
  const existing = await getBranchById(client, branchId, tenantId);
  if (!existing) throw new Error('Sucursal no encontrada');

  const tenant = await tenantRepo.findTenantSlugById(client, tenantId);
  if (!tenant) throw new Error('Empresa no encontrada');

  const uploaded = await cloudinaryService.uploadBranchImage({
    buffer: file.buffer,
    tenantSlug: tenant.slug,
    branchId,
  });

  let updated;
  try {
    updated = await updateBranchImage(client, branchId, tenantId, uploaded.imageUrl, uploaded.imagePublicId);
  } catch (error) {
    try {
      await cloudinaryService.destroyImage(uploaded.imagePublicId);
    } catch (cleanupErr) {
      console.error('Error al limpiar foto de sucursal:', cleanupErr);
    }
    throw error;
  }

  if (existing.image_public_id) {
    try {
      await cloudinaryService.destroyImage(existing.image_public_id);
    } catch (err) {
      console.error(`Error al eliminar foto anterior de sucursal ${branchId}:`, err);
    }
  }

  return updated;
};

const removeBranchImage = async (client, branchId, tenantId) => {
  const existing = await getBranchById(client, branchId, tenantId);
  if (!existing) throw new Error('Sucursal no encontrada');
  if (!existing.image_url && !existing.image_public_id) return existing;

  const updated = await updateBranchImage(client, branchId, tenantId, null, null);

  if (existing.image_public_id) {
    try {
      await cloudinaryService.destroyImage(existing.image_public_id);
    } catch (err) {
      console.error(`Error al eliminar foto de sucursal ${branchId}:`, err);
    }
  }

  return updated;
};

const removeBranch = async (client, branchId, tenantId) => {
  const existing = await getBranchById(client, branchId, tenantId);
  if (!existing) throw new Error('Sucursal no encontrada');
  if (existing.is_main) throw new Error('No se puede eliminar la sucursal principal del negocio');

  return await deleteBranchRepo(client, branchId, tenantId);
};

module.exports = {
  listBranches,
  addBranch,
  modifyBranch,
  replaceBranchImage,
  removeBranchImage,
  removeBranch,
};
