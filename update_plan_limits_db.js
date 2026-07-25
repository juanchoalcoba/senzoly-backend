require('dotenv').config();
const db = require('./src/config/db');

const PLAN_USER_LIMITS = {
  prueba: 8,
  equipo: 8,
};

async function updatePlanLimits() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE plans
        SET max_users = CASE slug
          WHEN 'prueba' THEN $1::integer
          WHEN 'equipo' THEN $2::integer
        END,
        updated_at = CURRENT_TIMESTAMP
        WHERE slug IN ('prueba', 'equipo')
        RETURNING name, slug, max_users;
      `,
      [PLAN_USER_LIMITS.prueba, PLAN_USER_LIMITS.equipo]
    );

    await client.query('COMMIT');

    result.rows.forEach((plan) => {
      console.log(`${plan.name}: hasta ${plan.max_users - 1} empleados`);
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar los límites de empleados:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updatePlanLimits();
