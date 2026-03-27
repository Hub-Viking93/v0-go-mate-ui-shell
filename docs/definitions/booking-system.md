============================================================
GOMATE — BOOKING SYSTEM (GENERIC)
CANONICAL SYSTEM DEFINITION (FINAL)
============================================================

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: MINIMAL

V1 Implementation Reality:
- The booking page exists (app/(app)/booking/page.tsx) and provides
  flight discovery/search UI backed by `/api/flights`, but no booking
  orchestration, tracking, or metadata registry
- No bookings table in the database
- No booking metadata storage, status mirroring, or booking-linked
  timeline events
- The booking page collects origin/destination airports via autocomplete,
  calls `/api/flights`, renders result cards, and opens external provider
  URLs in a new tab
- Airport autocomplete (components/booking/airport-autocomplete.tsx) uses
  a local airport dataset (lib/gomate/airports.ts)
- No manual booking tracking, no booking reminders, no booking history

V1 Deviations from Canonical Spec:
- Section A (booking registry): NOT_IMPLEMENTED — no booking orchestration
  or tracking layer; only external-search/discovery exists
- Section B (data model): NOT_IMPLEMENTED — no bookings table, no
  booking_id, no booking metadata schema
- Section C (booking types): NOT_IMPLEMENTED — only flight discovery is
  surfaced; no accommodation, transport registry, or other booking types
- Section D (status tracking): NOT_IMPLEMENTED — no booking status
  lifecycle (pending/confirmed/cancelled)
- Section E (timeline integration): NOT_IMPLEMENTED — no booking items in
  timeline (timeline itself does not exist)
- Section F (notification triggers): NOT_IMPLEMENTED — no booking-related
  notifications

V1 Cross-Reference Adjustments:
- Timeline System: does not exist — no booking timeline items
- Notification System: minimal — no booking notifications
- Flight System: the booking page is effectively the flight-search UI in
  v1, but still not a booking registry
- Housing System: does not exist

V1 Fallback Behavior:
- Flight discovery: user enters origin/destination on booking page,
  receives provider search results, then opens external provider URLs
- No booking tracking — user manages bookings externally
- No booking data feeds back into the relocation plan

============================================================


============================================================
A. PURPOSE & SCOPE
============================================================


A.1 Core Role Definition

The GoMate Booking System is defined as:

A UNIFIED BOOKING ORCHESTRATION, TRACKING, AND METADATA REGISTRY LAYER.

It is the SINGLE canonical registry for ALL relocation bookings across GoMate.

It is NOT a booking execution engine.

Its primary responsibilities are:

• Track bookings related to relocation  
• Store booking metadata  
• Mirror external booking status  
• Create booking-linked timeline events  
• Provide booking visibility and reminders  
• Allow user manual booking tracking  

It MAY also:

• Redirect users to booking providers  
• Store provider references  
• Sync booking status from providers  

It is NOT responsible for:

• Executing bookings directly (no flight purchase, no housing reservation)
• Acting as payment processor
• Acting as booking provider
• Guaranteeing booking availability
• Guaranteeing booking success

GoMate NEVER becomes the legal booking provider.


A.1.1 Unified Registry Positioning

The Booking System is the unified booking registry for ALL relocation bookings, regardless of origin system.

ALL domain systems that track booking-like artifacts (Flight System, Housing System, etc.) MUST materialize booking records in the Booking System when a booking is confirmed.

Booking materialization contract:

- When a user confirms a booking in any domain system (e.g., marks a flight as BOOKED, marks housing as BOOKED), that domain system MUST create or update a corresponding Booking record in the Booking System.
- The Booking record becomes the canonical registry entry for "does this booking exist?"
- The domain system remains authoritative for domain-specific data (provider details, recommendation logic, domain lifecycle).
- The Booking System is authoritative for: whether a relocation booking exists, generic booking lifecycle state, timeline integration, reminders, and reconciliation.

Domain systems that MUST materialize bookings:

- Flight System (flight-system.md) — flight bookings
- Housing System (housing-system.md) — temporary and permanent housing bookings
- (Any future domain system with booking capabilities)

Domain systems are NOT subsystems of Booking System. They remain independent. Booking System does NOT own flight or housing domain logic. It only tracks the unified booking registry state.

Cross-reference: flight-system.md Section E (booking boundary), housing-system.md Section E (booking boundary).



A.2 Authority Boundary

GoMate CAN:

• store bookings  
• track bookings  
• recommend bookings  
• create booking metadata  
• redirect to providers  
• track booking completion  

GoMate CANNOT:

• execute booking transactions  
• confirm booking legally  
• issue booking tickets  
• guarantee booking validity  

Provider remains execution authority.




A.3 Strategic Role in GoMate

Booking System is classified as:

CORE RELOCATION INFRASTRUCTURE

Because relocation requires tracking critical appointments such as:

• visa appointments  
• residence registration  
• housing move-in  
• transportation  

Without Booking System, relocation execution visibility is incomplete.




