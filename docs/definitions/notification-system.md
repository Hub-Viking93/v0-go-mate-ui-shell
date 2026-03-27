GoMate — Notification System Definition (Final Contract Specification)
=====================================================================

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: MINIMAL

V1 Implementation Reality:
- No notification_queue table, no notifications table, no notification
  persistence of any kind exists in the database
- No notification channels (email, push, in-app toasts) are implemented
- The only notification-like feature is the compliance alerts component
  (components/compliance-alerts.tsx), which displays hardcoded alert
  categories based on task status
- Compliance alert dismissals are stored in localStorage (not server-side)
- No Event System exists to trigger notifications (event-trigger-system.md
  is NOT_IMPLEMENTED)
- No notification preferences, delivery tracking, or digest system

V1 Deviations from Canonical Spec:
- Section A (notification system): NOT_IMPLEMENTED — no notification
  infrastructure exists; compliance alerts are a standalone UI component
- Section B (trigger model): NOT_IMPLEMENTED — no domain event triggers;
  alerts are computed on dashboard load from task data
- Section C (notification types): NOT_IMPLEMENTED — no deadline, overdue,
  completion, or system notifications; only static compliance alert cards
- Section D (delivery channels): NOT_IMPLEMENTED — no email, push, or
  in-app notification delivery
- Section E (persistence): NOT_IMPLEMENTED — no notification storage;
  dismissals use localStorage only
- Section F (preferences): NOT_IMPLEMENTED — no user notification settings

V1 Cross-Reference Adjustments:
- Event System: does not exist — no events trigger notifications
- Timeline System: does not exist — no deadline-based notification triggers
- Task System: compliance alerts read task data directly, not via events
- Progress System: no progress-based notifications

V1 Fallback Behavior:
- Compliance awareness: the compliance-alerts.tsx component shows alert
  cards based on task completion state, computed on each dashboard render
- Dismissal: users can dismiss alerts; dismissal state persists in
  localStorage (cleared on browser data reset)
- No proactive notifications — user must visit dashboard to see alerts

============================================================


A. PURPOSE, RESPONSIBILITY & SCOPE BOUNDARIES
=====================================================================

A.1 Core Purpose

PRIMARY PURPOSE:

The Notification System exists to actively alert the user about time-sensitive, compliance-critical, or action-required events that require attention and cannot rely on passive UI discovery.

Mandatory purposes:

MUST:

- ensure legal compliance
- prevent missed deadlines
- guide user actions required for relocation
- alert about failures or risks
- reflect system state changes that block or advance relocation progress

OPTIONAL:

- confirm completed milestones
- recommendation availability alerts


NEVER PURPOSE:

- marketing
- engagement nudging without relocation impact
- general information already visible without urgency


Notification System is an ACTION-TRIGGERED ALERT SYSTEM — not an information feed.



A.2 Functional Responsibility Boundaries


IN SCOPE:

- compliance deadline alerts
- requirement due reminders
- requirement overdue alerts
- task reminders
- guide ready alerts
- guide updated alerts
- timeline milestone alerts
- profile blocking progress alerts
- system failure alerts affecting plan


OUT OF SCOPE:

- marketing
- tips
- passive UI information
- recommendations without urgency
- anything not tied to plan artifact



A.3 Criticality Classification


Criticality levels are a deterministic enum:


CRITICAL

Definition:

Legal, compliance, or residency risk.

Examples:

- missed residence registration
- visa expiry risk
- required registration overdue


HIGH

Definition:

Required action required soon.

Examples:

- deadline approaching
- required document missing


MEDIUM

Definition:

Important but not urgent.

Examples:

- guide ready
- profile incomplete


LOW

Definition:

Informational.

Examples:

- recommendation available



Criticality mapping is defined centrally by Notification System.

Source systems cannot assign criticality.



A.4 System Guarantees


HARD GUARANTEES:

The system MUST guarantee:

- no duplicate notifications for same event
- correct plan isolation
- correct user isolation
- deterministic trigger timing
- persistent storage
- deterministic ordering
- notification delivered to in-app channel


BEST EFFORT:

- email delivery
- push delivery




=====================================================================
B. NOTIFICATION IDENTITY MODEL
=====================================================================


B.1 Unique Notification Definition


Canonical identity:

notification_id (UUID)

Required attributes:

notification_id
user_id
plan_id
notification_type
artifact_type
artifact_id
trigger_event
idempotency_key
created_at


Uniqueness rule:

A notification is uniquely defined by:

idempotency_key


Idempotency key format:

notification_type + artifact_type + artifact_id + plan_id



Two notifications with same idempotency_key MUST NEVER exist.




B.2 Ownership Model


Notifications MUST belong to:

user_id
AND
plan_id

Never global.




B.3 Artifact Linkage Contract


Artifact linkage is REQUIRED.

Notification MUST reference exactly one artifact:

task_id
requirement_id
timeline_event_id
guide_id
recommendation_id
plan_id
profile_id


Notifications without artifact linkage are invalid.



B.4 Notification Type System


Closed enum:


REQUIREMENT_DEADLINE

REQUIREMENT_OVERDUE

TASK_REMINDER

GUIDE_READY

GUIDE_UPDATED

PROFILE_INCOMPLETE

PLAN_READY

TIMELINE_MILESTONE

SYSTEM_ERROR

RECOMMENDATION_READY




=====================================================================
C. NOTIFICATION TRIGGER CONTRACT
=====================================================================


C.1 Trigger Sources

Notifications are triggered by DOMAIN EVENTS routed through the Event System (event-trigger-system.md).

The Notification System subscribes to events — it does NOT poll source systems.

Source systems that emit events consumed by Notification System:

- Local Requirements System (local-requirements.md) — requirement deadline/overdue events
- Settling-in Task System (settling-in-tasks.md) — task status changes, reminder triggers
- Timeline System (timeline-system.md) — milestone due/overdue events
- Guide Generation System (guide-generation.md) — guide.generated, guide.outdated events
- Recommendation System (recommendation-system.md) — recommendation.generated events
- Profile System (profile-system.md) — profile completion state
- Plan System (plan-system.md) — plan lifecycle events
- Event/Trigger System (event-trigger-system.md) — event routing infrastructure

Source systems do NOT create notifications directly. They emit domain events; the Notification System maps those events to notification records.




C.2 Trigger Mechanism

HYBRID SYSTEM with two trigger modes:

Event-driven (immediate — consumed from Event System):

| Domain Event | → Notification Type |
|-------------|-------------------|
| guide.generated | GUIDE_READY |
| guide.outdated | GUIDE_UPDATED |
| plan.created | PLAN_READY |
| system.error | SYSTEM_ERROR |
| recommendation.generated | RECOMMENDATION_READY |

Scheduled (time-based — computed from Timeline System deadlines):

| Schedule Trigger | → Notification Type |
|-----------------|-------------------|
| requirement deadline approaching | REQUIREMENT_DEADLINE |
| requirement deadline passed | REQUIREMENT_OVERDUE |
| task reminder due | TASK_REMINDER |
| timeline milestone approaching | TIMELINE_MILESTONE |
| profile incomplete for N days | PROFILE_INCOMPLETE |

Each notification record MUST store:

source_event_id (UUID, nullable) — the Event System event_id that triggered this notification (for event-driven notifications)
source_event_type (string) — the domain event name (e.g., guide.generated)

For scheduled notifications, source_event_id is null; source_event_type records the schedule trigger type.




C.3 Trigger Timing Contract


Deadline notifications:

7 days before deadline

3 days before deadline

1 day before deadline

At deadline

24h after missed deadline



Exact timing is deterministic and globally configured.



C.4 Trigger Idempotency


Idempotency key:

notification_type + artifact_id + plan_id


Before creation:

system checks existence.

If exists → DO NOTHING.




=====================================================================
D. DELIVERY CONTRACT
=====================================================================


D.1 Supported Channels


Mandatory:

In-app notification center


Optional:

Email

Push (future)



D.2 Channel Responsibility Boundary


Notification System:

Creates notification


Delivery system:

Delivers notification asynchronously




D.3 Delivery Guarantees


In-app:

Guaranteed


Email:

Best effort


Retry rules:

5 retries

Retry intervals:

1m
5m
30m
6h
24h



D.4 Read Model Contract


DELIVERED:

Notification persisted in database


SEEN:

Notification displayed in UI


READ:

User clicks notification




=====================================================================
E. TIMING, TIMEZONE & SCHEDULING CONTRACT
=====================================================================


E.1 Timezone Source of Truth


Canonical timezone:

Destination timezone




E.2 Deadline Calculation Contract


