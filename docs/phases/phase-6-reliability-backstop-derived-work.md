# Phase 6 — Reliability Backstop For Derived Work

**Master gaps:** `B6-004`, `B6-005`, `B6-007`
**Classification mix:** `phase_candidate`
**Depends on:** `Phase 2 — Research And Checklist Integrity`, `Phase 3 — Post-Arrival Execution Consistency`, `Phase 4 — Guide Artifact Integrity`, `Phase 5 — Travel And Cost Surface Hardening`

---

## Purpose

This phase adds the minimum reliability backstops still missing for derived work.

The master audit does not require a full event/queue/observability platform for the current phase pack. But it does show three remaining runtime reliability problems that still matter now:

- research depends on a client follow-up call after lock
- derived work still has no queue/retry/subtask ledger
- degraded or fallback states still are not surfaced strongly enough to the user

This phase addresses those without pretending to implement the full target-state infrastructure.

---

## Scope

This phase covers:

- server-side backstop for post-lock research triggering
- minimum durable status tracking for derived work where needed
- degraded-state / partial-failure visibility for users

This phase does not cover:

- full event bus
- full generic job system
- full observability/replay platform

Those remain explicit `defer_v2` items in the master audit.

---

## Target Outcome

After this phase:

1. A locked plan cannot silently miss downstream research just because the client never made the second request.
2. The system has enough durable derived-work status tracking to avoid opaque request-coupled failure modes for the active v1 surfaces.
3. Users can see when data is degraded, partial, fallback-based, or needs retry.

---

## Primary Files / Areas

- `app/api/profile/route.ts`
- `app/api/research/trigger/route.ts`
- research/checklist/document UI surfaces
- any minimal persistence added for backstop/status tracking

---

## Required Work

### 1. Post-Lock Research Backstop

- ensure locked plans cannot get stranded without research
- move from “client should call next” to an actual server-owned recovery/backstop behavior

### 2. Minimum Durable Status Tracking

- add just enough persistent status structure so derived work is not only a transient request outcome

### 3. Degraded-State Visibility

- make partial/fallback/degraded states visible to users where they affect trust and actionability

---

## Acceptance Criteria

1. Locking a plan cannot leave research permanently absent just because the client did not call the trigger route.
2. Derived work has stronger durable status tracking than today for the scoped surfaces.
3. Users can see when outputs are degraded, partial, fallback-based, or need attention.
4. The master-audit gaps `B6-004`, `B6-005`, and `B6-007` are resolved or materially narrowed.

---

## Notes

- This phase is intentionally a minimum reliability phase, not a stealth full-platform rebuild.
