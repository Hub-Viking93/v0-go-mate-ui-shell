# GoMate — Build Protocol

**Version:** 1.0
**Status:** Historical — all phases complete
**Based on:** `docs/audit.md` v1.0, `docs/engineering-contract.md` v1.0
**Date:** 2026-02-25
**Completion:** All 5 phases completed (2026-02-28 through 2026-03-02)

> For current development work, see `docs/audits/definitions-vs-system-audit.md` (44 gaps identified) and the triage recommendations therein.
> For document precedence and authority resolution, see `docs/audits/document-authority.md`.

This document defines the exact sequence for completing GoMate to production-ready v1. Every phase leaves the system in a deployable, functional state. Phases are not optional and are not reordered.

Before beginning any historical phase flow, read `docs/audits/document-authority.md`, then `docs/audit.md` as the original baseline, and `docs/engineering-contract.md` in full.

---

## Reading this Document

Each phase specifies:

- **Prerequisite** — what must be complete before this phase begins
- **Changes** — exact file, what to change, and what the result must be
- **Do not touch** — functional systems explicitly excluded from this phase
- **Success criteria** — verifiable conditions that confirm the phase is complete

A phase is not complete until every success criterion is met.

---

## Phase 0 — Schema Integrity

**Prerequisite:** None. This phase may be executed immediately.

**Rationale:** Application code references columns that do not exist in any migration. This violates INV-D1 and blocks safe deployment. All schema gaps must be resolved before any code changes.

### Changes

#### `scripts/011_add_settling_task_columns.sql` (create new)

Add the three columns that application code (`settling-in-generator.ts`, `settling-in-task-card.tsx`) reads and writes but that are absent from migration 010:

```sql
alter table settling_in_tasks
  add column if not exists steps text[],
  add column if not exists documents_needed text[],
  add column if not exists cost text;
```

Note: `cost_estimate text` already exists in migration 010. Keep it. The two columns serve different purposes (estimate vs actual). Do not drop `cost_estimate`.

#### `scripts/012_add_research_columns.sql` (create new)

Formalize the research columns written and read by `app/api/research/*/route.ts` but absent from any migration:

```sql
alter table relocation_plans
  add column if not exists visa_research jsonb,
  add column if not exists local_requirements_research jsonb;
```

#### `scripts/013_add_document_statuses.sql` (create new)

Formalize the document statuses column used by the documents page:

```sql
alter table relocation_plans
  add column if not exists document_statuses jsonb;
```

### Do Not Touch

- All existing migration files (`001` through `010`) — never edit an existing migration
- `settling_in_tasks` table structure beyond the three new columns
- RLS policies on any table

### Success Criteria

```
[ ] scripts/011_add_settling_task_columns.sql exists and is idempotent
[ ] scripts/012_add_research_columns.sql exists and is idempotent
[ ] scripts/013_add_document_statuses.sql exists and is idempotent
[ ] All three migrations have been run against the database
[ ] SELECT column_name FROM information_schema.columns
    WHERE table_name = 'settling_in_tasks'
    returns: steps, documents_needed, cost (in addition to existing columns)
[ ] SELECT column_name FROM information_schema.columns
    WHERE table_name = 'relocation_plans'
    returns: visa_research, local_requirements_research, document_statuses
[ ] No application code references a column that does not exist in a migration
```

---

## Phase 1 — P0 Security Fixes

**Prerequisite:** Phase 0 complete.

**Rationale:** Two P0 gaps make the system unsafe for real users: any user can grant themselves Pro+ tier for free (INV-S1 violated), and subscription expiry is not enforced (INV-S2 violated). Two additional P0 gaps make core functionality broken: the PDF guide renders `undefined` for all users (INV-D5 violated), and the auth callback has an open redirect (INV-S3 violated).

### Changes

#### `app/api/subscription/route.ts` — Remove self-upgrade

