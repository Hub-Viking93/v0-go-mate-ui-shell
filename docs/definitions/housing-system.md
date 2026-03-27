HOUSING SYSTEM — DEFINITIVE SYSTEM DEFINITION
GoMate Relocation Platform

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: NOT_IMPLEMENTED

V1 Implementation Reality:
- No housing system exists in the codebase
- No housing_recommendations table, no housing search, no housing tracking
- No housing-related UI pages or components
- Housing information may appear as prose within the generated guide content
  (e.g., "typical rent in [city]") but this is guide content, not a housing
  system
- Housing is classified as MISSING in docs/audit.md and explicitly deferred
  to v2

V1 Deviations from Canonical Spec:
- The entire spec (Sections A–N) describes a system that does not exist in v1
- No recommendation engine, no listing aggregation, no neighborhood analysis
- No housing budget calculator or affordability assessment
- No housing search integration with external platforms

V1 Cross-Reference Adjustments:
- Cost of Living: housing cost data exists via Numbeo scraping, but is not
  connected to any housing system
- Booking System: no accommodation bookings
- Profile System: housing preferences not collected in interview
- Timeline System: does not exist — no housing timeline items

V1 Fallback Behavior:
- Housing awareness: the generated guide may include general housing
  information as prose (neighborhood descriptions, typical rents, tips)
- No interactive housing features — users must research housing externally

============================================================


============================================================
A. PURPOSE, PRODUCT BOUNDARY & RESPONSIBILITY MODEL
============================================================


A.1 Core Purpose Definition


The Housing System is a planning, recommendation, and tracking system that helps users plan, identify, and track suitable housing arrangements required for relocation.

It is NOT a booking authority.

The Housing System has four primary roles:


PRIMARY ROLES:

1. Recommendation System

Provide personalized housing recommendations aligned with:

- destination
- budget
- family size
- relocation timeline
- relocation purpose


2. Planning System

Define and communicate housing strategy, including:

- temporary housing requirements
- permanent housing requirements
- when to secure housing


SECONDARY ROLE:

3. Search Assistant

Enable discovery of external housing via partner integrations.


SUPPORTING ROLE:

4. Tracking System

Track user's housing decisions and move-in status.



Explicitly NOT a role:

Booking platform.

GoMate never executes housing transactions.


A.1.1 System Independence (Architectural Positioning)

Housing System is an INDEPENDENT domain system.

It is NOT a recommendation_type within the Recommendation System (recommendation-system.md).
It is NOT a subsystem of the Booking System (booking-system.md).

Housing System independently owns:
- Housing Strategy artifact generation
- Housing Listing Recommendation artifact generation
- Housing confidence scoring
- Housing personalization model
- Housing lifecycle and versioning

Recommendation System relationship:
- Recommendation System MUST NOT generate housing listings/strategy as a generic recommendation_type.
- Recommendation System MAY consume Housing Strategy as input to other recommendations (e.g., timeline guidance).
- Recommendation System MAY surface Housing outputs as references in a unified recommendations feed, but canonical records remain Housing System artifacts.

Booking System relationship:
- Housing System is independent of Booking System for domain logic (recommendations, strategy, search).
- Housing System MUST materialize booking records in Booking System when housing is marked BOOKED (see Section E).
- Booking System does NOT own housing domain logic.

Cross-reference: recommendation-system.md (Housing is NOT a recommendation_type), booking-system.md A.1.1 (unified registry).



A.2 Legal & Commercial Responsibility Boundary


GoMate MUST NOT:

- Sign lease agreements
- Enter into housing contracts
- Act as legal housing intermediary
- Process payments
- Guarantee availability
- Represent housing providers legally


GoMate MUST:

- Provide recommendations
- Provide planning guidance
- Redirect users to external providers
- Allow tracking of user housing decisions


Legal responsibility always remains with the user and housing provider.



A.3 User Responsibility Model


User is solely responsible for:

- Selecting housing
- Verifying legitimacy
- Signing contracts
- Completing payments
- Completing housing process


GoMate responsibility is limited to:

- Planning support
- Recommendation generation
- Tracking state



A.4 Housing Planning Scope


Housing System exists to answer:


Strategic Questions:

Where should I live?

When should I secure housing?

Do I need temporary housing first?

What housing budget is realistic?

