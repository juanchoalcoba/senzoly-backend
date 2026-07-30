-- Migration: 20260729_subscriptions_mercadopago.sql

-- 1. Alter subscriptions table to ensure all necessary billing columns
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP;

-- 2. Create subscription_payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    payment_id VARCHAR(255) UNIQUE NOT NULL,
    merchant_order_id VARCHAR(255),
    preference_id VARCHAR(255),
    payer_email VARCHAR(255),
    transaction_amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(100),
    status VARCHAR(50) NOT NULL,
    status_detail VARCHAR(255),
    date_approved TIMESTAMP,
    external_reference VARCHAR(255),
    raw_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_tenant
ON subscription_payments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_sub_payments_mp_id
ON subscription_payments(payment_id);

-- 3. Create webhook_logs table for audit & traceability
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    payment_id VARCHAR(255),
    preference_id VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    payload JSONB,
    status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created
ON webhook_logs(created_at DESC);