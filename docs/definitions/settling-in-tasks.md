GoMate — Settling-in Task System
System Definition (Answering the full Question Framework)

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Tasks exist in settling_in_tasks table with task_id, plan_id, task_key,
  title, description, category, status, dependency, and deadline fields
- Task generation uses Claude Sonnet 4 via lib/gomate/settling-in-generator.ts
  — generates tasks as AI output, not from a deterministic requirements engine
- computeAvailableTasks() implements dependency resolution via depends_on
  text[] of task UUIDs — this is WORKING correctly
- task_key column (added in Phase 3, migration 015) provides stable canonical
  identifiers and is populated during generation — analogous to spec's
  task_type_id but named differently
- [TASK_DONE:exact task title] marker protocol works for chat-based completion
- OVERDUE detection, deadline_at anchoring, urgency computation, and
  block_reason / blocked_by surfacing are implemented on the settling-in read
  path
- No profile_version_id binding — tasks are not scoped to a profile snapshot
- No requirement_set_version_id — no formal requirements system exists

V1 Deviations from Canonical Spec:
- Section B.2 (uniqueness constraint): PARTIAL — v1 uses task_key for
  deduplication (added Phase 3) but no profile_version_id in the key
- Section B.4 (schema): PARTIAL — missing profile_version_id,
  requirement_id, requirement_set_version_id, source_system, source_entity_id,
  generator_version, is_stale fields
- Section B.6 (state model): SIMPLIFIED — v1 uses status values that differ
  from the canonical 6-state enum; `locked` / `available` replace the
  canonical BLOCKED / NOT_STARTED split, `overdue` exists, and ARCHIVED does
  not
- Section C (generation triggers): SIMPLIFIED — tasks are generated via
  POST /api/settling-in/generate, not via domain events
- Section D (requirements relationship): NOT_IMPLEMENTED — no formal
  requirements system; tasks are generated directly from profile + research
- Section F (deadlines): PARTIAL — deadline_days, deadline_at, and
  deadline_anchor exist, and arrival changes recompute anchored deadlines, but
  there is no canonical deadline rule registry or timeline integration
- Section I (versioning): NOT_IMPLEMENTED — no task versioning, no stale
  marking, no completion migration between versions

V1 Cross-Reference Adjustments:
- Event System: no domain events trigger task generation
- Data Update System DAG: tasks are not a DAG node in any cascade
- Requirements System (Section D): does not exist as a formal system
- Profile versioning: tasks not bound to profile_version_id
- Timeline System: does not exist — tasks have no timeline representation

V1 Fallback Behavior:
- Task generation: user triggers via "Generate tasks" after arriving;
  Claude Sonnet 4 generates tasks based on profile + destination
- Task completion: user marks tasks done via UI or post-arrival chat
  ([TASK_DONE:title] marker protocol)
- Task dependencies: computeAvailableTasks() resolves depends_on correctly
- Compliance timing: urgency and overdue state are derived from task deadlines;
  alerts are localStorage-dismissed UI on top of those task fields

============================================================

============================================================
A. PURPOSE, DEFINITION & SCOPE BOUNDARIES
============================================================

A.1 Core Definition (Canonical)
A “Task” is a concrete, user-executable unit of work that advances the plan toward compliance or successful settling-in.
A Task MUST be:
- Actionable (something the user can do, not just read)
- Trackable (a state can change based on user action)
- Progress-contributing (at least for REQUIRED tasks)
- Time-aware (may have a deadline or timing rule, even if “none”)

A Task MUST NOT be:
- Informational-only content (that belongs in Guide)
- Abstract obligations without steps (that is a Requirement)
- Passive “nice to have” recommendations unless explicitly labeled OPTIONAL and excluded from compliance progress

Canonical “Task vs Guide” boundary:
- Guide explains and prepares the user.
- Task is the operational checklist item the user executes and marks.

