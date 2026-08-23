require('dotenv').config();
const db = require('../src/config/db');

async function fixBusinessHours() {
  const client = await db.getClient();
  try {
    console.log('Agregando columnas break_start y break_end a business_hours en DB local...');
    await client.query(`
      ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS break_start TIME DEFAULT NULL;
      ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS break_end TIME DEFAULT NULL;
    `);
    console.log('✅ Columnas agregadas exitosamente.');
  } catch (err) {
    console.error('Error al actualizar business_hours:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

fixBusinessHours();
