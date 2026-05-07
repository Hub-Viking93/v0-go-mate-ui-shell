-- Phase 2A — basic document vault.
--
-- Adds:
--   • relocation_documents table — metadata for each user-uploaded file
--     (the actual binary lives in the relocation-documents storage bucket
--     and is referenced via storage_path).
--   • relocation-documents private storage bucket.
--   • RLS so each user can only see + manage their own files (DB rows
--     and storage objects alike).
--   • A `linked_task_keys text[]` column ready for Phase 2B task linkage.
--
-- Idempotent. Safe to re-run.

-- ---- Table -----------------------------------------------------------------

create table if not exists public.relocation_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.relocation_plans(id) on delete cascade,

  -- File metadata (what + where).
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,

  -- Categorisation surfaces in the UI.
  category text not null default 'other'
    check (category in (
      'passport_id',
      'visa_permit',
      'education',
      'employment',
      'financial',
      'housing',
      'civil',
      'health_insurance',
      'pet',
      'other'
    )),

  -- Optional free-form note attached to the document.
  notes text,

  -- Phase 2B handle: which task keys reference this document.
  -- Empty for Phase 2A; populated when task↔document linkage lands.
  linked_task_keys text[] not null default '{}',

  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists relocation_documents_user_idx
  on public.relocation_documents (user_id);
create index if not exists relocation_documents_plan_idx
  on public.relocation_documents (plan_id);
create index if not exists relocation_documents_category_idx
  on public.relocation_documents (user_id, category);

-- ---- Row-level security ---------------------------------------------------

alter table public.relocation_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'relocation_documents'
      and policyname = 'relocation_documents_select_own'
  ) then
    create policy relocation_documents_select_own
      on public.relocation_documents
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'relocation_documents'
      and policyname = 'relocation_documents_insert_own'
  ) then
    create policy relocation_documents_insert_own
      on public.relocation_documents
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'relocation_documents'
      and policyname = 'relocation_documents_update_own'
  ) then
    create policy relocation_documents_update_own
      on public.relocation_documents
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'relocation_documents'
      and policyname = 'relocation_documents_delete_own'
  ) then
    create policy relocation_documents_delete_own
      on public.relocation_documents
      for delete
      using (auth.uid() = user_id);
  end if;
end$$;

-- ---- Storage bucket -------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('relocation-documents', 'relocation-documents', false)
on conflict (id) do nothing;

-- Storage RLS — files live under the path "{user_id}/{plan_id}/{uuid}-{filename}".
-- Owner-only access enforced by matching the first path segment to auth.uid().

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'relocation_documents_objects_select_own'
  ) then
    create policy relocation_documents_objects_select_own
      on storage.objects
      for select
      using (
        bucket_id = 'relocation-documents'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'relocation_documents_objects_insert_own'
  ) then
    create policy relocation_documents_objects_insert_own
      on storage.objects
      for insert
      with check (
        bucket_id = 'relocation-documents'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'relocation_documents_objects_delete_own'
  ) then
    create policy relocation_documents_objects_delete_own
      on storage.objects
      for delete
      using (
        bucket_id = 'relocation-documents'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end$$;
