-- =============================================================
-- v2 Wave 1 — agent infrastructure tables
-- =============================================================
-- 4 new tables for the multi-agent architecture:
--   agent_audit               — every agent decision logged for explainability
--   pre_departure_actions     — Coordinator-generated tasks with deadlines
--   guide_section_citations   — official-source citations attached to guide content
--   agent_run_log             — coordinator/specialist invocation log + cost tracking
-- All four follow the v1 RLS pattern (user-owned via user_id).
--
-- IDEMPOTENCY: This migration is safe to re-run. Tables/indexes use
-- `if not exists`. RLS policies are wrapped in DO blocks that check
-- pg_policies first (CREATE POLICY does not support IF NOT EXISTS in
-- PostgreSQL < 15, so we emulate it).
-- =============================================================

-- 1. agent_audit — append-only log of every agent decision/output
create table if not exists public.agent_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.relocation_plans(id) on delete cascade,

  -- Which agent produced this entry
  agent_name text not null,
  agent_role text not null check (agent_role in ('coordinator', 'specialist', 'tool')),

  -- What it did
  action text not null,                  -- 'decision', 'tool_call', 'output', 'error'
  input_summary text,
  output_summary text,
  output_data jsonb default '{}'::jsonb, -- structured agent output (snapshot at time of decision)

  -- Provenance
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10, 6),
  duration_ms integer,

  -- Linking
  parent_audit_id uuid references public.agent_audit(id) on delete set null,
  run_id uuid,                           -- groups all entries from a single coordinator run

  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.agent_audit enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_audit' and policyname='agent_audit_select_own') then
    create policy "agent_audit_select_own" on public.agent_audit for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_audit' and policyname='agent_audit_insert_own') then
    create policy "agent_audit_insert_own" on public.agent_audit for insert with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists agent_audit_user_id_idx on public.agent_audit(user_id);
create index if not exists agent_audit_plan_id_idx on public.agent_audit(plan_id);
create index if not exists agent_audit_run_id_idx on public.agent_audit(run_id);
create index if not exists agent_audit_created_at_idx on public.agent_audit(created_at desc);

-- 2. pre_departure_actions — Coordinator-generated tasks with deadlines and citations
create table if not exists public.pre_departure_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.relocation_plans(id) on delete cascade,

  -- Action identity
  action_key text not null,              -- e.g. 'submit-d-visa', 'open-skv-tax-account'
  title text not null,
  description text,
  category text,                         -- 'visa', 'banking', 'tax', 'housing', 'admin', 'health'

  -- Timing
  deadline date,
  estimated_minutes integer,             -- how long this task takes the user
  blocking boolean default false,        -- true = must be done before next phase

  -- Source attribution (the agency-grade requirement)
  source_url text,                       -- the official-source URL the action came from
  source_title text,
  source_excerpt text,                   -- the relevant sentence from the source

  -- Pre-fill payload (optional — may include form draft data)
  prefill jsonb default '{}'::jsonb,

  -- User state
  status text default 'pending' check (status in ('pending', 'in_progress', 'done', 'skipped', 'na')),
  completed_at timestamp with time zone,
  user_notes text,

  -- Provenance
  generated_by_agent text,
  agent_run_id uuid,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.pre_departure_actions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pre_departure_actions' and policyname='pre_departure_actions_select_own') then
    create policy "pre_departure_actions_select_own" on public.pre_departure_actions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pre_departure_actions' and policyname='pre_departure_actions_insert_own') then
    create policy "pre_departure_actions_insert_own" on public.pre_departure_actions for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pre_departure_actions' and policyname='pre_departure_actions_update_own') then
    create policy "pre_departure_actions_update_own" on public.pre_departure_actions for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pre_departure_actions' and policyname='pre_departure_actions_delete_own') then
    create policy "pre_departure_actions_delete_own" on public.pre_departure_actions for delete using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists pre_departure_actions_plan_id_idx on public.pre_departure_actions(plan_id);
create index if not exists pre_departure_actions_user_id_idx on public.pre_departure_actions(user_id);
create index if not exists pre_departure_actions_deadline_idx on public.pre_departure_actions(deadline);
create unique index if not exists pre_departure_actions_plan_key_uidx on public.pre_departure_actions(plan_id, action_key);

drop trigger if exists update_pre_departure_actions_updated_at on public.pre_departure_actions;
create trigger update_pre_departure_actions_updated_at
  before update on public.pre_departure_actions
  for each row
  execute function public.update_updated_at_column();

-- 3. guide_section_citations — official-source citations attached to guide content
create table if not exists public.guide_section_citations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.relocation_plans(id) on delete cascade,

  -- What this citation belongs to
  guide_id uuid,                         -- references public.guides(id) when guides are scoped
  section_key text not null,             -- e.g. 'visa-d-overview', 'banking-id-numbers'

  -- The citation
  source_url text not null,
  source_title text,
  source_publisher text,                 -- 'migrationsverket.se', 'skv.se', etc.
  source_excerpt text,                   -- the supporting sentence
  fetched_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Trust / freshness signals
  source_authority text check (source_authority in ('official', 'semi_official', 'expert', 'community')),
  expires_at date,                       -- when the cited info should be re-checked

  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.guide_section_citations enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='guide_section_citations' and policyname='guide_section_citations_select_own') then
    create policy "guide_section_citations_select_own" on public.guide_section_citations for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='guide_section_citations' and policyname='guide_section_citations_insert_own') then
    create policy "guide_section_citations_insert_own" on public.guide_section_citations for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='guide_section_citations' and policyname='guide_section_citations_delete_own') then
    create policy "guide_section_citations_delete_own" on public.guide_section_citations for delete using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists guide_section_citations_user_id_idx on public.guide_section_citations(user_id);
create index if not exists guide_section_citations_plan_id_idx on public.guide_section_citations(plan_id);
create index if not exists guide_section_citations_section_key_idx on public.guide_section_citations(section_key);

-- 4. agent_run_log — one row per coordinator run, with cost rollup
create table if not exists public.agent_run_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.relocation_plans(id) on delete cascade,

  -- What kicked off the run
  trigger text not null,                 -- 'profile_lock', 'user_request', 'scheduled', 'webhook'
  coordinator_name text not null,        -- 'pre-departure-coordinator', etc.

  -- Outcome
  status text not null check (status in ('running', 'succeeded', 'failed', 'cancelled')),
  error_summary text,

  -- Cost rollup (sum of all agent_audit children with this run_id)
  total_tokens_in integer default 0,
  total_tokens_out integer default 0,
  total_cost_usd numeric(10, 6) default 0,
  total_duration_ms integer default 0,
  specialist_count integer default 0,

  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  finished_at timestamp with time zone,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.agent_run_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_run_log' and policyname='agent_run_log_select_own') then
    create policy "agent_run_log_select_own" on public.agent_run_log for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_run_log' and policyname='agent_run_log_insert_own') then
    create policy "agent_run_log_insert_own" on public.agent_run_log for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_run_log' and policyname='agent_run_log_update_own') then
    create policy "agent_run_log_update_own" on public.agent_run_log for update using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists agent_run_log_user_id_idx on public.agent_run_log(user_id);
create index if not exists agent_run_log_plan_id_idx on public.agent_run_log(plan_id);
create index if not exists agent_run_log_status_idx on public.agent_run_log(status);
create index if not exists agent_run_log_started_at_idx on public.agent_run_log(started_at desc);
