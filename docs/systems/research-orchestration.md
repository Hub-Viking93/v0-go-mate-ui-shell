# Research Orchestration — System Document

**Phase:** 3.1
**Status:** Reality-first (documents what exists)
**Primary sources:**
- `app/api/research/trigger/route.ts` (178 lines)
- `app/api/research/visa/route.ts` (516 lines) — see Phase 2.3
- `app/api/research/local-requirements/route.ts` (533 lines)
- `app/api/research/checklist/route.ts` (132 lines)
- `lib/gomate/web-research.ts` (714 lines)
**Last audited:** 2026-02-25

---

## 1. Overview

GoMate's research system consists of **four independent API routes** backed by shared service helpers. They are coordinated by a single trigger endpoint after the user confirms their profile. There is still no formal orchestration layer — each research type independently scrapes sources, calls AI for analysis, and writes results to a `relocation_plans` JSONB column.

The system is functional and produces real research results, but it is architecturally flat: each research type is fully self-contained with its own Firecrawl integration, its own AI prompt, its own response-shape normalization, and its own DB write path. No shared orchestration, retry, or quality-scoring layer exists.

---

## 2. Research Endpoints

| Route | Method | Description |
|---|---|---|
| `POST /api/research/trigger` | POST | Fires all three research types in parallel via direct helper calls |
| `GET /api/research/trigger` | GET | Returns current research status for user's active plan |
| `POST /api/research/visa` | POST | Visa research (Firecrawl + GPT-4o-mini) |
| `GET /api/research/visa` | GET | Retrieves cached visa research |
| `POST /api/research/local-requirements` | POST | Local requirements research (Firecrawl + GPT-4o-mini) |
| `GET /api/research/local-requirements` | GET | Retrieves cached local requirements |
| `POST /api/research/checklist` | POST | Document checklist generation (Firecrawl + Claude Sonnet) |
| `GET /api/research/checklist` | GET | Retrieves cached checklist |

---

## 3. Trigger Architecture

### 3.1 POST /api/research/trigger

The trigger endpoint is the entry point for research. It receives a `planId` and coordinates the three research types.

```
POST /api/research/trigger
{ planId: string }
│
├── Auth check
├── Load plan: verify ownership, check current research_status
├── If status === "in_progress" → return early (dedup guard)
├── Set research_status = "pending"
│
├── Fire three parallel helper calls via Promise.allSettled:
│   ├── performVisaResearch(supabase, planId, user.id)
│   ├── performLocalRequirementsResearch(supabase, planId, user.id)
│   └── performChecklistResearch(supabase, user.id, planId)
│
├── Await Promise.allSettled (all three must resolve)
│
├── Determine final status:
│   ├── allSucceeded → "completed"
│   ├── someSucceeded → "completed"  ← NOTE: partial success = "completed"
│   └── noneSucceeded → "failed"
│
├── Write research_status + research_completed_at to relocation_plans
└── Return { status, results: { visa, localRequirements, checklist } }
```

