# Definitions vs System Audit — Gap Analysis

> Generated: 2026-03-04
> Method: Cross-reference of `docs/audits/backend-audit.md` (actual system) against `docs/audits/definitions-digest.md` (definition requirements)
> Scope: Every gap between what definitions require and what the system implements

---

## Legend

| Mismatch Type | Meaning |
|---------------|---------|
| **Missing** | Feature/system not implemented at all |
| **Partial** | Some aspects implemented, others absent |
| **Divergent** | Implemented but differently from definition |
| **Naming** | Naming/enum mismatch between definition and code |
| **Architectural** | Structural/pattern mismatch (e.g. JSONB vs table) |

| Severity | Meaning |
|----------|---------|
| **BLOCKER** | Cannot ship v1 without this |
| **HIGH** | Significant feature gap, affects multiple systems |
| **MEDIUM** | Notable gap but workaroundable |
| **LOW** | Minor divergence, cosmetic or deferrable |

---

## Gap Register

### Booking System

#### GAP-001
- **System:** Booking System
- **Definition Requirement:** Dedicated `bookings` table with booking_id, provider_id, external_booking_id, 8-state lifecycle, domain events (booking-system.md §A.1, §B.1, §E)
- **Current System Behavior:** No `bookings` table exists. Flight search via Firecrawl returns results directly to the client. No booking state tracked server-side.
- **Mismatch Type:** Missing
- **Severity:** MEDIUM
- **Evidence:** No `bookings` table in migrations 001–020. `app/api/flights/route.ts` returns search results without persistence.
- **Recommended Fix Strategy:** Defer to v2. External-search/discovery works without a booking registry. Add `bookings` table when flight/housing/government appointment bookings are tracked as first-class artifacts.

---

### Chat History System

#### GAP-002
- **System:** Chat History System
- **Definition Requirement:** Persistent `conversations` + `messages` tables with sequence_number ordering, immutability guarantees, lazy pagination (chat-history-system.md §A–§D)
- **Current System Behavior:** No conversation persistence. Chat messages exist only in the client-side React state during the session. No `conversations` or `messages` tables.
- **Mismatch Type:** Missing
- **Severity:** HIGH
- **Evidence:** No conversations/messages tables in migrations 001–020. `app/api/chat/route.ts` processes messages from request body without storing them.
- **Recommended Fix Strategy:** Defer to v2 (explicitly listed as out of scope in CLAUDE.md). When implemented, add conversations + messages tables with sequence_number.

---

### Chat Interview System

#### GAP-003
- **System:** Chat Interview System
- **Definition Requirement:** 8-state interview state machine: NOT_STARTED → PRE_PLAN_ACTIVE → PRE_PLAN_WAITING_FOR_USER → PRE_PLAN_PROCESSING → PLAN_CREATED → POST_PLAN_COLLECTING → INTERVIEW_COMPLETE → TERMINATED (chat-interview-system-definition.md §B)
- **Current System Behavior:** 4-state machine: interview → review → confirmed → complete (in `lib/gomate/state-machine.ts`)
- **Mismatch Type:** Divergent
- **Severity:** MEDIUM
- **Evidence:** `lib/gomate/state-machine.ts` exports `State = "interview" | "review" | "confirmed" | "complete"`. Definition requires 8 states.
- **Recommended Fix Strategy:** Hybrid — the 4-state machine covers the functional flow. The 8-state definition adds granularity (PRE_PLAN_ACTIVE vs PRE_PLAN_WAITING_FOR_USER). Consider aligning definition to code unless finer granularity is needed.

#### GAP-004
- **System:** Chat Interview System
- **Definition Requirement:** temperature=0 for extraction determinism (chat-interview-system-definition.md §A.1)
- **Current System Behavior:** Extraction uses GPT-4o-mini but temperature parameter not explicitly set to 0 in the extraction call.
- **Mismatch Type:** Partial
- **Severity:** MEDIUM
- **Evidence:** `app/api/chat/route.ts` — extraction call to GPT-4o-mini. Temperature defaults to model default (not explicitly 0).
- **Recommended Fix Strategy:** Adjust code — add `temperature: 0` to the extraction fetch call.

#### GAP-005
- **System:** Chat Interview System
- **Definition Requirement:** Field confidence tracking with explicit/inferred/assumed levels persisted per field (chat-interview-system-definition.md §E)
- **Current System Behavior:** Extraction confidence is tracked in chat metadata (`lastExtraction.fieldConfidence`) but NOT persisted to the database. Confidence is session-only.
- **Mismatch Type:** Partial
- **Severity:** MEDIUM
- **Evidence:** `app/api/chat/route.ts` tracks `fieldConfidence` in SSE metadata. `relocation_plans.profile_data` stores field values only, no confidence metadata.
- **Recommended Fix Strategy:** Adjust code — add `field_confidence` JSONB column to relocation_plans or embed in profile_data.

---

### Cost of Living System

#### GAP-006
- **System:** Cost of Living System
- **Definition Requirement:** Bind cost estimates to profile_version_id snapshot (cost-of-living.md §E)
- **Current System Behavior:** No profile_version_id system. Cost data is computed on-the-fly from Numbeo scrape. Not stored as versioned artifact on relocation_plans.
- **Mismatch Type:** Missing
- **Severity:** MEDIUM
- **Evidence:** `lib/gomate/numbeo-scraper.ts` and `lib/gomate/web-research.ts` compute costs at call time. No `cost_estimate` column on relocation_plans.
- **Recommended Fix Strategy:** Hybrid — add cost_estimate JSONB column to relocation_plans when profile versioning is implemented. For now, on-the-fly computation works.

