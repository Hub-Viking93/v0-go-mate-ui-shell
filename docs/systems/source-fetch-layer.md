# Source Fetch Layer — System Document

**Phase:** 3.3
**Status:** Reality-first + Placeholder for target architecture
**Primary sources:**
- `lib/gomate/web-research.ts` (714 lines)
- `lib/gomate/numbeo-scraper.ts` (801 lines)
- `lib/gomate/checklist-generator.ts` (429 lines)
- `app/api/research/visa/route.ts` (516 lines)
- `app/api/research/local-requirements/route.ts` (533 lines)
**Last audited:** 2026-02-25

---

## 1. Overview

The source fetch layer is the mechanism by which GoMate retrieves external data from the web. In the current implementation, **there is no unified source fetch layer**. Firecrawl API calls are implemented independently in five separate files, each with its own configuration, error handling, and response parsing.

This document describes the current distributed implementation and the target unified architecture described in the GoMate contracts.

---

## 2. Current Reality: Five Independent Firecrawl Integrations

### 2.1 Integration Inventory

| File | Integration method | API used | Timeout | waitFor |
|---|---|---|---|---|
| `web-research.ts` | `fetchWithRetry()` wrapper around raw `fetch()` | `/v1/scrape`, `/v1/search` | 15s | Not set |
| `numbeo-scraper.ts` | Raw `fetch()` | `/v1/scrape` | 15s (AbortController) | 3000ms |
| `lib/gomate/research-visa.ts` | `fetchWithRetry()` wrapper around raw `fetch()` | `/v1/scrape`, `/v1/search` | 15s–20s | 3000ms |
| `lib/gomate/research-local-requirements.ts` | `fetchWithRetry()` wrapper around raw `fetch()` | `/v1/scrape`, `/v1/search` | 15s–45s | 3000ms |
| `lib/gomate/checklist-generator.ts` | **Firecrawl JS SDK** (`@mendable/firecrawl-js`) | `firecrawl.scrapeUrl()`, `firecrawl.search()` | SDK-managed | Not set |

**Key finding:** All files except `checklist-generator.ts` use raw `fetch()` against the Firecrawl REST API directly. Only `checklist-generator.ts` uses the official `@mendable/firecrawl-js` npm package. This means the codebase has two different integration patterns for the same service.

### 2.2 FIRECRAWL_API_KEY Access Pattern

All five files independently access `process.env.FIRECRAWL_API_KEY`. No centralized credential management exists. If the key needs to be rotated or a fallback key added, five files must be updated.

---

## 3. Per-File Firecrawl Usage

### 3.1 web-research.ts

**Exports:** `scrapeUrl()`, `searchAndScrape()`

```typescript
// scrapeUrl(url) — single URL scrape
POST /v1/scrape
{
  url,
  formats: ["markdown"],
  onlyMainContent: true,
  // No waitFor
}

// searchAndScrape(query, limit=3) — search + scrape
POST /v1/search
{
  query,
  limit,
  scrapeOptions: { formats: ["markdown"], onlyMainContent: true }
}
```

Retries and a 15s timeout are applied via `fetchWithRetry()`. Returns `null` / `[]` on error.

**Called by:**
- `fetchLiveCostOfLiving()` — for Numbeo cost data (but see Phase 3.2: this path is mostly dead)
- `fetchVisaInfo()` — for visa processing data
- `fetchHousingInfo()` — for housing search tips

### 3.2 numbeo-scraper.ts

**Private:** `scrapeNumbeo(url)`

```typescript
POST /v1/scrape
{
  url,
  formats: ["markdown"],
  onlyMainContent: true,
  waitFor: 3000,
  signal: controller.signal  // ← Only implementation with AbortController timeout (15s)
}
```

Numbeo's scraper still uses a bespoke AbortController timeout. Other research fetchers now use `fetchWithRetry()` with explicit client-side timeouts as well.

### 3.3 app/api/research/visa/route.ts

**Private:** `scrapeUrl(url)`, `searchVisaInfo(query, limit=3)`

