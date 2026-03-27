# Local Requirements System Definition (GoMate)
Derived directly from: “Local Requirements — Question Framework (Expanded)”
Goal: define HOW it works + WHY, with strict contracts, versioning, and loop/cost protection.

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Local requirements research exists as a dedicated route/service pair that
  stores structured category output in `relocation_plans.local_requirements_research`
- No local_requirements table, no requirement_sets table, and no formal
  requirement entity model exists in v1
- Output is structured research, not authoritative requirement records
- No requirement versioning and no requirement_set_version_id
- No jurisdiction-specific requirement catalog or rule engine
- No requirement → task mapping table or verification model
- Web research (Firecrawl + GPT-4o-mini) produces categorized obligations and
  guidance, but there is no formal requirements layer between research and tasks

V1 Deviations from Canonical Spec:
- Section A (requirements system): PARTIAL — separate local-requirements
  research exists, but not as formal requirement records with authority/state
- Section B (data model): NOT_IMPLEMENTED — no requirement_id,
  requirement_set_id, jurisdiction_id, or any structured requirement storage
- Section C (generation): PARTIAL — there is a generation pipeline for
  local-requirements research, but not for immutable requirement sets
- Section D (versioning): NOT_IMPLEMENTED — no requirement versioning
- Section E (task relationship): IMPLICIT — tasks do not consume a requirement
  set; they may rely on separate research or prose guidance instead
- Section F (validation): NOT_IMPLEMENTED — no requirement validation or
  completeness checking

V1 Cross-Reference Adjustments:
- Task System: tasks are generated directly from profile + research, not
  from a formal requirements set
- Document Checklist: no requirements to derive document dependencies from
- Timeline System: does not exist — no requirements to position in time
- Event System: does not exist — no requirements.generated events
- Data Update System: does not exist — no cascade from requirements to
  downstream systems

V1 Fallback Behavior:
- Requirement awareness: the local-requirements route returns categorized
  research output for registration, tax ID, healthcare, banking, housing, and
  related topics
- Requirement coverage: task generation and guide content may still duplicate
  or bypass this output because there is no canonical requirement-set layer
- No formal completeness guarantee — output quality depends on AI research
  quality and source coverage

============================================================

============================================================
A. PURPOSE, DEFINITION & SCOPE BOUNDARIES
============================================================

A.1 Core Definition — What qualifies as a “Local Requirement”?
Definition:
A Local Requirement is a jurisdiction-specific administrative obligation that a user must complete to (a) legally reside, (b) register identity/address, or (c) gain lawful access to essential public/financial/work systems in the destination.

In-scope categories (canonical):
1) Legal residency
   - Residence registration (where legally mandated)
   - Visa validation / residence permit issuance steps that are post-arrival obligations
   - Biometric registration (if required as part of permit/ID issuance)
2) Government identity
   - Tax ID / personal number issuance
   - National ID registration/issuance (if required for residents)
   - Social security registration (if mandatory or gate to essential services)
3) Public services access (only if mandatory or gatekeeping)
   - Healthcare system registration
   - Mandatory health insurance enrollment (where legally required)
4) Municipal compliance
   - Address registration (authority-backed)
   - Population registry registration (authority-backed)
5) Economic activity permissions
   - Work authorization activation (where a separate activation/registration is required)
   - Business registration (only if the user is self-employed AND registration is legally required)
6) Financial system access (only when legally prerequisite)
   - Prerequisites legally required before opening a bank account (e.g., ID number issuance), but NOT “open a bank account” itself unless the jurisdiction explicitly mandates it (rare).

Out-of-scope (explicit):
- Optional recommendations (e.g., “get a local SIM”, “learn basic phrases”)
- Lifestyle suggestions (e.g., neighborhoods, culture tips)
- Housing search advice (e.g., “find an apartment”, “use Blocket”)
- Purely informational “how things work” content with no administrative obligation
- Employer/internal processes (unless explicitly required by government authority)

WHY this boundary exists:
- Prevents GoMate from pretending to be an exhaustive legal advisor.
- Keeps the system auditable, versionable, and safe: only obligations with authority + necessity enter the Requirements layer.

