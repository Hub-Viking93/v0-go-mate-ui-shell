GoMate — Plan System
System Definition (Answering the full Question Framework)

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Plans are stored in the relocation_plans table with plan_id (UUID)
- Plan uses two fields for state: status (active/archived) and stage
  (collecting/generating/complete/arrived)
- A separate `locked` boolean is used as the effective mutability gate for
  profile writes, but it is not a canonical LifecycleState
- No LifecycleState enum exists — the 6-state model (CREATED/ACTIVE/LOCKED/
  ARCHIVED/DELETED/CORRUPTED) is a v2 target
- Current plan is resolved from `relocation_plans.is_current`; no
  `user.current_plan_id` field exists in the live schema
- Plan rows are created eagerly by `/api/profile` and profile-save helpers,
  not only at interview completion
- Plan switching exists (via plan selector and RPC) — this works
- `plan_version` exists and is incremented on profile edits, lock, and archive
  operations, but it is not tied to immutable profile snapshots

V1 Deviations from Canonical Spec:
- Section C.1 (LifecycleState): NOT_IMPLEMENTED — v1 has only status
  (active/archived) and stage (collecting/generating/complete/arrived).
  Section C.3 "Legacy Status Mapping" accurately describes the v1 reality.
  LifecycleState is the v2 target; v1's two-field model is the current truth.
- Section D.6 (Fork semantics): NOT_IMPLEMENTED — no parent_plan_id column,
  no fork operation. Users create new independent plans instead.
- Section E (Locking): PARTIAL — lock/unlock exists via `locked` boolean and
  `PATCH /api/profile`, but there is no canonical LOCKED LifecycleState,
  no immutable lock snapshot, and lock remains reversible
- Section K.4 (Corruption detection): NOT_IMPLEMENTED — no CORRUPTED state,
  no integrity checks
- Profile versioning pointers (current_profile_version_id,
  last_requirement_set_version_id): NOT_IMPLEMENTED — these columns do not
  exist on the plans table
- Soft delete / DELETED state: NOT_IMPLEMENTED — plans can be archived but
  not soft-deleted with recovery window
- Plan version counter: PARTIAL — monotonic `plan_version` exists, but it
  does not replace profile snapshots or lifecycle-state validation

V1 Cross-Reference Adjustments:
- 12+ definitions reference LifecycleState — in v1, read this as plan.status
  (active/archived) combined with plan.stage
- References to "plan locked" should be read as `locked=true` plus the current
  stage, not as a true LifecycleState
- References to CORRUPTED state — no equivalent in v1; data integrity issues
  surface as runtime errors
- References to fork — not available; users must create new plans manually

V1 Fallback Behavior:
- Plan lifecycle: status=active means the plan is usable; status=archived
  means read-only (user can unarchive)
- Plan stage progression: collecting → generating → complete → arrived
  (enforced by state machine in lib/gomate/state-machine.ts)
- Lock/freeze is approximated by `locked=true` and blocked profile writes, but
  it is reversible and not a full canonical lock model
- Plan creation: current plan bootstrap happens eagerly and does not wait for
  destination confirmation

============================================================

============================================================
A. PURPOSE & OWNERSHIP
============================================================

A.1 Core Definition (Canonical)
A Plan is GoMate's root authority object for a single relocation journey instance.
A Plan is simultaneously:
- A logical workspace: the user's relocation "project"
- A database partition key: the primary isolation boundary for all plan-scoped objects
- A state machine: controls what can be edited/generated/executed
- An AI context container: the only permitted scope for intelligence + artifacts in chat/agent flows

A Plan is NOT:
- A global user profile
- A generic "account"
- A multi-journey bucket

Mutability:
- A Plan is a mutable working state while in active lifecycle states (created → active).
- A Plan becomes immutable for core plan-defined artifacts when locked (see Locking).

A.2 Representation Scope (What a Plan Represents)
Canonical: One plan represents one relocation attempt to one destination jurisdiction with one primary purpose and one intended move window.
Practical definition:
- One destination country (required once known)
- Optional destination city (if known)
- One relocation purpose (work/study/family/etc.)
- One time-bound journey instance (move date window; can be unknown initially)

A Plan can represent "an attempt" even if it fails or changes direction, but if destination country changes, the plan should fork to a new plan (see Switching + Duplicate Prevention).

A.3 Ownership Model
Current: Plan belongs to user_id (single-owner).
Future extension-ready:
- organization_id may exist later for enterprise customers, but the contract remains:
  - Every plan must have a primary user owner.
  - org_id does not replace user_id; it augments access control.

Canonical ownership fields:
- user_id (required)
- organization_id (nullable, future)

A.4 Authority Level (Root Object)
Plan is the highest authority object for relocation data and artifacts.
Nothing plan-scoped can exist without plan_id.
Plan is the parent for:
- Relocation Profile (plan-scoped profile snapshot/versioning)
- Interview answers
- Chat conversations (plan-scoped)
- Requirements + requirement_set versions
- Tasks + task generations
- Timeline items
- Guides (generated artifacts)
- Recommendations (visa, steps, etc.)
- Bookings (flight/housing/appointments tracking if supported)

A.5 Isolation Role (Three Isolation Boundaries)
Plan provides:
1) Data isolation boundary:
   - All reads/writes are filtered by plan_id
   - DB schema uses foreign keys to enforce plan linkage
2) Execution isolation boundary:
   - Jobs (generation/runs) are tied to a plan_id
   - Idempotency keys always include plan_id
3) AI context isolation boundary:
   - AI retrieval and prompt context MUST be constrained to active plan_id
   - Cross-plan context is forbidden unless user explicitly requests comparison (future feature with explicit UI/consent)

