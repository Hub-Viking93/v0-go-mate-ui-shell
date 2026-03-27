GoMate — Profile System Definition (Canonical System Specification)

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Profile is stored as a single JSONB column (relocation_plans.profile) — no
  separate tables for Layer 1 or Layer 2
- No user_profiles table exists — identity fields (citizenship, etc.) are
  duplicated per plan inside the JSONB blob
- Profile schema is defined in lib/gomate/profile-schema.ts (45 fields) and
  validated at the application layer
- The interview chat collects profile fields via extraction and writes them
  directly to the JSONB column
- Field confidence is embedded inside `profile_data.__field_confidence`
- No profile_version_id, no snapshots, no version history of any kind
- Partial optimistic concurrency exists on `PATCH /api/profile` via
  `expectedVersion`, but chat/profile-save flows still allow last-write-wins
- No derived fields computed server-side (profile_completion_percentage,
  readiness_state, eligibility_status are not implemented)

V1 Deviations from Canonical Spec:
- Section A.2 (Layer 1/2 model): NOT_IMPLEMENTED — single JSONB blob per plan
- Section B.1 (separate tables): NOT_IMPLEMENTED — all in relocation_plans.profile
- Section B.4 already acknowledges this gap accurately
- Section D (lifecycle states): NOT_IMPLEMENTED — no profile lifecycle tracking;
  the plan stage enum (collecting/generating/complete/arrived) serves as the
  only lifecycle signal
- Section F (chat sync with conflict prevention): PARTIAL — extraction writes
  to JSONB directly, no version checking, no conflict resolution
- Section G (versioning & history): NOT_IMPLEMENTED — no profile_version_id,
  no snapshots, no audit trail
- Section H (lock interaction): NOT_IMPLEMENTED — no LifecycleState=LOCKED
  exists; plan stage controls behavior
- Section N (derived fields): NOT_IMPLEMENTED — no server-side computation of
  completion percentage or readiness state

V1 Cross-Reference Adjustments:
- 17+ definitions reference profile_version_id — this does not exist in v1;
  artifacts are not bound to a profile version
- Data Update System references (Section E edit side effects) — no Data Update
  System exists; profile changes do not trigger any downstream regeneration
- LifecycleState references throughout — v1 uses plan.status (active/archived)
  and plan.stage (collecting/generating/complete/arrived) instead

V1 Fallback Behavior:
- Profile reads: API routes read relocation_plans.profile JSONB directly
- Profile writes: interview extraction writes to JSONB; no separate write API
- Profile completeness: checked ad-hoc in generation pipelines by testing for
  required fields (destination_country at minimum)
- No version conflict detection — last write wins silently

============================================================

============================================================
A. PURPOSE & OWNERSHIP
============================================================

A.1 Core Purpose (Canonical Definition)

The Profile System is the canonical structured representation of the user's relocation identity and relocation-relevant attributes.

Primary purposes:

1. Plan generation input
2. Personalization engine
3. Eligibility determination engine
4. Recommendation input system
5. Progress tracking foundation

The profile solves the following problems:

- Provides structured relocation input data
- Enables deterministic plan generation
- Enables eligibility logic (visa, housing, timeline, etc.)
- Provides a stable state independent of chat
- Enables progress tracking and completion logic

The following systems depend on Profile:

- Plan System (CRITICAL dependency)
- Timeline System
- Visa System
- Flight System
- Housing System
- Recommendation System
- Guide Generation System
- Checklist System
- Dashboard System
- Chat Engine (context injection only)

The following decisions are made from Profile:

- relocation eligibility
- plan structure
- timeline generation
- visa recommendations
- housing recommendations
- flight recommendations
- cost calculations


------------------------------------------------------------

A.2 Scope Model

Profile is:

HYBRID MODEL

Profile consists of two layers:

Layer 1: User Profile (Global, User-Scoped)

Purpose: Identity and stable defaults that persist across plans.

Contains stable identity fields that do not change per relocation attempt:

- user_id (required, immutable)
- legal_name (optional)
- date_of_birth (optional)
- citizenship / nationalities (required for visa logic; may be multi-valued)
- current_residence_country (optional)
- contact_email (optional; may differ from auth email)
- preferred_language (optional)
- default_household_members_count (optional; used as default when creating new plans)
- default_risk_tolerance (optional; future preference)

Layer 1 rules:
- Exists independent of any plan. Created at user signup or first profile interaction.
- May be used as defaults when creating a new plan (pre-populated into Plan Profile).
- Changes to Layer 1 do NOT retroactively mutate existing plans unless the user explicitly applies the update to a specific plan.
- Layer 1 is readable by all systems but writable only via the Profile Write API.

Layer 2: Plan Profile (Plan-Scoped)

Purpose: Relocation-specific inputs that can differ per plan.

Contains relocation-specific fields tied to a specific plan_id:

