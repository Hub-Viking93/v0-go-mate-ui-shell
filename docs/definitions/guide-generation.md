# GoMate — Guide Generation System Definition

Guide Generation is the system responsible for producing the canonical relocation blueprint artifact.
It is a strictly versioned, snapshot-bound, deterministic async generation system.

The guide is an immutable artifact once generated.

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Guide generation exists and works via a deterministic TypeScript pipeline
  in `lib/gomate/guide-generator.ts`
- Guide content is stored in the `guides` table as section-specific JSONB
  columns, not on `relocation_plans` and not in a generic artifact table
- No `profile_version_id` binding — generation reads `relocation_plans.profile_data`
  live, not an immutable profile snapshot
- Guide generation is deterministic TypeScript assembly from static country
  data plus helper modules, not free-form AI prose generation
- Partial guide metadata now exists:
  - `guide_version`
  - `plan_version_at_generation`
  - `is_stale`
  - `stale_at`
  - `stale_reason`
- Versioning is mutable single-row versioning, not immutable guide history:
  regenerating updates an existing row and increments `guide_version`
- No generation queue or async job system — generation still runs synchronously
  in the API route
- No frozen recommendation snapshot bundle — guide pulls visa/cost/helper data
  directly at generation time

V1 Deviations from Canonical Spec:
- Section A (snapshot-bound): VIOLATED — guide reads live profile data,
  not a frozen profile_version_id snapshot
- Section B (versioning): PARTIAL — `guide_version` exists, but there is no
  immutable guide_versions history and no current-pointer model
- Section C (generation triggers): PARTIAL — guide generated on explicit
  user action (plan creation flow), not triggered by domain events
- Section C.2 (auto-regeneration forbidden): COMPLIANT by default — guide
  does not auto-regenerate, but for the wrong reason (no event system exists)
- Section D (STALE lifecycle): PARTIAL — staleness exists as `is_stale`
  metadata, but not as a full lifecycle contract tied to immutable versions
- Section E (async generation): PARTIAL — generation is synchronous in the
  API route, not queued
- Section F (immutability): VIOLATED — regeneration mutates a guide row
  instead of preserving immutable snapshots

V1 Cross-Reference Adjustments:
- Profile versioning: does not exist — guide uses live profile JSONB
- Event System: does not exist — no domain events trigger guide staleness
- Visa Recommendation: visa analysis is embedded during guide generation,
  not consumed as a frozen recommendation artifact
- Research System: guide does not consume a canonical research bundle with
  stored source-version pointers
- Data Update System: does not exist — no cascade invalidation

V1 Fallback Behavior:
- Guide generation: works via `lib/gomate/guide-generator.ts`; produces
  structured guide content that renders in the guide viewer
- Guide freshness: user can manually regenerate; profile writes mark guides
  stale, but regeneration still uses live plan state rather than a frozen
  snapshot
- Guide display: guide-viewer renders the stored JSONB content with
  section-based navigation

============================================================

---

# A. PURPOSE, ROLE & QUALITY BAR

---

## A.1 Core Purpose

The guide is the SINGLE canonical relocation blueprint for a specific plan and profile version.

It serves FOUR functions in priority order:

Priority 1 — Personalized relocation blueprint  
Priority 2 — Prescriptive sequence of actions  
Priority 3 — Decision-support artifact  
Priority 4 — Structured reference document

The guide MUST allow the user to:

- understand what applies specifically to them
- understand what to do and in what order
- understand risks and blockers
- understand consequences of decisions

---

## A.2 Decision Authority Level

The guide is ADVISORY and PRESCRIPTIVE.

It:

- recommends sequence
- recommends actions

It MUST NOT:

- guarantee eligibility
- simulate official decisions
- present legal outcomes as certain

All uncertain content MUST be labeled.

---

## A.3 Quality Bar

Generic fallback is allowed ONLY in non-critical sections.

Critical sections MUST be personalized:

Critical sections:

Overview

Visa Options

Administrative Requirements

Timeline

Next Actions

If critical personalization impossible:

GENERATION MUST FAIL.

