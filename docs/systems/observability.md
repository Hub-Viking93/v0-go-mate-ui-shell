# Observability Layer — System Document (Placeholder)

**Phase:** 5.2
**Status:** Placeholder — system does not exist
**Current substitute:** Unstructured `console.error` / `console.log` calls with `[GoMate]` prefix
**Target contract:** Batch 4 Contracts (Stability Layer) — Observability + Replay Contract
**Last audited:** 2026-02-25

---

## 1. Status

**This system does not exist.**

No trace IDs, no span model, no structured event emission, no correlation between requests, and no replay capability are implemented anywhere in GoMate. The only logging present is ad-hoc `console.error` calls.

---

## 2. Current Reality: Unstructured Logging

### 2.1 The [GoMate] Convention

Most routes follow a loose convention of prefixing log messages with `[GoMate]`:

```typescript
console.error("[GoMate] Error fetching plans:", error)
console.error("[GoMate] Firecrawl scrape failed:", response.status)
console.error("[GoMate] OpenAI API failed:", response.status)
```

This is the full extent of the observability system. There is no structure, no correlation, and no queryable output.

### 2.2 Prefix Inventory

Not all routes use the `[GoMate]` prefix:

| Route | Prefix used |
|---|---|
| Most API routes | `[GoMate]` |
| `app/api/research/trigger/route.ts` | `[Research Trigger]` |
| `app/api/research/checklist/route.ts` | `[ChecklistAPI]` |
| `app/api/subscription/route.ts` | No prefix |

### 2.3 What Is Logged

Every `console.error` call in the API layer logs:
- The operation name (e.g., `"Error fetching plans"`)
- The raw error object (either a Supabase error, HTTP status code, or thrown Error)

**What is NOT logged:**
- The user ID for the request
- The plan ID involved
- Request correlation (no way to trace a user's sequence of actions)
- Duration or latency
- Which external service call failed (Firecrawl, OpenAI, Supabase)
- Whether the failure was transient or permanent
- Whether a fallback was used

### 2.4 Absence of Request Correlation

There is no `trace_id`, `request_id`, or `session_id` attached to any log message. If a user reports "my visa research failed," there is no way to find the specific request in logs, understand what happened at each step, or replay the request.

### 2.5 console.log Usage

Some `console.log` calls exist in service files for debug-level output. These are not inventoried or controlled — they will appear in production logs alongside errors.

---

## 3. Target Architecture (Batch 4 Contracts)

The Batch 4 Observability + Replay Contract describes the following. None are implemented.

### 3.1 Trace Model (Target)

Every request receives a `trace_id` at the entry point (API route handler):

```typescript
const trace_id = crypto.randomUUID()
```

This `trace_id` is:
- Attached to all log lines within the request
- Forwarded in HTTP calls to sub-services (research sub-routes)
- Stored in database rows affected by the request (plans, research results)
- Returned in the API response for client-side correlation

### 3.2 Span Model (Target)

Within a traced request, each significant operation creates a span:

```typescript
interface Span {
  trace_id: string
  span_id: string
  parent_span_id: string | null
  operation: string         // e.g. "firecrawl.scrape", "openai.extract", "db.update"
  started_at: string
  ended_at: string
  duration_ms: number
  status: "ok" | "error"
  metadata: Record<string, unknown>
}
```

A single research request would create spans for:
- The route handler itself
- Each Firecrawl scrape call
- Each Firecrawl search call
- The AI analysis call
- The DB write

### 3.3 Structured Event Emission (Target)

State mutations and significant events emit structured events:

```typescript
interface GoMateEvent {
  trace_id: string
  event_type: string       // e.g. "profile.updated", "research.completed", "extraction.failed"
  timestamp: string
  user_id: string
  plan_id?: string
  payload: Record<string, unknown>
  error_code?: string
  error_type?: "transient" | "permanent" | "validation"
}
```

Events would be written to a dedicated `events` table or streamed to an external sink (e.g., PostHog, Datadog, custom logging service).

### 3.4 Replay System (Target)

The replay system allows re-execution of any past request from its trace:

1. Every chat turn is stored with its full input (messages, profile snapshot, extracted fields)
2. Every research run is stored with its full context (profile, scraped content, AI output)
3. Given a `trace_id`, the system can reconstruct the exact inputs and re-run the operation
4. Replay is useful for debugging extraction failures, testing prompt changes against real data, and auditing AI decisions

### 3.5 Error Taxonomy (Target)

Errors are classified before logging:

| Category | Type | Retry? |
|---|---|---|
| Network timeout | `transient` | Yes |
| External API rate limit (429) | `transient` | Yes, with backoff |
| External API server error (5xx) | `transient` | Yes |
| External API auth error (401/403) | `permanent` | No |
| JSON parse failure | `validation` | Once with stricter prompt |
| DB constraint violation | `permanent` | No |
| Missing required profile field | `validation` | No |

---

## 4. Database Requirements

The target observability system requires at minimum:

```sql
-- Trace metadata per request
CREATE TABLE traces (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  plan_id uuid,
  operation text,                    -- e.g. "chat.turn", "research.trigger"
  started_at timestamptz,
  ended_at timestamptz,
  status text,                       -- ok | error
  metadata jsonb DEFAULT '{}'
);

-- Events emitted during a trace
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid REFERENCES traces(id),
  event_type text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  user_id uuid,
  plan_id uuid,
  payload jsonb DEFAULT '{}',
  error_code text,
  error_type text
);
```

Neither table exists in any current migration.

---

## 5. Immediate Practical Impact

The absence of observability has these concrete consequences today:

| Scenario | Current capability | Target capability |
|---|---|---|
| User reports "research failed" | Cannot find the request in logs | Find trace by user_id + timestamp; inspect all spans |
| Firecrawl consistently returning empty | Cannot detect until multiple reports | Circuit breaker trips; alert fired |
| AI extraction producing wrong fields | No visibility into what was extracted | Extraction span captures input/output; replay for debugging |
| Profile locked but guide not generated | Console log may exist, may not | trace_id links guide generation span to profile lock event |
| Production debugging | Log archaeology with no correlation | Query `traces` by trace_id; see full span tree |

---

## 6. Gap Summary

| Requirement | Current | Gap |
|---|---|---|
| trace_id | None | Attach UUID to every request |
| Span model | None | Instrument all external calls |
| Structured events | None | Emit typed events for state mutations |
| Error classification | None | Classify all errors as transient/permanent/validation |
| Replay capability | None | Store inputs + outputs for all AI calls |
| Log correlation | None | Include trace_id in every log line |
| Prefix consistency | Inconsistent ([GoMate] vs [Research Trigger] vs none) | Standardize all log prefixes |
| Performance tracking | None | Capture duration_ms per span |
