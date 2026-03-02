# Regression Report — Phase 1 (P0 Security Fixes)

**Date:** 2026-03-01
**Status:** PASSED — Regression Safe

---

## Phase 0 Regression (Schema Integrity)

Phase 0 was schema-only (migrations 011/012/013). No code changes were made in Phase 0, so no code regressions are possible. The schema columns added in Phase 0 are unaffected by Phase 1 changes.

---

## Phase 1 Regression (P0 Security Fixes)

### API Route Health

| Route | Method | Expected | Actual | Status |
|---|---|---|---|---|
| `/api/subscription` | GET | 401 (no auth) | 401 | ✅ |
| `/api/subscription` | POST | 405 (removed) | 405 | ✅ |
| `/api/profile` | GET | 401 (no auth) | 401 | ✅ |
| `/api/guides` | GET | 401 (no auth) | 401 | ✅ |
| `/api/chat` | GET | 405 (POST only) | 405 | ✅ |

### Auth Flow Health

| Test | Expected | Actual | Status |
|---|---|---|---|
| `/auth/error?message=test` | 200 | 200 | ✅ |
| `/auth/callback?next=//evil.com` | Redirect to `/auth/error` (not evil.com) | `/auth/error` | ✅ |
| Root `/` unauthenticated | 307 redirect | 307 | ✅ |

### User Acceptance (All Tests)

| Test | Result |
|---|---|
| Test 1: GET /api/subscription returns data | ✅ PASSED |
| Test 2: Guide sections render correctly | ✅ PASSED (after params.id → use(params) fix) |
| Test 3: Upgrade modal shows notice | ✅ PASSED |
| Test 4: Downgrade shows notice | ✅ PASSED |
| Negative Test 1: POST /api/subscription → 405 | ✅ PASSED |
| Negative Test 2: Malicious redirect blocked | ✅ PASSED |
| Negative Test 3: JavaScript URL blocked | ✅ PASSED |
| Negative Test 4: All non-GET methods → 405 | ✅ PASSED |

### Bug Fix During Phase 1

One bug was discovered and fixed during User Acceptance:

- **`app/(app)/guides/[id]/page.tsx`**: `params.id` accessed synchronously. Next.js 16 requires `params` to be unwrapped with `React.use()`. Fixed by changing type to `Promise<{ id: string }>` and destructuring with `use(params)`.

This was a pre-existing latent bug (not introduced by Phase 1 changes) that surfaced when the guide page was tested with real data for the first time.

---

## Declaration

**Regression Safe**

All phases from Phase 0 through Phase 1 were tested. All regression tests passed. No regressions were found. System is declared regression-safe.
