# GoMate — Documentation Build Roadmap

**Version:** 1.0
**Status:** Authoritative
**Author:** Principal Systems Architect
**Date:** 2026-02-24

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Inventory Summary](#2-system-inventory-summary)
3. [Documentation Build Strategy](#3-documentation-build-strategy)
4. [Phase-by-Phase Documentation Build Plan](#4-phase-by-phase-documentation-build-plan)
5. [Documentation Principles](#5-documentation-principles)
6. [Final Target Outcome](#6-final-target-outcome)

---

## 1. Overview

### 1.1 Current System Maturity

GoMate is a relocation intelligence platform built on Next.js 16, React 19, Supabase (PostgreSQL + Auth), and OpenAI. The codebase is **70–75% functional** as a cohesive product. Several of its core user-facing systems are implemented and working. Several backend infrastructure systems described in the design contracts exist only as design intent, not as code.

The working systems:

- AI-driven chat interview with streaming and profile extraction
- Profile schema with 65+ fields and Zod validation
- Interview state machine (interview → review → confirmed → complete)
- Relocation plan persistence via Supabase
- Guide generation from completed profiles
- Subscription and feature gating (3-tier model)
- Cost of living data (Numbeo via Firecrawl)
- Flight search (Firecrawl web scraping)
- Research endpoint suite (visa, local requirements, checklist)

The systems that are designed in `/docs` contracts but do not yet exist in code:

- Formal job queue with idempotency and retry
- Observability layer (trace_id, span model, structured events, replay)
- Artifact schema system and dashboard rendering engine
- Formal Source Registry with unified Data Source Protocol
- Formal Extraction Protocol as a unified service
- Circuit breakers and structured error handling contracts
- Event sourcing / state mutation audit trail

### 1.2 Purpose of This Roadmap

This roadmap defines **how to build proper, accurate system documentation** for GoMate.

It is not a product roadmap. It does not instruct anyone to build features, implement systems, or modify code.

Its sole purpose is:

> **Define the order and method for producing PhaseDocs and SystemDocs that accurately reflect what GoMate actually is, how it actually works, and where it is heading.**

Documentation built according to this roadmap will serve as:

- The single source of truth for how each system works today
- The reference for engineers making decisions about existing code
- The alignment layer between design contracts (target) and current reality
- The foundation for future contracts that evolve the system toward the target architecture

### 1.3 Documentation Philosophy

The philosophy that governs every document built under this roadmap:

```
REAL SYSTEM → DOCUMENT ACCURATELY → ALIGN WITH TARGET
```

Not:

```
TARGET → ASSUME EXISTENCE → DOCUMENT AS IF REAL
```

Every document must begin with what the code actually does. It may conclude with what the system is intended to become. But it must never misrepresent the current state.

This is not a compromise — it is the only way to produce documentation that is trustworthy and useful.

---

## 2. System Inventory Summary

The following inventory compares reality (as observed in the repository) against the target architecture described in `/docs` contracts. Each system is given a status and a gap description.

---

### 2.1 Chat Engine / AI Interview Engine

| | |
|---|---|
| **Status** | EXISTS — Partially matches docs |
| **Primary Files** | `app/api/chat/route.ts` (538 lines), `lib/gomate/system-prompt.ts` (557 lines) |
| **What Exists** | Streaming SSE endpoint. OpenAI GPT-4o for conversation. GPT-4o-mini for extraction. Multi-field profile extraction with confidence levels (explicit / inferred / assumed). Plan lock check before extraction. Rich metadata in response (progress, visa status, sources, cost of living, savings targets). |
| **Gap vs Docs** | Docs describe `trace_id` propagation, formal Turn objects with span tracking, circuit breakers, and structured failure events. None of these exist. Docs also describe a formal extraction service as a distinct layer; in reality extraction is done inline in the chat route. |

---

### 2.2 Profile State Machine

| | |
|---|---|
| **Status** | EXISTS — State names differ significantly from docs |
| **Primary Files** | `lib/gomate/state-machine.ts` (295 lines), `lib/gomate/profile-schema.ts` (736 lines) |
| **What Exists** | Four interview states: `interview`, `review`, `confirmed`, `complete`. Dynamic field ordering via `FIELD_ORDER` array. `getNextPendingField()`, `getCompletionPercentage()`, `formatProfileSummary()`, `getProgressInfo()`. Conditional field requirements based on purpose (study / work / settle / digital_nomad). Dependent visa detection. |
| **Gap vs Docs** | Docs define five states: `INITIALIZED → IN_PROGRESS → ENRICHING → COMPLETE → ARCHIVED`. The `ENRICHING` and `ARCHIVED` states do not exist. Docs require event sourcing, idempotent transitions, audit trails, and state recovery — none are implemented. The plan table adds a parallel staging concept (`collecting`, `generating`, `complete`) that partially overlaps with but is distinct from the interview state machine. |

---

### 2.3 Profile Schema

| | |
|---|---|
| **Status** | EXISTS — Matches design intent well |
| **Primary Files** | `lib/gomate/profile-schema.ts` |
| **What Exists** | 65+ fields across categories: core identity, destination, purpose, family, financial, background, legal, special. Zod schema validation. `EMPTY_PROFILE` initializer. `getRequiredFields()` with dynamic logic. Extraction hints for AI extraction. Dependent-visa branching. |
| **Gap vs Docs** | Minor. Profile schema is well-implemented. The `Enrichment Data Contracts` in Batch 5 describe additional enrichment fields that are not reflected in the schema. `source_of_truth` field tracking (explicit vs inferred vs assumed) is implemented in chat extraction but not persisted in the profile schema itself. |

---

### 2.4 Research Orchestration System

| | |
|---|---|
| **Status** | PARTIAL — Architecture differs from docs |
| **Primary Files** | `app/api/research/trigger/route.ts`, `app/api/research/visa/route.ts`, `app/api/research/local-requirements/route.ts`, `app/api/research/checklist/route.ts`, `lib/gomate/web-research.ts` (714 lines) |
| **What Exists** | Four specialized research endpoints. Parallel trigger endpoint that fires all three research types. Firecrawl-based web scraping for visa, local requirements, and checklist. OpenAI analysis of scraped content. 7-day cache for local requirements. 24-hour cache for cost of living. Pre-compiled fallback data for 11 destinations. |
| **Gap vs Docs** | Docs describe a six-component orchestration system: Research Planner, Source Selector, Fetch Orchestrator, Extraction Coordinator, Result Aggregator, Enrichment Pipeline. None of these exist as distinct components. Research is done inline in API routes. There is no Source Registry, no intelligent source selection, no formal result aggregation, no deduplication, and no quality scoring. The architecture is functional but flat, not orchestrated. |

---

### 2.5 Persistence / Database Layer

| | |
|---|---|
| **Status** | EXISTS — Matches docs well |
| **Primary Files** | `scripts/001–009_*.sql`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/gomate/supabase-utils.ts` |
| **What Exists** | 8 SQL migrations (note: script 004 is absent from sequence). Tables: `profiles`, `relocation_plans`, `checklist_progress`, `guides`, `user_subscriptions`. Row-Level Security on all tables. Cascade delete on `auth.users`. Auto-updated timestamps via triggers. JSONB fields for flexible profile, visa, budget, and checklist storage. Auto-profile-creation trigger on signup. Partial unique index ensuring one current plan per user. |
| **Gap vs Docs** | Migration 004 is missing from the sequence (001–003 then 005–009). No event/mutation table for audit trail. No state event sourcing. Batch 5 describes a Profile Synchronization protocol and a Singleton Data Registry that have no database representation. |

---

### 2.6 Artifacts System

| | |
|---|---|
| **Status** | MISSING |
| **Primary Files** | N/A |
| **What Exists** | Nothing that constitutes a formal artifact system. The `guides` table and JSONB fields in `relocation_plans` are the closest analogues — they store structured data — but there are no artifact schemas, no metadata envelopes, no rendering directives, and no dashboard rendering engine. |
| **Gap vs Docs** | The Artifact Schemas & Dashboard Rendering Contract describes a complete system: generic data containers with metadata, dashboard templates, extraction result schemas, profile enrichment structures, and rendering directives. This system does not exist in any form in the codebase. |

---

### 2.7 Country / Destination Data

| | |
|---|---|
| **Status** | PARTIAL — Implemented as scattered hardcoded data, not a formal database |
| **Primary Files** | `lib/gomate/country-flags.ts`, `lib/gomate/official-sources.ts`, `lib/gomate/visa-recommendations.ts`, `lib/gomate/web-research.ts` (pre-compiled estimates section) |
| **What Exists** | Country flag emojis and ISO codes. Official government links per destination. Structured visa pathway descriptions for select countries (Germany, Netherlands, Spain, Portugal, Japan, Canada, USA, UK, Sweden, France, Italy, UAE). Pre-compiled monthly cost estimates for 11 cities. EU/EEA freedom-of-movement logic in `visa-checker.ts`. |
| **Gap vs Docs** | Docs imply a formal Country DB as a system. In reality it is a collection of static TypeScript objects and hardcoded arrays. Coverage is limited to ~11–15 destinations. No structured schema for country records. No version or freshness tracking. No enrichment pipeline to keep it current. |

---

### 2.8 Source Fetch Layer

| | |
|---|---|
| **Status** | PARTIAL — Single provider (Firecrawl), no unified interface |
| **Primary Files** | `lib/gomate/web-research.ts`, `lib/gomate/checklist-generator.ts`, `lib/gomate/flight-search.ts`, `lib/gomate/numbeo-scraper.ts` |
| **What Exists** | Firecrawl API used in four separate service files for different purposes. Each service integrates Firecrawl independently. Ad hoc caching (24-hour for cost of living, 7-day for local requirements). |
| **Gap vs Docs** | Batch 3 describes a Source Registry Contract (managing available sources), a Data Source Protocol (unified interface for source access), rate limiting, throttling, and credential management. None of these exist. Firecrawl is called directly from each service with no abstraction layer. There is no source registration, no unified fetch interface, and no centralized rate limiting. |

---

### 2.9 Extraction Layer

| | |
|---|---|
| **Status** | PARTIAL — Works functionally, not formalized as a protocol |
| **Primary Files** | `app/api/chat/route.ts` (profile extraction), `lib/gomate/checklist-generator.ts` (checklist extraction), `app/api/research/visa/route.ts` (visa extraction) |
| **What Exists** | Profile extraction from chat messages using GPT-4o-mini with confidence levels. Structured JSON extraction for checklist items. OpenAI-powered extraction of visa requirements from scraped pages. |
| **Gap vs Docs** | Batch 3 describes a formal Extraction Protocol (standardized process) and an Extraction Retry Strategy (exponential backoff). Neither exists. Each extraction implementation is self-contained with no shared protocol. There is no retry logic. There is no Link Enrichment system. Extraction errors are logged but not formally handled. |

---

### 2.10 Job System / Queue

| | |
|---|---|
| **Status** | MISSING |
| **Primary Files** | N/A |
| **What Exists** | The `POST /api/research/trigger` route fires parallel research requests inline, which functions as a pseudo-trigger. No background processing. No job state persistence. No retry on failure. |
| **Gap vs Docs** | Batch 4 defines a complete Job System / Queue Contract: reliable job execution, idempotency keys, retry with exponential backoff, job scheduling, and job status tracking. Nothing in this contract is implemented. GoMate has no job queue, no worker process, and no job persistence table. |

---

### 2.11 Observability Layer

| | |
|---|---|
| **Status** | MISSING |
| **Primary Files** | N/A |
| **What Exists** | `console.log` statements prefixed with `[GoMate]` throughout service files. No structure, no correlation, no tracing. |
| **Gap vs Docs** | Batch 4 defines a comprehensive Observability + Replay Contract: every chat turn and job carries a `trace_id`, state mutations emit structured events, a span model with `parent_span_id` enables distributed tracing, failure events include typed `error_code` and `error_type`, and a replay system allows re-execution of any past turn from its trace. None of this exists. |

---

### 2.12 Guide Generation

| | |
|---|---|
| **Status** | EXISTS — Matches design intent well |
| **Primary Files** | `lib/gomate/guide-generator.ts` (~57 KB), `app/api/guides/route.ts`, `app/api/guides/[id]/route.ts` |
| **What Exists** | Comprehensive guide generation from completed profiles. Guide sections: visa, budget, housing, banking, healthcare, culture, jobs, education, timeline, checklist. Country-specific recommendations. Guide stored in `guides` table. Guide generation triggered on plan lock (`PATCH /api/profile`). CRUD API for guide management. |
| **Gap vs Docs** | Guide generation is one of the most complete systems. Minor gaps: guide content is not versioned. There is no guide invalidation strategy when profile data changes. `guide_type` column exists in the table but is not fully leveraged in generation logic. |

---

### 2.13 Plans System

| | |
|---|---|
| **Status** | EXISTS — Matches design intent well |
| **Primary Files** | `lib/gomate/plan-factory.ts` (280 lines), `app/api/plans/route.ts` |
| **What Exists** | Full CRUD for relocation plans. Plan stages: `collecting`, `generating`, `complete`. Auto-title from destination and purpose. Plan switching for Pro+ users. `is_current` tracking with partial unique index. Plan locking/unlocking via `PATCH /api/profile`. Plan archiving. `listUserPlans()`, `getCurrentPlan()`, `createPlan()`, `switchCurrentPlan()`, `updatePlanProfile()`. |
| **Gap vs Docs** | Plans are well-implemented. Minor gaps: no plan snapshot/versioning. No formal plan comparison capability. |

---

### 2.14 Subscription System

| | |
|---|---|
| **Status** | EXISTS — Logic complete; payment integration absent |
| **Primary Files** | `lib/gomate/tier.ts` (419 lines), `app/api/subscription/route.ts`, `scripts/008_create_subscriptions.sql` |
| **What Exists** | Three tiers: `free`, `pro_single`, `pro_plus`. 12 features with complete access matrix. Six pricing options in SEK. `ensureSubscription()` auto-creates free tier. `canAccessFeature()`, `canCreatePlan()`, `upgradeSubscription()`, `downgradeToFree()`. Stripe fields exist in database schema (`stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`). |
| **Gap vs Docs** | Stripe payment processing is not implemented. The Stripe fields exist in the database but no Stripe SDK integration, webhook handling, or payment flow is present in the codebase. Subscription upgrades currently require manual data writes — there is no user-facing payment flow. |

---

### 2.15 Cost of Living System

| | |
|---|---|
| **Status** | EXISTS — Functional but architecturally fragile |
| **Primary Files** | `lib/gomate/numbeo-scraper.ts`, `lib/gomate/web-research.ts`, `app/api/cost-of-living/route.ts` |
| **What Exists** | Numbeo scraping via Firecrawl. 24-hour response cache. Fallback data for 10+ cities (Tokyo, Berlin, London, Paris, Amsterdam, Lisbon, Barcelona, Stockholm, Sydney, Toronto, New York). Monthly budget calculation (rent, utilities, groceries, transport, healthcare, entertainment). Family multipliers. Budget adequacy analysis against user's stated savings. |
| **Gap vs Docs** | Architecture is functional. The fragility risk is that all data depends on Firecrawl successfully scraping Numbeo, which can break at any time. There is no formal staleness contract, no TTL enforcement beyond in-memory cache, and no alerting when data is unavailable. |

---

### 2.16 Flight Search

| | |
|---|---|
| **Status** | PARTIAL — Functional for discovery, fragile for reliability |
| **Primary Files** | `lib/gomate/flight-search.ts`, `app/api/flights/route.ts`, `lib/gomate/airports.ts`, `lib/data/airports.txt` |
| **What Exists** | Multi-source flight search targeting Skyscanner, Google Flights, Momondo, Kayak, and Kiwi via Firecrawl web scraping. Cheapest / fastest / best-value flight selection logic. Mock data generation for development. Airport autocomplete from embedded airport database. One-way and round-trip support. |
| **Gap vs Docs** | No real flight API integrations. All flight data is obtained via web scraping, which is structurally unreliable. There is no actual booking capability — the system surfaces links to booking sites. No formal error handling when all scrapers fail. |

---

### 2.17 Reliability Contracts (Shared)

| | |
|---|---|
| **Status** | MISSING |
| **Primary Files** | N/A |
| **What Exists** | Basic `try/catch` blocks and `console.error` logging. HTTP error codes returned from API routes. |
| **Gap vs Docs** | The Shared Reliability Contracts document defines: standardized error codes and error types, exponential backoff retry logic, request timeout specifications, circuit breaking to prevent failure cascades, and structured logging requirements. None of these patterns are implemented in a systematic, cross-cutting way. Each service handles errors independently and inconsistently. |

---

## 3. Documentation Build Strategy

### 3.1 The PhaseDocs Philosophy

PhaseDocs are layered system documents built in phases. Each PhasDocs document for a given system must:

1. **Describe the current implementation accurately** — what files, what functions, what data flows
2. **Identify what is absent or different** from the design contracts
3. **Point toward the target architecture** described in contracts — without claiming it exists

A PhasDocs document is not a specification. It is a mirror held up to the code. It is updated as the system evolves.

A PhasDocs document for a system that does not yet exist is a **placeholder document** — it acknowledges the target, states the current gap clearly, and defines what the document will contain when the system is implemented.

### 3.2 Build Order Logic

Documents will be built in the following priority order:

**First:** Systems that are most implemented and most used. These provide immediate value and establish the documentation baseline.

**Second:** Systems that are partial — they exist but differ from their contracts. Documenting these reveals the gap between intent and reality clearly.

**Third:** Systems that exist as design contracts only. These become placeholder SystemDocs that will be completed when the systems are built.

### 3.3 Evidence-First Methodology

Every claim in every document must be traceable to code.

This means:

- Every system description must cite file paths
- Every behavior claim must cite the function or route that implements it
- Every state transition must cite the code that drives it
- Every schema must reflect what is actually in the database or type definition

Where a behavior is described in a contract but not yet in code, that must be stated explicitly and plainly.

---

## 4. Phase-by-Phase Documentation Build Plan

---

### Phase 1 — Core Truth Systems Documentation ✓ COMPLETED

**Rationale:** These are the three most deeply implemented systems in the repository. They underpin every other system. Documenting them first establishes the factual foundation all other documentation will build on.

---

#### 1.1 Profile Schema SystemDoc

**Why first:** Every system in GoMate depends on the profile. The schema is the contract for all data. It is also one of the most complete and accurate implementations in the codebase.

**What to document:**

- All 65+ fields: label, intent, category, required-ness (static and dynamic), dependencies
- The `FieldConfig` interface and its role
- `getRequiredFields()` dynamic logic — how required fields change based on `purpose` and `visa_role`
- `EMPTY_PROFILE` initialization
- Purpose types and their field implications
- Dependent visa branching logic
- Extraction hints and how they guide the AI
- The Zod schema and what it validates
- What the schema does NOT yet capture (confidence tracking per field, source of truth attribution)
- Gap vs Batch 5 Enrichment Data Contracts

**Evidence sources:** `lib/gomate/profile-schema.ts`

---

#### 1.2 Interview State Machine SystemDoc

**Why second:** The state machine drives the entire chat experience. Documenting it accurately is essential before documenting the chat engine that uses it.

**What to document:**

- The four interview states: `interview`, `review`, `confirmed`, `complete` — with precise transition conditions
- How state is determined from plan data (not stored as enum, derived from plan stage and lock status)
- `FIELD_ORDER` array — what it is, why order matters, how it groups fields
- `getNextPendingField()` — algorithm for selecting the next question
- `isProfileComplete()` — completion logic
- `getCompletionPercentage()` — weighting logic
- `formatProfileSummary()` — how profile is displayed during review
- `getProgressInfo()` — what is returned and consumed by the UI
- The plan-level staging (`collecting`, `generating`, `complete`) and how it relates to interview state
- The ABSENT states from docs (ENRICHING, ARCHIVED) — explicitly documented as target-only
- Gap vs Profile State Machine contract (event sourcing, audit trail, idempotent transitions)

**Evidence sources:** `lib/gomate/state-machine.ts`, `lib/gomate/plan-factory.ts`, `app/api/profile/route.ts`

---

#### 1.3 Persistence Layer SystemDoc

**Why third:** All systems write to and read from the database. Accurate database documentation is foundational to understanding every other system.

**What to document:**

- All 5 tables with their full column definitions, types, constraints, indexes, and RLS policies
- Trigger definitions: `profiles` auto-creation on signup, `updated_at` triggers
- JSONB column inventory: what each JSONB field stores, what schema it follows (informal)
- Migration history: scripts 001–009, what each added, the missing 004 gap
- Cascade delete chains
- The `is_current` partial unique index and its significance for plan management
- Supabase client setup: browser client vs server client, session management
- `supabase-utils.ts` helper patterns
- What is NOT in the database: no event/mutation table, no job table, no audit log
- Gap vs Batch 5 State Persistence and Profile Synchronization contracts

**Evidence sources:** `scripts/*.sql`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/gomate/supabase-utils.ts`, `middleware.ts`

---

### Phase 2 — Chat and AI Systems Documentation ✓ COMPLETED

**Rationale:** The chat engine is GoMate's primary interface. It is complex, partially matching its contracts, and essential to understand accurately before documenting the research and data systems it feeds into.

---

#### 2.1 Chat Engine SystemDoc

**What to document:**

- The full request/response cycle of `POST /api/chat`
- How conversation history is maintained and passed to OpenAI
- The streaming architecture: `TransformStream`, SSE format, how chunks are written
- The metadata injection pattern: how non-text metadata is embedded in the stream
- Profile extraction sub-flow: how messages are passed to GPT-4o-mini, what is extracted, confidence levels
- Plan lock check: what happens when `locked = true`
- State determination logic: how interview state is derived per turn
- Response metadata structure: all fields returned alongside stream
- System prompt generation: how `system-prompt.ts` produces state-aware prompts
- Opening message logic
- The AI model split: GPT-4o for chat, GPT-4o-mini for extraction
- What extraction does NOT do: no retry, no exponential backoff, no formal turn tracking
- Missing patterns from docs: trace_id, span model, circuit breakers, formal Turn objects

**Evidence sources:** `app/api/chat/route.ts`, `lib/gomate/system-prompt.ts`

---

#### 2.2 System Prompt Architecture Doc

**What to document:**

- How system prompts are dynamically generated
- State-specific prompt branches (interview / review / complete)
- Purpose-specific branching (study / work / settle / digital_nomad)
- Destination-specific context injection (EU, USA, Japan, UAE, UK)
- Dependency resolution: how purpose affects which questions are asked
- The "never re-ask" principle and how it is implemented
- Dependent visa detection in prompt logic
- Opening message variants

**Evidence sources:** `lib/gomate/system-prompt.ts`

---

#### 2.3 Visa Logic SystemDoc

**What to document:**

- `visa-checker.ts`: how visa requirement is determined (EU/EEA freedom of movement, Swiss bilateral agreements, citizenship/destination matrix)
- `visa-recommendations.ts`: structured visa pathways per destination, how they are formatted for AI
- `visa-advisor.ts`: AI-generated visa recommendations
- How visa data surfaces in the chat response metadata
- `POST /api/research/visa`: how Firecrawl scrapes official visa sources, how OpenAI analyzes results, caching behavior
- Gap vs docs: no formal visa database, all data is either hardcoded or scraped

**Evidence sources:** `lib/gomate/visa-checker.ts`, `lib/gomate/visa-recommendations.ts`, `lib/gomate/visa-advisor.ts`, `app/api/research/visa/route.ts`

---

### Phase 3 — Research and Data Systems Documentation ✓ COMPLETED

**Rationale:** Research systems are partial implementations of more ambitious contracts. Documenting them accurately reveals exactly where the architecture is flat and where it should evolve.

---

#### 3.1 Research Orchestration SystemDoc

**What to document:**

- The four research endpoints and what each does
- The parallel trigger endpoint: how it fires all three in sequence/parallel
- Research result storage: where results are persisted in `relocation_plans` JSONB
- Research caching strategy: TTLs per research type
- Firecrawl integration pattern in each research type
- OpenAI analysis step per research type
- Fallback behavior when scraping fails
- Current architecture vs. target architecture from Research Orchestration System docs:
  - What exists: four inline API routes
  - What is designed: Research Planner, Source Selector, Fetch Orchestrator, Extraction Coordinator, Result Aggregator, Enrichment Pipeline
- Document this gap explicitly and clearly

**Evidence sources:** `app/api/research/*`, `lib/gomate/web-research.ts`

---

#### 3.2 Cost of Living SystemDoc

**What to document:**

- Numbeo scraping via Firecrawl: the fetch flow
- Pre-compiled fallback estimates: the 11 cities, what data points are included
- `calculateMonthlyBudget()`: breakdown categories, family multipliers
- `calculateSavingsTarget()`: emergency fund + moving costs + visa fees formula
- Budget adequacy analysis against user savings
- 24-hour cache: how it works, where it is stored
- `GET /api/cost-of-living`: query parameters, response shape
- Fragility risks: dependency on Firecrawl + Numbeo HTML structure
- Gap vs docs: no formal staleness contract, no TTL enforcement beyond in-memory cache

**Evidence sources:** `lib/gomate/numbeo-scraper.ts`, `lib/gomate/web-research.ts`, `app/api/cost-of-living/route.ts`

---

#### 3.3 Source Fetch Layer SystemDoc (Placeholder + Reality Doc)

**What to document:**

- Reality: How Firecrawl is currently used across four independent service files
- The absence of a unified Source Registry or Data Source Protocol
- Per-service Firecrawl usage patterns (what each calls, what it expects back)
- Current ad hoc caching patterns
- Target architecture from Batch 3 contracts: Source Registry, Data Source Protocol, Extraction Protocol, rate limiting, credential management
- Document the gap as a first-class concern — this is a significant architectural missing piece

**Evidence sources:** `lib/gomate/web-research.ts`, `lib/gomate/numbeo-scraper.ts`, `lib/gomate/checklist-generator.ts`, `lib/gomate/flight-search.ts`

---

#### 3.4 Extraction Layer SystemDoc (Placeholder + Reality Doc)

**What to document:**

- Profile extraction in chat route: the full sub-flow, extraction prompt, confidence levels, how results are merged
- Checklist extraction in `checklist-generator.ts`: scrape → extract → categorize
- Visa extraction in research/visa: scrape → OpenAI parse → structured result
- The inconsistency between extraction implementations (no shared protocol)
- Target from Batch 3 contracts: unified Extraction Protocol, Extraction Retry Strategy with exponential backoff, Link Enrichment
- Document gap explicitly

**Evidence sources:** `app/api/chat/route.ts` (extraction section), `lib/gomate/checklist-generator.ts`, `app/api/research/visa/route.ts`

---

#### 3.5 Country / Destination Data SystemDoc

**What to document:**

- `country-flags.ts`: flag emojis and ISO codes — what is covered
- `official-sources.ts`: official government links per destination — coverage
- `visa-recommendations.ts`: structured visa pathway descriptions — countries covered
- Pre-compiled cost estimates in `web-research.ts`: 11 destinations, what data points
- `airports.ts` and `airports.txt`: airport database
- Coverage limitations: ~11–15 destinations with meaningful data
- Target: formal Country DB as a system with structured records and version tracking
- Document as a hardcoded-data-plus-scraping pattern, not a database system

**Evidence sources:** `lib/gomate/country-flags.ts`, `lib/gomate/official-sources.ts`, `lib/gomate/visa-recommendations.ts`, `lib/gomate/web-research.ts`

---

### Phase 4 — Product and Output Systems Documentation ✓ COMPLETED

**Rationale:** Guide generation, plans, and the subscription system are the most user-visible and best-implemented systems. Documenting them provides the product-layer clarity needed for future development.

---

#### 4.1 Guide Generation SystemDoc

**What to document:**

- Guide section structure: all sections (visa, budget, housing, banking, healthcare, culture, jobs, education, timeline, checklist)
- TypeScript interfaces for each guide section
- Country-specific recommendation logic
- How profile data drives guide content
- Guide generation trigger: what initiates it, when it runs
- `guides` table schema: all columns, how guide_type is used
- Guide retrieval API: `GET /api/guides`, `GET /api/guides/[id]`
- Guide update vs. create logic
- What guide generation does NOT do: no versioning, no invalidation on profile change
- Relationship between guide and relocation plan

**Evidence sources:** `lib/gomate/guide-generator.ts`, `app/api/guides/route.ts`, `app/api/guides/[id]/route.ts`, `scripts/005_create_guides.sql`

---

#### 4.2 Plans System SystemDoc

**What to document:**

- `RelocationPlan` interface: all fields
- Plan lifecycle: `collecting` → `generating` → `complete`
- Plan lock mechanics: what locking does, what it prevents
- `plan-factory.ts` functions: full inventory with signatures and behavior
- Plan management API: GET, POST, PATCH with all operations documented
- Plan limit enforcement by tier
- `is_current` management and plan switching
- Auto-title generation logic
- Plan archiving

**Evidence sources:** `lib/gomate/plan-factory.ts`, `app/api/plans/route.ts`, `app/api/profile/route.ts`, `scripts/002_create_relocation_plans.sql`, `scripts/009_add_plan_metadata.sql`

---

#### 4.3 Subscription System SystemDoc

**What to document:**

- Three tiers with precise feature access matrix (12 features × 3 tiers)
- Six pricing options in SEK: amounts, billing cycles, savings percentages
- `ensureSubscription()`: when called, what it creates
- `canAccessFeature()`, `hasFeatureAccess()`: how feature checks work
- `canCreatePlan()`: plan limit enforcement logic
- `upgradeSubscription()`, `downgradeToFree()`: what they do to the database record
- `user_subscriptions` table schema
- The Stripe gap: fields exist, integration does not
- `GET /api/subscription`: response shape
- `POST /api/subscription`: what operations are supported

**Evidence sources:** `lib/gomate/tier.ts`, `app/api/subscription/route.ts`, `scripts/008_create_subscriptions.sql`

---

#### 4.4 Flight Search SystemDoc

**What to document:**

- Multi-source search: which platforms are targeted via Firecrawl
- Search flow: query construction, Firecrawl invocation, result parsing
- Flight selection logic: cheapest / fastest / best-value algorithms
- Mock data mode: when activated, what it returns
- Airport database: how it works, `airports.txt` format, autocomplete
- `GET /api/flights` and `POST /api/flights` contracts
- One-way vs. round-trip handling
- Reliability limitations: web scraping fragility, no real API integrations
- No booking capability — surface links only

**Evidence sources:** `lib/gomate/flight-search.ts`, `lib/gomate/airports.ts`, `app/api/flights/route.ts`

---

#### 4.5 Checklist Generation SystemDoc

**What to document:**

- Checklist generation flow: profile input → Firecrawl research → OpenAI analysis → categorized checklist
- Document categories and priority levels
- Default fallback checklist
- `POST /api/research/checklist` contract
- `checklist_progress` table: tracking per-item completion
- `GET /api/research/checklist` contract
- Gap vs docs: no formal extraction protocol applied

**Evidence sources:** `lib/gomate/checklist-generator.ts`, `app/api/research/checklist/route.ts`, `scripts/003_create_checklist_progress.sql`

---

### Phase 5 — Infrastructure Gap Documentation ✓ COMPLETED

**Rationale:** These systems are described in contracts but do not exist. They require placeholder documentation that is honest about their absence while providing a clear target description for when they are built.

---

#### 5.1 Job System Placeholder Doc

**What to document:**

- Current state: no job queue exists. `POST /api/research/trigger` is a synchronous pseudo-trigger.
- What this means in practice: research runs inline, failures are silent, there is no retry
- Target from Batch 4: Job System / Queue Contract — idempotency, retries, scheduling, job status tracking
- Recommended future documentation structure: job schema, worker architecture, state lifecycle

**Evidence sources:** `app/api/research/trigger/route.ts` (for current reality), Batch 4 contract (for target)

---

#### 5.2 Observability Layer Placeholder Doc

**What to document:**

- Current state: `console.log` with `[GoMate]` prefix. No structure. No correlation.
- What is missing and why it matters: without trace_id, debugging cross-request issues requires log archaeology
- Target from Batch 4: trace_id propagation, span model, structured event emission, replay system
- Recommended future documentation structure: trace schema, event types, replay protocol

**Evidence sources:** Scattered console.log patterns across service files, Batch 4 contract

---

#### 5.3 Artifact System Placeholder Doc

**What to document:**

- Current state: no artifact system exists
- What fills its role today: `guides` table, JSONB fields in `relocation_plans`
- Target from Artifact Schemas & Dashboard Rendering Contract: generic artifact containers, metadata envelopes, dashboard templates, rendering directives
- Recommended future documentation structure: artifact schema, rendering contract, dashboard API

**Evidence sources:** `scripts/005_create_guides.sql`, `scripts/002_create_relocation_plans.sql` (JSONB fields), Artifact contract doc

---

#### 5.4 Reliability Contracts SystemDoc

**What to document:**

- Current state: inconsistent error handling across services, no shared patterns
- Per-service error handling patterns as they exist today
- Target from Shared Reliability Contracts: standardized error codes, error types, retry logic, timeouts, circuit breaking, structured logging
- Recommended future documentation structure: error taxonomy, retry policy, circuit breaker configuration

**Evidence sources:** Error handling patterns across `app/api/*/route.ts`, Shared Reliability Contracts doc

---

### Phase 6 — Cross-Cutting Documentation ✓ COMPLETED

**Rationale:** Authentication, middleware, and the end-to-end data flow are cross-cutting concerns that are not captured in any single system document.

---

#### 6.1 Authentication and Session Management Doc

**What to document:**

- Supabase Auth: how it works, what providers are supported
- Session management via `middleware.ts`: what routes are protected, how `updateSession` works
- `(app)/` route group: protected routes
- `auth/` route group: login, sign-up, callback, error pages
- RLS enforcement: how user isolation works
- API-level user ID verification pattern (how each API route extracts and validates the user)

**Evidence sources:** `middleware.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `app/auth/`, `app/(app)/`

---

#### 6.2 End-to-End Flow Doc (Reality Version)

**What to document:**

The actual end-to-end flow of a user going from first visit to completed relocation plan. This should be written as a narrative with code references, not as a specification. It must trace the actual data path through real files.

Flow to document:

1. User signs up → profile auto-created in DB via trigger
2. User reaches chat → `getOrCreatePlan()` called, free tier ensured
3. Chat turns → extraction, profile updates, progress tracking
4. Profile complete → state machine returns `review`
5. User confirms → state machine returns `confirmed`, plan stage updates
6. Profile locked → guide generation triggered, research triggered
7. User views dashboard → guide, checklist, visa data, cost of living rendered
8. Pro+ users → multiple plans, post-relocation features

This is the reality version of the End-to-End Example doc in `/docs`.

**Evidence sources:** `app/api/chat/route.ts`, `app/api/profile/route.ts`, `lib/gomate/plan-factory.ts`, `lib/gomate/guide-generator.ts`, `app/api/research/trigger/route.ts`

---

### Phase 7 — Frontend / UI Layer + Master Index ✓ COMPLETED (addendum, outside original roadmap scope)

**Rationale:** The six original phases covered all backend systems but left the frontend application layer (page components, navigation shell, client-side feature gating) undocumented. Phase 7 was added as a practical addendum after Phases 1–6 were complete.

---

#### 7.1 Frontend / UI Layer SystemDoc ✓ COMPLETED

**What was documented:** All five app pages (dashboard, chat, documents, guides, booking, settings), AppShell navigation, TierGate/FullPageGate components, the `app/api/documents/route.ts` API route. Key findings: settings profile form non-functional placeholder, booking always uses mock data, three independent document checklist generators, `checklist_progress` table permanently bypassed.

**Evidence sources:** `app/(app)/dashboard/page.tsx`, `app/(app)/chat/page.tsx`, `app/(app)/documents/page.tsx`, `app/(app)/guides/page.tsx`, `app/(app)/booking/page.tsx`, `app/(app)/settings/page.tsx`, `components/layout/app-shell.tsx`, `components/tier-gate.tsx`, `app/api/documents/route.ts`

---

#### 7.2 Master Documentation Index ✓ COMPLETED

**What was documented:** Synthesis of all 23 system documents — complete document registry, unified gap register (68 named gaps with P0–P3 severity), source-file-to-system cross-reference, criticality-ranked gap list, correction register, implementation priority order.

**Evidence sources:** All `/docs/systems/*.md`

---

### Phase 8 — PDF Export Addendum ✓ COMPLETED (addendum, closes discovered gap)

**Rationale:** Phase 8 closed a genuine undocumented gap discovered after Phase 7: `lib/gomate/pdf-generator.ts` (641 lines) and `app/(app)/guides/[id]/page.tsx` (936 lines) had zero coverage in any prior phase. The audit revealed a P0 bug — the PDF renderer receives a type-incompatible guide object, causing four sections to render as `undefined` in every downloaded PDF.

---

#### 8.1 PDF Export SystemDoc ✓ COMPLETED

**What was documented:** Added as Section 10 + updated gap analysis in `guide-generation.md`. Covers: `generateGuidePDF()` and `downloadGuidePDF()` exports, `GuideData` interface, PDF page structure (cover + 8 content sections), the call site in `guides/[id]/page.tsx`, and the interface mismatch table between three parallel guide type definitions. New gap codes: G-4.1-G (P0 — broken PDF), G-4.1-H (P1 — three divergent type definitions), G-4.1-I (P3 — undiscovered page).

**Evidence sources:** `lib/gomate/pdf-generator.ts`, `app/(app)/guides/[id]/page.tsx`

---

### Phase 9 — Post-Relocation Foundation & Engine

> ⚠️ **BLOCKED — NEW REPOSITORY REQUIRED**
>
> The systems defined in Phase 9 do not exist in this repository (`v0-go-mate-ui-shell-main`). These documents cannot be produced until the updated repository containing the post-relocation implementation is available.
>
> **Before writing any Phase 9 document:** Audit the new repository using the same evidence-first methodology applied in Phases 1–8. Read every relevant source file. The contracts below define intent — the code defines reality. If a contract says a system works one way and the code works another way, document the code and note the divergence, exactly as was done throughout Phases 1–8.
>
> **Contract source files (intent only — not implementation):**
> - `docs/gomate-arrival-foundation-layer.md` (Batch 7: arrival stage + persistence)
> - `docs/gomate-settling-in-engine-layer.md` (Batch 8: checklist engine + task graph + enrichment)

**Rationale:** The post-relocation system introduces a new stage lifecycle (`planning` → `arrived` → `archived`), a new `settling_in_tasks` table with a dependency graph, a generation pipeline for settling-in checklists, and AI-powered task enrichment. These are the foundational systems that all UI and chat layers in Phase 10 depend on. They must be documented and understood before the surface layers can be accurately described.

---

#### 9.1 Post-Arrival Stage & Arrival SystemDoc

**What to document:**

- The canonical stage enum: `planning`, `arrived`, `archived` — exact transition rules and invariants
- Stage fields on the plan: `arrival_date`, `stage_updated_at` — which are nullable and when
- `POST /api/plan/arrive` endpoint: request/response contract, idempotency key requirement, atomic transition logic
- Server-is-source-of-truth rule: how clients must re-fetch plan state on session start and dashboard load
- Downstream gating: how `plan.stage !== 'arrived'` blocks settling-in page, API routes, chat mode, and compliance timeline
- The shared `isPostArrivalEnabled(plan)` helper — where it lives, what it checks
- Concurrency and race conditions: duplicate click handling, cross-tab behavior, multi-plan ownership checks
- Observability events emitted on arrival transition
- What is NOT implemented vs. what the contract specifies (optional v1.1 fields: `pre_departure`, `in_transit`, user-selectable arrival date)
- Gap vs. contract: any divergence between `gomate-arrival-foundation-layer.md § 7.1` and the actual implementation

**Contract reference:** `docs/gomate-arrival-foundation-layer.md` § 7.1
**Evidence sources:** Arrival API route (to be found in new repo), plan table migrations, plan-related service files

---

#### 9.2 Settling-In Persistence SystemDoc

**What to document:**

- `settling_in_tasks` table: all columns with types, constraints, enums, and null rules
- Indexes: which exist and why each matters for query performance
- RLS policy: what clients can read/write vs. what is server-only
- The `locked` boolean: meaning, how it is computed, who may write it
- The `blocked` status: meaning, distinction from `locked`, user-settable rules
- Optional tables: `settling_in_generation_runs` (idempotency/debugging) and `settling_in_task_events` (append-only audit log) — whether implemented or absent
- Atomic completion transaction: the exact steps server performs when a task is marked done (verify → update → recompute locked for dependents → emit events)
- Idempotency on task completion: what happens if a done task is completed again
- Deletion and regeneration policy: whether tasks are hard-deleted, archived, or versioned
- Migration files: what scripts exist, sequence, what each adds
- Gap vs. contract: any divergence between `gomate-arrival-foundation-layer.md § 7.2` and the actual schema

**Contract reference:** `docs/gomate-arrival-foundation-layer.md` § 7.2
**Evidence sources:** SQL migration scripts in new repo, `settling_in_tasks` table, any persistence utility files

---

#### 9.3 Settling-In Checklist Engine SystemDoc

**What to document:**

- Generation trigger sources: `POST /api/settling-in/generate`, auto-trigger after arrival — which are implemented
- The six pipeline stages: baseline load → web research → AI personalization → merge/validation → persist → finalize — which stages are implemented vs. absent
- `GenerationContext` inputs: which profile fields are actually read at generation time
- Idempotency: the `job_key` format (`settling_in:${plan_id}:${arrival_date}`), how duplicate calls are handled
- Partial generation behavior: what happens when web research or AI fails — does a baseline-only checklist get created?
- Regeneration policy: whether regeneration is supported, and how prior tasks are handled
- API response shape of `POST /api/settling-in/generate`
- What is NOT implemented vs. what the contract specifies (country_baselines table, web research stage, generation run table)
- Gap vs. contract: any divergence between `gomate-settling-in-engine-layer.md § 8.1` and actual implementation

**Contract reference:** `docs/gomate-settling-in-engine-layer.md` § 8.1
**Evidence sources:** Checklist generation route, service files, any AI prompt files in new repo

---

#### 9.4 Task Graph & Dependency SystemDoc

**What to document:**

- The `depends_on: uuid[]` adjacency list model — how it is stored and read
- DAG invariant enforcement: where cycle detection runs (generation time, update time, or both), which algorithm is used (DFS / topological sort)
- Lock computation: the exact formula (`locked = any dep.status != done`), when it is recalculated
- Unlock transaction: the atomic sequence when a task is completed and dependents are unlocked
- Stable identifier rule: whether `task_id` (not title) is consistently used for dependencies
- Dependency validation: whether cross-plan references are prevented and self-referencing is blocked
- What is NOT implemented vs. what the contract specifies (edit-time cycle checking, dependency editing UI)
- Gap vs. contract: any divergence between `gomate-settling-in-engine-layer.md § 8.2` and actual implementation

**Contract reference:** `docs/gomate-settling-in-engine-layer.md` § 8.2
**Evidence sources:** Task completion route, graph validation utilities, generation service in new repo

---

#### 9.5 Why-It-Matters Enrichment SystemDoc

**What to document:**

- `POST /api/settling-in/{task_id}/why-it-matters`: request/response contract, auth requirements
- Lazy-load trigger: whether enrichment is user-initiated only or auto-generated at any point
- Storage: whether `settling_in_tasks.why_it_matters` is the canonical cache field and how cache-hit is detected
- Idempotency: what happens on duplicate enrichment requests for the same task
- Rate limiting: whether a per-user daily limit is enforced and at what threshold
- LLM safety rules: whether hedging language is enforced in the prompt, how hallucinated legal claims are prevented
- Failure handling: what is returned on generation failure, whether partial text can be stored
- What is NOT implemented vs. what the contract specifies (rate limit enforcement, audit events)
- Gap vs. contract: any divergence between `gomate-settling-in-engine-layer.md § 8.3` and actual implementation

**Contract reference:** `docs/gomate-settling-in-engine-layer.md` § 8.3
**Evidence sources:** Enrichment API route, LLM prompt files, any rate-limiting middleware in new repo

---

### Phase 10 — Post-Relocation UI, Chat Integration & Compliance

> ⚠️ **BLOCKED — DEPENDS ON PHASE 9**
>
> Phase 10 documents the user-facing surfaces of the post-relocation system. All three documents depend on Phase 9 being implemented and documented first. The same audit-first methodology applies: read the actual code in the new repository before writing any document.
>
> **Contract source file (intent only — not implementation):**
> - `docs/gomate-uI-chat-integration-and-compliance-layer.md` (Batch 9: chat mode + task completion via chat + compliance timeline)

**Rationale:** The post-arrival chat mode switch, task completion via the `[TASK_DONE:<id>]` marker protocol, and the compliance timeline and alert system are the three surfaces where the post-relocation backend becomes visible to users. They are the highest-complexity integration points and the most likely sources of bugs — mode leakage, marker spoofing, stale deadline calculations. Accurate documentation requires reading the actual implementation.

---

#### 10.1 Post-Arrival Chat Mode SystemDoc

**What to document:**

- Mode determination logic in `POST /api/chat`: how the route fetches plan stage and selects the system prompt builder
- `buildPostArrivalSystemPrompt(context)`: what inputs it takes, what task fields are injected into the prompt, the controlled format used (never raw DB JSON)
- Mode switch rule: server-authoritative check (`plan.stage === 'arrived'`), whether client can influence mode selection
- Token safety: maximum tasks injected (contract says 50), how overflow is handled (summary vs. full list)
- Missing-tasks fallback: what the prompt contains when no checklist has been generated yet
- Behavioral rules enforced in the prompt: what the assistant is allowed and forbidden to do (invent tasks, claim legal guarantees, directly mutate DB)
- What is NOT implemented vs. what the contract specifies (observability events, explicit token budget management)
- Gap vs. contract: any divergence between `gomate-uI-chat-integration-and-compliance-layer.md § 9.1` and actual implementation

**Contract reference:** `docs/gomate-uI-chat-integration-and-compliance-layer.md` § 9.1
**Evidence sources:** `app/api/chat/route.ts` (updated version in new repo), post-arrival system prompt builder file

---

#### 10.2 Task Completion via Chat SystemDoc

**What to document:**

- The `[TASK_DONE:<task_id>]` marker format: exact syntax, whether `task_id` (UUID) is used as specified (not title)
- LLM prompt instructions: the confirmation phrases that trigger marker emission (`"I completed..."`, `"I have done..."` etc.), how ambiguous statements are handled
- Frontend parsing: which component parses the marker, how it is stripped from visible text, the "Task completed" badge rendering
- The `PATCH /api/settling-in/{task_id}` call triggered by the frontend: request shape, auth, idempotency behavior
- Server verification steps: task ownership, plan ownership, `locked === false` check, `plan.stage === 'arrived'` check
- Completion transaction: whether it is the same atomic transaction as described in Phase 9.2 (status → done + unlock dependents + emit events)
- Idempotency: behavior when a marker fires for an already-completed task
- Spoof protection: layers in place (marker stripped from UI, server ownership verification)
- What is NOT implemented vs. what the contract specifies (optional `completion_confirmation` flag)
- Gap vs. contract: any divergence between `gomate-uI-chat-integration-and-compliance-layer.md § 9.2` and actual implementation

**Contract reference:** `docs/gomate-uI-chat-integration-and-compliance-layer.md` § 9.2
**Evidence sources:** Chat route (new repo), `components/chat/chat-message-content.tsx`, `PATCH /api/settling-in/[task_id]` route

---

#### 10.3 Compliance Timeline & Alerting SystemDoc

**What to document:**

- Derived deadline fields: `deadline_date = arrival_date + deadline_days`, `days_remaining = deadline_date - today`, `task_state` enum (overdue / due_soon / completed / upcoming) — whether computed server-side or client-side
- Timeline rendering rules: color thresholds (red/yellow/green/gray) and the exact conditions that trigger each
- Timeline ordering: whether legal tasks are sorted first and by `deadline_date` ascending
- `ComplianceAlerts` component: how it fetches data (`GET /api/settling-in`), the check-on-read pattern (no cron jobs)
- Alert thresholds: overdue (`deadline_date < today`) and due-soon (`deadline_date within 7 days`)
- Alert rendering: banner types, dismiss behavior
- Dismissal persistence: whether dismissals are stored in `localStorage` or in a server-side `compliance_alert_dismissals` table — which was actually implemented
- Compliance invariants: that alerts never block the UI, work with partial task lists, and show nothing if tasks are missing
- What is NOT implemented vs. what the contract specifies (server-side dismissal table, observability events)
- Gap vs. contract: any divergence between `gomate-uI-chat-integration-and-compliance-layer.md § 9.3` and actual implementation

**Contract reference:** `docs/gomate-uI-chat-integration-and-compliance-layer.md` § 9.3
**Evidence sources:** `ComplianceAlerts` component, `GET /api/settling-in` route, any dismissal persistence implementation in new repo

---

## 5. Documentation Principles

The following principles govern every document produced under this roadmap. They are non-negotiable.

---

### 5.1 Reality First

No document may describe a system behavior that does not exist in code.

If a behavior is defined in a contract doc but not implemented, that document must say so explicitly:

> "This behavior is defined in the [Contract Name] but is not yet implemented. See [file] for the current approach."

---

### 5.2 File Path Citations Are Mandatory

Every claim about system behavior must cite the file and, where appropriate, the function or line range that implements it.

Format:

> `lib/gomate/state-machine.ts:getNextPendingField()` — selects the next unanswered required field based on `FIELD_ORDER` priority.

This ensures that as the codebase evolves, documentation drift is immediately detectable.

---

### 5.3 Gaps Are First-Class Content

Gaps between reality and target architecture are not omissions to hide. They are essential content.

Every system document must contain a dedicated **Gap Analysis** section that lists:

- What the design contract specifies
- What currently exists
- What is absent

---

### 5.4 Never Invent Behavior

If a behavior cannot be confirmed in code, do not describe it.

Phrases like "the system handles this by..." require evidence. If the evidence does not exist, the honest statement is: "This case is not explicitly handled in the current implementation."

---

### 5.5 Documents Evolve With the System

Documents are not written once and forgotten. As systems are built, documents must be updated.

This means:

- Placeholder documents are upgraded to full SystemDocs when systems are implemented
- Existing SystemDocs are revised when implementations change
- Gap Analysis sections shrink as gaps are closed

---

### 5.6 Target Architecture Is Always Visible

While a document must describe reality, it must also show the target.

Every document for a partial or missing system must include a **Target State** section drawn directly from the relevant design contract. This provides direction without creating confusion about what currently exists.

---

### 5.7 Consistency of Terminology

Use only the terms that appear in the codebase. Do not invent new names or use contract terminology when it refers to something that does not exist.

Example: The docs use "Fetch Orchestrator" for a component that does not exist. Use this term only in the Target State section, clearly marked as a target concept.

---

## 6. Final Target Outcome

Upon completion of this roadmap, GoMate will have:

---

### A Complete System Document Library

Every major system will have a corresponding SystemDoc that:

- Describes its current implementation with file-level precision
- Documents its data flows, state transitions, and API contracts
- Maps it against its design contract
- Identifies gaps explicitly
- Points toward its target architecture

---

### A Reality-Based Foundation

No document will make claims that cannot be verified in code. Engineers reading these documents will trust them because every statement can be independently confirmed.

---

### A Target-Aligned Roadmap

The gap analyses embedded in each document, taken together, form a clear picture of what must be built to fully realize the GoMate architecture as designed in the contracts.

This is the natural starting point for future engineering planning — not a separate strategy document, but the emergent result of honest documentation.

---

### A Living Documentation System

These documents are not a project artifact. They are a permanent part of the GoMate repository. They evolve as the system evolves. The documentation maturity of GoMate will advance in lock-step with its engineering maturity.

---

**The end state is a codebase where the documentation is as trustworthy as the tests: if it says a system does something, that system does it. If it says something is missing, that thing is missing. No ambiguity. No aspirational fiction. No drift.**

---

*End of roadmap.*
