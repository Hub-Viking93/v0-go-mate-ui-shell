RESEARCH SYSTEM — FULL SYSTEM DEFINITION
GoMate — Canonical Specification

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Research is implemented as plan-scoped route/service flows for visa,
  local requirements, and checklist generation
- Research can be triggered independently via `/api/research/trigger`,
  `/api/research/visa`, `/api/research/local-requirements`, and
  `/api/research/checklist`
- No research table, no research versioning, no generic_research_id
- No Layer 1 (generic destination research) vs Layer 2 (user-specific) separation
- Results are stored as JSONB columns on relocation_plans
  (`visa_research`, `local_requirements_research`, `checklist_items`,
  `research_status`, `research_completed_at`)
- No research job queue, no worker system, no research status state machine

V1 Deviations from Canonical Spec:
- Section A.5 (two-layer model): NOT_IMPLEMENTED — single scraping pass per
  plan, no shared generic research across users
- Section B (entity model): NOT_IMPLEMENTED — no research_id, no
  profile_snapshot_id binding, no dataset_version tracking
- Section C (triggers): PARTIAL — research triggers exist, but they are
  route-driven and not event- or DAG-driven
- Section D.2 (snapshot model): NOT_IMPLEMENTED — research uses live profile
  data, not frozen snapshots
- Section I (versioning): NOT_IMPLEMENTED — research results are overwritten,
  not versioned
- Section O (deduplication): NOT_IMPLEMENTED — no idempotency keys

V1 Cross-Reference Adjustments:
- Event System references (Section W): no domain events emitted for research
- Data Update System references: no cascade orchestration
- Profile versioning (profile_snapshot_id): does not exist
- Downstream systems (Recommendation, Guide, Timeline, etc.) do not consume
  research via version pointers — they either call research inline or read
  from the JSONB column

V1 Fallback Behavior:
- Research execution: per-plan helper functions scrape official sources and
  analyze content on demand
- Research storage: results written directly to plan JSONB columns
- Research freshness: local requirements has a 7-day cache; visa and checklist
  are refreshed on demand unless upstream code decides otherwise
- Research failure: partial completion is possible; trigger-level status still
  collapses all sub-results into a single plan-level flag

============================================================

============================================================
A. PURPOSE & SCOPE
============================================================

A.1 Primary Purpose

The Research System is GoMate’s intelligence generation layer.

Its primary purpose is ALL of the following:

1. Collect verified relocation-relevant facts
2. Analyze user-specific eligibility and implications
3. Produce structured intelligence used by other systems
4. Provide inputs for recommendations, guide generation, timeline, and dashboard
5. Provide explainable, traceable, and versioned relocation intelligence

It does NOT make decisions.
It produces the intelligence that enables decisions.

Other systems decide.

Research answers:
"What is true?"
"What applies to this user?"
"What are the implications?"

Not:
"What should the user do?"

That is Recommendation System.


A.2 Product decisions dependent on Research System

The following systems are directly dependent:

MANDATORY dependencies:

Recommendation System
Guide System
Timeline System
Local Requirements System
Cost Calculation System
Dashboard System
Visa Eligibility Display
Compliance tracking

If research is missing:

Recommendations cannot be generated
Guide cannot be generated
Timeline cannot be generated
Compliance cannot be guaranteed
System must block dependent systems


A.3 System Boundaries

IN SCOPE research domains:

Visa research
Cost-of-living research (raw data only)
Legal and administrative research
Tax research
Healthcare system research
Housing system structure research
Work eligibility research
Local requirements research
Relocation process research

OUT OF SCOPE:

Recommendations
Affordability calculation
Guide generation
Plan creation
User advice
Timeline generation

Research produces inputs to those systems.


A.4 System Authority Level

Research System is:

NOT source of truth for user data

BUT

IS source of truth for relocation intelligence


User profile = source of truth for user

Research = source of truth for relocation facts and analysis


A.5 Personalization Level

Research is HYBRID with two distinct layers:

Layer 1: Generic Destination Research (SHARED)

