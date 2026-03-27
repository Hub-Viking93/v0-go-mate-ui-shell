# Frontend Wiring Report — Phase 0: Core State Authority

**Executed:** 2026-03-14
**Phase:** 0 — Core State Authority
**Authority:** `docs/frontend-coverage-audit.md` was used as the primary wiring authority for this review.

## 1. Applicable Frontend Surface

Phase 0 is mostly backend/state-contract work, but it changes active frontend-facing contracts on existing surfaces.

Verified callers:

| File | Flow | Expected contract after Phase 0 | Result |
|---|---|---|---|
| `app/(app)/dashboard/page.tsx` | `PATCH /api/profile` lock/unlock | must send `expectedVersion`; receives normalized `plan.stage` and `plan.lifecycle` | updated and verified |
| `app/(app)/dashboard/page.tsx` | savings update via `PATCH /api/profile` | must send `expectedVersion`; response plan replaces optimistic state | updated and verified |
| `app/(app)/chat/page.tsx` | savings update via `PATCH /api/profile` | must send `expectedVersion`; response updates local profile and version | updated and verified |
| `app/(app)/chat/page.tsx` | `GET /api/profile` bootstrap | receives normalized `stage` from the server-owned authority model | remains compatible |
| `components/plan-switcher` via `/api/plans` | plan list display | list entries still expose `stage`, now normalized, with additive `lifecycle` | remains compatible |

## 2. Wiring Verification

| Requirement | Verification | Status |
|---|---|---|
| Existing callers must keep using `/api/profile` | no frontend route or control was redirected to a new endpoint | PASS |
| Lock/unlock callers must comply with mandatory conflict contract | dashboard lock/unlock writes now send `expectedVersion: plan.plan_version` | PASS |
| Savings writes must comply with mandatory conflict contract | dashboard and chat savings writes now send `expectedVersion` and consume returned plan/version state | PASS |
| Added lifecycle/readiness fields must remain backward-compatible | `GET /api/profile`, `GET /api/progress`, and `GET /api/plans` keep existing fields and only add normalized authority fields | PASS |
| Plans list must reflect normalized state | `GET /api/plans` now includes `locked` in the select path so derived `stage/lifecycle` are correct for locked rows | PASS |

## 3. Runtime Verification

Frontend-adjacent runtime verification was executed against `http://127.0.0.1:3000` through the same routes the UI consumes.

Verified results:

- `GET /api/profile` returned normalized `stage="collecting"` plus additive `lifecycle` and `readiness`
- `POST /api/plans` created a dedicated runtime test plan and made it current through the active UI-facing plan endpoint
- `PATCH /api/profile` without `expectedVersion` returned `409`, matching the new dashboard/chat write contract
- `PATCH /api/profile` with a full profile payload returned `200`, `stage="collecting"`, and `lifecycle="ready_to_lock"`
- `PATCH /api/profile` lock returned `200`, `stage="complete"`, and `lifecycle="locked"`
- `GET /api/plans` returned the locked test plan as `stage="complete"` and `lifecycle="locked"`
- original current-plan state was restored through the same `/api/plans` switch endpoint consumed by the plan-switcher flow

## 4. Wiring Outcome

Phase 0 required small frontend wiring changes, not new UI creation.

Frontend and backend are aligned for the scoped Phase 0 surfaces:

- dashboard and chat now participate in mandatory version conflict protection
- existing readers consume normalized server-owned state rather than trusting raw drifted stage values
- the plan list surface now exposes lifecycle-consistent entries for locked plans

User acceptance is still required using `PHASE_0_USER_TEST.md`.
