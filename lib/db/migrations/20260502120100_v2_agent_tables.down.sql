-- =============================================================
-- ROLLBACK: v2 Wave 1 agent infrastructure tables
-- Drops the four agent tables in reverse-creation order.
-- Indexes, RLS policies, and triggers are dropped automatically with the table.
-- =============================================================

drop table if exists public.agent_run_log cascade;
drop table if exists public.guide_section_citations cascade;
drop table if exists public.pre_departure_actions cascade;
drop table if exists public.agent_audit cascade;