#### GAP-007
- **System:** Cost of Living System
- **Definition Requirement:** Three-tier range (minimum, recommended, comfortable) with 6 categories (housing, food, transport, healthcare, administrative, lifestyle) (cost-of-living.md §B, §D)
- **Current System Behavior:** `calculateMonthlyBudget()` returns minimum + comfortable breakdown. Uses different categories (rent, utilities, food, transportation, healthcare, fitness, childcare, clothing). No "recommended" tier. No "administrative" or "lifestyle" categories.
- **Mismatch Type:** Divergent
- **Severity:** LOW
- **Evidence:** `lib/gomate/web-research.ts` — `calculateMonthlyBudget()` returns `{ minimum, comfortable, breakdown }`. Categories differ from definition.
- **Recommended Fix Strategy:** Adjust definition — code categories are more granular and practical. Add "recommended" tier as midpoint.

#### GAP-008
- **System:** Cost of Living System
- **Definition Requirement:** 30-day cache TTL for base city estimates (cost-of-living.md §C.1)
- **Current System Behavior:** Numbeo scraper has 24h in-memory cache (non-functional in serverless) + built-in fallback city data. No 30-day TTL enforcement.
- **Mismatch Type:** Divergent
- **Severity:** LOW
- **Evidence:** `lib/gomate/numbeo-scraper.ts` — `CACHE_TTL = 24 * 60 * 60 * 1000` (24h). In-memory cache doesn't persist across serverless invocations.
- **Recommended Fix Strategy:** Adjust code — implement database-backed cache with 30-day TTL. Or adjust definition to match the fallback-first approach.

---

### Dashboard System

#### GAP-009
- **System:** Dashboard System
- **Definition Requirement:** Read progress ONLY from Progress Tracking System, never compute locally (dashboard.md §B.1)
- **Current System Behavior:** Dashboard page (`app/(app)/dashboard/page.tsx`) computes some display state locally. Progress API exists at `/api/progress` but dashboard may not use it exclusively.
- **Mismatch Type:** Partial
- **Severity:** MEDIUM
- **Evidence:** `app/(app)/dashboard/page.tsx` and `app/api/progress/route.ts` both exist. Dashboard derives state from plan data directly.
- **Recommended Fix Strategy:** Adjust code — ensure dashboard reads all progress from /api/progress instead of computing inline.

#### GAP-010
- **System:** Dashboard System
- **Definition Requirement:** 10 derived dashboard states: NO_PLAN, PLAN_EXISTS_PROFILE_EMPTY, INTERVIEW_IN_PROGRESS, PROFILE_READY_UNCONFIRMED, PROFILE_CONFIRMED, ARTIFACTS_GENERATING, ARTIFACTS_READY, POST_ARRIVAL, PLAN_LOCKED, PLAN_ARCHIVED (dashboard.md §E.1)
- **Current System Behavior:** Dashboard uses plan.stage and plan.status to derive UI state, but does not implement the full 10-state derivation table.
- **Mismatch Type:** Partial
- **Severity:** LOW
- **Evidence:** `app/(app)/dashboard/page.tsx` — uses conditional rendering based on stage/status without formal state derivation.
- **Recommended Fix Strategy:** Adjust code — implement canonical state derivation function matching the definition table.

---

### Data Update System

#### GAP-011
- **System:** Data Update System
- **Definition Requirement:** DAG-based artifact dependency graph, TriggerType enum, cascade evaluation, job queue (data-update-system.md §A–§D)
- **Current System Behavior:** No formal Data Update System. Profile changes trigger inline effects in PATCH /api/profile (mark guides stale, increment plan_version). No cascade graph, no job queue.
- **Mismatch Type:** Missing
- **Severity:** HIGH
- **Evidence:** `app/api/profile/route.ts` handles staleness inline. No data-update module exists in `lib/gomate/`.
- **Recommended Fix Strategy:** Defer formalization. Current inline triggers cover the v1 use case (guide staleness). Full cascade graph needed when multiple artifact types (recommendations, housing, timeline) are added.

---

### Document Checklist System

#### GAP-012
- **System:** Document Checklist System
- **Definition Requirement:** Formal compliance model with 7-state document lifecycle (NOT_PROVIDED→UPLOADED→SUBMITTED→VERIFIED→REJECTED→EXPIRED→ARCHIVED), task-document blocking, UNIQUE constraint with profile_version_id (document-checklist.md §A–§D)
- **Current System Behavior:** Checklist is split across two minimal artifacts: generated `checklist_items` JSONB on the plan plus separate `document_statuses` JSONB with `{ completed: boolean, completedAt?: string }` per document. There is no upload, verification, expiry, or task-blocking model.
- **Mismatch Type:** Architectural
- **Severity:** HIGH
- **Evidence:** `app/api/research/checklist/route.ts` and `lib/gomate/checklist-generator.ts` generate/store `checklist_items`; `app/api/documents/route.ts` reads/writes `document_statuses` JSONB. No document lifecycle states or dependency graph exist.
- **Recommended Fix Strategy:** Adjust code — implement proper document states if v1 needs verification/expiry. Otherwise adjust definition to match v1 boolean model and defer full compliance model.

---

### Event/Trigger System

#### GAP-013
- **System:** Event/Trigger System
- **Definition Requirement:** Domain event bus with events table, AT-LEAST-ONCE delivery, idempotency_key, correlation_id, causation_id, plan ordering, 15+ event types (event-trigger-system.md §A–§E)
- **Current System Behavior:** No event bus. All triggers are inline within API route handlers. No events table, no idempotency keys, no correlation tracking.
- **Mismatch Type:** Missing
- **Severity:** HIGH
- **Evidence:** No `events` table in migrations. All state changes are direct DB updates in route handlers (e.g., `app/api/profile/route.ts` marks guides stale inline).
- **Recommended Fix Strategy:** Defer to v2. Inline triggers work for v1's limited artifact set. Event bus needed when system grows to require decoupled event processing.

---

### Flight System