Timeline System owns deadline calculation.

Notification System only consumes deadlines.



E.3 Scheduling Engine


Executed by:

Background worker queue


Failed jobs retry automatically.




=====================================================================
F. NOTIFICATION STATE MACHINE
=====================================================================


F.1 Canonical States


CREATED

DELIVERED

SEEN

READ

DISMISSED

EXPIRED

FAILED



F.2 State Transitions


CREATED → DELIVERED

DELIVERED → SEEN

SEEN → READ

READ → DISMISSED

DELIVERED → DISMISSED

CREATED → FAILED

DELIVERED → EXPIRED


Forbidden:

DISMISSED → CREATED

READ → CREATED




F.3 State Ownership


Notification system:

CREATED

FAILED

EXPIRED


Frontend:

SEEN

READ

DISMISSED




=====================================================================
G. USER INTERACTION CONTRACT
=====================================================================


G.1 Click Behavior


Click ALWAYS navigates to artifact.


Deterministic mapping:

Requirement → Requirement page

Task → Task page

Guide → Guide viewer

Timeline → Timeline

Plan → Plan dashboard




G.2 Dismiss Behavior


Dismiss is permanent.

CRITICAL notifications CANNOT be dismissed until artifact resolved.




G.3 Snooze Behavior


NOT SUPPORTED

To prevent compliance risk.




=====================================================================
H. DEDUPLICATION & IDEMPOTENCY GUARANTEES
=====================================================================


H.1 Duplicate Prevention


Guaranteed via idempotency_key unique constraint.




H.2 Re-trigger Handling


If artifact changes:

NEW notification created ONLY if:

deadline changed

status worsened

new risk introduced




=====================================================================
I. PERSISTENCE & STORAGE CONTRACT
=====================================================================


I.1 Persistence Guarantee


Notifications stored permanently.


Retention:

Indefinite




I.2 Deletion Rules


User:

Cannot delete


System:

Can archive


Admin:

Can delete




I.3 Audit Requirement


YES

Full history preserved.




=====================================================================
J. SYNC WITH UNDERLYING SYSTEMS
=====================================================================


J.1 Artifact Deletion Handling


Notification remains.

Marked INVALID.




J.2 Artifact Update Handling


Notification NOT updated.

New notification created if needed.




=====================================================================
K. FAILURE HANDLING & RELIABILITY
=====================================================================


K.1 Delivery Failure Handling


Retry 5 times.

Then FAILED state.




K.2 System Crash Recovery


Worker resumes from queue.

No loss possible.




K.3 Consistency Guarantees


Strong consistency.




=====================================================================
L. USER PREFERENCES & CONTROL CONTRACT
=====================================================================


L.1 Notification Preferences


User can configure:

Email

Push


User CANNOT disable:

CRITICAL

HIGH




L.2 Mandatory Notifications


Mandatory:

REQUIREMENT_DEADLINE

REQUIREMENT_OVERDUE

SYSTEM_ERROR




=====================================================================
M. CROSS-PLAN ISOLATION GUARANTEE
=====================================================================


M.1 Plan Isolation Rule


Notifications belong to exactly one plan.




M.2 Plan Switching Behavior


User sees ONLY current plan notifications.




M.3 Plan Deletion Behavior


Notifications archived.

Never deleted automatically.




=====================================================================
N. INTEGRATION WITH EVENT SYSTEM
=====================================================================


N.1 Event Mapping (Canonical — Full Table)

The Notification System consumes domain events from the Event System (event-trigger-system.md C.2).

Complete event-to-notification mapping:

| Domain Event (Event System) | → Notification Type | Criticality | Artifact Type |
|----------------------------|--------------------|-----------  |--------------|
| guide.generated | GUIDE_READY | MEDIUM | guide |
| guide.outdated | GUIDE_UPDATED | MEDIUM | guide |
| recommendation.generated | RECOMMENDATION_READY | LOW | recommendation |
| plan.created | PLAN_READY | MEDIUM | plan |
| system.error | SYSTEM_ERROR | CRITICAL | plan |
| requirement.deadline_approaching | REQUIREMENT_DEADLINE | HIGH | requirement |
| requirement.overdue | REQUIREMENT_OVERDUE | CRITICAL | requirement |
| task.status_changed (to overdue) | TASK_REMINDER | HIGH | task |
| timeline.milestone_due | TIMELINE_MILESTONE | MEDIUM | timeline_event |
| settling.compliance_complete | (congratulatory) | LOW | plan |

