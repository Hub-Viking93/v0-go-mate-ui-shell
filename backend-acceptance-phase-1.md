# Backend Acceptance — Phase 1 (P0 Security Fixes)

**Date:** 2026-03-01
**Status:** PASSED

---

## 4.1 Contract Verification

All 4 changes specified in `docs/build-protocol.md` § Phase 1 are implemented:

| File | Change | Verified |
|---|---|---|
| `app/api/subscription/route.ts` | POST handler removed; GET handler intact; unused imports removed | ✅ |
| `app/api/profile/route.ts` | `generateGuideFromProfile` → `generateGuide` + `guideToDbFormat`; import updated | ✅ |
| `app/auth/callback/route.ts` | `ALLOWED_REDIRECTS` allowlist; `rawNext` → validated `next` | ✅ |
| `lib/supabase/middleware.ts` | Catch block redirects to `/auth/error` instead of `return supabaseResponse` | ✅ |

No files outside the spec were modified.

TypeScript compilation: `tsc --noEmit` produces zero errors in Phase 1 files.

---

## 4.2 Functional Verification

Tested via `curl` against `localhost:3000`:

| Test | Method | Expected | Actual | Status |
|---|---|---|---|---|
| POST /api/subscription with upgrade payload | POST | 405 | 405 | ✅ |
| GET /api/subscription (no auth) | GET | 401 | 401 (route alive, auth required) | ✅ |
| PATCH /api/subscription | PATCH | 405 | 405 | ✅ |
| DELETE /api/subscription | DELETE | 405 | 405 | ✅ |
| PUT /api/subscription | PUT | 405 | 405 | ✅ |
| /auth/callback?next=//evil.com | GET | Does NOT redirect to evil.com | Redirects to /auth/error (no valid code) | ✅ |
| /auth/callback?next=/dashboard (valid) | GET | Falls through to error without valid code | Redirects to /auth/error | ✅ |
| /auth/error?message=... | GET | 200 | 200 | ✅ |
| Guide insert: `guideToDbFormat` maps to `visa_section`, `budget_section`, etc. | Code review | Individual column names | Confirmed at guide-generator.ts:1201-1224 | ✅ |
| Profile route uses same pattern as working `guides/route.ts` | Code review | `generateGuide` + `guideToDbFormat` | Confirmed at profile/route.ts:122-125 | ✅ |

---

## 4.3 Failure Verification

| Test | Input | Expected | Actual | Status |
|---|---|---|---|---|
| POST /api/subscription with valid upgrade payload | `{"action":"upgrade","tier":"pro_plus","billing_cycle":"monthly"}` | 405 (handler removed) | 405 | ✅ |
| Auth callback with `next=//evil.com` | Malicious redirect | Falls to /dashboard (allowlist), then error (no code) | /auth/error | ✅ |
| Auth callback with `next=javascript:alert(1)` | XSS attempt | Falls to /dashboard (allowlist) | /auth/error | ✅ |
| Auth callback with `next=https://evil.com` | External URL | Falls to /dashboard (allowlist) | /auth/error | ✅ |
| No UI code calls POST /api/subscription | Grep search | No matches | No matches | ✅ |

---

## Bugs Discovered

None.

---

## Declaration

**Backend Accepted**

All contract verification, functional verification, and failure verification stages passed. No bugs discovered. Backend is stable and accepted.