A.2 Tasks vs Requirements (Critical Distinction)
Requirements:
- Represent obligations imposed by authorities/systems
- Answer: “What must be true / exist for compliance?”
- Are compliance-level artifacts
Tasks:
- Represent executable actions the user takes
- Answer: “What must I DO next?”

Strict mapping rule:
- Requirement → 0..N Tasks (0 allowed when requirement is informational or automatically satisfied by an external authority step not under user control, but this should be rare and explicit)
- Task → 0..1 Requirement (nullable for internal tasks)

Canonical contract:
- Requirements define “musts”.
- Tasks operationalize “musts” into steps.

A.3 Scope Categories (In vs Out)
IN scope task categories (GoMate generates and tracks these):
- Administrative / Legal (registration, permits, IDs)
- Immigration (permit pickup/biometrics, validation)
- Tax & Government Identity (tax ID/personal number/social security)
- Financial (bank account prerequisites when legally dependent; e.g., after ID)
- Healthcare (registration/enrollment steps)
- Housing (utility registration where legally required; address registration)
- Employment / Education (only when compliance/admin required: work authorization activation, school registration where mandatory for dependents)
- Logistics (only when operationally required for other tasks; e.g., “get local SIM” if required to receive OTP for bank/ID flow, otherwise OPTIONAL)

OUT of scope (GoMate does NOT treat these as Tasks in this system):
- Pure lifestyle advice (neighborhood tips, cultural do/don’t)
- Open-ended searches (apartment hunting browsing, “find friends”)
- Non-admin “self-improvement” items (language learning as a general goal)
These can exist in Guide or Recommendations, not in Settling-in Task System.

A.4 Mandatory vs Optional Tasks (Progress Impact)
Every Task has a strict classification:
- REQUIRED: compliance-critical OR a hard prerequisite for REQUIRED items
- RECOMMENDED: materially improves the settling process but not legally required
- OPTIONAL: quality-of-life only

Progress metrics impact:
- Compliance progress uses REQUIRED tasks only (canonical).
- “Overall settling-in progress” MAY optionally include RECOMMENDED in a separate metric, but must never contaminate compliance progress.

============================================================
B. TASK IDENTITY, UNIQUENESS & DATA MODEL
============================================================

B.1 Task Identity (Canonical IDs)
- task_id: UUID (globally unique)
- task_type_id: stable canonical identifier representing the “kind” of task (not the instance)

B.2 Task Uniqueness Constraint (Critical)
Goal: prevent duplicates across regeneration, retries, and re-opens.

Canonical uniqueness key:
UNIQUE(plan_id, profile_version_id, task_type_id)

Rationale:
- plan_id scopes tasks to a plan
- profile_version_id scopes tasks to a specific stable snapshot of user data
- task_type_id ensures the same logical task is not created twice for that snapshot

Important rule:
- If the system wants multiple instances of “the same type” (rare), it must be modeled as different task_type_id values (e.g., “REGISTER_CHILD_SCHOOL_1”, “REGISTER_CHILD_SCHOOL_2”) or use an allowed discriminator in task_type_id generation (but still stable).

B.3 Task Ownership (Canonical)
A Task belongs to:
- plan_id + profile_version_id
NOT to the user globally.

User-to-task relationship is always mediated through plan context.

B.4 Task Required Fields (Canonical Schema)
Identity:
- task_id (uuid)
- plan_id (uuid)
- profile_version_id (uuid)
- task_type_id (string, stable canonical)
Descriptive:
- title (string)
- description (string)
- category (enum)
Execution:
- status (enum)
- priority (enum/int)
- deadline_at (timestamp|null)
Traceability:
- requirement_id (uuid|null)
- requirement_set_version_id (uuid|null)  // required when requirement_id present
- source_system (enum/string)
- source_entity_id (string|null)
Metadata:
- created_at (timestamp)
- generator_version (string)
- version_number (int)
- is_stale (bool)
- stale_reason (string|null)

B.5 Task Categories (Stable Enums)
Canonical enum set:
- LEGAL
- IMMIGRATION
- TAX
- FINANCIAL
- HEALTHCARE
- HOUSING
- EMPLOYMENT
- EDUCATION
- LOGISTICS
- LIFESTYLE
- GENERAL

