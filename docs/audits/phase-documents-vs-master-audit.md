# Phase Documents vs Master Audit

> Authority: `docs/audits/document-authority.md`
> Compared against: `docs/audits/master-alignment-audit.md`
> Scope: `docs/phases/*.md` and the currently active audit-based phase pack
> Purpose: determine whether the current phase documents are still relevant, whether they map to real remaining gaps, which phases are already effectively complete, and which new phases are missing

---

## 1. Audit Questions

This audit answers four questions:

1. Are the current phase documents still relevant?
2. Do they map to real remaining gaps in the master audit?
3. Are any phases already effectively complete and therefore no longer active planning documents?
4. Are new phases missing for gaps discovered in the batch audits?

Short answer:

- the current phase pack is no longer a reliable active implementation plan
- some phase docs are already functionally obsolete because their scoped work is resolved
- some phase docs are still directionally relevant but no longer map cleanly to the merged open-gap register
- several major open areas from the master audit have no phase document at all

So the current phase pack should not be used as-is for future implementation sequencing.

---

## 2. Primary Finding

The current phase docs were written against the older `GAP-*` register in `docs/audits/definitions-vs-system-audit.md`.

The repository now has a newer merged authority for implementation planning:

- `docs/audits/master-alignment-audit.md`

That means the phase pack is now out of date in two ways:

1. identifier drift
- the phase docs target old `GAP-*` items
- the merged planning baseline now uses batch-closed/open decisions expressed as `B*-*`

2. scope drift
- the old phase docs reflect the earlier narrow gap-fix sequence
- the master audit reflects what actually remains after the full batch audit program

Result:

- the current phase docs are no longer sufficient as the active roadmap
- they must be audited, classified, and then replaced or rebased

---

## 3. Phase-By-Phase Audit

### Summary Table

| Phase Doc | Current Relevance | Maps To Open Master Gaps? | Already Effectively Complete? | Decision |
|---|---|---|---|---|
| `phase-0-chat-route-safety.md` | low | no meaningful open mapping | yes | archive from active phase pack |
| `phase-1-profile-integrity.md` | low | only partially | mostly | archive and replace with broader core-state phase |
| `phase-2-forbidden-pattern-cleanup.md` | low | no meaningful open mapping | yes | archive from active phase pack |
| `phase-3-task-priority-progress.md` | medium | partially | no | rewrite into post-arrival execution integrity phase |
| `phase-4-stage-transition-safety.md` | medium-high | partially | no | rewrite into state/dashboard integrity phase |
| `phase-5-research-system-refactor.md` | medium | partially | no | rewrite into research intelligence integrity phase |
| `phase-6-dashboard-documents-confidence.md` | low | mostly no | largely yes at doc level | remove as active implementation phase |
| `phase-7-remaining-definition-adjustments.md` | low | mostly no | largely yes or defer | remove as active implementation phase |

---

## 4. Detailed Findings Per Phase

### Phase 0 — Chat Route Safety

File:

- `docs/phases/phase-0-chat-route-safety.md`

Original intent:

- auth guard
- termination guard
- extraction guard
- temperature/maxTokens
- confidence persistence
- profile save error surfacing

Master-audit assessment:

- this phase does not map cleanly to open master-audit work anymore
- the scoped issues were already resolved during earlier implementation and re-audit loops
- the master audit explicitly treats the batch-closure chat safety fixes as resolved items, not open gaps

Decision:

- archive as historical/completed
- do not keep in the active phase pack

Reason:

- it is no longer an implementation phase
- keeping it active would duplicate already-resolved work

---

### Phase 1 — Profile Integrity

File:

- `docs/phases/phase-1-profile-integrity.md`

Original intent:

- onboarding completion timing
- dynamic completeness
- optional optimistic concurrency

Master-audit assessment:

- the original scoped fixes are mostly already done
- but the master audit still contains broader open state-integrity work:
  - `B1-001`
  - `B1-003`
  - `B1-004`
  - `B1-006`
  - `B1-008`
  - `B1-009`
  - `B1-010`
  - `B1-011`
  - `B1-013`

Important mismatch:

- the old Phase 1 treats `expectedVersion` as an optional integrity improvement
- the master audit now treats the remaining conflict contract as still open because optional conflict protection is not enough

Decision:

- archive current Phase 1 as historical
- replace it with a broader core-state phase

Reason:

- the old phase is too narrow and partially completed
- the real remaining work is now a larger state-authority/lifecycle/dashboard problem

---

### Phase 2 — Forbidden Pattern Cleanup

File:

- `docs/phases/phase-2-forbidden-pattern-cleanup.md`

Original intent:

- remove self-HTTP research trigger
- remove in-memory cache
- remove random mock data

Master-audit assessment:

- this phase no longer maps to meaningful open master-audit work
- the self-HTTP pattern was resolved
- the in-memory cache issue is no longer an active master-audit planning item
- deterministic flight mocks were already handled

