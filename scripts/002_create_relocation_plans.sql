-- Drop existing table to recreate with correct schema
drop table if exists public.relocation_plans cascade;

-- Create relocation_plans table for storing user relocation data
create table public.relocation_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Profile data stored as JSONB for flexibility
  profile_data jsonb default '{}'::jsonb,
  
  -- Plan state
  stage text default 'collecting' check (stage in ('collecting', 'generating', 'complete')),
  
  -- Lock state
  locked boolean default false,
  locked_at timestamp with time zone,
  
  -- Target date for move
  target_date date,
  
  -- Generated recommendations (stored as JSONB)
  visa_recommendations jsonb default '[]'::jsonb,
  budget_plan jsonb default '{}'::jsonb,
  checklist_items jsonb default '[]'::jsonb,
  
  -- Timestamps
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.relocation_plans enable row level security;

-- RLS policies for relocation_plans
create policy "plans_select_own" on public.relocation_plans 
  for select using (auth.uid() = user_id);
create policy "plans_insert_own" on public.relocation_plans 
  for insert with check (auth.uid() = user_id);
create policy "plans_update_own" on public.relocation_plans 
  for update using (auth.uid() = user_id);
create policy "plans_delete_own" on public.relocation_plans 
  for delete using (auth.uid() = user_id);

-- Create index for faster queries
create index if not exists relocation_plans_user_id_idx on public.relocation_plans(user_id);

-- Create updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_relocation_plans_updated_at on public.relocation_plans;
create trigger update_relocation_plans_updated_at
  before update on public.relocation_plans
  for each row
  execute function public.update_updated_at_column();
