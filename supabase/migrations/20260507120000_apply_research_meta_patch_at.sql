-- =============================================================
-- Phase F1 fix — path-aware research_meta patch
-- =============================================================
-- The original apply_research_meta_patch uses jsonb's `||` operator
-- which is a SHALLOW (top-level) merge. That closes the race for
-- writes targeting different top-level keys, but it leaves a hole
-- when two writers update DIFFERENT sub-keys under the SAME parent.
--
-- Concrete scenario (verified via dry-run-f1-nested-race):
--   writer A patches { researchedSpecialists: { banking: B } }
--   writer B patches { researchedSpecialists: { healthcare: H } }
--   second write wholesale-replaces researchedSpecialists; first
--   write's domain edit is lost.
--
-- Fix: use jsonb_set with an explicit path so writes only touch
-- the leaf they own. Writers that update one domain at a time
-- (refresh, generate, scheduler-warm) call this with
-- p_path=['researchedSpecialists','<domain>'] and p_value=<bundle>.
--
-- Path semantics:
--   - Length 1 paths (top-level keys) work the same as the
--     original function — jsonb_set on the root document.
--   - Length 2+ paths first ensure each parent on the path exists
--     (defaults to {}) so jsonb_set's strict-mode requirement is
--     satisfied.  Only depth-2 explicitly handled here; deeper
--     paths can extend the function later.
--   - `create_missing = true` so the leaf is added if absent.
-- =============================================================

create or replace function public.apply_research_meta_patch_at(
  p_plan_id uuid,
  p_path    text[],
  p_value   jsonb
) returns jsonb
language sql
security invoker
as $$
  update public.relocation_plans
  set
    -- Outer jsonb_set: write the leaf at the full path.
    -- Inner jsonb_set: ensure the depth-2 parent object exists by
    -- writing it back to itself (or '{}' if absent). For depth-1
    -- paths the inner is a no-op (writes the same key with the
    -- same shape) and the outer overwrites it.
    research_meta = jsonb_set(
      jsonb_set(
        coalesce(research_meta, '{}'::jsonb),
        ARRAY[p_path[1]],
        coalesce(research_meta -> p_path[1], '{}'::jsonb),
        true
      ),
      p_path,
      p_value,
      true
    ),
    updated_at    = timezone('utc'::text, now())
  where id = p_plan_id
  returning research_meta;
$$;

grant execute on function public.apply_research_meta_patch_at(uuid, text[], jsonb)
  to authenticated, service_role;

comment on function public.apply_research_meta_patch_at(uuid, text[], jsonb) is
  'Phase F1 fix: path-aware atomic JSONB write into '
  'relocation_plans.research_meta. Closes the nested-key race that '
  'the original apply_research_meta_patch left open when two writers '
  'updated different sub-keys under the same parent (e.g. '
  'researchedSpecialists.banking + researchedSpecialists.healthcare). '
  'RLS-gated via security invoker. Depth ≤ 2 supported; extend if '
  'deeper writes ever materialise.';
