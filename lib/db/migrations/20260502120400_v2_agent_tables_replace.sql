-- =============================================================
-- v2 Wave 1.4 — REPLACE agent infrastructure tables
-- =============================================================
-- This migration SUPERSEDES 20260502120100_v2_agent_tables.sql.
-- The four tables created in 120100 (agent_audit, pre_departure_actions,
-- guide_section_citations, agent_run_log) are dropped and recreated with
-- the Wave 1.4 schema, which differs from Wave 1 in semantics:
--
--   * agent_audit          — was "one row per coordinator decision/tool call".
--                            Now "one row per agent extraction/validation/research
--                            output, with confidence + prompt/response hashes".
--   * pre_departure_actions — was absolute-deadline (date) model.
--                            Now relative-timing (weeks_before_move_*) model with
--                            depends_on graph + documents_needed.
--   * guide_section_citations — was trust/freshness signals.
--                            Now paragraph-position + numbered footnote markers.
--   * agent_run_log        — was per-coordinator-run rollup.
--                            Now per-agent-invocation log with prompt/response
--                            summaries + tools_called.
--
-- DESTRUCTIVE: drops the Wave 1 tables (and any rows). Apply manually via the
-- Supabase SQL editor only after confirming you have nothing depending on the
-- old shape. Roll back with the matching .down.sql.
--
-- Naming note: per Wave 1.4 spec the FK column is `profile_id` (not `plan_id`)
-- even though the referenced table is `relocation_plans`. RLS joins go via
-- relocation_plans.user_id (and via guides.plan_id for citations).
-- =============================================================

-- Drop the Wave 1 tables (cascade removes indexes, RLS policies, triggers, FKs).
drop table if exists public.agent_run_log cascade;
drop table if exists public.guide_section_citations cascade;
drop table if exists public.pre_departure_actions cascade;
drop table if exists public.agent_audit cascade;

-- =============================================================
-- 1. agent_audit — per-output audit log (extraction/validation/research/etc.)
-- =============================================================
create table public.agent_audit (
  id                          uuid primary key default gen_random_uuid(),
  profile_id                  uuid not null references public.relocation_plans(id) on delete cascade,

  agent_name                  text not null,
  model_used                  text,
  phase                       text not null check (
    phase in ('extraction', 'validation', 'research', 'enrichment', 'settling-in', 'chat')
  ),
  field_or_output_key         text,
  value                       jsonb,
  confidence                  text check (
    confidence in ('explicit', 'inferred', 'assumed', 'full', 'partial', 'fallback')
  ),

  source_user_message         text,
  source_url                  text,

  prompt_hash                 text,
  response_hash               text,

  validation_rules_applied    jsonb,

  retrieved_at                timestamp with time zone not null default timezone('utc'::text, now()),
  wall_clock_ms               integer,
  tokens_used                 integer,
  retry_count                 integer not null default 0
);

alter table public.agent_audit enable row level security;

-- RLS: row is visible/insertable only when the joined relocation_plan is owned by the caller.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_audit' and policyname='agent_audit_select_own') then
    create policy "agent_audit_select_own" on public.agent_audit
      for select using (
        exists (
          select 1 from public.relocation_plans rp
          where rp.id = agent_audit.profile_id and rp.user_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_audit' and policyname='agent_audit_insert_own') then
    create policy "agent_audit_insert_own" on public.agent_audit
      for insert with check (
        exists (
          select 1 from public.relocation_plans rp
          where rp.id = agent_audit.profile_id and rp.user_id = auth.uid()
        )
      );
  end if;
end $$;

create index agent_audit_profile_id_idx              on public.agent_audit(profile_id);
create index agent_audit_agent_name_idx              on public.agent_audit(agent_name);
create index agent_audit_profile_agent_retrieved_idx on public.agent_audit(profile_id, agent_name, retrieved_at desc);

-- =============================================================
-- 2. pre_departure_actions — relative-timing pre-move tasks
-- =============================================================
create table public.pre_departure_actions (
  id                            uuid primary key default gen_random_uuid(),
  profile_id                    uuid not null references public.relocation_plans(id) on delete cascade,

  title                         text not null,
  description                   text,

  weeks_before_move_start       integer,
  weeks_before_move_deadline    integer,
  estimated_duration_days       integer,

  depends_on                    uuid[],
  documents_needed              text[],

  official_source_url           text,
  pre_filled_form_url           text,

  agent_who_added_it            text,
  legal_consequence_if_missed   text,

  status                        text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'complete', 'blocked', 'skipped')
  ),
  completed_at                  timestamp with time zone,

  created_at                    timestamp with time zone not null default timezone('utc'::text, now()),
  sort_order                    integer
);

