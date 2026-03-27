# Definitions Digest — What the Definitions Require

> Generated: 2026-03-04
> Source: All 24 definition documents in `docs/definitions/`
> Purpose: Canonical requirements extracted from each system definition

---

## Table of Contents

1. [Booking System](#1-booking-system)
2. [Chat History System](#2-chat-history-system)
3. [Chat Interview System](#3-chat-interview-system)
4. [Cost of Living System](#4-cost-of-living-system)
5. [Dashboard System](#5-dashboard-system)
6. [Data Update System](#6-data-update-system)
7. [Document Checklist System](#7-document-checklist-system)
8. [Event/Trigger System](#8-eventtrigger-system)
9. [Flight System](#9-flight-system)
10. [Guide Generation System](#10-guide-generation-system)
11. [Guide Viewer System](#11-guide-viewer-system)
12. [Housing System](#12-housing-system)
13. [Local Requirements System](#13-local-requirements-system)
14. [Notification System](#14-notification-system)
15. [Onboarding System](#15-onboarding-system)
16. [Plan Contextual Chat System](#16-plan-contextual-chat-system)
17. [Plan System](#17-plan-system)
18. [Profile System](#18-profile-system)
19. [Progress Tracking System](#19-progress-tracking-system)
20. [Recommendation System](#20-recommendation-system)
21. [Research System](#21-research-system)
22. [Settling-In Tasks System](#22-settling-in-tasks-system)
23. [Timeline System](#23-timeline-system)
24. [Visa Recommendation Module](#24-visa-recommendation-module)

---

## 1. Booking System
**File:** `docs/definitions/booking-system.md`

### MUST Requirements
- A.1: Unified booking orchestration, tracking, and metadata registry
- B.1: UNIQUE(provider_id, external_booking_id) constraint
- B.2: Store booking_id (UUID primary key)
- E: Emit domain events (booking.confirmed, booking.updated, booking.cancelled, booking.completed)
- F.3: Materialize booking records from Flight System when flight.booked triggered

### MUST NOT
- Execute bookings (external provider executes)
- Assume payment authority
- Modify booking_type after creation

### Entity Model
- Table: `bookings` — booking_id, user_id, plan_id, booking_type (flight/housing/government_appointment/service/visa_application/transport), provider_id, external_booking_id, status, metadata (JSONB), source_system, source_id
- States: suggested → planned → initiated → pending_confirmation → confirmed → completed | failed/cancelled/expired

### Behavior
- Unified registry aggregating bookings from Flight, Housing, Government systems
- External provider is source of truth for provider bookings
- GoMate is source of truth for manual bookings

### Guarantees
- Idempotency via UNIQUE constraint
- At-least-once event delivery with causation_id
- External state always authoritative

### Dependencies
- **Upstream:** Flight System, Housing System
- **Downstream:** Timeline System, Notification System

---

## 2. Chat History System
**File:** `docs/definitions/chat-history-system.md`

### MUST Requirements
- A: Persist all conversations with deterministic ordering
- B: Store conversation_kind enum (onboarding_interview | plan_contextual)
- C: Use sequence_number for message ordering (not timestamps)
- D: Messages immutable once completed

### MUST NOT
- Allow greeting when message_count != 0
- Modify message content after creation
- Rely on timestamp ordering

### Entity Model
- Table: `conversations` — conversation_id, user_id, plan_id, conversation_kind, message_count, created_at
- Table: `messages` — message_id, conversation_id, sequence_number (canonical), role (user/assistant), content, status (creating/completed/failed), created_at
- UNIQUE(conversation_id, sequence_number)

### Behavior
- Monotonically increasing sequence_number
- Lazy loading for backward pagination
- Messages finalized with status=completed

### Guarantees
- Deterministic ordering via sequence_number
- Immutability of completed messages

### Dependencies
- **Upstream:** Chat Interview System, Plan Contextual Chat System
- **Downstream:** Dashboard, Export System

---

## 3. Chat Interview System
**File:** `docs/definitions/chat-interview-system-definition.md`

### MUST Requirements
- A.1: temperature=0 extraction for determinism
- B: Interview state machine with 8 states
- C: Extract minimum required fields: destination_country, citizenship, purpose, move_date
- D: Validate field format before marking filled
- E: Track confidence levels: explicit, inferred, assumed

### MUST NOT
- Mark inferred fields as confirmed
- Auto-progress to PLAN_CREATED without destination_country
- Skip validation on required fields
- Use temperature > 0 for extraction

### Entity Model
- Profile stored in relocation_plans.profile_data (JSONB, 65+ fields)
- State Machine: NOT_STARTED → PRE_PLAN_ACTIVE → PRE_PLAN_WAITING_FOR_USER → PRE_PLAN_PROCESSING → PLAN_CREATED → POST_PLAN_COLLECTING → INTERVIEW_COMPLETE → TERMINATED

### Behavior
- Structured question flow with purpose-specific branching
- Field extraction via GPT-4o-mini
- Confirmation prompts for critical fields (destination, citizenship)

### Guarantees
- Extraction determinism via temperature=0
- Required field validation before progression
- Immutability of confirmed fields

### Dependencies
- **Downstream:** Plan System (plan creation), Profile System (field storage), Progress Tracking

---

## 4. Cost of Living System
**File:** `docs/definitions/cost-of-living.md`

### MUST Requirements
- A: Generate personalized monthly cost estimate
- B: Three-tier range (minimum, recommended, comfortable)
- C.1: Cache base city Level 1 estimates for 30 days
- C.2: Adjust Level 2 estimates based on profile (household_size, salary_expectation, lifestyle_preference)
- D: Include 6 categories (housing, food, transport, healthcare, administrative, lifestyle)
- E: Bind to profile_version_id snapshot

### MUST NOT
- Use live price APIs (use cached research data only)
- Re-generate without profile change
- Exceed 30-day cache TTL for base city
- Infer missing profile fields for adjustment

### Entity Model
- Stored as cost_estimate (JSONB) on relocation_plans
- Three tiers: minimum_estimate, recommended_estimate, comfortable_estimate
- Per tier: housing, food, transport, healthcare, administrative, lifestyle (amount + currency)
- Confidence_score (0-1)

### Guarantees
- Consistent within 30-day TTL
- Versioned to profile_version_id
- Deterministic: same profile + city = same estimate

### Dependencies
- **Upstream:** Profile System, Research System
- **Downstream:** Guide Generation, Dashboard, Visa Recommendation

---

## 5. Dashboard System
**File:** `docs/definitions/dashboard.md`

### MUST Requirements
- A.1: Answer 5 core questions in priority order (status, next steps, blockers, outputs, actions)
- B.1: Read progress ONLY from Progress Tracking System, never compute locally
- C: Display cards in strict priority: blockers > resume > profile > artifacts > insights
- E.2: Derive dashboard state from (LifecycleState, Stage, interview_progress, artifact_status)
- F.1: Support CTAs (Resume Interview, Confirm Profile, Generate Guide, Generate Checklist, Refresh Artifact, Lock Plan, Unlock Plan, Create New Plan)

### MUST NOT
- Compute progress inline (dashboard NEVER does this)
- Trigger artifact generation automatically
- Modify profile silently
- Display inferred values as confirmed
- Combine progress_types into single bar without aggregate definition

### Entity Model
- Derived States: NO_PLAN, PLAN_EXISTS_PROFILE_EMPTY, INTERVIEW_IN_PROGRESS, PROFILE_READY_UNCONFIRMED, PROFILE_CONFIRMED, ARTIFACTS_GENERATING, ARTIFACTS_READY, POST_ARRIVAL, PLAN_LOCKED, PLAN_ARCHIVED

### Behavior
- Load order: plan summary → progress snapshot → artifact status → previews
- POST_ARRIVAL: compliance progress, overdue tasks, timeline summary
- Actions emit domain events

### Guarantees
- Progress accuracy matches backend exactly
- Artifact staleness detection with refresh CTA
- Backend state always authoritative

### Dependencies
- **Reads from:** Plan, Profile, Progress Tracking, Guide Generation, Recommendation, Cost of Living, Settling-in Tasks, Timeline, Local Requirements

---

## 6. Data Update System
**File:** `docs/definitions/data-update-system.md`

### MUST Requirements
- A: DAG for artifact dependencies
- B: TriggerTypes: DESTINATION_CHANGED, MOVE_DATE_CHANGED, PROFILE_UPDATED, MANUAL_REFRESH, SYSTEM_EXTERNAL
- C: MUST NOT auto-trigger guide generation (explicit user trigger required)
- D: Handle artifact versioning and pointer updates

### MUST NOT
- Auto-cascade guide regeneration on profile change
- Trigger expensive operations without explicit user action
- Violate artifact versioning contracts

### Entity Model
- ArtifactType: guide, checklist, recommendations, cost_estimate, timeline, research_results, housing_listings
- TriggerType: DESTINATION_CHANGED, MOVE_DATE_CHANGED, PROFILE_UPDATED, MANUAL_REFRESH, SYSTEM_EXTERNAL
- Job queue: trigger_id, trigger_type, affected_artifacts[], cascade_plan

### Behavior
- Profile change → cascade evaluation → mark stale → user manually regenerates
- DAG prevents circular dependencies

### Guarantees
- Deterministic cascade
- Idempotent triggers

### Dependencies
- **Upstream:** Profile System, Plan System
- **Downstream:** Guide Generation, Recommendation, Cost of Living, Research, Housing

---

## 7. Document Checklist System
**File:** `docs/definitions/document-checklist.md`

### MUST Requirements
- A: Store document requirements as formal compliance dependencies
- B: UNIQUE(plan_id, profile_version_id, visa_recommendation_version_id, document_type_id)
- C: States: NOT_PROVIDED, UPLOADED, SUBMITTED, VERIFIED, REJECTED, EXPIRED, ARCHIVED
- D: Block tasks when REQUIRED document unverified

### MUST NOT
- Allow task progression if blocking REQUIRED document missing
- Expire verified documents

### Entity Model
- Fields: document_id, document_type_id, status (7-state enum), uploaded_at, verified_at, expiry_date, requirement_tier (REQUIRED/OPTIONAL)
- Task-document blocking model

### Behavior
- Visa recommendation generates document list
- User uploads → verification → task unblocking
- Expiry checks on each task evaluation

### Guarantees
- Task-document blocking enforced
- Immutable once verified
- Expiry checked per evaluation

### Dependencies
- **Upstream:** Visa Recommendation (document requirements)
- **Downstream:** Settling-in Tasks (task blocking), Compliance

---

## 8. Event/Trigger System
**File:** `docs/definitions/event-trigger-system.md`

### MUST Requirements
- A: Classify events (domain, system, UI)
- B: AT-LEAST-ONCE delivery with idempotency
- C: Event identity: event_id, type, source_system, user_id, plan_id, correlation_id, causation_id, idempotency_key, plan_version
- D: ORDERED PER PLAN (partitioned by plan_id)
- E: POINTERS/IDS ONLY in payload (no full snapshots)

### MUST NOT
- Deliver events out of order per plan
- Include sensitive data in payload
- Duplicate events (idempotency_key prevents)

### Entity Model
- Table: `events` — event_id, type, source_system, user_id, plan_id, correlation_id, causation_id, idempotency_key, plan_version, payload (JSONB), created_at
- Event Types: profile.confirmed, guide.regenerate_requested, checklist.regenerate_requested, plan.locked, plan.forked, plan.created, flight.saved, flight.booked, booking.confirmed, task.completed, task.blocked, notification.sent, research.completed

### Guarantees
- Ordering per plan via partition key
- Idempotency via idempotency_key
- Causality tracking via correlation_id + causation_id
- Plan version staleness guard

### Dependencies
- **All systems** emit events
- **Consumers:** Data Update, Notification, Timeline, Booking, Task

---

## 9. Flight System
**File:** `docs/definitions/flight-system.md`

### MUST Requirements
- A.1: MUST NOT execute bookings
- B.1: Assign flight_id (UUID primary key)
- B.2: Bind flights to plan_id + profile_version_id
- B.3: UNIQUE(plan_id, external_flight_id)
- E.4: Materialize booking.confirmed in Booking System when BOOKED

### MUST NOT
- Auto-trigger flight search
- Issue airline tickets
- Claim booking confirmation authority
- Modify booked flight fields (immutable: departure_time, arrival_time, airline, flight_number)

### Entity Model
- Table: `flights` — flight_id, plan_id, profile_version_id, external_flight_id, status (SEARCH_RESULT/RECOMMENDED/SAVED/BOOKED/ARCHIVED), origin, destination, departure_time, arrival_time, airline, flight_number, price, provider
- UNIQUE(plan_id, external_flight_id)

### Behavior
- User searches → saves → marks booked
- BOOKED → emit booking.confirmed → Booking System materializes
- Move date change marks saved flights STALE

### Guarantees
- Deduplication via UNIQUE constraint
- Snapshot preservation
- Immutability of booked fields

### Dependencies
- **Downstream:** Booking System, Timeline System, Dashboard

---

## 10. Guide Generation System
**File:** `docs/definitions/guide-generation.md`

### MUST Requirements
- A: MUST NOT auto-trigger (explicit user action only)
- B: Bind guide to profile_version_id snapshot
- C.1: Lifecycle states: NOT_STARTED, QUEUED, GENERATING, COMPLETE, FAILED, STALE, ARCHIVED
- C.3: Mark STALE when upstream changes
- D: Include minimum 10 recommendations + completion_score >= 0.85
- E: Required sections: overview, visa, administrative, timeline, next actions

### MUST NOT
- Auto-trigger on dashboard load or cascade
- Regenerate without profile_version_id change or explicit user trigger
- Exceed token budget

### Entity Model
- Canonical: guide_versions table with version_id, profile_version_id, status, created_at
- v1: guides table with JSONB sections
- States: NOT_STARTED, QUEUED, GENERATING, COMPLETE, FAILED, STALE, ARCHIVED
- Structure: tabs → sections → blocks → content

### Behavior
- User clicks "Generate Guide" → enqueue → LLM generation → validate → COMPLETE/FAILED
- Profile changes → mark STALE → display refresh CTA
- User manually regenerates

### Guarantees
- No auto-generation
- Idempotent: same profile_version_id = same content
- Token budget respected
- Profile binding via version snapshot

### Dependencies
- **Upstream:** Profile, Recommendation, Research
- **Downstream:** Guide Viewer, Dashboard, Data Update

---

## 11. Guide Viewer System
**File:** `docs/definitions/guide-viewer.md`

### MUST Requirements
- A: STRICTLY READ-ONLY presentation layer
- B: Load latest COMPLETED guide version
- C: Display STALE badge when guide.status = STALE
- D: Section-based navigation
- E: Deep linking (/plan/:plan_id/guide?tab=:tab_id&section=:section_id)

### MUST NOT
- Modify guide data
- Auto-trigger guide generation
- Auto-regenerate on stale detection

### Entity Model
- Schema: guide → tabs[] → sections[] → blocks[] → content
- Minimum tabs: overview, visa, cost_of_living, housing, healthcare, tasks

### Behavior
- Load guide → render tabs → STALE badge if stale → regenerate CTA
- PDF export, scroll persistence, deep linking

### Guarantees
- Read-only
- Version consistency across tabs
- Staleness visibility

### Dependencies
- **Upstream:** Guide Generation (data + status)
- **Downstream:** Events (guide.regenerate_requested)

---

## 12. Housing System
**File:** `docs/definitions/housing-system.md`

### MUST Requirements
- A: Housing strategy + listings recommendations
- B: Output Housing Strategy (timing, temporary vs permanent)
- C: Output Housing Listings (personalized recommendations)
- E.4: Materialize booking.confirmed in Booking System when BOOKED

### MUST NOT
- Book housing directly
- Exceed budget_range from cost_of_living.housing_budget_range

### Entity Model
- Strategy: timing, temporary_vs_permanent, provider_recommendations[]
- Listings: listing_id, provider, address, price_per_month, amenities[], neighborhood_data, confidence_score, booking_url

### Behavior
- Cost of living → housing budget → strategy → listings → external booking

### Dependencies
- **Upstream:** Profile, Cost of Living, Plan
- **Downstream:** Booking System, Timeline, Dashboard

---

## 13. Local Requirements System
**File:** `docs/definitions/local-requirements.md`

### MUST Requirements
- A: Requirements are jurisdiction-specific, authority-backed, legally necessary obligations
- B: UNIQUE(plan_id, profile_version_id, destination_country, visa_type_id)
- C: States: NOT_GENERATED, GENERATING, ACTIVE, STALE, FAILED, ARCHIVED
- D: Minimum N core requirements per jurisdiction

### MUST NOT
- Mark requirement complete without verification
- Infer missing fields for requirement generation

### Entity Model
- Fields: requirement_id, plan_id, profile_version_id, destination_country, visa_type_id, requirement_type, verification_status, blocking_task_id

### Behavior
- Visa type → requirements generated → bound to profile_version_id → tasks depend on requirements

### Dependencies
- **Upstream:** Visa Recommendation, Profile
- **Downstream:** Settling-in Tasks (task blocking)

---

## 14. Notification System
**File:** `docs/definitions/notification-system.md`

### MUST Requirements
- A: Action-triggered alerts (not information feed)
- B: Criticality levels: CRITICAL, HIGH, MEDIUM, LOW
- C: States: CREATED, DELIVERED, SEEN, READ, DISMISSED, EXPIRED, FAILED
- D: Idempotency key: notification_type + artifact_type + artifact_id + plan_id

### MUST NOT
- Spam identical notifications
- Send without idempotency deduplication

### Entity Model
- Table: `notifications` — notification_id, user_id, plan_id, notification_type, artifact_type, artifact_id, criticality_level, status, created_at, delivered_at, read_at

### Behavior
- Event triggers notification → idempotency check → create → deliver → read/dismiss/expire

### Guarantees
- Idempotency via composite key
- FIFO per user

### Dependencies
- **Upstream:** Event System, Timeline System
- **Downstream:** UI

---

## 15. Onboarding System
**File:** `docs/definitions/onboarding-system.md`

### MUST Requirements
- A: onboarding_completed = true when ACTIVE plan + first_output_generated = true
- B: Two distinct chat systems (Onboarding Interview Chat + Plan Contextual Chat) sharing /api/chat
- C: Create plan when destination_country confirmed
- D: MUST NOT mark onboarding complete until generation done

### MUST NOT
- Conflate Onboarding Interview Chat and Plan Contextual Chat
- Mark onboarding_completed without first generation

### Entity Model
- Flag: relocation_plans.onboarding_completed (boolean)
- Prerequisite: lifecycle_state = ACTIVE AND first_output_generated = true

### Behavior
- Signup → interview → destination extracted → plan created → interview continues → profile confirmed → generation → onboarding_completed = true

### Dependencies
- **Downstream:** Plan System, Chat Interview, Chat History, Generation Systems

---

## 16. Plan Contextual Chat System
**File:** `docs/definitions/plan-contextual-chat-system.md`

### MUST Requirements
- A: Post-plan advisory assistant (plan-scoped)
- B: Stage-aware mode switching (collecting, generating, complete, arrived)
- C: Marker protocol: `[TASK_DONE:exact task title]` for task completion
- D: Inject profile via headers (not in prompt)
- E: Stream via SSE

### MUST NOT
- Extract profile when plan.locked=true OR stage=arrived
- Trigger expensive operations without explicit CTA
- Buffer entire response before streaming

### Behavior
- collecting: limited advisory, no task marking
- generating: status info only
- complete: full advisory enabled
- arrived: settling-in coach with task completion detection

### Dependencies
- **Upstream:** Plan, Profile, Chat History
- **Downstream:** Settling-in Tasks (via markers), Event System

---

## 17. Plan System
**File:** `docs/definitions/plan-system.md`

### MUST Requirements
- A: Two-field state model (status + stage) or canonical LifecycleState enum
- B: UNIQUE(user_id, is_current = true) for current plan resolution
- C: Stage progression: collecting → generating → complete → arrived
- D: Track lifecycle_state values

### MUST NOT
- Have multiple current plans per user
- Allow backward stage transitions

### Entity Model
- Table: relocation_plans
- Status: CREATED/ACTIVE/LOCKED/ARCHIVED (canonical LifecycleState enum)
- Stage: collecting/generating/complete/arrived
- UNIQUE(user_id, is_current=true)

### Behavior
- Plan created → ACTIVE + collecting → generating → complete → arrived
- Optional: lock plan (LOCKED status)

### Guarantees
- Current plan uniqueness
- Stage immutability (no backward)
- Plan scoping for all artifacts

### Dependencies
- **Downstream:** All artifact systems scoped to plan_id

---

## 18. Profile System
**File:** `docs/definitions/profile-system.md`

### MUST Requirements
- A: Store 65+ relocation profile fields
- B: Explicit confirmation before artifact generation
- C: Track field confidence levels (explicit, inferred, assumed)
- D: Support profile_version_id snapshots

### MUST NOT
- Auto-confirm profile
- Use inferred values in generation without explicit confirmation
- Allow artifact generation without profile.confirmed = true

### Entity Model
- v1: relocation_plans.profile_data (JSONB, 65+ fields)
- Canonical: separate profile_versions table with version_id, profile_version_number, confirmed_at
- Confidence: explicit, inferred, assumed

### Behavior
- Extraction → confidence tracking → confirmation → generation authorized

### Dependencies
- **Upstream:** Chat Interview
- **Downstream:** All generation systems

---

## 19. Progress Tracking System
**File:** `docs/definitions/progress-tracking-system.md`

### MUST Requirements
- A.1: progress_type enum: interview_progress, post_arrival_progress, pre_arrival_progress, overall_plan_progress
- B: Compute as floor((valid_items / total_items) * 100)
- C: Interview progress: required_fields[], filled_fields[], missing_fields[], completion_percentage, blockers[]
- D: Post-arrival progress from REQUIRED task completion only

### MUST NOT
- Compute progress on dashboard (server-side only)
- Combine progress_types without explicit aggregate definition
- Include optional fields in required count

### Entity Model
- Interview Progress: percentage, numerator, denominator, required_fields, filled_fields, missing_fields, blockers
- Post-arrival Progress: same structure, denominator = REQUIRED tasks only

### Guarantees
- Consistency: deterministic on every call
- No double-counting

### Dependencies
- **Upstream:** Profile, Settling-in Tasks
- **Downstream:** Dashboard, UI

---

## 20. Recommendation System
**File:** `docs/definitions/recommendation-system.md`

### MUST Requirements
- A: Support 10 recommendation types: visa_route, housing, transportation, cost_management, healthcare, legal_services, financial_services, cultural_integration, language_preparation, employer_support
- B: Bind recommendations to plan_id + profile_version_id

### MUST NOT
- Recommend without explicit generation trigger
- Infer visa type without formal visa research

### Entity Model
- Canonical: `recommendations` table — recommendation_id, plan_id, profile_version_id, recommendation_type, content, confidence_score
- 10 types as enum

### Behavior
- Visa route determined → recommendations generated → embedded in guide

### Dependencies
- **Upstream:** Visa Research
- **Downstream:** Guide Generation, Guide Viewer

---

## 21. Research System
**File:** `docs/definitions/research-system.md`

### MUST Requirements
- A: Layer 1 (generic, shared) and Layer 2 (user-specific) research
- B: Store results bound to plan_id + profile_version_id
- C: Use Firecrawl for web scraping

### MUST NOT
- Duplicate research for same destination across users (Layer 1 cached)
- Trigger research auto-generation

### Entity Model
- Canonical: `research_results` table — research_id, plan_id, profile_version_id, research_type, results (JSONB), generated_at, ttl_expires_at
- Types: visa, cost, legal, housing, cultural, employment, healthcare
- Layer 1: destination-scoped (shared), Layer 2: plan-scoped

### Behavior
- Research triggered → Layer 1 cache check → Firecrawl if needed → Layer 2 personalization → store

### Dependencies
- **Upstream:** Guide Generation (trigger), Profile
- **Downstream:** Guide Generation (results), Recommendation

---

## 22. Settling-In Tasks System
**File:** `docs/definitions/settling-in-tasks.md`

### MUST Requirements
- A: task_key as stable canonical identifier
- B: Task dependency resolution via depends_on
- C: States: NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED, OVERDUE, ARCHIVED
- D: Block tasks when dependencies not completed
- E: Detect `[TASK_DONE:exact task title]` marker in chat

### MUST NOT
- Mark task complete if dependencies blocked
- Change task_key after creation

### Entity Model
- Table: `settling_in_tasks` — task_id, plan_id, task_key, title, description, category (11 categories: LEGAL, IMMIGRATION, TAX, FINANCIAL, HEALTHCARE, HOUSING, EMPLOYMENT, EDUCATION, LOGISTICS, LIFESTYLE, GENERAL), status, priority (REQUIRED/RECOMMENDED/OPTIONAL), deadline_at, depends_on (JSONB array of task_keys)

### Behavior
- Task created → computeAvailableTasks() → user completes via UI or chat marker → cascade unlock
- OVERDUE detection server-side (T-7, T-1 urgency)

### Guarantees
- Dependency enforcement
- Deterministic availability
- Marker protocol determinism
- Idempotent completion

### Dependencies
- **Upstream:** Plan Contextual Chat (markers), User UI
- **Downstream:** Compliance, Timeline, Dashboard

---

## 23. Timeline System
**File:** `docs/definitions/timeline-system.md`

### MUST Requirements
- A: Aggregate milestones from multiple systems (flights, housing, tasks, visa events, arrivals)
- B: Timeline item types: flight, housing, visa_appointment, task, arrival
- C: Calculate urgency: T-7, T-1, T+1, OVERDUE
- D: Display in chronological order

### MUST NOT
- Include optional items in base timeline
- Display items past arrival_date without context

### Entity Model
- Canonical: `timeline_items` table — timeline_item_id, plan_id, source_type, source_id, title, scheduled_date, urgency_tier
- Aggregates from: Booking, Settling-in Tasks, Visa System, Plan

### Behavior
- Compute move_date → aggregate items → calculate urgency → sort chronologically → render

### Dependencies
- **Upstream:** Booking, Settling-in Tasks, Visa System, Plan
- **Downstream:** Dashboard, UI

---

## 24. Visa Recommendation Module
**File:** Integrated within `docs/definitions/recommendation-system.md` (no separate file)

### MUST Requirements
- Determine visa route based on origin + destination + purpose
- Generate document checklist
- Embed in guide under visa tab
- Research visa requirements via Firecrawl

### Entity Model
- Part of Recommendation System (type: visa_route)
- References: visa_type, visa_category, processing_time, requirements[], documents_needed[]

### Dependencies
- **Upstream:** Profile (citizenship, destination, purpose)
- **Downstream:** Document Checklist, Guide Generation, Local Requirements
