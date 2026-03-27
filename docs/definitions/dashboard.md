# GoMate — Dashboard System Definition

The Dashboard is the PRIMARY control surface of GoMate.
It is a deterministic state-driven UI backed by canonical backend progress and artifact state.

The dashboard NEVER invents state.
It only renders and triggers explicitly allowed actions.

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Dashboard exists and renders plan state, task progress, and navigation
  to guide/chat/tasks/booking
- Progress is computed INLINE on the dashboard by counting completed vs
  total REQUIRED tasks — this violates the spec (Section V forbids
  dashboard computing progress) but is the v1 reality
- Compliance alerts component (components/compliance-alerts.tsx) shows
  alert cards based on task status; dismissals stored in localStorage
- Dashboard is stage-aware — different content shown for
  collecting/generating/complete/arrived stages
- No unified Progress System — dashboard queries tasks directly and
  computes its own progress percentage
- No formal dashboard state machine — UI logic is in React components

V1 Deviations from Canonical Spec:
- Section A (state-driven UI): PARTIAL — dashboard renders plan state but
  computes progress itself rather than reading from Progress System
- Section B (progress display): VIOLATED — dashboard computes progress
  inline (spec Section V explicitly forbids this)
- Section C (stage rendering): COMPLIANT — dashboard adapts display based
  on plan.stage
- Section D (artifact cards): PARTIAL — guide card, tasks card exist; no
  visa recommendation card, no timeline card, no document checklist card
- Section E (action triggers): PARTIAL — "Generate Guide", "Confirm
  Arrival" actions exist; no "Refresh Recommendation" or "Regenerate
  Checklist" actions
- Section F (compliance alerts): PARTIAL — alerts exist but use localStorage
  dismissals, not server-side notification system

V1 Cross-Reference Adjustments:
- Progress System: violated — dashboard computes its own progress
- Notification System: minimal — compliance alerts are a standalone
  component, not fed by a notification system
- Timeline System: does not exist — no timeline summary on dashboard
- Visa Recommendation: no standalone visa card — visa info is in guide
- Document Checklist: no document progress display

V1 Fallback Behavior:
- Plan status: dashboard shows current stage and progress correctly
- Task progress: computed inline from task data (works, but violates spec)
- Navigation: links to guide viewer, chat, tasks, and booking page work
- Compliance alerts: visible and dismissible via localStorage

============================================================

---

# A. PURPOSE, JOB-TO-BE-DONE & CONTRACT

---

## A.1 Core Purpose

The Dashboard serves FIVE roles in strict priority order:

Priority 1 — Status Hub  
Answer: Where am I?

Priority 2 — Next-Step Navigator  
Answer: What should I do next?

Priority 3 — Blocker Alert System  
Answer: What is blocking me?

Priority 4 — Output Viewer  
Answer: What has been generated?

Priority 5 — Control Panel  
Answer: What actions can I trigger?

Priority is non-negotiable.
Blockers and next actions ALWAYS appear above summaries.

---

## A.2 Primary User Questions Dashboard Must Answer

Dashboard MUST always answer:

1 What is my current relocation status
2 What is my next best action
3 What is missing
4 What is blocked
5 What exists and is ready
6 What changed since last visit

Failure to answer these is a system failure.

---

## A.3 Definition of Done for Dashboard Session

A dashboard session is considered successful if ANY of the following occurs:

- user completes a missing required field
- user confirms profile
- user triggers artifact generation
- user resolves blocker
- user understands current state and exits

Dashboard success is measured as PROGRESS DELTA OR STATE COMPREHENSION.

---

## A.4 Dashboard Output Contract

Dashboard is allowed to:

- display plan status
- display progress
- display artifacts
- trigger actions via explicit CTA
- allow explicit user edits
- unlock plan via explicit user action

Dashboard is NOT allowed to:

- modify profile silently
- trigger expensive generation automatically
- mark incomplete fields complete
- display inferred values as confirmed

---

## A.5 Cost & Safety Contract

Expensive operations MUST be click-triggered only.

Never auto-trigger:

- guide generation
- checklist generation
- visa overview generation

Free operations:

- progress calculation
- artifact status fetch
- cached artifact display

---

# B. SOURCE OF TRUTH

---

## B.1 Canonical Progress Function

Progress is computed ONLY by the Progress Tracking System (progress-tracking-system.md).

