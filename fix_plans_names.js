require('dotenv').config();
const db = require('./src/config/db');

async function fixPlans() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Desactivar y ocultar el Plan Profesional que fue creado por error en la migración de billing
    const deactivate = await client.query(`
      UPDATE plans
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE slug = 'profesional'
      RETURNING id, name, slug, is_active;
    `);
    if (deactivate.rows.length > 0) {
      console.log('✅ Plan Profesional desactivado:', deactivate.rows[0]);
    } else {
      console.log('ℹ️  Plan Profesional no encontrado (ya puede haber sido eliminado).');
    }

    // 2. Renombrar plan "Solo" → "Individual" visualmente en la DB
    const rename = await client.query(`
      UPDATE plans
      SET name = 'Individual', updated_at = CURRENT_TIMESTAMP
      WHERE slug = 'solo'
      RETURNING id, name, slug;
    `);
    if (rename.rows.length > 0) {
      console.log('✅ Plan renombrado a Individual:', rename.rows[0]);
    } else {
      console.log('ℹ️  Plan con slug "solo" no encontrado.');
    }

    await client.query('COMMIT');
    console.log('\n✅ Correcciones de planes aplicadas exitosamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al corregir planes:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

fixPlans();
