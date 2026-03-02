# Job System — System Document (Placeholder)

**Phase:** 5.1
**Status:** Placeholder — system does not exist
**Current substitute:** `app/api/research/trigger/route.ts` (synchronous inline trigger)
**Target contract:** Batch 4 Contracts (Stability Layer) — Job System / Queue Contract
**Last audited:** 2026-02-25

---

## 1. Status

**This system does not exist.**

No job queue, no job persistence table, no worker process, no idempotency keys, and no retry logic are implemented anywhere in the GoMate codebase. The closest analogue is the research trigger endpoint, which fires inline HTTP requests synchronously rather than enqueuing work.

---

## 2. Current Reality: The Pseudo-Trigger

The only mechanism that resembles background job execution is `POST /api/research/trigger`. It functions as a synchronous pseudo-orchestrator:

```
POST /api/research/trigger { planId }
│
├── Set research_status = "pending"
│
├── Fire 3 parallel HTTP self-calls (Promise.allSettled):
│   ├── POST /api/research/visa
│   ├── POST /api/research/local-requirements
│   └── POST /api/research/checklist
│
├── Await all three (maxDuration: 60s)
│
├── Set research_status = "completed" (if any succeeded) or "failed"
└── Return results
```

### 2.1 Properties of the Current Pseudo-Trigger

| Property | Value |
|---|---|
| Execution model | Synchronous — caller waits for all three to finish |
| Idempotency | None — a second call while the first is running sets status = "pending" again |
| Dedup guard | Weak — returns early if `research_status === "in_progress"`, but "in_progress" is set by sub-routes mid-execution |
| Retry | None — each sub-route runs once |
| Failure recovery | None — failed sub-routes produce empty/fallback data silently |
| Persistence | Status written to `relocation_plans.research_status` (undocumented column) |
| Timeout | 60 seconds (Vercel function limit) |
| Failure visibility | `someSucceeded` maps to `"completed"` — partial failures are invisible |

### 2.2 Self-HTTP Call Pattern

The trigger calls its sibling routes via `fetch()` with the forwarded `Cookie` header for auth. This requires a valid `NEXT_PUBLIC_APP_URL` or `origin` header. If neither is available, all three research calls fail silently (the catch block returns `{ ok: false }`).

This pattern is documented fully in Phase 3.1 (Research Orchestration SystemDoc).

### 2.3 What Has No Substitute

The following capabilities described in the Batch 4 Job System contract have no current implementation at all:

- **Job persistence table** — no `jobs` or `job_runs` table exists in any migration
- **Idempotency keys** — no mechanism to prevent duplicate job execution
- **Retry with backoff** — single attempt; failures are final
- **Job scheduling** — no delayed or recurring job capability
- **Job status tracking per sub-task** — `research_status` only tracks the aggregate, not individual tasks
- **Dead-letter queue** — no mechanism to collect and inspect failed jobs
- **Worker process** — all execution is inline in request handlers

---

## 3. Target Architecture (Batch 4 Contracts)

The Batch 4 Job System / Queue Contract describes the following components. None are implemented.

### 3.1 Job Schema (Target)

```typescript
interface Job {
  id: string                           // UUID
  idempotency_key: string              // Prevents duplicate execution
  type: JobType                        // "research" | "guide_generation" | "checklist" | ...
  payload: Record<string, unknown>     // Job-specific data
  status: JobStatus                    // pending | running | succeeded | failed | dead
  attempt_count: number
  max_attempts: number                 // Default: 3
  next_attempt_at: string              // ISO timestamp for backoff scheduling
  last_error: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}
```

### 3.2 Retry Strategy (Target)

Exponential backoff:
- Initial delay: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- After 3 failures: status = "dead"

Transient failures (network, timeout, rate limit) → retry
Permanent failures (invalid profile, auth error) → dead immediately

### 3.3 Idempotency (Target)

Each job carries an `idempotency_key`. Before inserting a new job:
1. Check if a job with this key exists and is `running` or `succeeded`
2. If running → return existing job ID (dedup)
3. If succeeded → return cached result
4. If failed/dead → allow retry (new job or increment attempt)

### 3.4 Job Types (Target)

| Type | Triggered by | Current substitute |
|---|---|---|
| `research_visa` | Profile lock | Inline in `/api/research/visa` POST |
| `research_local_requirements` | Profile lock | Inline in `/api/research/local-requirements` POST |
| `research_checklist` | Profile lock | Inline in `/api/research/checklist` POST |
| `guide_generation` | Profile lock | Inline in `/api/profile` PATCH (auto-guide) |
| `flight_search` | User request | Inline in `/api/flights` POST |

### 3.5 Worker Architecture (Target)

- Worker polls `jobs` table for `status = "pending" AND next_attempt_at <= now()`
- Claims job atomically (UPDATE with row-level lock)
- Executes job handler
- Updates status to `succeeded` or `failed`
- Schedules next attempt on failure
- Emits structured job event on completion (see Phase 5.2)

---

## 4. Database Requirements

No `jobs` table exists. The target implementation requires at minimum:

```sql
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz DEFAULT now(),
  last_error text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES relocation_plans(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
```

---

## 5. Gap Summary

| Requirement | Current | Gap |
|---|---|---|
| Job persistence | None (research_status only) | Need `jobs` table |
| Idempotency | None | Need idempotency_key enforcement |
| Retry logic | None | Need exponential backoff |
| Job scheduling | None | Need `next_attempt_at` + worker poll |
| Per-task status | None (aggregate only) | Need per-job status rows |
| Dead-letter queue | None | Need `status = "dead"` handling |
| Worker process | None (inline in routes) | Need background worker |
| Failure visibility | Silent null returns | Need structured failure events |
