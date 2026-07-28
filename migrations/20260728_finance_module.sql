-- Senzoly V1 - Migración Módulo Financiero y Portal Profesional (Fase 1)
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Agregar portal_token a empleados para acceso seguro al portal profesional
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS portal_token VARCHAR(64) UNIQUE;

-- 2. Crear tabla financial_movements (Movimientos Financieros e Inmutabilidad)
CREATE TABLE IF NOT EXISTS financial_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    booking_id UUID UNIQUE REFERENCES bookings(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,

    type VARCHAR(20) NOT NULL DEFAULT 'INCOME',
    category VARCHAR(50) NOT NULL DEFAULT 'SERVICE_BOOKING',

    gross_amount NUMERIC(10, 2) NOT NULL,
    commission_type VARCHAR(20),
    commission_rate NUMERIC(10, 2),
    employee_payout NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    business_net_income NUMERIC(10, 2) NOT NULL,

    service_name_snapshot VARCHAR(255) NOT NULL,
    service_duration_snapshot INTEGER NOT NULL,
    employee_name_snapshot VARCHAR(255),
    customer_name_snapshot VARCHAR(255),

    payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH',
    completed_by_type VARCHAR(20) NOT NULL DEFAULT 'USER',
    completed_by_id UUID,
    completed_by_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fin_mov_tenant_created 
    ON financial_movements(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fin_mov_tenant_employee 
    ON financial_movements(tenant_id, employee_id);

-- 3. Actualizar la constraint de no solapamiento para incluir IN_PROGRESS si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bookings_no_overlapping_active_employee_slots'
    ) THEN
        ALTER TABLE bookings DROP CONSTRAINT bookings_no_overlapping_active_employee_slots;
        ALTER TABLE bookings
          ADD CONSTRAINT bookings_no_overlapping_active_employee_slots
          EXCLUDE USING gist (
            employee_id WITH =,
            tsrange(booking_date + start_time, booking_date + end_time, '[)') WITH &&
          )
          WHERE (
            status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
            AND employee_id IS NOT NULL
          );
    ELSIF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bookings_no_overlapping_active_slots'
    ) THEN
        ALTER TABLE bookings DROP CONSTRAINT bookings_no_overlapping_active_slots;
        ALTER TABLE bookings
          ADD CONSTRAINT bookings_no_overlapping_active_slots
          EXCLUDE USING gist (
            tenant_id WITH =,
            tsrange(booking_date + start_time, booking_date + end_time, '[)') WITH &&
          )
          WHERE (
            status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
          );
    END IF;
END $$;

COMMIT;
