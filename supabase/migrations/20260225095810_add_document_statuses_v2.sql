-- Migration 013: Ensure document_statuses column exists on relocation_plans
-- Phase 0 — Schema Integrity
-- This column was originally added in migration 006. This migration is a no-op
-- safety check to guarantee the column exists after Phase 0 verification.

alter table public.relocation_plans
  add column if not exists document_statuses jsonb default '{}'::jsonb;