Minimum completeness threshold:

completion_score >= 0.85

Minimum personalized fields used:

>= 5 required fields

---

## A.4 Determinism Model

Guide generation uses HYBRID deterministic model:

Structure:

fully deterministic schema

Content:

AI generated at:

temperature = 0

retry_count = 1

Input hash guarantees reproducibility.

Same input hash MUST produce identical guide.

---

## A.5 Completeness Contract

Guide is complete ONLY if:

All required sections present

All required sections non-empty

Schema valid

Completeness score >= 0.85

If not:

generation FAILS.

Partial guides NOT allowed.

---

## A.6 Authority Boundaries

Guide MUST NOT:

hallucinate eligibility

invent profile facts

present inferred values as confirmed

Guide MUST:

label inferred information

label generic fallback sections

---

# B. GUIDE IDENTITY MODEL

---

## B.1 Guide Entity Identity

Guide uniquely defined by:

guide_id

plan_id

profile_version_id

version_number

Uniqueness constraint:

UNIQUE(plan_id, profile_version_id, version_number)

---

## B.2 Canonical Guide Model

Multiple guides allowed per plan.

Each guide belongs to a specific profile version.

Each profile version may have multiple guide versions.

---

## B.3 Unique Constraint

Database constraint:

UNIQUE(plan_id, profile_version_id, is_current = true)

Only ONE canonical guide per profile version.

---

## B.4 Canonical Guide Pointer

Canonical guide defined by:

is_current = true

Resolution logic:

latest successful version becomes current.

Previous guides marked:

is_current = false

---

## B.5 Guide Lifecycle States

States:

NOT_STARTED — no guide exists for this plan yet

QUEUED — generation requested, waiting for execution slot

GENERATING — AI generation in progress

COMPLETE — generation succeeded, guide is current and valid

FAILED — generation failed (user may retry)

STALE — upstream prerequisites changed; guide content is outdated but still readable

ARCHIVED — superseded by a newer COMPLETE version; retained for history

---

Transitions:

NOT_STARTED → QUEUED (user clicks "Generate Guide")

QUEUED → GENERATING (execution begins)

GENERATING → COMPLETE (generation succeeds + validation passes)

GENERATING → FAILED (generation error, validation failure, or timeout)

COMPLETE → STALE (upstream prerequisite changes — see C.3)

STALE → QUEUED (user explicitly clicks "Regenerate" — new version, not overwrite)

STALE → ARCHIVED (new COMPLETE version supersedes this one)

COMPLETE → ARCHIVED (new COMPLETE version supersedes this one)

FAILED → QUEUED (user retries — creates new version with same snapshot)

---

STALE semantics:
- A STALE guide is still readable and displayable to the user.
- STALE does NOT mean invalid — it means newer inputs exist that could produce a more accurate guide.
- The UI MUST clearly indicate staleness but MUST NOT hide or remove the guide.
- Only an explicit user action transitions STALE → QUEUED (regeneration).

---

# C. GENERATION TRIGGERS

---

## C.1 Allowed Triggers (Exhaustive List)

The ONLY events that may initiate guide generation:

1. guide.regenerate_requested — emitted by explicit user "Generate Guide" / "Regenerate Guide" button click
2. Admin trigger — emitted by admin tool with explicit operator action

Both require a new client_request_id per invocation.
No other event, cascade step, or system action may initiate guide generation.

---

## C.2 Automatic Triggers

FORBIDDEN — NO EXCEPTIONS:

Guide MUST NOT auto-generate.

Always explicit user trigger.

The following events MUST NOT trigger guide generation:
- recommendation.selected_current (marks guide STALE only — see C.3)
- profile.version_created (marks guide STALE only)
- plan.destination_changed (marks guide STALE only)
- plan.move_date_changed (marks guide STALE only)
- checklist.generated (no relationship)
- research.completed (no direct trigger)
- Any Data Update System cascade step (guide is gated — see data-update-system.md)

Cross-reference: event-trigger-system.md Section F.1 and V.5 define this gate.

---

