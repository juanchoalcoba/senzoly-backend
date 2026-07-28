require('dotenv').config();
const db = require('./src/config/db');

async function updateTenantStatusDb() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'trial',
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tenants_status
      ON tenants (status);
    `);
    await client.query('COMMIT');
    console.log('Estado operativo de tenants preparado correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al preparar el estado de tenants:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updateTenantStatusDb();
