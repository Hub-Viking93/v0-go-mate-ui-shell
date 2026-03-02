# Reliability Contracts — System Document

**Phase:** 5.4
**Status:** Reality-first + Placeholder for target architecture
**Primary sources:**
- `app/api/*/route.ts` — all API route error handling
- `lib/gomate/web-research.ts`, `lib/gomate/numbeo-scraper.ts`, `lib/gomate/checklist-generator.ts`, `lib/gomate/flight-search.ts` — service-layer error handling
- `lib/gomate/tier.ts`, `lib/gomate/plan-factory.ts` — helper function error handling
**Target contract:** GoMate — Shared Reliability Contracts
**Last audited:** 2026-02-25

---

## 1. Overview

GoMate has no shared reliability contracts. Each API route and service module independently implements its own error handling with inconsistent patterns, different log formats, no retry logic, and no structured error codes. This document catalogues the current state as a baseline for the target architecture.

---

## 2. Current Error Handling Inventory

### 2.1 API Route Pattern (Universal)

Every API route follows the same outer try/catch structure:

```typescript
export async function POST(req: Request) {
  try {
    // ... route logic
    return NextResponse.json({ ... })
  } catch (error) {
    console.error("[GoMate] Error in POST /api/xxx:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

All unexpected errors return a generic 500 with the string `"Internal server error"`. The error object is logged to `console.error` only — no structure, no error code, no request ID.

### 2.2 External API Error Pattern

Calls to Firecrawl and OpenAI follow a minimal check:

```typescript
if (!response.ok) {
  console.error("[GoMate] Firecrawl failed:", response.status)
  return null   // or []
}
```

HTTP error status codes are logged but not classified. A 429 (rate limit), 401 (bad key), 500 (server error), and 402 (payment required / quota exceeded) all produce the same log and the same `return null` outcome.

### 2.3 Supabase Error Pattern

Database errors follow the Supabase client pattern:

```typescript
const { data, error } = await supabase.from("...").select("...")
if (error) {
  console.error("[GoMate] DB error:", error)
  return null   // or NextResponse 500
}
```

Supabase error objects include `code`, `message`, and `details` but these are never inspected programmatically — they are only serialized into the console.error call.

### 2.4 Log Prefix Inconsistency

| Route / Module | Log prefix |
|---|---|
| Most API routes | `[GoMate]` |
| `app/api/research/trigger/route.ts` | `[Research Trigger]` |
| `app/api/research/checklist/route.ts` | `[ChecklistAPI]` |
| `app/api/subscription/route.ts` | (none) |
| `lib/gomate/tier.ts` | (none) |
| `lib/gomate/plan-factory.ts` | `[GoMate]` |

No consistent format for log messages. The `[GoMate]` prefix is a convention adopted by most routes but not enforced.

### 2.5 Retry Logic

**There is no retry logic anywhere in the codebase.** Every external call (Firecrawl, OpenAI, Anthropic, Supabase) is attempted exactly once. A transient network error, API rate limit, or temporary service outage results in immediate failure with a silent fallback.

Confirmed absent in:
- All 5 Firecrawl integration points
- All OpenAI API calls (chat streaming, profile extraction, visa research, local requirements)
- The Anthropic API call in checklist-generator.ts
- All Supabase queries

### 2.6 Timeout Configuration

| Location | Timeout | Method |
|---|---|---|
| `lib/gomate/numbeo-scraper.ts` | 15 seconds | `AbortController` |
| `lib/gomate/flight-search.ts` | 30 seconds | Firecrawl SDK `timeout` option |
| All other Firecrawl calls | None (Vercel function limit) | Platform default |
| OpenAI streaming (chat) | None explicit | Vercel function limit (30s) |
| OpenAI non-streaming (extraction, research) | None explicit | Vercel function limit (30s or 60s) |
| Supabase queries | None explicit | Supabase client default |

Only 2 of the ~20+ external calls in the codebase have explicit client-side timeouts.

### 2.7 Circuit Breaker

**No circuit breaking exists.** If Firecrawl is consistently returning 429 or 500 errors, every incoming request will call Firecrawl until the function times out. There is no mechanism to stop calling a failing service and use fallback data instead.

### 2.8 Fallback Strategies

Despite the lack of retry and circuit breaking, the system does have data-level fallbacks:

| System | Fallback on failure |
|---|---|
| Cost of living (Numbeo) | `getGenericFallbackData()` — always returns something |
| Cost of living (web-research) | Returns `null` — caller uses no cost data |
| Checklist generation | `getDefaultChecklist()` — 5–8 hardcoded items |
| Visa research | Empty `visaOptions: []` — no visa data shown |
| Local requirements | Empty categories — no requirements shown |
| Guide generation | No fallback needed — synchronous, no external calls |
| Flight search | Empty results or mock data |
| Profile extraction | Returns `null` — profile unchanged for this turn |

Fallbacks are silent — the user is not informed that their data is incomplete or defaulted.

### 2.9 HTTP Status Codes Returned

| Condition | Status code | Notes |
|---|---|---|
| Unauthorized (no user) | 401 | Consistent |
| Resource not found | 404 | Used in some routes |
| Plan limit reached | 403 | `app/api/plans` POST only |
| Missing required field | 400 | Some routes |
| External API failure | 500 | Generic; no distinction |
| All unexpected exceptions | 500 | Generic "Internal server error" |

There is no `502 Bad Gateway`, `503 Service Unavailable`, or `504 Gateway Timeout` returned — all external service failures surface as 500.

---

## 3. Target Architecture (Shared Reliability Contracts)

The Shared Reliability Contracts document describes the following. None are implemented.

### 3.1 Standardized Error Codes (Target)

All errors emit a typed `error_code` and `error_type`:

```typescript
interface GoMateError {
  error_code: string      // e.g. "FIRECRAWL_RATE_LIMITED", "OPENAI_CONTEXT_EXCEEDED"
  error_type: "transient" | "permanent" | "validation" | "not_found" | "unauthorized"
  message: string
  retryable: boolean
  retry_after?: number    // seconds
}
```

HTTP responses include the error code:

```typescript
return NextResponse.json({
  error: "Firecrawl rate limited",
  error_code: "FIRECRAWL_RATE_LIMITED",
  error_type: "transient",
  retryable: true,
  retry_after: 60
}, { status: 429 })
```

### 3.2 Retry Policy (Target)

Exponential backoff for all transient external API calls:

```
Attempt 1: immediate
Attempt 2: 1 second delay
Attempt 3: 2 second delay
Max attempts: 3
Total max wait: ~3 seconds per external call
```

Applied to:
- All Firecrawl API calls
- All OpenAI API calls (non-streaming)
- All Anthropic API calls
- Supabase calls that fail with transient errors (connection reset, timeout)

Not applied to:
- Streaming calls (chat route) — retry would require client reconnection
- Auth checks — authentication failures are permanent

### 3.3 Timeout Contract (Target)

Standard timeouts for all external calls:

| Call type | Timeout |
|---|---|
| Firecrawl scrape | 10 seconds |
| Firecrawl search | 15 seconds |
| OpenAI non-streaming | 20 seconds |
| OpenAI streaming | 30 seconds |
| Supabase query | 5 seconds |

All implemented with `AbortController` at the fetch/SDK call level.

### 3.4 Circuit Breaker (Target)

Per-service circuit breakers:

```
State: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)

