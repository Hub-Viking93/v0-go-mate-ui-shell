TIMELINE SYSTEM — CANONICAL SYSTEM DEFINITION
GoMate — Chronological Backbone System
Version: 1.0 (Authoritative Specification)

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: NOT_IMPLEMENTED

V1 Implementation Reality:
- No timeline_items table exists in the database
- No timeline generation, computation, or display code exists
- No chronological orchestration layer of any kind
- This is a 698-line specification with zero lines of implementation
- Timeline is classified as MISSING in docs/audit.md

V1 Deviations from Canonical Spec:
- The entire spec (Sections A–T) describes a system that does not exist in v1
- No time positioning of artifacts, no computed_date, no relative offsets
- No timeline states (scheduled/upcoming/due/overdue/completed/skipped/cancelled)
- No move date dependency computation
- No timeline versioning or regeneration

V1 Cross-Reference Adjustments:
- 6+ definitions reference Timeline System as a dependency — in v1, these
  references are fictional
- Task deadlines (settling-in-tasks.md Section F): tasks have deadline fields
  but no timeline system computes or manages them
- Progress tracking (pre_arrival_progress): cannot derive from non-existent
  timeline milestones
- Data Update DAG: timeline is not a node in any cascade

V1 Fallback Behavior:
- Chronological awareness: tasks have deadline_at fields set from
  arrival_date + deadline_days, and arrival updates recompute anchored
  deadlines, but there is still no timeline entity or orchestration layer
- Execution ordering: provided by task dependency graph (computeAvailableTasks),
  not by timeline positioning
- Compliance timing: settling-in tasks expose deadline_at, urgency, and
  overdue state through GET /api/settling-in, but only as task metadata
- No "what's next" temporal view exists

============================================================

============================================================
A. CORE PURPOSE, ROLE & SYSTEM BOUNDARIES
============================================================

A.1 Canonical Purpose

The Timeline System is the single chronological orchestration layer of a relocation plan.

Its primary purpose is to:

- sequence all relocation-related artifacts in time
- provide execution order clarity
- track compliance timing requirements
- support planning, execution, and monitoring

Timeline unifies three functional roles:

1. Planning tool → shows future sequence
2. Compliance tracker → ensures deadlines are visible and monitored
3. Execution guide → shows user what to do and when

Timeline is NOT a content-generating system.

Timeline only positions and tracks artifacts created by other systems.

Timeline is a temporal orchestration layer — not a decision layer.


A.2 Timeline vs Other Systems Boundary

Timeline DOES:

- assign time positions to artifacts
- compute execution dates
- track chronological state
- track completion status
- trigger time-based notifications

Timeline DOES NOT:

- generate requirements
- generate tasks
- generate recommendations
- determine visa eligibility
- determine relocation strategy
- store canonical artifact content

Timeline stores references, not ownership.



============================================================
B. TIMELINE ENTITY MODEL & STRUCTURE
============================================================

B.1 Timeline Entity Definition

Timeline is defined as:

A plan-version-scoped ordered collection of Timeline Items.

Canonical identity:

timeline.plan_id
timeline.plan_version

Invariant:

Exactly ONE active timeline exists per plan version.


B.2 Timeline Item Definition

Timeline Item is defined as:

A time-positioned reference to an actionable or informational artifact.

Canonical structure:

id (UUID)
plan_id
plan_version

source_system
source_id
source_type

title
description

relative_offset_days (integer, nullable)
base_date_type (enum, nullable)

scheduled_date (absolute date, nullable)

computed_date (absolute date, required once resolved)

state

created_at
updated_at


B.3 Timeline Item Types

Allowed types:

task
requirement
booking
milestone
event
deadline
reminder
checkpoint

No additional types allowed without system schema upgrade.



============================================================
C. OWNERSHIP, IDENTITY & ISOLATION
============================================================

C.1 Plan Ownership

Timeline is strictly scoped to:

plan_id
plan_version

Timeline cannot exist independently.


C.2 Destination Dependency

Destination is NOT part of timeline identity.

Destination is a generation input only.

Destination is derived from plan.

Timeline does not store destination_id.


C.3 Visa Dependency

Visa type is NOT part of timeline identity.

Visa type is a generation input only.

Timeline reflects visa through generated artifacts.


C.4 Single Active Timeline Guarantee

Invariant:

For each plan_version:

exactly ONE timeline exists where:

status = active



============================================================
D. TIMELINE GENERATION & TRIGGER MODEL
============================================================

D.1 Creation Trigger (Two-Dimensional State Model)

Timeline creation uses the canonical two-dimensional state model (see plan-system.md Section C):
- LifecycleState: CREATED / ACTIVE / LOCKED / ARCHIVED / DELETED / CORRUPTED
- Stage: collecting / generating / complete / arrived

DEPRECATED: "plan.status = ACTIVE" — this field does not exist in the two-dimensional model.