- destination_country (REQUIRED — populated at plan creation from onboarding interview)
- destination_city (optional)
- purpose (study/work/family/retirement/other)
- move_date or move_window_start / move_window_end (optional)
- visa_type (conditional — set after visa recommendation or user selection)
- budget_monthly (optional)
- family_size (optional; overrides Layer 1 default_household_members_count for this plan)
- employment_context (optional — employer name, contract type, remote/onsite)
- housing_preferences (optional — type, budget, location preferences)
- pets (optional)
- special_requirements (optional — medical, accessibility, etc.)

Layer 2 rules:
- Owned by the plan. Always tied to plan_id.
- Can differ across plans (e.g., Germany study plan vs Japan work plan).
- Drives derived artifact generation via the Data Update System.
- Mutable until the plan is locked (LifecycleState=LOCKED).

Derived fields (system-controlled, computed from Layer 1 + Layer 2):

- eligibility_status
- profile_completion_percentage
- readiness_state

Derived fields are recomputed on every profile write. They are never directly editable.

Override rules:
- If a field exists in both Layer 1 and Layer 2 (e.g., household members count), the Plan Profile (Layer 2) value ALWAYS takes precedence for that plan.
- If a Layer 2 field is null/unset, the system MAY fall back to the Layer 1 default for display purposes, but MUST NOT use it for generation without explicit user confirmation.
- During onboarding interview: the system reads Layer 1 as defaults, writes confirmed values into Layer 2, and may optionally offer "Save as default" to update Layer 1.

Propagation rules:
- Plan Profile (Layer 2) updates trigger artifact regeneration for that plan (via Data Update System).
- User Profile (Layer 1) updates do NOT trigger regeneration for any existing plan. They only affect future plans or explicit "apply to plan" actions.


------------------------------------------------------------

A.3 Ownership

Profile ownership model:

User owns semantic truth.

System owns canonical storage and integrity.

Ownership authority:

User: semantic authority
System: structural authority

Write authority:

User (via UI and chat)
System (derived fields, migrations)
Admin tools

Read authority:

All dependent systems (read-only)


------------------------------------------------------------

A.4 Authority Hierarchy

Hierarchy precedence:

System Derived Fields (highest authority)
Plan Profile (Layer 2)
User Profile (Layer 1)
Chat Runtime Cache (lowest authority)

Conflict resolution rule:

Database canonical state always wins.

Chat and frontend are non-authoritative.

Cross-layer conflict resolution:
- Plan Profile always overrides User Profile for that specific plan.
- If Plan Profile has a value and User Profile has a different value for the same field, the Plan Profile value is used in all plan-scoped operations.
- System Derived Fields override both layers because they are computed from the resolved (merged) state.


============================================================
B. CANONICAL SOURCE OF TRUTH
============================================================

B.1 Canonical Storage

The ONE AND ONLY source of truth is:

DATABASE

Layer 1 (User Profile): stored in the user_profiles table (or equivalent), keyed by user_id.
Layer 2 (Plan Profile): stored in the plan_profiles table (or equivalent), keyed by (plan_id, user_id).

All other representations are caches.


------------------------------------------------------------

B.2 Cache Contract

The following systems may cache:

Chat Runtime
Frontend Client
Guide Generator
Recommendation Engine

Cache may modify profile:

NO

Cache writes must go through server API.

Cache invalidation:
- Caches must be invalidated on any profile write.
- Plan-scoped caches (Guide Generator, Recommendation Engine) must be keyed by (plan_id, profile_version) to prevent stale reads.
- Frontend cache should re-fetch on plan switch.


------------------------------------------------------------

B.3 Write Permissions

Write allowed from:

Manual UI edit (→ Layer 1 or Layer 2 depending on the field)
Chat extraction engine (→ Layer 2 only; see F for details)
System migrations (→ either layer)
Admin tools (→ either layer)

Write contract:

All writes must go through Profile Write API.

Direct database writes forbidden except migrations.

Layer-aware write routing:
- The Profile Write API must determine which layer a field belongs to and route the write accordingly.
- A single API call may update fields in both layers (e.g., during onboarding when both citizenship and destination_country are confirmed).
- Each layer write is atomic within its own table. Cross-layer writes use a transaction.


------------------------------------------------------------

B.4 Current Implementation (Alignment Note)

TARGET architecture (this document): Separate tables for Layer 1 (user_profiles) and Layer 2 (plan_profiles / profiles).

CURRENT implementation: Profile data is stored as a JSONB column on the relocation_plans table (relocation_plans.profile).

Implications of current JSONB approach:
- Layer 1 and Layer 2 are not separated. All fields exist in one JSONB blob per plan.
- No independent User Profile exists across plans. If a user has two plans, identity fields are duplicated.
- JSONB storage limits indexing on individual profile fields (requires GIN or expression indexes).
- Partial updates require JSON merge operations, which are more complex than column-level updates.
- Validation occurs at the application layer, not the database schema layer.
- Concurrent partial updates to the same JSONB blob risk overwrite conflicts without careful version checking.

