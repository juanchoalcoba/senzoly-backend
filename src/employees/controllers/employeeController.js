const db = require('../../config/db');
const { getEmployeesByTenant, deleteEmployee } = require('../repositories/employeeRepository');
const { addEmployee, modifyEmployee, EmployeeValidationError } = require('../services/employeeService');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getEmployees = async (req, res) => {
  const { tenantId } = req.user;
  const client = await db.getClient();
  try {
    const employees = await getEmployeesByTenant(client, tenantId);
    return successResponse(res, employees, 'Empleados obtenidos correctamente');
  } catch (error) {
    console.error('Error en getEmployees:', error);
    return errorResponse(res, 'Error al obtener empleados', [], 500);
  } finally {
    client.release();
  }
};

const createNewEmployee = async (req, res) => {
  const { tenantId } = req.user;
  const { firstName, lastName, email, phone, active, commissionType, commissionValue } = req.body;

  if (!firstName || !lastName) {
    return errorResponse(res, 'Nombre y apellido son obligatorios', [], 400);
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const employee = await addEmployee(client, tenantId, {
      firstName,
      lastName,
      email,
      phone,
      active,
      commissionType,
      commissionValue,
    });
    await client.query('COMMIT');
    return successResponse(res, employee, 'Empleado creado correctamente', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en createNewEmployee:', error);
    
    if (error.message.includes('Límite de empleados alcanzado')) {
      return errorResponse(res, error.message, [], 403);
    }
    
    if (error instanceof EmployeeValidationError) {
      return errorResponse(res, error.message, [], 400);
    }

    return errorResponse(res, 'Error al crear empleado', [], 500);
  } finally {
    client.release();
  }
};

const updateExistingEmployee = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const updates = req.body;

  const client = await db.getClient();
  try {
    const employee = await modifyEmployee(client, id, tenantId, updates);
    return successResponse(res, employee, 'Empleado actualizado correctamente');
  } catch (error) {
    console.error('Error en updateExistingEmployee:', error);
    if (error.message === 'Empleado no encontrado') {
      return errorResponse(res, error.message, [], 404);
    }
    if (error instanceof EmployeeValidationError) {
      return errorResponse(res, error.message, [], 400);
    }
    return errorResponse(res, 'Error al actualizar empleado', [], 500);
  } finally {
    client.release();
  }
};

const removeEmployee = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const client = await db.getClient();
  try {
    const deleted = await deleteEmployee(client, id, tenantId);
    if (!deleted) {
      return errorResponse(res, 'Empleado no encontrado', [], 404);
    }
    return successResponse(res, null, 'Empleado eliminado correctamente');
  } catch (error) {
    console.error('Error en removeEmployee:', error);
    return errorResponse(res, 'Error al eliminar empleado', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getEmployees,
  createNewEmployee,
  updateExistingEmployee,
  removeEmployee
};