A.6 Pre-Plan Phase (No plan_id Exists)

Before a plan is created, the user exists in a pre-plan phase. During this phase:
- No plan_id exists.
- No plan-scoped artifacts can be created, stored, or referenced.
- The only permitted interaction is the Onboarding Interview Chat (see Onboarding System Definition).
- The Onboarding Interview Chat collects structured inputs (destination_country at minimum) required to create a plan.
- The Plan Contextual Chat Assistant is disabled.
- The dashboard is locked.
- No generation pipelines may execute.

The pre-plan phase ends when the Onboarding Interview completes and the Plan System creates the plan (see D.1).

============================================================
B. PLAN IDENTITY MODEL
============================================================

B.1 Unique Identity Definition
Required:
- plan_id (UUID)
- user_id (UUID)

Optional (metadata, not identity):
- destination_country (string/ISO code)
- destination_city (string)
- purpose (enum/string)
- intent_id (string|null)  // if you later introduce an "Intent" object
- move_date (date|null) or move_window (start/end nullable)
- parent_plan_id (uuid|null)  // set only for forked plans (see D.6)

Canonical stance:
- plan_id is the only true identifier for referencing.
- Everything else is descriptive metadata and can change until locked.

B.2 Uniqueness Constraints (Duplicates Policy)
User may have multiple plans, including same country/purpose, but must be deliberate.
Canonical rules:
- Allow multiple plans per user, including same destination_country and purpose.
- Prevent accidental duplicates via "duplicate detection" at creation time:
  - If an existing plan is ACTIVE with same destination_country + purpose and updated recently, warn and offer to switch instead of creating.
- "Hard uniqueness" is NOT enforced for destination/purpose because users legitimately have multiple attempts.

Duplicate detection implementation detail:
- "Recently updated" means updated_at within the last 30 days (configurable).
- Detection runs BEFORE plan creation, not after.
- If the user explicitly chooses "Create anyway", no further warning is shown.
- Forked plans (parent_plan_id is not null) skip duplicate detection because they are intentionally derived.

B.3 Current Plan Resolution (Critical)

Canonical mechanism:
- user.current_plan_id is stored explicitly on the user record (single source of truth).
- "Current plan" is NOT derived from last accessed time or state, because that creates bugs and surprises.

Rules:
- current_plan_id must always point to a plan owned by user_id and not in DELETED state.
- If current_plan_id is null, the user has no active plan. This means either:
  (a) First-time user who has not completed onboarding interview → route to Onboarding System.
  (b) All plans have been archived or deleted → prompt user to create a new plan or unarchive an existing one.
- current_plan_id may point to a plan in any non-DELETED LifecycleState (CREATED, ACTIVE, LOCKED, ARCHIVED, CORRUPTED).

Derived convenience field (non-authoritative):
- An `is_current` boolean column MAY exist on the plan row as a query optimization.
- If it exists, it MUST be maintained as a strict projection of user.current_plan_id.
- It MUST NEVER be used as the source of truth for current plan resolution.
- If user.current_plan_id and is_current disagree, user.current_plan_id wins unconditionally.

Integrity enforcement:
- On every API request that requires plan context, the server resolves current_plan_id from the user record.
- The server validates: (a) the plan exists, (b) the plan is owned by the requesting user, (c) the plan is not in DELETED state.
- If validation fails, the server clears current_plan_id to null and returns an error prompting plan selection.

Edge cases:
- Race condition: Two concurrent requests try to switch current_plan_id. Resolution: last-write-wins is acceptable because both are user-initiated and the final state is valid.
- Orphaned pointer: current_plan_id references a plan that was hard-deleted (retention expired). Detection: validation check on every request. Recovery: clear to null, prompt user.
- User deletes the current plan: The delete operation MUST atomically clear current_plan_id if it matches the deleted plan_id.

B.4 Referential Integrity (Hard Rule)
Every plan-scoped object MUST have plan_id and be query-filtered by plan_id.
At DB level:
- All child tables include plan_id with foreign key referencing plans.plan_id (or equivalent).
At app level:
- Every service method requires plan_id as input (no "optional plan_id").

============================================================
C. PLAN LIFECYCLE STATES
============================================================

C.1 Two-Dimensional State Model (Canonical)

A plan has TWO orthogonal state dimensions:

DIMENSION 1: LifecycleState (canonical lifecycle — governs mutability, permissions, system behavior)

Canonical LifecycleState values:
- CREATED        // plan exists, minimal metadata, onboarding interview just completed
- ACTIVE         // user is working; profile/tasks/guides can be generated and updated
- LOCKED         // frozen baseline; no regeneration of core artifacts without explicit fork
- ARCHIVED       // not in use; read-only; can be re-activated
- DELETED        // soft-deleted; hidden; recoverable for a period
- CORRUPTED      // system detected integrity issue; locked down for safety

LifecycleState is the AUTHORITY for:
- What operations are permitted (edits, generation, locking)
- Access control decisions (read-only vs read-write)
- System behavior (artifact mutability, fork requirements)

DIMENSION 2: Stage (UX progress — represents user journey phase)

Canonical Stage values:
- collecting      // user is providing profile inputs via chat or UI
- generating      // AI generation pipeline is running (guide, tasks, timeline, etc.)
- complete        // pre-arrival work is done; user has not yet arrived
- arrived         // user has confirmed arrival; post-arrival mode active

Stage is the AUTHORITY for:
- UX rendering (which dashboard panels, chat modes, task views to show)
- Feature gating (post-arrival features require stage=arrived)
- Chat system prompt selection (pre-arrival vs post-arrival assistant)