Migration path (future):
- Extract Layer 1 fields to a dedicated user_profiles table.
- Extract Layer 2 fields to a dedicated plan_profiles table (or keep as structured columns on relocation_plans).
- Maintain backward compatibility during migration via a view or API adapter layer.

This alignment note documents reality vs target. The canonical definitions in this document describe the TARGET architecture. Implementation will align via a dedicated migration effort.


============================================================
C. PROFILE SCHEMA CONTRACT
============================================================

Canonical Schema:

------------------------------------------------------------

LAYER 1 FIELDS (User Profile — Global)

------------------------------------------------------------

Field: user_id
Type: UUID
Required: required
Mutability: immutable
Source: system
Sensitivity: private
Layer: 1
Dependency: ALL SYSTEMS

------------------------------------------------------------

Field: legal_name
Type: string
Required: optional
Mutability: mutable
Source: user
Sensitivity: PII
Layer: 1
Dependency: Document generation

------------------------------------------------------------

Field: date_of_birth
Type: date
Required: optional
Mutability: mutable
Source: user
Sensitivity: PII
Layer: 1
Dependency: Visa eligibility (age requirements)

------------------------------------------------------------

Field: citizenship
Type: string (ISO country code)
Example: SE
Required: required
Mutability: mutable (may hold multiple nationalities)
Source: user / chat
Validation: ISO 3166-1 alpha-2
Sensitivity: PII
Layer: 1 (but copied to Layer 2 at plan creation as the plan-specific citizenship context)
Dependency: Visa System

------------------------------------------------------------

Field: current_residence_country
Type: string (ISO country code)
Required: optional
Mutability: mutable
Source: user
Layer: 1
Dependency: Timeline (departure logistics)

------------------------------------------------------------

Field: preferred_language
Type: string (ISO 639-1)
Required: optional
Mutability: mutable
Source: user
Layer: 1
Dependency: Guide Generation (language preference)

------------------------------------------------------------

Field: default_household_members_count
Type: integer
Required: optional
Mutability: mutable
Source: user
Layer: 1
Dependency: Used as default for new plan's family_size

------------------------------------------------------------

LAYER 2 FIELDS (Plan Profile — Plan-Scoped)

------------------------------------------------------------

Field: profile_id
Type: UUID
Example: 9b3d...
Required: required
Mutability: immutable
Source: system
Validation: UUID
Sensitivity: system critical
Layer: 2
Dependency: ALL SYSTEMS

------------------------------------------------------------

Field: plan_id
Type: UUID
Required: required
Mutability: immutable after creation
Source: system
Layer: 2
Dependency: ALL relocation systems

------------------------------------------------------------

Field: destination_country
Type: string (ISO country code)
Required: required (populated at plan creation from onboarding interview)
Mutability: mutable until plan lock
Source: user / chat
Layer: 2
Dependency: ALL relocation systems

------------------------------------------------------------

Field: destination_city
Type: string
Required: optional
Mutability: mutable until plan lock
Source: user / chat
Layer: 2
Dependency: Housing, Cost of Living

------------------------------------------------------------

Field: purpose
Type: enum (work | study | family | retirement | other)
Required: optional
Mutability: mutable until plan lock
Source: user / chat
Layer: 2
Dependency: Visa System, Recommendation System

------------------------------------------------------------

Field: move_date
Type: date
Required: optional
Mutability: mutable until plan lock
Source: user
Layer: 2
Dependency: Timeline, Flights

------------------------------------------------------------

Field: family_size
Type: integer
Required: optional
Mutability: mutable until plan lock
Source: user / chat
Layer: 2 (overrides Layer 1 default_household_members_count)
Dependency: Housing, Budget

------------------------------------------------------------

