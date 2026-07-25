require('dotenv').config();
const db = require('./src/config/db');

const OVERLAPPING_BOOKINGS_QUERY = `
  SELECT
    first_booking.tenant_id,
    first_booking.id AS first_booking_id,
    first_booking.booking_date,
    first_booking.start_time AS first_start_time,
    first_booking.end_time AS first_end_time,
    second_booking.id AS second_booking_id,
    second_booking.start_time AS second_start_time,
    second_booking.end_time AS second_end_time
  FROM bookings first_booking
  JOIN bookings second_booking
    ON second_booking.tenant_id = first_booking.tenant_id
    AND second_booking.booking_date = first_booking.booking_date
    AND second_booking.id > first_booking.id
    AND second_booking.status IN ('PENDING', 'CONFIRMED')
    AND first_booking.start_time < second_booking.end_time
    AND second_booking.start_time < first_booking.end_time
  WHERE first_booking.status IN ('PENDING', 'CONFIRMED')
  LIMIT 10;
`;

async function updateBookingIntegrity() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist');

    const existingConstraint = await client.query(`
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'bookings_no_overlapping_active_slots';
    `);

    if (existingConstraint.rowCount > 0) {
      await client.query('COMMIT');
      console.log('La protección contra reservas superpuestas ya está activa.');
      return;
    }

    const overlaps = await client.query(OVERLAPPING_BOOKINGS_QUERY);
    if (overlaps.rowCount > 0) {
      const details = overlaps.rows.map((booking) => (
        `${booking.booking_date}: ${booking.first_start_time}-${booking.first_end_time} y ${booking.second_start_time}-${booking.second_end_time}`
      )).join('; ');
      throw new Error(`Existen reservas activas superpuestas. Corrígelas antes de activar la protección: ${details}`);
    }

    await client.query(`
      ALTER TABLE bookings
      ADD CONSTRAINT bookings_no_overlapping_active_slots
      EXCLUDE USING gist (
        tenant_id WITH =,
        tsrange(booking_date + start_time, booking_date + end_time, '[)') WITH &&
      )
      WHERE (status IN ('PENDING', 'CONFIRMED'));
    `);

    await client.query('COMMIT');
    console.log('Protección contra reservas superpuestas activada correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar la integridad de reservas:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updateBookingIntegrity();
