-- Senzoly V1 - Auditoría previa del Motor de Agenda Profesional.
-- SOLO LECTURA: no crea, modifica ni elimina objetos o datos.

-- 1. Tablas y columnas requeridas.
SELECT
  required.table_name,
  required.column_name,
  EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = required.table_name
      AND c.column_name = required.column_name
  ) AS exists
FROM (
  VALUES
    ('employees', 'id'),
    ('employees', 'tenant_id'),
    ('employee_services', 'employee_id'),
    ('employee_services', 'service_id'),
    ('business_hours', 'tenant_id'),
    ('business_hours', 'day_of_week'),
    ('business_hours', 'open_time'),
    ('business_hours', 'close_time'),
    ('business_hours', 'is_closed'),
    ('bookings', 'tenant_id'),
    ('bookings', 'employee_id'),
    ('bookings', 'booking_date'),
    ('bookings', 'start_time'),
    ('bookings', 'end_time'),
    ('bookings', 'status')
) AS required(table_name, column_name)
ORDER BY required.table_name, required.column_name;

-- 2. Extensiones requeridas para UUIDs y EXCLUDE USING gist.
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('btree_gist', 'uuid-ossp')
ORDER BY extname;

-- 3. Todas las constraints de exclusión actuales de bookings.
-- Confirmar el nombre y definición antes de ejecutar la migración.
SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid = 'public.bookings'::regclass
  AND c.contype = 'x'
ORDER BY c.conname;

-- 4. Conflictos que impedirían la nueva exclusión por profesional.
-- Debe devolver cero filas para continuar. Incluye las dos reservas implicadas.
SELECT
  first_booking.employee_id,
  first_booking.booking_date AS booking_date,
  first_booking.start_time AS first_start_time,
  first_booking.end_time AS first_end_time,
  first_booking.id AS first_booking_id,
  second_booking.start_time AS second_start_time,
  second_booking.end_time AS second_end_time,
  second_booking.id AS second_booking_id
FROM bookings first_booking
JOIN bookings second_booking
  ON second_booking.employee_id = first_booking.employee_id
  AND second_booking.booking_date = first_booking.booking_date
  AND second_booking.id > first_booking.id
  AND second_booking.status IN ('PENDING', 'CONFIRMED')
  AND first_booking.start_time < second_booking.end_time
  AND second_booking.start_time < first_booking.end_time
WHERE first_booking.status IN ('PENDING', 'CONFIRMED')
  AND first_booking.employee_id IS NOT NULL
ORDER BY first_booking.employee_id, first_booking.booking_date,
         first_booking.start_time, second_booking.start_time;

-- 5. Horarios generales no migrables. Debe devolver cero filas.
SELECT id, tenant_id, day_of_week, open_time, close_time, is_closed
FROM business_hours
WHERE NOT is_closed
  AND (
    day_of_week NOT BETWEEN 0 AND 6
    OR open_time IS NULL
    OR close_time IS NULL
    OR open_time >= close_time
  )
ORDER BY tenant_id, day_of_week;

-- 6. Vista previa de las filas que se copiarán a cada profesional.
SELECT
  e.tenant_id,
  e.id AS employee_id,
  bh.day_of_week,
  bh.open_time AS start_time,
  bh.close_time AS end_time
FROM employees e
JOIN business_hours bh ON bh.tenant_id = e.tenant_id
WHERE NOT bh.is_closed
ORDER BY e.tenant_id, e.id, bh.day_of_week;
