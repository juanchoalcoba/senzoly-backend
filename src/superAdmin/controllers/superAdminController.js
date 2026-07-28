const db = require('../../config/db');
const { successResponse, errorResponse } = require('../../utils/responseUtils');
const tenantAdminService = require('../../tenant/services/tenantAdminService');

const getDashboardStats = async (req, res) => {
  const client = await db.getClient();
  try {
    // Estas consultas son un ejemplo básico, se irán ampliando a medida que crezca el panel
    const tenantsCount = await client.query('SELECT COUNT(*) as total FROM tenants WHERE deleted_at IS NULL');
    const usersCount = await client.query('SELECT COUNT(*) as total FROM users');
    
    // Suponiendo que hay suscripciones activas
    const activeSubsCount = await client.query("SELECT COUNT(*) as total FROM subscriptions WHERE status = 'ACTIVE'");

    const stats = {
      totalTenants: parseInt(tenantsCount.rows[0].total, 10),
      totalUsers: parseInt(usersCount.rows[0].total, 10),
      activeSubscriptions: parseInt(activeSubsCount.rows[0].total, 10),
      mrr: 0, // Placeholder
      totalBookings: 0, // Placeholder
    };

    return successResponse(res, stats, 'Estadísticas del panel obtenidas');
  } catch (error) {
    console.error('Error obteniendo stats:', error);
    return errorResponse(res, 'Error interno', [], 500);
  } finally {
    client.release();
  }
};

const getTenantsList = async (req, res) => {
  const client = await db.getClient();
  try {
    const tenants = await tenantAdminService.listTenants(client);
    return successResponse(res, tenants, 'Lista de empresas obtenida');
  } catch (error) {
    console.error('Error obteniendo lista de tenants:', error);
    return errorResponse(res, 'Error interno', [], 500);
  } finally {
    client.release();
  }
};

const getTenantDetails = async (req, res) => {
  const client = await db.getClient();
  try {
    const tenant = await tenantAdminService.getTenantDetails(client, req.params.id);
    return successResponse(res, tenant, 'Empresa obtenida correctamente');
  } catch (error) {
    if (error.message === 'Empresa no encontrada') {
      return errorResponse(res, error.message, [], 404);
    }
    console.error('Error obteniendo empresa:', error);
    return errorResponse(res, 'Error interno', [], 500);
  } finally {
    client.release();
  }
};

const updateTenant = (serviceMethod, successMessage) => async (req, res) => {
  const client = await db.getClient();
  try {
    const tenant = await serviceMethod(client, req.params.id);
    return successResponse(res, tenant, successMessage);
  } catch (error) {
    if (error.message.includes('Empresa no encontrada') || error.message.includes('empresa eliminada')) {
      return errorResponse(res, error.message, [], 400);
    }
    console.error('Error actualizando empresa:', error);
    return errorResponse(res, 'Error interno', [], 500);
  } finally {
    client.release();
  }
};

const suspendTenant = updateTenant(tenantAdminService.suspendTenant, 'Empresa suspendida correctamente');
const reactivateTenant = updateTenant(tenantAdminService.reactivateTenant, 'Empresa reactivada correctamente');
const deleteTenant = updateTenant(tenantAdminService.softDeleteTenant, 'Empresa eliminada correctamente');

module.exports = {
  getDashboardStats,
  getTenantsList,
  getTenantDetails,
  suspendTenant,
  reactivateTenant,
  deleteTenant,
};
