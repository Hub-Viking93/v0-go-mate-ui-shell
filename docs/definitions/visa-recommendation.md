# GoMate — Visa Recommendation Module (Recommendation System: visa_route)

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Visa recommendation exists but is split across three incompatible
  implementations:
  1. Interview-time: the chat collects visa-relevant fields and the LLM
     provides informal guidance inline
  2. Guide generation: the guide pipeline generates visa analysis as part of
     the guide content (not a separate artifact)
  3. Web research: Firecrawl scrapes visa information that feeds into the
     guide pipeline
- No unified visa recommendation artifact, no visa_recommendations table,
  no recommendations_current pointer
- No profile_version_id binding, no input_hash deduplication
- No confidence scoring, no ranked alternatives, no eligibility_factors array
- Consolidation of the three implementations is explicitly deferred (see
  CLAUDE.md "Out of Scope for v1")

V1 Deviations from Canonical Spec:
- Section A.3 (output schema): NOT_IMPLEMENTED — no structured visa
  recommendation output with confidence_score, alternatives, eligibility_factors,
  assumptions, or source_references
- Section B (lifecycle & triggers): NOT_IMPLEMENTED — no regeneration triggers,
  no major/minor classification, no cooldown guards
- Section D (storage): NOT_IMPLEMENTED — no stored recommendation snapshots;
  visa analysis lives inside guide output
- Section E (versioning): NOT_IMPLEMENTED — no version history, no pointer
- Section H.3 (event taxonomy): NOT_IMPLEMENTED — no recommendation events
  emitted

V1 Cross-Reference Adjustments:
- Parent System (Recommendation System): also minimal in v1 — see
  recommendation-system.md V1 Scope Block
- Profile versioning: does not exist
- Research two-layer model: does not exist — single Firecrawl pass
- Event System: no events emitted for visa recommendations
- Guide coupling: inverted from spec — visa analysis is generated as part of
  the guide, not consumed by the guide as a frozen input

V1 Fallback Behavior:
- Visa guidance is embedded in the generated guide content
- Users cannot view visa recommendation independently from the guide
- No alternative visa paths presented as selectable options
- No stale/refresh mechanism for visa recommendations

============================================================

## Module Positioning

The Visa Recommendation Module is a SUBSYSTEM of the Recommendation System (recommendation-system.md).
It implements recommendation_type = visa_route.
It is NOT an independent system.

Ownership boundary:
- Recommendation System owns: snapshot contract, current pointer semantics (recommendations_current), versioning, idempotency, lifecycle states, event emission.
- This module owns: visa-specific decision logic, eligibility factor schema, ranking criteria, visa catalog reference, safety constraints for visa claims.

Data model:
- Visa recommendations are stored as standard Recommendation snapshots (same table, same schema).
- Visa-specific fields (eligibility_factors, assumptions, sources, rejected_options) are embedded into the standard snapshot shape as a namespaced payload block.
- The recommendations_current pointer row selects the "current visa route" per (plan_id, destination_key, recommendation_type=visa_route).

---

The Visa Recommendation module produces the canonical, versioned, deterministic eligibility and recommendation artifact for a user's relocation plan.

It is a RULE-BOUND, SNAPSHOT-BASED, VERSIONED artifact.

It NEVER reads live mutable profile data.

It NEVER exists only in UI.

It ALWAYS exists as a stored Recommendation snapshot.

---

# A. PURPOSE, ROLE & OUTPUT CONTRACT

---

## A.1 Core Purpose

Visa Recommendation uses a HYBRID MODEL:

It produces:

1) One PRIMARY recommendation

2) Ranked ALTERNATIVES

3) Explicitly REJECTED or UNSAFE options

4) Explicit ELIGIBILITY FACTORS

5) Explicit ASSUMPTIONS

This allows user to:

- understand best visa path
- understand alternatives
- understand risks
- understand why

---

## A.2 Decision Authority Level

Recommendation is:

ADVISORY and OPINIONATED

It MUST recommend a best option IF safe to do so.

It MAY produce:

NO_SAFE_RECOMMENDATION

if insufficient data or unsafe conclusion.

It MUST NEVER imply approval or guarantee.

---

## A.3 Output Schema Contract

Primary recommendation REQUIRED fields:

visa_type_id

visa_title

