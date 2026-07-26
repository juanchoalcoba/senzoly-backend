require('dotenv').config();
const db = require('./src/config/db');

async function updateServiceImagesDb() {
  const client = await db.getClient();
  try {
    await client.query(`
      ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE services ADD COLUMN IF NOT EXISTS image_public_id TEXT;
    `);
    console.log('Columnas de imágenes de servicios preparadas correctamente.');
  } catch (error) {
    console.error('Error al preparar las imágenes de servicios:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updateServiceImagesDb();
