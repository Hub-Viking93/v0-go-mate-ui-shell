GoMate — Progress Tracking System
MASTER SYSTEM DEFINITION
Canonical Behavioral Contract
Version: 1.0
Authority: Progress Tracking System

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- No unified Progress Tracking System exists as a distinct service
- Progress is computed inline at two points:
  1. Interview progress: the state machine in lib/gomate/state-machine.ts
     tracks which profile fields are collected; profile-schema.ts defines
     the field list
  2. Post-arrival progress: computed on the dashboard by counting completed
     vs total REQUIRED tasks inline (no separate progress system)
- No required_fields_registry table — required fields are defined in
  lib/gomate/profile-schema.ts
- No progress events (INTERVIEW_COMPLETED, COMPLIANCE_COMPLETE)
- No pre_arrival_progress or overall_plan_progress metrics

V1 Deviations from Canonical Spec:
- Section A (unified system): NOT_IMPLEMENTED — progress is computed ad-hoc
  in multiple places, not by a single authoritative system
- Section B (required_fields_registry): NOT_IMPLEMENTED — required fields
  defined in application code (profile-schema.ts), not in a database table
- Section D (calculation logic): PARTIAL — interview progress is implicit in
  the state machine; post-arrival progress is computed inline on dashboard
- Section E (single source of truth): VIOLATED — dashboard computes its own
  progress, which the spec explicitly forbids (Section V)
- Section J (completion transitions): NOT_IMPLEMENTED — no completion events
  fire; guide generation eligibility is gated by the state machine, not by
  a progress percentage reaching 100%
- Section K (lock interaction): NOT_IMPLEMENTED — no LifecycleState=LOCKED

V1 Cross-Reference Adjustments:
- Event System: no progress events emitted
- Dashboard System: computes progress inline (violates spec Section V, but
  this is the v1 reality)
- Guide Generation: gated by state machine reaching appropriate stage, not
  by interview_progress = 100%
- Profile versioning: progress not bound to profile_version_id

V1 Fallback Behavior:
- Interview completeness: state machine tracks field collection; when enough
  fields are collected, the interview transitions to plan creation
- Post-arrival compliance: dashboard counts completed REQUIRED tasks / total
  REQUIRED tasks and displays a progress bar
- No formal progress API endpoint — each consumer computes its own view

============================================================

============================================================
A. PURPOSE & CONTRACT
============================================================

Core Purpose

The Progress Tracking System is the single authoritative system responsible for determining completion and readiness across ALL progress domains of a relocation plan.

It exists to:

1. Measure completion of required relocation profile data (interview progress)
2. Measure completion of pre-arrival preparation milestones (pre-arrival progress)
3. Measure completion of post-arrival settling-in tasks (compliance progress)
4. Provide readiness gating for system transitions
5. Provide UX feedback to the user
6. Trigger state transitions across GoMate systems
7. Serve as the single source of truth for ALL progress metrics

Progress Tracking is a STATE AUTHORITY SYSTEM with MULTIPLE PROGRESS DOMAINS.

It is NOT a UI feature.

It is NOT an interpretation.

It is a deterministic state engine.

It is ONE unified system — NOT separate systems per domain.


A.1 Progress Type Enum (Canonical)

The Progress System supports multiple progress_type values:

- interview_progress — profile completeness, plan readiness (pre-plan through collecting stage)
- pre_arrival_progress — optional: preparation milestones before move (complete stage)
- post_arrival_progress — settling-in task compliance (arrived stage)
- overall_plan_progress — optional aggregate across domains

Each progress record MUST include:
- plan_id (UUID)
- progress_type (enum)
- progress_percentage (0–100, integer, floor-rounded)
- numerator_value (int — completed items)
- denominator_value (int — total required items)
- calculated_at (timestamptz)
- version_reference (string — profile_version_id for interview, task_set_version for post_arrival, etc.)


A.2 Ownership Boundaries

Progress Tracking System does NOT own the source data.
It DERIVES progress from authoritative systems:

- interview_progress → derived from Profile System (confirmed required fields vs required_fields_registry)
- pre_arrival_progress → derived from Timeline System (pre-move milestones completed)
- post_arrival_progress → derived from Task System (REQUIRED tasks with status=COMPLETED)
- overall_plan_progress → derived aggregate of above types (weighted, explicitly defined)