confidence_score (0–1)

confidence_label (High / Medium / Low)

eligibility_status:

Likely Eligible

Uncertain

Likely Not Eligible

reasoning_summary

why_recommended

risks_and_limitations

---

Alternatives REQUIRED:

alternative_visa_list[]

Each includes:

visa_type_id

visa_title

rank

why_not_primary

key_tradeoffs

---

Eligibility Factors REQUIRED:

eligibility_factors[]

factor_name

user_value

impact

confidence

---

Assumptions REQUIRED:

assumptions[]

field_name

assumed_value

assumption_reason

---

Sources REQUIRED:

source_references[]

source_name

source_url

source_type

reliability_score

---

## A.4 Completeness Requirement

Recommendation INVALID if:

no primary recommendation AND no explicit NO_SAFE_RECOMMENDATION

confidence_score missing

reasoning missing

---

## A.5 Determinism & Reproducibility

Recommendation MUST be deterministic.

Determinism guaranteed using:

profile_version_id

rules_version

generator_version

input_hash

Same input_hash MUST produce identical output.

---

# B. TIMING, LIFECYCLE & TRIGGERS

---

## B.1 First Creation Timing

Visa Recommendation uses HYBRID timing:

Draft Recommendation:

generated AFTER interview complete

Final Recommendation:

generated AFTER profile confirmed

Guide generation requires final recommendation.

---

## B.2 Mandatory Preconditions

Required fields:

citizenship_country

destination_country

relocation_purpose

intended_duration

financial_support OR income

Without these:

recommendation BLOCKED

---

## B.3 Automatic Regeneration Triggers

Visa recommendation follows the Recommendation System major/minor classification (recommendation-system.md J.4):

MAJOR changes (candidate generated, user confirmation required for pointer update):
- destination_country changes (plan.destination_changed)
- citizenship_country changes (fundamental eligibility shift)
- purpose changes (e.g., study → work — different visa categories)

MINOR changes (auto-regenerate + auto-advance current allowed):
- duration changes (refines existing recommendation, does not change category)
- income changes (affects affordability confidence, not eligibility class)
- employment status changes (may refine but rarely changes primary path)

On any trigger, current recommendation marked STALE until regeneration completes

---

## B.4 Forbidden Automatic Triggers

Recommendation MUST NOT regenerate automatically on:

dashboard open

chat open

UI refresh

unrelated profile change

---

## B.5 Manual Refresh

Manual refresh allowed.

CTA:

Refresh Recommendation

Behavior:

Creates NEW version

Old version archived.

---

## B.6 Regeneration Guards

Cooldown:

minimum 30 seconds between regenerations

Maximum:

5 regenerations per profile version

Idempotency enforced via input_hash

---

## B.7 Audit Logging

Every generation logs:

plan_id

profile_version_id

trigger_actor

trigger_source

timestamp

generator_version

input_hash

---

# C. INPUT CONTRACT & PRECEDENCE

---

## C.1 Snapshot Requirement

Recommendation MUST use immutable profile snapshot:

profile_version_id

NEVER live profile.

---

## C.2 Mandatory Fields

Required categories:

Identity:

citizenship_country

Destination:

destination_country

Intent:

purpose

duration

Financial:

income OR savings

---

## C.3 Optional Fields

Optional fields increase confidence:

job_offer

education

language

employment_status

---

## C.4 Missing Data Handling

If mandatory fields missing:

generation BLOCKED

System returns:

INSUFFICIENT_DATA status

---

## C.5 Inferred Data Handling

If inferred data used:

assumption entry REQUIRED

confidence score reduced

---

## C.6 Precedence Rules

Priority:

Confirmed user data

User entered data

Inferred data

Assumed data

---

# D. DISPLAY & SOURCE OF TRUTH

---

## D.1 Storage Location

Visa recommendations stored in the standard recommendations table (recommendation-system.md Section L).
Filtered by: recommendation_type = "visa_route"

Current Implementation Alignment Note:
If a legacy visa_recommendations table exists, it is an alignment concern. The canonical storage is the unified recommendations table with recommendation_type=visa_route. Migration should consolidate to the unified table.

Linked via:

plan_id
profile_version_id (via profile_snapshot_hash)
destination_key

---

## D.2 Display Locations

Dashboard

