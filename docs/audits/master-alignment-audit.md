# Master Alignment Audit

> Consolidated from:
> - `docs/audits/alignment-batch-1-core-state.md`
> - `docs/audits/alignment-batch-2-research-intelligence.md`
> - `docs/audits/alignment-batch-3-post-arrival-execution.md`
> - `docs/audits/alignment-batch-4-artifacts-guidance.md`
> - `docs/audits/alignment-batch-5-booking-housing-travel.md`
> - `docs/audits/alignment-batch-6-chat-history-events.md`
>
> Authority: `docs/audits/document-authority.md`
> Method: merge only batch artifacts that already closed with `Final Result: PASS`
> Purpose: single master register of all known open gaps after Batches 1-6

---

## 1. What This Document Is

This is the merged audit layer after Batch 1-6 completed their own `audit -> patch -> re-audit -> PASS` loops.

It is not a fresh speculative review.

It is the consolidated result of the closed batch audits, normalized into one decision document that states:

- all known open gaps
- each gap's classification
- which gaps are true deferrals
- which divergences are accepted as v1-minimal
- which gaps require new implementation

Resolved items from the batch loops are not treated as open gaps in this document.

---

## 2. Classification Model

This master audit uses the classifications already applied in the batch artifacts.

### `code_fix_now`

Meaning:

- the current runtime behavior is misleading, inconsistent, or broken enough that it should be treated as immediate implementation work
- this is still an open gap, not an accepted divergence

Action:

- fix directly
- or make it the very next implementation slice

### `phase_candidate`

Meaning:

- the gap is real
- it requires new implementation or structural adjustment
- it does not need to be mislabeled as v1-minimal or deferred to v2

Action:

- include in the next phase pack

### `intentional_v1_minimal`

Meaning:

- the canonical definition is richer than the current system
- the current system is smaller/simpler but still coherent enough for v1 if documented honestly

Action:

- do not treat as a hidden defect
- do not force implementation immediately
- preserve explicit documentation that this is a conscious v1 boundary

### `defer_v2`

Meaning:

- the gap is real
- the current system does not implement the canonical design
- this work is intentionally postponed beyond the current v1 alignment effort

Action:

- keep documented as an explicit defer
- do not pretend the capability exists

---

## 3. Executive Summary

Open consolidated gap count after Batch 1-6:

- total open gaps: `54`
- `code_fix_now`: `5`
- `phase_candidate`: `29`
- `intentional_v1_minimal`: `9`
- `defer_v2`: `11`

Decision summary:

- work that requires new implementation now or in the next phase pack:
  - `code_fix_now`
  - `phase_candidate`
- accepted v1-minimal divergence:
  - `intentional_v1_minimal`
- real deferred work:
  - `defer_v2`

Interpretation:

- the system is no longer in a state where the gaps are ambiguous
- the remaining work is now classified cleanly enough to rebase the phase documents against this audit

---

## 4. Open Gaps Requiring Immediate Fixes (`code_fix_now`)

These are the open gaps that should be treated as direct implementation work rather than only future planning.

| ID | Batch | Domain | Open Gap |
|---|---|---|---|
| B1-012 | 1 | Current plan switching | Dead non-atomic helper logic in `plan-factory.ts` remains a reuse risk even though the active API path uses RPC |
| B2-002 | 2 | Research status semantics | One plan-level `research_status` still overstates artifact readiness and remains too coarse as authority |
| B2-007 | 2 | Checklist downstream binding | Checklist generation can still degrade relative to visa/research/profile state and needs deterministic downstream binding |
| B3-001 | 3 | Post-arrival gate authority | Settling-in surfaces still do not share one coherent `arrived` gate model |
| B3-002 | 3 | Progress/stage coherence | Post-arrival progress can surface before arrival if task rows already exist |

Why these are different from ordinary phase candidates:

- they are already visible as misleading runtime behavior or dangerous integrity debt
- they do not need a target-state platform rebuild to justify implementation

---

## 5. Open Gaps Requiring New Implementation (`phase_candidate`)

These are real open gaps that should drive the next implementation phase pack.

