GoMate — Event / Trigger System
System Definition (Answering the full Question Framework)

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: NOT_IMPLEMENTED

V1 Implementation Reality:
- No events table, outbox table, or event persistence of any kind exists in v1
- No event bus, dispatcher, worker, or handler infrastructure exists
- No domain events are emitted or consumed anywhere in the codebase
- API routes call service functions directly (synchronous, inline)
- There is no "V1 Compat Mode" either — Section U describes an aspirational
  intermediate architecture that was never built

V1 Deviations from Canonical Spec:
- The entire spec (Sections A–W) describes a target architecture with zero v1 code
- Section U ("V1 Execution Mode") claims a "temporary compatibility mode" with
  synchronous dispatch inside API requests — this does not exist; there is no
  event dispatch at all, synchronous or otherwise
- All trigger contracts (Section F) are handled by direct function calls in API
  routes, not by event consumers
- All idempotency (Section G) is handled ad-hoc per route, not via event keys
- All ordering (Section H) is implicit in request handling, not via plan_version

V1 Cross-Reference Adjustments:
- 16+ definitions reference "Event System" as a dependency — in v1, this means
  "the API route calls the function directly"
- profile_version_id referenced in event payloads (Section B.2) does not exist
  in v1 (profile is a single JSONB column on relocation_plans)
- Data Update System (Section V) also does not exist — see data-update-system.md
- All "event consumer" references in other definitions should be read as
  "the relevant API route handler"

V1 Fallback Behavior:
- Guide generation: triggered by POST /api/guides (direct call)
- Task generation: triggered by POST /api/settling-in/generate (direct call)
- Research: triggered inline during guide generation pipeline
- Notifications: localStorage-based compliance alerts only
- Dashboard updates: computed on page load, no materialization
- No retry, replay, DLQ, or audit trail infrastructure exists

============================================================

================================================================================
0) SCOPE, GUARANTEES, TERMINOLOGY (NON-NEGOTIABLE)
================================================================================

0.1 What is an “Event” in GoMate (Canonical)
An event is an immutable server-side record that “something happened” in the domain or in system execution, intended to trigger downstream processing in a safe, idempotent way.

We define three categories (strict):
1) Domain Events (canonical, business-relevant)
   - Represent durable facts: plan.locked, profile.completed, recommendation.selected_current
   - Persisted for audit and replay (long retention)
2) System Events (operational)
   - Represent job/handler lifecycle: job.started, handler.failed
   - Persisted shorter; used for observability
3) UI Events (NOT events in Event System)
   - Button clicks, page loads, open chat, render events
   - These are requests; they do NOT get written as events unless translated server-side into a Domain Event like guide.regenerate_requested.

Hard rule:
- The frontend is never a trusted event emitter. It can only send requests with a client_request_id.

0.2 Delivery Guarantees (Explicit Choices)
- Delivery: AT-LEAST-ONCE
  Reason: exactly-once is expensive and still leaky in real systems; we enforce idempotency at consumers + artifact layer.
- Idempotency: Consumers MUST be idempotent + artifacts have uniqueness constraints.
  Event bus idempotency is helpful but not sufficient alone.
- Ordering: ORDERED PER PLAN (best-effort, partitioned), NOT global ordering.
  Events may still arrive out-of-order due to retries, so handlers must be version-aware and safe.

0.3 Source of Truth Model for Derived Artifacts
Canonical model: STATE + EVENTS (not pure event sourcing).
- The database state is the source of truth for current plan data and current artifact pointers.
- The event log is the source of truth for “why and when things happened,” plus replay/debug.
- Derived artifacts (guides/checklists/dashboard views) are materialized outputs with explicit source pointers.

0.4 Explicit Non-Responsibilities (What Event System does NOT do)
Event System does NOT:
- Decide what visa is best (Recommendation System)
- Determine eligibility logic (Visa/Rules Engine)
- Render UI (Frontend)
- Contain business logic beyond trigger orchestration and safety (idempotency/order/retry)
- Store full PII snapshots as payloads (see PII policy)