Events NOT in this table are NOT consumed by the Notification System.

Criticality is ASSIGNED by the Notification System (A.3) — source systems cannot override it.


N.2 Idempotency With Event System

Each notification stores source_event_id (the Event System event_id).

Deduplication rule:

Before creating a notification, check:
- If a notification exists with the same idempotency_key → DO NOTHING
- If a notification exists with the same source_event_id → DO NOTHING (prevents reprocessing on retry)

This provides two-layer deduplication: semantic (idempotency_key) and infrastructure (source_event_id).


N.3 Event Ordering Guarantee

Notifications are created in event receipt order.

If two events arrive for the same artifact (e.g., guide.generated then guide.outdated), both create separate notifications in chronological order. The UI displays the most recent active notification prominently.




=====================================================================
O. UX EMPTY STATE CONTRACT
=====================================================================


O.1 Empty State Definition


Empty means:

No ACTIVE notifications.


Dismissed notifications excluded.




O.2 First-time User Behavior


NO notification shown.




=====================================================================
P. SECURITY & DATA INTEGRITY CONTRACT
=====================================================================


P.1 Access Control


Enforced at database level and backend level.




P.2 Data Integrity Guarantees


Notification cannot be created unless artifact exists.


Foreign key required.



=====================================================================
Q. CROSS-SYSTEM REFERENCES
=====================================================================


Q.1 Upstream (events consumed by Notification System)

- Event/Trigger System (event-trigger-system.md) — domain event routing infrastructure; all event-driven notifications originate here
- Timeline System (timeline-system.md) — deadline computation for scheduled notifications (Section M); milestone due/overdue events
- Guide Generation System (guide-generation.md) — guide.generated, guide.outdated events
- Recommendation System (recommendation-system.md) — recommendation.generated events
- Settling-in Task System (settling-in-tasks.md) — task.status_changed events (overdue detection)
- Local Requirements System (local-requirements.md) — requirement deadline/overdue computation
- Plan System (plan-system.md) — plan.created, plan lifecycle events
- Profile System (profile-system.md) — profile completion state for PROFILE_INCOMPLETE scheduled trigger

Q.2 Downstream (systems that read notifications)

- Dashboard System (dashboard.md) — Alerts Card displays active notifications (Section C.1 card catalog)
- Frontend notification center — primary in-app delivery channel

Q.3 Shared Contracts

- Event taxonomy: event-trigger-system.md Section C.2 (domain event names used in N.1 mapping table)
- source_event_id: references Event System event_id for deduplication and audit
- Timeline deadline computation: timeline-system.md Section F (computed_date drives scheduled notification timing)
- Criticality classification: owned by Notification System (A.3) — source systems CANNOT assign criticality
- Plan isolation: notifications scoped to plan_id, consistent with all plan-scoped artifacts
- Progress compliance: progress-tracking-system.md Section J.2 (settling.compliance_complete event triggers congratulatory notification)

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |
| Guide Generation System (guide-generation.md) | PARTIAL |
| Recommendation System (recommendation-system.md) | MINIMAL |
| Settling-in Tasks (settling-in-tasks.md) | PARTIAL |
| Local Requirements System (local-requirements.md) | NOT_IMPLEMENTED |
| Plan System (plan-system.md) | PARTIAL |
| Profile System (profile-system.md) | PARTIAL |
| Dashboard System (dashboard.md) | PARTIAL |
| Progress Tracking System (progress-tracking-system.md) | PARTIAL |


=====================================================================
R. SYSTEM INVARIANTS
=====================================================================


Invariant 1: Notification System consumes domain events — it NEVER polls source systems directly.

Invariant 2: Criticality is assigned by Notification System only — source systems cannot override.

Invariant 3: Every notification stores source_event_id (nullable) and source_event_type for audit.

Invariant 4: Two-layer deduplication: idempotency_key (semantic) + source_event_id (infrastructure).

Invariant 5: CRITICAL and HIGH notifications cannot be disabled by user preferences (L.1).

Invariant 6: Notifications are plan-scoped — strict plan isolation (M.1).

Invariant 7: Notification creation requires artifact linkage — no orphan notifications (B.3).


=====================================================================
END OF SYSTEM DEFINITION
=====================================================================