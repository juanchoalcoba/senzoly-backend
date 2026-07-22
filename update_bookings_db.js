require('dotenv').config();
const db = require('./src/config/db');

async function updateBookingsDb() {
  const client = await db.getClient();
  try {
    console.log('Creating bookings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
          employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
          booking_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED',
          total_price NUMERIC(10, 2) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Bookings table created successfully.');
  } catch (error) {
    console.error('Error updating bookings db:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateBookingsDb();
