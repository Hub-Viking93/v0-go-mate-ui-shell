# Phase 3 — Post-Arrival Execution Consistency

**Master gaps:** `B3-001`, `B3-002`, `B3-003`, `B3-005`, `B3-006`, `B3-008`, `B3-009`, `B3-010`
**Classification mix:** `code_fix_now`, `phase_candidate`
**Depends on:** `Phase 0 — Core State Authority`, `Phase 1 — Dashboard State And Progress Authority`

---

## Purpose

This phase makes the post-arrival execution layer internally consistent.

The master audit showed that the actual Batch 3 problem is not “missing engine.” The system already has a real settling-in engine. The remaining problem is that different post-arrival surfaces still disagree about:

- when execution has actually begun
- which routes are stage-gated
- what progress means
- how compliance state is rendered

This phase replaces the old narrow task-priority phase with a broader execution-consistency phase.

---

## Scope

This phase covers:

- coherent arrived gating across execution surfaces
- progress-before-arrival leakage
- legacy task-state coherence
- blocker/compliance semantics needed for current execution correctness
- why-it-matters execution safety
- compliance rendering consistency

This phase does not cover:

- a full canonical timeline system
- full task versioning/profile snapshot binding

---

## Target Outcome

After this phase:

1. All post-arrival execution surfaces obey one coherent `arrived` authority.
2. Pre-arrival plans cannot surface post-arrival progress or execution affordances inconsistently.
3. Compliance progress is based on a defensible task model rather than accidental blending.
4. Why-it-matters and related enrichment surfaces respect execution-stage authority.
5. Compliance rendering uses one canonical deadline/status computation path.

---

## Primary Files / Areas

- `app/api/settling-in/route.ts`
- `app/api/settling-in/generate/route.ts`
- `app/api/settling-in/[id]/route.ts`
- `app/api/settling-in/[id]/why-it-matters/route.ts`
- `app/api/progress/route.ts`
- `lib/gomate/progress.ts`
- settling-in / compliance UI components and pages

---

## Required Work

### 1. Shared Post-Arrival Gate

- normalize arrived gating across GET, generate, update, and enrichment surfaces

### 2. Progress/State Coherence

- prevent post-arrival progress from surfacing before arrival
- clean up any legacy task state that contradicts the visible execution mode

### 3. Compliance Semantics

- introduce whatever task/compliance distinctions are needed so execution and compliance progress are not misleading

### 4. Rendering Consistency

- make compliance UI consume one canonical computation for urgency/deadlines/status

---

## Acceptance Criteria

1. Post-arrival routes and enrichments respect one coherent `arrived` gate.
2. A non-arrived plan cannot present meaningful post-arrival progress or hidden execution state inconsistently.
3. Compliance progress/rendering is materially more trustworthy than today.
4. The master-audit gaps `B3-001`, `B3-002`, `B3-003`, `B3-005`, `B3-006`, `B3-008`, `B3-009`, and `B3-010` are resolved or materially narrowed.

---

## Notes

- This phase is intentionally about execution coherence, not the full target-state timeline architecture.