A.4 Relationship to Plan

Bookings are ALWAYS bound to a plan.

Rules:

Plan CAN exist without bookings.

Booking CANNOT exist without plan.

Booking is:

Optional but operationally critical relocation artifact.

Bookings do NOT define plan completion but may affect timeline progression.




============================================================
B. SUPPORTED BOOKING TYPES
============================================================


B.1 Supported Categories


Transportation:

• flights  
• trains  
• ferries  
• buses  


Housing:

• temporary housing  
• long-term housing  
• hotels  
• Airbnb  


Government:

• residence permit appointments  
• immigration office visits  
• tax office visits  
• registration appointments  


Services:

• bank appointments  
• healthcare appointments  
• insurance meetings  
• phone contracts  


Personal:

• school visits  
• childcare visits  


Other:

• custom user-defined bookings




B.2 Booking Type Definition Contract

Each booking type MUST define:

Required:

• booking_type
• start_time
• title

Optional:

• provider_id
• external_booking_id
• end_time
• location
• external_url

Status Authority:

External provider (if exists)

Execution Location:

External provider OR manual user entry




B.3 Booking Type Extensibility

System supports dynamic booking types.

Booking types defined in:

booking_types registry table

New types added WITHOUT code change.




============================================================
C. BOOKING IDENTITY MODEL
============================================================


C.1 Unique Identity

Booking unique identifier:

booking_id (UUID)

External uniqueness:

UNIQUE(provider_id, external_booking_id)





C.2 Ownership

Booking owned by:

user_id

and

plan_id




C.3 Referential Integrity

Booking MUST link to:

user_id

plan_id

timeline_event_id (optional but recommended)




C.4 External Identity Mapping

External fields:

provider_id

external_booking_id

external_sync_id




============================================================
D. BOOKING LIFECYCLE STATES
============================================================


D.1 Full State Model


suggested

planned

initiated

redirect_started

pending_confirmation

confirmed

completed

failed

cancelled

expired




D.2 State Authority


User authority:

planned

cancelled


System authority:

suggested


Provider authority:

confirmed

failed

expired


Sync engine authority:

state reconciliation




D.3 Valid Transitions


Valid example:

suggested → planned → initiated → pending_confirmation → confirmed → completed


Allowed cancellation:

confirmed → cancelled


Invalid:

completed → confirmed

cancelled → confirmed




D.4 State Machine Model

Lifecycle is HYBRID:

Externally driven for provider bookings

Internally driven for manual bookings




============================================================
E. BOOKING CREATION TRIGGERS
============================================================


E.1 Creation Sources


User:

manual booking creation

click recommendation


System:

timeline generation

task generation


External:

provider webhook

sync import




E.2 Creation Preconditions

Required:

user_id

plan_id




E.3 Creation Authority

Allowed creators:

User

System

Sync engine

Admin




============================================================
F. RESPONSIBILITY BOUNDARY
============================================================


F.1 Execution Responsibility

GoMate NEVER executes bookings.

GoMate ONLY:

redirects

tracks

stores




F.2 Source of Truth


If external provider exists:

Provider is source of truth


If manual booking:

GoMate is source of truth




F.3 Legal Responsibility

GoMate is:

Facilitator and tracking platform

NOT booking provider




============================================================
G. TIMELINE INTEGRATION
============================================================


G.1 Timeline Role

Booking creates timeline event.




G.2 Timeline Impact

Bookings affect:

timeline visibility

reminders

milestones




G.3 Timeline Binding


booking_id → timeline_event_id




============================================================
H. RELATIONSHIP TO OTHER SYSTEMS
============================================================


H.1 Creator Systems (systems that create booking records)

Domain systems that materialize bookings:

- Flight System (flight-system.md) — flight bookings (booking.confirmed event with booking_type=transportation)
- Housing System (housing-system.md) — housing bookings (booking.confirmed event with booking_type=housing)

Other creation sources:

- User UI — manual booking creation (government appointments, service bookings, custom)
- Recommendation System — booking suggestions from recommendations
- Sync Engine — external provider webhook/import
- Chat System — booking creation via chat interaction


H.2 Consumer Systems

- Timeline System (timeline-system.md) — bookings appear as timeline items (source_type=booking)
- Notification System (notification-system.md) — booking reminders and status alerts
- Dashboard System (dashboard.md) — booking summary display
- Progress Tracking System (progress-tracking-system.md) — MAY use booking completion for pre_arrival_progress
- Analytics — booking tracking metrics


H.3 Domain Event Emission (Event System taxonomy — event-trigger-system.md C.2)

Booking System emits:

| Domain Event | Payload | Trigger |
|-------------|---------|---------|
| booking.confirmed | booking_id, plan_id, booking_type, source_system | Booking created or confirmed |
| booking.cancelled | booking_id, plan_id, booking_type | Booking cancelled |
| booking.completed | booking_id, plan_id, booking_type | Booking marked complete |
| booking.failed | booking_id, plan_id, error_code | Provider failure or sync failure |

