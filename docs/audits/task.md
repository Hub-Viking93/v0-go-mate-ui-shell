# Alignment Audit Task Plan

> Status: Active execution plan
> Location: `docs/audits/`
> Purpose: Define the exact batch-by-batch process for the full definitions-to-implementation alignment audit
> Depends on: `docs/audits/document-authority.md`

---

## 1. What This File Is

This file is the execution manual for the post-phase alignment audit.

It exists so future work can be started with a simple instruction like:

- "Read `docs/audits/task.md` and run Batch 1"
- "Read `docs/audits/task.md` and run Batch 2"

Each batch below defines:

- exactly what domain it covers
- which documents must be read
- how the audit must be performed
- what outputs must be produced
- what counts as done
- why that batch exists in that order

This file is **not** the audit itself.

It is the operational plan for producing that audit correctly.

---

## 2. How To Use This File

If a future session is told to run a batch, the execution order is:

1. Read `CLAUDE.md`
2. Read `docs/audits/document-authority.md`
3. Read this file: `docs/audits/task.md`
4. Read the specified inputs for the requested batch
5. Execute only that batch unless explicitly told to continue
6. Produce the required batch output
7. Stop and report:
   - what was audited
   - what gaps were found
   - what files were created or updated
   - what the next batch should do

If the user says "run Batch N", do not skip ahead to later batches unless explicitly requested.

---

## 3. Global Rules For Every Batch

These rules apply to every batch without exception.

### 3.1 Authority Model

Use `docs/audits/document-authority.md` as the governance contract:

- `docs/definitions/` = canonical target model
- code/runtime/backend audit = current reality
- `docs/systems/` = descriptive current-state evidence
- `docs/audits/definitions-vs-system-audit.md` = current gap register to update or supersede

### 3.2 Audit Method

Every batch must compare:

```text
definitions -> code/database/runtime/frontend
```

`docs/systems/` must be used as supporting evidence, not as canonical authority.

### 3.3 Required Loop

For each batch, repeat this loop until no new significant gaps are found:

1. Read target definitions
2. Read system docs for current-state framing
3. Inspect real code, API routes, DB usage, and frontend callers
4. Record mismatches
5. Re-scan the same domain for missed mismatches
6. Reclassify anything that was incorrectly categorized

Do not stop after a single pass if the second pass reveals new mismatch types.

### 3.4 Mandatory Audit-Patch-Re-Audit Closure Rule

Every batch is governed by a mandatory closure loop:

```text
audit -> identify gaps -> patch docs/code/plan as needed for that batch -> re-audit -> repeat
```

This loop is mandatory.

A batch is **not** complete when the first audit is written.

A batch is complete only when:

- the scoped audit for that batch has been performed
- all gaps that belong inside the scope of that batch have been resolved, classified, or explicitly deferred
- any corrections required to make the batch internally coherent have been applied
- a fresh re-audit of the same batch scope finds no unresolved correctness issues that should have been handled within that batch
- the batch can honestly be marked with a final result of:
  - `PASS`

If the batch re-audit still finds unresolved in-scope issues, the batch result is **not PASS** and work must continue.

This means every batch must end with a final section that explicitly states:

- `Final Result: PASS`

before any later batch may begin.

### 3.5 What Counts As A Patch In The Closure Loop

The word "patch" in the closure loop does **not** only mean code edits.

Depending on what the audit finds, patching may include:

- correcting stale or contradictory system docs
- refining the batch output audit document
- updating the gap classification
- adding explicit deferral decisions
- writing follow-up implementation tasks
- making code fixes if the user explicitly wants immediate correction during batch execution

The required outcome is that the batch scope becomes internally correct and audit-complete.

### 3.6 Batch Exit Rule

No batch may hand off uncertainty to the next batch if that uncertainty belongs to the current batch.

Allowed handoff:

- dependencies that truly belong to a later batch
- cross-batch notes that do not block a PASS result for the current batch

Forbidden handoff:

- unresolved contradictions inside the current batch scope
- missing classification for gaps discovered in the current batch
- stale documentation inside the current batch scope that was already identified but left uncorrected

### 3.7 Allowed Outcomes Per Gap

Every gap found in a batch must end in one of these classifications:

- `code_fix_now`
- `phase_candidate`
- `definition_alignment`
- `intentional_v1_minimal`
- `defer_v2`

No gap may be left as vague "needs work".

### 3.8 Batch Output Rule

Every batch must produce one concrete output file under `docs/audits/`.

Recommended naming:

- `alignment-batch-1-core-state.md`
- `alignment-batch-2-research-intelligence.md`
- `alignment-batch-3-post-arrival-execution.md`
- `alignment-batch-4-artifacts-guidance.md`
- `alignment-batch-5-booking-housing-travel.md`
- `alignment-batch-6-chat-history-events.md`

