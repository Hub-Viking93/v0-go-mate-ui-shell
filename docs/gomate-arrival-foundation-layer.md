# GoMate — Post-Relocation (Batch 7) Contracts (v1)
Batch 7 = Arrival Foundation Layer
Includes:
7.1 Post-Arrival Stage & Arrival Contract
7.2 Settling-In Persistence Contract

Scope:
- Defines the *foundation truth* for all post-relocation systems.
- Must be implemented before any settling-in generation or chat mode switching.

Non-negotiable:
- Server is source of truth for arrival state.
- All writes are idempotent + atomic.
- Stage drives UX, jobs, and chat behavior.

================================================================================
7.1 POST-ARRIVAL STAGE & ARRIVAL CONTRACT (v1)
================================================================================

## 7.1.1 Purpose
Introduce a reliable, deterministic lifecycle for a relocation plan:
- Pre-arrival planning stage (existing)
- Post-arrival settling-in stage (new)
This contract defines:
- exact plan stage states
- how and when arrival is set
- idempotency + concurrency rules
- how arrival impacts the rest of the system (gating, chat mode, tasks)

## 7.1.2 Canonical entities
### Plan (source of truth for “journey stage”)
Plan fields (logical):
- `plan_id`
- `user_id`
- `destination` (country, city optional)
- `stage` (enum)
- `arrival_date` (date, nullable)
- `stage_updated_at` (timestamptz)
- `current_profile_version` / `lock_version` (depending on existing architecture)
- `created_at`, `updated_at`

Hard rule:
- `plan.stage` and `plan.arrival_date` MUST be read from server on every app session start and on dashboard load.
- Client may cache for UI but never decide stage.

### Stage enum (v1)
`stage` MUST be one of:
- `planning`  (default)
- `arrived`   (post-relocation mode active)
- `archived`  (plan no longer active)

Optional (v1.1) if you want more granularity:
- `pre_departure`
- `in_transit`

But v1 should stay small.

## 7.1.3 Stage invariants (hard constraints)
### planning
- `arrival_date` MUST be NULL
- Post-relocation systems are OFF:
  - settling-in page hidden (or shows “mark arrival first”)
  - post-arrival chat mode OFF
  - compliance timeline OFF
  - alerts OFF

### arrived
- `arrival_date` MUST be NOT NULL
- Post-relocation systems are ON:
  - settling-in tasks available
  - post-arrival chat mode active
  - compliance timeline + alerts available
- Arrival date is immutable unless an explicit admin/support override (v2).
  Reason: deadlines depend on it, changing it breaks user trust and task timelines.

### archived
- Read-only mode:
  - tasks visible but cannot be edited (or can be, but must be explicit)
  - no new generation jobs
  - chat mode may be read-only or disabled

## 7.1.4 Arrival transition (“I’ve arrived”)
Trigger:
- User clicks "I've arrived" on dashboard.

Client behavior:
- Calls server endpoint (see 7.1.5) with Idempotency-Key header.
- Immediately shows optimistic UI “Switching to settling-in…” but must reconcile with server response.
- Must handle duplicate clicks safely.

Server behavior (source of truth):
- Performs an atomic transition:
  - if already arrived: return existing arrived state (idempotent)
  - else:
    - set arrival_date
    - set stage=arrived
    - set stage_updated_at=now
    - emit event
    - optionally enqueue a settling-in generation job (recommended)
All in one transaction.