Decision:

- archive as historical/completed

Reason:

- this is no longer part of the open implementation backlog

---

### Phase 3 — Task Priority & Progress

File:

- `docs/phases/phase-3-task-priority-progress.md`

Original intent:

- add task priority
- count only REQUIRED tasks in post-arrival progress
- add `pre_arrival_progress` and `overall_plan_progress`

Master-audit mapping:

Strong mapping:

- `B3-006` compliance ownership
- partially `B3-002` progress/stage coherence

Weak or non-mapping:

- the old requirement for four progress types is not a master-audit priority
- the bigger current issue is not “missing progress types,” it is inconsistent execution-state authority across surfaces

Decision:

- keep the underlying topic
- rewrite the phase completely

Reason:

- priority/progress is still relevant
- but the current open work is broader:
  - stage-gate consistency
  - progress-before-arrival leakage
  - legacy task-state coherence
  - compliance rendering consistency

Recommended replacement theme:

- post-arrival execution integrity

---

### Phase 4 — Stage Safety & Dashboard

File:

- `docs/phases/phase-4-stage-transition-safety.md`

Original intent:

- stage validator
- dashboard state derivation
- post-arrival stats card

Master-audit mapping:

- `B1-008`
- `B1-009`
- `B1-010`
- `B1-013`
- partially `B3-001`
- partially `B3-002`

Assessment:

- this is still directionally relevant
- but it is scoped against the old gap model and underestimates the size of the state-authority problem
- the dashboard problem is not separate from lifecycle authority anymore; they are the same planning area

Decision:

- rewrite and retain the topic
- fold it into a broader core state / dashboard integrity phase

Reason:

- this is one of the few current phase docs that still points at real open work
- but the phase should be broadened and re-grounded in the Batch 1 + Batch 3 master gaps

---

### Phase 5 — Visa Output Quality

File:

- `docs/phases/phase-5-research-system-refactor.md`

Original intent:

- improve structured visa output quality

Master-audit mapping:

- `B2-005` visa explainability
- partially `B2-004`
- partially `B2-011`
- partially `B2-012`

Assessment:

- the phase is still directionally relevant
- but it is much too narrow for the actual remaining research intelligence problem
- the real remaining work is not just richer fields on one response object
- the open problem includes:
  - research status integrity
  - checklist deterministic downstream binding
  - document identity coupling
  - source granularity
  - canonical visa authority

Decision:

- replace with a broader research intelligence integrity phase

Reason:

- visa output quality is now only one subset of the real Batch 2 open backlog

---

### Phase 6 — Definition Alignment

File:

- `docs/phases/phase-6-dashboard-documents-confidence.md`

Original intent:

- doc-only “v1 alignment notes” for old definition divergences

Master-audit assessment:

- this is no longer an appropriate active implementation phase
- the master audit already classifies many of these divergences as either:
  - `intentional_v1_minimal`
  - `defer_v2`
- the batch loops already patched a large share of the active definition/system docs

Decision:

- remove from active phase planning
- keep only as historical reference if desired

Reason:

- documentation alignment is no longer the main bottleneck
- it should not compete with open implementation work in the next phase pack

---

### Phase 7 — Remaining Definition Adjustments

File:

- `docs/phases/phase-7-remaining-definition-adjustments.md`

Original intent:

- doc-only alignment notes for definition items behind profile versioning or v2 scope

Master-audit assessment:

- this phase is not suitable as an active implementation phase
- nearly all of its subject matter is already covered by:
  - `defer_v2`
  - already-updated docs
  - explicit v1-minimal classifications in the master audit

Decision:

- remove from active phase planning

Reason:

- it is effectively a policy/documentation cleanup note, not a current implementation slice

---

## 5. Which Current Phases Are Already Effectively Complete?

These phase docs are already effectively complete and should not remain in the active phase pack:

- `phase-0-chat-route-safety.md`
- `phase-1-profile-integrity.md`
- `phase-2-forbidden-pattern-cleanup.md`

These phase docs are not “implemented as written,” but are no longer the right active planning documents because the repository has moved past their original narrow scope:

- `phase-6-dashboard-documents-confidence.md`
- `phase-7-remaining-definition-adjustments.md`

Interpretation:

- the first group is historical-completed
- the second group is planning-obsolete

---

## 6. Which Current Phases Still Matter But Need Rewriting?

These phase docs still point at real remaining work, but they no longer map cleanly enough to the master audit to remain unchanged:

- `phase-3-task-priority-progress.md`
- `phase-4-stage-transition-safety.md`
- `phase-5-research-system-refactor.md`

Required change:

- rewrite them against `master-alignment-audit.md`
- stop using the old `GAP-*` references as the active planning anchor
- anchor them to the open `code_fix_now` + `phase_candidate` work only

---

## 7. Missing Phases In The Current Pack

