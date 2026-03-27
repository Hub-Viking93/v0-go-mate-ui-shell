GoMate — Flight System Definition (Canonical System Specification)

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Flight search exists as a booking-page UI plus `/api/flights`
  (app/(app)/booking/page.tsx, app/api/flights/route.ts)
- User selects origin/destination airports via autocomplete, submits a
  search, and receives multi-source results from Skyscanner, Google
  Flights, Momondo, Kayak, and Kiwi
- Airport dataset is stored locally in lib/gomate/airports.ts and limited
  to the preloaded hub list used by the API
- Results are discovery/search artifacts only: scraped provider links,
  derived price/duration/stop data, and cheapest/fastest/best-value picks
- No flight data is stored in the database
- No flight tracking, no flight-linked timeline events
- No price tracking, booked-flight tracking, or timeline integration

V1 Deviations from Canonical Spec:
- Section A (planning tool + search assistant): PARTIAL — search and
  comparison exist, but results are scraped discovery links with weak
  quality guarantees and no persistence
- Section B (flight search): PARTIAL — `/api/flights` exists, but search
  is not plan-scoped, not persisted, and uses scraping rather than a
  canonical flight artifact model
- Section C (price tracking): NOT_IMPLEMENTED — no price monitoring,
  alerts, or historical price data
- Section D (flight tracking): NOT_IMPLEMENTED — no booked flight tracking
  or status monitoring
- Section E (timeline integration): NOT_IMPLEMENTED — no flight items in
  timeline (timeline does not exist)
- Section F (recommendation): NOT_IMPLEMENTED — no AI-recommended flight
  dates or routes

V1 Cross-Reference Adjustments:
- Booking System: booking page + flight API provide discovery only; no
  booking materialization exists
- Timeline System: does not exist — no flight timeline items
- Profile System: destination/origin from profile used for airport
  autocomplete defaults
- Notification System: no flight-related notifications

V1 Fallback Behavior:
- Flight search: user enters airports on booking page and receives either
  scraped live results or deterministic mock results from `/api/flights`
- No flight data persisted — user manages flights externally after opening
  provider links
- Move date from profile is not used to suggest flight dates

============================================================

============================================================
A. PURPOSE, PRODUCT BOUNDARY & LEGAL/COMMERCIAL POSITIONING
============================================================

A.1 Core Purpose (Canonical Role)

Primary Role:
PLANNING TOOL + SEARCH ASSISTANT

The Flight System exists to support the user’s relocation planning process by helping them determine when to fly, explore relevant flight options, and prepare for external booking.

Secondary Role:
TRACKING SYSTEM (Manual-first, optional future automation)

The system may track flights that the user has booked externally to ensure relocation plan completeness and timeline accuracy.

Explicitly NOT:
BOOKING PLATFORM

GoMate does not execute bookings, handle payments, or issue tickets.

Why:
This keeps GoMate legally lightweight, avoids airline licensing requirements, and ensures the system focuses on relocation planning rather than transactional execution.


A.2 Legal & Liability Boundary (Hard Constraint)

GoMate MUST NOT:

- Sell airline tickets
- Collect payments for flights
- Issue airline tickets
- Claim booking confirmation authority
- Represent itself as the booking party

GoMate MUST:

- Redirect the user to airline or OTA websites for booking
- Clearly label all bookings as external
- Require user confirmation for booked status

Why:
This prevents GoMate from assuming legal liability and preserves platform compliance.


A.3 User Value Definition (Functional Objective)

The Flight System exists to answer:

- When should I fly based on my relocation timeline?
- What flights match my relocation plan?
- What routes should I consider?
- Have I booked my flight yet?

This ensures relocation completeness and timeline execution.


A.4 Product Scope Inclusion / Exclusion

IN SCOPE:

- Flight search assistance
- Flight recommendations
- Saving flights
- Marking flights as booked
- Timeline integration
- Booking reminders
- External redirect to booking providers

OUT OF SCOPE:

- Payment handling
- Ticket issuance
- Airline contract ownership
- Booking guarantees


