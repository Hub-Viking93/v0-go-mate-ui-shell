-- Add document_statuses column to relocation_plans table
-- This stores the completion status of each document in the checklist

alter table public.relocation_plans 
add column if not exists document_statuses jsonb default '{}'::jsonb;

-- Example structure of document_statuses:
-- {
--   "passport": { "completed": true, "completedAt": "2026-01-15T10:30:00Z" },
--   "visa_application": { "completed": false },
--   "birth_certificate": { "completed": true, "completedAt": "2026-01-10T14:20:00Z" }
-- }

comment on column public.relocation_plans.document_statuses is 'Tracks completion status of documents in the checklist';
