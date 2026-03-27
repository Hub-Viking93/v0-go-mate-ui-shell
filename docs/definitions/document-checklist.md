DOCUMENT CHECKLIST SYSTEM — DEFINITIVE SYSTEM DEFINITION
GoMate Relocation Platform

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: MINIMAL

V1 Implementation Reality:
- Checklist generation exists via `/api/research/checklist` and
  `lib/gomate/checklist-generator.ts`, storing generated `checklist_items`
  JSONB on the plan
- Document tracking is implemented as a JSONB column (document_statuses) on
  the relocation_plans table — added in Phase 0 migration 013
- No document_requirements table, no document_checklist_sets table, no
  task_document_dependency join table
- No document upload, verification, or expiration tracking
- Checklist generation is separate from document-status tracking; the system
  has a generated checklist artifact but not a formal document compliance model
- No versioning, no immutable checklist sets, no generator

V1 Deviations from Canonical Spec:
- Section B (data model): NOT_IMPLEMENTED — no document_requirement_id,
  document_type_id, checklist_set_id, or any of the identity/uniqueness model
- Section C (generation triggers): PARTIAL — manual/triggered checklist
  generation exists, but not canonical event-driven checklist-set generation
- Section D (visa binding): NOT_IMPLEMENTED — documents not bound to any
  visa recommendation version
- Section E (task relationship): NOT_IMPLEMENTED — no task_document_dependency
  join table; documents do not gate task completion
- Section F (upload & verification): NOT_IMPLEMENTED — no file upload, no
  verification workflow, no status lifecycle
- Section H (versioning): NOT_IMPLEMENTED — no versioned checklist sets

V1 Cross-Reference Adjustments:
- Task System: tasks do not reference document dependencies
- Visa Recommendation: no visa-bound document requirements
- Event System / Data Update System: no events trigger checklist generation
- Profile versioning: documents not bound to profile_version_id

V1 Fallback Behavior:
- Document awareness: a generated checklist artifact exists and is returned by
  `/api/research/checklist`
- Document tracking: the `document_statuses` JSONB column allows basic status
  tracking per document name from that checklist (not per formal
  `document_type_id`)
- No blocking enforcement — task completion is not gated by document status

============================================================

============================================================
A. PURPOSE, DEFINITION & SCOPE BOUNDARIES
============================================================


A.1 Core Definition


A Document Requirement in GoMate is a formal, versioned compliance dependency representing a specific official document that must exist, be prepared, and/or be submitted in order for the user to complete a legal requirement, visa process, or administrative procedure.

A Document Requirement is NOT an action. It is a prerequisite artifact.

Documents exist to enable Tasks and Requirements to be completed.

Documents are passive compliance objects.
Tasks are active execution objects.


IN SCOPE:

Documents that are legally required or administratively required to:

- Apply for visas
- Obtain residence permits
- Register with government authorities
- Access public systems (tax, healthcare, banking where legally required)
- Prove identity, financial capability, residence, or eligibility


OUT OF SCOPE:

- Advice
- Recommendations
- Actions (these belong to Task System)
- Informational guidance
- Optional preparation suggestions



A.2 Checklist Purpose


The Document Checklist exists to answer four canonical compliance questions:


1. Completeness:

"What documents are required?"


2. Readiness:

"Which documents are already provided?"


3. Compliance Validity:

"Which documents are verified and acceptable?"


4. Risk / Blockers:

"Which documents are missing, invalid, or expired?"


This enables:

- Compliance tracking
- Task dependency enforcement
- User progress tracking
- Guide accuracy
- Timeline generation accuracy



A.3 Checklist vs Tasks — Canonical Relationship


Documents are dependencies of Tasks.

They are NOT Tasks.

Relationship model:

Requirement → Task → Document Dependencies


Example:

Requirement:
Obtain Residence Permit


Task:
Submit residence permit application


Document Dependencies:

Passport
Application Form
Biometric Photo


Execution rule:

Task completion is BLOCKED unless all REQUIRED document dependencies are VERIFIED.



A.4 Mandatory vs Conditional vs Optional Classification


Each Document Requirement has classification:


REQUIRED:

Legally mandatory.
Blocks compliance if missing.