**Gap:** G-4.3-D. The `POST` handler allows any authenticated user to upgrade their own subscription tier by sending `{ action: "upgrade", tier: "pro_plus", billing_cycle: "monthly" }`. There is no payment verification.

**Fix:** Remove the `POST` handler entirely. The subscription tier will be set by server-side billing logic only (future Stripe webhook). No user-facing endpoint may write the `tier` column.

```diff
- export async function POST(req: Request) { ... }
```

Keep the `GET` handler — it is used by the UI to fetch subscription info and feature access flags. Only the `POST` handler is removed.

If any UI component calls `POST /api/subscription`, it will receive a 405 Method Not Allowed — this is intentional. No upgrade UI should be functional before Stripe is integrated.

Note: `PATCH /api/subscription` does not exist in the codebase. The gap in `audit.md` incorrectly names the method. The vulnerability is in `POST`.

#### `lib/gomate/tier.ts` — Expiry already enforced (no change needed)

**Verification result:** `getUserTier()` at `lib/gomate/tier.ts:280` already enforces expiry:

```typescript
if (sub.expires_at && new Date(sub.expires_at) < new Date()) return "free"
```

**G-4.3-B is a false gap.** INV-S2 is already met. No change required.

#### `app/api/profile/route.ts` — Fix guide auto-generation on plan lock

**Gap:** G-6.2-D and G-4.1-G. When a plan is locked (`action === "lock"`), the route auto-generates a guide using `generateGuideFromProfile()` and inserts it with `sections: guideData.sections`. The `guides` table has no `sections` column — it uses separate columns (`visa_section`, `budget_section`, etc.). All section columns are stored as NULL. When the user views or downloads the guide, every section renders blank/undefined.

**Root cause location:** `app/api/profile/route.ts:110–131`

**Current broken code:**
```typescript
import { generateGuideFromProfile } from "@/lib/gomate/guide-generator"
// ...
const guideData = generateGuideFromProfile(profile)
await supabase.from("guides").insert({
  user_id: user.id,
  plan_id: currentPlan.id,
  title: guideData.title,
  destination: guideData.destination,
  purpose: guideData.purpose,
  sections: guideData.sections,  // ← wrong column; silently ignored by Supabase
})
```

**Fix:** Replace with the same pattern used in `app/api/guides/route.ts`, which works correctly:

```typescript
import { generateGuide, guideToDbFormat } from "@/lib/gomate/guide-generator"
// ...
const guide = generateGuide(profile)
const dbData = guideToDbFormat(guide, user.id, currentPlan.id)
await supabase.from("guides").insert(dbData)
```

The import of `generateGuideFromProfile` can be removed from `app/api/profile/route.ts` after this change.

Note: `lib/gomate/pdf-generator.ts` and `app/(app)/guides/[id]/page.tsx` are correct and do not need changes. The page reads `visa_section`, `budget_section`, etc. from the DB row, and the PDF generator expects the same field names. The only broken link is the insert.

#### `app/auth/callback/route.ts` — Validate redirect parameter

**Gap:** G-6.1-C. The `next` query parameter is passed directly to `NextResponse.redirect()` without validation.

**Current broken code** (`app/auth/callback/route.ts:7,14`):
```typescript
const next = searchParams.get("next") ?? "/dashboard"
// ...
return NextResponse.redirect(`${origin}${next}`)
```

An attacker can send `next=//evil.com` which the browser interprets as a protocol-relative URL, redirecting the user to `evil.com` after authentication.

**Fix:**
```typescript
const ALLOWED_REDIRECTS = ['/', '/dashboard', '/chat', '/settling-in', '/guides', '/profile', '/settings', '/booking']
const rawNext = searchParams.get("next") ?? "/dashboard"
const next = ALLOWED_REDIRECTS.includes(rawNext) ? rawNext : "/dashboard"
return NextResponse.redirect(`${origin}${next}`)
```

#### `lib/supabase/middleware.ts` — Fix catch block