================================================================================
A) PURPOSE & RESPONSIBILITY
================================================================================

A.1 Mission Statement (Canonical)
“Guarantee consistent propagation of state changes across plan-scoped systems without duplication, drift, or cross-plan leakage, while supporting retries, auditability, and deterministic ‘current pointers’ updates.”

A.2 Architecture Choice

Architecture Status Labels:
- CANONICAL TARGET: Transactional Outbox + async worker(s) + idempotent handlers (default contract)
- V1 COMPAT MODE: Direct synchronous dispatch inside API request lifecycle (temporary)

Canonical Target: HYBRID EVENT BUS with Transactional Outbox.
- Writes happen to core tables (plans/profile/requirements/etc.)
- In the same DB transaction, we append an outbox record (event) (transactional outbox pattern)
- A worker polls outbox and dispatches events to handlers
- Handlers create/upgrade derived artifacts and update current pointers

All sections in this document describe the CANONICAL TARGET architecture unless explicitly marked as V1 COMPAT MODE.

A.3 Why it exists (Concrete problems solved)
- Decouple systems (profile changes shouldn’t directly call guide generator)
- Normalize triggers (one way to cause regeneration)
- Prevent duplicates (idempotency keys + unique constraints)
- Support retries and replay (safe recovery)
- Provide audit trail (who/what caused what)

================================================================================
B) EVENT IDENTITY MODEL
================================================================================

B.1 Event Record (Immutable) — Required Fields
Event is append-only and immutable after insert.

Required:
- event_id (UUID)
- type (string enum; e.g., plan.locked)
- source_system (enum; e.g., PLAN, PROFILE, RECOMMENDATION, TASKS, ADMIN)
- created_at (timestamp)
- actor_user_id (uuid|null)        // who initiated (user/admin); null for pure system
- user_id (uuid|null)              // tenant safety; required for user-owned events
- org_id (uuid|null)               // future
- plan_id (uuid|null)              // required for plan-scoped domain events
- correlation_id (uuid)            // groups a flow (one user action)
- causation_id (uuid|null)         // the event that caused this event
- idempotency_key (string)         // deterministic; used for dedupe at source
- payload (jsonb)                  // SMALL; pointers only
- payload_schema_version (int)
- plan_version (int|null)          // monotonic version for staleness checks (critical)

B.2 Payload Strategy (Canonical)
Payload contains POINTERS/IDS ONLY, not full snapshots.
Example payload contents:
- profile_version_id
- requirement_set_version_id
- recommendation_id
- guide_template_version
- checklist_ruleset_version
- job_id / handler_run_id
Never store full user personal details in payload.

B.3 PII Policy (Strict)
- Payload MUST NOT contain raw PII beyond IDs already present in core tables.
- If absolutely unavoidable (rare), payload must be:
  - encrypted at rest
  - short retention
  - deleted/anonymized on GDPR delete
Canonical stance: avoid entirely.

================================================================================
C) EVENT TAXONOMY (TYPES + NAMING)
================================================================================

C.1 Naming Convention
Canonical: domain.action (lowercase, dot-separated)
Examples: plan.created, profile.completed, guide.generated

C.2 Canonical Domain Events (Core Set)

User / Plan Lifecycle:
- user.created
- plan.created
- plan.locked
- plan.archived
- plan.deleted
- plan.forked (payload: parent_plan_id, new_plan_id)

Plan Anchor Field Changes (specific, NOT overloaded on plan.updated_metadata):
- plan.destination_changed (payload: old_destination, new_destination)
- plan.destination_set (payload: destination — first time set, distinct from change)
- plan.move_date_changed (payload: old_move_date, new_move_date)
- plan.move_date_set (payload: move_date — first time set)

Plan Metadata (non-anchor fields only):
- plan.updated_metadata (for non-structural plan field changes that do NOT trigger full cascade)

Profile / Interview:
- profile.updated (non-structural profile field change)
- profile.completed (profile meets completeness threshold)
- profile.version_created (new profile snapshot created; payload: profile_version_id, snapshot_trigger)

