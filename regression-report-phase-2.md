# Regression Report — Phase 2 (Settling-In Stage Integrity)

**Date:** 2026-03-01
**Status:** PASSED — Zero regressions

---

## Phase 1 Regression Suite

| Test | Method | URL | Expected | Actual | Status |
|---|---|---|---|---|---|
| POST /api/subscription removed | POST | /api/subscription | 405 | 405 | ✅ |
| GET /api/subscription (authed) | GET | /api/subscription | 200 with tier data | 200, tier:"pro_plus" | ✅ |
| Auth callback open redirect | GET | /auth/callback?next=//evil.com | Redirect to /auth/error | location: /auth/error | ✅ |
| /auth/error page loads | GET | /auth/error | 200 | 200 | ✅ |

---

## Phase 2 Regression Suite

| Test | Method | URL | Expected | Actual | Status |
|---|---|---|---|---|---|
| GET settling-in (pre-arrival) | GET | /api/settling-in | `{tasks:[],stage,arrivalDate:null}` | `{"tasks":[],"stage":"collecting","arrivalDate":null}` | ✅ |
| POST generate (pre-arrival) | POST | /api/settling-in/generate | 400 + stage error | 400 + "Settling-in features require arrival confirmation" | ✅ |
| GET profile (authed) | GET | /api/profile | 200 with plan data | 200, stage:"collecting" | ✅ |
| GET guides (authed) | GET | /api/guides | 200 | 200 | ✅ |

---

## DAG Validator Unit Tests

| Test | Input | Expected | Actual | Status |
|---|---|---|---|---|
| Simple cycle (a↔b) | `[{a→b},{b→a}]` | `false` | `false` | ✅ |
| Valid chain (a→b) | `[{a→[]},{b→[a]}]` | `true` | `true` | ✅ |
| Empty graph | `[]` | `true` | `true` | ✅ |
| Self-cycle | `[{x→x}]` | `false` | `false` | ✅ |
| Diamond DAG | 4 nodes | `true` | `true` | ✅ |
| 3-node indirect cycle | `a→c→b→a` | `false` | `false` | ✅ |

---

## Declaration

**Zero regressions detected.** All Phase 1 and Phase 2 test suites pass with authenticated runtime verification against localhost:3000.