A.2 Qualification Criteria — strict rule set
A requirement MUST satisfy ALL:
1) Authority-backed:
   - Must be tied to a government/official authority (national/municipal agency) OR a legally mandated delegated authority.
2) Necessity:
   - Required by law OR required to lawfully access a critical system (residency, taxation, work authorization, healthcare enrollment where mandatory).
3) Condition/time bound:
   - Triggered by a condition (arrival, residency duration, visa category) AND/OR has a timing expectation (e.g., “within X days/weeks”, “before starting work”, “before accessing healthcare”).

A requirement MUST NOT be:
- Optional advice or “nice-to-have”
- Purely explanatory content
- A task that is only practical but not mandatory (e.g., “open a bank account” in most countries)

Operational enforcement:
- Generator only emits a requirement if it can attach:
  - issuing_authority_name AND authority_url (or dataset authority reference)
  - a clear “why_required” grounded in law/registration/access necessity
  - a timing field (deadline_type + recommended_timing), even if expressed as “as soon as possible after arrival”

A.3 Completeness Model — choose and enforce quality bar
Chosen model: Option B — Best-effort high-confidence list.

Quality bar:
- “High-confidence” means each emitted requirement has:
  1) Authority reference (name + URL or dataset ref)
  2) Clear obligation phrasing (atomic, not vague)
  3) Applicability conditions (who/when)
- The system explicitly does NOT claim 100% legal completeness.

Minimum completeness threshold for SUCCESS:
- For a run to be marked SUCCESS (ACTIVE), it must produce:
  - At least N core requirements for the destination scenario (N = 3 baseline),
  - AND must include at least one from “Legal residency” OR “Government identity” when applicable.
- If below threshold, mark as PARTIAL_SUCCESS (still returns data) or FAILED depending on cause:
  - Missing data → FAILED (blocked)
  - Dataset coverage gaps → PARTIAL_SUCCESS with warnings

A.4 Atomicity Definition — how to split requirements
Rule:
- One requirement = one administrative obligation, one authority, one “done” outcome.
- Must be title-able without conjunctions (“and”, “&”, “plus”).

Example:
Bad: “Register in Sweden”
Good:
- “Apply for Swedish Personal Identity Number (personnummer)”
- “Register your address with Skatteverket (population registration)”

Atomicity enforcement:
- Validator rejects titles with multiple obligations (“apply + register”, “get X and Y”)
- Generator instructed to emit multiple requirement records instead of one combined item.

============================================================
B. IDENTITY, OWNERSHIP & UNIQUE CONSTRAINT MODEL
============================================================

B.1 Requirement Set Definition
Requirement Set = immutable collection of requirements for ONE relocation scenario snapshot.

Bound keys stored on the set:
- plan_id (required)
- profile_version_id (required)
- destination_country (required)
- destination_city (optional)
- visa_type_id (optional but strongly recommended when available)

B.2 Ownership Model
Requirement Set is a plan-level artifact.
WHY:
- A plan is the unit of relocation intent, tasks, and progress.
- Keeps audit trails per plan and prevents cross-plan leakage.

B.3 Multiple Requirement Sets (versioning)
A plan may have multiple sets as versions when:
- profile changes (relevant fields)
- destination changes
- visa recommendation changes
Each version becomes a new Requirement Set record, prior sets remain for audit.

B.4 Unique Constraint (critical)
Database MUST enforce uniqueness to prevent duplicate current sets for the same scenario:
UNIQUE(plan_id, profile_version_id, destination_country, visa_type_id)

Note:
- destination_city is not in the uniqueness key by default (optional), but can be included if city materially changes obligations for your supported countries. If not included, city must still be stored and shown; but uniqueness remains stable.

B.5 Requirement Entity Identity
Each requirement has:
- requirement_id (UUID)
- requirement_set_id (FK)
- requirement_type_id (stable canonical identifier)

requirement_type_id purpose:
- Deduplicate within a set (no repeats of same canonical requirement)
- Enable mapping across versions (the “same kind of requirement” through time)

B.6 Canonical Requirement Set Pointer
Plan stores:
- current_requirement_set_id
WHY:
- Resolves “what the user is currently following” without scanning versions.
- Prevents ambiguity in UI and task derivation.

