-- =============================================================
-- ROLLBACK: v2 Wave 1 gomate_version column
-- =============================================================

alter table public.profiles
  drop column if exists gomate_version;
