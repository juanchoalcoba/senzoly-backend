require('dotenv').config();
const db = require('./src/config/db');

async function updatePlanPrices() {
  const client = await db.getClient();
  try {
    console.log('Iniciando actualización de precios de planes...');
    await client.query('BEGIN');

    await client.query(`
      UPDATE plans SET price = 890.00, name = 'Individual', updated_at = CURRENT_TIMESTAMP WHERE slug = 'solo';
      UPDATE plans SET price = 1490.00, updated_at = CURRENT_TIMESTAMP WHERE slug = 'equipo';
      UPDATE plans SET price = 3200.00, updated_at = CURRENT_TIMESTAMP WHERE slug = 'pro-plus';
    `);

    await client.query('COMMIT');
    console.log('✅ Precios de planes actualizados exitosamente en la base de datos:');

    const res = await client.query('SELECT name, slug, price FROM plans ORDER BY price ASC;');
    console.table(res.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al actualizar precios de planes:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updatePlanPrices();