Timeline Existence Rule:
A Timeline MUST exist for a plan as soon as:
- LifecycleState is NOT in {ARCHIVED, DELETED, CORRUPTED}
- requirements_set exists (current pointer set)
- tasks_set exists (current pointer set)

Timeline is valid for ALL stages (collecting through arrived) once prerequisites exist.
Timeline is NOT gated by stage.

Stage Relationship:
Stage affects which timeline items are highlighted/active, eligible for "due/overdue", or hidden/collapsed.
Stage does NOT gate timeline existence.
- Stage = collecting/generating: timeline may exist in "planning" mode (future items only)
- Stage = complete: timeline shows full pre-move and arrival sequences
- Stage = arrived: timeline activates post-arrival items, enables deadline enforcement

LifecycleState Relationship:
- ACTIVE: timeline is mutable, can be regenerated
- LOCKED: timeline is frozen, no regeneration (snapshot preserved)
- ARCHIVED/DELETED: timeline remains for audit but is not active


D.2 Regeneration Triggers (domain events — see event-trigger-system.md C.2)

Timeline regeneration occurs when any of the following domain events fire:

- plan.move_date_changed / plan.move_date_set (date anchor change)
- plan.destination_changed / plan.destination_set (structural change — full rebuild)
- requirements.generated (new requirement set version)
- checklist.generated (new task set version)
- recommendation.selected_current (may affect visa processing timeline)
- booking.confirmed / booking.cancelled (booking items change)

Gating rules:
- LifecycleState MUST NOT be in {LOCKED, ARCHIVED, DELETED} for regeneration
- Prerequisites MUST still be present (requirements + tasks)


D.3 Partial vs Full Regeneration

Rule:

Date-only changes (move_date_changed, move_date_set):

→ recompute computed_date for all relative-offset items only

Structure changes (destination_changed, requirements.generated, checklist.generated):

→ incremental regeneration — add/remove/update items while preserving completion state

Plan version change (profile_version_id changes triggering new requirement + task sets):

→ full rebuild from new prerequisites

Completed items MUST be preserved across all regeneration types (see G.3).



============================================================
E. INPUTS, DEPENDENCIES & SOURCE SYSTEM CONTRACT
============================================================

E.1 Source Systems

Timeline receives artifacts from:

Task System
Requirement System
Booking System
Visa System
Recommendation System (milestones only)
Guide System
Notification System (reminder triggers only)


Timeline NEVER generates items independently.


E.2 Source-of-Truth Contract

Timeline stores:

Reference + snapshot metadata

Canonical truth remains in source system.

Timeline fields synchronized:

title
description
state
completion



============================================================
F. TIME MODEL & DATE COMPUTATION
============================================================

F.1 Time Model Type

Timeline uses hybrid model:

absolute date OR relative offset


F.2 Relative Offset Definition

Storage format:

relative_offset_days INTEGER

base_date_type ENUM:

MOVE_DATE
ARRIVAL_DATE
VISA_APPROVAL_DATE
VISA_ISSUE_DATE


Example:

-90
+14
0


F.3 Computed Date Contract

Canonical formula:

computed_date =
base_date + relative_offset_days

Fallback hierarchy:

MOVE_DATE
ARRIVAL_DATE
VISA_APPROVAL_DATE
PLAN_CREATED_DATE


If base date missing:

item state = scheduled (unresolved)



============================================================
G. MOVE DATE DEPENDENCY & UPDATE CONTRACT
============================================================

G.1 Move Date Requirement

Move date is NOT required for timeline creation.

Timeline will exist in partial unresolved state.


G.2 Move Date Change Behavior

When move date changes:

system MUST:

recompute all computed_date
recalculate state
recalculate notification schedule


G.3 Completion Preservation Rule

Completed items remain completed regardless of recomputed date.

Completion is permanent.



============================================================
H. STATE MODEL & STATE MACHINE
============================================================

H.1 Allowed States

scheduled
upcoming
due
overdue
completed
skipped
cancelled


No other states allowed.


H.2 State Transition Rules

scheduled → upcoming

when computed_date exists


upcoming → due

when:

computed_date <= current_date


due → overdue

when:

current_date > computed_date + overdue_threshold


due → completed

when completion event received


H.3 Completion Authority

Completion may be set by:

User
Task System
Booking System

Requirement System (automatic if verified)



============================================================
I. UPDATE, REGENERATION & DATA CONSISTENCY
============================================================

I.1 Update Sources

Timeline updates when:

source artifact updates
plan updates
move date updates


I.2 Completion Preservation During Regeneration

Matching logic:

source_system
source_id
plan_version

Completion state preserved.


I.3 Deletion Behavior

When source artifact deleted:

timeline item state = cancelled

Item NOT deleted.



============================================================
J. USER EXPERIENCE CONTRACT
============================================================