## C.3 Upstream Change → STALE Lifecycle (Canonical)

When upstream prerequisites change, the system marks the current guide as STALE:

Upstream events that cause STALE:
- recommendation.selected_current → guide.outdated event emitted
- profile.version_created → guide.outdated event emitted
- plan.destination_changed → guide.outdated event emitted
- plan.move_date_changed → guide.outdated event emitted (if guide contains timeline content)

UX Contract:
- When guide_status = STALE, UI shows: "Your guide is outdated. Regenerate?"
- When all prerequisites are ready, Data Update System emits guide.regenerate_suggested
- User clicks "Regenerate" → frontend emits guide.regenerate_requested with new client_request_id
- System generates new guide version bound to current snapshots

This ensures:
- No background regeneration storms
- User controls when expensive generation occurs
- User can continue using the stale guide until they choose to regenerate

---

## C.4 Forbidden Triggers

Forbidden:

chat extraction — guide is not triggered by chat content

dashboard refresh — dashboard reads guide status, does not trigger generation

artifact refresh — generic artifact refresh does NOT include guide (guide has its own gate)

guide completion — guide completion MUST NOT trigger re-generation (prevents loops)

research completion — research is a prerequisite, not a trigger

---

## C.5 Trigger Preconditions

Generation allowed ONLY if:

- plan exists and plan.LifecycleState = ACTIVE (not LOCKED, ARCHIVED, DELETED)
- profile_version_id exists (snapshot has been created)
- profile completion_score >= 0.85 threshold
- destination_country is set
- No guide generation job already in progress for this plan (see C.6)

If any precondition fails, generation request is rejected with specific error code.

---

## C.6 Trigger Idempotency

If generation in progress for this plan:

return existing job_id — do NOT create duplicate job.

If input_hash matches an existing COMPLETE guide:

return existing guide — no regeneration needed.

Idempotency key: GUIDE_GEN::{plan_id}::{profile_version_id}::{recommendation_id}::{generator_version}

---

## C.7 Audit Logging

Every generation attempt logs:

plan_id
profile_version_id
generator_version
trigger_actor ("user" | "admin")
trigger_time
trigger_event_id (the guide.regenerate_requested event_id)
input_hash
generic_research_ids (Layer 1 research used)
user_research_ids (Layer 2 research used)
recommendation_id

---

# D. INPUTS & SOURCE OF TRUTH

---

## D.1 Profile Snapshot Model

Guide uses immutable snapshot:

profile_version_id

snapshot_timestamp

Live profile NEVER used.

---

## D.2 Research Inputs

Guide generation consumes research outputs from both layers of the Research System (see research-system.md A.5):

Layer 1 (Generic) research inputs — destination facts:
- visa_research (generic visa categories, general requirements)
- cost_research (cost-of-living data for destination)
- housing_research (housing market structure)
- legal_research (registration, tax, administrative requirements)

Layer 2 (User-Specific) research inputs — personalized analysis:
- visa_research (user eligibility analysis, recommended visa type)
- cost_research (user-specific affordability implications)
- legal_research (user-specific registration requirements)

Research binding:
- Guide stores generic_research_ids and user_research_ids used as input.
- If user-specific research is unavailable for a non-critical section, generic research may be used with a "generic fallback" label.
- If user-specific research is unavailable for a CRITICAL section (see A.3), generation MUST FAIL.

Mandatory inputs:
- profile snapshot (profile_version_id)
- At least one user-specific visa research output (Layer 2) for critical visa section

---

## D.3 Input Validation

Before generation:

validate profile snapshot

validate required fields

validate snapshot integrity

If invalid:

FAIL generation

---

## D.4 Input Consistency

Guide MUST use:

single profile version

single generator version

No mixing allowed.

---

## D.5 Input Version Binding

Guide stores ALL source version pointers for full reproducibility:

profile_version_id (UUID — the profile snapshot used)
generator_version (string — the guide generator code version)
input_hash (string — deterministic hash of all inputs)
recommendation_id (UUID, nullable — the current recommendation at generation time)
generic_research_ids (JSONB array — Layer 1 research versions used)
user_research_ids (JSONB array — Layer 2 research versions used)

