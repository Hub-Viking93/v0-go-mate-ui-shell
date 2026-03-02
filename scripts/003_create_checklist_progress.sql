-- Create checklist_progress table for tracking user checklist completion
create table if not exists public.checklist_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.relocation_plans(id) on delete cascade,
  
  -- Checklist item identifier
  item_id text not null,
  
  -- Status
  completed boolean default false,
  completed_at timestamp with time zone,
  
  -- Optional notes
  notes text,
  
  -- Timestamps
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Unique constraint per user/plan/item combination
  unique(user_id, plan_id, item_id)
);

-- Enable RLS
alter table public.checklist_progress enable row level security;

-- RLS policies for checklist_progress
create policy "checklist_select_own" on public.checklist_progress 
  for select using (auth.uid() = user_id);
create policy "checklist_insert_own" on public.checklist_progress 
  for insert with check (auth.uid() = user_id);
create policy "checklist_update_own" on public.checklist_progress 
  for update using (auth.uid() = user_id);
create policy "checklist_delete_own" on public.checklist_progress 
  for delete using (auth.uid() = user_id);

-- Create indexes for faster queries
create index if not exists checklist_progress_user_id_idx on public.checklist_progress(user_id);
create index if not exists checklist_progress_plan_id_idx on public.checklist_progress(plan_id);

-- Add updated_at trigger
drop trigger if exists update_checklist_progress_updated_at on public.checklist_progress;
create trigger update_checklist_progress_updated_at
  before update on public.checklist_progress
  for each row
  execute function public.update_updated_at_column();
