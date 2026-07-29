-- Senzoly V1 - Migración Módulo Financiero (Fase 3: Liquidaciones y Egresos)
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Liquidaciones / Pagos de Comisiones a Empleados
CREATE TABLE IF NOT EXISTS employee_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'TRANSFER',
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emp_payouts_tenant_emp 
    ON employee_payouts(tenant_id, employee_id);

COMMIT;