Requirements / Research:
- requirements.generated
- requirements.superseded
- research.completed (payload: research_type, layer — "generic" or "user_specific")
- research.failed (payload: research_type, error_code)

External Data:
- external_data.refreshed (payload: dataset_type, dataset_version — e.g., cost data, legal data)

Recommendation:
- recommendation.generated
- recommendation.selected_current
- recommendation.superseded

Guide:
- guide.regenerate_requested (emitted ONLY by explicit user/admin action, NEVER by cascade)
- guide.generated
- guide.failed
- guide.outdated (emitted when upstream prerequisites change — marks guide STALE, does NOT trigger generation)
- guide.regenerate_suggested (optional UX signal — upstream cascade completed, guide is stale, user should regenerate)

Checklist/Tasks:
- checklist.regenerate_requested
- checklist.generated
- checklist.failed
- checklist.outdated
- task.status_changed

Artifact Refresh (manual triggers):
- artifact.refresh_requested (payload: artifact_type, plan_id — user/admin manual refresh)
- plan.refresh_requested (payload: plan_id — refresh all artifacts for plan)

Notifications:
- notification.queued
- notification.sent
- notification.failed

C.3 System Events (Operational)
- job.queued
- job.started
- job.completed
- job.failed
- handler.started
- handler.completed
- handler.failed
- handler.retried
- handler.dlq

================================================================================
D) EVENT SOURCES (WHO CAN EMIT)
================================================================================

D.1 Trusted Emitters (Strict)
Server-side only emitters:
- Plan Service
- Profile/Interview Service
- Requirements/Research Service
- Recommendation Service
- Task/Checklist Service
- Admin Service
- Worker/Handler runtime (system events)

Frontend:
- NEVER writes events directly.
- Frontend sends “requests” with:
  - client_request_id (uuid)
  - desired action (e.g., regenerate guide)
Server translates request → domain event with idempotency_key = client_request_id.

D.2 Emission Policy (Transactional Outbox)
Hard rule:
- Domain events are emitted ONLY after DB commit (same transaction via outbox insert).
- If the write fails, no event exists.
- System events may be emitted by worker runtime independently.

================================================================================
E) EVENT CONSUMERS (SUBSCRIBERS + RESPONSIBILITIES)
================================================================================

E.1 Canonical Consumers
1) Guide Generator Consumer
2) Checklist/Task Generator Consumer
3) Dashboard Materializer Consumer (optional, if you materialize)
4) Notification Consumer
5) Audit/Analytics Consumer (read-only)
6) External Sync Consumer (future: calendar, email, SFDC)

E.2 Consumer Contract (Every Handler Must Define)
For each handler:
- handled_event_types
- preconditions check (must exist + must be current)
- idempotency key strategy
- runtime limit + timeout
- retry policy classification (transient vs permanent)
- output events on success/failure
- which “current pointer” it updates (if any)

E.3 Chained Events (Allowed)
Consumers may emit new domain events, but only to represent durable facts.
Example:
- recommendation.selected_current → emits guide.regenerate_requested
Not allowed:
- emitting chains as a substitute for calling internal functions; events must remain meaningful.

================================================================================
F) TRIGGER CONTRACTS PER MAJOR ARTIFACT (STRICT & TESTABLE)
================================================================================

F.0 Canonical “Current Pointer” Rule (Non-negotiable)
UI reads current pointers only.
Each derived artifact type has a pointer table/field:
- plan.current_recommendation_id
- plan.current_guide_id
- plan.current_checklist_id
- dashboard.current_snapshot_id (optional)

Artifacts are immutable versions; pointers select “current”.

----------------------------------------
F.1 Guide Generation
----------------------------------------
Triggering Events (canonical):
- guide.regenerate_requested (ONLY source — emitted exclusively by explicit user/admin action)

FORBIDDEN triggers (guide MUST NOT auto-generate):
- recommendation.selected_current MUST NOT cause guide.regenerate_requested
- plan.locked MUST NOT cause guide.regenerate_requested
- profile.version_created MUST NOT cause guide.regenerate_requested
- No cascade step may emit guide.regenerate_requested

