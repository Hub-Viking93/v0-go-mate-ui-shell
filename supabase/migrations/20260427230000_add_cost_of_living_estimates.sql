-- Cost-of-living estimates cache.
--
-- Stores LLM-generated typical costs per (city, country) so we don't repeat
-- the same expensive call for every user looking at the same destination.
-- Replaces the wrong "1200 placeholder in the local currency" generic
-- fallback in lib/gomate/numbeo-scraper.ts (audit bug B13).

create table if not exists cost_of_living_estimates (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  country text not null,
  currency text not null,
  data jsonb not null,
  source text not null default 'llm-estimate',
  generated_at timestamptz not null default now()
  -- Staleness (>= 90 days) is computed application-side in
  -- lib/gomate/cost-of-living-estimator.ts. We avoid a GENERATED column
  -- here because timestamptz arithmetic isn't immutable in Postgres.
);

create unique index if not exists cost_of_living_estimates_city_country_idx
  on cost_of_living_estimates (lower(city), lower(country));

create index if not exists cost_of_living_estimates_country_idx
  on cost_of_living_estimates (lower(country));

-- The estimator is a backend-only feature; the table is never user-scoped
-- (these are global per-destination caches), so RLS is configured for read
-- access only via the service role.
alter table cost_of_living_estimates enable row level security;

drop policy if exists "service role can read estimates" on cost_of_living_estimates;
create policy "service role can read estimates"
  on cost_of_living_estimates
  for select
  using (auth.role() = 'service_role' or auth.role() = 'authenticated');

drop policy if exists "service role can write estimates" on cost_of_living_estimates;
create policy "service role can write estimates"
  on cost_of_living_estimates
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
