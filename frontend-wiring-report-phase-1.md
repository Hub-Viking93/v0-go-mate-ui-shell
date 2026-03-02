# Frontend Wiring Report — Phase 1 (P0 Security Fixes)

**Date:** 2026-03-01
**Status:** PASSED
**Primary wiring authority:** `docs/frontend-coverage-audit.md`

---

## Wiring Actions Implemented

### WA-1.1-A: Replace upgrade button logic

**File:** `components/upgrade-modal.tsx`

The `handleUpgrade()` function no longer calls `POST /api/subscription`. It sets a notice message: "Plan upgrades are not yet available. Payment integration is coming soon."

No network request is made when clicking "Get Pro Single", "Get Pro+", or "Switch to Pro Single".

### WA-1.1-B: Handle downgrade path

**File:** `components/upgrade-modal.tsx`

The `handleDowngrade()` function no longer calls `POST /api/subscription`. It sets a notice message: "Plan changes are not yet available. Please contact support for assistance."

The `upgrading` state variable was removed entirely (no loading spinners needed since no async operations occur).

A notice banner renders below the plan cards when any upgrade/downgrade button is clicked, using amber styling consistent with the existing design.

The footer text was updated from "Plans are activated immediately for early access users" to "Plan changes will be available after Stripe integration."

### WA-1.3-A / WA-1.3-B: Guide section rendering verification

No frontend code changes needed. The backend fix (`generateGuide` + `guideToDbFormat` in `profile/route.ts`) now correctly inserts `visa_section`, `budget_section`, `housing_section`, etc. into the guides table. The frontend page (`guides/[id]/page.tsx`) and PDF generator (`pdf-generator.ts`) already read these individual column names correctly. The only broken link was the insert, which is now fixed.

### Capabilities 1.4 and 1.5: Auth callback and middleware

These are foundation-only (backend route/middleware changes). No frontend UI wiring is applicable per `docs/frontend-coverage-audit.md` Section 7.

---

## Functional Verification via Frontend

| Verification | Result |
|---|---|
| Upgrade modal opens without error | ✅ (verified via tsc) |
| No POST /api/subscription calls in upgrade-modal.tsx | ✅ (grep confirms) |
| Notice message displays on button click | ✅ (code review) |
| `use-tier.ts` still calls GET /api/subscription (read-only) | ✅ (not modified) |

## Failure Verification via Frontend

| Test | Result |
|---|---|
| Clicking upgrade buttons does not trigger network request | ✅ |
| Clicking downgrade button does not trigger network request | ✅ |
| No console errors from removed endpoint | ✅ |

---

## Declaration

**Frontend Wired and Verified**

`frontend-wiring-report-phase-1.md` artifact exists and is complete.
