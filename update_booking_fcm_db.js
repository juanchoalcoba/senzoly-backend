require('dotenv').config();
const db = require('./src/config/db');

async function updateBookingFcmDb() {
  const client = await db.getClient();
  try {
    console.log('Extending bookings table with management token & reminder fields...');
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS manage_token_hash VARCHAR(64);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP NULL;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NULL;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_5h_sent BOOLEAN DEFAULT false;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT false;
    `);

    // Create unique index on manage_token_hash if not exists
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_manage_token_hash
      ON bookings (manage_token_hash)
      WHERE manage_token_hash IS NOT NULL;
    `);

    console.log('Creating fcm_tokens table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
          id UUID PRIMARY KEY,
          tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
          booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
          token TEXT UNIQUE NOT NULL,
          device_type VARCHAR(50) DEFAULT 'web',
          last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_fcm_tokens_tenant ON fcm_tokens(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_fcm_tokens_booking ON fcm_tokens(booking_id);
    `);

    console.log('FCM and Booking Management DB migration processed successfully.');
  } catch (error) {
    console.error('Error updating DB for FCM & Booking Management:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateBookingFcmDb();