============================================================
B. IDENTITY, OWNERSHIP & UNIQUENESS MODEL
============================================================

B.1 Flight Entity Definition

Every flight artifact exists as:

flight_id (UUID, primary key)

This represents a persistent flight artifact in GoMate.


B.2 Ownership Model (Canonical Ownership)

Flights belong to:

plan_id (required)
profile_version_id (required)

Flights do NOT belong globally to user without plan association.

Why:

Flights are relocation-specific artifacts tied to a specific relocation plan.


B.3 Flight Uniqueness Constraint

Canonical unique constraint:

UNIQUE(plan_id, external_flight_id)

external_flight_id is sourced from provider OR generated hash of:

(origin, destination, departure_time, airline, flight_number)

Why:

Prevents duplicate flight artifacts.


B.4 Flight Types (Artifact Classification)

Flight artifacts may be:

SEARCH_RESULT
RECOMMENDED_FLIGHT
SAVED_FLIGHT
BOOKED_FLIGHT

These represent logical classifications, not separate tables.


B.5 Flight Snapshot Model (Historical Integrity)

Each flight artifact MUST include:

provider_snapshot_timestamp

This preserves price, schedule, and provider state at time of capture.

Why:

Flight data changes constantly. Snapshot preserves historical truth.


============================================================
C. FLIGHT SEARCH SYSTEM & EXECUTION MODEL
============================================================

C.1 Search Trigger Sources

Allowed Manual Triggers:

User clicks "Search Flights"

Allowed Automatic Triggers (Controlled):

- Move date confirmed
- Timeline milestone reached ("Book your flight")

Forbidden automatic triggers:

- Dashboard load
- Chat open
- Page refresh

Why:

Prevents uncontrolled API usage and duplicate searches.


C.2 Search Input Parameters (Required Inputs)

Required:

origin_airport
destination_airport
date_range
passenger_count

Optional:

flexibility_window
budget_range
preferred_airlines


C.3 Data Source Model (Provider Model)

Providers may include:

Primary:

Amadeus API
Skyscanner API

Secondary:

Affiliate redirect providers

Why:

Ensures reliable structured search.


C.4 Live vs Cached Strategy

Primary mode:

LIVE search

Secondary mode:

Cached recommendations

TTL:

Cached search results expire after:

24 hours

Why:

Flight pricing changes rapidly.


C.5 Search Execution Mode

Flight search MUST be:

Asynchronous

Search creates a background job.

Why:

Prevents UI blocking and improves reliability.


C.6 Search Result Identity Contract

Each result MUST include:

external_flight_id
provider_name
search_timestamp


============================================================
D. FLIGHT SELECTION & ARTIFACT MODEL
============================================================

D.1 Flight Interaction States

Flights exist in these states:

SEARCH_RESULT (temporary)
RECOMMENDED
SAVED
BOOKED
ARCHIVED


D.2 Meaning of Each State

SEARCH_RESULT:

Temporary result, not persisted permanently

RECOMMENDED:

System-suggested flight

SAVED:

User bookmarked flight

BOOKED:

User confirmed external booking

ARCHIVED:

Inactive flight


D.3 Artifact Storage Model

Persisted:

RECOMMENDED
SAVED
BOOKED

Temporary only:

SEARCH_RESULT


D.4 Selection Authority

User controls:

SAVED
BOOKED

System controls:

RECOMMENDED


D.5 Versioning Model

Flight snapshot MUST store:

price_at_time
departure_time
arrival_time
airline
provider
search_timestamp


============================================================
E. BOOKING RESPONSIBILITY & BOUNDARY CONTRACT
============================================================

E.1 Booking Execution Model

All bookings occur externally.


E.2 Redirect Model

GoMate provides:

external_booking_url

User is redirected.


E.3 Booking Confirmation Model

User confirms booking manually by:

Mark as BOOKED

Optional fields:

booking_reference
booking_notes


E.4 Booking Materialization Requirement

When a flight is marked as BOOKED, the Flight System MUST create or update a corresponding Booking record in the Booking System (booking-system.md).

Materialization contract:

