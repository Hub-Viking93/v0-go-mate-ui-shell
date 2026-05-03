-- =============================================================
-- v2 Wave 2.1 — rollback of profile_data patch RPC
-- =============================================================

drop function if exists public.apply_profile_field_patch(uuid, jsonb);
