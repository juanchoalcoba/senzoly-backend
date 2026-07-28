const db = require('../../config/db');
const { successResponse, errorResponse } = require('../../utils/responseUtils');
const tenantAdminService = require('../../tenant/services/tenantAdminService');

const getDashboardStats = async (req, res) => {
  const client = await db.getClient();
  try {
    const globalStatsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL) as total_tenants,
        (SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL AND status = 'trial') as trial_tenants,
        (SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL AND status = 'active') as active_tenants,
        (SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL AND status = 'suspended') as suspended_tenants,
        (SELECT COUNT(*) FROM users) as total_admins,
        (SELECT COUNT(*) FROM employees) as total_professionals,
        (SELECT COUNT(*) FROM customers) as total_customers,
        (SELECT COUNT(*) FROM bookings) as total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE DATE(created_at) = CURRENT_DATE) as bookings_created_today,
        (SELECT COUNT(*) FROM bookings WHERE booking_date = CURRENT_DATE) as bookings_happening_today
    `;

    const latestTenantsQuery = `
      SELECT t.id, t.name, t.slug, t.status, t.created_at, b.name as business_type
      FROM tenants t
      LEFT JOIN business_types b ON t.business_type_id = b.id
      WHERE t.deleted_at IS NULL
      ORDER BY t.created_at DESC
      LIMIT 5
    `;

    const suspendedTenantsQuery = `
      SELECT t.id, t.name, t.slug, t.status, t.created_at, b.name as business_type
      FROM tenants t
      LEFT JOIN business_types b ON t.business_type_id = b.id
      WHERE t.deleted_at IS NULL AND t.status = 'suspended'
      ORDER BY t.updated_at DESC
      LIMIT 5
    `;

    const [globalStatsResult, latestTenantsResult, suspendedTenantsResult] = await Promise.all([
      client.query(globalStatsQuery),
      client.query(latestTenantsQuery),
      client.query(suspendedTenantsQuery)
    ]);

    const globalStats = globalStatsResult.rows[0];

    const stats = {
      platformState: {
        tenants: {
          total: parseInt(globalStats.total_tenants, 10),
          active: parseInt(globalStats.active_tenants, 10),
          trial: parseInt(globalStats.trial_tenants, 10),
          suspended: parseInt(globalStats.suspended_tenants, 10)
        },
        users: {
          admins: parseInt(globalStats.total_admins, 10),
          professionals: parseInt(globalStats.total_professionals, 10),
          customers: parseInt(globalStats.total_customers, 10)
        }
      },
      platformUsage: {
        bookings: {
          total: parseInt(globalStats.total_bookings, 10),
          createdToday: parseInt(globalStats.bookings_created_today, 10),
          happeningToday: parseInt(globalStats.bookings_happening_today, 10)
        }
      },
      recentActivity: {
        latestTenants: latestTenantsResult.rows,
        suspendedTenants: suspendedTenantsResult.rows
      },
      financials: {
        mrr: 0, // Preparado para futura integración con Mercado Pago
        activeSubscriptions: 0
      }
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
