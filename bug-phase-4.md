# Phase 4 — Bug Report

## BUG-P4-001: PostgREST schema cache not refreshed after migration
- **Severity:** Medium (blocking during development, not a runtime issue)
- **Description:** After running migration 023 to add `profile_snapshot` and `is_current` columns, PostgREST's schema cache did not include the new columns, causing `PGRST204` errors on all guide update/insert operations.
- **Root cause:** The migration was applied in multiple steps due to a unique index constraint error. The first attempt rolled back entirely (including the `profile_snapshot` column addition). The follow-up SQL only added `is_current` + backfill + index, missing `profile_snapshot`.
- **Fix:** Added `profile_snapshot` column separately, then ran `NOTIFY pgrst, 'reload schema'` to refresh the PostgREST schema cache.
- **Status:** RESOLVED

## BUG-P4-002: Migration backfill must run before unique index creation
- **Severity:** High (blocks migration execution)
- **Description:** Migration 023 originally created the unique index BEFORE running the backfill that deduplicates existing rows. This caused a `23505` unique constraint violation on existing duplicate guide rows.
- **Root cause:** Incorrect ordering — the partial unique index was created before duplicate rows were demoted to `is_current=false`.
- **Fix:** Reordered migration: columns → backfill → unique index.
- **Status:** RESOLVED

## BUG-P4-003: Non-current guide regeneration with identity mismatch
- **Severity:** Medium
- **Description:** When regenerating a non-current guide whose identity (destination/purpose) matches the current profile, the code tried to set `is_current=true` on the non-current guide, which violated the unique index if another current guide with the same identity already existed.
- **Root cause:** The regeneration path didn't check whether the target guide was non-current and whether there was already a current guide for the same identity.
- **Fix:** Added logic to redirect regeneration of non-current or identity-mismatched guides to the canonical current guide for the profile's actual identity. If no current guide exists, falls through to insert.
- **Status:** RESOLVED