============================================================
C. GENERATION TRIGGERS & TRIGGER PROTECTION
============================================================

C.1 Allowed Triggers

Requirement generation is triggered by domain events routed through the Event System (event-trigger-system.md C.2).

Automatic triggers (domain events):

| Domain Event | Trigger Behavior |
|-------------|-----------------|
| recommendation.selected_current (type=visa_route) | Visa recommendation finalized — full regeneration |
| plan.locked | Plan locked — snapshot and freeze |
| plan.destination_changed / plan.destination_set | Destination changed — full regeneration |
| profile.version_created (citizenship field changed) | Citizenship changed — full regeneration |

Manual triggers (user initiated):
- “Generate Requirements” button → requirements.regenerate_requested event
- “Refresh Requirements” button → requirements.refresh_requested event

Requirement generation follows the Data Update System cascade (data-update-system.md). Requirements are a DAG node that depends on: profile snapshot + visa recommendation + research datasets.

C.2 Forbidden Triggers (cost/loop protection)
Hard-forbidden:
- Dashboard load
- Guide generation triggering requirements
- Chat open / chat message triggering requirements
WHY:
- Prevents silent background spend, infinite loops, and “generation storms”.

C.3 Generation Preconditions (minimum input set)
Generation allowed only if these exist in profile snapshot:
- citizenship_country
- destination_country
- relocation_purpose
- visa_type_id IF the system requires visa specificity for the destination/purpose
  (policy: if visa is unknown, system may run only if it can still produce meaningful baseline obligations; otherwise block)

C.4 Regeneration Model
Regeneration MUST create a new Requirement Set version.
It must NOT overwrite old sets.
WHY:
- Auditability, rollback, and stability of guide/task snapshots.

C.5 Trigger Idempotency
If a generation run is already in progress for the same input_hash:
- Return the existing run + its requirement_set_id (or pending status)
- Do NOT enqueue another run

C.6 Trigger Auditability
Each generation logs:
- trigger_source (e.g., PLAN_LOCKED, VISA_FINALIZED, USER_REFRESH)
- trigger_actor (user_id or “system”)
- profile_version_id
- timestamp

============================================================
D. INPUT CONTRACT & DEPENDENCY GRAPH
============================================================

D.1 Profile Snapshot Requirement (critical)
Requirement generation MUST use an immutable profile snapshot:
- profile_version_id references a frozen record
- generator never reads “live profile” fields directly
WHY:
- Deterministic output, auditability, idempotency, and reproducible reruns.

D.2 Mandatory Profile Inputs
Minimum required fields:
Identity:
- citizenship_country
Destination:
- destination_country (destination_city optional)
Legal status:
- relocation_purpose
- visa_type_id (if required by policy)
Personal context (optional unless explicitly needed):
- family_status
- dependents_count / dependent_types
Policy:
- If family/dependents missing but required for visa/obligations, generation returns PARTIAL_SUCCESS with warnings or blocks depending on destination rules.

D.3 Visa Recommendation Dependency
If visa recommendation exists:
- It is the primary dependency and must be referenced by visa_type_id and visa_recommendation_version_id.
Fallback if visa recommendation unavailable:
- If destination/purpose supports generic baseline obligations, run with visa_type_id = null and label results “visa-agnostic baseline”
- Otherwise block with FAILED: VISA_DEPENDENCY_MISSING

D.4 External Research Dependencies

Generation consumes research from the Research System two-layer model (research-system.md A.5):

Layer 1 (generic, shared across users):
- legal_framework research (country-level legal obligations dataset)
- admin_process research (visa-level administrative process dataset)
- municipal_registry research (city-level, optional)

Layer 2 (user-specific, plan-scoped):
- User-specific research filtered by visa_type, citizenship, purpose

Each research input must be versioned and referenced:
- generic_research_ids[] — Layer 1 research snapshots used
- user_research_ids[] — Layer 2 research snapshots used (if applicable)
- research_dataset_version_id — aggregate version identifier

Cross-reference: research-system.md Section A.5 (two-layer model), Section B (schemas).

D.5 Missing Data Handling
Policy:
- Missing mandatory inputs → BLOCK generation (FAILED) with explicit missing_fields list.
- Missing optional inputs → generate but attach warnings and potentially omit dependent requirements.

