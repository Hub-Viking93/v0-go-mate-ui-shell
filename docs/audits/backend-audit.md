# Backend Audit — How the System Actually Works Today

> Generated: 2026-03-04
> Scope: All API routes, data model, generation pipelines, event/trigger mechanisms, system invariants
> Source: Code analysis of `app/api/`, `lib/gomate/`, `lib/supabase/`, `scripts/001–020`, `middleware.ts`

---

## Table of Contents

1. [System Surface — API Routes](#1-system-surface--api-routes)
2. [Data Model — Tables, Columns, Constraints](#2-data-model)
3. [Artifact Generation Pipeline](#3-artifact-generation-pipeline)
4. [Event / Trigger System](#4-event--trigger-system)
5. [System Invariants](#5-system-invariants)

---

## 1. System Surface — API Routes

### Legend

| Symbol | Meaning |
|--------|---------|
| AUTH | `supabase.auth.getUser()` → 401 |
| TIER | `getUserTier()` → 403 if tier insufficient |
| STAGE | Verifies `plan.stage` → 400 if wrong |

---

### 1.1 Chat

#### POST /api/chat
**File:** `app/api/chat/route.ts`
**Auth:** Explicit (`supabase.auth.getUser()` at route top)
**Tier:** None
**Stage:** Checks `plan.stage === 'arrived'` to switch between pre-arrival and post-arrival prompt

**Request:**
```typescript
{ messages: UIMessage[], profile?: Profile, confirmed?: boolean }
```

**Response:** SSE stream with events: `message-start`, `text-delta`, `message-end`
Each stream includes metadata:
```typescript
{
  profile, state, pendingField, filledFields, requiredFields,
  progressInfo, relevantSources, visaStatus, officialSources,
  planLocked, profileSummary, visaRecommendation, costOfLiving,
  budget, savings, researchReport, lastExtraction
}
```

**Logic:**
- Pre-arrival: GPT-4o chat with profile extraction via GPT-4o-mini
- Post-arrival: GPT-4o chat with settling-in task context, marker protocol `[TASK_DONE:exact task title]`
- Tracks extraction confidence: explicit/inferred/assumed
- Confirms destination and citizenship on first extraction (Phase 10)
- Marks guides as stale on profile changes (Phase 9)
- maxDuration: 30s

---

### 1.2 Profile

#### GET /api/profile
**File:** `app/api/profile/route.ts` | AUTH
**Request:** None
**Response:** `{ plan: RelocationPlan }`
**Logic:** Fetches user's current plan (is_current=true). Creates new plan if none exists.

#### PATCH /api/profile
**File:** `app/api/profile/route.ts` | AUTH
**Request:** `{ profileData?: Partial<Profile>, planId?: string, action?: "lock" | "unlock", expectedVersion?: number }`
**Response:** `{ plan: RelocationPlan, locked?: boolean }`
**Logic:**
- Merges profile data into existing profile_data JSONB
- Lock: sets stage to "complete", increments plan_version, triggers guide generation
- Marks guides stale on profile changes
- If `expectedVersion` is supplied, rejects stale writes with 409 conflict
- Sets onboarding_completed only after a guide already exists or a new guide insert succeeds
- Returns 403 if plan is locked and attempting profile update

---

### 1.3 Plans

#### GET /api/plans
**File:** `app/api/plans/route.ts` | AUTH
**Response:** `{ plans: Plan[], tier: Tier }`
**Logic:** Lists all user plans ordered by is_current DESC, created_at DESC. Returns tier info.

#### POST /api/plans
**File:** `app/api/plans/route.ts` | AUTH | TIER
**Request:** `{ title?: string }`
**Response:** `{ plan: RelocationPlan }`
**Logic:** Creates new plan. Checks `canCreatePlan()` (free=1, pro_single=3, pro_plus=unlimited). Clears is_current on existing plans. Auto-generates title.

#### PATCH /api/plans
**File:** `app/api/plans/route.ts` | AUTH
**Request:** `{ planId: string, action: "switch" | "rename" | "archive", title?: string }`
**Response:** `{ plan: RelocationPlan }`
**Logic:**
- switch: RPC `switch_current_plan` (atomic)
- rename: updates plan title
- archive: sets status="archived", is_current=false, increments plan_version

---

### 1.4 Guides

#### GET /api/guides
**File:** `app/api/guides/route.ts` | AUTH
**Response:** `{ guides: Guide[] }`
**Logic:** Lists all user guides, newest first.

#### POST /api/guides
**File:** `app/api/guides/route.ts` | AUTH
**Request:** `{ planId?: string, guideId?: string }`
**Response:** `{ guide: Guide, created: boolean, updated: boolean }`
**Logic:** Generates guide from a plan profile. If `guideId` is supplied, regenerates that exact guide row after verifying ownership (and optional plan match). Otherwise updates the newest plan-scoped `guide_type="main"` guide for the same destination/purpose, or inserts a new row. Increments `guide_version` on update, clears staleness flags. maxDuration: 60s.

#### GET /api/guides/[id]
**File:** `app/api/guides/[id]/route.ts` | AUTH
**Response:** `{ guide: Guide }`

#### DELETE /api/guides/[id]
**File:** `app/api/guides/[id]/route.ts` | AUTH
**Response:** `{ success: true }`

---

### 1.5 Settling-In

#### GET /api/settling-in
**File:** `app/api/settling-in/route.ts` | AUTH | TIER(pro_plus) | STAGE(arrived)
**Response:**
```typescript
{
  tasks: SettlingTask[], planId: string, arrivalDate: string | null,
  stage: string, generated: boolean,
  stats: { total, completed, overdue, available, locked, legalTotal, legalCompleted, progressPercent }
}
```
**Logic:**
- Returns empty tasks if stage !== 'arrived'
- Computes deadline_at from deadline_days + arrival_date on read
- Auto-detects OVERDUE tasks (past deadline, not completed/skipped)
- Auto-unlocks via `computeAvailableTasks()`
- Computes urgency: overdue/urgent/approaching/normal
- Surfaces block_reason and blocked_by for locked tasks
- Persists OVERDUE status changes to DB

#### POST /api/settling-in/arrive
**File:** `app/api/settling-in/arrive/route.ts` | AUTH | TIER(pro_plus)
**Request:** `{ arrivalDate?: string }` (defaults to today)
**Response:** `{ success: true, arrivalDate, stage: "arrived", planId }`
**Logic:** Sets plan.stage to "arrived". Sets arrival_date. Recomputes deadline_at for all tasks. Only from "complete" or "arrived" stage.

#### POST /api/settling-in/generate
**File:** `app/api/settling-in/generate/route.ts` | AUTH | TIER(pro_plus) | STAGE(arrived)
**Response:** `{ tasks: SettlingTask[], cached: boolean, planId, researchSources? }`
**Logic:**
- Returns cached tasks if already generated
- Calls `generateSettlingInPlan()` (Claude Sonnet 4 via OpenRouter)
- Validates DAG acyclicity; strips dependencies if cycle detected
- Creates tempId→UUID mapping for dependency resolution
- Computes deadline_at from arrival_date + deadline_days
- Marks tasks as "available" (no deps) or "locked" (has deps)
- Sets post_relocation_generated=true

#### PATCH /api/settling-in/[id]
**File:** `app/api/settling-in/[id]/route.ts` | AUTH | TIER(pro_plus) | STAGE(arrived)
**Request:** `{ status: "available" | "in_progress" | "completed" | "skipped" | "overdue" }`
**Response:** `{ success: true, taskId, status }`
**Logic:** Updates task status. Sets completed_at on completion. Blocks completion of locked tasks. Auto-unlocks dependents via `computeAvailableTasks()`.

#### POST /api/settling-in/[id]/why-it-matters
**File:** `app/api/settling-in/[id]/why-it-matters/route.ts` | AUTH | TIER(pro_plus)
**Response:** `{ whyItMatters: string, cached: boolean }`
**Logic:** Returns cached explanation if exists. Rate limits to 20 per plan (429). Generates via Claude Sonnet 4 (maxTokens: 300). Saves to task.why_it_matters.

---

### 1.6 Documents

#### GET /api/documents
**File:** `app/api/documents/route.ts` | AUTH
**Response:** `{ planId, statuses: Record<string, { completed, completedAt? }>, checklistItems }`

#### PATCH /api/documents
**File:** `app/api/documents/route.ts` | AUTH
**Request:** `{ documentId: string, completed: boolean }`
**Response:** `{ success: true, statuses }`

---

### 1.7 Research

#### POST /api/research/trigger
**File:** `app/api/research/trigger/route.ts` | AUTH
**Request:** `{ planId: string }`
**Response:** `{ message, status, results?: { visa, localRequirements, checklist } }`
**Logic:** Verifies the plan belongs to the user and is already `locked=true` with `stage in ("complete","arrived")`. Orchestrates parallel research by calling shared service helpers directly (`performVisaResearch`, `performLocalRequirementsResearch`, `performChecklistResearch`). The trigger route itself owns aggregate `research_status` (`in_progress` → `completed` or `failed`) and returns `409` if research is invoked before lock. maxDuration: 60s.

#### GET /api/research/trigger
**File:** `app/api/research/trigger/route.ts` | AUTH
**Response:** `{ status, completedAt?, hasVisaResearch, hasLocalRequirements }`

#### POST /api/research/visa
**File:** `app/api/research/visa/route.ts` | AUTH
**Request:** `{ planId: string }`
**Response:** `{ research: VisaResearchResult }`
**Logic:** Firecrawl scrape of official immigration sites → GPT-4o-mini analysis → normalized visa options with eligibility. Saves to plan.visa_research.

#### GET /api/research/visa
**File:** `app/api/research/visa/route.ts` | AUTH
**Response:** `{ research, visaResearch, status, completedAt? }`

#### POST /api/research/local-requirements
**File:** `app/api/research/local-requirements/route.ts` | AUTH
**Request:** `{ planId: string, forceRefresh?: boolean }`
**Response:** `{ research: LocalRequirementsResult, cached, cachedAt? }`
**Logic:** Scrapes official sources → GPT-4o-mini structuring into categories. 7-day cache. Saves to plan.local_requirements_research.

#### GET /api/research/local-requirements
**File:** `app/api/research/local-requirements/route.ts` | AUTH
**Response:** `{ research, cachedAt?, status }`

#### GET /api/research/checklist
**File:** `app/api/research/checklist/route.ts` | AUTH
**Response:** `{ planId, checklist, hasVisaResearch }`

#### POST /api/research/checklist
**File:** `app/api/research/checklist/route.ts` | AUTH
**Request:** `{ planId?: string }`
**Response:** `{ success: true, checklist, planId }`

---

### 1.8 Progress

#### GET /api/progress
**File:** `app/api/progress/route.ts` | AUTH
**Request:** Query param `plan_id` (optional, defaults to current plan)
**Response:** `{ plan_id, stage, ...computedProgress }`
**Logic:** Calls `computeProgress(profile, tasks)` from `lib/gomate/progress.ts`.

---

### 1.9 Subscription

#### GET /api/subscription
**File:** `app/api/subscription/route.ts` | AUTH
**Response:** `{ subscription, plans: { current, limit, canCreate }, features: Record<Feature, boolean>, pricing }`
**Logic:** Returns tier, feature access map, plan limits, pricing info. Uses `ensureSubscription()`.

---

### 1.10 Flights

#### GET /api/flights
**File:** `app/api/flights/route.ts` | No Auth
**Response:** `{ sources, popularAirports }`

#### POST /api/flights
**File:** `app/api/flights/route.ts` | No Auth
**Request:** `{ from, to, departDate, returnDate?, travelers?, cabinClass?, useMock? }`
**Response:** `{ results, allFlights, cheapest, fastest, bestValue, isMock }`
**Logic:** Firecrawl flight search or mock data fallback.

---

### 1.11 Airports

#### GET /api/airports
**File:** `app/api/airports/route.ts` | No Auth
**Request:** Query params `q`, `limit`
**Response:** `{ airports, total, query? }`
**Logic:** Local airport data search (30 pre-loaded hubs).

---

### 1.12 Cost of Living

#### GET /api/cost-of-living
**File:** `app/api/cost-of-living/route.ts` | No Auth
**Request:** Query params `country` (required), `city`, `compareFrom`, `compareFromCountry`
**Response:** Cost data with `isFallback` flag. Always returns 200.
**Logic:** Numbeo scrape with pre-compiled fallback data for a limited built-in city set, plus generic fallback.

#### POST /api/cost-of-living
**File:** `app/api/cost-of-living/route.ts` | AUTH
**Request:** `{ lifestyleLevel, includeItems }`
**Response:** `{ success: true }`
**Logic:** Saves cost preferences to profile_data.cost_preferences.

---

### Route Summary

| Category | Routes | Auth | Tier-Gated | Stage-Checked |
|----------|--------|------|------------|---------------|
| Chat | 1 | Implicit | 0 | 1 |
| Profile | 2 | 2 | 0 | 0 |
| Plans | 3 | 3 | 1 (POST) | 0 |
| Guides | 4 | 4 | 0 | 0 |
| Settling-In | 5 | 5 | 5 | 3 |
| Documents | 2 | 2 | 0 | 0 |
| Research | 8 | 8 | 0 | 0 |
| Progress | 1 | 1 | 0 | 0 |
| Subscription | 1 | 1 | 0 | 0 |
| Flights | 2 | 0 | 0 | 0 |
| Airports | 1 | 0 | 0 | 0 |
| Cost of Living | 2 | 1 | 0 | 0 |
| **Total** | **32 methods** | **27** | **6** | **4** |

---

## 2. Data Model

### 2.1 Tables

**6 core tables + 1 RPC function**, defined across migrations 001–020 (no migration 004 — intentional gap).

#### profiles
**Migration:** 001 | **Purpose:** User identity linked to auth.users

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK, refs auth.users ON DELETE CASCADE | — |
| first_name | text | — | NULL |
| last_name | text | — | NULL |
| email | text | — | NULL |
| avatar_url | text | — | NULL |
| created_at | timestamptz | NOT NULL | now() |
| updated_at | timestamptz | NOT NULL | now() |

RLS: SELECT/INSERT/UPDATE/DELETE where auth.uid() = id
Trigger: `on_auth_user_created` → `handle_new_user()` auto-creates profile from auth metadata

---

#### relocation_plans
**Migration:** 002 + 006 + 009 + 010 + 012 + 013 + 016 + 018 + 019 + 020

| Column | Type | Constraints | Default | Migration |
|--------|------|-------------|---------|-----------|
| id | uuid | PK | gen_random_uuid() | 002 |
| user_id | uuid | NOT NULL, FK→auth.users CASCADE | — | 002 |
| profile_data | jsonb | — | '{}' | 002 |
| stage | text | CHECK(collecting,generating,complete,arrived) | 'collecting' | 002/010 |
| locked | boolean | — | false | 002 |
| locked_at | timestamptz | — | NULL | 002 |
| target_date | date | — | NULL | 002 |
| visa_recommendations | jsonb | — | '[]' | 002 |
| budget_plan | jsonb | — | '{}' | 002 |
| checklist_items | jsonb | — | '[]' | 002 |
| created_at | timestamptz | NOT NULL | now() | 002 |
| updated_at | timestamptz | NOT NULL | now() | 002 |
| document_statuses | jsonb | — | '{}' | 006 |
| title | text | — | NULL | 009 |
| status | text | CHECK(active,archived,completed) | 'active' | 009 |
| is_current | boolean | NOT NULL | false | 009 |
| arrival_date | date | — | NULL | 010 |
| post_relocation_generated | boolean | — | false | 010 |
| visa_research | jsonb | — | NULL | 012 |
| local_requirements_research | jsonb | — | NULL | 012 |
| research_status | text | — | NULL | 016 |
| research_completed_at | timestamptz | — | NULL | 016 |
| plan_version | integer | — | 1 | 018 |
| research_freshness_days | integer | — | NULL | 019 |
| onboarding_completed | boolean | — | false | 020 |

Indexes: user_id, status, UNIQUE PARTIAL (user_id) WHERE is_current=true
RLS: SELECT/INSERT/UPDATE/DELETE where auth.uid() = user_id

---

#### settling_in_tasks
**Migration:** 010 + 011 + 015 + 017

| Column | Type | Constraints | Default | Migration |
|--------|------|-------------|---------|-----------|
| id | uuid | PK | gen_random_uuid() | 010 |
| plan_id | uuid | NOT NULL, FK→relocation_plans CASCADE | — | 010 |
| user_id | uuid | NOT NULL, FK→auth.users CASCADE | — | 010 |
| task_key | text | NOT NULL, UNIQUE(plan_id, task_key) | — | 010/015 |
| title | text | NOT NULL | — | 010 |
| description | text | — | NULL | 010 |
| category | text | NOT NULL | — | 010 |
| depends_on | text[] | — | '{}' | 010 |
| unlocked | boolean | — | false | 010 |
| status | text | CHECK(locked,available,in_progress,completed,skipped,overdue) | 'locked' | 010/017 |
| completed_at | timestamptz | — | NULL | 010 |
| deadline_days | integer | — | NULL | 010 |
| deadline_source | text | — | NULL | 010 |
| is_legal_requirement | boolean | — | false | 010 |
| why_it_matters | text | — | NULL | 010 |
| how_to | text | — | NULL | 010 |
| official_link | text | — | NULL | 010 |
| estimated_time | text | — | NULL | 010 |
| cost_estimate | text | — | NULL | 010 |
| tips | text[] | — | '{}' | 010 |
| sort_order | integer | — | 0 | 010 |
| steps | text[] | — | NULL | 011 |
| documents_needed | text[] | — | NULL | 011 |
| cost | text | — | NULL | 011 |
| deadline_at | timestamptz | — | NULL | 017 |
| deadline_anchor | text | — | 'arrival_date' | 017 |
| created_at | timestamptz | NOT NULL | now() | 010 |
| updated_at | timestamptz | NOT NULL | now() | 010 |

Indexes: plan_id, user_id, status, category
RLS: SELECT/INSERT/UPDATE/DELETE where auth.uid() = user_id

---

#### guides
**Migration:** 005 + 007 + 019

| Column | Type | Constraints | Default | Migration |
|--------|------|-------------|---------|-----------|
| id | uuid | PK | gen_random_uuid() | 005 |
| user_id | uuid | NOT NULL, FK→auth.users CASCADE | — | 005 |
| plan_id | uuid | FK→relocation_plans SET NULL | NULL | 005 |
| title | text | NOT NULL | — | 005 |
| destination | text | NOT NULL | — | 005 |
| destination_city | text | — | NULL | 005 |
| purpose | text | — | NULL | 005 |
| overview | jsonb | — | '{}' | 005 |
| visa_section | jsonb | — | '{}' | 005 |
| budget_section | jsonb | — | '{}' | 005 |
| housing_section | jsonb | — | '{}' | 005 |
| banking_section | jsonb | — | '{}' | 005 |
| healthcare_section | jsonb | — | '{}' | 005 |
| culture_section | jsonb | — | '{}' | 005 |
| jobs_section | jsonb | — | '{}' | 005 |
| education_section | jsonb | — | '{}' | 005 |
| timeline_section | jsonb | — | '{}' | 005 |
| checklist_section | jsonb | — | '{}' | 005 |
| official_links | jsonb | — | '[]' | 005 |
| useful_tips | jsonb | — | '[]' | 005 |
| status | text | CHECK(draft,generating,complete,archived) | 'draft' | 005 |
| guide_type | text | — | 'main' | 007 |
| guide_version | integer | — | 1 | 019 |
| plan_version_at_generation | integer | — | NULL | 019 |
| is_stale | boolean | — | false | 019 |
| stale_at | timestamptz | — | NULL | 019 |
| stale_reason | text | — | NULL | 019 |
| created_at | timestamptz | NOT NULL | now() | 005 |
| updated_at | timestamptz | NOT NULL | now() | 005 |
| completed_at | timestamptz | — | NULL | 005 |

Indexes: user_id, plan_id, destination, guide_type, (user_id, destination, purpose, guide_type)
RLS: SELECT/INSERT/UPDATE/DELETE where auth.uid() = user_id

---

#### checklist_progress
**Migration:** 003

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| user_id | uuid | NOT NULL, FK→auth.users CASCADE | — |
| plan_id | uuid | NOT NULL, FK→relocation_plans CASCADE | — |
| item_id | text | NOT NULL | — |
| completed | boolean | — | false |
| completed_at | timestamptz | — | NULL |
| notes | text | — | NULL |
| created_at | timestamptz | NOT NULL | now() |
| updated_at | timestamptz | NOT NULL | now() |

UNIQUE(user_id, plan_id, item_id)
RLS: SELECT/INSERT/UPDATE/DELETE where auth.uid() = user_id

---

#### user_subscriptions
**Migration:** 008

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| user_id | uuid | NOT NULL, FK→auth.users CASCADE, UNIQUE | — |
| tier | text | CHECK(free,pro_single,pro_plus) | 'free' |
| billing_cycle | text | CHECK(one_time,monthly,...,null) | NULL |
| status | text | CHECK(active,cancelled,expired,past_due) | 'active' |
| plan_limit | integer | NOT NULL | 1 |
| price_sek | integer | — | 0 |
| stripe_customer_id | text | — | NULL |
| stripe_subscription_id | text | — | NULL |
| stripe_price_id | text | — | NULL |
| started_at | timestamptz | NOT NULL | now() |
| expires_at | timestamptz | — | NULL |
| cancelled_at | timestamptz | — | NULL |
| created_at | timestamptz | NOT NULL | now() |
| updated_at | timestamptz | NOT NULL | now() |

UNIQUE(user_id)
RLS: SELECT/INSERT/UPDATE (no DELETE)

---

### 2.2 RPC Functions

#### switch_current_plan(p_user_id uuid, p_plan_id uuid) → void
**Migration:** 014 | SECURITY DEFINER
1. SET is_current=false WHERE user_id=p_user_id AND is_current=true
2. SET is_current=true WHERE user_id=p_user_id AND id=p_plan_id

---

### 2.3 Entity Relationships

```
auth.users (Supabase Auth)
├── profiles (1:1)
├── relocation_plans (1:N)
│   ├── settling_in_tasks (1:N, depends_on = text[] of task UUIDs)
│   └── guides (1:N, ON DELETE SET NULL)
├── checklist_progress (1:N)
└── user_subscriptions (1:1, UNIQUE)
```

---

### 2.4 Global Patterns

- **RLS:** All tables use auth.uid()-based row isolation
- **updated_at:** All tables have BEFORE UPDATE trigger → `update_updated_at_column()`
- **Idempotent migrations:** All use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`

---

## 3. Artifact Generation Pipeline

### 3.1 Profile → Guide

```
Chat Interview (GPT-4o + GPT-4o-mini extraction)
  → profile_data JSONB on relocation_plans
  → User locks profile (PATCH /api/profile action=lock)
  → Stage transitions: collecting → generating → complete
  → Guide generated (POST /api/guides)
  → Guide stored in guides table (12 JSONB sections)
```

**Model:** LLM generation (model varies by context)
**Staleness:** Profile changes mark guide is_stale=true, stale_reason, stale_at (Phase 9)
**Versioning:** guide_version increments on regeneration, plan_version_at_generation snapshots

### 3.2 Profile → Research

```
Profile locked → User triggers research (POST /api/research/trigger)
  → Parallel: visa + local-requirements + checklist
  → Firecrawl scrape → GPT-4o-mini analysis
  → Results stored in relocation_plans JSONB columns:
    - visa_research
    - local_requirements_research
    - checklist_items
  → research_status = in_progress → completed/failed
  → aggregate route sets research_completed_at on finalization
```

**Cache:** Local requirements cached 7 days. Visa research stored permanently until re-triggered.
**Freshness:** research_freshness_days computed on read (Phase 9)

### 3.3 Profile → Settling-In Tasks

```
User confirms arrival (POST /api/settling-in/arrive)
  → Stage: complete → arrived
  → User triggers generation (POST /api/settling-in/generate)
  → Firecrawl research (4 country-specific queries)
  → Claude Sonnet 4 via OpenRouter (maxTokens: 6000)
  → DAG validation (isValidDAG)
  → Tasks inserted into settling_in_tasks table
  → Dependencies resolved (tempId → UUID mapping)
  → Absolute deadlines computed (arrival_date + deadline_days)
```

**Fallback:** 8 default tasks if AI/Firecrawl unavailable
**Categories:** registration, banking, housing, healthcare, employment, transport, utilities, social, legal, other

### 3.4 Profile → Cost of Living

```
Numbeo scraper (lib/gomate/numbeo-scraper.ts)
  → Priority: in-memory cache (24h) → built-in fallback dataset → Firecrawl scrape → generic estimates
  → Budget calculation: minimum + comfortable breakdown
  → Savings target: emergency + moving + initial setup + visa fees
```

**Integration:** Embedded in chat metadata during interview, used in guide generation

### 3.5 Profile → Visa Recommendations

```
lib/gomate/visa-recommendations.ts
  → Country-specific rules (Germany, Spain, Portugal)
  → Generic fallbacks (Student, Work visas)
  → Returns: name, type, description, processingTime, requirements, pros, cons, likelihood
```

**Integration:** Embedded in chat metadata, used in guide visa_section

---

## 4. Event / Trigger System

### 4.1 Actual Implementation (Inline Triggers, No Event Bus)

GoMate v1 has **no domain event bus**. All "events" are inline triggers within API route handlers:

| Trigger | Location | Effect |
|---------|----------|--------|
| Profile data changes | PATCH /api/profile | Marks guides is_stale=true, increments plan_version |
| Profile lock | PATCH /api/profile action=lock | Stage→complete, guide generation, plan_version++ |
| Profile unlock | PATCH /api/profile action=unlock | Removes locked state |
| Arrival confirmed | POST /api/settling-in/arrive | Stage→arrived, arrival_date set, deadline_at recomputed |
| Task completed | PATCH /api/settling-in/[id] | completed_at set, dependents auto-unlocked via computeAvailableTasks() |
| Plan archived | PATCH /api/plans action=archive | status→archived, is_current→false, plan_version++ |
| Plan switched | PATCH /api/plans action=switch | RPC switch_current_plan (atomic) |
| Research triggered | POST /api/research/trigger | locked-plan guard, research_status→in_progress→completed/failed, parallel helper execution |
| Guide regenerated | POST /api/guides | guide_version++, staleness cleared |
| Onboarding completed | PATCH /api/profile action=lock | onboarding_completed=true only after guide readiness is confirmed |

### 4.2 State Machine

**Stage transitions:** `collecting → generating → complete → arrived`
- collecting→generating: profile lock triggers guide generation
- generating→complete: guide generation completes
- complete→arrived: user confirms arrival
- No backward transitions in code

**Plan status:** `active | archived | completed`
- Independent of stage
- Plan can be archived from any stage

### 4.3 Marker Protocol

Post-arrival chat emits `[TASK_DONE:exact task title]` (title string, not UUID).
Frontend parses with regex → fires PATCH /api/settling-in/[id] with status=completed.
Both system prompt and frontend parser must agree on format.

---

## 5. System Invariants

### 5.1 Auth Invariants

- **All protected routes** call `supabase.auth.getUser()` → 401 if no session
- **Unprotected routes:** GET /api/airports, GET /api/cost-of-living, GET/POST /api/flights
- **Middleware** (`lib/supabase/middleware.ts`): refreshes session, redirects unauthenticated users on protected paths (`/dashboard`, `/chat`, `/guides`, `/booking`, `/settings`)
- **RLS** enforces user isolation at database level (all 6 tables)

### 5.2 Tier Gating

- **Tiers:** `free | pro_single | pro_plus`
- **Feature matrix:**
  - free: chat only
  - pro_single: everything except plan_switcher, post_relocation, compliance_alerts, post_arrival_assistant
  - pro_plus: all features
- **Enforced at:** POST /api/plans (plan limit), all settling-in routes (pro_plus only)
- **Implementation:** `getUserTier()` in `lib/gomate/tier.ts`, `ensureSubscription()` creates free tier if none exists

### 5.3 Stage Checks

- `POST /api/settling-in/generate` and `PATCH /api/settling-in/[id]` verify `plan.stage === 'arrived'` → 400 if not
- `GET /api/settling-in` soft-gates by returning empty tasks when stage is not `arrived`
- `POST /api/settling-in/[id]/why-it-matters` does not currently verify `arrived`
- POST /api/settling-in/arrive accepts from "complete" or "arrived" only
- Profile updates blocked when plan is locked (403)

### 5.4 DAG Validation

- `isValidDAG()` in `lib/gomate/dag-validator.ts`: DFS 3-color cycle detection
- Applied to settling-in task dependencies before insertion
- If cycle detected: dependencies stripped (graceful degradation)
- `computeAvailableTasks()` in `lib/gomate/settling-in-generator.ts`: returns task IDs where all dependencies completed (WORKING per CLAUDE.md)

### 5.5 External Call Safety

- `fetchWithRetry()` in `lib/gomate/fetch-with-retry.ts`: AbortController timeout (15s default), exponential backoff (3 attempts), no retry on 4xx
- **Required for:** all Firecrawl calls, external API calls
- **LLM calls:** explicit maxTokens on all `generateText()` calls

### 5.6 Data Integrity

- All JSONB columns have safe defaults (`'{}'`, `'[]'`)
- UNIQUE constraints: (plan_id, task_key), (user_id, plan_id, item_id), (user_id) for subscriptions
- Partial unique index: (user_id) WHERE is_current=true (one current plan per user)
- FK cascades: ON DELETE CASCADE for user data, ON DELETE SET NULL for guides.plan_id
- plan_version monotonic counter: incremented on destination change, stage transition, profile lock, profile data changes

### 5.7 Forbidden Patterns (Enforced)

| Pattern | Status |
|---------|--------|
| In-memory cache | Removed from web-research.ts (Phase 7). Still present in numbeo-scraper.ts (24h TTL, non-functional in serverless) |
| Regex JSON extraction from LLM | Not used |
| Math.random() for data | Not used |
| Self-HTTP calls | Removed from POST /api/research/trigger; research now uses direct helper calls |
| Regex JSON extraction from LLM | Still present in checklist generator only; visa/local requirements now use JSON mode |
| PATCH /api/subscription | Removed (Phase 1) |
| Hardcoded URLs | Not present in production code |

---

## Appendix: Frontend Pages

| Path | Purpose |
|------|---------|
| /dashboard | Main hub — plan summary, progress, CTAs |
| /chat | Pre-arrival interview + post-arrival assistant |
| /guides | Guide list |
| /guides/[id] | Guide viewer with sections |
| /settling-in | Post-arrival task list |
| /booking | Flight search |
| /documents | Document checklist |
| /settings | User settings |
