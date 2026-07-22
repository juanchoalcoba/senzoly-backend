require('dotenv').config();
const db = require('./src/config/db');

async function updateSettingsDb() {
  const client = await db.getClient();
  try {
    console.log('Extending tenants table...');
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS description TEXT;
    `);

    console.log('Creating business_hours table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS business_hours (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          day_of_week SMALLINT NOT NULL, -- 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
          open_time TIME DEFAULT '09:00:00',
          close_time TIME DEFAULT '19:00:00',
          is_closed BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_tenant_day UNIQUE (tenant_id, day_of_week)
      );
    `);

    console.log('Settings database updates processed successfully.');
  } catch (error) {
    console.error('Error updating settings db:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateSettingsDb();