D.6 Input Version Binding
Requirement Set stores:
- profile_version_id
- visa_recommendation_version_id (nullable)
- research_dataset_version_id (or per-dataset version IDs)

============================================================
E. UPDATE, REGENERATION & VERSIONING SEMANTICS
============================================================

E.1 Profile Change Handling
When relevant fields change (citizenship, destination, purpose, visa):
- Current Requirement Set becomes STALE
- Plan.current_requirement_set_id remains pointing to the last ACTIVE set until a new set is generated (or you may auto-switch to the newest set after successful regen)

E.2 Regeneration Strategy
Always create new Requirement Set record with incremented version_number.

E.3 Version Identity Model
Requirement Set includes:
- version_number (monotonic per plan)
- is_current (boolean)
- created_at

Rule:
- Exactly one set per plan is_current = true (the canonical set), enforced by transaction logic.

E.4 Stale Handling
Stale sets:
- remain visible (audit)
- clearly marked STALE
- cannot be edited in-place

E.5 Canonical Resolution
Plan resolves current requirements via:
- current_requirement_set_id
No “compute latest” logic in UI.

============================================================
F. UX, DISPLAY & PRESENTATION CONTRACT
============================================================

F.1 Display Locations
- Dedicated Requirements page (primary)
- Dashboard summary (counts + status)
- Checklist/Tasks page (derived tasks + requirement link)
- Guide (snapshot references set version)

F.2 Minimum Requirement Schema (strict)
Each requirement MUST include:
Identity:
- requirement_id
- title
Description:
- description
- why_required
Authority:
- issuing_authority_name
- authority_url
Timing:
- deadline_type (ENUM)
- recommended_timing (text/structured)
Completion:
- completion_status (stored separately from requirement definition; see I.3)
Dependencies:
- prerequisite_requirements (IDs or requirement_type_ids)

F.3 Status Model (requirement-level)
- NOT_STARTED
- IN_PROGRESS
- COMPLETED
- BLOCKED
- EXPIRED
- NOT_APPLICABLE

F.4 Blocking Visualization
- If requirement has prerequisites, show “Blocked by X”
- Provide direct links to prerequisites

F.5 Missing Data UX
If generation is partial:
- UI banner: “Partial requirements generated”
- Show warnings and which inputs/datasets limited coverage
- Never imply completeness

============================================================
G. RELATIONSHIP TO TASK SYSTEM (critical)
============================================================

G.1 Requirements vs Tasks
Requirements = legal/admin obligations (what must be true)
Tasks = actionable steps (what user does)

G.2 Mapping Model
Each Requirement may generate:
- 0 tasks (if purely informational requirement, but that’s usually out-of-scope — preferred is at least 1 task)
- 1 task (common)
- many tasks (if process has multiple steps)

G.3 Task Identity
Tasks must store:
- requirement_id (FK reference)
Optionally:
- requirement_type_id for cross-version mapping.

G.4 Task Independence Rule

Tasks MAY exist independently of requirements.

The Settling-in Task System (settling-in-tasks.md) is the canonical authority for task existence and lifecycle. Tasks may originate from:

1. Requirement-derived tasks — linked via requirement_id FK (most common for legal/admin tasks)
2. Independent tasks — tasks generated directly by the Task System without a requirement origin (e.g., practical settling-in tasks, onboarding tasks)

When a task IS linked to a requirement:
- requirement_id FK is set
- Requirement completion MAY depend on linked task completion (G.5)
- Cross-version mapping via requirement_type_id is available

When a task is NOT linked to a requirement:
- requirement_id is NULL
- Task follows its own lifecycle per settling-in-tasks.md
- This is valid and expected for non-legal/non-admin tasks

Cross-reference: settling-in-tasks.md Section D.2 (task origin model — canonical authority).

G.5 Completion Semantics
Requirement completion rule (default):
- COMPLETED when all linked tasks are COMPLETED
OR user manually marks requirement COMPLETED (manual override recorded in audit)

============================================================
H. RELATIONSHIP TO GUIDE SYSTEM
============================================================

