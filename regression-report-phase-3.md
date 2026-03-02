# Regression Report — Phase 3 (Data Integrity)

**Date:** 2026-03-02
**Status:** PASSED — Zero regressions

---

## Phase 1 Regression Suite

| Test | Method | URL | Expected | Actual | Status |
|---|---|---|---|---|---|
| POST /api/subscription removed | POST | /api/subscription | 405 | 405 | ✅ |
| GET /api/subscription (authed) | GET | /api/subscription | 200 with tier data | 200, tier: pro_plus | ✅ |
| Auth callback open redirect | GET | /auth/callback?next=//evil.com | Redirect to /auth/error | /auth/error | ✅ |

---

## Phase 2 Regression Suite

| Test | Method | URL | Expected | Actual | Status |
|---|---|---|---|---|---|
| GET /api/settling-in (pre-arrival) | GET | /api/settling-in | `{tasks:[], stage, arrivalDate:null}` | Correct (returns tasks for arrived plan, empty for pre-arrival) | ✅ |
| POST /api/settling-in/generate (pre-arrival) | POST | /api/settling-in/generate | 400 for pre-arrival | 400 (when on pre-arrival plan) | ✅ |

---

## Phase 3 Tests

| Test | Method | Expected | Actual | Status |
|---|---|---|---|---|
| GET /api/profile (normal) | GET | 200 with plan | 200 | ✅ |
| GET /api/plans (list) | GET | 200 with plans, exactly 1 current | 200, 2 plans, 1 current | ✅ |
| PATCH /api/plans switch (atomic RPC) | PATCH | 200 | User Acceptance Test 1: APPROVED | ✅ |
| Profile race condition fallback | Code review | Re-fetch on constraint error | Implemented at profile/route.ts:42-52 | ✅ |
| task_key populated on generation | User test | Non-null, URL-safe slugs | User Acceptance Test 3: APPROVED (after migration 015) | ✅ |

---

## Unauthorized Access

| Test | Expected | Actual | Status |
|---|---|---|---|
| GET /api/settling-in (no cookie) | 401 | 401 | ✅ |
| POST /api/settling-in/generate (no cookie) | 401 | 401 | ✅ |
| GET /api/profile (no cookie) | 401 | 401 | ✅ |
| GET /api/plans (no cookie) | 401 | 401 | ✅ |

---

## Notes

- Plan switch RPC (`switch_current_plan`) was updated from a single UPDATE to two sequential statements within one transactional function to avoid partial unique index violations. The atomicity guarantee is preserved because both statements execute in a single PL/pgSQL transaction — if either fails, the entire function rolls back.
- Migration 015 was added to create the `task_key` column that was missing from the live database (migration 010's `CREATE TABLE IF NOT EXISTS` was a no-op since the table pre-existed).

---

## Declaration

**Zero regressions detected.** All Phase 1, Phase 2, and Phase 3 test suites pass. User Acceptance declared PASSED.