J.1 Timeline Display Formats

Supported views:

chronological list (canonical default)
calendar view
milestone roadmap


J.2 Sorting Guarantee

Primary sort:

computed_date ASC

Secondary sort:

created_at ASC


J.3 Navigation Contract

Supported navigation:

scroll
jump to today
jump to overdue
jump to next item



============================================================
K. RELATIONSHIP WITH TASK SYSTEM
============================================================

K.1 Task Integration Model

Tasks are referenced timeline items.

Timeline is not task owner.


K.2 Completion Sync Contract

When task completed:

timeline_item.state = completed

Immediately synced.



============================================================
L. RELATIONSHIP WITH BOOKING SYSTEM
============================================================

L.1 Booking Integration Model

ALL bookings appear in timeline.

Critical bookings marked milestone.



============================================================
M. RELATIONSHIP WITH NOTIFICATION SYSTEM
============================================================

M.1 Notification Triggers

Notifications triggered:

7 days before due
1 day before due
same day
overdue


M.2 Notification Idempotency

Deduplication key:

timeline_item_id
notification_type



============================================================
N. VERSIONING MODEL
============================================================

N.1 Timeline Version Identity

Timeline tied to:

plan_id
plan_version


N.2 Version Transition

New plan version:

new timeline created

old timeline archived



============================================================
O. PERSISTENCE, DEDUPLICATION & DATA INTEGRITY
============================================================

O.1 Storage Model

Canonical table:

timeline_items


O.2 Deduplication Rule

Unique constraint:

plan_id
plan_version
source_system
source_id


O.3 Ordering Guarantee

ORDER BY:

computed_date ASC
created_at ASC



============================================================
P. FAILURE HANDLING & RECOVERY
============================================================

P.1 Generation Failure Behavior

Timeline marked:

status = generation_failed

Retry automatically.


P.2 Recovery Model

Regeneration resumes from last successful checkpoint.



============================================================
Q. CONCURRENCY, RACE CONDITIONS & LOCKING
============================================================

Q.1 Concurrent Generation Protection

Lock:

timeline_generation_lock(plan_id)


Q.2 Concurrent Updates

Last-write-wins for metadata

Completion protected.



============================================================
R. EMPTY STATE & INITIALIZATION CONTRACT
============================================================

R.1 Empty Timeline Definition

Timeline empty ONLY if:

timeline does not exist.


R.2 Loading Contract

Timeline loads:

all upcoming items
all overdue items
last 30 completed items

Pagination enabled.



============================================================
S. INVARIANTS (CRITICAL NON-NEGOTIABLE RULES)
============================================================

Timeline MUST ALWAYS:

belong to one plan version
never duplicate items
preserve completed state
maintain chronological order
never generate items independently
never silently delete items
never exist partially generated without status flag

Timeline is the canonical chronological execution layer of GoMate.


============================================================
T. CROSS-SYSTEM REFERENCES
============================================================

T.1 Upstream (provides items to timeline)
- Settling-in Task System (settling-in-tasks.md) — tasks as timeline items (source_type=task)
- Local Requirements System (local-requirements.md) — requirements as timeline items (source_type=requirement)
- Booking System (booking-system.md) — bookings as timeline items (source_type=booking)
- Recommendation System (recommendation-system.md) — milestones from selected path
- Guide Generation System (guide-generation.md) — NOT a source (guide is output, not timeline input)

T.2 Downstream (consumes timeline data)
- Dashboard System — displays timeline summary, upcoming items, overdue count
- Notification System (notification-system.md) — timeline drives deadline-based notifications (Section M)
- Progress Tracking System (progress-tracking-system.md) — MAY use timeline milestone completion for pre_arrival_progress
- Chat System — may reference timeline for "what's next" advisory

T.3 Orchestration
- Event/Trigger System (event-trigger-system.md) — domain events trigger timeline regeneration
- Data Update System (data-update-system.md) — timeline is a DAG node regenerated after requirements + tasks

T.4 Shared Contracts
- Plan LifecycleState × Stage: plan-system.md Section C (timeline uses both dimensions)
- Profile versioning: profile_version_id defined in profile-system.md Section G
- Task dependencies: settling-in-tasks.md Section B.7 (timeline ordering respects task DAG)
- Completion sync: task.status_changed events update timeline item state (Section K.2)

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Settling-in Tasks | PARTIAL |
| Local Requirements System | NOT_IMPLEMENTED |
| Booking System | MINIMAL |
| Recommendation System | MINIMAL |
| Guide Generation System | PARTIAL |
| Dashboard System | PARTIAL |
| Notification System | MINIMAL |
| Progress Tracking System | PARTIAL |
| Event Trigger System | NOT_IMPLEMENTED |
| Data Update System | NOT_IMPLEMENTED |
| Profile System | PARTIAL |