H.1 Dependency Model
Guide must use a snapshot of the Requirement Set (version-bound)
NOT live requirements.

H.2 Snapshot Binding
Guide stores:
- requirement_set_version_id (or requirement_set_id + version_number)

H.3 Update Effects
If requirements update:
- Guide becomes STALE
- Never auto-regenerate guide (unless a separate, explicit guide trigger policy exists)

H.4 Guide Regeneration
- Manual regenerate by user OR separate auto-trigger system (not coupled to requirements engine by default)

============================================================
I. COMPLETION, TRACKING & USER INTERACTION MODEL
============================================================

I.1 Completion Authority
- User can mark requirement status directly.
- System MAY auto-mark based on evidence only if such evidence collection is explicitly implemented later (not assumed now).

I.2 Completion Model
Choose: Multi-stage model for better realism:
- NOT_STARTED
- IN_PROGRESS
- SUBMITTED
- APPROVED
- COMPLETED
Mapping to UI:
- Default path is NOT_STARTED → IN_PROGRESS → COMPLETED
- SUBMITTED/APPROVED used only when the requirement has a clear “submission then approval” nature.

I.3 Completion Persistence (critical)
Completion must be stored separately from requirement definition:
- requirement_completion table keyed by (requirement_id, user_id) or (requirement_id, plan_id)
WHY:
- Requirement Set is immutable; completion is user-state.

I.4 Uncompletion Handling
User can revert completion.
Audit trail records:
- who changed it
- from/to
- timestamp
- optional reason

I.5 Progress Computation
Dashboard progress computed from:
- number of requirements by status (or weighted)
- optionally include tasks progress roll-up

============================================================
J. ERRORS, FAILURE & RECOVERY MODEL
============================================================

J.1 Failure Types
- Missing mandatory profile data
- Visa dependency missing (when required)
- Dataset unavailable
- Generator runtime failure
- DB write failure

J.2 Failure State Model
Requirement Set status includes FAILED (set-level).
Also include PARTIAL_SUCCESS (recommended) or represent via ACTIVE + warnings; choose one:
- Recommended: set.status = ACTIVE but meta.warnings indicates partial coverage
- If you prefer explicit: set.status = ACTIVE|FAILED plus a boolean is_partial

J.3 Failure UX
- Show “Requirements could not be generated”
- Provide “Retry” button
- Show missing fields / dataset outage message

J.4 Retry Semantics
Policy:
- Retry reuses the same profile snapshot if failure was transient (dataset outage/generator error)
- If the user edits profile fields, retry becomes a new version by definition.

J.5 Duplicate Protection
Unique constraint + idempotency guarantees prevent duplicates during retry.

============================================================
K. LIFECYCLE, VALIDITY & PERSISTENCE MODEL
============================================================

K.1 Requirement Set Lifecycle States (set-level)
- NOT_GENERATED
- GENERATING
- ACTIVE
- STALE
- FAILED
- ARCHIVED

K.2 Validity Period
Optional per requirement:
- valid_from, valid_until when applicable (e.g., time-limited registrations)

K.3 Invalidation (stale rules)
Set becomes STALE if:
- profile changes in relevant fields
- visa changes
- destination changes

K.4 Archival
Old versions remain stored indefinitely; never auto-delete.

K.5 Persistence Duration
Indefinite retention for auditability (unless user explicitly deletes the plan/account per privacy policy).

============================================================
L. DATA MODEL CONTRACT
============================================================

Requirement Set record fields (minimum):
- requirement_set_id (UUID)
- plan_id
- profile_version_id
- visa_recommendation_version_id (nullable)
- version_number
- is_current
- status (ENUM from K.1)
- created_at
- generator_version
- input_hash
Optional but recommended:
- warnings (jsonb array)
- trigger_source, trigger_actor, triggered_at

Requirement record fields (minimum):
- requirement_id (UUID)
- requirement_set_id (FK)
- requirement_type_id (stable)
- title
- description
- why_required
- authority_name
- authority_url
- deadline_type
- recommended_timing
- dependency_ids (array of requirement_type_id or requirement_id)

============================================================
M. GENERATOR EXECUTION CONTRACT
============================================================