Stage is NOT the authority for mutability or lifecycle permissions. Those belong to LifecycleState.

Optional internal (system job states, not plan states):
- GENERATING     // do NOT make this a plan LifecycleState; this is a job state
- PAUSED         // future feature if you need it

C.2 LifecycleState × Stage Matrix

Not all combinations are valid. The canonical matrix:

| LifecycleState | collecting | generating | complete | arrived |
|----------------|------------|------------|----------|---------|
| CREATED        | YES        | NO         | NO       | NO      |
| ACTIVE         | YES        | YES        | YES      | YES     |
| LOCKED         | NO         | NO         | YES      | YES     |
| ARCHIVED       | NO         | NO         | YES      | YES     |
| DELETED        | (any - frozen at time of deletion)          |
| CORRUPTED      | (any - frozen at time of corruption)        |

Rules:
- CREATED plans are always in `collecting` stage (the plan was just created from the onboarding interview; the user is still providing inputs).
- ACTIVE plans can be in any stage (the user progresses through the journey).
- LOCKED plans can only be in `complete` or `arrived` (you cannot lock a plan that is still collecting or generating).
- ARCHIVED plans preserve their stage at time of archival (typically `complete` or `arrived`).
- DELETED and CORRUPTED plans freeze their stage at the moment of state change.

C.3 Legacy Status Mapping (Alignment Layer)

The current codebase uses a `status` field with values `active` and `archived`. This is a partial projection of LifecycleState:

| Legacy status | LifecycleState equivalent              |
|---------------|----------------------------------------|
| "active"      | CREATED, ACTIVE, or LOCKED             |
| "archived"    | ARCHIVED                               |
| (no mapping)  | DELETED (soft-delete; not a status)    |
| (no mapping)  | CORRUPTED (system flag; not a status)  |

The legacy `status` field is NOT the canonical lifecycle model. It will be superseded by the LifecycleState dimension. During the transition period, both may coexist, but LifecycleState is authoritative when they disagree.

"Draft" (referenced in some contexts) is NOT a LifecycleState. It refers to:
- A plan in LifecycleState=CREATED and Stage=collecting, OR
- The pre-plan onboarding interview phase (no plan_id exists yet).

C.4 LifecycleState Meaning Contract (Exact)

CREATED:
- Plan exists; the onboarding interview has completed and confirmed at least destination_country.
- Plan profile is initialized with onboarding interview outputs.
- No derived artifacts have been generated yet (no guide, no tasks, no timeline).
- User may still be providing additional profile inputs.

ACTIVE:
- Plan is the working workspace.
- All generation systems operate against this plan.
- User edits allowed to all mutable fields.
- Artifact generation and regeneration permitted.
- Stage progresses through collecting → generating → complete → arrived as the user advances.

LOCKED:
- Plan is frozen as a historical baseline.
- Profile snapshots and requirement/task sets are fixed to the locked baseline.
- The user can view, but cannot materially change plan-defining inputs that would invalidate artifacts.
- To continue with changed assumptions, user forks a new plan (preferred) or explicitly unlocks if allowed (see lock reversibility).
- Task status updates (mark complete) remain allowed because they represent execution progress, not artifact mutation.

ARCHIVED:
- Plan is inactive; read-only by default.
- Can be unarchived to ACTIVE.
- Not shown in primary dashboard view; accessible via plan list/history.

DELETED:
- Soft deleted; not accessible in normal UI.
- Hard delete may occur later per retention policy.
- No operations permitted except restore (within retention window) or hard delete (admin/system).

CORRUPTED:
- Plan flagged due to integrity failure (missing critical children, mismatched versions, impossible state).
- User cannot proceed; system offers repair/reset/fork options.
- All write operations blocked except system repair actions and admin tools.

C.5 State Authority (Who Can Change State)
- User: can archive/unarchive; can request lock; can delete (soft).
- System: can set CORRUPTED; can auto-archive stale plans (optional); can move DELETED → hard delete after retention. System transitions CREATED → ACTIVE when first generation completes.
- Admin (future): can restore deleted, force archive, assist recovery.

C.6 State Transition Rules (Strict)
Allowed transitions:
- CREATED → ACTIVE (first generation pipeline completes successfully)
- ACTIVE → LOCKED (user confirms lock, OR system proposes lock after completion milestone and user accepts)
- ACTIVE → ARCHIVED (user action)
- ARCHIVED → ACTIVE (user action — unarchive)
- CREATED → DELETED (user action — abandon plan before any generation)
- ACTIVE → DELETED (user action)
- ARCHIVED → DELETED (user action)
- ANY → CORRUPTED (system only — integrity check failure)
- CORRUPTED → ARCHIVED (after successful repair)
- CORRUPTED → DELETED (if unrecoverable)

Forbidden transitions (examples):
- LOCKED → ACTIVE (lock is irreversible; user must fork — see E.4)
- DELETED → ACTIVE (must be restored first via recovery flow → ARCHIVED → ACTIVE)
- LOCKED → CREATED (nonsense)
- CREATED → LOCKED (cannot lock a plan that has never been active)
- ARCHIVED → LOCKED (locking is a forward operation from ACTIVE only)

Transition atomicity:
- Every state transition MUST be atomic (single database write).
- Transition MUST validate the current state before applying (optimistic concurrency: check current state matches expected state).
- If the current state does not match the expected pre-transition state, the transition MUST fail with a conflict error (see L.5).

C.7 Transition Triggers