DEPRECATED event names (use normalized names above):
- flight_saved → (not a booking event; stays in Flight System domain)
- flight_booked → booking.confirmed with booking_type=transportation
- flight_cancelled → booking.cancelled with booking_type=transportation




============================================================
I. PERSISTENCE & VERSIONING
============================================================


I.1 Storage Model

Stored in:

bookings table




I.2 Versioning

Booking is mutable.

State history stored separately in:

booking_state_history




I.3 History Preservation

System stores:

state history

provider history

change history




I.4 Audit Requirements

Full audit logging REQUIRED.




============================================================
J. DEDUPLICATION RULES
============================================================


Duplicate defined as:

Same:

provider_id

external_booking_id




Database constraint:

UNIQUE(provider_id, external_booking_id)




============================================================
K. UX PRESENTATION
============================================================


Displayed in:

Timeline

Dashboard

Booking view




User can:

view

edit

cancel

open provider link




============================================================
L. ERROR HANDLING
============================================================


Booking failure:

State → failed

User notified

Retry allowed




Provider mismatch:

Provider wins

Sync reconciles




============================================================
M. SYNC & RECONCILIATION
============================================================


Supported sync types:

Webhook

Manual sync

Scheduled sync




Conflict resolution:

Provider wins




============================================================
N. BOOKING DATA CONTRACT
============================================================


booking_id

user_id

plan_id

booking_type

state

provider_id

external_booking_id

start_time

end_time

title

description

external_url

created_at

updated_at




============================================================
O. SECURITY & PERMISSIONS
============================================================


User can access ONLY own bookings.




============================================================
P. PERFORMANCE & SCALABILITY
============================================================


Expected volume:

5–50 bookings per plan




============================================================
Q. FAILURE SCENARIOS
============================================================


Provider shutdown:

Booking remains but marked:

provider_unavailable




============================================================
R. COMPLIANCE & LEGAL
============================================================


Booking classified as:

tracking record

NOT legal booking contract




Retention:

Minimum 7 years




============================================================
S. EXTENSIBILITY
============================================================


System supports:

New providers

New booking types

New states


WITHOUT schema break




============================================================
T. CROSS-SYSTEM REFERENCES
============================================================


T.1 Upstream (systems that create bookings in this registry)

- Flight System (flight-system.md) — materializes booking.confirmed when flight marked BOOKED
- Housing System (housing-system.md) — materializes booking.confirmed when housing marked BOOKED
- Recommendation System (recommendation-system.md) — booking suggestions from selected recommendations
- User UI / Chat System — manual booking creation

T.2 Downstream (systems that consume booking data)

- Timeline System (timeline-system.md) — bookings as timeline items (source_type=booking); booking.confirmed/cancelled trigger timeline update
- Notification System (notification-system.md) — booking reminders based on start_time; booking.confirmed triggers notification
- Dashboard System (dashboard.md) — booking summary card
- Progress Tracking System (progress-tracking-system.md) — MAY use booking completion for pre_arrival_progress milestones

T.3 Shared Contracts

- Plan scoping: bookings are plan-scoped (plan_id required) — consistent with all plan-scoped artifacts
- Event taxonomy: event-trigger-system.md Section C.2 (booking.confirmed, booking.cancelled, booking.completed)
- Timeline integration: timeline-system.md Section L (booking items in timeline)
- Unified registry: ALL domain systems with booking capabilities MUST materialize through Booking System (A.1.1)
- Provider authority: external provider is source of truth for provider bookings; GoMate is source of truth for manual bookings (F.2)

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Flight System (flight-system.md) | MINIMAL |
| Housing System (housing-system.md) | NOT_IMPLEMENTED |
| Recommendation System (recommendation-system.md) | MINIMAL |
| Plan Contextual Chat (plan-contextual-chat.md) | PARTIAL |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |
| Notification System (notification-system.md) | MINIMAL |
| Dashboard System (dashboard.md) | PARTIAL |
| Progress Tracking System (progress-tracking-system.md) | PARTIAL |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |


============================================================
U. SYSTEM INVARIANTS
============================================================


Invariant 1: Booking System is the SINGLE unified booking registry — all relocation bookings MUST be represented here regardless of origin system.

Invariant 2: Domain systems (Flight, Housing) materialize bookings in Booking System when confirmed — Booking System does NOT own domain-specific logic.

Invariant 3: GoMate NEVER executes bookings — it is a facilitator and tracking platform only (F.1, R).

Invariant 4: External provider is source of truth for provider bookings; GoMate is source of truth for manual bookings (F.2).

Invariant 5: Bookings are plan-scoped — strict plan isolation (C.2).

Invariant 6: Booking state history stored separately — full audit trail required (I.2, I.4).

Invariant 7: Deduplication enforced via UNIQUE(provider_id, external_booking_id) — no duplicate external bookings (J).


============================================================
END OF BOOKING SYSTEM DEFINITION
============================================================