Upstream change behavior:
- recommendation.selected_current → emits guide.outdated (marks current guide STALE, does NOT generate)
- profile.version_created → emits guide.outdated (marks current guide STALE, does NOT generate)
- guide.outdated → UI shows “Your guide is outdated. Regenerate?” prompt
- User clicks “Regenerate” → emits guide.regenerate_requested with new client_request_id

Preconditions:
- plan exists and is accessible
- profile_version_id exists and is “complete enough”
- recommendation_id is current (matches plan.current_recommendation_id)
- destination_country present

Idempotency key (guide handler):
GUIDE_GEN::{plan_id}::{profile_version_id}::{recommendation_id}::{guide_template_version}

Allowed frequency:
- Once per (plan_id, profile_version_id, recommendation_id, template_version)
- Debounce: if multiple regenerate_requested arrive within short window, coalesce to one run per key.

Outputs:
- on success: guide.generated (payload: guide_id, source pointers)
- on failure: guide.failed (error_code, debug_ref)

Pointer update:
- plan.current_guide_id = new_guide_id
- mark previous current guide as superseded/outdated (metadata flag), not deleted.

Outdated logic:
- If a new recommendation becomes current, guide.outdated is emitted and guide_status = STALE.
- Pointer shifts ONLY after user triggers regeneration and new guide completes successfully.

----------------------------------------
F.2 Checklist / Task Generation
----------------------------------------
Triggering Events (canonical):
- checklist.regenerate_requested
- guide.generated (optional if checklist derives from guide)
- requirements.generated (if checklist derives from requirements directly)
- plan.locked (optional: finalize baseline checklist)

Canonical dependency choice:
Checklist derives from the same source snapshot as tasks:
- recommendation_id + requirement_set_version_id + profile_version_id
Guide is optional input, not source of truth.

Preconditions:
- plan exists
- requirement_set_version_id exists and is current
- profile_version_id exists
- destination_country exists

Idempotency key:
CHECKLIST_GEN::{plan_id}::{requirement_set_version_id}::{ruleset_version}

Tasks uniqueness enforcement (DB level):
UNIQUE(plan_id, profile_version_id, task_type_id)

Outputs:
- checklist.generated / checklist.failed
Pointer update:
- plan.current_checklist_id = new_checklist_id
- tasks are created for current profile_version_id with idempotent UPSERT semantics.

----------------------------------------
F.3 Dashboard Updates
----------------------------------------
Canonical choice: HYBRID
- Lightweight dashboard values can compute on read.
- Heavy “cards” and summaries are materialized by events.

Triggering Events (materialize):
- task.status_changed
- guide.generated
- checklist.generated
- recommendation.selected_current
- notification.sent (optional)

Idempotency key:
DASH_MAT::{plan_id}::{plan_version}

Pointer update:
- dashboard.current_snapshot_id (or update dashboard_summary row)

----------------------------------------
F.4 Notifications
----------------------------------------
Triggering events eligible:
- task.overdue_detected (derived/system event)
- task.deadline_approaching
- guide.generated (guide ready)
- checklist.generated
- plan.locked (optional)

Suppression rules:
- per user preference (channels, quiet hours)
- per type rate limiting (e.g., max N/day)
- regeneration storm suppression: ignore outdated artifacts; notify only when new “current” pointer changes.

Idempotency key:
NOTIF::{user_id}::{event_id}::{channel}

Outputs:
- notification.sent / notification.failed

================================================================================
G) IDEMPOTENCY GUARANTEES (NO DUPLICATE ARTIFACTS)
================================================================================

G.1 Where Idempotency Is Enforced (All Three Layers)
1) Emitter dedupe:
   - UNIQUE(type, source_system, idempotency_key) on events table/outbox
2) Consumer idempotency:
   - handlers store “handled(event_id)” marker (or use upsert into handler_runs)
