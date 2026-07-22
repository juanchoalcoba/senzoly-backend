require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function fixExpireDates() {
  const client = await pool.connect();
  try {
    // Actualizar suscripciones que tienen expires_at NULL
    const result = await client.query(`
      UPDATE subscriptions 
      SET expires_at = starts_at + INTERVAL '30 days'
      WHERE expires_at IS NULL
      RETURNING id, status, starts_at, expires_at;
    `);
    console.log(`Actualizadas ${result.rowCount} suscripcion(es):`);
    result.rows.forEach(r => {
      console.log(`  - ID: ${r.id} | Estado: ${r.status} | Inicio: ${r.starts_at} | Vence: ${r.expires_at}`);
    });

    // Mostrar el estado actual de todas las suscripciones
    const all = await client.query(`
      SELECT s.id, s.status, s.starts_at, s.expires_at, t.name as tenant_name
      FROM subscriptions s
      JOIN tenants t ON s.tenant_id = t.id
      ORDER BY s.starts_at DESC;
    `);
    console.log('\nEstado actual de todas las suscripciones:');
    all.rows.forEach(r => {
      const daysLeft = r.expires_at 
        ? Math.ceil((new Date(r.expires_at) - new Date()) / (1000*60*60*24))
        : 'N/A';
      console.log(`  - ${r.tenant_name} | ${r.status} | Vence: ${r.expires_at} | Días restantes: ${daysLeft}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

fixExpireDates().catch(console.error);