The current phase pack is missing major planning slices that now exist clearly in the master audit.

### Missing Phase A — Core State Authority

Needed for:

- `B1-001`
- `B1-003`
- `B1-004`
- `B1-006`
- `B1-011`
- `B1-013`

Why missing:

- no current phase covers current-plan authority, lifecycle normalization, lock semantics, confirmed-vs-filled semantics, and stage integrity as one coherent implementation slice

### Missing Phase B — Dashboard State And Progress Authority

Needed for:

- `B1-008`
- `B1-009`
- `B1-010`
- partly `B3-002`

Why missing:

- Phase 4 touches this, but only partially and under the old gap model
- the master audit shows dashboard logic is now part of a larger state-authority problem

### Missing Phase C — Research And Checklist Integrity

Needed for:

- `B2-002`
- `B2-004`
- `B2-005`
- `B2-007`
- `B2-008`
- `B2-010`
- `B2-011`
- `B2-012`

Why missing:

- the current Phase 5 only covers structured visa output, not the actual integrity problem across research status, checklist generation, and document identity

### Missing Phase D — Post-Arrival Execution Consistency

Needed for:

- `B3-001`
- `B3-002`
- `B3-003`
- `B3-005`
- `B3-006`
- `B3-008`
- `B3-009`
- `B3-010`

Why missing:

- Phase 3 and Phase 4 split this domain incorrectly
- the master audit shows it should be treated as one execution-consistency family

### Missing Phase E — Guide Artifact Integrity

Needed for:

- `B4-002`
- `B4-003`

Why missing:

- no current phase addresses guide snapshot binding or logical guide identity uniqueness/current-pointer behavior

### Missing Phase F — Travel And Cost Surface Hardening

Needed for:

- `B5-004`
- `B5-005`
- `B5-006`

Why missing:

- current phase docs have no active planning slice for public flight API exposure, weak flight result quality, or cost-of-living authority unification

### Missing Phase G — Reliability Backstop For Derived Work

Needed for:

- `B6-004`
- `B6-005`
- `B6-007`

Why missing:

- current phases do not address the remaining runtime reliability gaps around research backstops, queue/retry ledger, or degraded-state visibility

---

## 8. Recommended Decision Per Current Phase Doc

### Archive As Historical / Completed

- `docs/phases/phase-0-chat-route-safety.md`
- `docs/phases/phase-1-profile-integrity.md`
- `docs/phases/phase-2-forbidden-pattern-cleanup.md`

### Remove From Active Phase Pack

- `docs/phases/phase-6-dashboard-documents-confidence.md`
- `docs/phases/phase-7-remaining-definition-adjustments.md`

### Rewrite, Do Not Reuse As-Is

- `docs/phases/phase-3-task-priority-progress.md`
- `docs/phases/phase-4-stage-transition-safety.md`
- `docs/phases/phase-5-research-system-refactor.md`

---

## 9. Recommended Next Phase Pack

The next phase pack should be rewritten from the master audit, not from the old gap list.

Recommended active implementation phases:

1. Core State Authority
Targets:
`B1-001`, `B1-003`, `B1-004`, `B1-006`, `B1-011`, `B1-013`

2. Dashboard State And Progress Authority
Targets:
`B1-008`, `B1-009`, `B1-010`, part of `B3-002`

3. Research And Checklist Integrity
Targets:
`B2-002`, `B2-004`, `B2-005`, `B2-007`, `B2-008`, `B2-010`, `B2-011`, `B2-012`

4. Post-Arrival Execution Consistency
Targets:
`B3-001`, `B3-002`, `B3-003`, `B3-005`, `B3-006`, `B3-008`, `B3-009`, `B3-010`

5. Guide Artifact Integrity
Targets:
`B4-002`, `B4-003`

6. Travel And Cost Surface Hardening
Targets:
`B5-004`, `B5-005`, `B5-006`

7. Reliability Backstop For Derived Work
Targets:
`B6-004`, `B6-005`, `B6-007`

Documentation-only work should not be a front-line implementation phase now.

It should be handled after the code phases, or only where needed to keep docs honest.

---

## 10. Additional Governance Finding

`docs/phase-status.md` is no longer a trustworthy representation of the real active phase plan.

Why:

- it still presents the old audit-based phase ladder
- it does not reflect the new master-audit-based planning baseline
- it treats some old phases as active/not-started even though their work is resolved, obsolete, or no longer correctly scoped

This should be updated only after the new phase pack is written.

---

## 11. Final Result

The current phase documents are not fully usable as the next implementation roadmap.

Precise conclusion:

- some are already effectively complete
- some are obsolete
- some still point at real work but need full rewrite
- several important master-audit workstreams have no phase document at all

So the correct next step is:

1. keep this audit as the decision layer for the old phase docs
2. write a new phase pack from `master-alignment-audit.md`
3. then update `docs/phase-status.md` to reflect the new active sequence