These pointers enable:
- Exact reproduction of the guide from the same inputs
- Staleness detection (comparing stored pointers vs current pointers)
- Audit trail (which intelligence was used to produce this guide)

---

# E. VERSIONING MODEL

---

## E.1 Generation Behavior

Generate Guide creates NEW version ALWAYS.

Never overwrite existing guide.

---

## E.2 Version Identity

version_number is sequential integer:

1

2

3

...

---

## E.3 Version UI

UI displays:

version_number

created_at

profile_version_id

is_current

---

## E.4 Rollback Behavior

Rollback creates NEW version copy.

Never modifies original guide.

---

## E.5 Version Comparison

Comparison optional.

Not required for core system.

---

# F. CONTENT CONTRACT

---

## F.1 Required Sections

Overview Summary

Visa Options

Administrative Requirements

Timeline

Housing System

Cost of Living

Healthcare

Cultural Adaptation

Risks

Next Actions

---

## F.2 Section Schema

Each section includes:

title

body

personalization_score

completeness_flag

---

## F.3 Minimum Density

Minimum:

500 words total

Minimum 10 structured recommendations

---

## F.4 Missing Data Policy

Critical missing data:

FAIL generation

Non critical:

generic fallback allowed

Must be labeled.

---

## F.5 Validation Rules

Fail if:

missing required section

empty required section

invalid schema

---

# G. EXECUTION MODEL

---

## G.1 Execution Mode

Guide generation is ASYNC.

Never blocking user request.

---

## G.2 Queue Contract

Queue:

guide_generation_queue

Job payload:

plan_id

profile_version_id

generator_version

input_hash

Idempotency key:

input_hash

Retry:

1 retry allowed

---

## G.3 Status Tracking

Guide exposes:

status

created_at

version_number

---

## G.4 UI Status

States visible:

Queued

Generating

Complete

Failed

---

## G.5 Timeout

Timeout:

120 seconds

If exceeded:

mark FAILED

---

# H. FAILURE & RECOVERY

---

## H.1 Failure Types

snapshot missing

generator failure

validation failure

write failure

timeout

---

## H.2 Failure Behavior

Guide marked:

FAILED

User may retry.

---

## H.3 Retry Semantics

Retry creates NEW version.

Same snapshot reused.

---

## H.4 Duplicate Protection

input_hash uniqueness prevents duplicate.

---

## H.5 Lock Interaction

Guide failure does NOT block plan lock.

---

# I. SYSTEM INTEGRATIONS

---

## I.1 Dashboard Integration

Guide affects:

dashboard artifact cards

artifact freshness indicators

---

## I.2 Chat Integration

Guide unlocks advisory mode.

---

## I.3 Downstream Systems

Checklist generator

Recommendation engine

Notification system

---

## I.4 Cache Invalidation

New guide invalidates:

dashboard summary cache

recommendation cache

---

## I.5 Notification Contract

Guide completion triggers:

dashboard refresh flag

---

# J. AI GENERATOR CONTRACT

---

## J.1 Generator Input

profile snapshot

schema template

generator_version

---

## J.2 Generator Output

strict schema only

No free text outside schema

---

## J.3 Validation

Output validated before storage.

Invalid output rejected.

---

## J.4 Generator Versioning

generator_version stored per guide

---

# K. DATA MODEL

---

Guide record schema:

guide_id (UUID)

plan_id (UUID)

profile_version_id (UUID — FK to profile snapshot)

version_number (int — sequential per plan)

is_current (boolean — only one per plan may be true; see B.4)

status (enum: NOT_STARTED | QUEUED | GENERATING | COMPLETE | FAILED | STALE | ARCHIVED)

content_blob (JSONB — the generated guide content, structured per F.1 schema)

input_hash (string — deterministic hash of all generation inputs)

generator_version (string — code version of the generator)

recommendation_id (UUID, nullable — current recommendation at generation time)

generic_research_ids (JSONB array — Layer 1 research versions used)