Field: budget_monthly
Type: integer (currency unit: EUR or user's base currency)
Required: optional
Mutability: mutable until plan lock
Source: user
Layer: 2
Dependency: Housing, Recommendation, Cost of Living

------------------------------------------------------------

Field: visa_type
Type: string
Required: conditional (set after visa recommendation or user selection)
Mutability: mutable until plan lock
Source: system recommendation / user selection
Layer: 2
Dependency: Visa System, Requirements, Timeline

------------------------------------------------------------

Field: employment_context
Type: JSON object (employer_name, contract_type, remote_onsite)
Required: optional
Mutability: mutable until plan lock
Source: user / chat
Layer: 2
Dependency: Visa System, Recommendation System

------------------------------------------------------------

DERIVED FIELDS (System-Controlled)

------------------------------------------------------------

Field: profile_completion_percentage
Type: float (0.0 – 1.0)
Required: system controlled
Mutability: system controlled only
Source: derived
Layer: computed from Layer 2
Dependency: Dashboard, Progress Tracking

------------------------------------------------------------

Field: readiness_state
Type: enum
Values: NOT_READY | PARTIAL | READY | LOCKED
Source: derived
Layer: computed from Layer 2 + plan LifecycleState
Dependency: Dashboard, Generation gating

Readiness state derivation rules:
- NOT_READY: destination_country is set but fewer than 2 additional required fields are filled.
- PARTIAL: destination_country is set and 2+ required fields are filled but not all.
- READY: All required fields for generation are filled. Generation can proceed.
- LOCKED: Plan is in LifecycleState=LOCKED. Profile is immutable.

------------------------------------------------------------

Field: eligibility_status
Type: JSON object (per-system eligibility flags)
Required: system controlled
Source: derived from profile fields + external rules
Layer: computed
Dependency: Visa System, Recommendation System

------------------------------------------------------------

Mutability by Plan LifecycleState:

| Plan LifecycleState | Layer 1 fields | Layer 2 fields | Derived fields |
|---------------------|---------------|----------------|----------------|
| CREATED             | mutable       | mutable        | recomputed     |
| ACTIVE              | mutable       | mutable        | recomputed     |
| LOCKED              | mutable*      | immutable      | frozen         |
| ARCHIVED            | mutable*      | immutable      | frozen         |
| DELETED             | mutable*      | inaccessible   | N/A            |
| CORRUPTED           | mutable*      | immutable      | frozen         |

* Layer 1 (User Profile) is always mutable because it is global and not plan-scoped. However, changes to Layer 1 do NOT affect locked/archived plan artifacts.


============================================================
D. PROFILE LIFECYCLE
============================================================

States:

NOT_CREATED
CREATED
INITIALIZED
PARTIAL
COMPLETE
LOCKED
ARCHIVED
INVALID


------------------------------------------------------------

Transitions:

NOT_CREATED → CREATED
trigger: plan creation (Onboarding Interview completes, plan is created, Plan Profile is initialized with interview data)

CREATED → INITIALIZED
trigger: first profile write beyond initial plan creation data (user adds additional fields via UI or chat)

INITIALIZED → PARTIAL
trigger: some required fields filled but not all

PARTIAL → COMPLETE
trigger: all required fields for generation are filled (readiness_state becomes READY)

COMPLETE → LOCKED
trigger: plan lock (plan LifecycleState transitions to LOCKED)

LOCKED → ARCHIVED
trigger: plan archive (plan LifecycleState transitions to ARCHIVED)

COMPLETE → PARTIAL
trigger: user clears or invalidates a required field (reverse transition; readiness_state drops below READY)

INITIALIZED → PARTIAL
trigger: additional fields filled

ANY → INVALID
trigger: system detects data corruption or schema violation (see M)


Forbidden transitions:

LOCKED → PARTIAL
LOCKED → INITIALIZED
LOCKED → COMPLETE (cannot unlock; must fork plan)
ARCHIVED → PARTIAL (must unarchive plan first, which transitions profile back appropriately)

Note: Profile lifecycle states are tightly coupled to Plan LifecycleState but are NOT identical. The profile tracks data completeness; the plan tracks journey lifecycle. They move in tandem but represent different dimensions:
- Profile: "how much data do we have?"
- Plan: "what phase of the journey are we in?"


============================================================
E. EDIT BEHAVIOR
============================================================

Edit Sources:

Manual UI edit
Chat extraction
Migration
Admin

Priority hierarchy:

Admin > User UI > Chat extraction

Overwrite policy:

UI edit: overwrite — user explicitly changes a field; previous value replaced.
Chat extraction: merge — AI extracts new information and merges into existing profile. Merge rules:
  - If target field is null/empty: write extracted value.
  - If target field already has a value: do NOT overwrite unless the user explicitly confirmed the change in chat.
  - Array fields (e.g., nationalities): append new values, do not replace existing.
Migration: overwrite — system schema migration can set/reset fields.
Admin: overwrite — admin tools have full write authority.

Layer-aware edit routing:
- UI edit to a Layer 1 field (e.g., legal_name): writes to user_profiles table.
- UI edit to a Layer 2 field (e.g., destination_city): writes to plan_profiles table for the current plan.
- Chat extraction: ONLY writes to Layer 2 (Plan Profile). Chat never modifies Layer 1 (User Profile) directly.
  Exception: the system may offer "Save as default?" after chat extraction, which the user must confirm to propagate to Layer 1.
- "Save as default" flow: After editing a Layer 2 field that has a Layer 1 counterpart, the UI may offer "Also save as your default for new plans?" If user accepts → write to Layer 1 as well.

Edit validation:
- Every edit passes through validation (see I) before being committed.
- If validation fails, the edit is rejected with a specific error message; no partial writes occur.

Edit side effects:
- Every successful Layer 2 edit triggers recomputation of derived fields (profile_completion_percentage, readiness_state, eligibility_status).
- If a generation-affecting field changes (destination_country, visa_type, move_date, family_size, citizenship), the Data Update System is notified to evaluate whether artifact regeneration is needed.
- Layer 1 edits do NOT trigger artifact regeneration for any existing plan.


============================================================
F. CHAT SYNC SEMANTICS
============================================================

There are TWO distinct chat systems that interact with the Profile System:

1) Onboarding Interview Chat (Pre-Plan Phase)

