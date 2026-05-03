-- =============================================================
-- v2 Wave 2.1 — atomic profile_data patch RPC
-- =============================================================
-- Profile Writer needs to merge a single key into
-- relocation_plans.profile_data. The naive approach is
-- read-modify-write from the application:
--
--   const cur = await select profile_data ...
--   await update set profile_data = {...cur, [k]: v}
--
-- That has a lost-update race when two extraction chains race
-- each other (e.g. a multi-field user message produces two
-- concurrent profile_writer calls, or two browser tabs are open).
-- Whichever UPDATE arrives second silently overwrites the first.
--
-- This function pushes the merge into Postgres so the read +
-- merge + write happens atomically inside a single statement
-- using JSONB's `||` operator. RLS still applies — the function
-- runs as `security invoker`, so the existing UPDATE policy on
-- relocation_plans gates ownership.
--
-- Returns the merged profile_data so callers can use the result
-- without a second SELECT round-trip.
-- =============================================================

create or replace function public.apply_profile_field_patch(
  p_profile_id uuid,
  p_patch      jsonb
) returns jsonb
language sql
security invoker
as $$
  update public.relocation_plans
  set
    profile_data = coalesce(profile_data, '{}'::jsonb) || p_patch,
    updated_at   = timezone('utc'::text, now())
  where id = p_profile_id
  returning profile_data;
$$;

grant execute on function public.apply_profile_field_patch(uuid, jsonb)
  to authenticated, service_role;

comment on function public.apply_profile_field_patch(uuid, jsonb) is
  'Wave 2.1: atomic JSONB merge of a partial patch into '
  'relocation_plans.profile_data. Eliminates the lost-update race in '
  'the read-modify-write pattern profile-writer.ts would otherwise '
  'use. RLS-gated via security invoker.';