Progress System MUST be read-only and computed.
It MUST NEVER mark tasks complete, modify profile data, or change plan state.


A.3 Calculation Independence

Each progress_type is calculated INDEPENDENTLY.

- Completion of interview_progress MUST NOT automatically imply completion of post_arrival_progress.
- Each progress_type has its own completion threshold (interview = 100% required fields, post_arrival = 100% required tasks).
- Combined/aggregate progress is always explicitly defined as a weighted formula, never a simple average.


Critical Decisions That Depend on Progress

Progress directly controls:

interview_progress controls:
- Guide generation eligibility (100% required)
- Recommendation system activation (sufficient fields)
- Plan readiness state
- Chat interview completion state
- Plan lock eligibility

post_arrival_progress controls:
- Dashboard compliance status
- Compliance alert urgency
- Task generation completion indication

pre_arrival_progress controls (optional):
- Dashboard preparation status
- Pre-move checklist completeness


Systems That Consume Progress

Dashboard
- Reads: interview_progress, post_arrival_progress, overall_plan_progress
- Read timing: On dashboard load, on progress update event
- Read method: Server query to Progress System
- Caching: Cached client-side, invalidated on progress update event

Chat System
- Reads: interview_progress (for interview completion state)
- Read timing: Before each assistant message generation
- Read method: Server-side injection from Progress System
- Caching: No caching allowed

Plan System
- Reads: interview_progress (for plan readiness gating)
- Read timing: On completion transition event
- Read method: Event subscription
- Caching: No caching allowed

Guide Generation System
- Reads: interview_progress (100% required for generation eligibility)
- Read timing: On completion event only
- Read method: Event-based trigger
- Caching: No caching allowed

Recommendation System
- Reads: interview_progress (sufficient fields for recommendation)
- Read timing: On completion event and profile change
- Read method: Server query
- Caching: May cache until invalidated by progress change

Task Generation System
- Reads: interview_progress (prerequisites for task generation)
- Read timing: On completion event
- Read method: Event subscription
- Caching: No caching allowed

Onboarding State Machine
- Reads: interview_progress (for onboarding flow state)
- Read timing: On progress update event
- Read method: Event subscription
- Caching: No caching allowed

Settling-in Task System
- Reads: post_arrival_progress is DERIVED FROM this system (reverse relationship)
- Progress System reads task completion data FROM Task System
- Task System does NOT read progress — it provides the source data


Contract Guarantee

100% progress guarantees:

- Interview completion
- Guide generation eligibility
- Dashboard completion state
- Recommendation system activation
- Task generation eligibility

This guarantee is absolute and deterministic.


============================================================
B. CANONICAL REQUIRED FIELDS DEFINITION
============================================================

Required Field Definition

A required field is any profile data field that MUST be present and valid to generate a legally and operationally correct relocation plan.

A field qualifies as required ONLY if its absence prevents safe plan generation.


Required Field Registry

Canonical source:

DATABASE

Table:
required_fields_registry

This is the ONLY allowed source.

No system may define required fields outside this registry.


Dynamic Required Field Logic

Required fields are determined using:

required_fields =
base_required_fields
+ destination_required_fields
+ visa_required_fields
+ intent_required_fields


Evaluation Timing

Required fields are determined:

Runtime dynamic on server.


Required Field Invariants

Required fields MUST:

- Exist only in required_fields_registry
- Be evaluated only by Progress System
- Never differ across systems
- Never be defined client-side


============================================================
C. COMPLETION DEFINITION
============================================================

Canonical Completion Logic

completion = TRUE only if:

all required fields exist
AND
all required fields pass validation


Completion Authority

ONLY the Progress System determines completion.


Completion Confirmation Model

Automatic only.

No manual completion allowed.


Completion Transition Triggers

Completion triggers:

INTERVIEW_COMPLETED event


============================================================
D. PROGRESS CALCULATION LOGIC
============================================================

D.1 Per-Domain Formulas

interview_progress:
progress_percentage = floor((valid_required_fields / total_required_fields) * 100)
Source: Profile System required_fields_registry

post_arrival_progress (compliance):
progress_percentage = floor((completed_required_tasks / total_required_tasks) * 100)
Source: Task System (settling-in-tasks.md H.3) — REQUIRED tasks only