### Arrival date choice (v1)
Default:
- `arrival_date = current_date` (server date in user's timezone if known; else UTC date)
Optionally allow client to choose date in UI (v1.1):
- If user selects a date, server validates it:
  - not in the future (or allow within +1 day)
  - not older than X months (e.g., 12 months) unless confirmed

Hard rule:
- arrival_date is a DATE (not datetime) to keep deadlines stable and reduce timezone bugs.

## 7.1.5 API contract (arrival)
### POST /api/plan/arrive
Request:
- Headers:
  - Authorization
  - Idempotency-Key: <uuid> (required)
- Body (v1 minimal):
  - {}  (server uses today)
- Body (optional v1.1):
  - { "arrival_date": "YYYY-MM-DD" }

Response:
- 200 OK always on success (including idempotent repeats)
- JSON:
  - plan_id
  - stage
  - arrival_date
  - stage_updated_at
  - post_arrival_enabled: true
  - next_actions:
    - { type: "navigate", to: "/settling-in" }
    - { type: "job_enqueued", job_type: "settling_in_generate", job_id?: ... } (if you enqueue)

Errors:
- AUTH_REQUIRED / AUTH_INVALID_SESSION
- PROFILE_VERSION_MISMATCH (if plan change depends on profile lock—only if your model couples these)
- SCHEMA_INVALID_INPUT (invalid arrival_date)

Idempotency requirement:
- Same (user, Idempotency-Key, endpoint) must return the same response and not re-trigger downstream side effects.
- If you enqueue a job, job enqueue must be idempotent too (same job_key).

## 7.1.6 Downstream effects (gating rules)
These must be consistent across the whole app:
- UI rendering
- chat mode
- APIs

### Gating rules (canonical)
If `plan.stage !== 'arrived'`:
- `/settling-in` page:
  - either not accessible (redirect)
  - or shows a locked state with CTA “Mark arrival”
- `/api/settling-in/*`:
  - list/update must return 409 STAGE_NOT_ARRIVED (or 403) unless purely read-only
- `post-arrival chat mode` disabled

If `plan.stage === 'arrived'`:
- settling-in enabled
- chat mode uses post-arrival prompt builder
- compliance timeline/alerts rendered

Define a shared helper:
- `isPostArrivalEnabled(plan) => boolean`

Hard rule:
- Gating is enforced server-side (never client-only).

## 7.1.7 Concurrency + race conditions
### Duplicate clicks / duplicate requests
Must be safe due to:
- Idempotency-Key (request level)
- DB invariant: arrived implies arrival_date not null

### Cross-tab behavior
If user clicks in one tab and dashboard is open in another:
- second tab must refresh plan state from server and transition UI.

### Plan switching (multi-plan)
If you support multi-plan:
- arrive endpoint applies only to current plan OR explicit plan_id in route:
  - POST /api/plans/{plan_id}/arrive
- Must verify plan ownership.
- Must not accidentally set arrived on the wrong plan.

## 7.1.8 Observability requirements
Emit events:
- `plan.arrive.requested`
- `plan.arrive.completed` (include plan_id, arrival_date)
- `plan.arrive.idempotent_hit`
- `plan.arrive.failed` (error_code)

All include trace_id.

## 7.1.9 Definition of Done (arrival)
- Arrival transition is atomic and idempotent.
- Stage invariants enforced (arrived => arrival_date not null).
- All post-arrival systems gate off stage server-side.
- Cross-tab refresh works.
- At least 3 integration tests:
  1) arrive sets stage+date
  2) arrive repeated with same idempotency key returns same result and does not duplicate job enqueue
  3) stage gating blocks settling-in endpoints pre-arrival

================================================================================
7.2 SETTLING-IN PERSISTENCE CONTRACT (v1)
================================================================================

## 7.2.1 Purpose
Provide a reliable persistence layer for the post-relocation task system:
- store tasks
- store dependency graph data (DAG)
- enforce RLS
- enforce atomic updates (complete task unlocks dependents)
- support AI enrichment fields (why_it_matters)
This contract is the DB truth for all settling-in features.

## 7.2.2 Data model overview
We persist:
1) tasks (one row per task)
2) optional edges (dependencies) OR dependencies embedded in task JSON (choose one)
3) generation runs (optional but recommended for idempotency and debugging)
4) task events (append-only) for audit and debugging

Recommended v1:
- Store dependencies as array of task_ids in each task row (simple).
- Also store a computed `locked` boolean derived from deps completion (but keep server source-of-truth logic).

## 7.2.3 Table: settling_in_tasks (canonical)
Table: public.settling_in_tasks

Columns:
- `task_id` uuid PK
- `user_id` uuid NOT NULL (FK auth.users.id)
- `plan_id` uuid NOT NULL  (FK plans table; if no plans table, use profile_id or user_id only)
- `profile_version_used` int NULL (optional: snapshot version used to generate)
- `arrival_date` date NOT NULL  (copied from plan at generation time; immutable per task-set)
- `category` text NOT NULL (enum)
  - registration | tax | id | healthcare | banking | housing | driving | employment_admin | education_admin | other
- `title` text NOT NULL (max 140)
- `description` text NULL (short details; max 500)
- `priority` text NOT NULL (enum: must|should|nice)
- `is_legal_requirement` boolean NOT NULL default false
- `deadline_days` int NULL  (if is_legal_requirement true, should usually be set)
- `depends_on` uuid[] NOT NULL default '{}'  (array of task_ids)
- `status` text NOT NULL (enum: todo|in_progress|done|blocked)
- `locked` boolean NOT NULL default false  (server-maintained)
- `blocked_reason` text NULL (max 220)
- `why_it_matters` text NULL (max 600)  // cached AI output
- `sources` jsonb NULL  // array of Source (optional; if task derived from web)
- `origin` text NOT NULL (enum: baseline_country_db|web_source|user_specific_inference|user_input)
- `confidence` text NOT NULL (enum: low|med|high)
- `created_at` timestamptz
- `updated_at` timestamptz
- `completed_at` timestamptz NULL

Constraints:
- CHECK (char_length(title) <= 140)
- CHECK (deadline_days IS NULL OR deadline_days >= 0)
- CHECK (NOT is_legal_requirement OR deadline_days IS NOT NULL)  // recommended strictness
- Optional: UNIQUE (user_id, plan_id, title)  // NOT recommended if titles can collide; prefer no unique here

