# Phase 4 — Guide Artifact Integrity

**Master gaps:** `B4-002`, `B4-003`
**Classification mix:** `phase_candidate`
**Depends on:** `Phase 0 — Core State Authority`, `Phase 2 — Research And Checklist Integrity`

---

## Purpose

This phase fixes the remaining guide artifact integrity problems.

The guide regenerate path itself was fixed already. What remains is deeper:

- guide regeneration is still not snapshot-bound
- logical guide identity still has no trustworthy uniqueness/current-pointer contract

This phase makes guides behave like coherent artifacts instead of mutable rows that can drift into duplicate inventories.

---

## Scope

This phase covers:

- guide snapshot/input integrity
- logical guide identity uniqueness
- current guide selection semantics

This phase does not cover:

- a full generic artifact platform
- a repository-wide artifact registry

Those remain explicit later-stage concerns.

---

## Target Outcome

After this phase:

1. Guide regeneration is bound to a stable input contract instead of silently reinterpreting historical identity from current mutable plan data.
2. One logical guide identity cannot drift into uncontrolled duplicate rows.
3. The system can identify the current guide artifact for a plan/destination/purpose deterministically.

---

## Primary Files / Areas

- `app/api/guides/route.ts`
- `app/(app)/guides/[id]/page.tsx`
- guide generation helpers and DB mapping helpers
- guide persistence schema / constraints if required

---

## Required Work

### 1. Snapshot-Bound Regeneration

- define what guide input snapshot/version is authoritative
- prevent regeneration from silently reusing unrelated current plan state

### 2. Logical Guide Identity

- add a deterministic uniqueness/current-pointer model for active guide identity
- clean up or prevent duplicate logical guide rows

---

## Acceptance Criteria

1. Regenerating a guide does not silently rewrite historical identity from unrelated current plan state.
2. Duplicate logical guide inventories are prevented or normalized by a clear contract.
3. The system can determine one current guide artifact per logical identity shape.
4. The master-audit gaps `B4-002` and `B4-003` are resolved or materially narrowed.

---

## Notes

- This phase should stay tightly scoped to guide artifact integrity.
- Generic artifact-table work remains out of scope here.