CONDITIONAL:

Required only if specific profile condition applies.


OPTIONAL:

Not required for compliance.
Does not block execution.


ONLY REQUIRED documents block Task completion and Compliance completion.



============================================================
B. IDENTITY, UNIQUENESS & DATA MODEL
============================================================


B.1 Document Requirement Identity


Each Document Requirement is uniquely identified by:

document_requirement_id (UUID)

This is immutable.



B.2 Canonical Uniqueness Constraint


Database MUST enforce:

UNIQUE(plan_id, profile_version_id, visa_recommendation_version_id, document_type_id)


This prevents duplicates.


This ensures deterministic compliance state.



B.3 Document Type Model


document_type_id represents stable canonical document definitions.


Examples:

PASSPORT

BIRTH_CERTIFICATE

BANK_STATEMENT

PROOF_OF_ADDRESS

HEALTH_INSURANCE_CERTIFICATE


Document types are globally defined and version-independent.



B.4 Document Checklist Set Model


Document Checklist exists as versioned sets:


document_checklist_set_id

plan_id

profile_version_id

visa_recommendation_version_id

version_number

status

generator_version

created_at

is_current



Checklist Set is the container.


Checklist Set is immutable after generation.



B.5 Individual Document Requirement Structure


Each Document Requirement contains:


Identity:

document_requirement_id

document_type_id



Description:

title

description

issuing_authority



Dependency linkage:

requirement_id (nullable)

task_id (nullable)



Execution:

status

classification

due_date (nullable)

expiration_date (nullable)



Verification:

verification_status

verified_at

verified_by



File linkage:

file_reference_id

upload_timestamp



Traceability:

checklist_set_id

generator_version




============================================================
C. GENERATION TRIGGERS & EXECUTION MODEL
============================================================


C.1 Allowed Automatic Generation Triggers

Checklist generation is triggered by domain events routed through the Event System (event-trigger-system.md C.2):

Primary triggers (domain events):

| Domain Event | Trigger Behavior |
|-------------|-----------------|
| recommendation.selected_current (type=visa_route) | Visa recommendation finalized — full regeneration |
| requirements.generated | New requirement set created — full regeneration |
| plan.locked | Plan locked — snapshot and freeze |

Secondary triggers (domain events):

| Domain Event | Trigger Behavior |
|-------------|-----------------|
| profile.version_created (critical field changes) | Profile changes affecting document requirements |

Manual triggers allowed:

- User clicks "Generate Checklist" → checklist.regenerate_requested event
- Admin regeneration

Checklist generation follows the Data Update System cascade (data-update-system.md). Checklist is a DAG node downstream of: requirements + visa recommendation + profile snapshot.



C.2 Forbidden Triggers


Checklist generation is NEVER triggered by:


Dashboard load

Chat open

Guide open

UI refresh

Page navigation


These are read-only consumers.



C.3 Generation Preconditions


Checklist generation allowed ONLY if:

Profile Version exists

Visa Recommendation exists

Requirement Set exists

Plan exists



If missing:

Generation fails.



C.4 Execution Model


Checklist generation is ALWAYS asynchronous.


Execution flow:

Event → Queue → Generator → Validation → Commit → Activate



Checklist is not visible until complete.



C.5 Regeneration Model


Regeneration NEVER overwrites existing checklist.


Regeneration ALWAYS creates new Checklist Set version.


Old versions remain stored.



C.6 Idempotency Protection


System enforces idempotency using:


idempotency_key = hash(plan_id, profile_version_id, visa_recommendation_version_id, generator_version)


Duplicate generation blocked.



============================================================
D. RELATIONSHIP TO VISA RECOMMENDATION
============================================================


D.1 Visa Binding Model


Checklist is strictly bound to:

visa_recommendation_version_id


Checklist is invalid outside this context.



D.2 Visa Change Handling


If visa recommendation changes:


Checklist state becomes:

STALE


Checklist cannot be deleted.


Checklist cannot be updated.


Checklist is frozen.



D.3 Regeneration Requirement


New visa recommendation MUST produce new checklist version.


This is mandatory.



D.4 Multiple Visa Support


Each visa option has its own Checklist Set.


No cross-visa checklist mixing allowed.