#### GAP-014
- **System:** Flight System
- **Definition Requirement:** `flights` table with flight_id, plan_id binding, profile_version_id, 5-state lifecycle (SEARCH_RESULT/RECOMMENDED/SAVED/BOOKED/ARCHIVED), UNIQUE(plan_id, external_flight_id), booking materialization (flight-system.md §B.1–§E.4)
- **Current System Behavior:** No `flights` table. Flight search returns results directly to client via Firecrawl or mock data. No server-side persistence, no saving/booking states.
- **Mismatch Type:** Missing
- **Severity:** MEDIUM
- **Evidence:** No `flights` table in migrations. `app/api/flights/route.ts` returns search results without storage.
- **Recommended Fix Strategy:** Add `flights` table when flight saving/booking feature is needed. Current search-only flow works without persistence.

---

### Guide Generation System

#### GAP-015
- **System:** Guide Generation System
- **Definition Requirement:** Bind guide to profile_version_id snapshot (guide-generation.md §B)
- **Current System Behavior:** Guide has `plan_version_at_generation` (integer) but no `profile_version_id` (UUID snapshot). Guide is tied to plan_version, not a discrete profile snapshot.
- **Mismatch Type:** Divergent
- **Severity:** MEDIUM
- **Evidence:** `guides` table has `plan_version_at_generation` (migration 019) but no `profile_version_id` column. Staleness detected via plan_version comparison.
- **Recommended Fix Strategy:** Hybrid — plan_version serves the same purpose (detecting upstream changes). Add profile_version_id when formal profile versioning is implemented.

#### GAP-016
- **System:** Guide Generation System
- **Definition Requirement:** Guide lifecycle states: NOT_STARTED, QUEUED, GENERATING, COMPLETE, FAILED, STALE, ARCHIVED (guide-generation.md §C.1)
- **Current System Behavior:** Guide status CHECK constraint: draft, generating, complete, archived. Staleness tracked via separate `is_stale` boolean column, not as a status value.
- **Mismatch Type:** Divergent
- **Severity:** LOW
- **Evidence:** `guides` table CHECK(status IN ('draft','generating','complete','archived')). `is_stale` is separate boolean (migration 019).
- **Recommended Fix Strategy:** Adjust definition — the separate `is_stale` flag is architecturally cleaner than overloading status. STALE is orthogonal to lifecycle (a guide can be COMPLETE and STALE simultaneously).

#### GAP-017
- **System:** Guide Generation System
- **Definition Requirement:** Minimum 10 recommendations + completion_score >= 0.85 (guide-generation.md §D)
- **Current System Behavior:** No completion_score field. No minimum recommendation count validation. Guide quality is not formally measured.
- **Mismatch Type:** Missing
- **Severity:** LOW
- **Evidence:** `guides` table has no `completion_score` column. `app/api/guides/route.ts` does not validate recommendation count.
- **Recommended Fix Strategy:** Adjust definition — completion_score adds complexity without clear user value in v1. Consider as v2 quality gate.

---

### Guide Viewer System

#### GAP-018
- **System:** Guide Viewer System
- **Definition Requirement:** Deep linking: /plan/:plan_id/guide?tab=:tab_id&section=:section_id (guide-viewer.md §E)
- **Current System Behavior:** Guide viewer at `/guides/[id]` uses guide ID, not plan ID. No query param-based tab/section deep linking.
- **Mismatch Type:** Divergent
- **Severity:** LOW
- **Evidence:** `app/(app)/guides/[id]/page.tsx` — route uses guide ID. No tab/section query param handling observed.
- **Recommended Fix Strategy:** Adjust definition to match route structure (/guides/:guide_id). Add tab/section query params as enhancement.

#### GAP-055
- **System:** Guide Generation System
- **Definition Requirement:** Immutable, plan-scoped guide identity with stable current-pointer semantics (guide-generation.md §B, §D.5, §J)
- **Current System Behavior:** Guide metadata exists (`guide_version`, `plan_version_at_generation`, `is_stale`), but guide identity is still a mutable row model. Live data contains multiple guide rows for the same `(plan_id, destination, purpose, guide_type)` shape, and there is no DB uniqueness/current-pointer contract enforcing one logical “current” guide artifact.
- **Mismatch Type:** Architectural
- **Severity:** MEDIUM
- **Evidence:** `guides` table has no uniqueness constraint on `(plan_id, destination, purpose, guide_type)`. Authenticated localhost `GET /api/guides` on 2026-03-14 returned many duplicate Japan/study guides for the same plan.
- **Recommended Fix Strategy:** Near-term: dedupe legacy rows and add a uniqueness rule for the mutable-v1 model. Long-term: move to immutable guide versions plus a current-pointer model.

---

### Housing System

#### GAP-019
- **System:** Housing System
- **Definition Requirement:** Housing strategy + listings recommendations, booking materialization (housing-system.md §A–§E.4)
- **Current System Behavior:** No Housing System implemented. Guide has `housing_section` (JSONB) with general housing info from LLM generation. No listings, no strategy, no booking.
- **Mismatch Type:** Missing
- **Severity:** MEDIUM
- **Evidence:** No housing-specific routes in `app/api/`. `guides` table has `housing_section` JSONB but it's LLM-generated text, not structured listings.
- **Recommended Fix Strategy:** Defer to v2. Housing section in guide provides basic information. Full housing system (listings, booking) requires external provider integration.

---

### Local Requirements System

#### GAP-020
- **System:** Local Requirements System
- **Definition Requirement:** Formal requirement model with requirement_id, verification_status, blocking_task_id, profile_version_id binding, 6-state lifecycle (local-requirements.md §A–§D)
- **Current System Behavior:** Local requirements stored as JSONB (`local_requirements_research`) on relocation_plans. Structured as categories with items, but no formal requirement model, no verification, no task blocking.
- **Mismatch Type:** Architectural
- **Severity:** MEDIUM
- **Evidence:** `relocation_plans.local_requirements_research` (JSONB, migration 012). `app/api/research/local-requirements/route.ts` returns research results, not formal requirements.
- **Recommended Fix Strategy:** Hybrid — current research output provides the content. Formal requirement model (with verification and task blocking) needed when document checklist system is formalized.

