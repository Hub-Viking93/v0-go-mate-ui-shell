-- Migration 023: Guide Artifact Integrity
-- Phase 4 (master-audit) — Snapshot-bound regeneration + logical guide identity
--
-- B4-002: Store profile snapshot at generation time so regeneration is input-bound
-- B4-003: Add is_current flag + partial unique index for logical guide identity

-- 1. Add profile_snapshot column — frozen profile_data used to generate this guide
alter table public.guides
  add column if not exists profile_snapshot jsonb;

comment on column public.guides.profile_snapshot is 'Frozen profile_data snapshot used at generation time';

-- 2. Add is_current flag — only one current guide per logical identity
alter table public.guides
  add column if not exists is_current boolean default true;

comment on column public.guides.is_current is 'True for the active guide per (plan_id, destination, purpose, guide_type) tuple';

-- 3. Backfill FIRST: for any existing duplicate logical identities, keep only the newest as current
-- This normalizes any pre-existing duplicate inventories BEFORE the unique index is created
do $$
declare
  r record;
begin
  for r in (
    select id
    from (
      select id,
        row_number() over (
          partition by plan_id, destination, coalesce(purpose, 'other'), coalesce(guide_type, 'main')
          order by updated_at desc nulls last, created_at desc nulls last
        ) as rn
      from public.guides
      where is_current = true or is_current is null
    ) ranked
    where rn > 1
  ) loop
    update public.guides set is_current = false where id = r.id;
  end loop;
end $$;

-- 4. Create partial unique index AFTER backfill — enforces one current guide per logical identity
create unique index if not exists idx_guides_current_identity
  on public.guides (plan_id, destination, purpose, guide_type)
  where is_current = true;
