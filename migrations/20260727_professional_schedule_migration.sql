-- Senzoly V1 - Migración del Motor de Agenda Profesional.
-- Ejecutar SOLO después de revisar y aprobar 20260727_professional_schedule_audit.sql.
-- Esta migración es atómica: cualquier fallo revierte todos los cambios.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE
  required_table text;
  invalid_business_hours integer;
  active_overlap_count integer;
  legacy_constraint oid;
  legacy_definition text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'employees', 'employee_services', 'business_hours', 'bookings'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'Falta la tabla requerida: public.%', required_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'employees debe incluir id y tenant_id';
  END IF;

  SELECT COUNT(*) INTO invalid_business_hours
  FROM business_hours
  WHERE NOT is_closed
    AND (
      day_of_week NOT BETWEEN 0 AND 6
      OR open_time IS NULL OR close_time IS NULL OR open_time >= close_time
    );
  IF invalid_business_hours > 0 THEN
    RAISE EXCEPTION 'Hay % business_hours abiertos inválidos; corregirlos antes de migrar', invalid_business_hours;
  END IF;

  SELECT COUNT(*) INTO active_overlap_count
  FROM bookings first_booking
  JOIN bookings second_booking
    ON second_booking.employee_id = first_booking.employee_id
    AND second_booking.booking_date = first_booking.booking_date
    AND second_booking.id > first_booking.id
    AND second_booking.status IN ('PENDING', 'CONFIRMED')
    AND first_booking.start_time < second_booking.end_time
    AND second_booking.start_time < first_booking.end_time
  WHERE first_booking.status IN ('PENDING', 'CONFIRMED')
    AND first_booking.employee_id IS NOT NULL;
  IF active_overlap_count > 0 THEN
    RAISE EXCEPTION 'Hay % pares de reservas activas superpuestas por profesional; la constraint nueva no se aplicó', active_overlap_count;
  END IF;

  SELECT c.oid, pg_get_constraintdef(c.oid)
    INTO legacy_constraint, legacy_definition
  FROM pg_constraint c
  WHERE c.conrelid = 'public.bookings'::regclass
    AND c.conname = 'bookings_no_overlapping_active_slots'
    AND c.contype = 'x';

  IF legacy_constraint IS NULL THEN
    RAISE EXCEPTION 'No se encontró la constraint global esperada bookings_no_overlapping_active_slots; revisar auditoría antes de continuar';
  END IF;
  IF position('tenant_id WITH =' IN legacy_definition) = 0 THEN
    RAISE EXCEPTION 'La constraint bookings_no_overlapping_active_slots no es la exclusión global esperada: %', legacy_definition;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.employees'::regclass
      AND c.contype = 'u'
      AND c.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.employees'::regclass AND attname = 'id' AND NOT attisdropped),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.employees'::regclass AND attname = 'tenant_id' AND NOT attisdropped)
      ]::smallint[]
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_id_tenant_id_unique UNIQUE (id, tenant_id);
  END IF;
END $$;

CREATE TABLE employee_working_hours (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT employee_working_hours_valid_range CHECK (start_time < end_time),
  CONSTRAINT employee_working_hours_employee_tenant_fk
    FOREIGN KEY (employee_id, tenant_id)
    REFERENCES employees (id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT employee_working_hours_no_overlaps
    EXCLUDE USING gist (
      employee_id WITH =,
      day_of_week WITH =,
      tsrange(
        DATE '2000-01-01' + start_time,
        DATE '2000-01-01' + end_time,
        '[)'
      ) WITH &&
    )
);

CREATE INDEX idx_employee_working_hours_tenant_employee_day
  ON employee_working_hours (tenant_id, employee_id, day_of_week);

-- Copia inicial independiente: sólo días abiertos. Cambios posteriores en
-- business_hours no tendrán efecto sobre employee_working_hours.
INSERT INTO employee_working_hours (
  id, tenant_id, employee_id, day_of_week, start_time, end_time
)
SELECT
  uuid_generate_v4(),
  e.tenant_id,
  e.id,
  bh.day_of_week,
  bh.open_time,
  bh.close_time
FROM employees e
JOIN business_hours bh ON bh.tenant_id = e.tenant_id
WHERE NOT bh.is_closed;

CREATE INDEX idx_bookings_employee_date_active
  ON bookings (employee_id, booking_date)
  WHERE status IN ('PENDING', 'CONFIRMED')
    AND employee_id IS NOT NULL;

ALTER TABLE bookings
  DROP CONSTRAINT bookings_no_overlapping_active_slots;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlapping_active_employee_slots
  EXCLUDE USING gist (
    employee_id WITH =,
    tsrange(booking_date + start_time, booking_date + end_time, '[)') WITH &&
  )
  WHERE (
    status IN ('PENDING', 'CONFIRMED')
    AND employee_id IS NOT NULL
  );

COMMIT;