What housing type is suitable?



============================================================
B. HOUSING ENTITY MODEL & OWNERSHIP
============================================================


B.1 Housing Entity Definition


A Housing Entity represents a specific housing listing, housing outcome, or housing plan record.


Housing types supported:


TEMPORARY_HOUSING

PERMANENT_HOUSING

SHORT_TERM_RENTAL

LONG_TERM_RENTAL

SERVICED_APARTMENT

HOTEL

HOSTEL



B.2 Housing Artifact Identity


Each housing entity has:


housing_id (UUID)

Immutable identifier.



B.3 Ownership Model


Housing entities belong strictly to:


plan_id

profile_version_id


They do NOT belong globally to user.


Housing is always contextual to a relocation plan snapshot.



B.4 Housing Uniqueness Constraint


Database enforces:


UNIQUE(plan_id, profile_version_id, external_housing_id)



B.5 Housing Snapshot Model


Each housing entity stores:


provider_snapshot_timestamp


This preserves provider data consistency and prevents drift.



B.6 Housing Strategy Artifact


Housing Strategy is a separate artifact from housing listings.


Housing Strategy defines:


temporary_housing_required (boolean)

permanent_housing_required (boolean)

recommended_search_start_date

recommended_booking_window

recommended_temporary_duration

recommended_permanent_start_timing


Strategy is used for planning and guide generation.



============================================================
C. HOUSING RECOMMENDATION TRIGGERS & EXECUTION MODEL
============================================================


C.1 Allowed Automatic Triggers

Housing recommendations are triggered by domain events routed through the Event System (event-trigger-system.md C.2):

| Domain Event | Trigger Behavior |
|-------------|-----------------|
| plan.destination_set / plan.destination_changed | Destination defined/changed — full regeneration |
| cost.generated | New cost of living artifact — budget inputs updated |
| timeline.generated / timeline.regenerated | Timeline created/updated — timing inputs updated |
| profile.version_created | Profile version finalized — personalization inputs updated |

Manual triggers allowed:

- User clicks "Find Housing" → housing.search_requested event
- Admin triggers regeneration

Housing generation follows the Data Update System cascade (data-update-system.md). Housing is a DAG node downstream of: profile + cost_of_living + timeline.



C.2 Forbidden Automatic Triggers


Housing generation NEVER triggered by:


Dashboard load

Chat open

Guide open

UI refresh



C.3 Execution Mode


Housing recommendation generation is ALWAYS asynchronous.


Execution pipeline:


Event → Queue → Generator → Validation → Commit → Activate



C.4 Idempotency Protection


Idempotency enforced via:


hash(plan_id, profile_version_id, housing_type, generator_version)


Duplicates prevented.



C.5 Recommendation Refresh Triggers


Recommendations marked STALE and regenerated when:


destination changes

budget changes

family size changes

move date changes

cost_of_living changes



============================================================
D. RECOMMENDATION LOGIC & PERSONALIZATION MODEL
============================================================


D.1 Required Personalization Inputs


Housing recommendations MUST use:


destination_city

housing_budget_range

family_size

move_date

relocation_purpose



D.2 Optional Inputs


May use:


housing preferences

neighborhood preferences

employment location

commuting tolerance



D.3 Personalization Requirements


Recommendations MUST be personalized.


Generic recommendations allowed ONLY as fallback.


D.4 Recommendation Output Contract


Each housing recommendation MUST include:


housing_id

external_housing_id

title

provider

location

price

currency

housing_type

confidence_score

provider_url

provider_snapshot_timestamp



D.5 Confidence Score Definition


Confidence score reflects:


Profile completeness

Provider data quality

Budget match accuracy

Timeline match accuracy



Range:

0.0 to 1.0



D.6 Generic Fallback Behavior


If insufficient personalization:


System generates Housing Strategy only.

Housing listings may be omitted.



============================================================
E. BOOKING BOUNDARY & EXECUTION CONTRACT
============================================================


E.1 Booking Execution Model


All bookings occur outside GoMate.



E.2 Redirect Model


User redirected to:


external provider_url



GoMate does NOT execute booking.



E.3 Booking Confirmation Model

User manually marks housing as:

BOOKED

System never assumes booking.


E.3.1 Booking Materialization Requirement