Guide

Chat reference

Visa detail UI

---

## D.3 Canonical Source Rule

Recommendation MUST exist as artifact.

Chat MUST NOT recompute recommendation.

Dashboard MUST NOT recompute recommendation.

Guide MUST reference stored artifact.

---

## D.4 Consistency Guarantee

All systems read same artifact.

No divergence allowed.

---

## D.5 Stale Handling

If profile changes:

recommendation marked:

STALE

UI MUST display:

Stale badge

Refresh CTA

---

# E. VERSIONING & DUPLICATE PROTECTION

---

## E.1 Artifact Identity

Unique key:

recommendation_id

plan_id

profile_version_id

version_number

---

## E.2 Versioning Model

Every generation creates NEW version.

Never overwrite.

---

## E.3 Canonical Pointer

Canonical pointer: recommendations_current table row per (plan_id, destination_key, recommendation_type=visa_route).

This is the sole authoritative selector for the current visa recommendation.

Current Implementation Alignment Note:
If plan.current_recommendation_id or a plan.current_visa_recommendation_id column exists, the recommendations_current table row takes precedence. Legacy pointers are alignment concerns, not canonical.

---

## E.4 Duplicate Prevention

Database constraint:

UNIQUE(plan_id, profile_version_id, input_hash)

Prevents duplicate generation.

---

## E.5 Stale vs Current

Only ONE current recommendation per profile version.

Others marked:

ARCHIVED

---

## E.6 Historical Access

User MAY view old recommendations.

Read-only.

---

# F. UX INTERACTION MODEL

---

## F.1 Primary Recommendation Display

UI MUST show:

recommended visa

confidence

explanation

risks

---

## F.2 Alternative Display

Alternatives shown ranked.

With explanation.

---

## F.3 Assumptions Display

Assumptions MUST be visible.

User may correct assumptions.

---

## F.4 User Override

User may choose different visa path.

Override stored separately.

Canonical recommendation remains unchanged.

---

## F.5 Confidence UX

Confidence displayed as:

High

Medium

Low

Low confidence triggers:

Improve profile CTA

---

# G. ERRORS & SAFETY

---

## G.1 No Recommendation State

Supported state:

NO_SAFE_RECOMMENDATION

Reasons shown:

insufficient data

unsupported scenario

---

## G.2 Messaging Rules

System MUST use:

"Based on your information"

System MUST NOT use:

"You qualify"

---

## G.3 Legal Disclaimer

Recommendation labeled:

Informational only.

---

## G.4 Hallucination Protection

Only visa_type_id from official dataset allowed.

Never invent visas.

---

## G.5 Failure Handling

Failure state:

FAILED

Retry allowed.

---

# H. SYSTEM INTEGRATION

---

## H.1 Upstream Dependencies

profile snapshot

visa dataset

rules engine

---

## H.2 Downstream Consumers

Guide generation

Checklist generator

Dashboard

Chat advisory

---

## H.3 Trigger Events (Normalized to Event System Taxonomy)

Visa recommendation lifecycle events use the standard Recommendation System event names:
- recommendation.generated (payload: recommendation_type = "visa_route", recommendation_id, plan_id, profile_version_id)
- recommendation.failed (payload: recommendation_type = "visa_route", error_code)
- recommendation.superseded (payload: recommendation_type = "visa_route", superseded_by)
- recommendation.selected_current (payload: recommendation_type = "visa_route", recommendation_id)
- recommendation.outdated (optional: recommendation_type = "visa_route")

DEPRECATED event names (MUST NOT be used):
- visa_recommendation_created → use recommendation.generated
- visa_recommendation_failed → use recommendation.failed
- visa_recommendation_stale → use recommendation.outdated

Cross-reference: event-trigger-system.md Section C.2, recommendation-system.md Section V.4

---

## H.4 Downstream Invalidation

New visa recommendation (recommendation.selected_current with type=visa_route) triggers:

- Guide: marked STALE via guide.outdated event (guide NEVER auto-regenerates — see guide-generation.md C.2)
- Checklist: MAY trigger checklist.regenerate_requested if checklist depends on visa type
- Dashboard: refreshes "Your path" card for visa route
- Timeline: MAY trigger timeline recalculation if visa processing time changed

---

# I. DATA MODEL

---

