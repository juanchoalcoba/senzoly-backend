const {
  createEmployee,
  copyBusinessHoursToEmployee,
  getEmployeeById,
  updateEmployee,
  updateEmployeeAvatar: updateEmployeeAvatarRepo,
  replaceEmployeeServices,
  countEmployeesByTenant,
} = require('../repositories/employeeRepository');
const { getSubscriptionLimits } = require('../../subscriptions/repositories/subscriptionRepository');
const tenantRepo = require('../../tenant/repositories/tenantRepository');
const cloudinaryService = require('../../services/cloudinaryService');

class EmployeeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmployeeValidationError';
  }
}

const validateEmployeeData = (employeeData) => {
  const { firstName, lastName, active, isActive, commissionType, commissionValue, serviceIds } = employeeData;

  if (firstName !== undefined && (typeof firstName !== 'string' || !firstName.trim())) {
    throw new EmployeeValidationError('El nombre es obligatorio');
  }

  if (lastName !== undefined && (typeof lastName !== 'string' || !lastName.trim())) {
    throw new EmployeeValidationError('El apellido es obligatorio');
  }

  if (active !== undefined && typeof active !== 'boolean') {
    throw new EmployeeValidationError('El estado del empleado debe ser booleano');
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw new EmployeeValidationError('El estado del empleado debe ser booleano');
  }

  if (commissionType !== undefined && commissionType !== null && !['percentage', 'fixed'].includes(commissionType)) {
    throw new EmployeeValidationError('El tipo de comisión debe ser percentage o fixed');
  }

  if (commissionValue !== undefined && commissionValue !== null) {
    const numericCommissionValue = Number(commissionValue);
    if (
      (typeof commissionValue === 'string' && !commissionValue.trim())
      || !Number.isFinite(numericCommissionValue)
      || numericCommissionValue < 0
    ) {
      throw new EmployeeValidationError('El valor de comisión debe ser un número mayor o igual a cero');
    }
    if (commissionType === 'percentage' && numericCommissionValue > 100) {
      throw new EmployeeValidationError('El valor de comisión porcentual no puede ser mayor a 100');
    }
    employeeData.commissionValue = numericCommissionValue;
  }

  if (serviceIds !== undefined && !Array.isArray(serviceIds)) {
    throw new EmployeeValidationError('Los servicios asignados deben ser una lista');
  }
};

const addEmployee = async (client, tenantId, employeeData) => {
  validateEmployeeData(employeeData);

  // Check subscription limits
  const limits = await getSubscriptionLimits(client, tenantId);
  
  if (limits && limits.max_users !== -1) {
    const currentCount = await countEmployeesByTenant(client, tenantId);
    if ((currentCount + 1) >= limits.max_users) {
      throw new Error('Límite de empleados alcanzado para tu plan actual');
    }
  }

  const { firstName, lastName, email, phone, active, commissionType, commissionValue, serviceIds = [] } = employeeData;
  const employee = await createEmployee(
    client,
    tenantId,
    firstName,
    lastName,
    email,
    phone,
    active,
    commissionType,
    commissionValue
  );
  await copyBusinessHoursToEmployee(client, employee.id, tenantId);
  await replaceEmployeeServices(client, employee.id, tenantId, serviceIds);
  return employee;
};

const modifyEmployee = async (client, id, tenantId, updates) => {
  const existingEmployee = await getEmployeeById(client, id, tenantId);
  if (!existingEmployee) {
    throw new Error('Empleado no encontrado');
  }

  const validationData = {
    firstName: updates.firstName ?? existingEmployee.first_name,
    lastName: updates.lastName ?? existingEmployee.last_name,
    active: updates.active ?? updates.isActive ?? existingEmployee.is_active,
    commissionType: updates.commissionType ?? existingEmployee.commission_type,
    commissionValue: updates.commissionValue ?? existingEmployee.commission_value,
    serviceIds: updates.serviceIds,
  };

  validateEmployeeData(validationData);

  if (updates.commissionValue !== undefined && updates.commissionValue !== null) {
    updates.commissionValue = validationData.commissionValue;
  }

  const employee = await updateEmployee(client, id, tenantId, updates);
  if (updates.serviceIds !== undefined) {
    await replaceEmployeeServices(client, id, tenantId, updates.serviceIds);
  }
  return employee;
};

const replaceEmployeeAvatar = async (client, employeeId, tenantId, file) => {
  const existing = await getEmployeeById(client, employeeId, tenantId);
  if (!existing) throw new Error('Empleado no encontrado');

  const tenant = await tenantRepo.findTenantSlugById(client, tenantId);
  if (!tenant) throw new Error('Empresa no encontrada');

  const uploadedImage = await cloudinaryService.uploadEmployeeAvatar({
    buffer: file.buffer,
    tenantSlug: tenant.slug,
    employeeId,
  });

  let updatedEmployee;
  try {
    updatedEmployee = await updateEmployeeAvatarRepo(
      client,
      employeeId,
      tenantId,
      uploadedImage.imageUrl,
      uploadedImage.imagePublicId
    );
  } catch (error) {
    try {
      await cloudinaryService.destroyImage(uploadedImage.imagePublicId);
    } catch (cleanupError) {
      console.error('No se pudo limpiar la foto recién subida:', cleanupError);
    }
    throw error;
  }

  if (existing.avatar_public_id) {
    try {
      await cloudinaryService.destroyImage(existing.avatar_public_id);
    } catch (error) {
      console.error(`No se pudo eliminar la foto anterior del empleado ${employeeId}:`, error);
    }
  }

  return updatedEmployee;
};

const removeEmployeeAvatar = async (client, employeeId, tenantId) => {
  const existing = await getEmployeeById(client, employeeId, tenantId);
  if (!existing) throw new Error('Empleado no encontrado');
  if (!existing.avatar_url && !existing.avatar_public_id) return existing;

  const updatedEmployee = await updateEmployeeAvatarRepo(client, employeeId, tenantId, null, null);

  if (existing.avatar_public_id) {
    try {
      await cloudinaryService.destroyImage(existing.avatar_public_id);
    } catch (error) {
      console.error(`No se pudo eliminar la foto de Cloudinary del empleado ${employeeId}:`, error);
    }
  }

  return updatedEmployee;
};

module.exports = {
  addEmployee,
  modifyEmployee,
  replaceEmployeeAvatar,
  removeEmployeeAvatar,
  validateEmployeeData,
  EmployeeValidationError,
};