============================================================
E. RELATIONSHIP TO TASK SYSTEM
============================================================


E.1 Dependency Model

Document dependencies are a SEPARATE dependency class from Task-to-Task dependencies.

They MUST NOT be modeled inside the generic task `depends_on` graph (settling-in-tasks.md B.7).

Two distinct dependency models exist:

1. Task Dependency Graph (`depends_on` — settling-in-tasks.md B.7):
   - Task → Task sequencing and prerequisites
   - Ordering constraints and execution logic
   - dependency_mode: ALL | ANY

2. Document Dependencies (`task_document_dependency` — this system):
   - Task → Document Requirement prerequisites
   - Compliance readiness and verification gating
   - Blocking enforcement via verification_status

Canonical linkage mechanism:

Tasks reference required Documents via:

task_document_dependency (join table)

Fields:
- task_id (FK → settling_in_tasks)
- document_requirement_id (FK → document_requirements)
- is_blocking (boolean, default true for REQUIRED documents)

Relationship:

Task → Document Requirement

NOT reverse ownership. Documents do NOT "own" tasks.



E.2 Completion Enforcement

Task completion is BLOCKED unless:

All REQUIRED Documents linked via task_document_dependency:

verification_status = VERIFIED

This blocking is enforced INDEPENDENTLY of the task-to-task dependency graph.

A task may be blocked by BOTH:
- unresolved task dependencies (depends_on — settling-in-tasks.md B.7)
- unverified document dependencies (task_document_dependency — this system)

Both must be satisfied for task completion.



E.3 Version Integrity

Checklist must match:

task_set_version_id
requirement_set_version_id
visa_recommendation_version_id

Cross-version linking forbidden.

task_document_dependency links MUST match the active checklist_set version for the plan. Document Requirements are version-bound to their checklist_set — no cross-version document references allowed.



E.4 Independent Documents


Some Documents exist independently.


Example:

Passport


These are still tracked.



============================================================
F. COMPLETION TRACKING, UPLOAD & VERIFICATION MODEL
============================================================


F.1 Document Status Model


Document status lifecycle:


NOT_PROVIDED

UPLOADED

SUBMITTED

VERIFIED

REJECTED

EXPIRED

ARCHIVED



F.2 Upload Model


User uploads document file.


System stores:


file_reference_id

upload_timestamp

uploaded_by



Upload changes status:

NOT_PROVIDED → UPLOADED



F.3 Verification Model


Verification authority:


User self-verification allowed (default)

Admin verification optional (future)



Verification states:


PENDING_VERIFICATION

VERIFIED

REJECTED



F.4 Completion Definition


Document considered COMPLETE when:


verification_status = VERIFIED



F.5 Completion Reversibility


Completion is reversible.


System stores full audit trail.



F.6 Expiration Tracking


Documents with expiration_date automatically transition to:

EXPIRED


Expired documents invalidate dependent tasks.



============================================================
G. UX, DISPLAY & PROGRESS MODEL
============================================================


G.1 Display Locations


Document Checklist visible in:


Documents Page

Dashboard Summary

Task Detail View



G.2 Progress Calculation


Canonical progress formula:


verified_required_documents / total_required_documents



G.3 Visual Status Indicators


Each Document visually marked as:


Missing

Uploaded

Verified

Rejected

Expired



G.4 Missing Document UX


Missing documents show:


Why required

Issuing authority

Description

Upload interface



G.5 Document Detail View


Detail view includes:


Document description

Authority

Upload

Verification status

History



G.6 Task Integration


Tasks display required documents.


Users see blockers.



============================================================
H. VERSIONING, UPDATE & REGENERATION
============================================================


H.1 Version Model


Checklist Sets use:


version_number

is_current flag

status



H.2 Regeneration Behavior


Regeneration creates new version only.


Never overwrites.



H.3 Completion Migration Rule


Completion MAY migrate if:


Same document_type_id

AND

Document not expired

AND

File exists



Otherwise reset.



H.4 Stale Handling


Old versions marked:

STALE


Remain stored permanently.



H.5 Canonical Resolution


Plan stores:


current_document_checklist_set_id



============================================================
I. PERSISTENCE, STORAGE & DUPLICATE PROTECTION
============================================================


