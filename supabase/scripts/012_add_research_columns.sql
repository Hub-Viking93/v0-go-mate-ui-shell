-- Migration 012: Add visa_research and local_requirements_research columns to relocation_plans
-- Phase 0 — Schema Integrity
-- These columns store structured research results from the visa and local-requirements APIs.

alter table public.relocation_plans
  add column if not exists visa_research jsonb,
  add column if not exists local_requirements_research jsonb;

comment on column public.relocation_plans.visa_research is 'Structured visa research result (visaOptions, requirements, sources, etc.)';
comment on column public.relocation_plans.local_requirements_research is 'Structured local requirements research (categories, deadlines, tips, etc.)';
