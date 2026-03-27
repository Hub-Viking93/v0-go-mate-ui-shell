# Backend Acceptance — Phase 0: Core State Authority

**Executed:** 2026-03-14
**Phase:** 0 — Core State Authority
**Master gaps:** B1-001, B1-003, B1-004, B1-006, B1-011, B1-013
**Primary files:** `app/api/profile/route.ts`, `app/api/plans/route.ts`, `app/api/progress/route.ts`, `app/api/cost-of-living/route.ts`, `lib/gomate/core-state.ts`, `lib/gomate/plan-factory.ts`, `lib/gomate/supabase-utils.ts`
**Verification mode:** local runtime verification against `http://127.0.0.1:3000`, live Supabase-backed auth session, plus targeted static/TypeScript checks

## 1. Contract Verification

| Requirement | Verification | Status |
|---|---|---|
| Current-plan lookup must use one shared contract | `app/api/profile/route.ts`, `app/api/progress/route.ts`, and current profile/state writes now use `getOwnedPlan()` from `lib/gomate/core-state.ts` | PASS |
| Lifecycle/state derivation must be server-owned | `derivePlanAuthority()` now computes `stage`, `lifecycle`, `readiness`, `canEditProfile`, and `canLock` in one place | PASS |
| User-facing profile writes must require conflict protection | `PATCH /api/profile` and `POST /api/cost-of-living` now reject missing or stale `expectedVersion` with `409` | PASS |
| Lock must be a validated transition | `PATCH /api/profile` now rejects `action="lock"` unless `readiness.isReadyForLock === true` | PASS |
| Contradictory `stage="generating"` state must be normalized away | profile/progress/plans responses now normalize unlocked plans to `stage="collecting"` and locked plans to `stage="complete"` | PASS |
| Dead/non-authoritative plan-switch helpers must be neutralized | `lib/gomate/plan-factory.ts` no longer auto-promotes latest plans or performs ad hoc switch logic; switching is routed through the shared helper | PASS |
| Progress/readiness must distinguish more than “non-empty” | `lib/gomate/progress.ts` now exposes `confirmed`, `confirmedPercentage`, and `readyToLock`; readiness excludes `assumed` values from lock authority | PASS |

## 2. Functional Verification

Runtime verification was executed on 2026-03-14 against `http://127.0.0.1:3000` with the configured `.env.local` test account. The original current plan was restored after the run.

| Flow | Expected behavior | Verification | Status |
|---|---|---|---|
| Unauthenticated profile mutation | rejected safely | unauthenticated `PATCH /api/profile` returned `401` | PASS |
| Existing inconsistent plan read | normalized current-state response | authenticated `GET /api/profile` returned `stage="collecting"` and `lifecycle="collecting"` for the pre-existing unlocked plan | PASS |
| Create dedicated test plan | plan becomes current through active plan API path | `POST /api/plans` returned `200` and created `0b30ef15-4192-4f26-a756-37584df07ef8` with `stage="collecting"` and `lifecycle="collecting"` | PASS |
| Missing conflict token | rejected | `PATCH /api/profile` without `expectedVersion` returned `409` | PASS |
| Incomplete lock attempt | rejected with readiness evidence | `PATCH /api/profile` with `action="lock"` on the empty test plan returned `409` and `readiness.isReadyForLock=false` | PASS |
| Complete profile write | profile updates, version increments, stage stays coherent | `PATCH /api/profile` with the full work-profile payload returned `200`, `stage="collecting"`, `lifecycle="ready_to_lock"`, `plan_version=2`, `readiness.isReadyForLock=true` | PASS |
| Stale write attempt | rejected | replaying the old version after the successful save returned `409` | PASS |
| Valid lock transition | plan locks only after ready state | `PATCH /api/profile` with `action="lock"` and `expectedVersion=2` returned `200`, `stage="complete"`, `lifecycle="locked"`, `locked=true`, `plan_version=3`, `onboarding_completed=true` | PASS |
| Locked profile edit | rejected | post-lock `PATCH /api/profile` returned `403` | PASS |
| Progress surface | reflects the same normalized authority model | `GET /api/progress?plan_id=<test-plan>` returned `stage="complete"`, `lifecycle="locked"`, `interview_progress.readyToLock=true`, `interview_progress.confirmed=18` | PASS |
| Plans list surface | reflects the same normalized authority model | `GET /api/plans` returned the locked test plan as `stage="complete"` and `lifecycle="locked"` | PASS |
| Restore original current plan | user state restored after test run | `PATCH /api/plans` with `action="switch"` restored current plan `614e8c86-a98f-479a-a031-5ad88c809073`, then `GET /api/profile` confirmed it | PASS |