pre_arrival_progress (optional):
progress_percentage = floor((completed_pre_move_milestones / total_pre_move_milestones) * 100)
Source: Timeline System (pre-move milestone items)

overall_plan_progress (optional aggregate):
progress_percentage = weighted combination of above types (weights explicitly defined, not implicit)


D.2 Valid Item Criteria

For interview_progress, a field is valid if it:
- exists in the profile
- passes validation rules
- is not expired
- is not invalidated

For post_arrival_progress, a task counts as completed if:
- task.status = COMPLETED
- task.classification = REQUIRED
- task.is_stale = false


D.3 Partial Credit Rules

No partial credit allowed.

Items are either valid/completed or not.


D.4 Calculation Location

SERVER ONLY


D.5 Rounding Behavior

Rounded down (floor integer)


============================================================
E. SINGLE SOURCE OF TRUTH
============================================================

Owner:

Progress System


Storage Model

Authoritative stored value:
NONE

Progress is ALWAYS computed.

Never trusted from stored value.


============================================================
F. UPDATE TRIGGERS
============================================================

interview_progress triggers:
- Chat extraction (profile fields updated)
- Manual profile edit
- Plan creation (new required_fields set)
- Destination change (required_fields may change dynamically)
- Visa change (visa-specific required fields)
- Intent change
- Profile reset / plan reset

post_arrival_progress triggers:
- task.status_changed (domain event — see event-trigger-system.md C.2)
- checklist.generated (new task set created)
- Task regeneration (profile_version change)

pre_arrival_progress triggers:
- Timeline milestone completion
- Booking confirmation
- Pre-move preparation item completion


Update Timing

Immediate synchronous recomputation (all progress_types affected by the trigger)


Update Authority

Progress System only — no other system may compute or store progress values


============================================================
G. SYNC SEMANTICS
============================================================

Progress → Dashboard

Push via event


Progress → Chat

Server-side injection


Progress → Plan System

Event trigger


Consistency Guarantee

Strong consistency


Sync Timing

Immediate


============================================================
H. EDGE CASES
============================================================

Dynamic Required Fields Change

Progress is recomputed immediately


Progress Decrease

Allowed: YES

UX Behavior:

User shown updated percentage immediately


Invalid Field Detected

Field marked invalid

Progress recalculated


Field Removed

Progress recalculated


Multiple Plans

Progress isolated per plan


Partial Profile Reset

Progress recalculated immediately


============================================================
I. UX CONTRACT
============================================================

I.1 interview_progress UX:

0%: "Interview not started"
1-99%: Progress percentage bar + "X of Y fields complete"
100%: "Interview complete" — immediate visual transition

I.2 post_arrival_progress UX:

0%: "No tasks completed yet"
1-99%: Compliance progress bar + "X of Y required tasks complete"
100%: "All compliance tasks complete" — celebration state

I.3 Display Rules:

- UI MAY display multiple progress indicators simultaneously (e.g., interview + compliance).
- UI MUST NOT combine progress_types into a single bar without explicit aggregate definition.
- Each progress_type rendered independently with its own label and context.

I.4 Common UX States:

Progress Decrease: Show updated lower progress immediately (applies to all types)
Loading: Show spinner per progress_type
Error: Show retry state
Locked: Show frozen progress (interview_progress after plan lock)


============================================================
J. COMPLETION TRANSITION
============================================================

J.1 interview_progress Completion

Event Name: INTERVIEW_COMPLETED (profile.completed in Event System taxonomy)

Triggered Systems:
- Guide generation eligibility unlocked
- Dashboard transition to "plan ready" state
- Task generation eligibility unlocked (requires requirements first)
- Recommendation activation

Idempotency: Must fire only once per plan

J.2 post_arrival_progress Completion

Event Name: COMPLIANCE_COMPLETE (or settling.compliance_complete)

Triggered Systems:
- Dashboard shows "All compliance tasks complete" state
- Notification system sends congratulatory notification
- Progress metric frozen at 100%

Idempotency: Must fire only once per plan

J.3 Completion Independence

interview_progress completion does NOT trigger post_arrival_progress completion.
Each domain completes independently based on its own criteria.


============================================================
K. LOCK INTERACTION
============================================================

After Plan Lock

Progress cannot change


Lock Authority

Plan System


============================================================
L. PERSISTENCE VS COMPUTED
============================================================