M.1 Input Contract
Generator receives:
- profile_snapshot (immutable)
- visa_recommendation_snapshot (nullable)
- research_dataset bundle (versioned)

M.2 Output Contract
Generator outputs strict structured schema:
- requirement_set metadata
- list of requirements in the schema (no free text blobs)

M.3 Validation Layer
Before persisting:
- Schema validation (required fields present, enums valid)
- Dedup validation (no duplicate requirement_type_id within set)
- Atomicity checks (no multi-obligation titles)
- Authority presence checks (authority_name/url required)

M.4 Generator Version Tracking
Each persisted Requirement Set stores generator_version
WHY:
- Makes changes explainable when output differs across time.

============================================================
N. CROSS-SYSTEM REFERENCES
============================================================

N.1 Upstream (inputs to requirement generation)

- Profile System (profile-system.md) — profile_version_id snapshot with citizenship, destination, purpose, family
- Recommendation System (recommendation-system.md) — visa_route recommendation (visa_type_id, visa_recommendation_version_id)
- Research System (research-system.md) — two-layer research model: Layer 1 generic legal/admin datasets, Layer 2 user-specific research
- Event/Trigger System (event-trigger-system.md) — domain event routing: plan.destination_changed, recommendation.selected_current, profile.version_created
- Data Update System (data-update-system.md) — cascade orchestration; requirements are a DAG node

N.2 Downstream (consumes requirement output)

- Settling-in Task System (settling-in-tasks.md) — derives tasks from requirements (G.2); tasks MAY also exist independently (G.4)
- Guide Generation System (guide-generation.md) — guide binds to requirement_set_version_id snapshot; requirement change marks guide STALE
- Timeline System (timeline-system.md) — requirements appear as timeline items (source_type=requirement)
- Dashboard System (dashboard.md) — displays requirement counts, status, and progress
- Notification System (notification-system.md) — requirement deadline/overdue events trigger notifications
- Progress Tracking System (progress-tracking-system.md) — MAY derive pre_arrival_progress from requirement completion

N.3 Shared Contracts

- Plan LifecycleState × Stage: plan-system.md Section C (requirement generation respects lifecycle gating)
- Profile versioning: profile_version_id defined in profile-system.md Section G (requirements bind to immutable snapshot)
- Event taxonomy: event-trigger-system.md Section C.2 (domain events that trigger requirement generation)
- Guide staleness: requirement change → guide.outdated (guide NEVER auto-regenerates — guide-generation.md C.2)
- Task origin: settling-in-tasks.md Section D.2 is canonical authority for task existence — tasks MAY exist independently of requirements
- Data Update DAG: data-update-system.md Section G (requirements are a cascade node)
- Research two-layer model: research-system.md Section A.5 (generic shared + user-specific plan-scoped)

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Profile System (profile-system.md) | PARTIAL |
| Recommendation System (recommendation-system.md) | MINIMAL |
| Research System (research-system.md) | PARTIAL |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |
| Data Update System (data-update-system.md) | NOT_IMPLEMENTED |
| Settling-in Tasks (settling-in-tasks.md) | PARTIAL |
| Guide Generation System (guide-generation.md) | PARTIAL |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |
| Dashboard System (dashboard.md) | PARTIAL |
| Notification System (notification-system.md) | MINIMAL |
| Progress Tracking System (progress-tracking-system.md) | PARTIAL |
| Plan System (plan-system.md) | PARTIAL |

============================================================
O. SYSTEM INVARIANTS
============================================================

Invariant 1: Requirement Sets are immutable snapshots — regeneration creates new version, never overwrites.

Invariant 2: Requirement Sets bind to profile_version_id — deterministic output from immutable inputs.

Invariant 3: Tasks MAY exist independently of requirements — settling-in-tasks.md is canonical task authority.

Invariant 4: Requirement generation is triggered by domain events, NOT by dashboard load or chat open (C.2).

Invariant 5: Each requirement satisfies atomicity rule — one obligation, one authority, one done outcome (A.4).

Invariant 6: Requirement change marks dependent guide as STALE — guide NEVER auto-regenerates.

Invariant 7: Exactly one Requirement Set per plan is current (is_current = true), resolved via current_requirement_set_id (B.6).


END — Local Requirements System Definition
