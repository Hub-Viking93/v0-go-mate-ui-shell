-- Migration 011: Add steps, documents_needed, and cost columns to settling_in_tasks
-- Phase 0 — Schema Integrity
-- These columns store AI-generated procedural data for post-arrival tasks.

alter table public.settling_in_tasks
  add column if not exists steps text[],
  add column if not exists documents_needed text[],
  add column if not exists cost text;

comment on column public.settling_in_tasks.steps is 'Ordered procedural steps to complete this task';
comment on column public.settling_in_tasks.documents_needed is 'Documents required to complete this task';
comment on column public.settling_in_tasks.cost is 'Actual cost (e.g. "Free", "~50 EUR", "Varies")';
