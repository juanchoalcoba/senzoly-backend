require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');

async function updateSubscriptionsDb() {
  const client = await db.getClient();

  try {
    console.log('Iniciando migración de MercadoPago Subscriptions...');
    await client.query('BEGIN');

    const sqlPath = path.join(__dirname, 'migrations', '20260729_subscriptions_mercadopago.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sqlContent);
    await client.query('COMMIT');
    console.log('Migración de MercadoPago Subscriptions completada con éxito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración de MercadoPago Subscriptions:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updateSubscriptionsDb();
