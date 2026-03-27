-- Migration 020: Add onboarding_completed flag to relocation_plans
-- Phase 10 — Chat Safety & Onboarding
-- Distinguishes first-time from returning users for UX differentiation.

alter table public.relocation_plans
  add column if not exists onboarding_completed boolean default false;

comment on column public.relocation_plans.onboarding_completed is 'True after first plan generation (generating/complete stage reached)';
