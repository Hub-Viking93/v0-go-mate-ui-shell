-- Reverse Phase 2A document vault.
-- Storage bucket is intentionally left in place to avoid orphaning
-- existing files; drop it manually if you really mean to delete them.

drop policy if exists relocation_documents_objects_delete_own on storage.objects;
drop policy if exists relocation_documents_objects_insert_own on storage.objects;
drop policy if exists relocation_documents_objects_select_own on storage.objects;

drop table if exists public.relocation_documents cascade;
