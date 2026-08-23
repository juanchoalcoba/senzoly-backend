require('dotenv').config();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/db');

async function seedTestUser() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Obtener o crear tipo de negocio
    let btRes = await client.query(`SELECT id FROM business_types WHERE slug = 'barberias' LIMIT 1;`);
    let businessTypeId = btRes.rows[0]?.id;
    if (!businessTypeId) {
      businessTypeId = uuidv4();
      await client.query(`
        INSERT INTO business_types (id, name, slug)
        VALUES ($1, 'Barberías', 'barberias');
      `, [businessTypeId]);
    }

    // 2. Obtener o crear plan
    let planRes = await client.query(`SELECT id FROM plans WHERE slug = 'prueba' LIMIT 1;`);
    let planId = planRes.rows[0]?.id;
    if (!planId) {
      planId = uuidv4();
      await client.query(`
        INSERT INTO plans (id, name, slug, price, billing_period, max_users, max_locations, max_resources, max_bookings)
        VALUES ($1, 'Prueba', 'prueba', 0, 'MONTHLY', 1, 1, 7, -1);
      `, [planId]);
    }

    // 3. Crear o reusar Tenant
    const tenantSlug = 'negocio-prueba';
    let tenantRes = await client.query(`SELECT id FROM tenants WHERE slug = $1;`, [tenantSlug]);
    let tenantId = tenantRes.rows[0]?.id;

    if (!tenantId) {
      tenantId = uuidv4();
      await client.query(`
        INSERT INTO tenants (id, business_type_id, name, slug, country, phone, address, description, status)
        VALUES ($1, $2, 'Negocio de Prueba', $3, 'Uruguay', '099123456', 'Calle Falsa 123', 'Negocio para pruebas locales', 'active');
      `, [tenantId, businessTypeId, tenantSlug]);
    }

    // 4. Crear Suscripción activa
    let subRes = await client.query(`SELECT id FROM subscriptions WHERE tenant_id = $1;`, [tenantId]);
    if (subRes.rows.length === 0) {
      const subId = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);
      await client.query(`
        INSERT INTO subscriptions (id, tenant_id, plan_id, status, starts_at, expires_at)
        VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP, $4);
      `, [subId, tenantId, planId, expiresAt]);
    }

    // 5. Configurar Horarios y Booking Settings
    await client.query(`
      INSERT INTO booking_settings (id, tenant_id, slot_interval_minutes, slot_alignment)
      VALUES ($1, $2, 30, 'BUSINESS_OPEN')
      ON CONFLICT (tenant_id) DO NOTHING;
    `, [uuidv4(), tenantId]);

    for (let day = 0; day <= 6; day++) {
      await client.query(`
        INSERT INTO business_hours (id, tenant_id, day_of_week, open_time, close_time, is_closed)
        VALUES ($1, $2, $3, '09:00:00', '19:00:00', $4)
        ON CONFLICT (tenant_id, day_of_week) DO NOTHING;
      `, [uuidv4(), tenantId, day, day === 0]); // Domingo cerrado
    }

    // 6. Crear Servicio de Prueba
    let srvRes = await client.query(`SELECT id FROM services WHERE tenant_id = $1 LIMIT 1;`, [tenantId]);
    if (srvRes.rows.length === 0) {
      await client.query(`
        INSERT INTO services (id, tenant_id, name, description, duration_minutes, price, is_active)
        VALUES ($1, $2, 'Corte de Cabello Tradicional', 'Servicio de corte completo', 30, 500.00, true);
      `, [uuidv4(), tenantId]);
    }

    // 7. Crear Usuario de Prueba (Owner) con password "12345678" y email_verified = true
    const testEmail = 'admin@senzoly.com';
    const passwordHash = await bcrypt.hash('12345678', 10);

    let userRes = await client.query(`SELECT id FROM users WHERE email = $1;`, [testEmail]);
    let userId = userRes.rows[0]?.id;

    if (!userId) {
      userId = uuidv4();
      await client.query(`
        INSERT INTO users (id, tenant_id, first_name, last_name, email, password_hash, role, is_active, email_verified)
        VALUES ($1, $2, 'Juan', 'Admin', $3, $4, 'OWNER', true, true);
      `, [userId, tenantId, testEmail, passwordHash]);
      console.log('✅ Usuario de prueba CREADO con éxito.');
    } else {
      await client.query(`
        UPDATE users
        SET password_hash = $1, is_active = true, email_verified = true
        WHERE id = $2;
      `, [passwordHash, userId]);
      console.log('✅ Usuario de prueba ACTUALIZADO con éxito.');
    }

    await client.query('COMMIT');

    console.log('\n--- DATOS DE ACCESO LOCAL ---');
    console.log('📧 Email:      admin@senzoly.com');
    console.log('🔑 Password:   12345678');
    console.log('🔗 URL Reserva: http://localhost:5173/reserva/negocio-prueba\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear usuario de prueba:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedTestUser();