```typescript
// scrapeUrl — identical to web-research.ts but with waitFor: 3000
POST /v1/scrape
{ url, formats: ["markdown"], onlyMainContent: true, waitFor: 3000 }

// searchVisaInfo — identical pattern to web-research.ts searchAndScrape
POST /v1/search { query, limit, scrapeOptions: ... }
```

### 3.4 app/api/research/local-requirements/route.ts

**Private:** `scrapeUrl(url)`, `searchFirecrawl(query, limit=2)`

Same pattern as visa route. `searchFirecrawl` is a different function name for the same capability.

### 3.5 checklist-generator.ts

**Uses Firecrawl JS SDK:**

```typescript
import FirecrawlApp from "@mendable/firecrawl-js"

const firecrawl = new FirecrawlApp({ apiKey })

// Search
firecrawl.search(query, {
  limit: 3,
  scrapeOptions: { formats: ["markdown"], onlyMainContent: true }
})

// Scrape
firecrawl.scrapeUrl(url, {
  formats: ["markdown"],
  onlyMainContent: true
})
```

The SDK handles URL construction and response parsing. This is architecturally different from the raw fetch pattern used everywhere else.

---

## 4. Caching Patterns

| Module | Cache type | TTL | Scope |
|---|---|---|---|
| `numbeo-scraper.ts` | In-memory `Map` | 24 hours | city + country key |
| `web-research.ts` | In-memory `Map` | 24 hours | `col_${country}_${city}` key |
| `local-requirements/route.ts` | DB (`research_completed_at` timestamp check) | 7 days | Per plan |
| `visa/route.ts` | DB (implicit — no TTL check on GET) | None enforced | Per plan |
| `checklist-generator.ts` | DB (`checklist_items` column) | None enforced | Per plan |

**Gap:** There is no unified caching strategy. Each system independently manages its own cache. In-memory caches reset on server restart (in serverless environments like Vercel, this is effectively every cold start — TTL is meaningless).

---

## 5. Error Handling Patterns

All current Firecrawl integrations follow the same minimal pattern:

```typescript
try {
  const response = await fetch(...)
  if (!response.ok) {
    console.error("[GoMate] Firecrawl failed:", response.status)
    return null // or []
  }
  return data.data?.markdown || null
} catch (error) {
  console.error("[GoMate] Firecrawl error:", error)
  return null // or []
}
```

- **No retry.** One attempt only.
- **No circuit breaking.** A failing Firecrawl endpoint will be called on every request.
- **No rate limiting.** Multiple concurrent requests could exhaust Firecrawl credits instantly.
- **No quota tracking.** There is no mechanism to detect credit exhaustion.
- **Silent failure.** All errors return `null` / `[]`. Callers use hardcoded fallback data.

---

## 6. Content Limits

Each integration imposes different content size limits:

| Module | Content limit |
|---|---|
| `local-requirements/route.ts` | 8,000 chars per scraped URL; 4,000 chars per search result |
| `app/api/research/visa/route.ts` | Combined: 50,000 chars before AI analysis |
| `checklist-generator.ts` | 4,000 chars per search result; 5,000 chars per scraped URL; 15,000 chars total to AI |
| `web-research.ts` | No limit |

---

## 7. Official Sources Registry Integration

`lib/gomate/official-sources.ts` provides a registry of official URLs per destination. It is used by the research layer to determine which URLs to scrape first:

| Consumer | Function called |
|---|---|
| `local-requirements/route.ts` | `getAllSources(destination)` — gets all 6 category URLs |
| `app/api/research/visa/route.ts` | `getSourceUrl(dest, "immigration")`, `getSourceUrl(dest, "visa")` |
| `checklist-generator.ts` | `getSourceUrl(dest, "immigration")`, `getSourceUrl(dest, "visa")` |

**Gap:** `web-research.ts` does not use `official-sources.ts` at all. It builds ad-hoc search queries instead.

---

## 8. Target Architecture (from Contracts)

