-- Migration 024: Add currency column to guides table
-- Stores the ISO currency code for all monetary amounts in the guide
-- Default EUR matches all existing guides (previously hardcoded)
ALTER TABLE guides ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
