-- Migration 024: Destination hero images for guides
-- Creates destination_images table (shared image cache) and adds hero image columns to guides

-- destination_images: shared image asset cache keyed by (country, city)
create table if not exists public.destination_images (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  city text,  -- NULL for country-level images
  storage_path text not null,  -- e.g. "portugal/lisbon.jpg"
  storage_url text not null,   -- full public URL from Supabase Storage
  unsplash_photo_id text,
  photographer_name text,
  photographer_url text,
  width integer,
  height integer,
  blur_hash text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Unique: one image per (country, city) pair (case-insensitive)
create unique index if not exists idx_destination_images_lookup
  on public.destination_images (lower(country), lower(coalesce(city, '')));

-- RLS: authenticated users can read, writes via service role only
alter table public.destination_images enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view destination images'
  ) THEN
    CREATE POLICY "Authenticated users can view destination images"
      ON public.destination_images FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END
$$;

-- Add hero image columns to guides
alter table public.guides
  add column if not exists hero_image_id uuid references public.destination_images(id) on delete set null;
alter table public.guides
  add column if not exists hero_image_url text;
alter table public.guides
  add column if not exists hero_image_attribution jsonb;

-- Create destination-images storage bucket (public, max 5MB, image types only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('destination-images', 'destination-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