---

### Notification System

#### GAP-021
- **System:** Notification System
- **Definition Requirement:** `notifications` table with 7-state lifecycle, criticality levels, idempotency deduplication, event-driven triggers (notification-system.md §A–§D)
- **Current System Behavior:** Minimal client-side compliance alerts component (`components/compliance-alerts.tsx`). No `notifications` table. No server-side notification state. Dismissals stored in localStorage.
- **Mismatch Type:** Missing
- **Severity:** MEDIUM
- **Evidence:** No `notifications` table in migrations. `components/compliance-alerts.tsx` renders client-side alerts with localStorage dismissal.
- **Recommended Fix Strategy:** Defer to v2. Current compliance alerts cover the v1 use case. Full notification system needed when event bus is implemented.

---

### Onboarding System

#### GAP-022
- **System:** Onboarding System
- **Definition Requirement:** Two distinct chat systems sharing /api/chat: Onboarding Interview Chat + Plan Contextual Chat (onboarding-system.md §B)
- **Current System Behavior:** Single /api/chat endpoint handles both pre-arrival and post-arrival modes via stage detection. Not formally separated as two chat systems.
- **Mismatch Type:** Divergent
- **Severity:** LOW
- **Evidence:** `app/api/chat/route.ts` switches between pre-arrival prompt (buildSystemPrompt) and post-arrival prompt (buildPostArrivalSystemPrompt) based on plan.stage.
- **Recommended Fix Strategy:** Adjust definition — the single endpoint with mode switching is architecturally simpler and functionally equivalent. The distinction exists in the system prompt, not the endpoint.

#### GAP-023
- **System:** Onboarding System
- **Definition Requirement:** Create plan when destination_country confirmed (onboarding-system.md §C)
- **Current System Behavior:** Plan is created on first GET /api/profile if none exists, regardless of destination. Destination extraction happens later during chat.
- **Mismatch Type:** Divergent
- **Severity:** LOW
- **Evidence:** `app/api/profile/route.ts` GET handler creates plan if none exists. Plan exists before any interview questions.
- **Recommended Fix Strategy:** Adjust definition — creating plan early (then filling it) is simpler than deferring creation until destination is known. The functional outcome is the same.

---

### Plan Contextual Chat System

#### GAP-024
- **System:** Plan Contextual Chat System
- **Definition Requirement:** Inject profile via headers (not in prompt) (plan-contextual-chat-system.md §D)
- **Current System Behavior:** Profile is sent in the request body (`{ messages, profile }`) and injected into the system prompt. Not via headers.
- **Mismatch Type:** Divergent
- **Severity:** LOW
- **Evidence:** `app/api/chat/route.ts` receives profile in request body, builds system prompt with profile data.
- **Recommended Fix Strategy:** Adjust definition — request body injection is standard Next.js pattern. Headers are unusual for complex data. The definition should match the implementation.

#### GAP-025
- **System:** Plan Contextual Chat System
- **Definition Requirement:** MUST NOT extract profile when plan.locked=true OR stage=arrived (plan-contextual-chat-system.md §MUST NOT)
- **Current System Behavior:** Profile extraction logic in chat route does check for locked/arrived state, but the enforcement may not be complete for all paths.
- **Mismatch Type:** Partial
- **Severity:** MEDIUM
- **Evidence:** `app/api/chat/route.ts` — extraction logic exists. Post-arrival mode uses different prompt without extraction directives.
- **Recommended Fix Strategy:** Verify code — confirm extraction is fully disabled when locked=true or stage=arrived. Add explicit guard if missing.

---

### Plan System

#### GAP-026
- **System:** Plan System
- **Definition Requirement:** Canonical LifecycleState enum: CREATED, ACTIVE, LOCKED, ARCHIVED, DELETED, CORRUPTED (plan-system.md §A, §D)
- **Current System Behavior:** Two-field model: `status` (active/archived/completed) + `stage` (collecting/generating/complete/arrived). No CREATED, LOCKED, DELETED, or CORRUPTED states. "completed" status exists but is not in the definition.
- **Mismatch Type:** Divergent
- **Severity:** MEDIUM
- **Evidence:** `relocation_plans` CHECK constraints: status IN ('active','archived','completed'), stage IN ('collecting','generating','complete','arrived'). Definition has 6-state LifecycleState.
- **Recommended Fix Strategy:** Hybrid — the two-field model (status + stage) is functionally richer than a single enum. Adjust definition to match the existing model. Map: CREATED≈active+collecting, ACTIVE≈active+any, LOCKED≈locked flag, ARCHIVED≈archived.

#### GAP-027
- **System:** Plan System
- **Definition Requirement:** No backward stage transitions (plan-system.md §MUST NOT)
- **Current System Behavior:** POST /api/settling-in/arrive accepts from "complete" OR "arrived" stage. Profile unlock can change plan state. No explicit backward transition guard in code.
- **Mismatch Type:** Partial
- **Severity:** MEDIUM
- **Evidence:** `app/api/settling-in/arrive/route.ts` checks stage is "complete" or "arrived". `app/api/profile/route.ts` unlock action doesn't explicitly prevent backward transitions.
- **Recommended Fix Strategy:** Adjust code — add explicit stage transition validation function that enforces one-way progression.

---

### Profile System

#### GAP-028
- **System:** Profile System
- **Definition Requirement:** profile_version_id snapshots — immutable versioned copies of profile state (profile-system.md §D)
- **Current System Behavior:** No profile versioning. Single mutable JSONB blob (`profile_data`) on relocation_plans. `plan_version` integer is monotonic counter but not a full profile snapshot.
- **Mismatch Type:** Missing
- **Severity:** HIGH
- **Evidence:** `relocation_plans.profile_data` (JSONB) is mutable. `plan_version` (integer, migration 018) tracks change count but doesn't snapshot state. No `profile_versions` table.
- **Recommended Fix Strategy:** Defer formal versioning. plan_version counter + is_stale flag covers v1 staleness detection. Full profile snapshots needed when multiple artifacts must reference exact historical profile state.