alter table public.pre_departure_actions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pre_departure_actions' and policyname='pre_departure_actions_select_own') then
    create policy "pre_departure_actions_select_own" on public.pre_departure_actions
      for select using (
        exists (
          select 1 from public.relocation_plans rp
          where rp.id = pre_departure_actions.profile_id and rp.user_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pre_departure_actions' and policyname='pre_departure_actions_insert_own') then
    create policy "pre_departure_actions_insert_own" on public.pre_departure_actions
      for insert with check (
        exists (
          select 1 from public.relocation_plans rp
          where rp.id = pre_departure_actions.profile_id and rp.user_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pre_departure_actions' and policyname='pre_departure_actions_update_own') then
    create policy "pre_departure_actions_update_own" on public.pre_departure_actions
      for update using (
        exists (
          select 1 from public.relocation_plans rp
          where rp.id = pre_departure_actions.profile_id and rp.user_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pre_departure_actions' and policyname='pre_departure_actions_delete_own') then
    create policy "pre_departure_actions_delete_own" on public.pre_departure_actions
      for delete using (
        exists (
          select 1 from public.relocation_plans rp
          where rp.id = pre_departure_actions.profile_id and rp.user_id = auth.uid()
        )
      );
  end if;
end $$;

create index pre_departure_actions_profile_id_idx       on public.pre_departure_actions(profile_id);
create index pre_departure_actions_profile_weeks_idx    on public.pre_departure_actions(profile_id, weeks_before_move_start);

-- =============================================================
-- 3. guide_section_citations — paragraph-positioned numbered citations
-- =============================================================
-- The `guides` table predates the buildathon migrations (referenced by
-- routes/guides.ts and lib/db/src/schema/guide-section-citations.ts) so we
-- declare guide_id as an FK to it here. RLS goes via guides.plan_id ->
-- relocation_plans.user_id.
create table public.guide_section_citations (
  id                  uuid primary key default gen_random_uuid(),
  guide_id            uuid not null references public.guides(id) on delete cascade,

  section_key         text not null,
  paragraph_idx       integer not null,
  citation_number     integer not null,

  source_url          text not null,
  source_name         text,

  retrieved_at        timestamp with time zone not null default timezone('utc'::text, now()),
  last_verified_at    timestamp with time zone not null default timezone('utc'::text, now()),

  agent_who_added_it  text,
  created_at          timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.guide_section_citations enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='guide_section_citations' and policyname='guide_section_citations_select_own') then
    create policy "guide_section_citations_select_own" on public.guide_section_citations
      for select using (
        exists (
          select 1 from public.guides g
          join public.relocation_plans rp on rp.id = g.plan_id
          where g.id = guide_section_citations.guide_id and rp.user_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='guide_section_citations' and policyname='guide_section_citations_insert_own') then
    create policy "guide_section_citations_insert_own" on public.guide_section_citations
      for insert with check (
        exists (
          select 1 from public.guides g
          join public.relocation_plans rp on rp.id = g.plan_id
          where g.id = guide_section_citations.guide_id and rp.user_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='guide_section_citations' and policyname='guide_section_citations_delete_own') then
    create policy "guide_section_citations_delete_own" on public.guide_section_citations
      for delete using (
        exists (
          select 1 from public.guides g
          join public.relocation_plans rp on rp.id = g.plan_id
          where g.id = guide_section_citations.guide_id and rp.user_id = auth.uid()
        )
      );
  end if;
end $$;

create index guide_section_citations_guide_id_idx              on public.guide_section_citations(guide_id);
create index guide_section_citations_guide_section_para_idx    on public.guide_section_citations(guide_id, section_key, paragraph_idx);

-- =============================================================
-- 4. agent_run_log — per-invocation log with prompt/response summaries
-- =============================================================
-- Note: the spec column is literally named `timestamp`. It is a non-reserved
-- keyword in PostgreSQL but is quoted here to avoid ambiguity in queries.
create table public.agent_run_log (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.relocation_plans(id) on delete cascade,

  agent_name          text not null,
  phase               text not null,

  status              text not null check (
    status in ('started', 'completed', 'failed', 'retry')
  ),

  prompt_summary      text,
  response_summary    text,
  tools_called        text[],
  validation_passed   boolean,
  retry_count         integer not null default 0,
  tokens_used         integer,
  wall_clock_ms       integer,
  error_message       text,

  "timestamp"         timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.agent_run_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_run_log' and policyname='agent_run_log_select_own') then
    create policy "agent_run_log_select_own" on public.agent_run_log
      for select using (
        exists (
          select 1 from public.relocation_plans rp
          where rp.id = agent_run_log.profile_id and rp.user_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_run_log' and policyname='agent_run_log_insert_own') then
    create policy "agent_run_log_insert_own" on public.agent_run_log
      for insert with check (
        exists (
          select 1 from public.relocation_plans rp
          where rp.id = agent_run_log.profile_id and rp.user_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_run_log' and policyname='agent_run_log_update_own') then
    create policy "agent_run_log_update_own" on public.agent_run_log
      for update using (
        exists (
          select 1 from public.relocation_plans rp
          where rp.id = agent_run_log.profile_id and rp.user_id = auth.uid()
        )
      );
  end if;
end $$;

create index agent_run_log_profile_id_idx        on public.agent_run_log(profile_id);
create index agent_run_log_profile_timestamp_idx on public.agent_run_log(profile_id, "timestamp" desc);
