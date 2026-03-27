# Phase 2 — Research And Checklist Integrity

**Master gaps:** `B2-002`, `B2-004`, `B2-005`, `B2-007`, `B2-008`, `B2-010`, `B2-011`, `B2-012`
**Classification mix:** `code_fix_now`, `phase_candidate`
**Depends on:** `Phase 0 — Core State Authority`

---

## Purpose

This phase fixes the remaining integrity problems in the research, visa, checklist, and document-tracking layer.

The master audit shows that the current problem is no longer just “better visa output.” The actual gap family is:

- research status that can overstate readiness
- fragmented visa authority
- weak downstream checklist binding
- weak document identity coupling
- fragile extraction/source semantics

This phase replaces the old narrow visa-output phase with a full research/checklist integrity phase.

---

## Scope

This phase covers:

- research status meaning
- canonical visa authority for downstream use
- checklist downstream binding
- checklist/document identity coupling
- source/explainability structure where it affects integrity

This phase does not cover:

- shared Layer 1 research cache architecture
- profile-version snapshot infrastructure
- full compliance lifecycle model

Those remain explicit `defer_v2` items in the master audit.

---

## Target Outcome

After this phase:

1. Research status no longer overstates actual artifact readiness.
2. Visa output has one authoritative downstream shape for checklist/document use.
3. Checklist generation is deterministic against current research/profile inputs and clearly surfaces degraded or fallback states.
4. Checklist items and document tracking use a shared identity model that can be trusted by the rest of the system.
5. Research outputs expose stronger explainability/source structure where needed by downstream systems.

---

## Primary Files / Areas

- `app/api/research/trigger/route.ts`
- `app/api/research/visa/route.ts`
- `app/api/research/checklist/route.ts`
- `app/api/documents/route.ts`
- `lib/gomate/research-visa.ts`
- `lib/gomate/research-checklist.ts`
- `lib/gomate/checklist-generator.ts`
- related UI/components that assume the old research/checklist/document shapes

---

## Required Work

### 1. Research Status Integrity

- stop treating plan-level research state as stronger than the underlying artifacts justify
- add explicit degraded/partial/fallback semantics where needed

### 2. Visa Authority Consolidation

- choose one canonical visa artifact/shape for downstream use
- stop parallel recommendation/checklist logic from drifting independently

### 3. Checklist Snapshot Integrity

- make checklist generation explicitly downstream of current authoritative inputs
- surface fallback/degraded generation honestly

### 4. Document Identity Coupling

- make checklist items and stored document statuses refer to the same document identity contract

---

## Acceptance Criteria

1. `research_status` and related readiness signals no longer claim stronger completeness than the underlying artifacts justify.
2. Checklist generation uses one deterministic downstream contract from visa/research/profile state.
3. Checklist and document-status storage share a stable identity model.
4. Visa explainability/source structure is strong enough for downstream checklist/document use.
5. The master-audit gaps `B2-002`, `B2-004`, `B2-005`, `B2-007`, `B2-008`, `B2-010`, `B2-011`, and `B2-012` are resolved or materially narrowed.

---

## Notes

- This phase intentionally does not try to build the full canonical research platform.
- It is about making the current v1 intelligence layer trustworthy enough to act on.