Purpose: Collect structured inputs to create a plan.
Scope: Exists BEFORE any plan_id exists. Not attached to any plan.
Ownership: Owned by the Onboarding System.

Profile interaction:
- The Onboarding Interview Chat collects inputs that will become the initial Plan Profile.
- During the interview, collected data is held in a temporary interview state (NOT in the profile tables).
- When the interview completes → Plan System creates the plan → Plan Profile is initialized with all collected interview data in a single atomic write.
- The Onboarding Interview Chat may read Layer 1 (User Profile) to pre-populate defaults (e.g., "I see you're a Swedish citizen. Is that correct for this plan?").
- The Onboarding Interview Chat does NOT write to any profile table during the interview. Writes happen only at interview completion via Plan System.

Persistence: Onboarding Interview Chat messages may be stored for audit/debugging, but are NOT part of Plan Chat History.

2) Plan Contextual Chat (Post-Plan Phase)

Purpose: Assist user with their specific relocation plan.
Scope: Exists ONLY when plan_id exists. Always tied to a specific plan_id.
Ownership: Owned by Chat System.

Chat → Profile (extraction):

Extraction trigger:

AI decision — the chat extraction engine identifies structured data in user messages and proposes profile updates.

Write mode:

Immediate atomic write to Plan Profile (Layer 2) only.

Write target: ONLY Layer 2 (Plan Profile). The Plan Contextual Chat NEVER writes to Layer 1 (User Profile) directly.

Extraction merge rules:
- Null/empty fields: write extracted value immediately.
- Fields with existing values: require explicit user confirmation before overwriting ("I see you mentioned Berlin. Would you like to update your destination city from Munich to Berlin?").
- Critical fields (destination_country, visa_type): always require explicit confirmation, even if the field was empty.

------------------------------------------------------------

Profile → Chat (context injection):

Chat receives profile updates:

Next message context injection — the chat system prompt includes the current resolved profile (Layer 2 merged with Layer 1 defaults) as context for every message.

Profile context includes:
- All populated Layer 2 fields.
- Layer 1 defaults for any empty Layer 2 fields (annotated as "default, not confirmed for this plan").
- Derived fields (readiness_state, eligibility_status).

The chat system prompt MUST include the profile version timestamp so the AI can detect stale context.


------------------------------------------------------------

Conflict Prevention

Atomic database writes:

YES

Transaction model:

ACID transactions

Last write wins:

NO

Version comparison enforced:
- Every profile write includes the expected profile version (optimistic concurrency).
- If the version has changed since the read (another write occurred), the write fails with a conflict error.
- The caller must re-read the profile, resolve the conflict, and retry.
- This prevents: simultaneous UI edit + chat extraction overwriting each other.

Conflict scenario example:
1. User opens edit form (reads profile version=5).
2. Chat extraction writes a field (profile version becomes 6).
3. User submits form edit (expects version=5, finds version=6).
4. Form edit fails with conflict error.
5. UI re-fetches profile, shows updated data, user can re-submit if desired.


============================================================
G. VERSIONING & HISTORY
============================================================

Profile versioning:

YES — snapshot-based versioning (NOT per-edit).

Version identifier:

profile_version_id (UUID)


Versioning model:

The Plan Profile (Layer 2) is a mutable working state during normal editing. Versions (snapshots) are created only at specific trigger points, not on every field edit.

Snapshot triggers (canonical):

1) PRE_GENERATION_SNAPSHOT
- Created immediately BEFORE any major artifact generation that must be reproducible.
- Applies to: guide generation, full requirements + timeline generation, visa recommendation finalization.
- Purpose: binds generated artifacts to the exact profile state that produced them.

2) PLAN_LOCK_SNAPSHOT
- Created when a plan transitions to LifecycleState=LOCKED.
- This snapshot is the canonical "frozen truth" that all locked artifacts bind to.
- It is the final snapshot for that plan; no further snapshots are created unless the plan is forked.

3) MANUAL_SNAPSHOT (optional)
- User or admin may create a labeled snapshot ("Save current profile version") for experimentation or branching.
- Not required for normal operation.

4) SYSTEM_REPAIR_SNAPSHOT (optional)
- Created when the system performs a repair or schema migration that changes profile data semantics.
- Purpose: audit trail for system-initiated changes.

