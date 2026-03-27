============================================================
GOMATE — COST OF LIVING SYSTEM DEFINITION
CANONICAL SYSTEM SPECIFICATION (FINAL)
============================================================

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Cost of living data is sourced via two independent paths:
  1. Numbeo scraper (`lib/gomate/numbeo-scraper.ts`): city-level API data
     exposed via `GET /api/cost-of-living`, including comparison mode
  2. Simplified cost helpers in `lib/gomate/web-research.ts`: synchronous
     country-level estimates used for chat/guide budget calculations
- No cost_of_living artifact table, no versioned cost snapshots
- No profile-adjusted personalization engine — cost estimates are generic
  city-level data, not adjusted for household size, lifestyle, or housing
  preference
- Structured range data exists partially:
  - Numbeo API responses include estimated monthly budgets for
    `single`, `couple`, and `family4`
  - `web-research.ts` calculates `minimum` and `comfortable` budgets
  - there is still no canonical personalized
    `minimum/recommended/comfortable` artifact
- Comparison exists on `GET /api/cost-of-living` via `compareFrom` query
  parameters
- No currency conversion system

V1 Deviations from Canonical Spec:
- Section A (personalized estimate): PARTIAL — city-level baseline exists
  via Numbeo scraping, but no profile-based adjustment engine
- Section B (data model): NOT_IMPLEMENTED — no cost_of_living table, no
  structured artifact with category breakdowns
- Section C (generation triggers): NOT_IMPLEMENTED — cost data scraped
  on request or computed in helper functions, not triggered by domain events
- Section D (multi-level range): PARTIAL — multiple budget tiers exist in
  helper/API output, but not as one canonical personalized artifact with a
  `recommended` tier
- Section E (profile adjustment): NOT_IMPLEMENTED — no adjustment factors
  for household, lifestyle, or housing preference
- Section F (comparison): PARTIAL — comparison endpoint exists, but it is
  transient API output rather than a persisted artifact
- Section G (currency): NOT_IMPLEMENTED — no currency conversion

V1 Cross-Reference Adjustments:
- Profile System: cost preferences can be saved to `profile_data`, but
  they do not drive canonical personalized estimates
- Research System: Numbeo scraping exists as a direct API/data fetch path,
  not a canonical cost artifact pipeline
- Guide Generation: guide budget sections are deterministic calculations,
  not a separate persisted cost artifact consumed by the guide
- Event System: does not exist — no triggers for cost data refresh
- Data Update System: does not exist — no cascade invalidation

V1 Fallback Behavior:
- Cost awareness: `GET /api/cost-of-living` returns city-level cost data
  and comparison responses on demand
- Cost display: booking/planning surfaces can fetch structured API output,
  while guide/chat use separate helper models
- No dedicated cost-of-living app page exists yet

============================================================


============================================================
A. PURPOSE, DEFINITION & SCOPE BOUNDARIES
============================================================


A.1 Core Definition (Canonical Positioning)

In GoMate, Cost of Living represents:

A HYBRID PERSONALIZED MONTHLY RELOCATION COST ESTIMATE.

It is explicitly defined as:

A personalized, profile-adjusted estimate of the realistic monthly cost required for the user to live in the selected destination city, expressed as a range representing minimum viable, recommended realistic, and comfortable living levels.

The Cost of Living artifact combines:

1. Base City Cost Baseline  
   Statistical cost baseline at the city level derived from verified structured sources.

2. Profile-Adjusted Personalized Estimate  
   Adjustment of baseline based on user household structure, housing preference, and lifestyle assumptions.

3. Multi-Level Cost Range  
   Presented as three tiers:

   - minimum_estimate → minimum viable legal and functional living
   - recommended_estimate → realistic expected cost for stable relocation (CANONICAL DEFAULT)
   - comfortable_estimate → cost supporting higher comfort and financial buffer


It is NOT:

- a generic average only
- not minimum survival only
- not comfortable estimate only
- not fully speculative

It is a structured hybrid model with profile-adjusted realism.


This positioning is CANONICAL and must remain invariant.


A.1.1 System Independence (Architectural Positioning)

Cost of Living is an INDEPENDENT artifact system.
It is NOT a specialization or subsystem of the Research System.

Ownership boundary:
- Research System (research-system.md) owns: raw cost datasets and destination-level cost facts (cost_research research_type).
- Cost of Living System owns: personalized monthly estimates (minimum/recommended/comfortable), category breakdown, confidence model, and the persisted cost_of_living artifact.

Relationship:
- Cost of Living MAY consume cost_research output from the Research System as one input source.
- Cost of Living also has its own direct data sources (Numbeo, OECD, national statistics — see C.1).
- Cost of Living artifacts MUST NOT be stored inside research payloads.