- CREATED → ACTIVE: System triggers automatically when first generation pipeline (guide, tasks, or timeline) completes successfully for this plan.
- ACTIVE → LOCKED: User confirms "Lock plan" OR system proposes lock when all required tasks are done and user accepts.
- ACTIVE → ARCHIVED: User action via plan management UI.
- ARCHIVED → ACTIVE: User action (unarchive).
- ANY → CORRUPTED: System integrity checks detect failure (see K.4 for detection criteria).

Edge cases for transitions:
- Generation fails on a CREATED plan: Plan remains CREATED. User can retry generation or edit profile and retry.
- User tries to lock a plan in `collecting` stage: Rejected. Lock requires stage ∈ {complete, arrived}.
- User tries to archive the current plan: Allowed. System clears current_plan_id to null and prompts user to select another plan or create new.
- Concurrent transition attempts: Second attempt fails with conflict error. Client must refresh and retry.

============================================================
D. PLAN CREATION SEMANTICS
============================================================

D.1 Creation Trigger (Canonical)

Plan creation occurs when the Onboarding Interview completes and the user has confirmed at least one required field: destination_country.

Precise lifecycle:
1. User sends first onboarding chat message → Onboarding Interview Chat session starts. NO plan exists yet.
2. The Onboarding Interview collects structured inputs (destination_country is REQUIRED; move_date, purpose, household info are OPTIONAL).
3. Interview completes when: destination_country is confirmed by the user.
4. At the moment of interview completion → Plan System creates the plan:
   - plan_id generated (UUID)
   - LifecycleState = CREATED
   - Stage = collecting
   - destination_country populated from interview
   - Other optional fields populated if collected during interview
   - user.current_plan_id set to new plan_id
5. All downstream systems can now attach to this plan_id.

Plan creation boundary:
- Pre-plan phase: onboarding interview, no plan_id exists, no artifacts can be created.
- Post-plan phase: all artifacts tied to plan_id; dashboard, timeline, requirements, guide systems become available.

Plan is NOT created on:
- First chat message (that starts the onboarding interview, not the plan)
- Random page loads
- Signup alone (user must go through onboarding interview)

For returning users creating additional plans:
- "Create new plan" button in plan management UI triggers a new onboarding interview session.
- The same interview-completion → plan-creation flow applies.
- Duplicate detection (D.4) runs before the new plan is committed.

D.2 Creation Preconditions
Required:
- user_id (authenticated session)
- destination_country (confirmed via onboarding interview)

Optional (populated during or after interview):
- destination_city
- purpose
- move_date / move_window

D.3 Creation Authority
- User: yes (primary — via onboarding interview completion)
- System: yes, but only as the mechanical executor of plan creation after the user-driven interview completes
- Admin: yes (future support tooling)

D.4 Duplicate Prevention (Soft Guardrails)
On plan creation, system runs duplicate detection:
- Match candidate existing plans for user_id by:
  - destination_country (if provided)
  - purpose (if provided)
  - recency (updated_at within 30 days, configurable)
If high similarity:
- UI offers: "Switch to existing plan" vs "Create anyway"
No hard block.

Forked plans (parent_plan_id is not null) skip duplicate detection because they are intentionally derived from an existing plan.

D.5 Default Initialization
When created, initialize:
- Plan Profile (plan-scoped) with fields from onboarding interview (destination_country at minimum)
- Stage = collecting
- LifecycleState = CREATED
- No tasks, no requirements, no guide artifacts (generation has not run yet)
- Audit fields: created_at, updated_at, version=1
- parent_plan_id = null (unless this is a fork; see D.6)
- user.current_plan_id = new plan_id (atomic with plan creation)

D.6 Fork Semantics (Canonical)

Fork is a DISTINCT operation from "Create New Plan". Fork creates a new plan derived from an existing plan.

When fork is used:
- REQUIRED: When a user needs to modify a LOCKED plan. The locked plan stays frozen; the fork becomes the new working copy.
- OPTIONAL: When a user wants to branch an ACTIVE plan to explore a different scenario (e.g., same destination but different visa path).

Fork operation (atomic):
1. Create new plan with new plan_id (UUID).
2. Set parent_plan_id = source plan's plan_id.
3. Copy structured inputs from source plan:
   - All Plan Profile fields (destination_country, destination_city, purpose, move_date, household info, budget, visa_type, etc.)
   - Profile is copied as a new mutable working state (not a reference to the source).
4. Do NOT copy derived artifacts (tasks, requirements, guides, timeline, recommendations).
   - These must be regenerated from the forked profile to ensure consistency.
5. Set new plan's LifecycleState = CREATED, Stage = collecting.
6. Set user.current_plan_id = new plan_id (user is now working on the fork).
7. Source plan remains unchanged (LOCKED, ACTIVE, or ARCHIVED — whatever it was).

Fork creates a snapshot-based version for the new plan's profile (PRE_GENERATION_SNAPSHOT type) immediately, so the lineage is traceable.

Fork validation:
- Source plan must exist and be owned by the requesting user.
- Source plan must be in LifecycleState ∈ {ACTIVE, LOCKED, ARCHIVED} (cannot fork DELETED or CORRUPTED plans).
- Duplicate detection (D.4) is skipped for forks.

Fork is NOT:
- A "move" or "rename" — the source plan is never mutated by a fork.
- An "unlock" — the source plan's lock state is not changed.
- A "merge" — there is no operation to merge two plans.

============================================================
E. PLAN LOCKING SEMANTICS
============================================================