#### GAP-029
- **System:** Profile System
- **Definition Requirement:** profile.confirmed = true as prerequisite for artifact generation (profile-system.md §B, §MUST NOT)
- **Current System Behavior:** Profile "confirmation" is implemented as plan locking (PATCH /api/profile action=lock). There is no explicit `confirmed` boolean field on the profile.
- **Mismatch Type:** Divergent
- **Severity:** LOW
- **Evidence:** `app/api/profile/route.ts` — lock action transitions stage to "complete" and triggers guide generation. `locked` boolean on relocation_plans serves as confirmation proxy.
- **Recommended Fix Strategy:** Adjust definition — `locked` serves the same purpose as `confirmed`. The lock mechanism is more explicit (prevents further edits).

---

### Progress Tracking System

#### GAP-030
- **System:** Progress Tracking System
- **Definition Requirement:** 4 progress_types: interview_progress, post_arrival_progress, pre_arrival_progress, overall_plan_progress (progress-tracking-system.md §A.1)
- **Current System Behavior:** `computeProgress()` in `lib/gomate/progress.ts` returns interview progress + post-arrival progress. No pre_arrival_progress or overall_plan_progress types.
- **Mismatch Type:** Partial
- **Severity:** LOW
- **Evidence:** `lib/gomate/progress.ts` — `computeInterviewProgress()` and `computePostArrivalProgress()` only. No pre-arrival or overall aggregation.
- **Recommended Fix Strategy:** Adjust definition — pre_arrival_progress and overall_plan_progress can be derived from existing types. Add when dashboard needs them.

#### GAP-031
- **System:** Progress Tracking System
- **Definition Requirement:** Post-arrival progress from REQUIRED tasks only, exclude RECOMMENDED/OPTIONAL (progress-tracking-system.md §D)
- **Current System Behavior:** `computePostArrivalProgress()` counts all tasks (no priority filtering). No REQUIRED/RECOMMENDED/OPTIONAL priority field on settling_in_tasks.
- **Mismatch Type:** Partial
- **Severity:** MEDIUM
- **Evidence:** `lib/gomate/progress.ts` — counts `completed` tasks vs total tasks. `settling_in_tasks` table has no `priority` column.
- **Recommended Fix Strategy:** Adjust code — add `priority` column to settling_in_tasks (migration 021). Filter progress to REQUIRED tasks only.

---

### Recommendation System

#### GAP-032
- **System:** Recommendation System
- **Definition Requirement:** 10 recommendation types: visa_route, housing, transportation, cost_management, healthcare, legal_services, financial_services, cultural_integration, language_preparation, employer_support. Separate `recommendations` table. (recommendation-system.md §A)
- **Current System Behavior:** Only visa_route recommendations implemented (via `lib/gomate/visa-recommendations.ts`). Embedded in guide JSONB and chat metadata. No `recommendations` table. No other 9 types.
- **Mismatch Type:** Missing
- **Severity:** HIGH
- **Evidence:** `lib/gomate/visa-recommendations.ts` — only generates visa recommendations. No `recommendations` table in migrations. Guide sections contain LLM-generated content (not structured recommendations).
- **Recommended Fix Strategy:** Defer 9 of 10 types to v2. visa_route works via guide embedding. Full recommendation system with dedicated table needed when personalized cross-domain recommendations are prioritized.

---

### Research System

#### GAP-033
- **System:** Research System
- **Definition Requirement:** Two-layer model: Layer 1 (generic, shared across users, destination-scoped) + Layer 2 (user-specific, plan-scoped). Separate `research_results` table with TTL. (research-system.md §A–§B)
- **Current System Behavior:** Single-pass Firecrawl research stored as JSONB on relocation_plans. No Layer 1/Layer 2 separation. No shared research cache across users. No `research_results` table.
- **Mismatch Type:** Architectural
- **Severity:** MEDIUM
- **Evidence:** `relocation_plans.visa_research` and `.local_requirements_research` (JSONB). Research is per-plan, not shared. `app/api/research/*/route.ts` queries per user.
- **Recommended Fix Strategy:** Defer Layer 1 caching. Current per-plan research works for v1 user base. Shared cache needed at scale to avoid redundant Firecrawl calls.

#### GAP-034
- **System:** Research System
- **Definition Requirement:** Research results bound to profile_version_id (research-system.md §B)
- **Current System Behavior:** Research results stored on plan without profile_version_id binding. `research_freshness_days` tracks age but not profile version.
- **Mismatch Type:** Missing
- **Severity:** LOW
- **Evidence:** `relocation_plans.visa_research` (JSONB) has no profile_version_id. `research_freshness_days` (migration 019) is time-based only.
- **Recommended Fix Strategy:** Defer — bind to profile_version_id when profile versioning is implemented (see GAP-028).

---

### Settling-In Tasks System

#### GAP-035
- **System:** Settling-In Tasks System
- **Definition Requirement:** Category enum with 11 values: LEGAL, IMMIGRATION, TAX, FINANCIAL, HEALTHCARE, HOUSING, EMPLOYMENT, EDUCATION, LOGISTICS, LIFESTYLE, GENERAL (settling-in-tasks.md §entity model)
- **Current System Behavior:** 10 categories: registration, banking, housing, healthcare, employment, transport, utilities, social, legal, other. Different names, different set.
- **Mismatch Type:** Naming
- **Severity:** LOW
- **Evidence:** `lib/gomate/settling-in-generator.ts` — 10 categories defined. No IMMIGRATION, TAX, FINANCIAL, EDUCATION, LOGISTICS, LIFESTYLE, GENERAL categories.
- **Recommended Fix Strategy:** Adjust definition — code categories are practical and functional. Align definition to match code or create a mapping.