Visa recommendations are stored as standard Recommendation snapshots (recommendation-system.md Section L).
The following fields are the standard Recommendation identity + linkage fields:

recommendation_id (UUID — snapshot id)
recommendation_type = "visa_route" (enum — always visa_route for this module)
plan_id (UUID)
user_id (UUID)
destination_key (string)
profile_snapshot_hash (string)
research_bundle_id (UUID, nullable)
ruleset_version (string, SEMVER)
engine_version (string)
generator_version (string)
input_hash (string)
created_at (timestamptz)

Visa-specific fields (embedded in snapshot payload):

primary_visa_type_id (string — canonical visa catalog reference)
confidence_score (float 0–1)
confidence_label (enum: High | Medium | Low)
eligibility_status (enum: Likely Eligible | Uncertain | Likely Not Eligible)
reasoning_summary (text)
why_recommended (text)
risks_and_limitations (text)
alternatives (JSONB array — ranked alternative visa options)
eligibility_factors (JSONB array — factor_name, user_value, impact, confidence)
assumptions (JSONB array — field_name, assumed_value, assumption_reason)
source_references (JSONB array — source_name, source_url, source_type, reliability_score)
rejected_options (JSONB array — visa types explicitly rejected with reasons)

Current pointer: managed by recommendations_current row per (plan_id, destination_key, recommendation_type=visa_route).

Current Implementation Alignment Note:
If a legacy plan.current_visa_recommendation_id pointer exists in the implementation, it is an alignment concern. The canonical pointer is the recommendations_current table row. Both may coexist during migration but recommendations_current is authoritative.

---

# J. EXECUTION CONTRACT

---

## J.1 Engine Input

profile snapshot

visa dataset

rules_version

---

## J.2 Engine Output

strict schema only

No uncontrolled text

---

## J.3 Validation

Output validated before storage.

Invalid rejected.

---

## J.4 Generator Version

generator_version stored

Ensures reproducibility

---

# K. CROSS-SYSTEM REFERENCES

---

## K.1 Parent System
- Recommendation System (recommendation-system.md) — owns snapshot contract, pointer semantics, versioning, lifecycle states, event emission

## K.2 Upstream Dependencies
- Profile System (profile-system.md) — profile_version_id snapshot with citizenship, purpose, duration, income
- Research System (research-system.md) — visa_research (Layer 1 generic visa categories + Layer 2 user-specific eligibility analysis)
- Event/Trigger System (event-trigger-system.md) — domain event routing

## K.3 Downstream Consumers
- Guide Generation System (guide-generation.md) — uses frozen visa recommendation snapshot; recommendation pointer change marks guide STALE
- Timeline System — uses visa processing time estimates for phase planning
- Task/Checklist System — uses recommended visa type for document requirements
- Local Requirements System — uses visa type for administrative requirement filtering
- Dashboard System — displays visa path card

## K.4 Shared Contracts
- Event taxonomy: recommendation.generated with recommendation_type=visa_route (event-trigger-system.md C.2)
- Major/minor classification: recommendation-system.md J.4
- Research two-layer model: research-system.md A.5
- Profile versioning: profile-system.md Section G

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Recommendation System | MINIMAL |
| Profile System | PARTIAL |
| Research System | PARTIAL |
| Event Trigger System | NOT_IMPLEMENTED |
| Guide Generation System | PARTIAL |
| Timeline System | NOT_IMPLEMENTED |
| Settling-in Tasks | PARTIAL |
| Local Requirements System | NOT_IMPLEMENTED |
| Dashboard System | PARTIAL |

---

# SYSTEM INVARIANTS

Invariant 1:

Visa recommendation bound to immutable profile snapshot (profile_version_id)

Invariant 2:

Visa recommendation never overwritten — new generation creates new snapshot

Invariant 3:

Visa recommendation deterministic — same input_hash produces identical output

Invariant 4:

Visa recommendation exists only as stored Recommendation snapshot artifact

Invariant 5:

Visa recommendation idempotent — UNIQUE(plan_id, profile_version_id, input_hash) prevents duplicates

Invariant 6:

Visa recommendation uses standard Recommendation System event taxonomy (no parallel event names)

Invariant 7:

Visa recommendation pointer change marks dependent guide as STALE

---

# END OF DEFINITION