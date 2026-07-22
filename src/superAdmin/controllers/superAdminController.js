const db = require('../../config/db');
const { successResponse, errorResponse } = require('../../utils/responseUtils');

const getDashboardStats = async (req, res) => {
  const client = await db.getClient();
  try {
    // Estas consultas son un ejemplo básico, se irán ampliando a medida que crezca el panel
    const tenantsCount = await client.query('SELECT COUNT(*) as total FROM tenants');
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
    const query = `
      SELECT 
        t.id, t.name, t.slug, t.country, t.created_at,
        u.email as admin_email,
        u.first_name || ' ' || u.last_name as admin_name,
        s.status as subscription_status,
        p.name as plan_name
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'OWNER'
      LEFT JOIN subscriptions s ON s.tenant_id = t.id
      LEFT JOIN plans p ON s.plan_id = p.id
      ORDER BY t.created_at DESC
    `;
    const result = await client.query(query);

    return successResponse(res, result.rows, 'Lista de empresas obtenida');
  } catch (error) {
    console.error('Error obteniendo lista de tenants:', error);
    return errorResponse(res, 'Error interno', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getDashboardStats,
  getTenantsList,
};
