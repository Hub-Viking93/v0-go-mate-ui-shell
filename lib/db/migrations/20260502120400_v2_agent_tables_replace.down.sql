-- =============================================================
-- ROLLBACK: v2 Wave 1.4 — agent infrastructure tables (replace)
-- =============================================================
-- Drops the Wave 1.4 versions of the four tables. To restore the Wave 1 shape
-- after rolling back this migration, re-apply 20260502120100_v2_agent_tables.sql.
-- =============================================================

drop table if exists public.agent_run_log cascade;
drop table if exists public.guide_section_citations cascade;
drop table if exists public.pre_departure_actions cascade;
drop table if exists public.agent_audit cascade;
