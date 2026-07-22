require('dotenv').config();
const db = require('./src/config/db');

async function updateServicesDb() {
  const client = await db.getClient();
  try {
    console.log('Creating services table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          name VARCHAR(150) NOT NULL,
          description TEXT,
          duration_minutes INTEGER NOT NULL,
          price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Services table created successfully.');
  } catch (error) {
    console.error('Error updating services db:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateServicesDb();