## 3. Failure Verification

| Failure case | Expected behavior | Verification | Status |
|---|---|---|---|
| Unauthorized mutation | `401` and no state change | verified live against `PATCH /api/profile` | PASS |
| Missing `expectedVersion` | `409` with current version | verified live against `PATCH /api/profile` | PASS |
| Stale `expectedVersion` | `409` with current version | verified live against `PATCH /api/profile` after the successful save | PASS |
| Invalid lock transition | `409` with readiness context | verified live against incomplete lock attempt | PASS |
| Locked-plan edit | `403` and no state change | verified live against locked test plan | PASS |
| Missing plan id / unknown owned plan | still guarded by owned-plan lookup | route-level owned-plan lookup remains in place through `getOwnedPlan()` | PASS |

## 4. Bugs Documented During Backend Acceptance

See `bug-phase-0.md`.

- `PHASE0-RUNTIME-001` — fixed in this session
- `PHASE0-RUNTIME-002` — fixed in this session
- `PHASE0-VERIFY-003` — open repo-wide TypeScript baseline

## 5. TypeScript Verification

`pnpm tsc --noEmit` was executed on 2026-03-14 and still failed repo-wide on pre-existing baseline errors outside the intended Phase 0 scope.

Representative baseline failures from the run:

- `app/(app)/booking/page.tsx`: `source` not in `BookingResult`
- `app/(app)/chat/page.tsx`: `ChatMessageContentProps` missing `isStreaming`
- `app/(app)/dashboard/page.tsx`: stale fields like `sub_purpose` / `partner_coming`
- `app/api/chat/route.ts`: legacy profile-field typing drift

Phase-specific note:

- a targeted filter run over the Phase 0-touched server files produced no matches:
  - `app/api/profile/route.ts`
  - `app/api/plans/route.ts`
  - `app/api/progress/route.ts`
  - `app/api/cost-of-living/route.ts`
  - `lib/gomate/core-state.ts`
  - `lib/gomate/progress.ts`
  - `lib/gomate/plan-factory.ts`
  - `lib/gomate/supabase-utils.ts`

## 6. Gap Resolution Summary

| Gap | Result in Phase 0 |
|---|---|
| B1-001 | narrowed: current-plan authority is still `is_current`, but it now resolves through one shared contract instead of scattered helpers |
| B1-003 | narrowed: lifecycle is still derived from existing columns, but derivation is now centralized and shared |
| B1-004 | resolved at v1 scope: lock/unlock are now explicit validated transitions instead of loose boolean writes |
| B1-006 | narrowed: readiness now distinguishes `assumed` values from confirmed-enough values; full canonical confirmation modeling remains future work |
| B1-011 | resolved at v1 scope: active user-facing profile writes now require conflict protection |
| B1-013 | resolved at v1 scope: unlocked incomplete plans no longer surface as `stage="generating"` through the Phase 0 core surfaces |

## 7. Backend Acceptance Outcome

Backend Acceptance Gate is passed for the scoped Phase 0 contract.

Phase 0 backend is accepted for:

- centralized current-plan lookup and lifecycle derivation
- validated lock/readiness transitions
- mandatory version-based conflict protection on active profile-state writes
- normalized stage integrity across profile, progress, and plans surfaces

Full project-level phase closure is still pending:

- repo-wide `pnpm tsc --noEmit`
- user-side execution of `PHASE_0_USER_TEST.md`