**maxDuration:** 60 seconds (double the chat route's 30s).

### 3.2 Direct Helper Call Pattern

The trigger now imports shared research helpers directly. This removes the self-HTTP pattern, but the orchestration layer is still flat:

- each sub-research flow independently mutates the same `research_status` field
- partial success still collapses to `status = "completed"`
- no per-artifact state, retry policy, or quality gate exists

### 3.3 GET /api/research/trigger

Polls the status of the current plan's research. Returns:
- `research_status` (pending / in_progress / completed / failed)
- `research_completed_at`
- `hasVisaResearch` — whether `visa_research` JSONB is populated
- `hasLocalRequirements` — whether `local_requirements_research` JSONB is populated

Also reads `local_requirements_research` column — which is not defined in any migration script. See Section 8.

---

## 4. Visa Research

See Phase 2.3 documentation for full detail. Summary:
- POST: Firecrawl scrape official immigration URL + search queries → GPT-4o-mini analysis → `visa_research` JSONB column
- GET: Returns cached `visa_research` via `normalizeVisaResearch()` shape mapper
- Cache: Relies on DB (no explicit TTL enforcement — results persist until next POST)

---

## 5. Local Requirements Research

### 5.1 POST /api/research/local-requirements Flow

```
POST /api/research/local-requirements
{ planId, forceRefresh?: boolean }
│
├── Auth check
├── Load plan
├── Cache check: If local_requirements_research exists AND research_completed_at < 7 days old
│   AND forceRefresh !== true → return cached (normalizeLocalRequirements applied)
├── Set research_status = "in_progress"
│
├── Collect official sources for destination (from official-sources.ts):
│   immigration, housing, banking, employment, safety (up to 4 URLs)
├── Scrape each source URL via Firecrawl REST (up to 4 scrapes, 8KB per source)
│
├── Build 6 search queries:
│   1. "{dest} residence registration requirements for foreigners {year}"
│   2. "{dest} tax registration foreign residents"
│   3. "{dest} healthcare insurance registration expats"
│   4. "{dest} open bank account foreigner requirements"
│   5. "{dest} drivers license exchange conversion foreign"
│   6. "{city+dest} moving checklist expats"
│   (only first 4 queries used, 2 results each, 4KB per result)
│
├── GPT-4o-mini analysis, temperature=0.3, max_tokens=4000
│   Prompt: produce JSON with 8 categories
│
├── Inline JSON shape normalization:
│   AI returns: { registration: [...], taxId: [...], ... }
│   Client expects: [{ category: "Registration", items: [...] }, ...]
│   Inline transform applied HERE (not in normalizer)
│
├── Write to relocation_plans:
│   { local_requirements_research: research, research_completed_at, research_status: "completed" }
│
└── On failure: attempt to write research_status = "failed"
```

### 5.2 8 Research Categories

| Key (AI output) | Display Label (normalized) |
|---|---|
| `registration` | Registration |
| `taxId` | Tax ID |
| `healthcare` | Healthcare |
| `banking` | Banking |
| `driversLicense` | Driver's License |
| `utilities` | Utilities |
| `housing` | Housing |
| `other` | Other |

### 5.3 LocalRequirement Interface

```typescript
interface LocalRequirement {
  category: string
  name: string           → mapped to "title" in normalized output
  description: string
  steps: string[]
  requiredDocuments: string[]  → mapped to "documents" in normalized output
  estimatedTime: string
  cost: string
  officialLinks: string[]      → first element becomes "officialLink" in normalized output
  tips: string[]
  deadline?: string
}
```

### 5.4 normalizeLocalRequirements()

The GET handler applies `normalizeLocalRequirements()` which handles two historical DB shapes:

| Shape | Detection | Action |
|---|---|---|
| Array format: `categories: [{category, items}]` | `Array.isArray(raw.categories)` | Normalize item field names only |
| Keyed object format: `categories: {registration: [], taxId: []}` | `typeof raw.categories === "object"` | Convert to array, apply labelMap |

This normalizer exists because the stored shape changed at some point. The POST handler already writes the normalized array format, but old records may have the keyed format.

### 5.5 Cache TTL: 7 Days

Local requirements use a 7-day DB-based cache (compared to visa research which has no enforced TTL). Cache is bypassed if `forceRefresh: true` is passed in the POST body.

---

## 6. Checklist Research

### 6.1 POST /api/research/checklist Flow

```
POST /api/research/checklist
{ planId?: string }   (defaults to is_current if not provided)
│
├── Auth check
├── Load plan (by planId or is_current)
├── Verify profile has destination
│
├── generateChecklistFromPlan(plan) from checklist-generator.ts
│   ├── Extract profile fields (citizenship, destination, purpose, etc.)
│   ├── Find selected visa from visa_research.visaOptions (or first option)
│   │
│   ├── If Firecrawl key exists AND visaType known:
│   │   ├── searchDocumentRequirements() — Firecrawl search (2 queries, 3 results each)
│   │   └── scrapeOfficialSources() — Firecrawl scrape (official immigration + visa URLs)
│   │
│   ├── If research content obtained:
│   │   └── generateChecklistWithAI() — Claude Sonnet 4.5 (NOT GPT-4o-mini)
│   │       Uses: generateText from Vercel AI SDK
│   │       Model: "anthropic/claude-sonnet-4-20250514"
│   │       max_tokens: 4000
│   │       JSON array regex extraction
│   └── Else: getDefaultChecklist() (5-8 hardcoded items)
│
├── Sort items by priority (critical→high→medium→low)
│
├── Save to relocation_plans:
│   { checklist_items: checklist, updated_at: now }
│
└── Return { success, checklist, planId }
```

**Critical finding:** The checklist generator uses **Claude Sonnet** (Anthropic) via the Vercel AI SDK, while all other AI calls in the system use **OpenAI GPT-4o-mini**. This is the only Claude usage in the codebase.

### 6.2 GET /api/research/checklist

Retrieves the `checklist_items` column from the current plan. Also returns `hasVisaResearch` flag. No normalization step — the stored shape is directly returned.

### 6.3 ChecklistItem Interface

```typescript
interface ChecklistItem {
  id: string
  document: string
  description: string
  priority: "critical" | "high" | "medium" | "low"
  required: boolean
  category: string  // "identity"|"visa"|"financial"|"medical"|"education"|"housing"|"travel"|"legal"|"other"
  whereToGet?: string
  officialLink?: string
  estimatedTime?: string
  cost?: string
  tips?: string[]
  visaSpecific?: boolean
}
```

### 6.4 Default Checklist

When AI generation fails or no research content is available, `getDefaultChecklist()` returns 5–7 hardcoded items:
1. Valid Passport (critical, identity)
2. Passport Photos (high, identity)
3. Visa Application Form (critical, visa)
4. Bank Statements (critical, financial)
5. Health Insurance Certificate (critical, medical)
6. Employment Contract — only if purpose=work or hasJobOffer (critical, visa)
7. University Admission Letter — only if purpose=study or hasUniversityAdmission (critical, visa)
8. Proof of Accommodation (high, housing)

---

## 7. Research Status State Machine

Research status is tracked via `research_status` on `relocation_plans`. The states observed across all three routes:

```
null (never triggered)
  │
  ▼
"pending"          (trigger sets this before firing parallel calls)
  │
  ▼
"in_progress"      (individual research routes set this when starting)
  │
  ├──── "completed"   (trigger sets final status if any succeeded)
  └──── "failed"      (trigger sets if none succeeded; local-req sets on exception)
```

**Gap:** Individual sub-routes (visa, local-requirements) each set `research_status = "in_progress"` when they start. They then set it to `"completed"` when they finish. But the trigger also sets the final status after all three complete. This means the trigger's final write always overwrites whatever the last sub-route wrote — including partial failures being overwritten with `"completed"` (since `someSucceeded` also maps to `"completed"`).

---

## 8. DB Column Gap

The following columns are read and written by research routes but **do not appear in any migration script**:

| Column | Used by | Status |
|---|---|---|
| `visa_research` | visa/route.ts, trigger/route.ts | Not in any migration |
| `research_status` | visa/route.ts, trigger/route.ts, local-requirements/route.ts | Not in any migration |
| `research_completed_at` | visa/route.ts, trigger/route.ts, local-requirements/route.ts | Not in any migration |
| `local_requirements_research` | local-requirements/route.ts, trigger/route.ts | Not in any migration |
| `checklist_items` | checklist/route.ts | **Present in migration 002** ✓ |

Four of the five research columns are undocumented in the database schema. See Phase 1.3 and Phase 2.3 for related analysis.

---

## 9. Current Architecture vs. Target Architecture

### 9.1 Current: Four Inline Routes

```
trigger/route.ts
├── → performVisaResearch()
├── → performLocalRequirementsResearch()
└── → performChecklistResearch()

Each route:
├── auth check
├── Firecrawl scrape/search (inline)
├── AI analysis (inline helper logic)
├── DB write (inline helper logic)
└── Return result
```

### 9.2 Target (from Docs contracts): Six-Component System

The research orchestration system described in the GoMate architecture contracts defines:

| Component | Description | Exists? |
|---|---|---|
| Research Planner | Determines what research is needed based on profile | No |
| Source Selector | Selects best sources for the query from Source Registry | No |
| Fetch Orchestrator | Manages parallel fetches, rate limits, retries | No |
| Extraction Coordinator | Standardized extraction across all research types | No |
| Result Aggregator | Merges, deduplicates, scores research results | No |
| Enrichment Pipeline | Post-processing and quality scoring | No |

None of these components exist. The current system is entirely inline with no shared abstractions.

---

## 10. Gap Analysis — Critical Findings

### G-3.1-A: Self-HTTP call pattern is fragile

The trigger fires research via `fetch()` calls to itself. This requires a valid `origin` header or `NEXT_PUBLIC_APP_URL`. If neither is present, all three research calls fail. There is no fallback to direct function imports.

### G-3.1-B: Four independent scrapeUrl() implementations

Each research route (`visa/route.ts`, `local-requirements/route.ts`) implements its own `scrapeUrl()` function with slightly different configurations. `checklist-generator.ts` uses the Firecrawl JS SDK. `web-research.ts` has its own `scrapeUrl()` and `searchAndScrape()`. Four parallel implementations with no shared abstraction.

### G-3.1-C: AI model inconsistency across research types

| Research type | AI model | SDK |
|---|---|---|
| Visa research | GPT-4o-mini | Raw fetch |
| Local requirements | GPT-4o-mini | Raw fetch |
| Checklist generation | Claude Sonnet 4.5 | Vercel AI SDK |

No architectural reason for this inconsistency is documented. The checklist appears to have been developed or updated independently.

### G-3.1-D: Partial success treated as "completed"

The trigger sets `"completed"` if `someSucceeded` (at least one of three research types worked). A plan whose local requirements research failed but visa research succeeded will show `"completed"` status. There is no way to query which sub-tasks succeeded.

### G-3.1-E: No retry logic

Each research type runs once. If Firecrawl returns an error or OpenAI fails, the research silently falls back to empty/default results. No retry, no backoff, no notification to the user.

### G-3.1-F: No explicit caching contract for visa research

Local requirements enforces a 7-day cache. Visa research has no TTL enforcement — results persist indefinitely in the DB until the next POST. Checklist has no TTL. Only local requirements has an explicit freshness contract.

### G-3.1-G: normalizeLocalRequirements() and normalizeVisaResearch() indicate undocumented schema evolution

Both normalizers handle two different shapes for the same DB column, implying the API response shape changed without a DB migration to standardize old records.

---

## 11. Target State

| Item | Current | Target |
|---|---|---|
| Research trigger | Self-HTTP fetch pattern | Import handlers directly or use job queue |
| scrapeUrl() | 4 duplicate implementations | Single shared function in `lib/gomate/fetch-layer.ts` |
| AI model consistency | GPT-4o-mini + Claude Sonnet (mixed) | Standardize on one model or document the split |
| Partial success status | "completed" for any success | Structured per-task status tracking |
| Retry logic | None | Exponential backoff per Batch 4 contracts |
| DB columns | 4 undocumented columns | Migration 010 to add all research columns |
| Cache TTL | Only local-requirements has 7-day TTL | Explicit TTL contract for all research types |
| Orchestration layer | None | Research Planner + Source Selector as per contracts |
