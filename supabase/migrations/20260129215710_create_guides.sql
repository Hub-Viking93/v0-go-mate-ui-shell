-- Create guides table for storing user-generated relocation guides
create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.relocation_plans(id) on delete set null,
  
  -- Guide metadata
  title text not null,
  destination text not null,
  destination_city text,
  purpose text, -- study, work, settle, digital_nomad
  
  -- Guide content sections (stored as JSONB for flexibility)
  overview jsonb default '{}'::jsonb,
  visa_section jsonb default '{}'::jsonb,
  budget_section jsonb default '{}'::jsonb,
  housing_section jsonb default '{}'::jsonb,
  banking_section jsonb default '{}'::jsonb,
  healthcare_section jsonb default '{}'::jsonb,
  culture_section jsonb default '{}'::jsonb,
  jobs_section jsonb default '{}'::jsonb,
  education_section jsonb default '{}'::jsonb,
  timeline_section jsonb default '{}'::jsonb,
  checklist_section jsonb default '{}'::jsonb,
  
  -- Additional resources
  official_links jsonb default '[]'::jsonb,
  useful_tips jsonb default '[]'::jsonb,
  
  -- Status
  status text default 'draft' check (status in ('draft', 'generating', 'complete', 'archived')),
  
  -- Timestamps
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone
);

-- Enable RLS
alter table public.guides enable row level security;

-- Create RLS policies
create policy "Users can view their own guides"
  on public.guides for select
  using (auth.uid() = user_id);

create policy "Users can create their own guides"
  on public.guides for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own guides"
  on public.guides for update
  using (auth.uid() = user_id);

create policy "Users can delete their own guides"
  on public.guides for delete
  using (auth.uid() = user_id);

-- Create index for faster queries
create index if not exists guides_user_id_idx on public.guides(user_id);
create index if not exists guides_plan_id_idx on public.guides(plan_id);
create index if not exists guides_destination_idx on public.guides(destination);
