require('dotenv').config();
const db = require('./src/config/db');
const { v4: uuidv4 } = require('uuid');

async function updateBranchesDb() {
  const client = await db.getClient();
  try {
    console.log('Iniciando migración de Sucursales (Multi-Branch System)...');
    await client.query('BEGIN');

    // 1. Crear tablas
    await client.query(`
      CREATE TABLE IF NOT EXISTS branches (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          name VARCHAR(150) NOT NULL,
          address VARCHAR(255),
          phone VARCHAR(50),
          image_url TEXT,
          image_public_id TEXT,
          is_main BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS branch_employees (
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
          employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          PRIMARY KEY (branch_id, employee_id)
      );

      CREATE TABLE IF NOT EXISTS branch_services (
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
          service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          PRIMARY KEY (branch_id, service_id)
      );

      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
      
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_movements') THEN
          ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 2. Actualizar plan Prueba a max_locations = -1
    await client.query(`
      UPDATE plans SET max_locations = -1 WHERE slug = 'prueba';
    `);

    // 3. Backfill: Crear Sucursal Principal para cada tenant que no tenga sucursales
    const tenantsRes = await client.query(`SELECT id, name FROM tenants;`);
    for (const tenant of tenantsRes.rows) {
      const existingBranchRes = await client.query(`SELECT id FROM branches WHERE tenant_id = $1 LIMIT 1;`, [tenant.id]);
      
      let mainBranchId;
      if (existingBranchRes.rowCount === 0) {
        mainBranchId = uuidv4();
        await client.query(`
          INSERT INTO branches (id, tenant_id, name, address, phone, is_main, is_active)
          VALUES ($1, $2, 'Sucursal Principal', '', '', true, true);
        `, [mainBranchId, tenant.id]);
        console.log(`✅ Creada Sucursal Principal para tenant: ${tenant.name} (${tenant.id})`);
      } else {
        mainBranchId = existingBranchRes.rows[0].id;
      }

      // Vincular empleados existentes que no estén vinculados
      await client.query(`
        INSERT INTO branch_employees (branch_id, employee_id)
        SELECT $1, id FROM employees WHERE tenant_id = $2
        ON CONFLICT DO NOTHING;
      `, [mainBranchId, tenant.id]);

      // Vincular servicios existentes que no estén vinculados
      await client.query(`
        INSERT INTO branch_services (branch_id, service_id)
        SELECT $1, id FROM services WHERE tenant_id = $2
        ON CONFLICT DO NOTHING;
      `, [mainBranchId, tenant.id]);

      // Asignar branch_id en bookings sin branch_id
      await client.query(`
        UPDATE bookings SET branch_id = $1 WHERE tenant_id = $2 AND branch_id IS NULL;
      `, [mainBranchId, tenant.id]);

      // Asignar branch_id en financial_movements sin branch_id si la tabla existe
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_movements') THEN
            UPDATE financial_movements SET branch_id = $1 WHERE tenant_id = $2 AND branch_id IS NULL;
          END IF;
        END $$;
      `, [mainBranchId, tenant.id]);
    }

    await client.query('COMMIT');
    console.log('✅ Migración de sucursales completada con éxito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración de sucursales:', error);
  } finally {
    client.release();
    process.exit();
  }
}

updateBranchesDb();
