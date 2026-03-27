# Batch 1 Alignment Audit — Core State and Progress

> Batch: 1
> Scope: Onboarding / Profile / Plan / Dashboard / Progress
> Authority: `docs/audits/document-authority.md`
> Method: definitions -> code/database/runtime/frontend, with system docs used as supporting evidence
> Closure Rule: audit -> patch stale docs -> re-audit -> PASS
> Final Result: PASS

---

## 1. Systems Audited

This batch audited the shared state authority layer across:

- onboarding system
- profile system
- plan system
- dashboard system
- progress tracking system
- chat interview state authority where it affects profile or plan state

Primary inputs used:

- `docs/definitions/onboarding-system.md`
- `docs/definitions/profile-system.md`
- `docs/definitions/plan-system.md`
- `docs/definitions/dashboard.md`
- `docs/definitions/progress-tracking-system.md`
- `docs/definitions/chat-interview-system-definition.md`
- `docs/systems/profile-schema.md`
- `docs/systems/interview-state-machine.md`
- `docs/systems/plans-system.md`
- `docs/systems/frontend-ui-layer.md`
- `docs/systems/end-to-end-flow.md`
- `app/api/profile/route.ts`
- `app/api/plans/route.ts`
- `app/api/progress/route.ts`
- `app/api/chat/route.ts`
- `app/(app)/dashboard/page.tsx`
- `lib/gomate/profile-schema.ts`
- `lib/gomate/state-machine.ts`
- `lib/gomate/progress.ts`
- `lib/gomate/supabase-utils.ts`
- `lib/gomate/plan-factory.ts`

---

## 2. Audit Loop Performed

### Pass 1

Mapped the canonical model against the actual runtime model.

Main result:

- Batch 1 has one dominant structural divergence: canonical state authority is designed around `user.current_plan_id` + `LifecycleState` + versioned profile state, while the real system operates on `relocation_plans.is_current` + `status/stage/locked` + mutable JSONB profile data.

### Patch Pass

Corrected stale Batch 1 documentation so the audit layer no longer described already-fixed or no-longer-true behavior.

Patched files:

- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `docs/definitions/onboarding-system.md`
- `docs/definitions/profile-system.md`
- `docs/definitions/plan-system.md`
- `docs/definitions/chat-interview-system-definition.md`
- `docs/systems/plans-system.md`

Patch themes:

- removed stale statements claiming `current_plan_id` exists in runtime
- corrected stale claims about onboarding completion timing
- corrected stale claims about non-atomic active plan switching in the live API path
- corrected stale claims about completeness checks and chat termination that are already fixed in code
- corrected field-count and concurrency notes in rebaseline sections

### Re-Audit Pass

Re-read the patched Batch 1 docs and re-scanned the code paths. No new significant Batch 1 mismatch type appeared on the second pass. Remaining in-scope mismatches are classified below and do not depend on unresolved documentation contradictions.

That satisfies the Batch 1 closure rule.

### Runtime Verification Pass

Authenticated runtime spot-checks were executed against `localhost:3000` using the configured test account from `.env.local`.

Verified endpoints:

- `GET /api/profile`
- `GET /api/progress`
- `GET /api/plans`

Observed runtime state:

- current plan returned `stage="generating"`, `locked=false`, `status="active"`, `plan_version=2`, `onboarding_completed=false`
- the same plan returned `interview_progress = 24% (4 / 17)` from `/api/progress`
- `GET /api/plans` confirmed that same plan as `is_current=true`

Meaning:

- runtime validates the audit conclusion that `stage` is not a reliable lifecycle authority by itself
- a plan can sit in `generating` while still unlocked and far from interview completion
- this is an in-scope Batch 1 mismatch and is classified below

---

## 3. Canonical Target Summary

Canonical Batch 1 target, condensed:

- current plan authority is `user.current_plan_id`, not an inferred or denormalized plan flag
- lifecycle authority is `LifecycleState`; stage is a separate UX dimension
- plan creation happens at the interview boundary, not on page load
- profile state is canonical, versionable, conflict-protected, and distinct from chat runtime state
- progress is computed only by the Progress Tracking System
- dashboard is a derived renderer of canonical backend state and must not invent state
- chat interview has explicit pre-plan and post-plan authority boundaries

---

## 4. Current Reality Summary

Actual Batch 1 runtime, condensed:

- current plan resolution is `relocation_plans.is_current`
- there is no `user.current_plan_id`
- plan lifecycle is approximated by `status`, `stage`, and `locked`
- plans are created eagerly by `/api/profile` and by profile-save bootstrap helpers
- profile data is one mutable JSONB blob on `relocation_plans`
- field confidence is embedded in `profile_data.__field_confidence`, but not treated as a first-class progress authority
- `/api/progress` exists, but required-fields authority still comes from application code and dashboard state derivation is still partly local
- dashboard uses `/api/progress`, but still mixes in local heuristics, plan flags, and ad-hoc gating
- chat interview termination on `stage="generating"`, profile save error handling, dynamic completeness, and optional optimistic concurrency are already fixed

---

## 5. Audit Questions Answered

### What is the canonical plan authority object?

Canonically it is the plan plus explicit `user.current_plan_id`, with lifecycle and stage separated.

In reality it is the `relocation_plans` row plus the denormalized `is_current` flag, with lifecycle behavior split across `status`, `stage`, and `locked`.

### What is the actual current-plan selector?

The live system resolves current plan from `relocation_plans.is_current = true`.

### Is lifecycle authority stored canonically or inferred?

It is inferred and fragmented.

- `status` handles active vs archived
- `stage` handles collecting/generating/complete/arrived
- `locked` handles profile mutability
- `onboarding_completed` acts as a separate milestone flag

There is no single canonical lifecycle field.

### Is stage being used where lifecycle should be used?

Yes.

`stage` and `locked` currently carry both UX state and operational permission semantics. That is the central lifecycle divergence in Batch 1.

### Is profile completeness computed from the canonical rules?

Partially.

- `PATCH /api/profile` now uses shared completeness logic via `isProfileComplete()`
- `/api/progress` also derives interview progress from shared required-fields logic
- but progress still does not enforce canonical confidence semantics or a DB-backed required-fields registry

### Is dashboard state truly derived from canonical backend state?

No.

The dashboard consumes `/api/progress`, but it still derives parts of state locally:

- local onboarding gate (`filledCount < 3`)
- local denominator (`getRequiredFields(profile).length`)
- direct reliance on `plan.stage`, `plan.locked`, and ad-hoc conditions instead of a canonical dashboard-state derivation function

### Is progress centralized or recomputed in multiple places?

It is still recomputed in multiple places.

- `/api/progress` centralizes some computation
- `state-machine.ts` computes interview completeness independently
- dashboard still performs local state derivation around progress

### Which state transitions are optimistic, non-atomic, stale, or duplicated?

Main cases:

- plan creation is eager and not aligned with the canonical interview boundary
- current-plan authority is duplicated into `is_current`
- lock semantics are implemented without canonical lifecycle validation
- dead helper code still contains non-atomic current-plan switching logic
- version conflicts are only enforced when callers opt in via `expectedVersion`

---

## 6. Gap Table

| ID | Domain | Canonical Requirement | Current Reality | Impact | Outcome |
|---|---|---|---|---|---|
| B1-001 | Current plan authority | `user.current_plan_id` is the sole current-plan authority | Current plan is resolved from `relocation_plans.is_current`; no user pointer exists | Current-plan resolution is denormalized and cannot express canonical pointer semantics or null-current behavior cleanly | `phase_candidate` |
| B1-002 | Pre-plan boundary | No plan exists until interview completion confirms destination | `/api/profile` and profile bootstrap helpers create a plan early | Canonical pre-plan vs post-plan boundary does not exist in runtime | `intentional_v1_minimal` |
| B1-003 | Lifecycle model | `LifecycleState` and `Stage` are orthogonal | Runtime splits lifecycle behavior across `status`, `stage`, `locked`, `onboarding_completed` | Permissions, routing, and artifact gating are spread across multiple signals | `phase_candidate` |
| B1-004 | Lock semantics | Lock is a validated lifecycle transition with immutable baseline semantics | Lock is a reversible `locked` boolean plus `stage="complete"` update | No canonical LOCKED state, no irreversible baseline, no strict transition matrix | `phase_candidate` |
| B1-005 | Profile authority model | Layered profile model with versioned snapshots and explicit confirmation | Single mutable JSONB blob on plan row; no profile snapshots | Cross-system artifact binding and historical correctness cannot align to canonical model | `intentional_v1_minimal` |
| B1-006 | Confidence as authority | Progress counts only explicit confirmed values | Confidence is embedded in profile JSON, but progress counts any non-empty required value | Canonical filled-vs-confirmed distinction is missing from readiness and dashboard logic | `phase_candidate` |
| B1-007 | Required-fields authority | Required fields owned by Progress System via registry | Required fields are defined in application code in `profile-schema.ts` | Progress remains app-defined rather than system-owned by a canonical registry | `defer_v2` |
| B1-008 | Progress authority | Dashboard reads progress only from canonical progress outputs | Dashboard fetches `/api/progress` but still derives denominator and onboarding gate locally | Dashboard does not yet act as a pure state renderer | `phase_candidate` |
| B1-009 | Dashboard state derivation | Dashboard states are derived through the canonical 10-state table | UI branches directly on `filledCount`, `stage`, `locked`, and guide presence | Batch 1 state vocabulary is not formalized in code, increasing drift risk | `phase_candidate` |
| B1-010 | Post-arrival dashboard summary | Post-arrival dashboard should surface compliance progress and urgent work | Dashboard only shows a settling-in card/link in arrived mode | Post-arrival state is under-modeled at the main control surface | `phase_candidate` |
| B1-011 | Concurrency contract | Profile writes require conflict protection | `expectedVersion` exists, but is optional | Some callers still permit silent last-write-wins | `phase_candidate` |
| B1-012 | Dead helper risk | Current-plan switching must be atomic everywhere | `plan-factory.ts` still contains non-atomic helper logic, though the active API path uses RPC | Future reuse of dead helper code can reintroduce current-plan corruption | `code_fix_now` |
| B1-013 | Stage integrity | Stage must reflect a valid transition matrix and remain coherent with lock/progress state | Runtime verification found a current plan at `stage="generating"` with `locked=false` and `interview_progress=24%` | Stage cannot be trusted as an authoritative readiness or lifecycle signal | `phase_candidate` |