Rules:
- Categories are for UX grouping and filtering.
- Category does NOT determine REQUIRED/OPTIONAL; that is a separate classification field.

B.6 Task State Model (Strict)
Canonical status enum:
- NOT_STARTED
- IN_PROGRESS
- COMPLETED
- BLOCKED
- OVERDUE
- ARCHIVED

Allowed transitions (strict):
- NOT_STARTED → IN_PROGRESS | COMPLETED | BLOCKED | ARCHIVED
- IN_PROGRESS → COMPLETED | BLOCKED | ARCHIVED
- BLOCKED → NOT_STARTED | IN_PROGRESS | ARCHIVED
- OVERDUE → IN_PROGRESS | COMPLETED | BLOCKED | ARCHIVED
- COMPLETED → IN_PROGRESS | NOT_STARTED | ARCHIVED   (reversible completion)
- Any → OVERDUE is system-driven only (deadline breach), not user-driven

Rules:
- OVERDUE is a computed/system-applied state when deadline passes and task not completed.
- ARCHIVED is terminal in normal UX, but still persists for audit.

BLOCKED semantics:
- BLOCKED is an OUTCOME state, not a cause.
- The CAUSE of blocking is recorded in block_reason (see B.7).
- A task with unmet dependencies is automatically set to BLOCKED with block_reason = PREREQUISITES_INCOMPLETE.
- A task may also be manually blocked (WAITING_EXTERNAL, MISSING_INPUT, USER_DEFERRED).


B.7 Task Dependency Model (First-Class)

Task-to-task dependencies are a first-class concept.
Dependencies define execution ordering and prerequisite gating.

Dependency Definition (on task_type / task template):
- depends_on: list of prerequisite task_type_ids (stable canonical IDs)
- dependency_mode: ALL | ANY (default: ALL)
  - ALL: all prerequisites must be COMPLETED before this task is AVAILABLE
  - ANY: at least one prerequisite must be COMPLETED
- dependency_scope: same plan_id + same profile_version_id (or same task_set_version)

Runtime Resolution (computeAvailableTasks):
A task instance is AVAILABLE (eligible for NOT_STARTED or IN_PROGRESS) if:
- dependency_mode = ALL: every task instance matching depends_on task_type_ids has status = COMPLETED
- dependency_mode = ANY: at least one task instance matching depends_on task_type_ids has status = COMPLETED

If prerequisites not met:
- task.status = BLOCKED
- task.block_reason = PREREQUISITES_INCOMPLETE
- task.blocked_by = list of prerequisite task_ids (resolved instances, not type IDs)

When a prerequisite task transitions to COMPLETED:
- System re-evaluates all tasks that depend on it
- Newly available tasks transition from BLOCKED → NOT_STARTED

Block Reason Enum (canonical):
- PREREQUISITES_INCOMPLETE — automatic, dependency-driven
- WAITING_EXTERNAL — manual, waiting for external authority/appointment
- MISSING_INPUT — manual, user needs to provide information/documents
- USER_DEFERRED — manual, user explicitly deferred this task

Task Schema Addition:
- depends_on (JSONB array of task_type_id strings)
- dependency_mode (enum: ALL | ANY, default ALL)
- block_reason (enum, nullable — set when status = BLOCKED)
- blocked_by (JSONB array of task_id UUIDs, nullable — resolved prerequisite instances)

Ordering:
- Display ordering is derived from the dependency graph (topological sort).
- Explicit ordering numbers (sort_order) may exist for UI tie-breaking within the same dependency level.
- Ordering numbers MUST NOT contradict dependency ordering.

Cross-reference: computeAvailableTasks() in lib/gomate/settling-in-generator.ts implements this resolution.

============================================================
C. TASK GENERATION TRIGGERS & EXECUTION MODEL
============================================================