Progress Stored:

NO


Computed:

Server only


Caching:

Short-lived server cache allowed


============================================================
M. ERROR HANDLING
============================================================

On desync:

Progress recomputed


User UX:

Silent correction


============================================================
N. LIFECYCLE STATES (per progress_type)
============================================================

States:

NOT_STARTED — no items exist for this progress_type (e.g., no required fields defined, no tasks generated)

IN_PROGRESS — some items completed, not all

COMPLETE — all required items completed (100% for this progress_type)

LOCKED — plan locked, progress frozen (applies to interview_progress; post_arrival may continue after lock)

Each progress_type has its own independent lifecycle state.


============================================================
O. PERFORMANCE & SCALING
============================================================

Computation:

On change only

Caching:

Server cache allowed


============================================================
P. MULTI DEVICE CONSISTENCY
============================================================

Strong consistency

Server authoritative


============================================================
Q. OBSERVABILITY
============================================================

Log:

Progress recalculation
Completion events


============================================================
R. MIGRATION
============================================================

Registry versioned

Recompute on migration


============================================================
S. SYSTEM INVARIANTS
============================================================

Invariant 1: Progress System is sole authority for ALL progress metrics (interview, post-arrival, aggregate).

Invariant 2: Completion determined ONLY by Progress System — no other system may declare completion.

Invariant 3: Completion event fires once per progress_type per plan (idempotent).

Invariant 4: interview_progress computed only from required_fields_registry + Profile System.

Invariant 5: post_arrival_progress computed only from REQUIRED task completion (settling-in-tasks.md).

Invariant 6: Each progress_type is calculated independently — completion of one does NOT imply completion of another.

Invariant 7: Progress is always computed, never trusted from stored value (Section E).

Invariant 8: Progress System is read-only — it MUST NEVER modify source data (profile fields, task status).


============================================================
T. TESTING REQUIREMENTS
============================================================

Test:

Progress increase

Progress decrease

Dynamic required fields

Completion trigger

Sync correctness

Failure recovery


============================================================
U. FAILURE RECOVERY
============================================================

Recompute on load

Repair automatically


============================================================
V. FORBIDDEN BEHAVIOR
============================================================

Dashboard calculating progress: FORBIDDEN

Chat calculating progress: FORBIDDEN

Guide generation bypassing completion: FORBIDDEN


============================================================
W. CROSS-SYSTEM REFERENCES
============================================================

W.1 Source Systems (Progress System reads from)
- Profile System (profile-system.md) — required_fields_registry + profile field values for interview_progress
- Settling-in Task System (settling-in-tasks.md) — REQUIRED task completion status for post_arrival_progress
- Timeline System (timeline-system.md) — pre-move milestones for pre_arrival_progress

W.2 Consumer Systems (read progress from this system)
- Dashboard System — displays all progress_types
- Chat System — interview completion state for chat mode switching
- Plan System (plan-system.md) — plan readiness gating
- Guide Generation System (guide-generation.md) — generation eligibility
- Recommendation System (recommendation-system.md) — activation threshold
- Onboarding System (onboarding-system.md) — interview flow state
- Notification System — compliance alert urgency based on post_arrival_progress

W.3 Shared Contracts
- Plan LifecycleState × Stage: plan-system.md Section C
- Profile versioning: profile_version_id defined in profile-system.md Section G
- Event taxonomy: profile.completed triggers INTERVIEW_COMPLETED (event-trigger-system.md C.2)
- Task compliance: settling-in-tasks.md H.3 defines the compliance formula this system derives from

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Profile System | PARTIAL |
| Settling-in Tasks | PARTIAL |
| Timeline System | NOT_IMPLEMENTED |
| Dashboard System | PARTIAL |
| Chat Interview System | PARTIAL |
| Plan System | PARTIAL |
| Guide Generation System | PARTIAL |
| Recommendation System | MINIMAL |
| Onboarding System | PARTIAL |
| Notification System | MINIMAL |


============================================================
FINAL CONTRACT
============================================================

This specification is absolute.

All GoMate systems MUST comply.

Progress Tracking System is the sole authority on ALL progress metrics.

Progress is computed per progress_type, independently, from authoritative source systems.

Each progress_type has its own completion threshold and lifecycle.

No system may compute, store, or cache progress independently.

Undefined behavior is not allowed.