-- Script de inicialización de la base de datos para Senzoly

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Tabla de Catálogo: business_types
CREATE TABLE IF NOT EXISTS business_types (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    icon VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Catálogo: plans
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    billing_period VARCHAR(50) NOT NULL, -- ej: 'MONTHLY', 'YEARLY'
    max_users INT NOT NULL DEFAULT 1,
    max_locations INT NOT NULL DEFAULT 1,
    max_resources INT NOT NULL DEFAULT 1,
    max_bookings INT NOT NULL DEFAULT -1, -- -1 = unlimited
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla principal: tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY,
    business_type_id UUID NOT NULL REFERENCES business_types(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    country VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'trial',
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla: subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status VARCHAR(50) NOT NULL, -- ej: 'TRIAL', 'ACTIVE', 'CANCELED'
    starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'OWNER',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    terms_accepted_at TIMESTAMP NULL,
    terms_version VARCHAR(20) NULL,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabla: email_verifications
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6.1 Tokens de recuperación de contraseña. Solo se guarda el hash del token.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
    ON password_reset_tokens(user_id);

-- 7. Tabla: employees
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    commission_type VARCHAR(20) CHECK (commission_type IN ('percentage', 'fixed')),
    commission_value NUMERIC(10, 2),
    portal_token VARCHAR(64) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabla: customers
-- Esta tabla será utilizada posteriormente por el módulo Booking como entidad maestra de clientes del tenant.
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabla: services
-- Representa la unidad reservable del negocio (Barbería, Canchas, Consultorios, etc.).
-- Servirá posteriormente para el Portal Público de Reservas y el Módulo Booking (service_id).
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    image_url TEXT,
    image_public_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9.1 Relación de servicios que puede realizar cada empleado.
CREATE TABLE IF NOT EXISTS employee_services (
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (employee_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_services_service_id
    ON employee_services(service_id);

-- 10. Tabla: business_hours
-- Representa exclusivamente el Horario General de Apertura del Tenant (0=Domingo...6=Sábado).
CREATE TABLE IF NOT EXISTS business_hours (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,
    open_time TIME DEFAULT '09:00:00',
    close_time TIME DEFAULT '19:00:00',
    is_closed BOOLEAN DEFAULT false,
    break_start TIME DEFAULT NULL,
    break_end TIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_day UNIQUE (tenant_id, day_of_week)
);

-- 10.1 Reglas de generación de turnos para cada tenant.
CREATE TABLE IF NOT EXISTS booking_settings (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    slot_interval_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (slot_interval_minutes IN (15, 30, 60)),
    slot_alignment VARCHAR(30) NOT NULL DEFAULT 'BUSINESS_OPEN' CHECK (slot_alignment IN ('BUSINESS_OPEN', 'CLOCK_HOUR')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Tabla: bookings
-- Núcleo de citas y reservas registradas tanto en línea como administrativamente.
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED',
    total_price NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Tabla: financial_movements (Módulo Financiero)
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

-- Impide que dos reservas activas del mismo negocio ocupen un período que se superpone.
-- El rango usa [inicio, fin), por lo que un turno que termina a las 10:00 permite otro que empieza a las 10:00.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bookings_no_overlapping_active_slots'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_no_overlapping_active_slots
            EXCLUDE USING gist (
                tenant_id WITH =,
                tsrange(booking_date + start_time, booking_date + end_time, '[)') WITH &&
            )
            WHERE (status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS'));
    END IF;
END $$;

-- Inserción de datos iniciales para pruebas locales (Catálogos)
INSERT INTO business_types (id, name, slug) VALUES 
('018e6e58-3d2b-7b00-8000-000000000001', 'Barberías', 'barberias'),
('018e6e58-3d2b-7b00-8000-000000000002', 'Canchas', 'canchas'),
('018e6e58-3d2b-7b00-8000-000000000003', 'Profesionales', 'profesionales'),
('018e6e58-3d2b-7b00-8000-000000000004', 'Salones de eventos', 'salones-de-eventos'),
('018e6e58-3d2b-7b00-8000-000000000005', 'Otros', 'otros')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plans (id, name, slug, price, billing_period, max_users, max_locations, max_resources, max_bookings) VALUES 
('018e6e58-3d2c-7b00-8000-000000000001', 'Prueba', 'prueba', 0.00, 'MONTHLY', 8, 1, 1, 20),
('018e6e58-3d2c-7b00-8000-000000000002', 'Solo', 'solo', 1490.00, 'MONTHLY', 1, 1, -1, -1),
('018e6e58-3d2c-7b00-8000-000000000003', 'Equipo', 'equipo', 2490.00, 'MONTHLY', 8, 1, -1, -1),
('018e6e58-3d2c-7b00-8000-000000000004', 'Pro+', 'pro-plus', 3990.00, 'MONTHLY', -1, -1, -1, -1)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    slug = EXCLUDED.slug,
    price = EXCLUDED.price, 
    max_users = EXCLUDED.max_users, 
    max_locations = EXCLUDED.max_locations, 
    max_resources = EXCLUDED.max_resources, 
    max_bookings = EXCLUDED.max_bookings;
