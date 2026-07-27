const { createEmployee, countEmployeesByTenant } = require('../repositories/employeeRepository');
const { getSubscriptionLimits } = require('../../subscriptions/repositories/subscriptionRepository');

const validateEmployeeData = (employeeData) => {
  const { active, isActive, commissionType, commissionValue } = employeeData;

  if (active !== undefined && typeof active !== 'boolean') {
    throw new Error('El estado del empleado debe ser booleano');
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw new Error('El estado del empleado debe ser booleano');
  }

  if (commissionType !== undefined && commissionType !== null && !['percentage', 'fixed'].includes(commissionType)) {
    throw new Error('El tipo de comisión debe ser percentage o fixed');
  }

  if (commissionValue !== undefined && commissionValue !== null) {
    const numericCommissionValue = parseFloat(commissionValue);
    if (isNaN(numericCommissionValue) || numericCommissionValue < 0) {
      throw new Error('El valor de comisión debe ser un número mayor o igual a cero');
    }
    employeeData.commissionValue = numericCommissionValue;
  }
};

const addEmployee = async (client, tenantId, employeeData) => {
  validateEmployeeData(employeeData);

  // Check subscription limits
  const limits = await getSubscriptionLimits(client, tenantId);
  
  if (limits && limits.max_users !== -1) {
    const currentCount = await countEmployeesByTenant(client, tenantId);
    // Asumimos que limits.max_users incluye al dueño + empleados. Si no, solo comparamos con currentCount.
    // Para simplificar, asumiremos que currentCount (solo tabla employees) + 1 (el owner en users) <= max_users.
    if ((currentCount + 1) >= limits.max_users) {
      throw new Error('Límite de empleados alcanzado para tu plan actual');
    }
  }

  const { firstName, lastName, email, phone, active, commissionType, commissionValue } = employeeData;
  return await createEmployee(
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
};

module.exports = {
  addEmployee,
  validateEmployeeData,
};
