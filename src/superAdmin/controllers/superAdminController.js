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

const getSubscriptionsOverview = async (req, res) => {
  const client = await db.getClient();
  try {
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN s.status IN ('ACTIVE', 'active') THEN p.price ELSE 0 END), 0) AS mrr,
        COALESCE((
          SELECT SUM(sp.transaction_amount) 
          FROM subscription_payments sp 
          WHERE sp.status = 'approved' AND (sp.date_approved >= DATE_TRUNC('month', CURRENT_DATE) OR sp.created_at >= DATE_TRUNC('month', CURRENT_DATE))
        ), 0) AS total_collected_month,
        (SELECT COUNT(*)::integer FROM tenants WHERE deleted_at IS NULL AND status = 'active') AS active_count,
        (SELECT COUNT(*)::integer FROM tenants WHERE deleted_at IS NULL AND status = 'trial') AS trial_count,
        (SELECT COUNT(*)::integer FROM tenants WHERE deleted_at IS NULL AND status = 'suspended') AS suspended_count
      FROM tenants t
      LEFT JOIN subscriptions s ON t.id = s.tenant_id
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE t.deleted_at IS NULL;
    `;

    const subscriptionsListQuery = `
      SELECT 
        t.id AS tenant_id,
        t.name AS tenant_name,
        t.slug AS tenant_slug,
        t.status AS tenant_status,
        s.status AS subscription_status,
        s.starts_at,
        s.expires_at,
        s.next_billing_date,
        p.name AS plan_name,
        p.price AS plan_price,
        (
          SELECT MAX(sp.date_approved) 
          FROM subscription_payments sp 
          WHERE sp.tenant_id = t.id AND sp.status = 'approved'
        ) AS last_payment_date,
        COALESCE((
          SELECT SUM(sp.transaction_amount)
          FROM subscription_payments sp 
          WHERE sp.tenant_id = t.id AND sp.status = 'approved'
        ), 0) AS total_paid
      FROM tenants t
      LEFT JOIN subscriptions s ON t.id = s.tenant_id
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE t.deleted_at IS NULL
      ORDER BY t.created_at DESC;
    `;

    const paymentsHistoryQuery = `
      SELECT 
        sp.id,
        sp.payment_id,
        sp.tenant_id,
        t.name AS tenant_name,
        p.name AS plan_name,
        sp.transaction_amount,
        sp.payment_method,
        sp.status,
        sp.status_detail,
        sp.date_approved,
        sp.created_at
      FROM subscription_payments sp
      JOIN tenants t ON sp.tenant_id = t.id
      JOIN plans p ON sp.plan_id = p.id
      ORDER BY sp.created_at DESC
      LIMIT 50;
    `;

    const [summaryRes, subListRes, paymentsRes] = await Promise.all([
      client.query(summaryQuery),
      client.query(subscriptionsListQuery),
      client.query(paymentsHistoryQuery),
    ]);

    const summary = summaryRes.rows[0];

    return successResponse(res, {
      summary: {
        mrr: parseFloat(summary.mrr || 0),
        totalCollectedMonth: parseFloat(summary.total_collected_month || 0),
        activeCount: summary.active_count || 0,
        trialCount: summary.trial_count || 0,
        suspendedCount: summary.suspended_count || 0,
      },
      subscriptions: subListRes.rows,
      payments: paymentsRes.rows,
    }, 'Resumen de suscripciones obtenido correctamente');
  } catch (error) {
    console.error('Error al obtener suscripciones de SuperAdmin:', error);
    return errorResponse(res, 'Error al obtener datos de suscripciones', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getDashboardStats,
  getTenantsList,
  getTenantDetails,
  suspendTenant,
  reactivateTenant,
  deleteTenant,
  getSubscriptionsOverview,
  getPlansOverview,
};

async function getPlansOverview(req, res) {
  const client = await db.getClient();
  try {
    const plansQuery = `
      SELECT 
        p.id, p.name, p.slug, p.price, p.billing_period,
        p.max_users, p.max_locations, p.max_resources, p.max_bookings,
        p.is_active, p.created_at,
        COUNT(s.id)::integer AS subscriptions_count,
        COUNT(CASE WHEN t.status = 'active' THEN 1 END)::integer AS active_tenants,
        COUNT(CASE WHEN t.status = 'trial' THEN 1 END)::integer AS trial_tenants
      FROM plans p
      LEFT JOIN subscriptions s ON s.plan_id = p.id
      LEFT JOIN tenants t ON s.tenant_id = t.id AND t.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY p.price ASC;
    `;
    const result = await client.query(plansQuery);
    return successResponse(res, result.rows, 'Planes obtenidos correctamente');
  } catch (error) {
    console.error('Error al obtener planes:', error);
    return errorResponse(res, 'Error al obtener planes', [], 500);
  } finally {
    client.release();
  }
}


