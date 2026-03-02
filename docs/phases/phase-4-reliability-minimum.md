# Phase 4 — Reliability Minimum

**Status:** Not started
**Prerequisite:** Phase 3 complete
**Specification authority:** `docs/build-protocol.md` § "Phase 4 — Reliability Minimum"
**Gate protocol:** `docs/phase-implementation-protocol.md`

---

## Rationale

Every external HTTP call in `lib/gomate/` goes out bare — no retry, and most with no timeout. On Vercel serverless, a function has a hard execution limit. A single Firecrawl call that hangs indefinitely blocks the entire settling-in generation request and eventually causes the function to time out with a generic 500.

Additionally, transient failures (Firecrawl 429, 503) are never retried — they always surface as hard failures. This means a brief external service hiccup causes complete feature failure for the user.

The gap register codes driving this phase are G-5.4-A, G-5.4-C, and G-3.3-C.

---

## Entry Criteria

Before starting Phase 4, verify ALL of the following are true:

```
[ ] docs/phase-status.md shows Phase 3 ✅ Complete
[ ] backend-acceptance-phase-3.md exists and is final
[ ] frontend-wiring-report-phase-3.md exists and is final
[ ] regression-report-phase-3.md exists and is final
[ ] scripts/014_add_plan_switch_rpc.sql is applied to the live database
[ ] Generated settling-in tasks have non-null task_key values (Phase 3 confirmed)
[ ] Plan switching is atomic (Phase 3 confirmed)
```

---

## Files to Change

| File | Action | Gap(s) fixed |
|---|---|---|
| `lib/gomate/fetch-with-retry.ts` | Create new file — shared retry wrapper | G-5.4-A, G-5.4-C, G-3.3-C |
| `lib/gomate/settling-in-generator.ts` | Replace `fetch()` calls to Firecrawl with `fetchWithRetry()` | G-5.4-A, G-5.4-C |
| Other `lib/gomate/*.ts` files | Replace all bare `fetch()` calls to external services with `fetchWithRetry()` | G-5.4-A, G-3.3-C |

## Files to NOT Touch

- `generateText()` and `streamText()` calls (AI SDK handles timeouts internally)
- `app/api/chat/route.ts` raw OpenAI fetch — evaluate timeout status first; if it already has `AbortController`, leave it alone
- All migration files
- All UI components

---

## Exact Changes Required

### 1. Create `lib/gomate/fetch-with-retry.ts`

```typescript
/**
 * Fetch with AbortController timeout and exponential backoff retry.
 *
 * @param url         Target URL
 * @param options     RequestInit (do not include signal — this function manages it)
 * @param timeoutMs   Per-attempt timeout in milliseconds (default 15_000)
 * @param maxAttempts Maximum number of attempts, including the first (default 3)
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15_000,
  maxAttempts = 3
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timer)

      // Don't retry 4xx responses — they indicate a client-side problem
      if (res.ok || (res.status >= 400 && res.status < 500)) return res

      // 5xx: server error — retry
      throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      clearTimeout(timer)
      lastError = err

      if (attempt < maxAttempts - 1) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise(r => setTimeout(r, 500 * 2 ** attempt))
      }
    }
  }

  throw lastError
}
```

**Key behaviours:**
- Each attempt has its own `AbortController` and timeout timer
- 4xx responses are returned immediately (not retried) — they indicate caller error, not transient failure
- 5xx responses are retried up to `maxAttempts` times
- Aborted/network errors are retried up to `maxAttempts` times
- After all attempts exhausted, throws the last error — caller decides how to handle

---

### 2. `lib/gomate/settling-in-generator.ts` — Replace Firecrawl fetch calls

Search for all `fetch(` calls inside `settling-in-generator.ts`.