**Gap:** G-6.1-D. The catch block in `lib/supabase/middleware.ts:68-72` calls `return supabaseResponse` on auth error. `supabaseResponse` was created with `NextResponse.next()` at line 5, which passes the request through. Auth errors silently allow all requests through.

Note: `middleware.ts` (repo root) is a 12-line wrapper that calls `updateSession()`. The bug is in `lib/supabase/middleware.ts`, not `middleware.ts` itself.

**Current broken code:**
```typescript
} catch (error) {
    console.error("[GoMate] Middleware auth error:", error)
    // On any error, allow the request to proceed
    return supabaseResponse  // ← passes request through on auth failure
}
```

**Fix:** Replace `return supabaseResponse` with a redirect to the auth error page:
```typescript
} catch (error) {
    console.error("[GoMate] Middleware auth error:", error)
    const url = request.nextUrl.clone()
    url.pathname = "/auth/error"
    url.searchParams.set("message", "Authentication error")
    return NextResponse.redirect(url)
}
```

The `/auth/error` route already exists (referenced in the callback route at line 19). Do not create a new error page.

### Do Not Touch

- The Supabase auth flow (login, signup, session refresh)
- `lib/supabase/middleware.ts` beyond the catch block
- Any other route in `app/api/`
- The tier check in `app/api/chat/route.ts` (already correct)

### Success Criteria

```
[ ] POST /api/subscription with { action: "upgrade", tier: "pro_plus" } by any user returns 404 or 405
[ ] GET /api/subscription still returns subscription info and feature access (not broken)
[ ] Guide download renders a complete PDF with all sections populated (visa, budget, housing, etc.)
[ ] GET /api/guides/{id} returns guide with non-null visa_section, budget_section, housing_section
[ ] GET /auth/callback?next=//evil.com redirects to /dashboard (not to evil.com)
[ ] Triggering a middleware auth error in lib/supabase/middleware.ts redirects to /auth/error
[ ] No regression in login, signup, or callback flows
[ ] Note: expiry enforcement (INV-S2) was already implemented — no change needed
```

---

## Phase 2 — Settling-In Stage Integrity

**Prerequisite:** Phase 1 complete.

**Rationale:** All settling-in endpoints are accessible to pre-arrival users (plan.stage !== 'arrived'), violating INV-D2 and INV-D3. DAG cycle detection is absent, violating INV-D4.

### Changes

#### `app/api/settling-in/generate/route.ts` — Add stage check

**Gap:** G-9.3-A. The generate endpoint calls `generateSettlingInPlan()` for any authenticated user, regardless of plan stage.

**Fix:** After fetching the current plan and before calling the generator, add:

```typescript
if (plan.stage !== 'arrived') {
  return NextResponse.json(
    { error: "Settling-in features require arrival confirmation" },
    { status: 400 }
  )
}
```

#### `app/api/settling-in/[id]/route.ts` — Add stage check to PATCH

**Gap:** G-10.2-C. Task completion via PATCH does not verify plan stage.

**Fix:** Same pattern — after fetching the plan that owns the task, verify `plan.stage === 'arrived'` before allowing the status update.

#### `app/api/settling-in/route.ts` — Add stage check to GET

**Gap:** G-9.1-F. The GET endpoint returns settling-in tasks for any plan.

**Fix:** If `plan.stage !== 'arrived'`, return an empty task list with a stage indicator rather than a 400, so the UI can render a meaningful empty state:

```typescript
if (plan.stage !== 'arrived') {
  return NextResponse.json({ tasks: [], stage: plan.stage, arrivalDate: null })
}
```

#### `lib/gomate/dag-validator.ts` (create new file)

**Gap:** G-9.4-A. No cycle detection exists anywhere in the task graph pipeline.

**Create** `lib/gomate/dag-validator.ts` with a single exported function:

```typescript
/**
 * Validates that the task dependency graph is a DAG (no cycles).
 * Returns true if valid, false if a cycle is detected.
 * Tasks are represented as { id: string, depends_on: string[] }.
 */
export function isValidDAG(tasks: { id: string; depends_on: string[] }[]): boolean {
  // Use DFS with three-color marking: white (unvisited), grey (in progress), black (done)
  const state = new Map<string, 'white' | 'grey' | 'black'>()
  for (const t of tasks) state.set(t.id, 'white')

  const adjacency = new Map<string, string[]>()
  for (const t of tasks) adjacency.set(t.id, t.depends_on ?? [])

  function dfs(id: string): boolean {
    const s = state.get(id)
    if (s === 'black') return true   // already fully visited
    if (s === 'grey') return false   // back edge = cycle

    state.set(id, 'grey')
    for (const dep of adjacency.get(id) ?? []) {
      if (!dfs(dep)) return false
    }
    state.set(id, 'black')
    return true
  }

  for (const t of tasks) {
    if (state.get(t.id) === 'white') {
      if (!dfs(t.id)) return false
    }
  }
  return true
}
```

#### `app/api/settling-in/generate/route.ts` — Use DAG validator

After `resolveDependencies()` resolves tempId references and before the batch insert, validate the graph:

```typescript
import { isValidDAG } from '@/lib/gomate/dag-validator'

// After dependency resolution:
if (!isValidDAG(tasks)) {
  console.error('[settling-in/generate] Cycle detected in generated task graph — using fallback tasks')
  tasks = getDefaultSettlingTasks(/* destination */)
}
```

### Do Not Touch

- `lib/gomate/settling-in-generator.ts` beyond the DAG validation call
- `computeAvailableTasks()` — this is working correctly
- Settling-in task card UI
- Compliance timeline components

### Success Criteria

```
[ ] POST /api/settling-in/generate with plan.stage = 'complete' returns 400
[ ] PATCH /api/settling-in/{id} with plan.stage = 'complete' returns 400
[ ] GET /api/settling-in with plan.stage = 'complete' returns { tasks: [], stage: 'complete', arrivalDate: null }
[ ] lib/gomate/dag-validator.ts exists and exports isValidDAG()
[ ] isValidDAG([{ id: 'a', depends_on: ['b'] }, { id: 'b', depends_on: ['a'] }]) returns false
[ ] isValidDAG([{ id: 'a', depends_on: [] }, { id: 'b', depends_on: ['a'] }]) returns true
[ ] Generation with a cyclical AI response falls back to default tasks without throwing
[ ] All existing settling-in functionality continues to work for arrived users
```

---

## Phase 3 — Data Integrity

**Prerequisite:** Phase 2 complete.

**Rationale:** Non-atomic plan switching can leave a user with zero or two active plans. A race condition on concurrent login can create duplicate plans. `task_key` has a unique constraint but is never populated, which will cause insert failures if it is ever used.

### Changes

#### `app/api/plans/route.ts` — Atomic plan switch via RPC

**Gap:** G-4.2-A. The `switch` action in `PATCH /api/plans` (lines 144–165) performs two sequential writes:

```typescript
// Write 1: clear all plans
await supabase.from("relocation_plans").update({ is_current: false }).eq("user_id", user.id)
// Write 2: set new plan as current
await supabase.from("relocation_plans").update({ is_current: true }).eq("id", planId)...
```

A crash between these two writes leaves the user with no `is_current` plan. Option B (conditional single UPDATE) is not directly expressible via the Supabase JS client. A Supabase RPC function is required.

**Step 1:** Create `scripts/014_add_plan_switch_rpc.sql`:

```sql
create or replace function switch_current_plan(p_user_id uuid, p_plan_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update relocation_plans
  set is_current = (id = p_plan_id)
  where user_id = p_user_id
    and (is_current = true or id = p_plan_id);
end;
$$;
```

This single UPDATE atomically sets `is_current = true` for the target plan and `is_current = false` for all others, in one transaction.