C.1 Allowed Generation Triggers (domain events — see event-trigger-system.md C.2)
Automatic triggers:
- requirements.generated — requirement set ready, triggers task generation from new requirements
- recommendation.selected_current (type=visa_route) — if it changes the requirement set
- plan.locked — generate the “final authoritative task set” (frozen, no further regeneration)
- plan.move_date_changed / plan.move_date_set — deadline recalculation (not full regeneration unless required)
- plan.destination_changed — full task regeneration (new destination = new requirements = new tasks)

Manual triggers:
- checklist.regenerate_requested — user clicks “Generate Tasks” / “Regenerate Tasks”
- Admin regeneration via artifact.refresh_requested (tasks)

Task generation is part of the Data Update System cascade (data-update-system.md Section G). Tasks are a DAG node that depends on requirements and recommendations.

C.2 Forbidden Automatic Triggers (Cost/Spam Protection)
Explicitly forbidden:
- Dashboard load
- Chat opening
- Guide viewing
- Any “page render” or “refresh” event

Only explicit domain events are allowed.

C.3 Generation Mode (Canonical)
Task generation is ALWAYS ASYNC:
- Enqueued as a job with a stable idempotency key
- Writes occur in a transaction per batch

Reason:
- Avoid UI latency
- Avoid double execution due to retries/page refreshes
- Support robust rollback/retry without duplicates

C.4 Idempotency Protection (Canonical)
Job idempotency key:
(plan_id, profile_version_id, generator_version)

Effect:
- If the same job is submitted twice, the second is a no-op or returns the already-produced result.

Additionally:
- Database uniqueness constraint (plan_id, profile_version_id, task_type_id) is the final safety net.

C.5 Partial Generation Protection
If generation is interrupted:
- Preferred: transactional batch writes (all-or-nothing per job)
- If the system must stream writes, then it MUST be resumable:
  - store job progress cursor
  - on retry, skip existing tasks (by unique key) and continue
  - guarantee deterministic output order to avoid divergence

============================================================
D. RELATIONSHIP TO REQUIREMENTS SYSTEM
============================================================

D.1 Requirement-Derived Tasks (Default)
Most tasks are derived from requirements.
Contract:
- If requirement_id is set, requirement_set_version_id MUST also be set.
- Derived task must reference “what obligation it operationalizes”.

D.2 Independent Tasks (Allowed but Controlled)
Allowed internal tasks (not tied to requirements) exist when they help execution but aren’t legal obligations.
Examples:
- Create documents folder
- Book an appointment (if the appointment itself is user-driven and required, it can still be requirement-derived; if it’s just “prepare”, it can be internal)

Contract:
- requirement_id = null
- source_system = INTERNAL
- Must be classified as RECOMMENDED or OPTIONAL unless explicitly justified as REQUIRED prerequisite.

D.3 Requirement Change Handling (Staleness, Not Deletion)
If requirement set changes (new version):
- Old tasks are marked STALE (is_stale=true, stale_reason set)
- Old tasks are NOT deleted
- New tasks are generated for the new requirement_set_version_id (under the new profile_version_id binding)

D.4 Requirement Version Binding (Mandatory)
If requirement_id is present:
- requirement_set_version_id is mandatory and immutable for that task version.

D.5 Requirement Completion Interaction (Canonical)
Canonical rule:
- Requirements are NOT directly “completed” by user toggling a requirement.
- Requirement completion MAY be computed as:
  - all REQUIRED tasks linked to that requirement are COMPLETED
But requirements can also have “authority-confirmed” completion in the future.
So the canonical approach is:
- Task completion is the primitive.
- Requirement completion is derived from tasks (unless authority-confirmed override exists later).

============================================================
E. COMPLETION TRACKING, AUDIT & USER ACTION MODEL
============================================================

E.1 User Actions (Canonical)
User can:
- Mark task COMPLETED
- Revert COMPLETED → IN_PROGRESS or NOT_STARTED
- Mark BLOCKED with a reason (optional)
- Add notes