E.1 Lock Definition (Canonical)
Lock means "freeze plan-defining inputs and core generated artifacts baseline".
Lock enforces:
- Write protection on plan metadata that affects requirements/tasks/timeline generation (destination_country, visa path, household composition, move date anchor, etc.)
- No automatic regeneration of core artifacts
- Only read-only access to baseline artifacts

Lock is not "disable the app".
It is "this plan is now a historical record / completed baseline".

E.2 Lock Scope (Per System)
Profile:
- Core fields become read-only (fields that affect compliance generation).
- Non-core notes may remain editable (optional).

Chat:
- Plan Contextual Chat remains allowed but becomes "read-only context + Q&A":
  - user can ask questions
  - system must not mutate plan artifacts automatically
  - any action that would generate/modify tasks/requirements requires user to fork a new plan
- If the chat detects the user is asking to change locked artifacts, it must respond with guidance to fork.

Tasks:
- Existing tasks remain viewable.
- Status changes may be allowed (mark complete) if you want "execution after lock".
Canonical choice:
- Allow status updates (user still doing tasks), but forbid regeneration/new task creation unless fork.

Guides:
- Existing guides are immutable (versioned).
- New guide generation is blocked unless fork.

Bookings:
- View allowed; edits allowed only if bookings are not considered "core artifacts".
Canonical: bookings can remain editable because they are user-entered records, not generated compliance artifacts.

Recommendations:
- Recommendations are frozen; new recommendations require fork.

Timeline:
- Timeline baseline is frozen; completion checkmarks may remain editable.

E.3 Lock Authority
- User can lock.
- System can propose lock when "plan completed" (all required tasks done), but user must confirm.
- Admin can lock (future).

Lock preconditions:
- Plan must be in LifecycleState = ACTIVE.
- Plan must be in Stage ∈ {complete, arrived} (cannot lock a plan still in collecting or generating).
- At least one generation cycle must have completed (there must be artifacts to lock).

E.4 Lock Reversibility (Decision)
Canonical: LOCK is irreversible for the plan baseline.
If user needs changes:
- Fork a new plan (creates a new plan_id with copied data and a new profile_version baseline).
Reason: unlock creates audit confusion and breaks "frozen baseline" meaning.

Optional advanced feature (only if truly needed):
- "Unlock" allowed within short grace period (e.g., 24h) with explicit warning and audit log.

E.5 Lock Intent (Why Lock Exists)
- Preserves a clean historical record
- Prevents silent drift where artifacts no longer match inputs
- Enables auditability and stable "what you planned vs what you did"
- Supports future "export plan as dossier" use case

E.6 Lock Side Effects (Atomic)

When a plan is locked, the following occur atomically:
1. LifecycleState transitions ACTIVE → LOCKED.
2. A PLAN_LOCK_SNAPSHOT is created for the Plan Profile (see Profile System Definition, versioning).
3. All artifact version pointers are recorded as the locked baseline (profile_version_id, requirement_set_version_id, etc.).
4. Plan version counter increments.
5. locked_at timestamp is recorded.

If any step fails, the entire lock operation rolls back and the plan remains ACTIVE.

============================================================
F. PLAN SWITCHING
============================================================

F.1 Switching Trigger
User switches plan via:
- explicit plan selector UI
- deep link to plan workspace
No automatic switching based on chat content.

F.2 Switching Mechanism
Switching sets:
- user.current_plan_id = selected_plan_id
and loads plan-scoped context.

Switching is an atomic database update:
1. Validate: selected_plan_id exists, is owned by user, is not in DELETED state.
2. Update user.current_plan_id = selected_plan_id.
3. No mutation is performed on the previously-current plan (it stays in its current LifecycleState/Stage).
4. Client reloads all plan-scoped context from the newly selected plan.

F.3 Switching Effects (Strict)
When switching:
Chat:
- Load conversations for selected plan only
- Hide other plan conversations by default
- If switching from one plan to another mid-conversation, the conversation context resets to the new plan
Dashboard:
- Recompute from plan-scoped artifacts only
Tasks:
- Filter by plan_id
Timeline:
- Filter by plan_id
Guide:
- Load plan's guide versions only
Recommendations:
- Load plan's latest recommendation version only

F.4 Switching Isolation Guarantee
Hard rule:
- No cached artifacts from previous plan may be reused without plan_id validation.
Implementation rule:
- Every API call includes plan_id.
- Server validates user owns plan_id.
- Client-side state (React state, SWR cache, etc.) must be invalidated or keyed by plan_id on switch.

F.5 Switching Edge Cases

- User switches to a CORRUPTED plan: Switch succeeds (current_plan_id is updated), but the dashboard renders the corruption recovery UI (see L.2).
- User switches to an ARCHIVED plan: Switch succeeds. Dashboard renders in read-only mode with an "Unarchive" option.
- User switches to a LOCKED plan: Switch succeeds. Dashboard renders in locked mode (view + task status updates only).
- User switches to a plan in Stage=generating: Switch succeeds. Dashboard shows generation progress indicator.
- Network failure during switch: current_plan_id is NOT updated (atomic write failed). Client shows error and retains previous plan context.

============================================================
G. MULTIPLE PLANS
============================================================

G.1 Maximum Plan Count
Canonical: effectively unlimited, but apply product limits:
- e.g., free tier: up to N plans
- pro tier: higher/unlimited
This is a business rule, not a system integrity rule.

G.2 Concurrent Active Plans
Yes, user may have multiple ACTIVE plans, but only one current_plan_id at a time.

G.3 Concurrent Locked Plans
Yes, multiple plans can be LOCKED.

G.4 Concurrent Editing
User can switch between plans, but cannot "merge" plan contexts automatically.
No multi-plan simultaneous editing in one workspace.

