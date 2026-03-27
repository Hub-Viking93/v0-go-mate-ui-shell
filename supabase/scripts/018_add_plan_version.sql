-- Migration 018: Add plan_version counter to relocation_plans
-- Phase 7 — Generation Quality
-- Tracks meaningful plan changes so downstream artifacts can detect staleness.

alter table public.relocation_plans
  add column if not exists plan_version integer default 1;

comment on column public.relocation_plans.plan_version is 'Monotonic counter incremented on destination change, stage transition, profile lock, or profile data changes';
