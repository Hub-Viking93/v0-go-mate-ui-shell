# Backend Acceptance — Phase 4 (Guide Artifact Integrity)

**Date:** 2026-03-15
**Phase:** Phase 4 — Guide Artifact Integrity (master-audit pack)
**Gaps addressed:** B4-002, B4-003

---

## Contract Verification — PASSED

All Phase 4 contract requirements verified against localhost:3000:

| Test | Expected | Result |
|---|---|---|
| CV-1: GET /api/guides returns only is_current=true guides | Only current guides | PASS — 15 guides, all is_current=true |
| CV-2: GET /api/guides?include_archived=true returns all | Include non-current | PASS — 17 total (15 current, 2 archived) |
| CV-3: POST /api/guides (no guideId, same identity) | Update existing guide in place | PASS — updated=true, version incremented, profile_snapshot stored |
| CV-4: POST /api/guides (with guideId, same identity) | Update specific guide | PASS — updated=true, version incremented, snapshot stored |
| CV-5: POST /api/guides (with non-current guideId) | Redirect to current guide | PASS — regenerated the canonical current guide, not the non-current one |

---

## Functional Verification — PASSED

| Test | Expected | Result |
|---|---|---|
| FV-1: Profile snapshot frozen at generation | snapshot dest/purpose matches guide | PASS |
| FV-2: Guide version increments on regeneration | Version monotonically increases | PASS — v1→v2→v3→v4→v5 across tests |
| FV-3: Unique index prevents duplicate current guides | No duplicate (plan_id, dest, purpose, type) with is_current=true | PASS — 15 guides, all unique |
| FV-4: Non-current guide accessible via direct ID | GET /api/guides/{id} returns 200 | PASS — is_current=false, dest=Germany |
| FV-5: plan_version_at_generation stored | Non-null integer | PASS — plan_version_at_generation=2 |

---

## Failure Verification — PASSED

| Test | Expected | Result |
|---|---|---|
| FAIL-1: Unauthenticated GET /api/guides | 401 | PASS |
| FAIL-2: Unauthenticated POST /api/guides | 401 | PASS |
| FAIL-3: POST with non-existent planId | 404 | PASS |
| FAIL-4: POST with non-existent guideId | 404 | PASS |
| FAIL-5: POST with guide from different plan | 400 | PASS |
| FAIL-6: GET /api/guides/{id} non-existent | 404 | PASS |
| FAIL-7: DELETE non-existent guide | No crash | PASS — HTTP 200 |

---

## Bugs Discovered and Resolved

All bugs documented in `bug-phase-4.md`:

- BUG-P4-001: PostgREST schema cache not refreshed — RESOLVED
- BUG-P4-002: Migration backfill ordering — RESOLVED
- BUG-P4-003: Non-current guide regeneration identity mismatch — RESOLVED

---

## Changes Made

### Migration
- `supabase/scripts/023_guide_artifact_integrity.sql` — adds `profile_snapshot` (JSONB), `is_current` (boolean, default true), partial unique index on `(plan_id, destination, purpose, guide_type) WHERE is_current = true`, backfill to deduplicate existing guides

### API Route Changes
- `app/api/guides/route.ts` — **B4-002**: stores `profile_snapshot` on every guide generation/regeneration; refuses to silently rewrite guide identity when profile destination/purpose changes (marks old guide non-current instead). **B4-003**: GET filters to `is_current=true` by default; unique index enforces one current guide per logical identity; regeneration redirects to the canonical current guide when targeting a non-current or identity-mismatched guide.
- `app/api/profile/route.ts` — auto-generation on plan lock now includes `profile_snapshot`, `is_current`, `guide_type`, `guide_version`, `plan_version_at_generation`

---

## Declaration

**Backend Accepted**

All three verification stages passed. All discovered bugs resolved.
