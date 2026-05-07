-- =============================================================
-- Phase F1 — atomic research_meta patch RPC
-- =============================================================
-- The naive read-modify-write pattern for relocation_plans.research_meta:
--
--   const { data: row } = await select research_meta ...
--   await update set research_meta = { ...row.research_meta, [k]: v }
--
-- has a lost-update race when two writers race each other on different
-- sub-keys. Concretely observed during E1b testing: the
-- notifications-scheduler reads research_meta on its tick, computes
-- {notifications, notification_deliveries, notification_last_tick},
-- and writes the whole column back. If a concurrent writer mutates
-- research_meta.researchedSpecialists between the scheduler's read
-- and write, the mutation is silently lost.
--
-- This function pushes the merge into Postgres so the read + merge +
-- write happens atomically inside a single statement using JSONB's
-- `||` operator. RLS still applies — the function runs as
-- `security invoker`, so the existing UPDATE policy on
-- relocation_plans gates ownership.
--
-- Mirrors apply_profile_field_patch (Wave 2.1) which solved the same
-- class of race for profile_data writes.
--
-- Behaviour:
--   - top-level keys in p_patch are merged into research_meta;
--     existing keys are overwritten, others are preserved.
--   - merge is shallow (one level). For deep edits the caller passes
--     the desired full sub-object as the patch value.
--   - returns the merged research_meta so callers can use the
--     resulting state without a second SELECT.
--   - updated_at is bumped to now() so existing change-detection
--     keeps working.
-- =============================================================

create or replace function public.apply_research_meta_patch(
  p_plan_id uuid,
  p_patch   jsonb
) returns jsonb
language sql
security invoker
as $$
  update public.relocation_plans
  set
    research_meta = coalesce(research_meta, '{}'::jsonb) || p_patch,
    updated_at    = timezone('utc'::text, now())
  where id = p_plan_id
  returning research_meta;
$$;

grant execute on function public.apply_research_meta_patch(uuid, jsonb)
  to authenticated, service_role;

comment on function public.apply_research_meta_patch(uuid, jsonb) is
  'Phase F1: atomic JSONB merge of a partial patch into '
  'relocation_plans.research_meta. Eliminates the lost-update race in '
  'the read-modify-write pattern that hot-path writers '
  '(notifications-scheduler, refresh, generate routes) would '
  'otherwise use. RLS-gated via security invoker.';