E.2 Completion Persistence (Audit)
When a task is completed, store:
- completed_at (timestamp)
- completed_by (user_id)
- user_notes (optional)
- evidence_reference (optional pointer to uploaded document, screenshot, email confirmation, etc.)

E.3 Completion Reversibility (Mandatory)
Completion is reversible.
Audit trail MUST include:
- status_change_log: (from_status, to_status, changed_at, changed_by, reason|null)

E.4 Partial Completion States (Decision)
Default: NOT supported as separate canonical states to keep the state machine tight.
Instead:
- Use BLOCKED with notes for “waiting on authority”
- Use IN_PROGRESS + notes for “submitted, waiting”

If later needed, introduce:
- SUBMITTED
- WAITING_APPROVAL
But only if you can define deterministic transitions and notifications; otherwise it becomes a swamp.

E.5 Auto-Completion Authority (Future Capability)
By default: system does NOT auto-complete tasks.
Future: integrations can propose auto-completion, but must be:
- Explicitly confirmed by user OR
- Backed by verified authority signals
This must never silently mark tasks done.

============================================================
F. DEADLINES, TIMING & COMPLIANCE MODEL
============================================================

F.1 Deadline Source Model (Canonical)
Deadlines are driven by timing rules, not arbitrary dates:
- Relative offsets (e.g., “within 14 days of arrival”)
- Visa validity windows (before permit expiry)
- Appointment windows (if booked)

Core time anchors:
- arrival_date (or move_date)
- permit_issue_date (if known)
- permit_expiry_date (if known)
- registration_deadline from jurisdiction rules

F.2 Deadline Storage (Mandatory Fields)
Each task stores:
- deadline_at (timestamp|null)
- deadline_source_rule_id (string|null)  // stable ID for “why this deadline exists”
- deadline_anchor (enum|null): ARRIVAL_DATE | MOVE_DATE | PERMIT_ISSUE | PERMIT_EXPIRY | BOOKING_DATE | NONE

F.3 Deadline Recalculation (Move Date Changes)
If move date / arrival date changes:
- Recompute deadline_at for tasks whose deadline_anchor depends on that date.
- Do NOT create new task versions purely for deadline changes unless your versioning strategy requires immutability.
Canonical choice:
- Update deadline_at in-place and record a deadline_change_log entry.
Reason: deadline recalculation is not “a different task”, it’s the same task with updated timing.

F.4 Overdue Logic (Canonical)
A task becomes OVERDUE if:
- deadline_at is not null
- now > deadline_at
- status != COMPLETED
And it stays OVERDUE until completed or archived (or deadline removed).

F.5 Overdue Behavior (Canonical UX + System)
When OVERDUE:
- Raise priority (at least visually)
- Trigger notifications (deduped)
- Surface on dashboard prominently

F.6 Deadline Optionality
Tasks may have no deadline.
Rules:
- deadline_at = null
- status never becomes OVERDUE due to time
These tasks are still trackable and progress-contributing if REQUIRED.

============================================================
G. COMPLIANCE ALERTS & NOTIFICATION CONTRACT
============================================================

G.1 Alert Triggers
Alerts fire on:
- New REQUIRED task generated
- Approaching deadline thresholds for REQUIRED tasks
- Task becomes OVERDUE
- Task marked BLOCKED for REQUIRED items (optional alert)

G.2 Alert Threshold Rules (Canonical Defaults)
Default thresholds:
- T-7 days
- T-1 day
- T+0 (overdue)
These must be configurable per jurisdiction and per task_type_id.

G.3 Alert Deduplication (Mandatory)
Alerts must be idempotent:
UNIQUE(task_id, alert_type, threshold_key)
Examples:
- alert_type=DEADLINE_APPROACHING, threshold_key=7D
- alert_type=OVERDUE, threshold_key=ONCE

G.4 Alert Channels (Allowed)
- In-app dashboard (mandatory)
- Email (optional, user-configured)
- Push (future)