**Step 2:** In `app/api/plans/route.ts`, replace the `switch` action handler (lines 144–165):

```typescript
if (action === "switch") {
  const { error } = await supabase.rpc("switch_current_plan", {
    p_user_id: user.id,
    p_plan_id: planId,
  })

  if (error) {
    return NextResponse.json({ error: "Failed to switch plan" }, { status: 500 })
  }

  const { data: switched } = await supabase
    .from("relocation_plans")
    .select()
    .eq("id", planId)
    .eq("user_id", user.id)
    .single()

  return NextResponse.json({ plan: switched })
}
```

#### `app/api/profile/route.ts` — Fix plan creation race condition

**Gap:** G-6.2-E. The `GET` handler (lines 29–48) creates a plan if none exists with a bare `insert`. On concurrent login, two requests may simultaneously reach `if (!plan)`, both find nothing, and both attempt the insert.

**Severity clarification:** The partial unique index on `(user_id) WHERE is_current = true` (from migration 009) prevents actual duplicate records — the second insert fails with a constraint violation. However, the second request returns a 500 error to the client, which causes a confusing failure on first login.

**Current broken code:**
```typescript
if (!plan) {
  const { data: newPlan, error: createError } = await supabase
    .from("relocation_plans")
    .insert({ user_id: user.id, profile_data: {}, stage: "collecting", is_current: true })
    .select()
    .single()

  if (createError) {
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 })
  }
  return NextResponse.json({ plan: newPlan })
}
```

**Fix:** Handle the constraint violation by re-fetching the existing plan:

```typescript
if (!plan) {
  const { data: newPlan, error: createError } = await supabase
    .from("relocation_plans")
    .insert({ user_id: user.id, profile_data: {}, stage: "collecting", is_current: true })
    .select()
    .single()

  if (createError) {
    // Constraint violation: another concurrent request already created it
    // Re-fetch and return the existing plan instead of failing
    const { data: existingPlan } = await supabase
      .from("relocation_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle()

    if (!existingPlan) {
      console.error("[GoMate] Error creating plan:", createError)
      return NextResponse.json({ error: "Failed to create plan" }, { status: 500 })
    }
    return NextResponse.json({ plan: existingPlan })
  }

  return NextResponse.json({ plan: newPlan })
}
```

#### `app/api/settling-in/generate/route.ts` — Populate `task_key`

**Gap:** G-9.2-B. The `task_key` unique constraint exists in migration 010 but is never populated. Future queries by `task_key` will always miss, and bulk inserts will not benefit from the constraint.

**Fix:** Derive `task_key` from a deterministic slug of the task title. In `generateSettlingInPlan()` or just before the batch insert, set:

```typescript
task_key: task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64)
```

This is deterministic and collision-resistant for distinct task titles within a destination.

### Do Not Touch

- Settling-in engine and task card UI
- Profile schema and Zod validation
- Auth flow

### Success Criteria

```
[ ] scripts/014_add_plan_switch_rpc.sql exists and creates the switch_current_plan() function
[ ] PATCH /api/plans with action "switch" uses supabase.rpc("switch_current_plan", ...)
[ ] Two simultaneous plan-switch requests do not leave the user with no active plan
[ ] Two simultaneous GET /api/profile requests on first login do not return 500 for either request
[ ] Both concurrent requests return the same plan (no duplicates)
[ ] Generated tasks have non-null task_key values
[ ] task_key values are URL-safe slugs derived from titles
[ ] No existing plan switch or profile creation functionality is broken
```

---

## Phase 4 — Reliability Minimum

**Prerequisite:** Phase 3 complete.

**Rationale:** All external HTTP calls (Firecrawl) lack timeouts. A single slow Firecrawl call can hang the entire settling-in generation request indefinitely. There is no retry on transient failures.

### Changes

#### `lib/gomate/fetch-with-retry.ts` (create new file)

Create a shared fetch wrapper with timeout and retry:

```typescript
/**
 * Fetch with AbortController timeout and exponential backoff retry.
 * @param url         Target URL
 * @param options     RequestInit (do not include signal — this function manages it)
 * @param timeoutMs   Per-attempt timeout in milliseconds (default 15000)
 * @param maxAttempts Maximum number of attempts (default 3)
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
      if (res.ok || res.status < 500) return res  // don't retry 4xx
      throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 500 * 2 ** attempt))  // 500ms, 1s, 2s
      }
    }
  }
  throw lastError
}
```

#### `lib/gomate/settling-in-generator.ts` — Replace direct fetch calls

Replace all `fetch(firecrawlUrl, ...)` calls with `fetchWithRetry(firecrawlUrl, ...)`. This covers both the search and scrape steps in `generateSettlingInPlan()`.

Do not change the response-handling logic — only the fetch call itself.

#### Other Firecrawl callers

Search for `fetch(` in `lib/gomate/` and identify any other callers that hit Firecrawl or other external services without a timeout. Apply `fetchWithRetry` to each.

Do not modify OpenAI/OpenRouter calls if they already have SDK-level timeout configuration.

### Do Not Touch

- `generateText()` and `streamText()` calls (AI SDK handles timeouts internally)
- The raw OpenAI fetch in `app/api/chat/route.ts` — evaluate separately; do not change in this phase without first verifying it lacks a timeout

### Success Criteria

```
[ ] lib/gomate/fetch-with-retry.ts exists and exports fetchWithRetry()
[ ] All Firecrawl calls in lib/gomate/ use fetchWithRetry
[ ] A simulated Firecrawl timeout (using a mock that never responds) causes the generator to fall back to default tasks within 15 seconds, not hang indefinitely
[ ] Generation still completes successfully when Firecrawl responds correctly
[ ] No fetch() calls to external services in lib/gomate/ lack a timeout
```

---

## Phase 5 — UI Integrity

**Prerequisite:** Phase 4 complete.

**Rationale:** The booking page always uses mock data (never shows real results). Compliance alert dismissal resets on every page navigation. The why-it-matters endpoint has no rate limiting and can be called without limit by any authenticated user.

### Changes

#### `components/compliance-alerts.tsx` — Persist dismissal to localStorage

**Gap:** G-10.3-B. Dismissal is `useState(false)` — resets on component unmount.

**Fix:** Replace `useState` with a localStorage-backed state:

```typescript
const DISMISS_KEY = 'compliance-alerts-dismissed'

const [dismissed, setDismissed] = useState(() => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DISMISS_KEY) === 'true'
})

function handleDismiss() {
  localStorage.setItem(DISMISS_KEY, 'true')
  setDismissed(true)
}
```

Note: This is per-browser, not per-session across devices. It matches the contract's "localStorage as fallback" target. The server-side `compliance_alert_dismissals` table (full target) is parked for v2.

#### `app/api/settling-in/[id]/why-it-matters/route.ts` — Add rate limiting

**Gap:** G-9.5-A. No rate limiting exists on the enrichment endpoint.

**Fix:** Add a simple per-user daily counter using Supabase:

```typescript
// Check daily usage
const today = new Date().toISOString().split('T')[0]
const { count } = await supabase
  .from('settling_in_tasks')
  .select('id', { count: 'exact' })
  .eq('plan_id', task.plan_id)
  .not('why_it_matters', 'is', null)

if ((count ?? 0) >= 20) {
  return NextResponse.json({ error: 'Daily enrichment limit reached' }, { status: 429 })
}
```

This counts already-enriched tasks for the plan (a proxy for daily usage). Adjust the limit (20) based on cost tolerance. This is not a precise per-day counter — it is a reasonable guard against abuse without requiring a separate counter table.

#### `app/(app)/booking/page.tsx` — Evaluate mock flag

**Gap:** G-7.1-E. The booking page appears to use `useMock: true` or similar. Investigate whether removing the mock flag connects to a live flight search API or if the flight search route itself is unimplemented.

