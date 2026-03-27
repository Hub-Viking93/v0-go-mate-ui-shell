-- Add guide_type column to guides table for categorizing different guide types
alter table public.guides 
add column if not exists guide_type text default 'main';

-- Add index for faster lookups by type
create index if not exists idx_guides_type on public.guides(guide_type);

-- Add index for faster lookups by user and destination
create index if not exists idx_guides_user_destination on public.guides(user_id, destination, purpose, guide_type);