---

## 7. Batch-Scope Resolved Items

These Batch 1 gaps were verified as fixed in current code and corrected in the audit layer:

- chat interview now terminates when `stage="generating"` (`GAP-046`)
- onboarding completion is only marked after guide readiness is confirmed (`GAP-047`)
- chat surfaces profile-save failure metadata (`GAP-048`)
- `PATCH /api/profile` uses shared completeness logic instead of a hardcoded field list (`GAP-049`)

These were part of the Batch 1 re-audit because stale docs still described them as open.

---

## 8. Dependency Notes For Later Batches

### Batch 2 dependency

Research, visa, local requirements, and checklist work should assume:

- current plan authority is still `is_current`
- upstream artifact staleness uses `plan_version`, not `profile_version_id`
- lock means `locked=true` plus current stage, not canonical LifecycleState=LOCKED

### Batch 3 dependency

Post-arrival execution work should assume:

- arrival mode is driven by `plan.stage === "arrived"`
- dashboard summary for arrived mode is still incomplete and owned jointly by Batch 1/3 concerns

### Batch 4 dependency

Guides and artifact systems should assume:

- profile history is not version-snapshotted
- `plan_version` is the only general-purpose upstream change marker

### Batch 6 dependency

Chat/history/events work should assume:

- there is no persistent pre-plan interview session model
- the canonical pre-plan/post-plan interview separation is still not implemented

---

## 9. Recommended Phase Candidates

These are the most coherent follow-up implementation slices produced by Batch 1.

### Candidate A — Current Plan Authority Refactor

- introduce explicit `current_plan_id`
- keep `is_current` only as projection or remove it
- update all current-plan resolution paths atomically

### Candidate B — Lifecycle Normalization

- introduce canonical lifecycle authority
- keep `stage` as UX-only dimension
- collapse `status/locked/onboarding_completed` semantics into a coherent transition model

### Candidate C — Dashboard State Derivation

- add a server-owned dashboard-state derivation function
- stop local onboarding gating and denominator derivation
- wire arrived-mode summary from canonical progress/task state

### Candidate D — Profile Confirmation and Conflict Contract

- make `expectedVersion` mandatory
- formalize confirmed vs inferred semantics in progress/readiness
- stop treating non-empty fields as equivalent to explicit confirmation

### Candidate E — Cleanup of Dead State Helpers

- remove or rewrite `lib/gomate/plan-factory.ts`
- ensure all plan switching stays on the RPC path

---

## 10. Re-Audit Result

Final re-audit result:

- no unclassified Batch 1 mismatch remains
- no stale Batch 1 contradiction remains in the patched authority/audit docs that were part of this run
- all remaining in-scope mismatches are classified with one of the allowed outcomes
- runtime spot-checks did not reveal any additional unclassified Batch 1 mismatch beyond the newly recorded stage-integrity gap
- later batches can now treat Batch 1 state authority as an explicit known baseline instead of an ambiguous one

This does not mean the system is aligned to the canonical definitions.

It means Batch 1 itself is audit-complete, internally coherent, and closed under the required loop.

---

## 11. Final Result

Final Result: PASS