Artifact separation:
- cost_research = intelligence artifact (what things cost in destination X — raw data)
- cost_of_living = calculated artifact (what it costs THIS USER to live in destination X — personalized estimate)




A.2 Primary Purpose

Cost of Living exists to answer these core relocation feasibility questions:

Primary:

- Can the user afford relocation to the destination?
- How much monthly income is realistically required?
- What monthly budget is recommended?

Secondary:

- Which cost categories dominate total budget?
- What financial preparation is required?

Cost of Living is the PRIMARY FINANCIAL FEASIBILITY ARTIFACT in GoMate.




A.3 Scope Coverage

Cost of Living includes ONLY recurring monthly costs.


Included Categories (Canonical):

HOUSING:

- rent
- utilities

FOOD:

- groceries
- eating out

TRANSPORT:

- public transport
- car ownership estimate (only if profile indicates likely usage)

HEALTHCARE:

- mandatory health insurance (if applicable)
- average out-of-pocket healthcare costs

ADMINISTRATIVE (high-level only):

- tax estimate (only if reliable data exists)
- social contributions estimate (optional)

LIFESTYLE:

- phone
- internet
- discretionary spending baseline


Excluded Categories (Explicitly OUT OF SCOPE):

- one-time relocation costs
- visa fees
- flights
- deposits
- moving costs
- furniture setup
- legal fees

These belong to separate systems.




A.4 Geographic Resolution

Canonical geographic resolution level:

CITY LEVEL

City is the required primary geographic anchor.


Fallback hierarchy:

Level 1: City  
Level 2: Metropolitan region  
Level 3: Country level  


Fallback must reduce confidence score.

City level is ALWAYS preferred.

District-level support is FUTURE EXTENSION only.




============================================================
B. IDENTITY, OWNERSHIP & UNIQUENESS MODEL
============================================================


B.1 Artifact Definition

Cost of Living exists as independent artifact:

cost_of_living_id

It is a persisted immutable snapshot artifact.




B.2 Ownership Model

Cost artifact belongs to:

plan_id
profile_version_id
destination_city

It does NOT belong globally to user.

It belongs to specific relocation scenario.




B.3 Unique Constraint (Database Level)

Database MUST enforce:

UNIQUE(plan_id, profile_version_id, destination_city, version_number)

This prevents duplicate versions.




B.4 Snapshot Model

Cost artifact is immutable snapshot bound to:

profile_version_id (UUID — the profile snapshot used for personalization)
data_version_id (string — identifies the external dataset version used for base costs)
cost_research_id (UUID, nullable — if cost_research from Research System was used as input)
generator_version (string — the cost calculation engine version)
calculated_at (timestamptz)

These pointers enable:
- Exact reproduction of the cost estimate from the same inputs
- Staleness detection (comparing stored data_version_id vs current available dataset)
- Audit trail (which data sources and profile were used)

Snapshot never mutates.




B.5 Canonical Pointer

Plan MUST store:

current_cost_of_living_id

This defines active version.




============================================================
C. DATA SOURCES, SOURCE PRIORITY & VALIDATION
============================================================


C.1 Allowed Data Sources

Allowed Primary Sources:

Internal Curated Cost Database (PRIMARY SOURCE)

External Verified APIs:

- Numbeo
- OECD datasets
- National statistical agencies
- Eurostat
- Government cost datasets

Allowed Secondary:

Historical cached internal data

Allowed Tertiary:

AI transformation layer

AI is NEVER allowed as primary raw source.




C.2 Source Priority Hierarchy

Strict precedence:

Priority 1:

Internal curated dataset

Priority 2:

External verified APIs

Priority 3:

Cached historical data

Priority 4:

AI estimation fallback




C.3 Source Conflict Resolution

Conflict resolution logic:

Priority 1 → highest

Otherwise:

Use weighted average based on:

source reliability weight
recency weight
confidence score




C.4 Data Freshness Metadata

Each cost component MUST store:

source
source_timestamp
confidence_score




C.5 Validation Rules

Cost calculation MUST FAIL if:

Missing housing data

OR

Confidence score below minimum threshold (0.6)

OR

Incomplete critical categories




============================================================
D. FETCH TRIGGERS & EXECUTION MODEL
============================================================


D.1 Allowed Automatic Triggers (domain events — see event-trigger-system.md C.2)

Cost generation is triggered by:

- plan.destination_set / plan.destination_changed — new destination requires full cost calculation (Level 1 resolve + Level 2 generate)
- profile.version_created — new profile snapshot may change personalization inputs (family_size, housing_preference, etc.)
- external_data.refreshed (dataset_type=cost) — new cost dataset available, Level 1 cache may be stale