Dashboard consumes MULTIPLE progress domains:

- interview_progress — profile completeness (collecting stage)
- post_arrival_progress — compliance task completion (arrived stage)
- overall_plan_progress — optional aggregate (if defined)

Each progress domain returns:

progress_percentage (0–100, integer, floor-rounded)
numerator_value (completed items)
denominator_value (total required items)
progress_type (enum)

For interview_progress specifically, the legacy output schema is:

required_fields[]
filled_fields[]
missing_fields[]
completion_percentage
blockers[]
field_reason_codes

Dashboard MUST NEVER compute progress locally.
Dashboard MUST NOT combine progress_types into a single bar without explicit aggregate definition.
Each progress_type is rendered independently with its own label and context.

Cross-reference: progress-tracking-system.md Section A.1 (progress_type enum), Section D (per-domain formulas), Section I (UX contract).

---

## B.2 Field Counting Rules

Progress includes ONLY required fields.

Optional fields excluded.

Required fields determined by:

destination
purpose
citizenship

Dynamic field list per plan.

---

## B.3 Definition of Filled

Field is filled ONLY if:

value exists

AND

valid format

AND

confidence = explicit

Inferred values DO NOT count.

---

## B.4 Field Validity

Invalid fields:

count as missing

Stale fields:

count as missing

Contradictory fields:

count as invalid

---

## B.5 Component Autonomy Rule

No dashboard component may compute progress independently.

All progress must come from canonical function.

---

## B.6 Plan Specific Progress

Progress is computed per plan.

User may have multiple plans.

Dashboard shows ONLY current plan.

---

## B.7 Debuggability

Dashboard may optionally display:

missing field reasons

Reason codes:

MISSING

INVALID

UNCONFIRMED

STALE

---

# C. CARD / WIDGET SYSTEM

---

## C.1 Card Catalog

Canonical card types:

Resume Interview Card

Missing Fields Card

Plan Summary Card

Checklist Progress Card

Guide Card

Visa Overview Card

Alerts Card

Changes Card

---

## C.2 Card Behavior Rules

Each card defines:

show_condition

hide_condition

inputs

freshness

actions

---

Example:

Resume Interview Card

Show when:

missing required fields exist

Hide when:

interview complete

CTA:

Resume Interview

---

Guide Card

Show when:

guide exists OR ready for generation

CTA:

Generate Guide OR View Guide

---

## C.3 Card Priority Order

Strict order:

1 Blockers

2 Resume Interview

3 Profile Confirmation

4 Artifact Generation

5 Artifact Display

6 Insights

---

## C.4 Cross Card Dependency

Artifacts only visible if profile confirmed.

No card may contradict progress function.

---

# D. SYNC WITH CHAT / PROFILE / ARTIFACTS

---

## D.1 Data Ownership

Dashboard reads from:

relocation_plans

profile_fields

artifact_records

progress_snapshot

Never from client cache.

---

## D.2 Fetch Order

Dashboard load order:

1 plan summary

2 progress snapshot

3 artifact status

4 artifact previews

---

## D.3 Race Conditions

Backend state always authoritative.

Dashboard refreshes after any write.

Generation status updated via polling.

---

## D.4 Consistency Guarantees

Dashboard guarantees:

progress matches backend

artifact state accurate

plan state accurate

---

## D.5 Change Detection

Dashboard displays:

last_updated_at from plan

Artifact freshness indicator

---

# E. DASHBOARD STATES

---

## E.1 Dashboard State Enum (UI-Layer Convenience)

Dashboard states are a separate UI-layer enum, NOT a replacement for the canonical two-dimensional state model (plan-system.md Section C).
Dashboard states are DERIVED (never stored) from canonical state. They are computed on each dashboard load.

Canonical Dashboard States:

NO_PLAN — user has no current plan
CTA: Create Plan

PLAN_EXISTS_PROFILE_EMPTY — plan exists, interview not started
CTA: Start Interview

INTERVIEW_IN_PROGRESS — interview active, profile incomplete
CTA: Resume Interview

PROFILE_READY_UNCONFIRMED — interview complete, profile not yet confirmed
CTA: Confirm Profile

PROFILE_CONFIRMED — profile confirmed, artifacts not yet generated
CTA: Generate Artifacts

ARTIFACTS_GENERATING — artifact generation in progress
Show: loading state per artifact