Later, those batch outputs are merged into one master audit.

---

## 4. Batch Sequence

The audit must be executed in this order.

This order is deliberate.

The early batches define state authority and artifact dependencies that later batches rely on.

---

## 5. Batch 1 — Core State and Progress

### 5.1 Name

`Batch 1 — Onboarding / Profile / Plan / Dashboard / Progress`

### 5.2 Why This Batch Comes First

This batch defines the system's core state model.

Everything else depends on it:

- what a plan is
- what the authoritative current plan is
- what stage/lifecycle mean
- how profile state is stored
- how onboarding state transitions work
- how dashboard state is derived
- how progress is computed

If this batch is unclear, later batches will misclassify downstream gaps.

### 5.3 Scope

Audit these domains together:

- onboarding system
- profile system
- plan system
- dashboard system
- progress tracking system
- chat interview state authority where it affects profile/plan state

### 5.4 Required Inputs

Read these files before auditing:

- `docs/audits/document-authority.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
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
- relevant code in:
  - `app/api/profile/route.ts`
  - `app/api/plans/route.ts`
  - `app/api/progress/route.ts`
  - `app/(app)/dashboard/page.tsx`
  - `lib/gomate/profile-schema.ts`
  - `lib/gomate/state-machine.ts`
  - `lib/gomate/progress.ts`

### 5.5 Audit Questions

Answer all of these:

- What is the canonical plan authority object?
- What is the actual current-plan selector?
- Is lifecycle authority stored canonically or inferred?
- Is stage being used where lifecycle should be used?
- Is profile completeness computed from the canonical rules?
- Is dashboard state truly derived from canonical backend state?
- Is progress centralized or recomputed in multiple places?
- Which state transitions are optimistic, non-atomic, stale, or duplicated?

### 5.6 Required Output

Create:

- `docs/audits/alignment-batch-1-core-state.md`

That file must include:

- systems audited
- current reality summary
- canonical target summary
- gap table
- dependency notes for later batches
- recommended phase candidates

### 5.7 Done Criteria

Batch 1 is done only when:

- no new core-state mismatch appears in a second pass
- every state/progress mismatch has an outcome classification
- later batches can treat plan/profile/progress authority as fixed context

---

## 6. Batch 2 — Research and Relocation Intelligence

### 6.1 Name

`Batch 2 — Research / Visa / Local Requirements / Checklist`

### 6.2 Why This Batch Comes Second

This batch consumes core plan/profile state and produces downstream intelligence artifacts.

It must come after Batch 1 because:

- research binding depends on profile/plan authority
- checklist shape depends on visa/local-requirements outputs
- artifact staleness depends on upstream identity/version logic

### 6.3 Scope

Audit these domains together:

- research system
- visa recommendation / visa research
- local requirements
- document checklist
- source fetch and extraction behavior as it affects research correctness

### 6.4 Required Inputs

Read these files before auditing:

- `docs/audits/document-authority.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `docs/definitions/research-system.md`
- `docs/definitions/visa-recommendation.md`
- `docs/definitions/local-requirements.md`
- `docs/definitions/document-checklist.md`
- `docs/definitions/recommendation-system.md`
- `docs/systems/research-orchestration.md`
- `docs/systems/visa-logic.md`
- `docs/systems/source-fetch-layer.md`
- `docs/systems/extraction-layer.md`
- `docs/systems/checklist-generation.md`
- relevant code in:
  - `app/api/research/*`
  - `lib/gomate/research-*.ts`
  - `lib/gomate/checklist-generator.ts`
  - `lib/gomate/web-research.ts`
  - `lib/gomate/official-sources.ts`

### 6.5 Audit Questions

- What is the canonical source of relocation intelligence?
- Is research bound to profile/plan state deterministically?
- Does visa output match the definition shape or just approximate it?
- Is local requirements modeled as authoritative obligations or loose research notes?
- Is checklist generation a downstream artifact or an independent parallel research system?
- Which parts are truly v1-minimal versus actually broken?
- What would it take to move checklist toward the definition without rebuilding data architecture?

### 6.6 Required Output

Create:

- `docs/audits/alignment-batch-2-research-intelligence.md`

That file must include:

- gap table
- artifact dependency chain
- v1-minimal vs canonical distinctions
- recommended implementation phases or doc-alignment phases

### 6.7 Done Criteria

Batch 2 is done only when:

- the relationship between research, visa output, local requirements, and checklist is explicitly mapped
- every mismatch has one of the allowed outcomes
- no unresolved authority confusion remains between research data and user/profile data