CLOSED:    Pass all requests
OPEN:      Return cached fallback immediately; do not call service
HALF_OPEN: Allow one probe request; close if succeeds, re-open if fails

Trip condition: 3 consecutive failures within 60 seconds
Recovery: 30-second cooldown before HALF_OPEN
```

Services with circuit breakers: Firecrawl, OpenAI, Anthropic.

### 3.5 Structured Logging (Target)

All log events in structured JSON format:

```typescript
{
  timestamp: "2026-02-25T12:00:00.000Z",
  level: "error" | "warn" | "info",
  service: "api" | "firecrawl" | "openai" | "supabase",
  operation: "visa.research",
  trace_id: "abc123",
  user_id: "uuid",
  plan_id: "uuid",
  error_code: "FIRECRAWL_RATE_LIMITED",
  error_type: "transient",
  duration_ms: 4521,
  message: "Firecrawl scrape failed with 429"
}
```

### 3.6 User Notification on Failure (Target)

When a critical data fetch fails (visa research, checklist, local requirements), the user receives an in-UI notification rather than silently receiving fallback data:

- Research failures: show "Research incomplete — some data may be unavailable" banner
- Extraction failures: show "We couldn't update your profile this turn" message
- Cost data failures: show "Using estimated costs — live data unavailable"

Currently, all failures are completely invisible to the user.

---

## 4. Gap Analysis — Critical Findings

### G-5.4-A: No retry logic anywhere

Every external call is single-attempt. Transient failures (network blip, rate limit, temporary outage) are indistinguishable from permanent failures and produce the same silent null return.

### G-5.4-B: No circuit breaker

A failing Firecrawl endpoint is called on every request indefinitely. If Firecrawl is down, every research request will timeout after 30–60 seconds rather than failing fast with a cached fallback.

### G-5.4-C: Client-side timeouts on only 2 of ~20+ external calls

`numbeo-scraper.ts` (15s) and `flight-search.ts` (30s) have explicit timeouts. All other calls rely solely on the Vercel function limit, which means a slow external API can consume the entire function budget.

### G-5.4-D: All external failures surface as 500

HTTP 429 (rate limit), 401 (bad API key), 402 (quota exceeded), and 500 (server error) from Firecrawl or OpenAI all produce `{ error: "Internal server error" }` with status 500. Callers cannot distinguish these failure modes.

### G-5.4-E: Failures are invisible to users

Every failure path returns a silent fallback or empty data. Users never know when their guide uses estimated instead of live data, when their checklist defaulted to the 8-item fallback, or when visa research returned nothing.

### G-5.4-F: Log prefix is inconsistent

The `[GoMate]` prefix is used by most but not all modules. Two routes use different prefixes (`[Research Trigger]`, `[ChecklistAPI]`) and two use none at all. Searching production logs for all GoMate errors requires multiple queries.

---

## 5. Target State

| Item | Current | Target |
|---|---|---|
| Retry logic | None | Exponential backoff, 3 attempts, all external calls |
| Circuit breaker | None | Per-service circuit breaker (Firecrawl, OpenAI, Anthropic) |
| Client-side timeouts | 2 of ~20+ calls | Timeout on every external call |
| Error codes | None | Typed `error_code` + `error_type` in all responses |
| Log prefix | Inconsistent | Standardize `[GoMate]` everywhere |
| Structured logging | None | JSON logs with trace_id, user_id, operation, duration_ms |
| User notification | Silent failures | In-UI notification when critical data is unavailable |
| HTTP status codes | All 500 for external failures | 429/503/504 for appropriate external failure modes |
| Fallback transparency | Silent | `isFallback: true` in all API responses using fallback data |