#### GAP-036
- **System:** Settling-In Tasks System
- **Definition Requirement:** Priority field: REQUIRED/RECOMMENDED/OPTIONAL per task (settling-in-tasks.md §entity model)
- **Current System Behavior:** No `priority` column on settling_in_tasks. `is_legal_requirement` boolean serves as a partial proxy (legal=required).
- **Mismatch Type:** Missing
- **Severity:** MEDIUM
- **Evidence:** `settling_in_tasks` table has `is_legal_requirement` (boolean) but no `priority` column. Migration 010–017 do not add priority.
- **Recommended Fix Strategy:** Adjust code — add `priority` column (text, CHECK(REQUIRED/RECOMMENDED/OPTIONAL)). Derive from is_legal_requirement initially: legal=REQUIRED, others=RECOMMENDED.

#### GAP-037
- **System:** Settling-In Tasks System
- **Definition Requirement:** Status states: NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED, OVERDUE, ARCHIVED (settling-in-tasks.md §C)
- **Current System Behavior:** Status states: locked, available, in_progress, completed, skipped, overdue. Different names and semantics.
- **Mismatch Type:** Naming
- **Severity:** LOW
- **Evidence:** `settling_in_tasks` CHECK(status IN ('locked','available','in_progress','completed','skipped','overdue')). Definition uses NOT_STARTED, BLOCKED instead of locked/available. Definition has ARCHIVED, code has skipped.
- **Recommended Fix Strategy:** Adjust definition — code states are more descriptive (locked vs BLOCKED, available vs implied "not started + not blocked"). Add mapping in definition.

#### GAP-038
- **System:** Settling-In Tasks System
- **Definition Requirement:** depends_on as JSONB array of `{"task_key": "key"}` objects (settling-in-tasks.md §B)
- **Current System Behavior:** depends_on is `text[]` (PostgreSQL array of task UUID strings), not JSONB array of objects.
- **Mismatch Type:** Divergent
- **Severity:** LOW
- **Evidence:** `settling_in_tasks.depends_on` is `text[]` (migration 010). Code uses simple string array, not JSONB objects.
- **Recommended Fix Strategy:** Adjust definition — text[] is simpler and sufficient. JSONB objects add unnecessary complexity for a simple dependency list.

---

### Timeline System

#### GAP-039
- **System:** Timeline System
- **Definition Requirement:** `timeline_items` table aggregating milestones from flights, housing, tasks, visa events, arrivals with urgency tiers (T-7, T-1, T+1, OVERDUE) (timeline-system.md §A–§D)
- **Current System Behavior:** No Timeline System implemented. Deadline urgency is computed on settling-in tasks only (urgent/approaching/normal in GET /api/settling-in). No aggregated timeline view.
- **Mismatch Type:** Missing
- **Severity:** MEDIUM
- **Evidence:** No `timeline_items` table in migrations. No timeline API route. Urgency computation exists only in settling-in route.
- **Recommended Fix Strategy:** Defer to v2. Settling-in task urgency covers post-arrival needs. Full timeline aggregation needed when bookings, housing, visa appointments are tracked.

---

### Visa Recommendation Module

#### GAP-040
- **System:** Visa Recommendation Module
- **Definition Requirement:** Formal visa route recommendation with document checklist generation, research binding (recommendation-system.md, integrated)
- **Current System Behavior:** `lib/gomate/visa-recommendations.ts` generates static recommendation prose, visa research via Firecrawl stores a structured `visa_research` artifact, and checklist generation only opportunistically reads `visa_research.visaOptions[selected] || [0]`. There is no formal recommendation snapshot or deterministic binding contract between visa output and checklist generation.
- **Mismatch Type:** Partial
- **Severity:** MEDIUM
- **Evidence:** `lib/gomate/visa-recommendations.ts`, `app/api/research/visa/route.ts`, and `lib/gomate/checklist-generator.ts` all exist, but they are not unified under a recommendation snapshot/pointer model.
- **Recommended Fix Strategy:** Adjust code — link visa research output to document checklist. When a visa type is determined, auto-populate required documents in document_statuses.

---

### Cross-Cutting Gaps

#### GAP-041
- **System:** Profile System / All Generation Systems
- **Definition Requirement:** All artifacts bound to profile_version_id (profile-system.md §D, guide-generation.md §B, cost-of-living.md §E, research-system.md §B)
- **Current System Behavior:** No profile_version_id system. Artifacts reference plan_version (monotonic counter) instead. No immutable profile snapshots.
- **Mismatch Type:** Architectural
- **Severity:** HIGH
- **Evidence:** `plan_version` (integer) exists on relocation_plans. `plan_version_at_generation` on guides. No `profile_versions` table or `profile_version_id` column anywhere.
- **Recommended Fix Strategy:** Defer formal versioning to v2. plan_version counter + is_stale provides functional staleness detection. Profile snapshots needed when artifacts must reference exact historical state.

#### GAP-042
- **System:** Research System / Self-HTTP Pattern
- **Definition Requirement:** No self-HTTP calls (CLAUDE.md forbidden patterns)
- **Current System Behavior:** Resolved in current code. `POST /api/research/trigger` imports and calls `performVisaResearch`, `performLocalRequirementsResearch`, and `performChecklistResearch` directly.
- **Mismatch Type:** Resolved
- **Severity:** —
- **Evidence:** `app/api/research/trigger/route.ts` — no sibling `fetch()` calls remain; shared helper functions are called directly.
- **Recommended Fix Strategy:** None. Keep orchestration at the helper layer rather than via self-HTTP.

#### GAP-043
- **System:** Cost of Living System / Forbidden Patterns
- **Definition Requirement:** No in-memory cache objects (CLAUDE.md forbidden patterns)
- **Current System Behavior:** `lib/gomate/numbeo-scraper.ts` still has in-memory cache with 24h TTL. Non-functional in serverless but code is present.
- **Mismatch Type:** Divergent
- **Severity:** LOW
- **Evidence:** `lib/gomate/numbeo-scraper.ts` — cache object exists in module scope.
- **Recommended Fix Strategy:** Adjust code — remove in-memory cache. Rely on fallback DB and fresh scrape only.