When housing is marked as BOOKED, the Housing System MUST create or update a corresponding Booking record in the Booking System (booking-system.md).

Materialization contract:

- Housing System emits booking.confirmed domain event (Event System taxonomy)
- Booking record created in Booking System with booking_type = housing
- Booking System becomes the canonical registry entry for "does this housing booking exist?"
- Housing System remains authoritative for: housing-specific data, provider details, recommendation logic, housing lifecycle

The Booking record references:
- source_system = "housing"
- source_id = housing_id
- booking_type = housing_type (temporary_housing, long_term_rental, etc.)

Cross-reference: booking-system.md Section A.1.1 (unified registry positioning).



E.4 Booking Artifact Model


Booked housing stored as:


housing_status = BOOKED



E.5 Payment Handling


Payments NEVER handled by GoMate.



============================================================
F. TIMELINE SYSTEM INTEGRATION
============================================================


F.1 Timeline Relationship


Housing integrates with Timeline as:


Planning Milestones

and

Completion Milestones



F.2 Temporary vs Permanent Model


Temporary housing may precede permanent housing.


Permanent housing may depend on:


arrival

residence registration

local eligibility



F.3 Timeline Dependency Model


Housing strategy computed relative to:


move_date



Example:

Temporary housing: Move date − 0 days

Permanent housing: Move date + 30 days



F.4 Timeline Change Handling


Timeline change marks Housing:


STALE



F.5 Timeline Milestone Tracking


Timeline tracks:


HOUSING_SEARCH_START

TEMPORARY_HOUSING_BOOKED

PERMANENT_HOUSING_BOOKED

MOVE_IN_CONFIRMED



============================================================
G. RELATIONSHIP TO COST OF LIVING SYSTEM
============================================================


G.1 Dependency Direction


Housing System consumes Cost of Living System output.


Never produces cost data.



G.2 Budget Constraint Model


Housing budget derived from:


cost_of_living.housing_budget_range



G.3 Cost Integration Model


Housing System reads Cost of Living artifact snapshot.


Never recalculates cost.



G.4 Cost Change Handling


Cost changes invalidate housing recommendations.


Status becomes:

STALE



============================================================
H. RELATIONSHIP TO GUIDE SYSTEM
============================================================


H.1 Guide Dependency Model


Guide uses:


Housing Strategy snapshot only.



Never uses live housing listings.



H.2 Snapshot Binding


Guide stores:


housing_strategy_version_id



H.3 Guide Update Semantics


Housing changes DO NOT auto-update guide.


Guide regeneration required.



H.4 Guide Content Role


Guide includes:


Housing timing strategy

Temporary housing guidance

Permanent housing strategy



============================================================
I. UX, DISPLAY & USER INTERACTION CONTRACT
============================================================


I.1 Display Locations


Housing displayed in:


Housing Page

Dashboard

Timeline

Plan overview



I.2 Recommendation Display


Each recommendation shows:


price

location

provider

housing_type

confidence



I.3 Booked Housing Display


Booked housing clearly marked:


BOOKED



I.4 Temporary vs Permanent UI


Clear distinction enforced.



I.5 User Actions


User can:


View housing

Save housing

Mark housing BOOKED

Mark housing MOVED_IN



============================================================
J. HOUSING STATE MACHINE
============================================================


J.1 Housing Lifecycle States


RECOMMENDED

VIEWED

SAVED

BOOKED

MOVED_IN

STALE

ARCHIVED



J.2 State Authority


System creates:

RECOMMENDED


User creates:

SAVED

BOOKED

MOVED_IN



J.3 Transition Flow


RECOMMENDED → SAVED

SAVED → BOOKED

BOOKED → MOVED_IN



J.4 Immutable Data Rule


Housing listing immutable after:


BOOKED



============================================================
K. VERSIONING, UPDATE & REGENERATION MODEL
============================================================


K.1 Versioning Model


Housing artifacts versioned using:


version_number

generator_version

is_current



K.2 Regeneration Behavior


Regeneration creates new version only.


Never overwrite.



K.3 Duplicate Protection


Database enforces:


UNIQUE(plan_id, profile_version_id, housing_type, external_housing_id)



K.4 Stale Handling


Old versions marked:


STALE



K.5 Canonical Resolution


Plan stores:


current_housing_strategy_id



============================================================
L. ERROR HANDLING, FAILURE & FALLBACK MODEL
============================================================


Failure states:


FAILED


Fallback behavior:


Housing strategy generated

Housing listings omitted



Retry allowed.


Retry reuses idempotency key.



============================================================
M. DATA MODEL CONTRACT
============================================================


Housing Artifact:


housing_id

plan_id

profile_version_id

external_housing_id

housing_type

status

price

currency

location

provider

provider_url

confidence_score

provider_snapshot_timestamp

version_number

generator_version

created_at



Housing Strategy Artifact:


housing_strategy_id

plan_id

profile_version_id

temporary_required

permanent_required

recommended_search_start_date

recommended_temporary_duration

recommended_permanent_start_date

version_number

generator_version

created_at



============================================================
N. GENERATOR EXECUTION CONTRACT
============================================================


Input:


Profile snapshot

Destination

Cost of living artifact

Timeline artifact



Output:


Housing Strategy artifact

Housing listing artifacts



Validation:


Schema validation

Duplicate validation



Generator version always stored.



============================================================
O. CROSS-SYSTEM REFERENCES
============================================================


O.1 Upstream (inputs to housing generation)

- Profile System (profile-system.md) — profile_version_id snapshot with family_size, housing_preference, budget, move_date
- Cost of Living System (cost-of-living.md) — cost_of_living artifact for housing budget range (G.2)
- Timeline System (timeline-system.md) — timeline for move_date and housing timing strategy (F.3)
- Event/Trigger System (event-trigger-system.md) — domain event routing: plan.destination_set, cost.generated, profile.version_created
- Data Update System (data-update-system.md) — cascade orchestration; housing is a DAG node

O.2 Downstream (systems that consume housing data)

- Booking System (booking-system.md) — housing.booked materializes booking.confirmed record (E.3.1 booking materialization)
- Guide Generation System (guide-generation.md) — guide binds to housing_strategy_version_id snapshot (H.2); housing change marks guide STALE
- Timeline System (timeline-system.md) — housing milestones as timeline items (F.5)
- Dashboard System (dashboard.md) — housing status summary
- Notification System (notification-system.md) — housing reminders via timeline integration

O.3 Shared Contracts

- Booking materialization: booking-system.md A.1.1 (Housing System MUST materialize bookings when BOOKED)
- System independence: Housing is NOT a recommendation_type in Recommendation System (A.1.1)
- Event taxonomy: event-trigger-system.md Section C.2 (housing domain events)
- Guide staleness: housing change → guide.outdated (guide NEVER auto-regenerates — guide-generation.md C.2)
- Plan scoping: housing artifacts are plan-scoped via plan_id + profile_version_id
- Cost dependency: cost-of-living.md (housing budget derived from cost_of_living.housing_budget_range)

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Profile System (profile-system.md) | PARTIAL |
| Cost of Living System (cost-of-living.md) | PARTIAL |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |
| Data Update System (data-update-system.md) | NOT_IMPLEMENTED |
| Booking System (booking-system.md) | MINIMAL |
| Guide Generation System (guide-generation.md) | PARTIAL |
| Dashboard System (dashboard.md) | PARTIAL |
| Notification System (notification-system.md) | MINIMAL |


============================================================
P. SYSTEM INVARIANTS
============================================================


Invariant 1: Housing System is an INDEPENDENT domain system — NOT a recommendation_type in Recommendation System, NOT a subsystem of Booking System.

Invariant 2: When housing is marked BOOKED, a corresponding Booking record MUST be materialized in the Booking System (E.3.1).

Invariant 3: GoMate NEVER executes housing transactions — all bookings occur externally (E.1).

Invariant 4: Housing generation is NEVER triggered by dashboard load, chat open, or UI refresh (C.2).

Invariant 5: Housing artifacts are plan-scoped via plan_id + profile_version_id (B.3).

Invariant 6: Housing Strategy and Housing Listings are separate artifact types (B.6) — strategy for planning, listings for discovery.

Invariant 7: Housing change marks dependent guide as STALE — guide NEVER auto-regenerates (H.3).

Invariant 8: Regeneration creates new version only — never overwrites existing artifacts (K.2).


============================================================
END OF HOUSING SYSTEM DEFINITION
============================================================