Snapshot storage:

Full snapshot — the entire Plan Profile state is stored as a complete copy (not a diff).

Retention:

Forever — snapshots are never deleted (except on plan hard-delete cascade).

Artifact binding contract:
- Every generated artifact version stores the profile_version_id that was used to produce it.
- When viewing an artifact version, the system can always reconstruct "what inputs produced this."
- If an artifact's bound profile_version_id does not exist, this is a corruption signal (see Plan System K.4).

Rollback contract:
- Rollback means: set the Plan Profile mutable working state to match a selected profile_version snapshot.
- Rollback creates a NEW snapshot (SYSTEM_REPAIR type) capturing the rollback event. Old snapshots are never mutated.
- Rollback does NOT automatically regenerate artifacts. The user or system must explicitly trigger regeneration after rollback.
- Rollback is an admin-level or explicit user action, not an automatic system behavior.

Audit trail:

Tracks per snapshot:
- who: user_id or system_id that triggered the snapshot
- when: timestamp
- what: snapshot_trigger_type (PRE_GENERATION, PLAN_LOCK, MANUAL, SYSTEM_REPAIR)
- profile_version_id: the UUID of this snapshot


============================================================
H. LOCK INTERACTION
============================================================

Lock means:

Plan Profile (Layer 2) becomes immutable. No edits permitted.

Editable after lock:

Layer 2: NONE (except admin override)
Layer 1: YES (User Profile is global and always editable, but changes do NOT affect locked plan)

Lock side effects on profile:
1. A PLAN_LOCK_SNAPSHOT is created (see G).
2. readiness_state derived field is set to LOCKED.
3. All subsequent write attempts to Layer 2 for this plan are rejected with "Plan is locked. Fork to make changes."
4. Layer 1 writes are still accepted but do not propagate to the locked plan.

Profile change after guide generation:

If the profile changes AFTER a guide was generated (but BEFORE lock):
- The existing guide is marked as potentially stale (bound to an older profile_version_id).
- The system notifies the user: "Your profile has changed since the last guide was generated. Regenerate?"
- Regeneration is NOT automatic; it requires user action or system trigger via Data Update System.
- The stale guide remains viewable with a "Generated from outdated profile" indicator.


============================================================
I. VALIDATION RULES
============================================================

Validation Layers:

Client validation (UI-level, advisory only — never authoritative)
Server validation (Profile Write API — authoritative)
Database validation (schema constraints — last line of defense)

Hard validation (reject write):

- Type violations (string where integer expected, invalid date format)
- Invalid enum values (purpose not in allowed set)
- Invalid ISO codes (country code, language code)
- Negative values where only positive allowed (family_size, budget_monthly)
- Attempting to write Layer 2 field when plan is locked
- Profile version conflict (optimistic concurrency violation)

Soft validation (warn user, allow write):

- Unusual values (move_date in the past, budget_monthly extremely low)
- Incomplete address information
- Missing optional but recommended fields

Invalid data handling:

Reject write. Return specific field-level error messages.
Never accept and silently truncate or transform data.

Cross-field validation:
- If visa_type requires employment (e.g., work visa) but purpose is not "work": warn user of inconsistency.
- If move_date is before today: soft warning ("This date is in the past. Are you sure?").
- If family_size > 0 but no household details: soft warning suggesting additional details.


============================================================
J. PERSISTENCE GUARANTEES
============================================================

Save trigger:

Every write — no batching, no deferred saves.

Consistency:

Strong consistency — reads after writes always return the updated value.

Failure handling:

Write failure: return error to caller. Do NOT retry automatically for user-initiated writes (the user should be informed and can retry).
System-initiated writes (derived field recomputation): retry up to 3 times with exponential backoff.
If retry fails: log error, mark derived fields as stale, and surface a warning to the user on next load.


============================================================
K. CROSS-SYSTEM DEPENDENCIES
============================================================

Systems that depend on Profile (read-only consumers):

Plan System — reads profile for state decisions
Guide Generation System — reads profile as generation input; binds to profile_version_id
Visa System — reads citizenship, destination_country, purpose, employment_context
Timeline System — reads move_date, destination_country, visa_type
Flights System — reads move_date, current_residence_country, destination_country
Housing System — reads destination_city, family_size, budget_monthly, housing_preferences
Dashboard System — reads readiness_state, profile_completion_percentage
Recommendation System — reads all fields for decisioning
Cost of Living System — reads destination_country, destination_city, budget_monthly, family_size

All systems:

Read profile from database via Profile Read API (or direct DB read with plan_id filter).
No system other than the Profile System may write to profile tables.

