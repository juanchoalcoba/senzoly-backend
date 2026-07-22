require('dotenv').config();
const db = require('./src/config/db');
const { v7: uuidv7 } = require('uuid');

async function updateCustomersDb() {
  const client = await db.getClient();
  try {
    console.log('Creating customers table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          first_name VARCHAR(150) NOT NULL,
          last_name VARCHAR(150) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert sample customers for existing tenants so the module has initial test data
    console.log('Checking existing tenants for sample customer data...');
    const tenantsRes = await client.query('SELECT id FROM tenants LIMIT 5;');
    
    if (tenantsRes.rows.length > 0) {
      for (const tenant of tenantsRes.rows) {
        const existingCust = await client.query('SELECT id FROM customers WHERE tenant_id = $1 LIMIT 1;', [tenant.id]);
        if (existingCust.rows.length === 0) {
          console.log(`Inserting sample customers for tenant: ${tenant.id}`);
          const c1Id = uuidv7();
          const c2Id = uuidv7();
          const c3Id = uuidv7();

          await client.query(`
            INSERT INTO customers (id, tenant_id, first_name, last_name, email, phone, notes)
            VALUES 
            ($1, $4, 'Carlos', 'Gómez', 'carlos.gomez@gmail.com', '+598 99 123 456', 'Cliente frecuente. Prefiere atención por la tarde.'),
            ($2, $4, 'María', 'Rodríguez', 'maria.rodriguez@hotmail.com', '+598 98 654 321', 'Pide siempre turno con anticipación.'),
            ($3, $4, 'Lucas', 'Fernández', 'lucas.f@yahoo.com', '+598 91 999 888', 'Nota interna: Cliente puntual.');
          `, [c1Id, c2Id, c3Id, tenant.id]);
        }
      }
    }

    console.log('Customers table and initial data processed successfully.');
  } catch (error) {
    console.error('Error updating customers db:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateCustomersDb();
