require('dotenv').config();
const db = require('./src/config/db');

async function updateEmployeeServicesDb() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_services (
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        PRIMARY KEY (employee_id, service_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_services_service_id
        ON employee_services(service_id);
    `);
    await client.query('COMMIT');
    console.log('Relación entre empleados y servicios preparada correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al preparar la relación entre empleados y servicios:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updateEmployeeServicesDb();