Dependency direction:
- Profile System is a LEAF dependency — it does not depend on any downstream system.
- Profile depends ONLY on: Plan System (for plan_id context) and Auth System (for user_id context).

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Plan System | PARTIAL |
| Guide Generation System | PARTIAL |
| Visa Recommendation | PARTIAL |
| Timeline System | NOT_IMPLEMENTED |
| Flight System | MINIMAL |
| Housing System | NOT_IMPLEMENTED |
| Dashboard System | PARTIAL |
| Recommendation System | MINIMAL |
| Cost of Living System | PARTIAL |


============================================================
L. RESET & RECOVERY
============================================================

Profile reset:

YES — user can reset their Plan Profile (Layer 2) to its initial state (data from plan creation).

Scope:

Full reset of Layer 2 fields to plan creation defaults. Layer 1 (User Profile) is NOT affected.

Reset preconditions:
- Plan must be in LifecycleState ∈ {CREATED, ACTIVE}. Cannot reset a locked or archived plan.
- Reset creates a SYSTEM_REPAIR_SNAPSHOT before clearing data (for audit/rollback).

Cascade effects:

Guide invalidated — all guides generated from the reset profile are marked stale.
Timeline invalidated — timeline must be regenerated.
Recommendations invalidated — all recommendations marked stale.
Tasks invalidated — task generation must be re-evaluated.

Reset does NOT delete snapshots or version history. It only changes the mutable working state.


============================================================
M. ERROR HANDLING
============================================================

Corruption response:

Mark profile INVALID.

Block dependent systems from using invalid profile data for generation.

Corruption detection triggers:
- Required field (destination_country) is null on a plan in LifecycleState ∈ {ACTIVE, LOCKED}.
- profile_id or plan_id is null or references non-existent records.
- Derived fields cannot be computed (division by zero, invalid enum state).
- Profile version referenced by an artifact does not exist in the snapshot table.

User sees:

Error and recovery option:
- "Your profile data needs attention. Please review and correct the highlighted fields."
- If data is irrecoverably corrupted: "Profile data could not be loaded. You can restore from a previous version or reset."
- Recovery actions: "Restore from version [date]" (rollback), "Reset profile" (clear and re-enter), "Contact support".


============================================================
N. DERIVED FIELDS
============================================================

Derived fields:

profile_completion_percentage

Formula:

filled_required_fields / total_required_fields

Required fields for completion calculation:
- destination_country (always required — set at creation)
- citizenship (required)
- move_date (required for timeline generation)
- purpose (required for visa/recommendation logic)
- family_size (required for housing/budget calculations)

Total required fields: 5 (may expand as new required fields are added).

Recompute trigger:

Every Layer 2 profile write. Recomputation is synchronous within the write transaction.

readiness_state derivation:
- NOT_READY: profile_completion_percentage < 0.4
- PARTIAL: profile_completion_percentage >= 0.4 AND < 1.0
- READY: profile_completion_percentage = 1.0
- LOCKED: plan LifecycleState = LOCKED (overrides other states)

eligibility_status derivation:
- Computed by applying external eligibility rules to profile fields.
- Per-system eligibility (visa eligible, housing budget sufficient, etc.).
- Recomputed on every profile write that affects relevant fields.


============================================================
O. PERFORMANCE & SCALING
============================================================

Profile size limit:

64 KB per plan profile (Layer 2). This includes all fields and nested objects.
Layer 1 (User Profile): 16 KB.

Read frequency:

High — profile is read on every page load, every chat message context injection, every generation run.

Write frequency:

Low — profile writes are relatively infrequent (user edits, chat extractions). Typically <10 writes per session.

Caching:

Allowed but non-authoritative.
Cache key must include plan_id + profile_version (or updated_at timestamp).
Cache TTL: short (e.g., 60 seconds) or event-based invalidation preferred.


============================================================
P. SECURITY & PRIVACY
============================================================

Access:

User: read/write own profile (both layers)

System: full access (for derived field computation, migrations, generation)

Admin: full access (future tooling)

Cross-user access: NEVER. No user can read or write another user's profile.

Sensitive fields:
- PII fields (legal_name, date_of_birth, citizenship, contact_email) must be handled per data protection requirements.
- Encryption at rest: provided by database-level encryption (Supabase/PostgreSQL).
- Encryption in transit: HTTPS enforced on all API calls.

GDPR compliance:

Delete supported — user can request full deletion of all profile data (Layer 1 + all Layer 2 instances + all snapshots).
Export supported — user can request a machine-readable export of all profile data.
Correction supported — user can edit any mutable field at any time (for non-locked plans).

Data retention:
- Active profile data: retained as long as user account exists.
- Deleted plan profiles: cascade-deleted with plan hard delete.
- Snapshots: retained with plan; deleted on plan hard delete.


============================================================
Q. MULTI-DEVICE BEHAVIOR
============================================================

Sync model:

Real-time database sync — profile changes made on one device are immediately visible on another device on next read.

Conflict resolution:

