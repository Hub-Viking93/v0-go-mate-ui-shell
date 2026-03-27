-- Migration 019: Add guide versioning and staleness tracking
-- Phase 9 — Guide & Research Freshness
-- Tracks when guides become stale relative to profile changes.

-- Add staleness tracking to guides table
alter table public.guides
  add column if not exists guide_version integer default 1,
  add column if not exists plan_version_at_generation integer,
  add column if not exists is_stale boolean default false,
  add column if not exists stale_at timestamptz,
  add column if not exists stale_reason text;

comment on column public.guides.guide_version is 'Monotonic version counter, incremented on regeneration';
comment on column public.guides.plan_version_at_generation is 'plan_version at the time this guide was generated';
comment on column public.guides.is_stale is 'True when profile changed after guide generation';
comment on column public.guides.stale_at is 'Timestamp when guide was marked stale';
comment on column public.guides.stale_reason is 'Reason guide is stale: profile_changed, destination_changed, etc.';

-- Add research freshness tracking to relocation_plans
alter table public.relocation_plans
  add column if not exists research_freshness_days integer;

comment on column public.relocation_plans.research_freshness_days is 'Days since research was completed; computed on read';