G.5 Plan List Ordering
Plan list UI should display plans ordered by:
- Primary: LifecycleState priority (ACTIVE first, then CREATED, then LOCKED, then ARCHIVED)
- Secondary: updated_at descending (most recently touched first)
- DELETED plans are never shown in the plan list (only in admin/recovery views).
- CORRUPTED plans are shown with a warning badge.

============================================================
H. DELETION & ARCHIVAL
============================================================

H.1 Deletion Types
Soft delete (canonical):
- plan LifecycleState = DELETED
- hidden from UI
- retained for recovery window

Hard delete (retention-based):
- physically removed after retention period (e.g., 30–90 days) OR immediately on explicit "permanent delete" if allowed.

H.2 Deletion Authority
- User can soft delete.
- Admin can restore or hard delete (future).

H.3 Artifact Handling on Delete
Canonical:
- Deleting a plan deletes access, not data immediately.
- All child artifacts become inaccessible via plan_id.
- Hard delete cascades and removes all children.

H.4 Recovery
- Soft-deleted plans can be restored within retention window.
- Restore returns plan to ARCHIVED (safe) or ACTIVE (user choice), never silently to current.
- Restore NEVER sets user.current_plan_id automatically. User must explicitly switch to the restored plan.

H.5 Deleting the Current Plan

When the user deletes the plan that is currently selected (current_plan_id == deleted plan_id):
1. Plan LifecycleState transitions to DELETED.
2. user.current_plan_id is atomically set to null.
3. Client receives the null current_plan_id and must prompt the user to:
   (a) Select another existing plan, OR
   (b) Create a new plan (enters onboarding interview).
4. If the user has no other non-DELETED plans, they are routed to the onboarding flow.

============================================================
I. PLAN DEPENDENCIES
============================================================

I.1 Dependent Systems (Full List)
Plan-scoped:
- Relocation Profile System (plan profile + versions)
- Interview System (answers, progress)
- Chat History System (conversations — Plan Contextual Chat only, NOT Onboarding Interview Chat)
- Requirements System (requirement sets + versions)
- Settling-in Task System (tasks + versions)
- Timeline System (items + anchors)
- Guide Generation + Viewer (guide versions)
- Recommendation System (visa/recommendation versions)
- Booking/Tracking System (if supported)
- Progress Tracking (derived metrics; never source of truth)

NOT plan-scoped:
- Onboarding Interview Chat (exists in pre-plan phase, no plan_id)
- User Profile (Layer 1 — global, user-scoped; see Profile System Definition)
- Authentication / session management

I.2 Dependency Direction (Parent → Child)
Plan is parent of all plan-scoped systems above.
No child can exist without plan_id.

I.3 Dependency Creation Rules
Every child object must require:
- plan_id
Additionally, versioned children must bind to:
- profile_version_id
- requirement_set_version_id (when applicable)

I.4 Dependency Lifecycle Implications

When plan transitions LifecycleState:
- ACTIVE → LOCKED: All child systems switch to read-only mode for artifact content (task status updates still allowed).
- ACTIVE → ARCHIVED: All child systems become read-only. No generation, no edits.
- ANY → DELETED: All child systems become inaccessible. No reads, no writes.
- ANY → CORRUPTED: All child system writes blocked. Reads may be allowed for diagnostic purposes.

When plan is forked (D.6):
- No child objects are copied. The fork starts with an empty artifact slate.
- The forked plan's profile is copied as a new mutable working state.
- Generation must run fresh on the forked plan to create new artifacts.

============================================================
J. DATA INTEGRITY GUARANTEES
============================================================

J.1 Isolation Guarantee (Non-Negotiable)
No plan-scoped object exists without plan_id.

J.2 Cross-Plan Contamination Prevention
Enforced by:
- DB foreign keys
- Row-level access checks (user_id + plan ownership)
- Mandatory plan_id filters in every query
- No "global caches" without plan_id partition key

J.3 Referential Integrity (DB-Level)
- plans.plan_id is referenced by every child table.
- Cascading rules:
  - soft delete: no cascade (logical)
  - hard delete: cascade delete children

J.4 AI Context Isolation (Non-Negotiable)
AI can only access:
- data belonging to current_plan_id
- plus global non-user data (country guides, law references)
Never access other plan data unless user explicitly selects it and system creates a safe comparison context (future feature).

The Onboarding Interview Chat (pre-plan) has NO access to any plan-scoped data because no plan exists yet. It operates with user-level context only (User Profile Layer 1 defaults, if available).

J.5 State Consistency Invariants

The following invariants must hold at all times:
1. If user.current_plan_id is not null, the referenced plan must exist and be owned by the user.
2. If a plan's LifecycleState is LOCKED, no child artifact may have been modified after the locked_at timestamp (except task status updates).
3. If a plan's LifecycleState is CREATED, no derived artifacts (guides, tasks, timeline, recommendations) may exist for that plan.
4. A plan's parent_plan_id (if set) must reference an existing plan owned by the same user.
5. A plan's Stage must be valid for its LifecycleState per the matrix in C.2.

Violation of any invariant triggers corruption detection (see K.4).

============================================================
K. PERSISTENCE & RECOVERY
============================================================

K.1 Storage Model
- plans table (or relocation_plans) is canonical plan store.
- plan_id is primary key.

K.2 Required Fields (Canonical Schema)
Required:
- plan_id (uuid, pk)
- user_id (uuid, fk -> users)
- lifecycle_state (enum: CREATED|ACTIVE|LOCKED|ARCHIVED|DELETED|CORRUPTED)
- stage (enum: collecting|generating|complete|arrived)
- created_at (timestamptz)
- updated_at (timestamptz)
- version (int)