The GoMate architecture contracts (Batch 3) describe a formal **Source Registry Contract** and a **Data Source Protocol** — a unified interface for all source access. Neither exists today.

### 8.1 Source Registry (Target)

A centralized registry that:
- Catalogs all available data sources (Firecrawl, Numbeo, official immigration sites)
- Assigns source types, priorities, and reliability scores
- Manages API keys and credentials centrally
- Provides source selection logic ("best source for this query type")
- Tracks rate limits and remaining quotas per source

### 8.2 Data Source Protocol (Target)

A unified interface for source access:

```typescript
interface DataSource {
  fetch(query: SourceQuery): Promise<SourceResult>
  validate(result: SourceResult): boolean
  cache(key: string, result: SourceResult, ttl: number): void
}
```

All fetch operations would go through this interface rather than calling Firecrawl directly.

### 8.3 Rate Limiting (Target)

- Per-source rate limiting with configurable request budgets
- Throttling when approaching credit limits
- Circuit breaker to stop calling a source that is consistently failing

### 8.4 Retry Strategy (Target — Batch 4)

- Exponential backoff: initial delay 1s, max 3 retries, backoff multiplier 2×
- Error classification: transient (retry) vs permanent (skip)
- Structured error events with `error_code` and `error_type`

---

## 9. Gap Analysis — Critical Findings

### G-3.3-A: Five independent scrapeUrl() functions with no shared abstraction

Four separate copies of essentially the same function exist across four files. The only variation is `waitFor` and the absence/presence of a timeout. Any change to Firecrawl's API (e.g., a new parameter, auth header change) must be applied in five places.

### G-3.3-B: Two different Firecrawl integration methods in the same codebase

`checklist-generator.ts` uses the `@mendable/firecrawl-js` SDK while all other files use raw `fetch()`. This creates an inconsistency in how errors, types, and responses are handled.

### G-3.3-C: Timeout strategy is still inconsistent across Firecrawl callers

Most research callers now apply explicit client-side timeouts through `fetchWithRetry()`, but timeout policy is still inconsistent:
- `web-research.ts` uses 15s
- `research-visa.ts` uses 15s/20s
- `research-local-requirements.ts` uses up to 45s for OpenAI analysis
- `checklist-generator.ts` relies on SDK-managed behavior
- `numbeo-scraper.ts` keeps a separate AbortController implementation

### G-3.3-D: In-memory cache is non-functional in serverless environments

Both `web-research.ts` and `numbeo-scraper.ts` maintain 24-hour in-memory caches via `Map`. On Vercel (serverless), each function invocation may spin up a new instance, making the cache effectively useless. Only the DB-backed caches (local-requirements 7-day, visa/checklist persistence) survive across requests.

### G-3.3-E: No rate limiting or credit tracking

All five implementations call Firecrawl unconditionally. If a user triggers research for a destination not in any fallback database, multiple Firecrawl calls could be made simultaneously across all three research types in the trigger. No credit budget management exists.

### G-3.3-F: web-research.ts ignores official-sources.ts registry

The web research module does not use the official sources registry, building its own ad hoc search queries instead. This means official immigration URLs are not used when fetching visa info through `fetchVisaInfo()`.

---

## 10. Target State

| Item | Current | Target |
|---|---|---|
| Firecrawl integration | 5 independent implementations | Single `lib/gomate/fetch-layer.ts` module |
| SDK consistency | Raw fetch + JS SDK mixed | Choose one approach; use consistently |
| Timeout | Present in most callers, but inconsistent by module | Unified timeout policy for Firecrawl and AI fetches |
| Rate limiting | None | Per-source request budget with credit tracking |
| Retry | None | Exponential backoff (3 retries, 1s base) |
| In-memory cache | Non-functional on serverless | Remove or replace with Redis/Vercel KV |
| DB cache TTL | Inconsistent (7-day, none, none) | Unified TTL contract per research type |
| Source selection | Ad hoc per file | Source Registry: official-sources.ts as authoritative registry |
| Error handling | Silent null returns | Structured error events with error_code |