#### GAP-044
- **System:** Chat Interview System / Auth
- **Definition Requirement:** All protected routes must call `supabase.auth.getUser()` and return 401 (CLAUDE.md mandatory rules)
- **Current System Behavior:** Resolved in current code. `POST /api/chat` now performs `supabase.auth.getUser()` at route top and returns `401` when no authenticated user exists.
- **Mismatch Type:** Resolved
- **Severity:** —
- **Evidence:** `app/api/chat/route.ts` — explicit auth guard returns `{"error":"Unauthorized"}` with status `401` before route logic continues.
- **Recommended Fix Strategy:** None. Keep the explicit auth guard at the route entry.

---

### New Gaps (Discovered in Verification Audit 2026-03-04)

#### GAP-045
- **System:** Chat Interview System / AI Contract
- **Definition Requirement:** maxTokens limits on LLM calls: 500 for chat responses, 200 for extraction (chat-interview-system-definition.md §J.4)
- **Current System Behavior:** Neither the chat GPT-4o call nor the extraction GPT-4o-mini call sets maxTokens. Responses are unbounded.
- **Mismatch Type:** Missing
- **Severity:** MEDIUM
- **Evidence:** `app/api/chat/route.ts` — no `max_tokens` parameter in either fetch call to OpenAI.
- **Recommended Fix Strategy:** Adjust code — add explicit maxTokens to both calls. Prevents runaway token usage and aligns with definition.

#### GAP-046
- **System:** Chat Interview System / Termination
- **Definition Requirement:** Interview MUST terminate permanently when plan.stage transitions to "generating" (chat-interview-system-definition.md §A.3, Invariant 2)
- **Current System Behavior:** Resolved in current code. Chat now rejects requests when `planStage === "generating"` before extraction runs.
- **Mismatch Type:** Resolved
- **Severity:** —
- **Evidence:** `app/api/chat/route.ts` — explicit guard returns 400 `"Interview complete — generation in progress."` when stage is `generating`.
- **Recommended Fix Strategy:** None. Keep the termination guard in place.

#### GAP-047
- **System:** Onboarding System / Completion Flag
- **Definition Requirement:** Set `onboarding_completed = true` only AFTER first output generated and plan transitions to ACTIVE (onboarding-system.md §A.2)
- **Current System Behavior:** Resolved in current code. The lock path first sets the plan to `locked=true` and `stage="complete"`, then sets `onboarding_completed=true` only after a guide already exists or a new guide insert succeeds.
- **Mismatch Type:** Resolved
- **Severity:** — 
- **Evidence:** `app/api/profile/route.ts` — `onboarding_completed` is updated only inside the `guideReady` branch after guide readiness is confirmed.
- **Recommended Fix Strategy:** None. Keep this behavior aligned with first-output readiness.

#### GAP-048
- **System:** Chat Interview System / Error Handling
- **Definition Requirement:** Profile write failures must show error to user (chat-interview-system-definition.md §H)
- **Current System Behavior:** Resolved in current code. Chat wraps `saveProfileToSupabase()` in try/catch and exposes `profileSaveError` in SSE metadata.
- **Mismatch Type:** Resolved
- **Severity:** —
- **Evidence:** `app/api/chat/route.ts` — profile save is wrapped in try/catch and surfaced via `metadata.profileSaveError`.
- **Recommended Fix Strategy:** None. Keep surfacing write failures through metadata and UI.

#### GAP-049
- **System:** Profile System / Completeness
- **Definition Requirement:** Profile completeness computed from canonical required fields function (profile-system.md §N)
- **Current System Behavior:** Resolved in current code. `PATCH /api/profile` now normalizes against `EMPTY_PROFILE` and uses `isProfileComplete()` from the state machine instead of a hardcoded field list.
- **Mismatch Type:** Resolved
- **Severity:** —
- **Evidence:** `app/api/profile/route.ts` imports `EMPTY_PROFILE` and `isProfileComplete`, then derives `newStage` from that canonical completeness check.
- **Recommended Fix Strategy:** None. Keep route completeness bound to the shared required-fields logic.

#### GAP-050
- **System:** Profile System / Concurrency
- **Definition Requirement:** Profile writes include expected version for conflict detection (profile-system.md §F "Conflict Prevention")
- **Current System Behavior:** PATCH /api/profile supports `expectedVersion` and returns 409 on mismatch, but callers are not required to send it. Writes without `expectedVersion` still fall back to last-write-wins.
- **Mismatch Type:** Partial
- **Severity:** MEDIUM
- **Evidence:** `app/api/profile/route.ts` validates `expectedVersion` against `plan_version` when supplied, but the request contract still allows it to be omitted.
- **Recommended Fix Strategy:** Make `expectedVersion` mandatory for all profile-editing callers, including dashboard/UI edits and any future write APIs.

#### GAP-051
- **System:** Dashboard System / Post-Arrival
- **Definition Requirement:** Post-arrival dashboard shows: compliance progress bar, overdue tasks prominently, upcoming tasks with deadlines, task CTAs (dashboard.md §E.3)
- **Current System Behavior:** Post-arrival dashboard shows only a single "Settling-In Checklist" card linking to /settling-in. No progress percentage, no overdue count, no upcoming task preview.
- **Mismatch Type:** Partial
- **Severity:** MEDIUM
- **Evidence:** `app/(app)/dashboard/page.tsx` — post-arrival section renders only `<SettlingInDashboardCard />` with a link. `post_arrival_progress` is computed but never displayed on dashboard.
- **Recommended Fix Strategy:** Adjust code — add post-arrival stats card showing compliance progress %, legal requirements status, overdue count, and top 3-5 upcoming tasks.

