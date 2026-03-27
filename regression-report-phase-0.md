# Regression Report — Phase 0: Core State Authority

**Executed:** 2026-03-14
**Phase:** 0 — Core State Authority
**Files reviewed:** profile/plans/progress state surfaces, dashboard/chat profile writers, plan helper layer
**User Acceptance:** Passed on 2026-03-14 with no reported user bugs

## 1. Regression Scope

Phase 0 changes in this session were limited to:

- adding shared state authority in `lib/gomate/core-state.ts`
- normalizing `GET` / `PATCH` behavior in `app/api/profile/route.ts`
- normalizing `GET /api/progress`
- normalizing `GET /api/plans` and hardening create/switch paths
- requiring version conflict protection on active profile-state writes
- updating dashboard/chat callers to match the new write contract
- neutralizing the dead/non-authoritative parts of `lib/gomate/plan-factory.ts`

Reviewed adjacent surfaces:

- dashboard lock/unlock
- dashboard savings update
- chat savings update
- plan creation / plan switching
- progress surface
- original current-plan restoration after testing

## 2. Regression Verification

| Surface | Verification | Status |
|---|---|---|
| Existing unlocked current plan read | live `GET /api/profile` returned normalized `stage='collecting'` instead of leaking contradictory generation state | SAFE |
| Plan creation | live `POST /api/plans` returned `200` and created a current test plan | SAFE |
| Lock guard | live incomplete `PATCH /api/profile` lock attempt returned `409` with readiness context | SAFE |
| Complete-profile write | live `PATCH /api/profile` returned `200`, incremented version, and surfaced `lifecycle='ready_to_lock'` | SAFE |
| Locked transition | live `PATCH /api/profile` lock returned `200`, `locked=true`, `stage='complete'`, `lifecycle='locked'` | SAFE |
| Locked-edit protection | live post-lock profile write returned `403` | SAFE |
| Progress contract | live `GET /api/progress` matched the normalized authority model and exposed confirmation/readiness data | SAFE |
| Plans list contract | live `GET /api/plans` returned the locked test plan with `stage='complete'` and `lifecycle='locked'` after the final fix | SAFE |
| Current-plan restoration | live `PATCH /api/plans` restored the original current plan, and follow-up `GET /api/profile` confirmed it | SAFE |

## 3. Open Verification Blockers

- `pnpm tsc --noEmit` still fails due repository-wide baseline errors outside the Phase 0 scope
- canonical `user.current_plan_id` authority does not exist yet; Phase 0 narrowed this through one shared `is_current`-based contract rather than fully replacing the schema model

## 4. Regression Outcome

No regression remained in the targeted Phase 0 runtime surfaces after the final audit-patch-retest loop.

Regression Gate is passed for the scoped Phase 0 runtime surfaces.

Remaining project-level blocker outside the scoped regression run:

- `pnpm tsc --noEmit` still fails on the existing repo-wide baseline