| ID | Batch | Domain | Open Gap |
|---|---|---|---|
| B1-001 | 1 | Current plan authority | Current-plan authority is still `relocation_plans.is_current`, not a canonical `current_plan_id` model |
| B1-003 | 1 | Lifecycle model | Lifecycle meaning is still split across `status`, `stage`, `locked`, and `onboarding_completed` |
| B1-004 | 1 | Lock semantics | Lock is still a reversible boolean/state mutation instead of a canonical validated lifecycle transition |
| B1-006 | 1 | Confidence/readiness | Progress/readiness still count non-empty values instead of explicit confirmed values only |
| B1-008 | 1 | Progress authority | Dashboard still derives part of onboarding/progress state locally instead of purely rendering canonical progress outputs |
| B1-009 | 1 | Dashboard state derivation | Dashboard still lacks a canonical 10-state derivation function |
| B1-010 | 1 | Post-arrival dashboard | Arrived-mode dashboard summary remains under-modeled |
| B1-011 | 1 | Conflict contract | `expectedVersion` still exists but remains optional for profile writes |
| B1-013 | 1 | Stage integrity | `stage` is still not trustworthy as authoritative lifecycle/readiness state |
| B2-004 | 2 | Visa authority | Visa intelligence still exists across fragmented artifacts instead of one canonical recommendation snapshot |
| B2-005 | 2 | Visa explainability | Visa output still lacks the richer structured factors/assumptions/source semantics of the target model |
| B2-008 | 2 | Document identity | `checklist_items` and `document_statuses` still lack shared canonical document identity/version semantics |
| B2-010 | 2 | Extraction consistency | Checklist generation remains the fragile Claude + regex extraction path in the research stack |
| B2-011 | 2 | Source granularity | Research outputs still expose mostly top-level sources instead of stronger claim/item-level source semantics |
| B2-012 | 2 | Recommendation/checklist coupling | Visa selection still lacks one authoritative downstream contract for document expectations |
| B3-003 | 3 | Legacy execution state | Non-arrived plans can still carry task state that contradicts the visible API surface |
| B3-005 | 3 | Blocker model | Task blockers still are not first-class lifecycle entities with richer causes/transitions |
| B3-006 | 3 | Compliance ownership | Compliance progress still conflates all tasks because no REQUIRED/RECOMMENDED/OPTIONAL model exists |
| B3-008 | 3 | Generation architecture | Settling-in generation still lacks stronger run identity, transactionality, and regeneration structure |
| B3-009 | 3 | Why-it-matters safety | Why-it-matters still needs stronger execution-stage and legal-safety boundaries |
| B3-010 | 3 | Compliance rendering | Compliance UI still derives from split client/server deadline logic instead of one canonical computation |
| B4-002 | 4 | Guide snapshot integrity | Guide regeneration still is not snapshot-bound to historical inputs |
| B4-003 | 4 | Guide identity | Logical guide identity still lacks DB-level uniqueness/current-pointer semantics |
| B5-004 | 5 | Commercial API surface | Flight API remains public while the booking page is gated |
| B5-005 | 5 | Flight search quality | Flight search quality remains too weak for canonical artifact treatment |
| B5-006 | 5 | Cost-of-living authority | Cost-of-living still is a split helper/API layer rather than a canonical persisted artifact |
| B6-004 | 6 | Research trigger lifecycle | Research still relies on a client follow-up call after lock; no server-side backstop exists |
| B6-005 | 6 | Queue/retry ledger | Research and other derived work still have no queue/worker/subtask ledger |
| B6-007 | 6 | Failure visibility | Degraded/fallback states still are not surfaced strongly enough to the user |

This is the primary implementation backlog for the next phase-document rewrite.

---

## 6. Accepted V1-Minimal Divergences (`intentional_v1_minimal`)

These gaps are real, but the current simpler implementation is accepted for v1 as long as the docs remain honest.