3) Artifact creation uniqueness:
   - unique keys per artifact version
   - tasks unique constraint (plan_id, profile_version_id, task_type_id)

G.2 “Duplicate” Definition
Duplicate means: “two UI-visible current artifacts representing the same source version”.
So duplicates are prevented by:
- stable artifact keys (idempotency keys)
- pointer updates being last-write-wins but version-aware

G.3 Safe Retries Requirement
A retry must either:
- produce the same artifact (same key), or
- no-op if artifact already exists
Never produce a second parallel version for the same key.

================================================================================
H) ORDERING GUARANTEES (OUT-OF-ORDER + RACES)
================================================================================

H.1 Ordering Model
- Partition queue by plan_id (best-effort in worker)
- No global ordering
- Handlers must assume out-of-order delivery is possible

H.2 Plan Version (Monotonic Staleness Guard)
- plan_version increments on significant plan-scoped changes:
  - profile_version_created
  - requirements.superseded
  - recommendation.selected_current
  - plan.locked
Events carry plan_version.
Handler rule:
- If event.plan_version < current_plan.plan_version and the event is not explicitly “historical”, handler should no-op or mark output as outdated.

H.3 “Current Pointer Check” Before Acting
Before generating:
- confirm the input pointers are still current:
  - recommendation_id matches plan.current_recommendation_id
  - requirement_set_version matches current
If not current:
- do not generate; emit artifact.outdated or ignore safely.

H.4 Race Examples (Canonical Handling)
- profile.updated after profile.completed:
  - profile.version_created increments plan_version
  - downstream events tied to old version become stale; handlers no-op or produce outdated marker
- recommendation.generated before research.completed:
  - precondition fails; handler marks BLOCKED and retries later (transient) or emits recommendation.failed (permanent if missing inputs)
- guide.regenerate_requested twice:
  - coalesced via identical idempotency key; second becomes no-op

================================================================================
I) RETRY & FAILURE HANDLING
================================================================================

I.1 Failure Taxonomy
Transient:
- provider down, network error, timeout
Permanent:
- missing required inputs (destination missing), schema invalid, forbidden state (plan deleted)

I.2 Retry Policy
- Exponential backoff
- Max attempts (e.g., 5)
- After max attempts → DLQ record + handler.dlq event

I.3 UI Failure Behavior
When a handler fails for a user-facing artifact:
- UI shows “Generation failed” card with Retry button
Retry emits a new request with new client_request_id, producing a new regenerate_requested event.

I.4 Error Events Contract
On failure emit:
- artifact.failed with:
  - error_code (stable enum)
  - error_message (safe summary, not stack trace)
  - debug_ref (handler_run_id/log id)
  - correlation_id

I.5 Observability (Mandatory)
- Structured logs with correlation_id, event_id, plan_id, handler_name
- timing_ms per handler run
- stable error codes for dashboards/alerts

================================================================================
J) SYNC VS ASYNC PROCESSING (UX CONTRACT)
================================================================================

J.1 Synchronous (Blocking) Operations
- plan.locked: must return “locked” immediately after DB commit (event emission happens, but lock itself is synchronous)
- recommendation.selected_current: must update plan.current_recommendation_id synchronously

J.2 Asynchronous (Worker) Operations
- guide generation
- checklist generation
- heavy research refresh
- notification sending (email/push)
- dashboard materialization (if used)

J.3 Optimistic UI
Allowed:
- show placeholder “Generating…” status immediately after request accepted
- display job status by correlation_id/job_id

J.4 Latency Targets (Product Contract)
- user request accepted: <300ms
- guide ready: typically <30–90s (depends on provider)
- checklist/tasks: <10–30s typical
- notifications: best-effort, non-blocking

================================================================================
K) EVENT PERSISTENCE, REPLAY, AUDIT
================================================================================

K.1 Persistence Strategy
- Domain events: long retention (e.g., 1–2 years) for audit and replay
- System events: shorter retention (e.g., 7–30 days) to reduce noise

