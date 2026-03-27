# Phase 0 — Core State Authority

**Master gaps:** `B1-001`, `B1-003`, `B1-004`, `B1-006`, `B1-011`, `B1-013`
**Classification mix:** `phase_candidate`, `code_fix_now`
**Depends on:** None

---

## Purpose

This phase establishes a trustworthy core-state model for plans and profiles.

The master audit shows that current-plan authority, lifecycle meaning, lock semantics, confirmation semantics, concurrency, and stage integrity are still spread across partially overlapping fields and behaviors. Until this is fixed, later phases keep building on unreliable state.

This is the new first implementation phase because all downstream systems depend on it.

---

## Scope

This phase covers:

- current-plan authority
- lifecycle/state derivation
- lock semantics
- confirmed-vs-filled readiness semantics
- mandatory conflict protection for profile writes
- stage integrity

This phase does not cover:

- dashboard rendering details beyond what is needed for core-state authority
- research/checklist logic
- guide snapshot identity
- travel/commercial surfaces
- event bus / queue / observability platform work

---

## Target Outcome

After this phase:

1. There is one authoritative current-plan resolution contract used consistently across routes and UI loaders.
2. Lifecycle meaning is derived coherently instead of being inferred ad hoc from `status`, `stage`, `locked`, and `onboarding_completed`.
3. Locking is a validated lifecycle transition, not just a loosely reversible boolean update.
4. Readiness/progress semantics distinguish confirmed data from merely non-empty data where the system depends on that difference.
5. User-facing profile writes require conflict protection instead of optional `expectedVersion`.
6. Invalid or contradictory state combinations like weak-progress `stage="generating"` cannot be produced silently.

---

## Primary Files / Areas

- `app/api/profile/route.ts`
- `app/api/plans/route.ts`
- `app/api/progress/route.ts`
- `lib/gomate/state-machine.ts`
- `lib/gomate/profile-schema.ts`
- `lib/gomate/plan-factory.ts`
- any new shared state/lifecycle helper introduced by this phase

---

## Required Work

### 1. Current-Plan Authority

- remove or neutralize dead/non-authoritative plan-switch helpers
- make active current-plan resolution consistent across API and UI
- ensure future plan switching cannot reintroduce non-atomic current-plan behavior

### 2. Lifecycle Authority

- define one server-owned lifecycle/state derivation contract
- stop letting different surfaces infer lifecycle differently from raw columns
- make lock, completion, and readiness transitions explicit and validated

### 3. Conflict Contract

- make conflict protection mandatory wherever users edit profile state
- remove optional last-write-wins behavior from the active user-edit path

### 4. Stage Integrity

- ensure `stage` cannot drift away from real lifecycle/readiness state
- add verification logic or state guards so contradictory combinations are rejected or normalized

---

## Acceptance Criteria

1. The active current-plan path no longer depends on dead/non-atomic helper behavior.
2. User-initiated profile writes do not proceed without version/conflict protection.
3. Lock, completion, and readiness state are derived through one coherent server-owned contract.
4. A plan cannot remain `stage="generating"` while still behaving like an incomplete collecting plan.
5. The master-audit gaps `B1-001`, `B1-003`, `B1-004`, `B1-006`, `B1-011`, and `B1-013` are either resolved or explicitly narrowed by code changes in this phase.

---

## Notes

- This phase replaces the old narrow `chat/profile integrity` gap pack as the real baseline state phase.
- Dashboard improvements that depend on this authority model belong in the next phase, not here.