Scope: destination-scoped, NOT plan-scoped.
Identity key: (research_type, destination, dataset_version)
Characteristics:
- Shared across ALL users and plans with the same destination.
- Contains only generic facts, laws, costs, and structural information.
- Contains NO user-specific analysis, NO profile data, NO plan data.
- Immutable once created.
- Refreshed only when dataset_version changes or valid_until expires.
- Stored once and reused via reference pointer (generic_research_id).

Content examples:
- Visa categories available for destination X
- Cost-of-living indices for destination X
- Legal registration requirements for destination X
- Healthcare system structure for destination X

Layer 2: User-Specific Research (PLAN-SCOPED)

Scope: plan_id + profile_snapshot_id scoped.
Identity key: (research_type, destination, visa_type [nullable], profile_snapshot_id, version)
Characteristics:
- Contains eligibility analysis, applicability filtering, and user-specific implications.
- References Layer 1 generic research via generic_research_id pointer.
- NEVER shared across users or plans.
- Immutable once created.

Content examples:
- "User X is likely eligible for visa category Y based on citizenship Z and income W"
- "User X's budget is insufficient for average housing in district D"
- "User X must register within 14 days (not 30) due to non-EU citizenship"

Isolation Invariants:
- Generic research MUST NOT contain: profile_snapshot_id, plan_id, user_id, or any personal data.
- User-specific research MUST always reference generic_research_id.
- Generic research may exist without any user-specific research (pre-populated for popular destinations).
- User-specific research MUST NOT exist without a corresponding generic research version.


============================================================
B. RESEARCH ENTITY MODEL
============================================================

B.1 Definition

A research output is:

Structured, versioned, snapshot-based intelligence generated from external data sources, optionally combined with profile snapshot + plan snapshot for user-specific analysis.

Research outputs exist at two layers (see A.5):
- Layer 1 (Generic): destination facts without user context
- Layer 2 (User-Specific): user-contextualized analysis referencing Layer 1


It contains:

Facts
Analysis (Layer 2 only)
Eligibility conclusions (Layer 2 only)
Requirements
Confidence
Sources


B.2 Granularity

Layer 1 (Generic) granularity:

research_type + destination + dataset_version

Layer 2 (User-Specific) granularity:

research_type + destination + visa_type + profile_snapshot_id


Research type examples:

visa_research
cost_research
legal_research
housing_research
healthcare_research
work_eligibility_research
tax_research


B.3 Identity & Unique Key

Layer 1 (Generic) unique constraint:
(research_type, destination, dataset_version)

Layer 2 (User-Specific) unique constraint:
(research_type, destination, visa_type, profile_snapshot_id, version)


B.4 Schema

Layer 1 — Generic Research Entity Fields:

generic_research_id (UUID)
research_type (enum)
destination (string)
dataset_version (string — identifies the external data version used)
version (int — sequential per unique key)
status (enum: see M)
payload (JSONB — facts, laws, costs, structural info only)
metadata (JSONB — source URLs, scrape timestamps, confidence metadata)
created_at (timestamptz)
completed_at (timestamptz, nullable)
valid_until (timestamptz)

Layer 1 MUST NOT contain: plan_id, user_id, profile_snapshot_id, or any personal data.

Layer 2 — User-Specific Research Entity Fields:

id (UUID)
plan_id (UUID)
user_id (UUID)
destination (string)
visa_type (string, nullable)
research_type (enum)
generic_research_id (UUID — FK to Layer 1; REQUIRED)
profile_snapshot_id (UUID — FK to profile version)
version (int — sequential per unique key)
status (enum: see M)
payload (JSONB — eligibility analysis, applicability filtering, user-specific implications)
metadata (JSONB)
created_at (timestamptz)
completed_at (timestamptz, nullable)
valid_until (timestamptz)


B.5 Immutability

Research outputs are IMMUTABLE at both layers.

Never overwritten.

Layer 1: New dataset_version = new generic research version.
Layer 2: New profile snapshot = new user-specific research version.

Old versions remain permanently readable at both layers.


============================================================
C. RESEARCH TRIGGERS
============================================================

Research is triggered when:

Profile snapshot created (Layer 2)
Plan destination changes (Layer 1 + Layer 2)
Visa type changes (Layer 2)
Plan created (Layer 1 + Layer 2)
Plan locked (snapshot freeze, no new generation)
Profile updated (Layer 2)
Dataset expires or refreshes (Layer 1)


Trigger Types:

AUTOMATIC:

Profile completion → Layer 2 generation
Destination set → Layer 1 resolve + Layer 2 generation
Plan creation → Layer 1 resolve + Layer 2 generation
Dataset expiration → Layer 1 refresh

MANUAL:

User clicks refresh → Layer 2 regeneration (may trigger Layer 1 refresh if expired)
Admin refresh → either layer

SCHEDULED:

Legal research refresh → Layer 1
Cost refresh → Layer 1


C.2 Two-Layer Generation Rules (Canonical)

When Research is triggered for a (research_type, destination, plan_id):

Step 1 — Resolve Generic Research (Layer 1):
  IF valid generic research exists for (research_type, destination, current_dataset_version):
    REUSE it (reference existing generic_research_id)
  ELSE:
    GENERATE new generic research
    Wait for completion before proceeding to Step 2

Step 2 — Generate User-Specific Research (Layer 2):
  Generate using:
  - profile_snapshot_id (from plan's current profile version)
  - plan snapshot (destination, visa_type, timeline)
  - generic_research_id (pointer to Layer 1 output from Step 1)

This two-step process ensures:
- Generic research is generated at most once per (research_type, destination, dataset_version)
- Multiple users relocating to the same destination share the same generic facts
- User-specific analysis is always fresh relative to the user's profile


Execution Mode:

Always ASYNC

Background job
Queue-driven
Worker executed (V1: synchronous in-request dispatch per event-trigger-system.md Section U)


Trigger Ownership (source domain events — see event-trigger-system.md):

plan.destination_changed / plan.destination_set → Layer 1 resolve + Layer 2 generation
profile.version_created → Layer 2 generation
external_data.refreshed → Layer 1 refresh
artifact.refresh_requested (research) → Layer 2 regeneration

Research System executes; Data Update System orchestrates cascade ordering.


============================================================
D. RESEARCH INPUTS
============================================================

D.1 Input Sources

Layer 1 (Generic) inputs:

External data ONLY:
- Visa databases (visa categories, general requirements, processing times)
- Cost datasets (Numbeo, local sources)
- Legal datasets (residency laws, registration rules)
- Healthcare system data
- Housing market data

Layer 1 MUST NOT use: profile data, plan data, user data.

Layer 2 (User-Specific) inputs:

Profile snapshot:
- citizenship
- age
- income
- savings
- family status
- education
- timeline
- purpose
- employment_context

Plan snapshot:
- destination
- visa type
- timeline

Generic research reference:
- generic_research_id (pointer to Layer 1 output — REQUIRED)


D.2 Snapshot Model

Research ALWAYS uses SNAPSHOT.

Never live profile.

Profile snapshot created first (see profile-system.md Section G for snapshot triggers).

Layer 2 research uses frozen profile snapshot + frozen generic research.

Layer 1 research uses dataset_version as its "snapshot" equivalent.


D.3 Missing Data Handling

If critical data missing:

Research status:

partial

Some research blocked
Some allowed


Layer 1 minimum requirements:
- Visa research: destination
- Cost research: destination
- Legal research: destination

Layer 2 minimum requirements:
- Visa research: destination + citizenship (from profile snapshot)
- Cost research: destination (profile optional for user-specific cost analysis)
- Legal research: destination + citizenship

If Layer 1 prerequisite is missing or failed, Layer 2 MUST NOT proceed.
If Layer 2 profile fields are insufficient, status = partial with available analysis only.


============================================================
E. RESEARCH OUTPUT CONTRACT
============================================================

Output format:

STRUCTURED JSON


Payload contains:

facts
analysis
eligibility
requirements
confidence_score
sources
generated_at


Minimum required fields:

destination
research_type
version
timestamp
payload


Output is deterministic relative to same snapshot and dataset version.


Research output is INTERNAL intelligence layer.

Not user-facing directly.


============================================================
F. VISA RESEARCH SPECIFICS
============================================================

Visa research produces:

Eligibility analysis
Requirements
Visa options
Rejection risk estimation
Processing time
Application complexity


Output includes interpretation.

Not raw facts only.


Eligibility is PROBABILISTIC:

eligible
likely eligible
uncertain
unlikely eligible
not eligible


Research provides all options.

Recommendation selects best option.


============================================================
G. COST RESEARCH SPECIFICS
============================================================

Cost Research produces:

Raw cost datasets

Housing costs
Food costs
Transport costs
Healthcare costs


Cost research does NOT calculate affordability.

Affordability = separate system.


Cost datasets are versioned.


============================================================
H. LEGAL RESEARCH SPECIFICS
============================================================

Produces:

Residency laws
Registration requirements
Tax obligations
Healthcare registration requirements


Updated:

Scheduled refresh
Manual update
Admin override


Legal research has:

valid_until field


Expired research must refresh.


============================================================
I. VERSIONING & PERSISTENCE
============================================================

Research outputs stored permanently.

Never overwritten.

New version created when:

Profile snapshot changes
Dataset changes
Legal update


Old versions always readable.


Supports full audit:

System can reconstruct exact intelligence used at any time.


============================================================
J. CACHE & FRESHNESS
============================================================

Layer 1 (Generic) validity periods:

Visa research: 30 days
Cost research: 90 days
Legal research: 30 days
Housing research: 90 days
Healthcare research: 90 days

Layer 1 invalidation triggers:
- valid_until expiration → automatic refresh via scheduled trigger
- external_data.refreshed event (new dataset_version available)
- Admin manual refresh

Layer 2 (User-Specific) validity:

Layer 2 research is valid as long as:
- Its referenced generic_research_id is still valid (Layer 1 not expired)
- Its profile_snapshot_id matches the plan's current profile version
- No relevant profile fields have changed since the snapshot

Layer 2 invalidation triggers:
- Profile change → new profile_version_id created → old Layer 2 research becomes stale
- Destination change → new Layer 1 + Layer 2 required
- Visa type change → new Layer 2 required (Layer 1 may be reused)
- Layer 1 refresh → Layer 2 MAY need regeneration if generic facts changed materially

Staleness detection:
- Layer 2 research references generic_research_id; if that Layer 1 record's valid_until has passed, Layer 2 is also considered stale.
- Staleness is checked at read time (lazy) and on scheduled sweep (proactive).


============================================================
K. RELATIONSHIP TO GUIDE SYSTEM
============================================================

Guide uses RESEARCH SNAPSHOT.

Guide is generated from specific research version.

Guide does NOT update automatically.

Plan lock freezes guide.


============================================================
L. RELATIONSHIP TO RECOMMENDATION SYSTEM
============================================================

Recommendation requires research.

Cannot exist without research.

Recommendation uses research snapshot.

Never live research.


============================================================
M. ASYNC BEHAVIOR & UX
============================================================

States:

not_started
pending
running
completed
failed
partial


User sees:

loading state


Completion:

Auto refresh
Notification


============================================================
N. FAILURE HANDLING
============================================================

Failures:

network
timeout
data error


Retry:

automatic retry
max retries: 3


Partial allowed.


============================================================
O. DEDUPLICATION
============================================================

Layer 1 (Generic) duplicate prevention key:

(research_type, destination, dataset_version)

If valid generic research exists for this key: reuse existing (no regeneration).

Layer 2 (User-Specific) duplicate prevention key:

(research_type, destination, visa_type, profile_snapshot_id)

If job exists for this key: reuse existing (no regeneration).


Concurrency safe:
- Layer 1: UNIQUE constraint on (research_type, destination, dataset_version) prevents duplicate generic research.
- Layer 2: UNIQUE constraint on (research_type, destination, visa_type, profile_snapshot_id, version) prevents duplicate user research.
- Concurrent requests for the same key return the existing record or in-progress job.


============================================================
P. DEPENDENCIES
============================================================

Internal:

Plan System
Profile System
Recommendation System
Guide System


External:

Visa providers
Legal providers
Cost providers


Dependency failure:

Research fails
Status = failed


============================================================
Q. JOB EXECUTION MODEL
============================================================

Executed by:

Worker system


Job contains:

job_id
research_type
snapshot
status
result


State machine:

pending
running
completed
failed


============================================================
R. SOURCE OF TRUTH
============================================================

Research is NOT user data authority.

Research IS relocation intelligence authority.


============================================================
S. PRIVACY & ISOLATION
============================================================

Layer 1 (Generic research):
- Shared across all users and plans for the same destination.
- Contains NO personal data, NO user identifiers, NO plan identifiers.
- May be pre-populated for popular destinations without any user request.
- Deletion: retained even when individual users delete accounts (no PII present).

Layer 2 (User-specific research):
- Isolated per user AND per plan (via plan_id + profile_snapshot_id).
- Contains user-specific analysis derived from personal profile data.
- MUST be deleted or anonymized on GDPR delete request.
- Cross-plan isolation: a user's research for Plan A MUST NOT reference or leak into Plan B.

Cross-layer isolation:
- Layer 2 references Layer 1 via generic_research_id pointer only.
- Layer 1 MUST NOT contain back-references to Layer 2 records.
- Deleting Layer 2 records does NOT affect Layer 1.


============================================================
T. AI INVOLVEMENT
============================================================

AI used for:

Eligibility analysis
Interpretation
Classification


AI output frozen per version.

Never regenerated automatically.


============================================================
U. SYSTEM LIFECYCLE
============================================================

Created:

When triggered

Updated:

Never updated
New version created

Deleted:

Never deleted

Archived:

Old versions archived permanently


============================================================
V. OBSERVABILITY
============================================================

Logs:

input snapshot id
execution time
result
failure reason


Metrics:

execution time
failure rate


Debugging:

Research jobs replayable.

============================================================
W. CROSS-SYSTEM REFERENCES
============================================================

Upstream (triggers research):
- Plan System (plan-system.md) — plan.destination_changed, plan.destination_set, plan.created
- Profile System (profile-system.md) — profile.version_created
- Event/Trigger System (event-trigger-system.md) — domain event routing
- Data Update System (data-update-system.md) — cascade orchestration, job scheduling

Downstream (consumes research):
- Recommendation System — requires completed Layer 2 research before generating recommendations
- Guide Generation System (guide-generation.md) — uses research snapshot as input
- Timeline System — uses research for visa processing time estimates
- Local Requirements System — uses Layer 2 research for applicable requirements
- Cost Calculation System — uses Layer 1 cost research + Layer 2 user-specific cost analysis
- Dashboard System — displays research status and freshness

Shared contracts:
- Profile versioning: profile_version_id defined in profile-system.md Section G
- Event taxonomy: research.completed and research.failed defined in event-trigger-system.md Section C.2
- Data Update DAG: research is an early DAG node; Recommendations depend on Research (data-update-system.md Section G)
- Current pointer: plan.current_research_id (if used) follows the pointer model in event-trigger-system.md Section F.0

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Plan System | PARTIAL |
| Profile System | PARTIAL |
| Event Trigger System | NOT_IMPLEMENTED |
| Data Update System | NOT_IMPLEMENTED |
| Recommendation System | MINIMAL |
| Guide Generation System | PARTIAL |
| Timeline System | NOT_IMPLEMENTED |
| Local Requirements System | NOT_IMPLEMENTED |
| Cost of Living System | PARTIAL |
| Dashboard System | PARTIAL |


============================================================
X. SYSTEM INVARIANTS
============================================================

Invariant 1: Generic research (Layer 1) MUST NOT contain personal data.
Invariant 2: User-specific research (Layer 2) MUST always reference a generic_research_id.
Invariant 3: Research outputs are immutable at both layers.
Invariant 4: Research generation is idempotent per layer-specific unique key.
Invariant 5: Layer 2 MUST NOT proceed if Layer 1 prerequisite is missing or failed.
Invariant 6: Research is deterministic relative to the same snapshot + dataset version.
Invariant 7: All downstream systems consume research via version pointer, never live research.


============================================================
END OF DEFINITION
============================================================
