-- =============================================================
-- v2 Wave 1 — per-user GOMATE_VERSION feature flag
-- =============================================================
-- Adds a `gomate_version` column to public.profiles.
-- Default 'v2' for new users; existing users (created before this migration)
-- get backfilled to 'v1' so they keep seeing v1 by default.
--
-- IDEMPOTENCY: The whole add-column-and-backfill block is gated on the
-- column NOT already existing. If you re-run this migration after it has
-- already applied, the DO block is a no-op — it will NOT re-flip existing
-- v2 users back to v1.
-- =============================================================

do $$
declare
  col_exists boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'gomate_version'
  ) into col_exists;

  if not col_exists then
    -- Add column with default 'v2' for new rows.
    alter table public.profiles
      add column gomate_version text default 'v2'
        check (gomate_version in ('v1', 'v2'));

    -- One-time backfill: all rows that exist at this moment are v1 users
    -- (they predate the column). Set them all to 'v1' explicitly.
    -- Because this only runs inside the `not col_exists` branch, it cannot
    -- run again on subsequent migration replays.
    update public.profiles
      set gomate_version = 'v1'
      where gomate_version is distinct from 'v1';

    comment on column public.profiles.gomate_version is
      'GoMate experience version. v1 = original guide platform, v2 = Relocation Agency OS multi-agent. Defaults to v2 for new signups.';
  end if;
end $$;