ARTIFACTS_READY — all artifacts generated and current
Show: artifact cards with actions

POST_ARRIVAL — user has arrived, settling-in mode active
Show: compliance progress, task list, timeline

PLAN_LOCKED — plan locked (frozen)
Show: locked badge, read-only artifacts

PLAN_ARCHIVED — plan archived
Show: read-only historical view

---

## E.2 Dashboard State Derivation Table

Dashboard state is derived from (LifecycleState, Stage, interview_progress, artifact_status):

| LifecycleState | Stage       | interview_progress | Artifact Status    | → Dashboard State              |
|----------------|-------------|--------------------|--------------------|-------------------------------|
| (no plan)      | —           | —                  | —                  | NO_PLAN                       |
| CREATED/ACTIVE | collecting  | 0%                 | —                  | PLAN_EXISTS_PROFILE_EMPTY     |
| ACTIVE         | collecting  | 1-99%              | —                  | INTERVIEW_IN_PROGRESS         |
| ACTIVE         | collecting  | 100%               | unconfirmed        | PROFILE_READY_UNCONFIRMED     |
| ACTIVE         | collecting  | 100%               | confirmed          | PROFILE_CONFIRMED             |
| ACTIVE         | generating  | 100%               | generating         | ARTIFACTS_GENERATING          |
| ACTIVE         | complete    | 100%               | ready              | ARTIFACTS_READY               |
| ACTIVE         | arrived     | 100%               | ready              | POST_ARRIVAL                  |
| LOCKED         | any         | —                  | —                  | PLAN_LOCKED                   |
| ARCHIVED       | any         | —                  | —                  | PLAN_ARCHIVED                 |

Notes:
- This table is the canonical mapping. Dashboard code MUST use this derivation.
- LifecycleState and Stage are defined in plan-system.md Section C.
- interview_progress is from Progress Tracking System (progress-tracking-system.md).
- "confirmed" means profile has been explicitly confirmed by user.

---

## E.3 POST_ARRIVAL Dashboard Mode

When dashboard state = POST_ARRIVAL:
- Show: compliance progress bar (post_arrival_progress from Progress Tracking System)
- Show: overdue tasks prominently (Priority 3 — Blocker Alert System)
- Show: upcoming tasks with deadlines
- Show: timeline summary
- Show: artifact cards (guide, recommendations) in read/reference mode
- CTA: Mark tasks complete, navigate to task detail

Cross-reference: progress-tracking-system.md Section A.1 (post_arrival_progress)

---

# F. DASHBOARD ACTIONS

---

## F.1 Supported CTAs

Resume Interview

Confirm Profile

Generate Guide

Generate Checklist

Refresh Artifact

Lock Plan

Unlock Plan

Create New Plan

---

## F.2 Action Preconditions

Example:

Generate Guide requires:

profile_confirmed = true

---

## F.3 Action Semantics

Each action emits a domain event via the Event System (event-trigger-system.md):

| CTA | Domain Event Emitted | Notes |
|-----|---------------------|-------|
| Resume Interview | (navigation only — no event) | Redirects to chat |
| Confirm Profile | profile.confirmed | Triggers profile_version snapshot |
| Generate Guide | guide.regenerate_requested | Explicit user trigger ONLY (guide-generation.md C.1) |
| Generate Checklist | checklist.regenerate_requested | Explicit user trigger |
| Refresh Artifact | artifact.refresh_requested | Per artifact_type in payload |
| Lock Plan | plan.locked | Freezes plan and progress |
| Unlock Plan | plan.forked | Creates new plan via fork semantics (plan-system.md D.6) |
| Create New Plan | plan.created | Independent new plan (no parent) |

Backend queues generation job via Data Update System (data-update-system.md) where applicable.

IMPORTANT: Guide generation is NEVER triggered automatically by dashboard load or artifact cascade. It requires explicit user action (guide-generation.md C.2).

---

## F.4 Idempotency Rules

Generate Guide:

if guide exists and profile unchanged:

return existing guide

Never duplicate.

---

## F.5 Action Feedback

After click:

show loading

show generating state

update on completion

---

## F.6 Undo Rules

Unlock plan creates new version.

Original remains immutable.

---

# G. ERRORS & RETRIES

---

## G.1 Error Levels

Inline error:

card level failure

Toast:

temporary failure

Full page error:

dashboard cannot load

---

## G.2 Retry Strategy

Retry once automatically

