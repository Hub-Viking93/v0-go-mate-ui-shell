# GoMate — v2 Scope Registry

> This document lists systems and features intentionally deferred from v1.
> Each entry includes the gap ID, what the definition requires, what v1 provides instead,
> and the trigger condition for v2 inclusion.

---

## Deferred Systems

### Booking System (GAP-001)
- **Definition:** `bookings` table with booking_id, provider_id, 8-state lifecycle
- **v1 alternative:** Flight search returns Google Flights redirect links. No server-side booking state.
- **v2 trigger:** Housing or government appointment booking feature requested

### Chat History Persistence (GAP-002)
- **Definition:** `conversations` + `messages` tables with sequence_number, immutability
- **v1 alternative:** Chat messages exist only in client-side React state during session
- **v2 trigger:** Users request conversation continuity across sessions

### Data Update System (GAP-011)
- **Definition:** DAG-based artifact dependency graph, TriggerType enum, cascade evaluation, job queue
- **v1 alternative:** Profile changes trigger inline effects in PATCH /api/profile (mark guides stale, increment plan_version)
- **v2 trigger:** Multiple artifact types (recommendations, housing, timeline) require decoupled cascade processing

### Event/Trigger System (GAP-013)
- **Definition:** Domain event bus with events table, AT-LEAST-ONCE delivery, idempotency_key, 15+ event types
- **v1 alternative:** All triggers are inline within API route handlers
- **v2 trigger:** System grows to require decoupled event processing across services

### Flight Persistence (GAP-014)
- **Definition:** `flights` table with 5-state lifecycle, UNIQUE(plan_id, external_flight_id)
- **v1 alternative:** Flight search returns results directly to client without persistence
- **v2 trigger:** Flight saving/booking feature requested

### Housing System (GAP-019)
- **Definition:** Housing strategy + listings recommendations, booking materialization
- **v1 alternative:** Guide has `housing_section` JSONB with LLM-generated housing info
- **v2 trigger:** External housing provider integration prioritized

### Notification System (GAP-021)
- **Definition:** `notifications` table with 7-state lifecycle, criticality levels, event-driven triggers
- **v1 alternative:** Client-side compliance alerts component with localStorage dismissal
- **v2 trigger:** Event bus implemented (GAP-013); server-side notification state needed
- **Depends on:** GAP-013 (Event/Trigger System)

### Profile Versioning (GAP-028)
- **Definition:** profile_version_id snapshots — immutable versioned copies of profile state
- **v1 alternative:** `plan_version` integer counter on relocation_plans tracks change count. `is_stale` flag on guides detects upstream changes.
- **v2 trigger:** Multiple artifacts must reference exact historical profile state

### Recommendation System — 9 remaining types (GAP-032)
- **Definition:** 10 recommendation types (visa_route + 9 others), dedicated `recommendations` table
- **v1 alternative:** Only visa_route recommendations implemented via guide embedding
- **v2 trigger:** Personalized cross-domain recommendations prioritized

### Research Layering (GAP-033)
- **Definition:** Layer 1 (generic, shared across users) + Layer 2 (user-specific). `research_results` table with TTL.
- **v1 alternative:** Per-plan JSONB research (visa_research, local_requirements_research)
- **v2 trigger:** User base grows to where shared research cache reduces Firecrawl costs

### Timeline System (GAP-039)
- **Definition:** `timeline_items` table aggregating milestones from all systems with urgency tiers
- **v1 alternative:** Deadline urgency computed on settling-in tasks only (urgent/approaching/normal)
- **v2 trigger:** Bookings, housing, visa appointments tracked and need unified timeline

### Profile version_id Binding (GAP-041)
- **Definition:** All artifacts bound to profile_version_id
- **v1 alternative:** Artifacts reference plan_version (monotonic counter). Staleness detected via version comparison.
- **v2 trigger:** Profile versioning (GAP-028) implemented
- **Depends on:** GAP-028 (Profile Versioning)

---

## Cross-Deferral Dependencies

Some deferred systems depend on other deferred systems:

| System | Depends On |
|--------|-----------|
| Notification System (GAP-021) | Event/Trigger System (GAP-013) |
| Profile version_id Binding (GAP-041) | Profile Versioning (GAP-028) |
| Timeline System (GAP-039) | Booking System (GAP-001), Housing System (GAP-019) |
| Research Layering (GAP-033) | Profile Versioning (GAP-028) for version binding |

---

## Summary

| Count | Classification |
|-------|---------------|
| 12 | Total deferred systems |
| 6 | Fully missing systems (no implementation at all) |
| 6 | Systems with partial v1 alternatives |
| 4 | Systems with cross-deferral dependencies |