Checklist Sets persist indefinitely.


Full audit trail stored:


Uploads

Verification

Status changes



Database enforces uniqueness.


No duplicates allowed.



============================================================
J. ERROR HANDLING & FAILURE MODEL
============================================================


Failure states:


FAILED


Checklist invisible until complete.


Retry allowed.


Retry reuses idempotency key.


Partial checklist never visible.



============================================================
K. LIFECYCLE & VALIDITY MODEL
============================================================


Checklist Lifecycle:


NOT_GENERATED

GENERATING

ACTIVE

STALE

FAILED

ARCHIVED



Document Lifecycle:


NOT_PROVIDED

UPLOADED

VERIFIED

REJECTED

EXPIRED

ARCHIVED



Checklist validity bound to:


Profile Version

Visa Recommendation Version



============================================================
L. GENERATOR EXECUTION CONTRACT
============================================================


Input:


Profile snapshot

Visa recommendation snapshot

Requirement set snapshot



Output:


Structured Document Checklist Set



Validation:


Schema validation

Duplicate validation



Generator version always stored.



============================================================
M. CROSS-SYSTEM REFERENCES
============================================================


M.1 Upstream (inputs to checklist generation)

- Profile System (profile-system.md) — profile_version_id snapshot
- Recommendation System / Visa Recommendation Module (visa-recommendation.md) — visa_recommendation_version_id determines visa-specific document requirements
- Local Requirements System (local-requirements.md) — requirement_set determines which requirements need documents
- Event/Trigger System (event-trigger-system.md) — domain event routing: recommendation.selected_current, requirements.generated, plan.locked
- Data Update System (data-update-system.md) — cascade orchestration; checklist is a DAG node downstream of requirements + visa

M.2 Downstream (systems that consume checklist data)

- Settling-in Task System (settling-in-tasks.md) — tasks reference documents via task_document_dependency; document verification gates task completion
- Guide Generation System (guide-generation.md) — guide binds to checklist snapshot; checklist change marks guide STALE
- Timeline System (timeline-system.md) — document deadlines as timeline items
- Dashboard System (dashboard.md) — document progress summary
- Notification System (notification-system.md) — document deadline/expiration notifications

M.3 Shared Contracts

- Plan scoping: checklist sets are plan-scoped, version-bound to profile_version_id + visa_recommendation_version_id
- Task dependency separation: document dependencies (task_document_dependency) are SEPARATE from task-to-task dependencies (depends_on) — see settling-in-tasks.md B.7
- Event taxonomy: event-trigger-system.md Section C.2 (checklist.generated event emitted after successful generation)
- Guide staleness: checklist change → guide.outdated (guide NEVER auto-regenerates — guide-generation.md C.2)
- Verification model: document verification_status is owned by Document Checklist System; task completion respects this independently

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Profile System | PARTIAL |
| Visa Recommendation | PARTIAL |
| Local Requirements System | NOT_IMPLEMENTED |
| Event Trigger System | NOT_IMPLEMENTED |
| Data Update System | NOT_IMPLEMENTED |
| Settling-in Tasks | PARTIAL |
| Guide Generation System | PARTIAL |
| Timeline System | NOT_IMPLEMENTED |
| Dashboard System | PARTIAL |
| Notification System | MINIMAL |


============================================================
N. SYSTEM INVARIANTS
============================================================


Invariant 1: Document Checklist Sets are immutable after generation — completion state stored separately (F).

Invariant 2: Document dependencies are a SEPARATE dependency class from task-to-task dependencies — never modeled in `depends_on` graph.

Invariant 3: Task completion is blocked by unverified REQUIRED documents independently of task dependency graph.

Invariant 4: Cross-version document linking is forbidden — task_document_dependency must match active checklist_set version.

Invariant 5: Checklist generation is triggered by domain events, NOT by dashboard load, chat open, or guide open (C.2).

Invariant 6: Each Checklist Set bound to profile_version_id + visa_recommendation_version_id — deterministic output from immutable inputs.

Invariant 7: Partial checklists never visible — generation either completes fully or fails (J).


============================================================
END OF DOCUMENT CHECKLIST SYSTEM DEFINITION
============================================================