Then manual retry required

---

## G.3 Graceful Degradation

Dashboard must render even if artifacts fail.

Progress must always render.

---

## G.4 Integrity Protection

Never show:

complete if incomplete

artifact ready if stale

---

## G.5 Telemetry

Log:

user_id

plan_id

endpoint

error_code

latency

---

# H. METRICS & EVENTS

---

Events:

dashboard_opened

cta_clicked

artifact_generated

artifact_failed

profile_confirmed

plan_locked

---

# I. DATA FRESHNESS & VERSIONING

---

## I.1 Artifact Binding

Artifacts bound to:

plan_id

profile_version

---

## I.2 Stale Rules

Artifact marked stale when:

profile changes

destination changes

move date changes

---

## I.3 Stale UX

Show badge:

Out of date

CTA:

Refresh

---

## I.4 Cache Strategy

Artifacts cached server-side

Invalidated on profile change

---

# J. SECURITY & PRIVACY

---

## J.1 Sensitive Data Rules

Sensitive fields masked when needed.

Example:

income partially masked

---

## J.2 Least Privilege

Dashboard fetches only required fields.

---

## J.3 Export Rules

Export requires explicit user action.

Never automatic.

---

# K. CROSS-SYSTEM REFERENCES

---

## K.1 Upstream (Dashboard reads from)

- Plan System (plan-system.md) — LifecycleState, Stage, plan summary, current pointers
- Profile System (profile-system.md) — profile_version_id, confirmed status, missing fields
- Progress Tracking System (progress-tracking-system.md) — interview_progress, post_arrival_progress, overall_plan_progress
- Guide Generation System (guide-generation.md) — guide artifact status, staleness
- Recommendation System (recommendation-system.md) — current recommendation status
- Cost of Living System (cost-of-living.md) — cost artifact status, staleness
- Settling-in Task System (settling-in-tasks.md) — task completion, compliance status
- Timeline System (timeline-system.md) — upcoming items, overdue count
- Local Requirements System (local-requirements.md) — requirement set status

## K.2 Downstream (Dashboard triggers)

- Event/Trigger System (event-trigger-system.md) — CTA clicks emit domain events (Section F.3)
- Guide Generation System — guide.regenerate_requested (explicit user trigger only)
- Data Update System (data-update-system.md) — artifact refresh via cascade

## K.3 Shared Contracts

- Plan LifecycleState × Stage: plan-system.md Section C (dashboard state derivation uses both dimensions)
- Dashboard State Derivation: Section E.2 of this document (canonical mapping table)
- Progress domains: progress-tracking-system.md Section A.1 (progress_type enum)
- Profile versioning: profile_version_id defined in profile-system.md Section G
- Artifact staleness: all artifact systems define STALE lifecycle; dashboard displays staleness indicators
- Guide generation gate: guide-generation.md C.1/C.2 (dashboard is the primary UI surface for explicit guide trigger)

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Plan System (plan-system.md) | PARTIAL |
| Profile System (profile-system.md) | PARTIAL |
| Progress Tracking System (progress-tracking-system.md) | PARTIAL |
| Guide Generation System (guide-generation.md) | PARTIAL |
| Recommendation System (recommendation-system.md) | MINIMAL |
| Cost of Living System (cost-of-living.md) | PARTIAL |
| Settling-in Tasks (settling-in-tasks.md) | PARTIAL |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |
| Local Requirements System (local-requirements.md) | NOT_IMPLEMENTED |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |
| Data Update System (data-update-system.md) | NOT_IMPLEMENTED |

---

# SYSTEM INVARIANTS

Invariant 1:

Dashboard never mutates profile silently.

Invariant 2:

Progress computed server-side only — per progress_type, from Progress Tracking System.

Invariant 3:

Artifacts tied to profile version (profile_version_id).

Invariant 4:

Dashboard reflects backend state exactly — dashboard states are DERIVED, never stored.

Invariant 5:

User actions always explicit — no auto-trigger of expensive operations.

Invariant 6:

Dashboard state is computed from (LifecycleState, Stage, interview_progress, artifact_status) on each load — see E.2 derivation table.

Invariant 7:

Each progress_type rendered independently — no implicit combination into single bar.

Invariant 8:

Guide generation requires explicit user CTA — dashboard MUST NOT auto-trigger guide generation.

---

# END OF DASHBOARD DEFINITION