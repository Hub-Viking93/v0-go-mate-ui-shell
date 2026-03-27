# Phase 1 — Dashboard State And Progress Authority

**Master gaps:** `B1-008`, `B1-009`, `B1-010`
**Classification mix:** `phase_candidate`
**Depends on:** `Phase 0 — Core State Authority`

---

## Purpose

This phase makes the dashboard a renderer of canonical state instead of a second source of truth.

The master audit shows that the dashboard still derives onboarding/progress state locally, lacks a formal state table, and under-models post-arrival status. After Phase 0 establishes authoritative core state, this phase makes the main control surface consume that authority cleanly.

---

## Scope

This phase covers:

- dashboard state derivation
- progress authority on the dashboard
- arrived-mode dashboard summary

This phase does not cover:

- post-arrival task engine fixes themselves
- research/checklist semantics
- guide identity/versioning

---

## Target Outcome

After this phase:

1. Dashboard state comes from one canonical derivation contract, not ad hoc branching.
2. The dashboard no longer computes its own onboarding/progress meaning from local heuristics that can drift.
3. Arrived-mode dashboard surfaces real execution status, not just a link to another page.

---

## Primary Files / Areas

- `app/(app)/dashboard/page.tsx`
- `app/api/progress/route.ts`
- `lib/gomate/progress.ts`
- any new shared dashboard-state derivation helper introduced by this phase

---

## Required Work

### 1. Canonical Dashboard-State Derivation

- define one dashboard-state mapping from authoritative plan/progress/task state
- remove local heuristics that act as hidden lifecycle logic

### 2. Progress Authority Cleanup

- ensure the dashboard reads canonical progress outputs instead of mixing route outputs with local denominator/gating logic

### 3. Post-Arrival Summary Surface

- add a proper arrived-mode summary:
  - progress
  - urgent or overdue work
  - meaningful execution CTA

---

## Acceptance Criteria

1. The dashboard uses one shared state-derivation contract instead of local scattered conditionals.
2. The dashboard does not need to infer onboarding readiness from local field counting rules.
3. Arrived-mode dashboard shows meaningful execution status, not only a navigation link.
4. The master-audit gaps `B1-008`, `B1-009`, and `B1-010` are resolved or materially narrowed.

---

## Notes

- This phase intentionally depends on Phase 0 because a dashboard cannot become authoritative until core state is authoritative.