K.2 Replay Support
Yes, for:
- debugging
- rebuilding derived artifacts after bugfix/schema upgrade
Replay mechanism:
- Admin tool “Rebuild plan artifacts” replays domain events from checkpoint OR directly regenerates from current state (preferred for simplicity)
Canonical choice:
- Replay is supported but not required for normal operation; it’s an admin recovery tool.

K.3 Storage Model
- events table (append-only)
- outbox table (append-only; processed flag)
Indexes:
- (plan_id, created_at)
- (type, created_at)
- (correlation_id)

K.4 GDPR Delete
On user deletion:
- Plan and core tables deleted per policy
- Events:
  - Domain events referencing deleted user are hard-deleted OR anonymized depending on compliance policy
Canonical safe choice: hard delete events for user if you can.

================================================================================
L) EVENT DEDUPLICATION (AT THE SOURCE)
================================================================================

L.1 Emitter Dedupe (DB Constraint)
UNIQUE(type, source_system, idempotency_key)

L.2 Concurrent Emitters
If two servers emit concurrently with same idempotency_key:
- One insert wins; the other conflicts and returns existing event_id (or no-ops).
This is mandatory for double-click safety.

L.3 Double Click Handling
Frontend sends client_request_id.
Server uses:
idempotency_key = client_request_id
So repeated requests do not cause duplicate domain events.

================================================================================
M) EVENT VISIBILITY & TOOLING
================================================================================

M.1 UI Visibility
Default: events are NOT user-visible.
Admin-only:
- “Event Timeline” per plan showing:
  - event_id, type, created_at, correlation_id, status
- Payload is redacted; pointers only.

M.2 Debug Tools (Admin)
- Search events by plan_id/correlation_id
- View handler runs for an event_id
- Re-run handler for event_id (admin-only) with strict guardrails:
  - must be idempotent; does not bypass uniqueness constraints

================================================================================
N) CROSS-PLAN ISOLATION & TENANCY SAFETY
================================================================================

N.1 Hard Rule
An event must never mutate a different plan than its plan_id.

N.2 Enforcement
- plan_id required for all artifact-mutating handlers (except global user.created etc.)
- handler loads plan by (plan_id) and validates ownership (user_id/org_id)
- DB RLS (if used) or application auth checks on every mutation
- No broadcast/fan-out events unless explicitly scoped and validated

N.3 Prevent Fan-out Leaks
- No “global subscribe to profile.updated” that touches multiple plans
- Partition processing by plan_id

================================================================================
O) MANUAL TRIGGERS (USER/ADMIN)
================================================================================

O.1 User Manual Triggers (Allowed)
- regenerate guide
- regenerate checklist
- refresh recommendations (if supported)

Manual triggers emit domain events:
- guide.regenerate_requested
- checklist.regenerate_requested
- recommendation.refresh_requested (optional)

O.2 Debounce Rules
Manual triggers:
- still deduped by idempotency_key
- can bypass long coalesce windows but not uniqueness constraints

O.3 Admin Operations
- replay events (or rebuild from current state)
- backfill derived artifacts after bugfix
- purge/compact old system events

================================================================================
P) LIFECYCLE, CLEANUP, RETENTION
================================================================================

P.1 Retention by Type
Long retention:
- plan.locked, recommendation.selected_current, profile.completed, guide.generated, checklist.generated
Short retention:
- job.* and handler.* events
Prunable:
- noisy retries, intermediate system chatter

P.2 Checkpoints / Compaction
Optional:
- store periodic “plan snapshot checkpoint” to accelerate replay
Canonical: not required initially; keep it simple.

================================================================================
Q) CONCURRENCY & BACKPRESSURE
================================================================================

Q.1 Event Storm (100 events for one plan)
Strategy:
- Coalesce by artifact idempotency keys
- Enforce per-plan concurrency cap (e.g., 1 guide generation at a time)
- Rate limit manual triggers per plan/user

Q.2 Backpressure
- Queue length monitoring
- Per-handler concurrency caps
- Priority lanes:
  - user-facing artifact generation higher priority than background refresh

================================================================================
R) SECURITY & TRUST BOUNDARIES
================================================================================