- Flight System emits booking.confirmed domain event (Event System taxonomy)
- Booking record created in Booking System with booking_type = transportation
- Booking System becomes the canonical registry entry for "does this flight booking exist?"
- Flight System remains authoritative for: flight-specific data, provider details, recommendation logic, flight lifecycle

The Booking record references:
- source_system = "flight"
- source_id = flight_id
- booking_type = "transportation"

Cross-reference: booking-system.md Section A.1.1 (unified registry positioning).


E.5 Booking Authority Limitation

GoMate does NOT issue ticket numbers.


E.6 Booking Verification Model

Canonical:

Manual confirmation by user

Future optional:

API sync integrations


============================================================
F. FLIGHT STATE MACHINE
============================================================

F.1 Canonical Lifecycle

SEARCH_RESULT
→ SAVED
→ BOOKED
→ COMPLETED

Alternative:

SAVED → ARCHIVED
BOOKED → CANCELLED


F.2 State Transition Authority

User triggers:

SAVE
BOOKED
ARCHIVED

System triggers:

RECOMMENDED


F.3 State Transition Rules

BOOKED flights cannot revert to SEARCH_RESULT.

BOOKED → CANCELLED allowed.

BOOKED → COMPLETED triggered by timeline.


F.4 Immutable Fields After Booking

Immutable:

departure_time
arrival_time
origin
destination
airline
flight_number


============================================================
G. TIMELINE SYSTEM INTEGRATION
============================================================

G.1 Timeline Relationship Model

Flights are:

Timeline Milestones

Example:

"Flight to Berlin"


G.2 Timeline Dependency Logic

Flight milestone depends on:

move_date (required)


G.3 Timeline Change Handling

If move date changes:

Saved flights remain

System marks:

STALE = true


G.4 Timeline Display Model

Timeline shows:

BOOKED status
SAVED status
STALE indicator


============================================================
H. TRACKING, STATUS MONITORING & UPDATE MODEL
============================================================

H.1 Tracking Scope Definition

Canonical default:

Manual tracking only


H.2 Status Types

ON_TIME
DELAYED
CANCELLED
COMPLETED


H.3 Update Trigger Sources

Manual user update

Future:

External API


H.4 Tracking Dependency Model

Tracking requires:

external_flight_id

Optional:

booking_reference


H.5 Tracking Failure Handling

Tracking failures:

DO NOT affect relocation plan integrity.


============================================================
I. CROSS-SYSTEM INTEGRATION CONTRACT
============================================================

I.1 Systems Triggering Flight Suggestions

Timeline System (primary)
Visa System (secondary)


I.2 Systems Consuming Flight Data

Timeline System
Dashboard
Checklist System


I.3 Event Emission Contract (Event System taxonomy — event-trigger-system.md C.2)

Flight System emits domain-specific events:

| Domain Event | Payload | Notes |
|-------------|---------|-------|
| flight.saved | flight_id, plan_id | User bookmarks a flight |
| flight.booked | flight_id, plan_id, booking_reference | User confirms external booking |
| flight.cancelled | flight_id, plan_id | User cancels flight |

Booking materialization events (emitted to Booking System):

| Domain Event | Payload | Notes |
|-------------|---------|-------|
| booking.confirmed | booking_id, plan_id, booking_type=transportation, source_system=flight, source_id=flight_id | Flight marked BOOKED → materializes in Booking System |
| booking.cancelled | booking_id, plan_id, booking_type=transportation | Flight cancelled → updates Booking System |

DEPRECATED event names:
- flight_saved → flight.saved
- flight_booked → flight.booked + booking.confirmed
- flight_cancelled → flight.cancelled + booking.cancelled


I.4 Cache Invalidation

Flight change updates timeline milestone state.


============================================================
J. UX, DISPLAY & USER EXPERIENCE CONTRACT
============================================================

J.1 Display Locations

Flights appear in:

Timeline
Flights Page
Dashboard


J.2 Recommendation Display

Each recommendation shows:

price
airline
departure time
confidence level


J.3 Booked Flight Display

Booked flights clearly marked:

BOOKED


J.4 Stale Flight Indicator

STALE flag visible if move date changes.


J.5 Allowed User Actions

User may:

Search
Save
Archive
Mark Booked
Mark Cancelled


============================================================
K. ERROR HANDLING & RESILIENCE MODEL
============================================================

K.1 Search Failure Handling

System displays:

Flight search unavailable

Retry option provided.


K.2 Provider Failure Handling

Fallback provider used.

OR cached recommendations.


K.3 Booking Sync Failure

Booking remains user-controlled.


K.4 Retry Semantics

Retry never creates duplicate flights.


K.5 Partial Result Protection

Incomplete search results discarded.


============================================================
L. PERSISTENCE, STORAGE & DUPLICATE PROTECTION
============================================================

L.1 Unique Constraint Enforcement

Database enforces:

UNIQUE(plan_id, external_flight_id)


L.2 Storage Model

Flight record includes:

flight_id
plan_id
profile_version_id
external_flight_id
status
origin
destination
departure_time
arrival_time
airline
flight_number
price
provider
provider_snapshot_timestamp
search_timestamp
created_at


L.3 Deduplication Logic

Duplicates merged automatically.


L.4 Retention Model

Saved and booked flights persist permanently.


============================================================
M. GENERATOR / SEARCH EXECUTION CONTRACT
============================================================

M.1 Input Contract

Search input:

origin
destination
date_range
passengers


M.2 Output Contract

Output MUST match schema:

FlightSearchResultSchema


M.3 Validation Layer

Results pass:

Schema validation
Duplicate validation


M.4 Version Tracking

Flight record MUST include:

provider_version
search_timestamp


============================================================
N. CROSS-SYSTEM REFERENCES
============================================================


N.1 Upstream (inputs to flight search/recommendation)

- Plan System (plan-system.md) — plan_id, move_date (search timing)
- Profile System (profile-system.md) — profile_version_id, origin city, passenger count
- Timeline System (timeline-system.md) — "Book your flight" milestone triggers search suggestion
- Recommendation System (recommendation-system.md) — MAY trigger flight suggestions via visa timeline milestones

N.2 Downstream (systems that consume flight data)

- Booking System (booking-system.md) — flight.booked materializes booking.confirmed record (E.4 booking materialization)
- Timeline System (timeline-system.md) — booked flights as timeline milestones (source_type=booking)
- Dashboard System (dashboard.md) — flight status summary
- Notification System (notification-system.md) — flight reminders via timeline integration

N.3 Shared Contracts

- Booking materialization: booking-system.md A.1.1 (Flight System MUST materialize bookings when BOOKED)
- Event taxonomy: event-trigger-system.md Section C.2 (flight.saved, flight.booked, booking.confirmed)
- Timeline integration: timeline-system.md Section L (flight bookings as timeline items)
- Plan scoping: flights are plan-scoped (plan_id required)
- Provider authority: external provider owns booking execution; GoMate is tracking/planning only (E.1)

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Plan System (plan-system.md) | PARTIAL |
| Profile System (profile-system.md) | PARTIAL |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |
| Recommendation System (recommendation-system.md) | MINIMAL |
| Booking System (booking-system.md) | MINIMAL |
| Dashboard System (dashboard.md) | PARTIAL |
| Notification System (notification-system.md) | MINIMAL |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |


============================================================
O. SYSTEM INVARIANTS
============================================================


Invariant 1: GoMate NEVER executes flight bookings — all bookings occur externally (E.1).

Invariant 2: When a flight is marked BOOKED, a corresponding Booking record MUST be materialized in the Booking System (E.4).

Invariant 3: Flight artifacts are plan-scoped via plan_id + profile_version_id (B.2).

Invariant 4: Flight search is NEVER triggered by dashboard load, chat open, or page refresh (C.1).

Invariant 5: Booked flight fields are immutable after booking (F.4).

Invariant 6: Deduplication enforced via UNIQUE(plan_id, external_flight_id) (L.1).


============================================================
END OF CANONICAL FLIGHT SYSTEM DEFINITION
============================================================