| ID | Batch | Domain | Accepted V1-Minimal Divergence |
|---|---|---|---|
| B1-002 | 1 | Pre-plan boundary | Plans are created early instead of preserving a strict no-plan pre-interview boundary |
| B1-005 | 1 | Profile authority | The system still uses one mutable plan-bound profile blob instead of layered snapshot-backed profile authority |
| B2-006 | 2 | Local requirements model | Local requirements still exist as categorized research notes rather than formal requirement sets |
| B3-004 | 3 | Task identity | Task identity is still split across UUID, `task_key`, and exact-title chat markers |
| B4-004 | 4 | Recommendation system | Recommendation behavior still exists as embedded/helper output rather than canonical snapshot tables |
| B5-001 | 5 | Flight system | Flight support is real discovery/search only, not a persistent flight artifact system |
| B5-007 | 5 | Cost preferences | Cost preferences persist only as JSON inside `profile_data` |
| B6-002 | 6 | Event system | Inline route triggers remain the accepted v1 substitute for an event bus |
| B6-003 | 6 | Data update system | Artifact freshness/regeneration remains route-owned instead of DAG/orchestrator-owned |

These items should not be mislabeled as “implemented canonically,” but they also should not automatically expand the next phase pack unless product intent changes.

---

## 7. Real Deferrals (`defer_v2`)

These are real missing capabilities that the merged audit treats as deliberate defer rather than current-phase work.

| ID | Batch | Domain | Real Deferral |
|---|---|---|---|
| B1-007 | 1 | Required-fields registry | Required-fields authority still lives in app code rather than a system-owned canonical registry |
| B2-001 | 2 | Research architecture | Two-layer/shared research architecture still does not exist |
| B2-003 | 2 | Snapshot binding | Research artifacts still are not bound to immutable profile/version snapshots |
| B2-009 | 2 | Compliance lifecycle | Document compliance still lacks the richer lifecycle and blocker semantics of the canonical model |
| B3-007 | 3 | Timeline system | No canonical timeline system exists beyond task-deadline display behavior |
| B4-005 | 4 | Generic artifact system | No generic `artifacts` table or unified artifact registry exists |
| B5-002 | 5 | Booking registry | No canonical booking registry or booking lifecycle exists |
| B5-003 | 5 | Housing system | No housing system exists beyond guide prose references |
| B6-001 | 6 | Chat history | No persistent conversations/messages system exists |
| B6-006 | 6 | Observability | No trace IDs, spans, replay, or structured observability layer exists |
| B6-008 | 6 | Artifact unification | Output-specific storage still exists instead of one unified versioned artifact layer |

These are not accepted-as-implemented.

They are explicit “not now” decisions.

---

## 8. Resolved During Batch Closure, Not Open

These issues were found during the batch loops and resolved before the batches closed, so they are not part of the open-gap register above.

- Batch 1:
  - chat termination on `stage="generating"`
  - onboarding completion only after guide readiness
  - chat profile-save failure surfaced in metadata
  - shared completeness logic reused in `PATCH /api/profile`
- Batch 4:
  - guide regeneration is now bound to the viewed guide row instead of implicitly targeting the current plan
- Batch 6:
  - research trigger no longer runs on pre-lock `generating` plans
  - aggregate research status ownership was tightened at the trigger route
  - aggregate partial failure no longer reports open-ended `"completed"` semantics

This section exists to prevent already-fixed items from leaking back into future phase planning.

---

## 9. What This Master Audit Means For Phase Planning

If the phase documents are rebased against this master audit, the planning split should be:

### Next implementation-focused phases

Source from:

- all `code_fix_now`
- all `phase_candidate`

### Explicitly accepted v1 baseline

Source from:

- all `intentional_v1_minimal`

Rule:

- keep them documented
- do not silently upgrade them to “fully aligned”

### Explicit post-v1 backlog

Source from:

- all `defer_v2`

Rule:

- do not mix these into near-term phases unless product scope changes

---

## 10. Final Master Conclusion

After Batch 1-6, the repository now has:

- a closed batch audit trail
- a merged open-gap register
- clear separation between:
  - required new implementation
  - accepted v1-minimal divergence
  - true deferred work

The next correct move is:

1. audit the current phase documents against this master audit
2. remove or rewrite phase docs that no longer map cleanly
3. generate a new phase pack from:
   - `code_fix_now`
   - `phase_candidate`

This master audit should be treated as the current merged planning baseline until superseded by a later full re-audit.