Cost generation follows the Data Update System cascade (data-update-system.md). It is an automatic DAG node — NOT gated like guide generation.




D.2 Manual Trigger

User action:

Refresh Cost Estimate button




D.3 Forbidden Triggers

Cost fetch MUST NOT trigger on:

dashboard load

chat open

guide open




D.4 Execution Model

Cost generation MUST execute async via queue worker.

Never synchronous blocking.




D.5 Idempotency Protection

Generation MUST enforce:

UNIQUE(plan_id, profile_version_id, destination_city, version_number)




D.6 Audit Logging

Each generation MUST log:

trigger_source
data_sources_used
timestamp
generator_version




============================================================
E. CACHE STRATEGY & VALIDITY MODEL
============================================================


E.1 Cache Duration

Base city cache TTL:

30 days

Personalized cost TTL:

indefinite (snapshot-based)




E.2 Cache Levels

Level 1: Global City Cost Baseline Cache
- Destination-scoped, NOT plan-scoped.
- Shared across all users and plans for the same destination city.
- Contains only generic cost data (rent averages, grocery indices, transport costs).
- Contains NO personal data.
- Owned by the Cost of Living System (NOT by the Research System).
- Logically aligned with Research System Layer 1 (generic destination data) but managed independently.
- TTL: 30 days (see E.1).

Level 2: Personalized Cost Snapshot Cache
- Plan-scoped via profile_version_id + destination_city.
- Contains personalized cost estimates adjusted for household, lifestyle, preferences.
- Owned by the Cost of Living System.
- Logically aligned with Research System Layer 2 (user-specific) but stored as a separate artifact type.
- TTL: indefinite (snapshot-based — invalidated only by input changes).




E.3 Cache Invalidation

Invalidate personalized cache when:

destination_city changes

OR

profile_version changes




E.4 Cache Fallback

If fresh data unavailable:

Use cached version

Mark as:

STALE




E.5 Cache Priority

Valid cached data preferred over live fetch.

Never regenerate unnecessarily.




============================================================
F. PERSONALIZATION MODEL & PROFILE DEPENDENCIES
============================================================


F.1 Personalization Inputs

Allowed personalization inputs:

family_size

partner_status

children_count

housing_preference

income_level

lifestyle_preference

transport_preference




F.2 Calculation Model

Personalization formula:

personalized_cost =
baseline_city_cost × household_multiplier × housing_multiplier × lifestyle_multiplier




F.3 Missing Personalization Handling

If missing:

Fallback to:

single person baseline

confidence_score reduced




F.4 Confidence Score Calculation

Confidence determined by:

data completeness

source reliability

personalization completeness




F.5 Version Binding

Cost MUST bind to:

profile_version_id




============================================================
G. RELATIONSHIP TO GUIDE SYSTEM
============================================================


Guide MUST use:

specific cost_of_living_id snapshot

Guide NEVER uses live cost.




Cost update effect:

Guide becomes:

STALE

Guide NOT auto regenerated.




============================================================
H. RELATIONSHIP TO DASHBOARD
============================================================


Dashboard MUST read cost artifact.

Never compute cost independently.

Dashboard updates when:

new cost version created.

STALE flag must display.




============================================================
I. VERSIONING & HISTORY
============================================================


Each cost generation creates:

new version_number

Previous versions remain immutable.

current_cost_of_living_id defines canonical version.




============================================================
J. UX PRESENTATION CONTRACT
============================================================


Display MUST show:

minimum_estimate

recommended_estimate

comfortable_estimate


Display MUST show:

category breakdown

confidence score

STALE indicator if applicable

currency

conversion timestamp




============================================================
K. ERROR HANDLING MODEL
============================================================


Cost artifact supports states:

PENDING

GENERATING

COMPLETED

FAILED

STALE




Failure NEVER deletes prior version.

Retry generates new version.

Partial results NEVER shown.




============================================================
L. SYSTEM DEPENDENCIES & EVENTS
============================================================


Cost generation emits domain events (normalized to Event System taxonomy — see event-trigger-system.md C.2):

- cost.generated (payload: cost_of_living_id, plan_id, destination_city, data_version_id)
- cost.failed (payload: plan_id, destination_city, error_code)
- cost.outdated (payload: cost_of_living_id, reason — marks current estimate STALE)

Note: If a unified artifact event namespace is adopted (e.g., artifact.generated with artifact_type=cost), these names should be migrated accordingly. For now, cost-specific names are used.



Consumers:

Guide system

Dashboard

Budget recommendation system

Timeline planning system




============================================================
M. DATA MODEL CONTRACT
============================================================