user_research_ids (JSONB array — Layer 2 research versions used)

trigger_actor (string — "user" | "admin")

trigger_event_id (UUID, nullable — the guide.regenerate_requested event that triggered this)

created_at (timestamptz)

completed_at (timestamptz, nullable)

completeness_score (float — 0.0 to 1.0; must be >= 0.85 for COMPLETE)

---

# L. CROSS-SYSTEM REFERENCES

---

## L.1 Upstream Systems (provide inputs to guide)

- Profile System (profile-system.md) — profile_version_id snapshot
- Research System (research-system.md) — Layer 1 + Layer 2 research outputs
- Recommendation System — current recommendation (recommendation_id)
- Event/Trigger System (event-trigger-system.md) — guide.regenerate_requested routing (Section F.1)

## L.2 Orchestration

- Data Update System (data-update-system.md) — guide is EXCLUDED from automatic cascade (Section G.3 GUIDE GENERATION GATE). Data Update emits guide.regenerate_suggested when prerequisites are ready.

## L.3 Downstream Systems (consume guide output)

- Guide Viewer (guide-viewer.md) — renders the guide for users
- Dashboard System — displays guide status card and freshness indicator
- Checklist/Tasks System — MAY use guide content as optional input (guide is NOT source of truth for tasks)
- Notification System — guide.generated triggers notification to user
- Chat System — guide availability may unlock advisory chat mode

## L.4 Shared Contracts

- Profile versioning: profile_version_id defined in profile-system.md Section G
- Current pointer model: plan.current_guide_id follows event-trigger-system.md Section F.0
- Plan LifecycleState: guide generation requires plan in ACTIVE state (plan-system.md Section C)
- Research two-layer model: research-system.md Section A.5

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Profile System (profile-system.md) | PARTIAL |
| Research System (research-system.md) | PARTIAL |
| Recommendation System (recommendation-system.md) | MINIMAL |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |
| Data Update System (data-update-system.md) | NOT_IMPLEMENTED |
| Guide Viewer System (guide-viewer.md) | PARTIAL |
| Dashboard System (dashboard.md) | PARTIAL |
| Settling-in Tasks (settling-in-tasks.md) | PARTIAL |
| Notification System (notification-system.md) | MINIMAL |
| Plan Contextual Chat (plan-contextual-chat.md) | PARTIAL |
| Plan System (plan-system.md) | PARTIAL |

---

# SYSTEM INVARIANTS

Invariant 1:

Guide bound to immutable profile version (profile_version_id)

Invariant 2:

Guide never overwritten — new generation always creates new version

Invariant 3:

Guide generation idempotent — same input_hash produces same guide or no-ops

Invariant 4:

Guide NEVER auto-generated — always requires explicit user or admin trigger (C.2)

Invariant 5:

Guide always reproducible — all input version pointers stored (D.5)

Invariant 6:

Guide stores all source version pointers (profile, research, recommendation, generator)

Invariant 7:

STALE guide remains readable — staleness is informational, not destructive

Invariant 8:

Upstream cascade marks guide STALE but NEVER triggers generation (C.3)

---

# END OF DEFINITION

---

## v1 Alignment Note (GAP-016)

v1 uses a separate `is_stale` boolean column instead of STALE as a lifecycle status value. This is architecturally cleaner because staleness is orthogonal to lifecycle — a guide can be simultaneously COMPLETE and STALE.

v1 guide status values: `draft`, `generating`, `complete`, `archived`
Staleness: `is_stale` boolean (set to true when plan_version changes after generation)

The definition states NOT_STARTED, QUEUED, GENERATING, COMPLETE, FAILED, STALE, ARCHIVED. v1 maps:
- NOT_STARTED → `draft`
- QUEUED → (not needed; generation is synchronous)
- GENERATING → `generating`
- COMPLETE → `complete`
- FAILED → (handled by error in generation pipeline, guide stays `draft`)
- STALE → `is_stale = true` (separate dimension)
- ARCHIVED → `archived`

**Source:** `guides` table CHECK constraint, migration 019 (`is_stale` column)