Indexes (critical):
- (user_id, plan_id)
- (plan_id, status)
- (plan_id, locked)
- (plan_id, is_legal_requirement, deadline_days)
- GIN index on depends_on if supported/needed (optional)

RLS:
- SELECT: user_id = auth.uid()
- INSERT: user_id = auth.uid() OR service role
- UPDATE: user_id = auth.uid() (but see server-side enforcement below)

Hard rule:
- In production, only server routes should update `locked`, `depends_on`, `origin`, `is_legal_requirement`, `deadline_days`.
- Client can update only:
  - status (todo/in_progress/done/blocked)
  - blocked_reason (if blocked)
- Enforce using server-side API, and optionally DB triggers or RLS policies that restrict column updates (advanced).

## 7.2.4 Optional table: settling_in_generation_runs (recommended)
Purpose:
- prevent duplicate generation
- aid debugging and replay

Table: public.settling_in_generation_runs
- run_id uuid PK
- user_id uuid
- plan_id uuid
- job_key text UNIQUE  // `settling_in:${plan_id}:${arrival_date}`
- status queued|running|succeeded|partial|failed
- trace_id text
- created_at, updated_at
- finished_at timestamptz

RLS:
- user read own
- write by service role/worker

## 7.2.5 Optional table: settling_in_task_events (recommended)
Append-only audit log.

Table: public.settling_in_task_events
- event_id uuid PK
- user_id uuid
- plan_id uuid
- task_id uuid
- event_type text (task.created|task.updated|task.completed|task.unlocked|why.generated|etc)
- trace_id text
- payload jsonb
- created_at timestamptz

RLS:
- user read own
- writes by service role/worker preferred

## 7.2.6 Locking semantics (DB + server responsibilities)
### Meaning of `locked`
- locked=true means: task cannot be completed yet because dependencies are not satisfied.
- locked is derived from:
  locked = exists(dep in depends_on where dep.status != done)

Hard rule:
- locked is not user-editable.
- locked is recalculated by server whenever:
  - generation creates tasks
  - a task is marked done
  - dependencies are updated (should be rare)

### Meaning of `blocked`
- blocked means: user cannot progress due to missing requirement/info.
- blocked is user-settable (with reason).
- blocked does NOT automatically unlock dependencies; it is informational.

## 7.2.7 Atomic update: completing a task unlocks dependents
When a user completes a task (status -> done):
Server MUST perform a transaction:
1) Verify:
   - task belongs to user and plan
   - plan.stage == arrived
   - task.locked == false
2) Set:
   - status='done'
   - completed_at=now()
3) Recompute and update all tasks in same plan that depend on this task:
   - For each dependent task, if all deps are done => set locked=false
4) Emit task_events:
   - task.completed
   - task.unlocked (for each unlocked)

Idempotency:
- Completing an already done task is a no-op that returns success.

## 7.2.8 API-facing invariants (what callers can assume)
- list endpoint returns tasks ordered by:
  - locked first? (usually locked last)
  - then timing (deadline_days)
  - then priority
- tasks always belong to one plan
- tasks always have arrival_date (for timeline calc)
- tasks always have stable task_id (used everywhere, including chat markers)

## 7.2.9 Data validation requirements
Server must validate on insert/update:
- title length
- category enum
- priority enum
- status enum
- if is_legal_requirement => deadline_days required
- depends_on must reference task_ids in same plan (enforced during generation; optionally verified in DB with trigger)

Cycle prevention:
- In v1, enforce at generation time (graph builder).
- If you later allow editing dependencies, you MUST add a cycle check before commit.

## 7.2.10 Deletion & regeneration policy
Do NOT hard delete tasks in v1.
When regenerating tasks (if you support it):
- mark old tasks as archived OR create a new plan stage “settling_in_v2”
Simplest v1:
- no regeneration unless user explicitly requests “Regenerate tasks”
- regeneration creates a new generation run and:
  - either replaces tasks (delete + insert in transaction) OR
  - version tasks with `generation_id` (recommended if you want history)

Given reliability goals:
- prefer versioning (generation_id) to avoid accidental data loss.

## 7.2.11 Observability requirements
Events:
- `settling_in.tasks.generated`
- `settling_in.task.completed`
- `settling_in.task.unlocked`
- `settling_in.why_generated`
All include trace_id + plan_id + task_id where relevant.

## 7.2.12 Definition of Done (persistence)
- settling_in_tasks table exists with RLS and indexes.
- API writes are atomic:
  - completing task unlocks dependents within a transaction.
- locked is server-maintained and cannot be set by client.
- arrival gating enforced (plan.stage must be arrived for updates).
- At least 5 integration tests:
  1) user cannot read other user tasks (RLS)
  2) pre-arrival update blocked
  3) completing locked task rejected
  4) completing task unlocks dependent tasks correctly
  5) idempotent completion (repeat PATCH) does not break state

END