#### GAP-052
- **System:** Visa Recommendation / Structured Output
- **Definition Requirement:** Visa recommendation output includes eligibility_factors[], assumptions[], source_references[] with structured fields (visa-recommendation.md §A.3)
- **Current System Behavior:** Visa research returns `eligibilityReason` (text) instead of structured factors. No assumptions array. `officialSources` instead of detailed source_references with reliability scores.
- **Mismatch Type:** Partial
- **Severity:** MEDIUM
- **Evidence:** `app/api/research/visa/route.ts` — VisaOption interface has `eligibilityReason: string` not `eligibility_factors: []`.
- **Recommended Fix Strategy:** Adjust code — extend VisaOption interface with structured arrays. Update AI prompt to produce structured output. Or adjust definition to accept prose-based output for v1.

#### GAP-053
- **System:** Flight System / Forbidden Pattern
- **Definition Requirement:** No Math.random() for data fields (CLAUDE.md forbidden patterns)
- **Current System Behavior:** Mock flight data is deterministic. Stop parsing still uses a heuristic fallback, but no Math.random()-driven data fields remain.
- **Mismatch Type:** RESOLVED
- **Severity:** RESOLVED
- **Evidence:** `lib/gomate/flight-search.ts` — `generateMockFlights()` uses fixed arrays and arithmetic; unmatched stop fallback is `i % 2`, not Math.random.
- **Recommended Fix Strategy:** Keep deterministic mocks. Treat stop-heuristic accuracy as a separate flight-quality issue rather than a forbidden-pattern violation.

#### GAP-054
- **System:** Guide Generation / Execution Model
- **Definition Requirement:** Guide generation must be async/queued, not blocking (guide-generation.md §G.1)
- **Current System Behavior:** POST /api/guides runs generation synchronously in the route handler. Large profiles risk hitting the 60-second Vercel timeout.
- **Mismatch Type:** Divergent
- **Severity:** MEDIUM
- **Evidence:** `app/api/guides/route.ts` — `await generateGuide(profile)` runs inline in POST handler.
- **Recommended Fix Strategy:** Defer to v2 — synchronous works for current profile sizes. Add async queue when profiles grow or generation becomes more complex.

---

### Status Update: GAP-009

Earlier review overstated GAP-009 as resolved. The dashboard does fetch `/api/progress`, but it still derives Batch 1 state locally in several places:
- it computes `requiredFields` locally via `getRequiredFields(profile)` for display
- it gates the onboarding welcome screen via local `filledCount < 3`
- it uses `plan.stage`, `plan.locked`, and other local heuristics instead of a canonical dashboard-state derivation function

So GAP-009 remains PARTIAL rather than resolved.

### Status Update: GAP-047

GAP-047 is now **RESOLVED** in the current codebase. `onboarding_completed` is no longer written during the initial lock update; it is set only after guide readiness is confirmed.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total gaps | 54 |
| Missing | 19 |
| Partial | 14 |
| Divergent | 15 |
| Naming | 3 |
| Architectural | 3 |

| Severity | Count |
|----------|-------|
| BLOCKER | 0 |
| HIGH | 7 |
| MEDIUM | 28 |
| LOW | 17 |
| RESOLVED | 6 (GAP-042, GAP-044, GAP-046, GAP-047, GAP-048, GAP-049) |

> Note: Original 44 gaps verified on 2026-03-04. 10 new gaps (GAP-045 through GAP-054) added after full 24-definition audit. Later status updates superseded the earlier GAP-009 resolution and marked GAP-042, GAP-044, GAP-046, GAP-047, GAP-048, and GAP-049 resolved. The mismatch-type counts above remain the baseline register and are not a recomputed post-follow-up total.

### HIGH Severity Gaps (Priority)

| ID | System | Summary |
|----|--------|---------|
| GAP-002 | Chat History | No conversation persistence (deferred to v2) |
| GAP-011 | Data Update | No cascade graph / job queue |
| GAP-012 | Document Checklist | Simple boolean vs 7-state compliance model |
| GAP-013 | Event/Trigger | No domain event bus |
| GAP-028 | Profile | No profile_version_id snapshots |
| GAP-032 | Recommendation | Only 1 of 10 types implemented |
| GAP-041 | Cross-cutting | No profile versioning across all systems |

### Systems with Zero Gaps
None — all 24 definition systems have at least one gap.

### Systems Fully Missing (No Implementation)
- Booking System (GAP-001)
- Chat History System (GAP-002)
- Data Update System (GAP-011)
- Event/Trigger System (GAP-013)
- Housing System (GAP-019)
- Timeline System (GAP-039)

### Recommended Triage

**Fix in v1 (code adjustments — quick fixes):**
- GAP-004: Add temperature=0 to extraction
- GAP-043: Remove in-memory cache from numbeo-scraper
- GAP-045: Add maxTokens to chat and extraction calls
- GAP-053: resolved; keep deterministic mocks and treat stop parsing as a separate quality issue

**Fix in v1 (code adjustments — medium effort):**
- GAP-025: Complete extraction guard (add stage check)
- GAP-027: Add backward stage transition validation
- GAP-031: Add priority column + filter progress to REQUIRED tasks
- GAP-036: Add priority column to settling_in_tasks (migration 021)
- GAP-050: Make expectedVersion mandatory across profile-writing callers
- GAP-051: Add post-arrival dashboard stats card
- GAP-052: Add structured fields to visa recommendation output

**Fix in v1 (definition adjustments):**
- GAP-003: Align 8-state → 4-state interview machine
- GAP-007: Align cost categories
- GAP-016: Accept is_stale as separate from status
- GAP-022: Accept single endpoint with mode switching
- GAP-023: Accept early plan creation
- GAP-024: Accept request body profile injection
- GAP-029: Accept locked as confirmation proxy
- GAP-035: Align task categories
- GAP-037: Align task status names
- GAP-038: Accept text[] for depends_on

**Defer to v2:**
- GAP-001, GAP-002, GAP-011, GAP-013, GAP-014, GAP-019, GAP-021, GAP-028, GAP-032, GAP-033, GAP-039, GAP-041, GAP-054