Version-based resolution — optimistic concurrency via profile version counter. If two devices edit simultaneously, the second write fails with a conflict error and must re-read + retry.

UI behavior on conflict:
- Show updated data from the winning write.
- Display toast: "Profile was updated on another device. Your changes were not saved. Please review and try again."


============================================================
R. OFFLINE BEHAVIOR
============================================================

Offline edit:

Allowed — client may queue edits locally.

Sync:

Server reconciliation — when connection is restored, queued edits are submitted via Profile Write API with version checks.

Conflict handling:
- If the server version has advanced (someone else edited while offline), the offline edits fail with a conflict error.
- Client must present the user with a merge UI showing server state vs local edits.
- User resolves manually.

Limitation: Offline edits are best-effort. The server is always authoritative.


============================================================
S. MIGRATION & SCHEMA EVOLUTION
============================================================

Schema version tracked.

Migration rules:

Backward compatible — new fields are added with default values (null or sensible defaults). Existing fields are never removed in-place; they are deprecated and eventually cleaned up in a separate migration.

Migration process:
1. Add new column/field with default value.
2. Deploy code that handles both old (field absent) and new (field present) states.
3. Backfill existing profiles if needed.
4. After backfill, remove legacy handling code.

Profile schema version:
- A schema_version field tracks the profile schema version.
- On profile read, if schema_version is older than current, the system applies transparent in-place migration (add missing fields with defaults) and updates schema_version.
- This ensures profiles from old plans remain readable without manual migration.


============================================================
T. SYSTEM INVARIANTS (CRITICAL)
============================================================

The database profile is the ONLY source of truth.

Chat may NEVER be source of truth.

Locked profile (Layer 2) may NEVER be modified (except admin override with audit trail).

All profile writes must be atomic.

Profile (Layer 2) must exist before plan generation — no generation pipeline may run without a plan profile containing at least destination_country.

Layer 1 (User Profile) must exist before Layer 2 (Plan Profile) can be created — user_id must be registered.

Every profile snapshot is immutable once created.

Plan Profile always overrides User Profile for plan-scoped operations.

Derived fields are NEVER directly writable; they are always recomputed.


============================================================
U. OBSERVABILITY & DEBUGGING
============================================================

All writes logged:
- Every profile write (Layer 1 and Layer 2) generates an audit log entry.
- Log includes: user_id, plan_id (for Layer 2), field(s) changed, old value, new value, source (UI/chat/migration/admin), timestamp.

Version history accessible:
- All snapshots are queryable by plan_id.
- Admin tools can view full snapshot history with diffs between versions.

Audit logs permanent:
- Audit logs are retained for the lifetime of the user account.
- On GDPR deletion: audit logs are anonymized (user_id replaced with tombstone) but not deleted.

Debugging aids:
- Profile read API includes a debug mode that returns: current mutable state, latest snapshot, schema_version, derived field computation details.


============================================================
V. TESTING REQUIREMENTS
============================================================

Must test:

create profile (both layers)
edit profile (Layer 1, Layer 2, cross-layer)
lock profile (Layer 2 becomes immutable)
snapshot creation (all 4 trigger types)
rollback (restore from snapshot)
chat sync (extraction writes to Layer 2, context injection reads merged state)
version conflict (concurrent edits, optimistic concurrency failure)
derived field computation (profile_completion_percentage, readiness_state)
layer override (Layer 2 overrides Layer 1 for same field)
profile reset (Layer 2 cleared, Layer 1 untouched)
migration (schema_version upgrade, backward compatibility)


============================================================
W. FORBIDDEN BEHAVIOR
============================================================

System MUST NEVER:

Generate plan without profile (Layer 2 with at least destination_country).

Modify locked profile (Layer 2 on a locked plan).

Discard profile write silently (every write must succeed or return an explicit error).

Write to Layer 1 (User Profile) from chat extraction without explicit user confirmation.

Use Layer 1 defaults for generation without user confirmation (may display as suggestion, never use as input).

Allow cross-user profile access (no user may read or write another user's profile data).

Delete profile snapshots (except on plan hard-delete cascade).

Overwrite an existing profile field via chat extraction without user confirmation (when the field already has a value).


============================================================
FINAL CONTRACT

This document is the authoritative definition of the GoMate Profile System.

All systems must conform.

No implicit assumptions allowed.

============================================================

---

## v1 Alignment Note (GAP-029)

v1 uses `plan.locked` (boolean) as the confirmation proxy instead of a separate `profile.confirmed` field. When the user confirms their profile, the plan is locked via `PATCH /api/profile { action: "lock" }`, which:
1. Sets `locked = true` and `locked_at` timestamp
2. Transitions stage to `complete`
3. Triggers guide generation

The lock mechanism is more explicit than a `confirmed` flag because it actively prevents further profile edits until explicitly unlocked.

**Source:** `app/api/profile/route.ts` — lock/unlock actions
