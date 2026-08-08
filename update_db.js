require('dotenv').config();
const db = require('./src/config/db');

async function updateDb() {
  const client = await db.getClient();
  try {
    console.log('Dropping timezone column...');
    await client.query('ALTER TABLE tenants DROP COLUMN IF EXISTS timezone;');
    await client.query('ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP NULL;');
    
    console.log('Creating employees table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          first_name VARCHAR(150) NOT NULL,
          last_name VARCHAR(150) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Inserting new business types...');
    await client.query(`
      INSERT INTO business_types (id, name, slug) VALUES 
      ('018e6e58-3d2b-7b00-8000-000000000003', 'Profesionales', 'profesionales'),
      ('018e6e58-3d2b-7b00-8000-000000000004', 'Salones de eventos', 'salones-de-eventos'),
      ('018e6e58-3d2b-7b00-8000-000000000005', 'Otros', 'otros')
      ON CONFLICT (slug) DO NOTHING;
    `);
    await client.query(`
      UPDATE business_types SET name = 'Barberías', slug = 'barberias' WHERE id = '018e6e58-3d2b-7b00-8000-000000000001';
      UPDATE business_types SET name = 'Canchas', slug = 'canchas' WHERE id = '018e6e58-3d2b-7b00-8000-000000000002';
    `);

    console.log('Updating plans...');
    await client.query(`
      INSERT INTO plans (id, name, slug, price, billing_period, max_users, max_locations, max_resources, max_bookings) VALUES 
      ('018e6e58-3d2c-7b00-8000-000000000001', 'Prueba', 'prueba', 0.00, 'MONTHLY', 8, 1, 1, -1),
      ('018e6e58-3d2c-7b00-8000-000000000002', 'Individual', 'solo', 890.00, 'MONTHLY', 1, 1, -1, -1),
      ('018e6e58-3d2c-7b00-8000-000000000003', 'Equipo', 'equipo', 1490.00, 'MONTHLY', 8, 1, -1, -1),
      ('018e6e58-3d2c-7b00-8000-000000000004', 'Pro+', 'pro-plus', 3200.00, 'MONTHLY', -1, -1, -1, -1)
      ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name, 
          slug = EXCLUDED.slug,
          price = EXCLUDED.price, 
          max_users = EXCLUDED.max_users, 
          max_locations = EXCLUDED.max_locations, 
          max_resources = EXCLUDED.max_resources, 
          max_bookings = EXCLUDED.max_bookings;
    `);

    console.log('Database updated successfully.');
  } catch (error) {
    console.error('Error updating db:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateDb();
