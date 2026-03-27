# Frontend Wiring Report — Phase 4 (Guide Artifact Integrity)

**Date:** 2026-03-15
**Phase:** Phase 4 — Guide Artifact Integrity (master-audit pack)

---

## Frontend Coverage Audit Applied

`frontend-coverage-audit.md` was consulted as the primary wiring authority.

---

## Wiring Status

### Guide List Page (`app/(app)/guides/page.tsx`)

- Calls `GET /api/guides` without `include_archived` — correctly shows only current guides
- Generate button sends `POST /api/guides` with `{}` — uses current plan, creates/updates guide with snapshot
- No changes needed — existing wiring is compatible with Phase 4 backend changes

### Guide Detail Page (`app/(app)/guides/[id]/page.tsx`)

- **Updated:** Added `is_current` and `profile_snapshot` to the Guide TypeScript interface
- Regenerate button sends `POST /api/guides` with `{ planId, guideId }` — triggers snapshot-bound regeneration
- Staleness banner already renders for `is_stale=true` guides, including the new `identity_superseded` stale_reason
- Non-current guides remain accessible via direct URL (GET /api/guides/{id} returns them regardless of is_current)
- No additional UI changes needed — existing staleness UI covers the new identity-change case

### Guide PDF Export

- No changes needed — PDF generation reads from the guide row, which now includes `profile_snapshot` but doesn't reference it

---

## Verification

- Functional: Guide list shows only current guides (verified via API tests)
- Functional: Regeneration stores profile snapshot and maintains guide identity (verified via API tests)
- Failure: Non-current guides remain viewable via direct URL (verified HTTP 200)
- End-to-end: Frontend → API → DB flow tested across all CRUD operations

---

## Declaration

**Frontend Wired and Verified**

All UI controls are wired to correct backend endpoints. Functional and failure verification passed. Frontend and backend operate correctly as a unified system.
