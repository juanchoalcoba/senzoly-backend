require('dotenv').config();
const db = require('../src/config/db');

async function checkUsers() {
  const client = await db.getClient();
  try {
    const res = await client.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.email_verified, u.role, t.name as tenant_name, t.status as tenant_status
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id;
    `);
    console.log('--- USUARIOS EN BASE DE DATOS LOCAL ---');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error consultando usuarios:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkUsers();
