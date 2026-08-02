require('dotenv').config();
const db = require('./src/config/db');

async function updateEmployeeAvatarDb() {
  const client = await db.getClient();
  try {
    console.log('Agregando columnas de avatar a la tabla employees...');
    await client.query(`
      ALTER TABLE employees 
        ADD COLUMN IF NOT EXISTS avatar_url TEXT,
        ADD COLUMN IF NOT EXISTS avatar_public_id TEXT;
    `);
    console.log('✅ Columnas avatar_url y avatar_public_id agregadas correctamente.');
  } catch (error) {
    console.error('Error al actualizar la tabla employees:', error);
  } finally {
    client.release();
    process.exit();
  }
}

updateEmployeeAvatarDb();