Optional:
- destination_country (string)
- destination_city (string)
- purpose (string/enum)
- move_date / move_window_start / move_window_end (date)
- parent_plan_id (uuid, fk -> plans.plan_id, nullable)
- locked_at (timestamptz, nullable)
- archived_at (timestamptz, nullable)
- deleted_at (timestamptz, nullable)
- corrupted_reason (text, nullable)

Convenience pointers (non-authoritative, must be validated):
- current_profile_version_id (uuid|null)
- last_requirement_set_version_id (uuid|null)

Legacy field (alignment layer):
- status (string: "active"|"archived") — maintained for backward compatibility during migration; see C.3.

K.3 Consistency Guarantees
- State transitions are atomic and validated.
- Writes use transactions when they affect multiple plan-scoped objects.
- current_plan_id updates must be atomic with plan existence checks.
- Plan creation and current_plan_id assignment are atomic (single transaction).

K.4 Corruption Handling
Detection triggers (any of these sets plan to CORRUPTED):
- Plan references a profile_version_id that does not exist in the profile_versions table.
- Plan has LifecycleState=LOCKED but no locked_at timestamp.
- Plan has LifecycleState=LOCKED but contains artifacts modified after locked_at.
- Plan has Stage × LifecycleState combination not in the valid matrix (C.2).
- Plan's parent_plan_id references a non-existent or differently-owned plan.
- Plan has child artifacts (tasks, guides) but LifecycleState=CREATED (should be ACTIVE or beyond).

Response:
- mark plan CORRUPTED
- lock write operations
- offer repair actions:
  - rebuild derived artifacts (requirements/tasks/timeline) from last known good profile_version
  - or fork a clean plan copying user-entered data

Detection timing:
- On plan load (when user switches to or accesses a plan).
- On state transition attempts (validate invariants before and after).
- Optional: periodic background sweep (future).

K.5 Backup & Restore
- Regular DB backups (provider-level)
- Logical export per plan_id (future feature): export plan dossier JSON
- Restore is admin-only or automated rollback (future)

============================================================
L. ERRORS & UX CONTRACT
============================================================

L.1 Plan Not Found
- If current_plan_id points to missing plan: clear current_plan_id to null and prompt user to select/create.
- If user opens deep link to unknown plan: show "Plan not found" and list available plans.

L.2 Corrupted Plan
- Show "This plan needs repair" screen
- Provide actions: "Try repair" (rebuild derived artifacts), "Fork new plan", "Contact support" (future)
- The corruption screen MUST display the corrupted_reason so the user (and support) can understand the issue.

L.3 Switching Failure
- If switch fails (permissions/404): do not update current_plan_id; show error and keep user in previous plan.

L.4 Deleted Plan Access Attempt
- Show "This plan was deleted" with "Restore" (if within window) or "Create new plan".

L.5 State Conflict
- If state changed server-side (race): refresh and show conflict toast; never silently override.
- Client should re-fetch plan state after any failed write operation.

L.6 Pre-Plan Phase UX

When user.current_plan_id is null and no non-DELETED plans exist:
- Route to Onboarding System.
- Show onboarding interview entry point.
- Dashboard, tasks, timeline, guides, recommendations are all hidden/locked.

When user.current_plan_id is null but non-DELETED plans exist:
- Show plan selector.
- User must explicitly select a plan or create a new one.

L.7 Lock Attempt Rejection

When lock is rejected (preconditions not met):
- If Stage is `collecting`: "Complete your profile before locking this plan."
- If Stage is `generating`: "Wait for generation to complete before locking."
- If LifecycleState is not ACTIVE: "Only active plans can be locked."

============================================================
M. PERFORMANCE & SCALABILITY
============================================================

M.1 Expected Scale
- Typical: 1–5 plans per user
- Power users: 10–50 plans (testing, multiple attempts)
System must remain fast at 50+ plans.

M.2 Query Performance Requirements
- Plan list: <200ms server time for typical users
- Plan switch: <300ms to load plan header + first-page artifacts
- All plan-scoped child queries must be indexed on (plan_id, updated_at) or (plan_id, created_at)

M.3 Index Requirements
Required indexes:
- plans(user_id) — for plan list queries
- plans(user_id, lifecycle_state) — for filtered plan list (e.g., "show only active plans")
- plans(parent_plan_id) — for fork lineage queries
- All child tables: (plan_id, created_at) or (plan_id, updated_at)

============================================================
N. SECURITY & ACCESS CONTROL
============================================================

N.1 Access Rules
- A user can only access plans where plans.user_id == user.id (or org-based access later).
- current_plan_id must always be validated against user ownership.

N.2 Authorization Enforcement
- Server-side authorization on every request:
  - validate user session/token
  - validate plan ownership
  - validate plan LifecycleState (e.g., locked restrictions, deleted inaccessibility)
  - validate Stage requirements (e.g., post-arrival routes require stage=arrived)
- Never rely on client-side filtering.

N.3 LifecycleState-Based Access Control

| LifecycleState | Read | Write (profile/artifacts) | Write (task status) | Generate | Delete |
|----------------|------|--------------------------|---------------------|----------|--------|
| CREATED        | YES  | YES                      | NO (no tasks yet)   | YES      | YES    |
| ACTIVE         | YES  | YES                      | YES                 | YES      | YES    |
| LOCKED         | YES  | NO                       | YES                 | NO       | YES    |
| ARCHIVED       | YES  | NO                       | NO                  | NO       | YES    |
| DELETED        | NO   | NO                       | NO                  | NO       | NO*    |
| CORRUPTED      | YES  | NO                       | NO                  | NO       | YES    |

