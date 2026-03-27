# Bug Log — Phase 0: Core State Authority

**Executed:** 2026-03-14

## PHASE0-RUNTIME-001

- Severity: Medium
- Status: Fixed
- Area: `app/api/plans/route.ts`, `lib/gomate/core-state.ts`
- Summary: the first live Phase 0 run failed on `POST /api/plans` because the route depended solely on `switch_current_plan`, and the current local environment did not complete that RPC path reliably during plan creation
- Expected: creating a new plan through the active API path must complete successfully and make the new row current
- Actual: the first localhost run returned `500 {"error":"Failed to activate new plan"}`
- Fix: current-plan switching now goes through one shared helper in `lib/gomate/core-state.ts` that attempts the RPC first and uses a controlled fallback inside the same authority layer if the RPC path fails

## PHASE0-RUNTIME-002

- Severity: Medium
- Status: Fixed
- Area: `app/api/plans/route.ts`
- Summary: `/api/plans` initially derived lifecycle incorrectly for locked plans because the list query did not select `locked`
- Expected: locked plans in the plans list should surface as `stage="complete"` and `lifecycle="locked"`
- Actual: the first post-lock localhost verification returned the locked test plan as `stage="collecting"` and `lifecycle="ready_to_lock"` in the plans list
- Fix: the plans list select path now includes `locked`, allowing the shared derivation contract to produce the correct normalized state

## PHASE0-VERIFY-003

- Severity: Medium
- Status: Open
- Area: repository-wide verification
- Summary: `pnpm tsc --noEmit` still fails with broad pre-existing schema/type drift outside the Phase 0 scope
- Expected: repo-wide TypeScript verification passes before the entire repository is considered compile-clean
- Actual: the command still fails across unrelated booking, chat, dashboard, guide, checklist, and legacy profile-typing files
- Blocking impact: full repo-level compile gate remains pending even though the Phase 0-touched server files passed a targeted TypeScript filter

## Runtime Verification Summary

- 2026-03-14 localhost run passed for:
  - unauthenticated `PATCH /api/profile` -> `401`
  - authenticated `GET /api/profile` -> normalized `stage="collecting"`, `lifecycle="collecting"`
  - `POST /api/plans` -> `200`, created current test plan
  - `PATCH /api/profile` without `expectedVersion` -> `409`
  - incomplete `PATCH /api/profile` lock -> `409`, `readiness.isReadyForLock=false`
  - complete `PATCH /api/profile` -> `200`, `stage="collecting"`, `lifecycle="ready_to_lock"`, `plan_version=2`
  - stale `PATCH /api/profile` replay -> `409`
  - valid `PATCH /api/profile` lock -> `200`, `stage="complete"`, `lifecycle="locked"`, `locked=true`, `plan_version=3`, `onboarding_completed=true`
  - locked edit attempt -> `403`
  - `GET /api/progress?plan_id=<test-plan>` -> `stage="complete"`, `lifecycle="locked"`, `readyToLock=true`
  - `GET /api/plans` -> locked test plan surfaced as `stage="complete"`, `lifecycle="locked"`
  - `PATCH /api/plans` action `switch` -> original current plan restored