G.5 Alert Persistence
Store:
- alert_id
- task_id
- alert_type
- threshold_key
- triggered_at
- delivered_at (nullable)
- delivery_channel
- delivery_status

============================================================
H. UX, DISPLAY & PROGRESS MODEL
============================================================

H.1 Display Locations (Canonical)
Tasks appear in:
- Tasks page (full list + filtering)
- Dashboard (summary, critical items)
- Guide (read-only “snapshot” section; never triggers generation)

H.2 Sorting (Canonical)
Default sort order:
1) OVERDUE
2) Soonest deadline
3) Highest priority
4) REQUIRED before RECOMMENDED before OPTIONAL
5) Category grouping (optional)

H.3 Progress Metrics (Canonical)
Compliance Progress (canonical):
- completed_required_tasks / total_required_tasks
Settling-in Progress (optional secondary):
- (completed_required + weight*completed_recommended) / (total_required + weight*total_recommended)
But never conflate these in one number.

H.4 Filtering (Canonical)
Filter by:
- status
- category
- classification (REQUIRED/RECOMMENDED/OPTIONAL)
- deadline proximity (overdue, 7 days, 30 days)
- source_system (debug/admin only)

H.5 Task Detail View (Canonical)
Show:
- title, description
- classification and category
- deadline and “why this deadline exists”
- requirement linkage (if any)
- “authority reference” link if your Requirements system stores official sources

============================================================
I. VERSIONING, REGENERATION & DUPLICATE PROTECTION
============================================================

I.1 Regeneration Behavior (Canonical)
Regeneration creates new task versions when:
- profile_version_id changes (new snapshot)
- requirement_set_version_id changes materially
- generator_version changes materially (logic change)

Old tasks:
- remain for audit
- may be marked STALE if superseded

I.2 Duplicate Protection (Hard Constraint)
Enforce at DB level:
UNIQUE(plan_id, profile_version_id, task_type_id)
No exceptions.

I.3 Completion Migration Rules (Explicit)
When regenerating tasks for a new profile_version_id:
- If a task_type_id exists in both old and new sets, completion MAY migrate forward IF:
  - the semantic meaning of task_type_id is unchanged (guaranteed by task_type governance)
  - requirement linkage didn’t change in a way that invalidates completion
Canonical rule:
- Migrate completion for “pure execution tasks” (e.g., “register address”) if still present.
- Do NOT migrate if the task is “conditional” and the condition changed (e.g., bank account prerequisites changed). In those cases, mark as NOT_STARTED and attach a note that it was regenerated.

Migration must be explicit and logged:
- migrated_from_task_id
- migration_decision_reason

I.4 Task Version Identity
Each task has:
- version_number incrementing per task_type_id within a plan
- latest version is “current” for that profile_version_id

I.5 Stale Task Handling
Stale tasks:
- is_stale = true
- remain visible only in “History” view (default)
- admin/debug can view full set

I.6 Canonical Task Resolution (What user sees)
User-facing “current tasks” are:
- tasks where plan_id=current_plan AND profile_version_id=current_profile_version AND is_stale=false AND status!=ARCHIVED

============================================================
J. SYSTEM DEPENDENCIES & GENERATION SOURCES
============================================================

J.1 Allowed Generator Inputs (Sources)
Task generation can be driven by:
- Local Requirements System (primary)
- Visa Recommendation System (because it shapes requirements)
- Timeline System (deadline anchoring and ordering; not as a trigger by itself)
- Internal Task Templates (small set of universal operational tasks)

Guide System is NOT a primary task source (Guide is output, not a driver).
If guide contains “recommended actions”, they must be translated into explicit task templates, not freeform extracted as tasks.

J.2 Dependency Binding (Traceability)
Every task stores:
- source_system (REQUIREMENTS | VISA | TIMELINE | INTERNAL | ADMIN)
- source_entity_id (requirement_id, visa_id, etc.)

J.3 Cross-System Consistency (Hard Rules)
A task instance MUST be internally consistent with:
- plan_id
- profile_version_id
- requirement_set_version_id (if derived)