R.1 Who Can Emit What
- Domain events: server only
- Client: request endpoints only, with auth; server derives actor/user from session

R.2 Payload Validation
- schema validation per event type
- reject unknown payload_schema_version unless backward compatible

R.3 Prevent Event Injection
- No public event write endpoints
- Auth context derived server-side
- Idempotency keys bound to authenticated user_id

================================================================================
S) CONSISTENCY INVARIANTS (SYSTEM-WIDE TRUTH)
================================================================================

Invariant 1:
Derived artifacts are generated only by consumers (handlers), never ad-hoc in UI or random service calls.

Invariant 2:
Every derived artifact stores pointers to the source versions it was generated from:
(profile_version_id, requirement_set_version_id, recommendation_id, ruleset/template versions)

Invariant 3:
UI reads current pointers only. “Current pointers” are the only authoritative selector.

Invariant 4:
Consumers MUST be idempotent because delivery is at-least-once.

Invariant 5:
No cross-plan writes: every handler verifies (user_id, plan_id, org_id) before mutation.

================================================================================
T) TESTING & MUST-PASS INTEGRATION SCENARIOS
================================================================================

T1 Duplicate emit:
- Same client_request_id twice → only one event row, only one artifact generated.

T2 Out-of-order:
- recommendation.selected_current arrives before requirements.generated → handler blocks safely and retries; no duplicates.

T3 Retry:
- guide handler fails once → retry succeeds; idempotency key produces one guide version.

T4 Plan change mid-generation:
- profile_version changes while guide job running → generated guide marked outdated or rejected by pointer/version check; does not become current.

T5 Cross-plan safety:
- event with mismatched user_id/plan_id is rejected; no mutation occurs.

T6 Replay/rebuild:
- rebuild derived artifacts regenerates correct current pointers deterministically.

T7 Manual regenerate:
- emits regenerate_requested; creates new version; supersedes old; UI updates via pointer change.

================================================================================
U) V1 EXECUTION MODE (TEMPORARY COMPATIBILITY)
================================================================================

[V1 SCOPE NOTE: This entire section describes an intermediate "V1 Compat Mode"
that was designed but NEVER IMPLEMENTED. The actual v1 architecture has no event
dispatch mechanism at all — API routes call functions directly. This section is
retained as a future migration target, not a description of current behavior.]

U.1 Architecture Status
V1 runs on Vercel serverless. There is no persistent worker process.
The Transactional Outbox + async worker architecture (Section A.2) is the CANONICAL TARGET.
V1 implements a TEMPORARY COMPATIBILITY MODE: direct synchronous dispatch inside API request lifecycle.

U.2 V1 Compat Mode Rules (Strict)

Event modeling:
- Events are still modeled as immutable records (append-only).
- Events may be stored in a simplified events table OR in the outbox table processed inline.
- All event identity fields (Section B.1) are required regardless of execution mode.

Dispatch:
- Dispatch happens synchronously after the core DB write succeeds within the same API request.
- There is no background worker polling the outbox.
- The API route handler acts as both emitter and dispatcher.

Handler requirements (unchanged from canonical):
- Handlers MUST remain idempotent.
- Handlers MUST enforce the same artifact uniqueness constraints as the target architecture.
- Handler execution MUST be time-bounded to serverless limits (Vercel function timeout).
- Long-running jobs (guide generation, heavy research) MUST be deferred or reduced in scope.

Failure behavior:
- If a handler fails, the event is marked failed.
- Failed events may be retried via explicit user/admin action (not automatic retry).
- Partial side effects are FORBIDDEN: pointer updates MUST only occur on successful artifact creation.

U.3 Migration Invariant (Non-negotiable)
All handlers and event schemas MUST be written as if the Outbox exists today:
- Stable event types (Section C)
- Idempotency keys (Section G)
- correlation_id / causation_id (Section B.1)
- plan_version staleness guards (Section H.2)

The system MUST be able to switch from sync dispatch → outbox + worker without rewriting business logic.
The only change at migration time is the dispatch mechanism, not the handler contracts.

