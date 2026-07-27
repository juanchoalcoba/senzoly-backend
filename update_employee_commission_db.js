require('dotenv').config();
const db = require('./src/config/db');

async function updateEmployeeCommissionDb() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS commission_type VARCHAR(20),
        ADD COLUMN IF NOT EXISTS commission_value NUMERIC(10, 2);
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'employees_commission_type_check'
        ) THEN
          ALTER TABLE employees
            ADD CONSTRAINT employees_commission_type_check
            CHECK (commission_type IN ('percentage', 'fixed'));
        END IF;
      END $$;
    `);
    await client.query('COMMIT');
    console.log('Campos de comisión de empleados preparados correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al preparar los campos de comisión de empleados:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updateEmployeeCommissionDb();