* DELETED plans: only admin restore or hard delete is allowed.

============================================================
O. EXTENSIBILITY (Future-Proofing Without Breaking Contracts)
============================================================

Plan System must support future without breaking plan_id as isolation key:
- Multi-destination plans:
  - either model as "Plan has multiple legs" (child table plan_legs)
  - or keep one plan per destination and introduce "JourneyGroup" as a wrapper (recommended to preserve isolation)
- Organization/shared plans:
  - add plan_members table with roles
  - keep plan_id as the partition key
- Collaborative plans:
  - add access control layer; do not change plan identity model

Canonical rule:
- Never remove plan_id as the root partition key.
- Add wrappers above it if needed (org, journey group).

Fork lineage (already supported):
- parent_plan_id enables tracing plan derivation history.
- Future: "plan family" view showing all forks from a common ancestor.

============================================================
P. PLAN DATA CONTRACT (Schema Summary)
============================================================

Required:
- plan_id (uuid)
- user_id (uuid)
- lifecycle_state (CREATED|ACTIVE|LOCKED|ARCHIVED|DELETED|CORRUPTED)
- stage (collecting|generating|complete|arrived)
- created_at (ts)
- updated_at (ts)
- version (int)

Relocation metadata (required at creation: destination_country; others optional until locked):
- destination_country (string)
- destination_city (string|null)
- purpose (string/enum|null)
- move_date (date|null) or move_window_start/end (date|null)

Fork lineage:
- parent_plan_id (uuid|null)

System fields:
- locked_at (ts|null)
- archived_at (ts|null)
- deleted_at (ts|null)
- corrupted_reason (text|null)
- current_profile_version_id (uuid|null)  // convenience pointer; validate against profile_versions table
- last_requirement_set_version_id (uuid|null)  // convenience pointer; validate

Legacy (alignment layer):
- status (string: "active"|"archived") — derived from lifecycle_state; maintained for backward compatibility

============================================================
CANONICAL NON-NEGOTIABLES (Summary)
============================================================
1) Plan is the root authority + isolation boundary for all relocation intelligence.
2) current_plan_id is explicit and stored on the user record; never inferred.
3) LifecycleState is the canonical lifecycle dimension (CREATED/ACTIVE/LOCKED/ARCHIVED/DELETED/CORRUPTED). Stage is the canonical UX progress dimension (collecting/generating/complete/arrived). These are orthogonal.
4) Plan creation is triggered by Onboarding Interview completion (destination_country confirmed). NOT by first message, NOT by page load.
5) Locked means baseline frozen; to change assumptions, fork a new plan (preferred).
6) Fork creates a new plan with parent_plan_id; copies inputs, regenerates artifacts. Distinct from "Create New Plan" (independent).
7) Every child object requires plan_id; DB + app enforce this.
8) AI context is strictly constrained to current_plan_id. Pre-plan Onboarding Interview Chat has no plan-scoped access.

============================================================
CROSS-SYSTEM REFERENCES
============================================================

Upstream (systems that trigger plan operations):
- Onboarding System (onboarding-system.md) — onboarding drives plan creation
- Chat Interview System (chat-interview-system-definition.md) — interview completion triggers plan creation
- Profile System (profile-system.md) — profile data written to Plan Profile Layer 2

Downstream (systems scoped to plan_id):
- Settling-in Tasks (settling-in-tasks.md) — task graph scoped per plan
- Guide Generation System (guide-generation.md) — guide artifacts scoped per plan
- Recommendation System (recommendation-system.md) — recommendations scoped per plan
- Research System (research-system.md) — research outputs scoped per plan
- Cost of Living System (cost-of-living.md) — cost projections scoped per plan
- Timeline System (timeline-system.md) — timeline scoped per plan
- Progress Tracking System (progress-tracking-system.md) — progress computed per plan
- Dashboard System (dashboard.md) — dashboard renders current plan state
- Plan Contextual Chat (plan-contextual-chat-system.md) — chat scoped per plan
- Chat History System (chat-history-system.md) — conversations linked to plan_id
- Data Update System (data-update-system.md) — artifact regeneration scoped per plan
- Event Trigger System (event-trigger-system.md) — plan events routed through event system
- Document Checklist (document-checklist.md) — documents scoped per plan
- Booking System (booking-system.md) — bookings scoped per plan

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Onboarding System (onboarding-system.md) | PARTIAL |
| Chat Interview System (chat-interview-system-definition.md) | PARTIAL |
| Profile System (profile-system.md) | PARTIAL |
| Settling-in Tasks (settling-in-tasks.md) | PARTIAL |
| Guide Generation System (guide-generation.md) | PARTIAL |
| Recommendation System (recommendation-system.md) | MINIMAL |
| Research System (research-system.md) | PARTIAL |
| Cost of Living System (cost-of-living.md) | PARTIAL |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |
| Progress Tracking System (progress-tracking-system.md) | PARTIAL |
| Dashboard System (dashboard.md) | PARTIAL |
| Plan Contextual Chat (plan-contextual-chat-system.md) | PARTIAL |
| Chat History System (chat-history-system.md) | NOT_IMPLEMENTED |
| Data Update System (data-update-system.md) | NOT_IMPLEMENTED |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |
| Document Checklist (document-checklist.md) | MINIMAL |
| Booking System (booking-system.md) | MINIMAL |

END OF PLAN SYSTEM DEFINITION
