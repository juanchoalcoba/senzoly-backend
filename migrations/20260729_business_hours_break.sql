-- Migration: 20260729_business_hours_break.sql
-- Agrega soporte de pausa opcional en el horario de atención general

ALTER TABLE business_hours
  ADD COLUMN IF NOT EXISTS break_start TIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS break_end TIME DEFAULT NULL;