If any of these become mismatched, the task is invalid and must be marked STALE and excluded from “current”.

J.4 Cache Invalidation (Profile Changes)
If the profile changes and a new profile_version_id is created:
- old tasks are not silently replaced
- system emits: TasksStale(profile_version_id_old)
- UI can prompt: “Your plan changed. Regenerate tasks.”

============================================================
K. FAILURE, ERROR HANDLING & RESILIENCE MODEL
============================================================

K.1 Failure Types
- Generator crash
- DB write failure
- Partial batch write
- Timeout / worker killed
- Duplicate submission

K.2 Job State Model (Canonical)
Generation job states:
- QUEUED
- RUNNING
- FAILED
- COMPLETE

K.3 Retry Semantics (Hard Rule)
Retry must never create duplicates.
Mechanisms:
- Job idempotency key
- DB uniqueness constraint
- Deterministic output ordering

K.4 Idempotent Retry
Retry reuses the same idempotency key and:
- Returns existing result if COMPLETE
- Resumes or re-runs safely if FAILED

K.5 User-Facing Failure UX
If generation fails:
- Show a clear error banner: “Tasks could not be generated.”
- Provide Retry button (manual trigger)
- If repeated failure: show reference ID for logs

K.6 Data Integrity Guarantees
System guarantees:
- No duplicates (by unique keys)
- No orphan tasks (must belong to a plan and profile_version)
- No inconsistent version linkage (validated before commit)

============================================================
L. LIFECYCLE & PERSISTENCE MODEL
============================================================

L.1 Task Lifecycle (Conceptual vs Status)
Conceptual lifecycle flags:
- GENERATED (created)
- ACTIVE (eligible for current view)
- COMPLETED (status)
- STALE (flag)
- ARCHIVED (status)

L.2 Persistence Duration
Tasks persist indefinitely for:
- audit trail
- user history
- regeneration explainability

L.3 Archival Rules
Old task versions and stale tasks can be archived:
- by system housekeeping rules (e.g., “older than 6 months stale”)
- but never deleted

L.4 Current Task Resolution
Current tasks are defined by:
- plan_id + current_profile_version_id + is_stale=false + status!=ARCHIVED

============================================================
M. GENERATOR EXECUTION CONTRACT
============================================================

M.1 Input Contract (What generator receives)
A generator run receives immutable snapshots:
- profile_snapshot (for profile_version_id)
- requirement_set_snapshot (for requirement_set_version_id)
- visa_recommendation_snapshot (if applicable)
- destination/jurisdiction snapshot (ruleset version)
- move/arrival date snapshot (if known)

M.2 Output Contract (Strict Schema)
Generator outputs a list of TaskCreate objects with:
- stable task_type_id
- required fields populated
- deterministic ordering
- classification assigned
- deadline rule references assigned (even if no deadline)

M.3 Validation Layer (Mandatory)
Before commit:
- Schema validation (required fields, enums)
- Duplicate validation (within output and against DB)
- Link validation (requirement_id implies requirement_set_version_id)
- Deadline validation (deadline_source_rule_id present if deadline_at present)

M.4 Generator Version Tracking (Mandatory)
Every task stores generator_version.
Rules:
- generator_version changes only when task logic changes
- used in idempotency keys and audit

============================================================
CANONICAL DESIGN DECISIONS (NON-NEGOTIABLE SUMMARY)
============================================================
1) Tasks are execution-level and user-trackable; Requirements are obligations.
2) Compliance progress is computed from REQUIRED tasks only.
3) Tasks are scoped to (plan_id, profile_version_id) and deduped by (plan_id, profile_version_id, task_type_id).
4) Generation is async and event-driven; never triggered by UI loads.
5) Regeneration creates new versions; old tasks become STALE, not deleted.
6) Deadlines are rule-based and recalculated on date changes; OVERDUE is system-driven.
7) Completion is reversible and audited; no silent auto-complete.

============================================================
N. CROSS-SYSTEM REFERENCES
============================================================