U.4 V1 Compat Mode Limitations
- No automatic retry with exponential backoff (Section I.2 describes target)
- No per-plan queue partitioning (Section H.1 describes target)
- No background job status polling (jobs complete within the request or fail)
- No priority lanes (Section Q.2 describes target)
- DLQ behavior (Section I.2) is replaced by marking the event as failed + user retry

================================================================================
V) DATA UPDATE SYSTEM RELATIONSHIP
================================================================================

V.1 Hierarchy
The Event System is the source of truth for "what happened" (rich, specific domain events).
The Data Update System is the regeneration orchestrator that consumes events and manages artifact cascades.

V.2 Trigger Type Mapping
Data Update System derives a normalized TriggerType from specific domain events:

| Data Update TriggerType     | Source Domain Event(s)                                      |
|-----------------------------|-------------------------------------------------------------|
| DESTINATION_CHANGED         | plan.destination_changed, plan.destination_set              |
| MOVE_DATE_CHANGED           | plan.move_date_changed, plan.move_date_set                  |
| PROFILE_UPDATED             | profile.updated, profile.version_created                    |
| MANUAL_REFRESH              | artifact.refresh_requested, plan.refresh_requested          |
| SYSTEM_EXTERNAL             | external_data.refreshed                                     |

TriggerType is derived from specific domain events with explicit semantics.
TriggerType is NOT encoded as "changed_fields" inside generic events.
plan.updated_metadata MUST NOT be used for structural changes that require cascade.

V.3 Data Update Job Reference
Each Data Update job MUST reference:
- source_event_id (the domain event that caused it)
- trigger_type (normalized enum from V.2)
- trigger_payload_pointers (IDs/pointers only)

V.4 Flow
Domain event emitted → Data Update derives TriggerType → Data Update schedules update job(s) → jobs generate artifacts → artifact events emitted (e.g., research.completed, recommendation.generated) and current pointers updated.

V.5 Guide Generation Gate
Guide is NOT part of the automatic cascade (see F.1).
The Data Update DAG may compute prerequisites (research, recommendations, requirements, timeline, tasks) automatically, but the final guide generation step is gated behind an explicit user-triggered event: guide.regenerate_requested.
When all prerequisites are ready and guide is stale, Data Update System emits guide.regenerate_suggested to signal the UI.

================================================================================
W) CROSS-SYSTEM REFERENCES
================================================================================

W.1 Systems That Emit Domain Events
- Plan System (plan-system.md) — plan lifecycle + anchor field events
- Profile System (profile-system.md) — profile updates + version creation
- Onboarding System (onboarding-system.md) — plan creation trigger
- Research System (research-system.md) — research completion/failure
- Recommendation System — recommendation generation/selection
- Guide Generation System (guide-generation.md) — guide lifecycle
- Settling-In Tasks System — task status changes

W.2 Systems That Consume Domain Events
- Data Update System (data-update-system.md) — primary artifact cascade orchestrator
- Guide Generation System (guide-generation.md) — guide.regenerate_requested ONLY
- Notification System — notification-eligible events
- Dashboard System — materialization triggers

W.3 Shared Contracts
- Profile versioning: profile_version_id and snapshot triggers defined in profile-system.md Section G
- Plan LifecycleState × Stage: defined in plan-system.md Section C
- Current pointer model: defined in this document Section F.0, implemented by artifact systems
- Chat History: chat-history-system.md persists conversations; does NOT emit domain events

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Plan System | PARTIAL |
| Profile System | PARTIAL |
| Onboarding System | PARTIAL |
| Research System | PARTIAL |
| Recommendation System | MINIMAL |
| Guide Generation System | PARTIAL |
| Settling-in Tasks | PARTIAL |
| Data Update System | NOT_IMPLEMENTED |
| Notification System | MINIMAL |
| Dashboard System | PARTIAL |
| Chat History System | NOT_IMPLEMENTED |

END OF EVENT / TRIGGER SYSTEM DEFINITION