For each call to a Firecrawl endpoint (search or scrape), replace:
```typescript
const response = await fetch(firecrawlUrl, { method: 'POST', headers: ..., body: ... })
```
with:
```typescript
import { fetchWithRetry } from './fetch-with-retry'
const response = await fetchWithRetry(firecrawlUrl, { method: 'POST', headers: ..., body: ... }, 15_000)
```

Do not change the response-handling logic below each fetch — only the fetch call itself.

---

### 3. Audit all other `lib/gomate/*.ts` Firecrawl callers

Run a search for `fetch(` across `lib/gomate/`:

Expected callers (verify against actual code):
- `lib/gomate/numbeo-scraper.ts` — already has 15s timeout via `AbortController`; verify and replace with `fetchWithRetry` for retry benefit
- `lib/gomate/web-research.ts` — check for bare `fetch()` calls; replace each with `fetchWithRetry`
- `lib/gomate/flight-search.ts` — already has 30s timeout; replace with `fetchWithRetry` for retry benefit

**Do not touch:**
- Calls that use the Firecrawl SDK (`import FirecrawlApp from '@mendable/firecrawl-js'`) — the SDK manages its own timeouts
- OpenAI/OpenRouter calls using `@ai-sdk/openai` — the AI SDK manages timeouts

---

## Callers That Already Have Timeouts (Verify, Then Upgrade to fetchWithRetry)

| File | Existing timeout | Action |
|---|---|---|
| `lib/gomate/numbeo-scraper.ts` | 15s `AbortController` | Replace with `fetchWithRetry` to add retry |
| `lib/gomate/flight-search.ts` | 30s `AbortController` | Replace with `fetchWithRetry` to add retry |

For these, keep the same timeout value when calling `fetchWithRetry`. Only add the retry benefit.

---

## Gap Codes Fixed in This Phase

| Code | System | Severity | Description |
|---|---|---|---|
| G-5.4-A | Reliability | P0 | No retry logic anywhere — every external call is single-attempt |
| G-5.4-C | Reliability | P1 | Client-side timeouts on only 2 of ~20+ external calls |
| G-3.3-C | Source Fetch | P1 | No timeout on most Firecrawl calls |

---

## V1 Invariants This Phase Strengthens

This phase has no direct V1 invariant, but it is a hard prerequisite for the system being production-grade. Without it, a single Firecrawl outage causes complete settling-in feature failure for all users.

---

## Exit Criteria (Success Criteria from `docs/build-protocol.md`)

All of the following must be true before Phase 4 can be declared complete:

```
[ ] lib/gomate/fetch-with-retry.ts exists and exports fetchWithRetry()
[ ] All Firecrawl calls in lib/gomate/ use fetchWithRetry (no bare fetch() to external URLs)
[ ] A simulated Firecrawl timeout (mock that never responds) causes the generator to fall back
    to default tasks within 15 seconds — does not hang indefinitely
[ ] Settling-in generation completes successfully when Firecrawl responds correctly
[ ] No fetch() calls to external services in lib/gomate/ lack a timeout
[ ] tsc --noEmit passes with zero errors
```

---

## Required Gate Artifacts

| Artifact | Owner | Gate |
|---|---|---|
| `backend-acceptance-phase-4.md` | Claude Code | Backend Acceptance Gate (gate 2) |
| `frontend-wiring-report-phase-4.md` | Claude Code | Frontend Wiring Gate (gate 3) |
| `regression-report-phase-4.md` | Claude Code + User | Regression Gate (gate 6) |

Plus: `PHASE_4_USER_TEST.md` (User Test Spec Gate, gate 4).

---

## No Migration Required

Phase 4 makes no database schema changes. No SQL migration file needs to be created or applied. The next migration number remains **015**.

---

## Note on Frontend Wiring Gate

Phase 4 has no new frontend surface — it is a pure backend reliability change. Per `docs/phase-implementation-protocol.md` § 10 (Foundation Phases), the `frontend-wiring-report-phase-4.md` artifact must still be produced and must explicitly document that no frontend wiring was applicable for this phase, with the reason.