Canonical Cost Artifact Schema:


cost_of_living_id (UUID)

plan_id (UUID)

profile_version_id (UUID — FK to profile snapshot)

destination_city (string)

version_number (int — sequential per unique key)

is_current (boolean — only one per plan may be true)

status (enum: PENDING | GENERATING | COMPLETED | FAILED | STALE)

minimum_estimate (numeric — minimum viable monthly cost)

recommended_estimate (numeric — realistic expected monthly cost, CANONICAL DEFAULT)

comfortable_estimate (numeric — comfortable monthly cost with buffer)

category_breakdown (JSONB — per-category costs: housing, food, transport, healthcare, etc.)

currency (string — ISO 4217 currency code)

fx_rate_used (numeric, nullable — if conversion applied)

fx_rate_timestamp (timestamptz, nullable)

confidence_score (float 0–1)

source_list (JSONB array — source name, URL, reliability, timestamp per data point)

data_version_id (string — external dataset version used)

cost_research_id (UUID, nullable — FK to Research System cost_research output, if used as input)

calculated_at (timestamptz)

generator_version (string)




============================================================
N. GENERATOR EXECUTION CONTRACT
============================================================


Input:

profile snapshot

destination city

source data




Output:

validated structured cost artifact




Validation:

schema validation

confidence threshold validation




Generator version MUST be stored.




============================================================
O. CROSS-SYSTEM REFERENCES
============================================================


O.1 Upstream (inputs to cost calculation)

- Profile System (profile-system.md) — profile_version_id snapshot with family_size, housing_preference, income_level, lifestyle
- Research System (research-system.md) — cost_research (Layer 1 generic cost data for destination, optional input)
- Event/Trigger System (event-trigger-system.md) — domain event routing: plan.destination_changed, profile.version_created
- Data Update System (data-update-system.md) — cascade orchestration; cost is a DAG node

O.2 Downstream (consumes cost output)

- Guide Generation System (guide-generation.md) — uses frozen cost_of_living_id snapshot; cost change marks guide STALE
- Recommendation System (recommendation-system.md) — budget_model recommendation consumes cost estimates
- Dashboard System — displays cost summary card with confidence and staleness indicators
- Timeline System — MAY use cost estimates for financial preparation milestones

O.3 Shared Contracts

- Profile versioning: profile_version_id defined in profile-system.md Section G
- Event taxonomy: cost.generated / cost.failed / cost.outdated (event-trigger-system.md)
- Guide staleness: cost change → guide.outdated (guide NEVER auto-regenerates — see guide-generation.md C.2)
- Research two-layer model: cost_research is a research_type in research-system.md; Cost of Living System is independent but may consume it
- Data Update DAG: cost is part of the artifact cascade (data-update-system.md Section G)

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Profile System (profile-system.md) | PARTIAL |
| Research System (research-system.md) | PARTIAL |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |
| Data Update System (data-update-system.md) | NOT_IMPLEMENTED |
| Guide Generation System (guide-generation.md) | PARTIAL |
| Recommendation System (recommendation-system.md) | MINIMAL |
| Dashboard System (dashboard.md) | PARTIAL |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |


============================================================
P. SYSTEM INVARIANTS
============================================================


Invariant 1: Cost artifact bound to immutable profile snapshot (profile_version_id)

Invariant 2: Cost artifact never overwritten — new generation creates new version

Invariant 3: Cost artifact is an independent system, NOT a subsystem of Research

Invariant 4: Level 1 city baseline cache shared across users (no personal data)

Invariant 5: Level 2 personalized estimate plan-scoped via profile_version_id

Invariant 6: Cost artifact stores all source version pointers (data_version_id, cost_research_id, generator_version)

Invariant 7: Partial results NEVER shown — generation either completes fully or fails

Invariant 8: Cost change marks dependent guide as STALE (guide NEVER auto-regenerates)


============================================================
END OF COST OF LIVING SYSTEM DEFINITION
============================================================

---

## v1 Alignment Note (GAP-007)

v1 implements 2 tiers (minimum, comfortable) instead of 3 (minimum, recommended, comfortable). The "recommended" tier can be derived as a midpoint if needed.

v1 categories differ from the definition:

| Definition Category | v1 Category |
|--------------------|-------------|
| housing | rent |
| food | food |
| transport | transportation |
| healthcare | healthcare |
| administrative | (not separate — included in other categories) |
| lifestyle | fitness, clothing |
| — | utilities, childcare |

v1 categories are more granular (8 vs 6) and more practical for user-facing budget breakdowns.

**Source:** `lib/gomate/web-research.ts` → `calculateMonthlyBudget()`