---

## 7. Batch 3 — Post-Arrival Execution and Compliance

### 7.1 Name

`Batch 3 — Arrival / Settling-In Tasks / Timeline / Compliance`

### 7.2 Why This Batch Comes Third

This batch sits on top of the state model from Batch 1 and the requirement/research context from Batch 2.

It must come after those because:

- post-arrival eligibility depends on plan/stage authority
- task generation often depends on requirements and checklist artifacts
- compliance/timeline semantics depend on task and requirement models

### 7.3 Scope

Audit these domains together:

- post-arrival stage
- settling-in task system
- task graph
- task completion via chat
- compliance timeline and alerting
- why-it-matters enrichment where it affects execution semantics

### 7.4 Required Inputs

- `docs/audits/document-authority.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `docs/definitions/settling-in-tasks.md`
- `docs/definitions/timeline-system.md`
- `docs/definitions/event-trigger-system.md` (task-related trigger expectations)
- `docs/systems/post-arrival-stage.md`
- `docs/systems/settling-in-engine.md`
- `docs/systems/settling-in-persistence.md`
- `docs/systems/task-graph.md`
- `docs/systems/task-completion-via-chat.md`
- `docs/systems/compliance-timeline.md`
- `docs/systems/why-it-matters.md`
- relevant code in:
  - `app/api/settling-in/*`
  - `app/api/progress/*`
  - `app/api/chat/route.ts`
  - `lib/gomate/settling-in-generator.ts`
  - related UI components

### 7.5 Audit Questions

- What is the canonical task identity and lifecycle?
- Are task blockers modeled correctly?
- Where are stage checks missing, duplicated, or overused?
- Does compliance derive from tasks canonically or only visually?
- Is timeline an execution artifact or just a display convenience?
- Are chat-based completion actions tied to canonical task identity?

### 7.6 Required Output

Create:

- `docs/audits/alignment-batch-3-post-arrival-execution.md`

### 7.7 Done Criteria

Batch 3 is done only when:

- task authority, stage gating, and compliance ownership are clearly mapped
- all task/compliance gaps are classified
- no new dependency on Batch 2 artifacts is discovered late without being documented

---

## 8. Batch 4 — Artifacts, Guides, Recommendations

### 8.1 Name

`Batch 4 — Guide Generation / Guide Viewer / Recommendations / Artifact Model`

### 8.2 Why This Batch Comes Fourth

Artifacts consume everything upstream:

- profile/plan state
- research outputs
- sometimes compliance context

If audited too early, artifact gaps will be misread as isolated formatting problems instead of upstream dependency issues.

### 8.3 Scope

Audit these domains:

- guide generation
- guide viewer
- recommendation system
- artifact system expectations where relevant to v1

### 8.4 Required Inputs

- `docs/audits/document-authority.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `docs/definitions/guide-generation.md`
- `docs/definitions/guide-viewer.md`
- `docs/definitions/recommendation-system.md`
- `docs/systems/guide-generation.md`
- `docs/systems/artifact-system.md`
- relevant code in:
  - `app/api/guides/*`
  - `lib/gomate/guide-generator.ts`
  - guide UI pages/components

### 8.5 Audit Questions

- What is the canonical artifact for relocation guidance?
- What inputs is the guide actually bound to?
- Is staleness/versioning real or simulated?
- Is recommendation output canonical or merely helpful metadata?
- Which artifact-system requirements are truly v2 versus required for v1 alignment?

### 8.6 Required Output

Create:

- `docs/audits/alignment-batch-4-artifacts-guidance.md`

### 8.7 Done Criteria

Batch 4 is done only when:

- guide and recommendation authority boundaries are explicit
- staleness/versioning mismatches are classified
- artifact-system expectations are split into v1-relevant and v2-deferred

---

## 9. Batch 5 — Travel, Booking, Housing

### 9.1 Name

`Batch 5 — Flights / Booking / Housing / Cost-of-Living Commercial Surfaces`

### 9.2 Why This Batch Comes Fifth

This batch covers important but less central surfaces that often have larger v2 deferral components.

It should not define the core governance model for the system.

### 9.3 Scope

Audit these domains:

- flight system
- booking system
- housing system
- cost-of-living as a planning artifact rather than just data fetch

### 9.4 Required Inputs

- `docs/audits/document-authority.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `docs/definitions/flight-system.md`
- `docs/definitions/booking-system.md`
- `docs/definitions/housing-system.md`
- `docs/definitions/cost-of-living.md`
- `docs/systems/flight-search.md`
- `docs/systems/cost-of-living.md`
- relevant code in:
  - `app/api/flights/route.ts`
  - `lib/gomate/flight-search.ts`
  - booking page/components
  - housing-related code if present

### 9.5 Audit Questions

- Which travel/booking systems are truly implemented versus only represented by search output?
- Which definition requirements are essential for v1 versus clearly v2?
- Is cost-of-living a canonical artifact, transient helper, or mixed model?
- Which persistence expectations are missing but non-blocking?

### 9.6 Required Output

Create:

- `docs/audits/alignment-batch-5-booking-housing-travel.md`

### 9.7 Done Criteria

Batch 5 is done only when:

- all major persistence and lifecycle gaps are classified as v1/v2/code/docs
- no commercial-surface feature is left in a vague "future system" state

---

## 10. Batch 6 — Chat History, Events, Data Update, Reliability, Missing Infrastructure

### 10.1 Name

`Batch 6 — Chat History / Event System / Data Update / Reliability / Missing Infrastructure`

### 10.2 Why This Batch Comes Last

This batch is mostly architectural and cross-cutting.

It should come last because it depends on understanding:

- real artifact dependencies
- actual state ownership
- where the current system already has enough inline behavior for v1
- where missing infrastructure is truly blocking

### 10.3 Scope

Audit these domains:

- chat history
- event trigger system
- data update system
- reliability contracts
- observability
- job system
- artifact system where not already covered

### 10.4 Required Inputs

- `docs/audits/document-authority.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `docs/definitions/chat-history-system.md`
- `docs/definitions/event-trigger-system.md`
- `docs/definitions/data-update-system.md`
- `docs/definitions/research-system.md`
- `docs/systems/reliability-contracts.md`
- `docs/systems/observability.md`
- `docs/systems/job-system.md`
- `docs/systems/artifact-system.md`
- `docs/systems/end-to-end-flow.md`
- relevant code across chat, guide generation, research trigger, and task mutation paths

### 10.5 Audit Questions

- Which missing infrastructure is truly necessary for v1 correctness?
- Which missing systems are only target-architecture concerns?
- Where are inline triggers acceptable v1 substitutes?
- What cross-system orchestration is currently implicit in route handlers?
- Which reliability gaps create user-visible correctness issues now?

### 10.6 Required Output

Create:

- `docs/audits/alignment-batch-6-infrastructure-gaps.md`

### 10.7 Done Criteria

Batch 6 is done only when:

- every missing infrastructure system is classified as `fix_now`, `phase_candidate`, or `defer_v2`
- cross-cutting orchestration gaps are clearly tied back to earlier batch findings

---

## 11. Merge Step — Master Alignment Audit

After all six batches are complete, create:

- `docs/audits/full-definition-alignment-audit.md`

This file must merge all batch outputs into one master audit.

### 11.1 Purpose

The master audit becomes the single working document for:

- full target-vs-reality status
- next phase planning
- definition-alignment work
- v2 deferral decisions

### 11.2 Required Contents

- executive summary
- authority note referencing `document-authority.md`
- cross-batch dependency map
- consolidated gap register
- severity summary
- recommended next phase sequence
- doc-alignment-only items
- v2 deferrals

### 11.3 Important Rule

Do not write the new phase pack directly from scattered batch notes.

Always merge first.

Then derive the new phases from the merged audit.

---

## 12. Deliverables Summary

When all work is complete, the audit program should produce:

- `docs/audits/document-authority.md`
- `docs/audits/task.md`
- `docs/audits/alignment-batch-1-core-state.md`
- `docs/audits/alignment-batch-2-research-intelligence.md`
- `docs/audits/alignment-batch-3-post-arrival-execution.md`
- `docs/audits/alignment-batch-4-artifacts-guidance.md`
- `docs/audits/alignment-batch-5-booking-housing-travel.md`
- `docs/audits/alignment-batch-6-infrastructure-gaps.md`
- `docs/audits/full-definition-alignment-audit.md`

---

## 13. One-Line Execution Commands

These are the intended shorthand instructions for future sessions:

- "Read `docs/audits/task.md` and run Batch 1"
- "Read `docs/audits/task.md` and run Batch 2"
- "Read `docs/audits/task.md` and run Batch 3"
- "Read `docs/audits/task.md` and run Batch 4"
- "Read `docs/audits/task.md` and run Batch 5"
- "Read `docs/audits/task.md` and run Batch 6"
- "Read `docs/audits/task.md` and merge all completed batches into the full alignment audit"

If the user says only:

- "run the alignment audit"

the correct default is:

- start with Batch 1

because later batches depend on Batch 1's state-authority conclusions.

---

## 14. Final Rule

This task plan must remain executable.

If future repository changes alter:

- batch ordering
- output filenames
- required inputs
- authority model

then this file must be updated before more audit work is executed.