**If `GET /api/flights` is functional:** Remove the mock flag from the booking page.

**If `GET /api/flights` is not functional:** This gap is out of scope for Phase 5. Document that booking remains mock and add it to v2 scope. Do not build a flight search API in this phase.

Read `app/(app)/booking/page.tsx` and `app/api/flights/route.ts` before making any change.

### Do Not Touch

- Settling-in task card UI
- Compliance timeline rendering
- Post-arrival chat mode
- Any route not mentioned above

### Success Criteria

```
[ ] Compliance alert dismissed in one browser session remains dismissed after page reload
[ ] Compliance alert dismissed in one tab remains dismissed after navigating to another page and back
[ ] POST /api/settling-in/{id}/why-it-matters called more than 20 times on the same plan returns 429
[ ] Booking page assessment complete: either shows real results or is documented as v2
[ ] No regression in compliance timeline rendering
[ ] No regression in why-it-matters enrichment for normal usage (< 20 enrichments per plan)
```

---

## Post-Phase Verification

After all five phases are complete, verify the V1 invariants from `docs/audit.md § 2`:

```
INV-S1: POST /api/subscription with { tier: "pro_plus" } by a free user → 403/404
INV-S2: getUserTier() for expired subscription → 'free'
INV-S3: /auth/callback?next=https://evil.com → redirects to /
INV-S4: Middleware error → redirects to error page (not allows through)

INV-D1: Every DB column in application code exists in scripts/
INV-D2: settling_in_tasks creation only for stage = 'arrived' plans
INV-D3: settling_in_tasks completion only for stage = 'arrived' plans
INV-D4: AI-generated task graph with a cycle → falls back to defaults
INV-D5: Guide PDF export renders all sections without undefined

INV-F1: Guide PDF download renders a complete document
INV-F2: Free-tier user cannot reach Pro+ API endpoint
INV-F3: Post-arrival chat mode activates iff plan.stage === 'arrived'
INV-F4: Task dependency unlock correct after every completion
```

All 12 invariants must pass for v1 to be considered production-ready.

---

## What Is Explicitly Out of Scope for v1

These systems will not be built in these phases. Do not add them:

- Job System (5.1)
- Observability / trace_id (5.2)
- Artifact System (5.3)
- Stripe integration (payment processing)
- Chat history persistence
- Password reset
- Server-side compliance alert dismissal table
- Consolidation of parallel visa systems (works as-is)
- `confirmed` state machine state (unreachable; no user impact)

Building any of these during a v1 phase is out of scope and must not happen.

---

## Migration Sequence Reference

| File | Phase | Description |
|---|---|---|
| `scripts/011_add_settling_task_columns.sql` | 0 | `steps`, `documents_needed`, `cost` on `settling_in_tasks` |
| `scripts/012_add_research_columns.sql` | 0 | `visa_research`, `local_requirements_research` on `relocation_plans` |
| `scripts/013_add_document_statuses.sql` | 0 | `document_statuses` on `relocation_plans` |
| `scripts/014_add_plan_switch_rpc.sql` | 3 | Atomic plan switch RPC (`switch_current_plan` function) |
| `scripts/015_add_task_key_column.sql` | 3 | `task_key` on `settling_in_tasks` |
| `scripts/016_add_research_status.sql` | 6 | `research_status`, `research_completed_at` on `relocation_plans` |
| `scripts/017_add_deadline_columns.sql` | 6 | `deadline_at`, `deadline_anchor` on `settling_in_tasks`; OVERDUE status |
| `scripts/018_add_plan_version.sql` | 7 | `plan_version` on `relocation_plans` |
| `scripts/019_add_guide_versioning.sql` | 9 | Guide versioning + staleness columns on `guides` |
| `scripts/020_add_onboarding_completed.sql` | 10 | `onboarding_completed` on `relocation_plans` |

Next migration number: `021`.
