require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('./src/config/db');

async function updateBookingSettingsDb() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_settings (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
        slot_interval_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (slot_interval_minutes IN (15, 30, 60)),
        slot_alignment VARCHAR(30) NOT NULL DEFAULT 'BUSINESS_OPEN' CHECK (slot_alignment IN ('BUSINESS_OPEN', 'CLOCK_HOUR')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const tenants = await client.query(`
      SELECT t.id, bt.slug AS business_type_slug
      FROM tenants t
      JOIN business_types bt ON bt.id = t.business_type_id
      LEFT JOIN booking_settings bs ON bs.tenant_id = t.id
      WHERE bs.tenant_id IS NULL;
    `);

    for (const tenant of tenants.rows) {
      const isSportsVenue = tenant.business_type_slug === 'canchas';
      await client.query(`
        INSERT INTO booking_settings (id, tenant_id, slot_interval_minutes, slot_alignment)
        VALUES ($1, $2, $3, $4);
      `, [
        uuidv4(),
        tenant.id,
        isSportsVenue ? 60 : 30,
        isSportsVenue ? 'CLOCK_HOUR' : 'BUSINESS_OPEN',
      ]);
    }

    await client.query('COMMIT');
    console.log(`Reglas de agenda preparadas para ${tenants.rowCount} empresa(s).`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al preparar las reglas de agenda:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updateBookingSettingsDb();