N.1 Upstream (inputs to task generation)
- Local Requirements System (local-requirements.md) — primary source; requirements → tasks mapping (Section D)
- Recommendation System (recommendation-system.md) — visa_route recommendation shapes which requirements apply
- Research System (research-system.md) — research outputs inform requirement applicability
- Profile System (profile-system.md) — profile_version_id snapshot determines user-specific task set
- Event/Trigger System (event-trigger-system.md) — domain event routing for generation triggers

N.2 Downstream (consumes task data)
- Timeline System (timeline-system.md) — tasks appear as timeline items (source_type=task)
- Progress Tracking System (progress-tracking-system.md) — post_arrival_progress derived from required task completion
- Dashboard System — displays task summary, overdue count, compliance progress
- Chat System — post-arrival chat uses [TASK_DONE:title] marker protocol to complete tasks
- Notification System (notification-system.md) — deadline-based alerts for required tasks (Section G)

N.3 Orchestration
- Data Update System (data-update-system.md) — tasks are a DAG node in the artifact cascade
- Guide Generation System (guide-generation.md) — guide is NOT a task source (guide is output)

N.4 Shared Contracts
- Plan LifecycleState × Stage: plan-system.md Section C
- Profile versioning: profile_version_id defined in profile-system.md Section G
- Event taxonomy: checklist.generated / checklist.failed / task.status_changed (event-trigger-system.md C.2)
- Marker protocol: [TASK_DONE:exact task title] parsed by frontend (CLAUDE.md critical architecture)
- computeAvailableTasks(): lib/gomate/settling-in-generator.ts implements dependency resolution (B.7)

N.5 System Events Emitted
- checklist.generated (payload: plan_id, profile_version_id, task_count)
- checklist.failed (payload: plan_id, error_code)
- task.status_changed (payload: task_id, plan_id, from_status, to_status)

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Local Requirements System | NOT_IMPLEMENTED |
| Recommendation System | MINIMAL |
| Research System | PARTIAL |
| Profile System | PARTIAL |
| Event Trigger System | NOT_IMPLEMENTED |
| Timeline System | NOT_IMPLEMENTED |
| Progress Tracking System | PARTIAL |
| Dashboard System | PARTIAL |
| Plan Contextual Chat | PARTIAL |
| Notification System | MINIMAL |
| Data Update System | NOT_IMPLEMENTED |
| Guide Generation System | PARTIAL |


END OF SETTLING-IN TASK SYSTEM DEFINITION

---

## v1 Alignment Note (GAP-035, GAP-037, GAP-038)

### Categories (GAP-035)

v1 uses 10 practical categories instead of the 11 defined:

| Definition | v1 |
|-----------|-----|
| LEGAL | legal |
| IMMIGRATION | (merged into legal) |
| TAX | (merged into legal/banking) |
| FINANCIAL | banking |
| HEALTHCARE | healthcare |
| HOUSING | housing |
| EMPLOYMENT | employment |
| EDUCATION | (not separate) |
| LOGISTICS | transport |
| LIFESTYLE | social |
| GENERAL | other |
| — | registration, utilities |

### Status States (GAP-037)

| Definition | v1 | Notes |
|-----------|-----|-------|
| NOT_STARTED | available | "available" implies unblocked and not started |
| IN_PROGRESS | in_progress | Same |
| COMPLETED | completed | Same |
| BLOCKED | locked | "locked" indicates blocked by dependency |
| OVERDUE | overdue | Same |
| ARCHIVED | skipped | "skipped" is more descriptive for user-initiated opt-out |

### Dependency Format (GAP-038)

v1 uses `text[]` (PostgreSQL array of task_key strings) for `depends_on` instead of JSONB array of `{"task_key": "key"}` objects. `text[]` is simpler and sufficient — each element is just a task_key string.

**Source:** `lib/gomate/settling-in-generator.ts` (categories), `settling_in_tasks` table CHECK constraint (statuses), migration 010 (depends_on as text[])
