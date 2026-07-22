-- Script de inicialización de la base de datos para Senzoly

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- 7. Tabla: employees
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tabla: business_hours
-- Representa exclusivamente el Horario General de Apertura del Tenant (0=Domingo...6=Sábado).
CREATE TABLE IF NOT EXISTS business_hours (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,
    open_time TIME DEFAULT '09:00:00',
    close_time TIME DEFAULT '19:00:00',
    is_closed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_day UNIQUE (tenant_id, day_of_week)
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

-- Inserción de datos iniciales para pruebas locales (Catálogos)
INSERT INTO business_types (id, name, slug) VALUES 
('018e6e58-3d2b-7b00-8000-000000000001', 'Barberías', 'barberias'),
('018e6e58-3d2b-7b00-8000-000000000002', 'Canchas', 'canchas'),
('018e6e58-3d2b-7b00-8000-000000000003', 'Profesionales', 'profesionales'),
('018e6e58-3d2b-7b00-8000-000000000004', 'Salones de eventos', 'salones-de-eventos'),
('018e6e58-3d2b-7b00-8000-000000000005', 'Otros', 'otros')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plans (id, name, slug, price, billing_period, max_users, max_locations, max_resources, max_bookings) VALUES 
('018e6e58-3d2c-7b00-8000-000000000001', 'Prueba', 'prueba', 0.00, 'MONTHLY', 1, 1, 1, 20),
('018e6e58-3d2c-7b00-8000-000000000002', 'Solo', 'solo', 1490.00, 'MONTHLY', 1, 1, -1, -1),
('018e6e58-3d2c-7b00-8000-000000000003', 'Equipo', 'equipo', 2490.00, 'MONTHLY', 5, 1, -1, -1),
('018e6e58-3d2c-7b00-8000-000000000004', 'Pro+', 'pro-plus', 3990.00, 'MONTHLY', -1, -1, -1, -1)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    slug = EXCLUDED.slug,
    price = EXCLUDED.price, 
    max_users = EXCLUDED.max_users, 
    max_locations = EXCLUDED.max_locations, 
    max_resources = EXCLUDED.max_resources, 
    max_bookings = EXCLUDED.max_bookings;
