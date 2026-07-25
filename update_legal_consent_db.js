require('dotenv').config();
const db = require('./src/config/db');

async function updateLegalConsentDb() {
  const client = await db.getClient();

  try {
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) NULL;
    `);
    console.log('Registro de aceptación legal preparado correctamente.');
  } catch (error) {
    console.error('Error al preparar el registro de aceptación legal:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updateLegalConsentDb();
