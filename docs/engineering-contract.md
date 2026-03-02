# GoMate — Engineering Contract

**Version:** 1.0
**Status:** Authoritative
**Date:** 2026-02-25

This document defines the rules that govern all engineering work on GoMate. No exceptions. These rules apply to every change, in every phase, made by any engineer or AI agent.

When a rule and a contract spec conflict, this document wins. When a rule and business requirements conflict, escalate — do not bypass the rule.

---

## 1. Core Principle

**The system must be in a deployable, functional state after every change.**

No phase, no commit, no session ends with the system in a worse state than it started. If a change cannot be completed safely, it is staged behind a feature flag or not made at all.

---

## 2. Schema Rules

### 2.1 Every column used in code must exist in a migration

If application code reads from or writes to a database column, that column must be defined in a numbered migration script in `scripts/`. No exceptions.

If a column exists in the deployed database but not in `scripts/`, write the migration as `add column if not exists`. Run it. Then update the code.

### 2.2 Migrations are sequential and idempotent

Migration files are named `NNN_description.sql` where `NNN` is the next integer in sequence (currently `016` is next — migrations 011–013 were applied during Phase 0; 014–015 applied during Phase 3).

Every migration must be safe to run more than once:
- Use `add column if not exists` for column additions
- Use `create table if not exists` for table creation
- Use `do $$ ... $$` blocks with existence checks for constraint operations
- Never use bare `alter table add column` without `if not exists`

### 2.3 Never drop or rename in migrations without explicit approval

`drop table`, `drop column`, and `alter column ... rename to` are destructive. They require explicit discussion before execution. Prefer adding a new column and deprecating the old one over renaming.

### 2.4 RLS must be enabled on all user-data tables

Every table that stores user data must have `alter table ... enable row level security` and appropriate policies keyed on `auth.uid() = user_id`.

---

## 3. API Route Rules

### 3.1 All routes require authentication

Every API route that reads or writes user data must call `supabase.auth.getUser()` and return `401` if no valid session exists. No exceptions for "convenience" or "testing".

```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

### 3.2 All gated routes require tier check

Routes that are Pro+ only must call `getUserTier(user.id)` and return `403` if the tier does not qualify.

```typescript
const tier = await getUserTier(user.id)
if (tier !== "pro_plus") {
  return NextResponse.json({ error: "Pro+ required" }, { status: 403 })
}
```

### 3.3 All settling-in routes require stage check

Every route under `/api/settling-in/` must verify `plan.stage === 'arrived'` before performing its operation.

```typescript
if (plan.stage !== 'arrived') {
  return NextResponse.json(
    { error: "Settling-in features require arrival confirmation" },
    { status: 400 }
  )
}
```

### 3.4 No route may silently ignore errors

`console.error` alone is not error handling. Every error path must return an appropriate HTTP status code with a descriptive error body. The client must always know whether a request succeeded or failed.

```typescript
// Wrong
console.error("[Route] Error:", err)
// Correct
console.error("[Route] Error:", err)
return NextResponse.json({ error: "Descriptive message" }, { status: 500 })
```

### 3.5 No self-HTTP calls

A route may not call its own application's other routes via HTTP. This includes `fetch("http://localhost:3000/api/...")` and `fetch(process.env.NEXT_PUBLIC_URL + "/api/...")`. Use shared functions or service modules instead.

---

## 4. Code Quality Rules

### 4.1 No in-memory caches

Global objects used as caches (`const cache = {}`) are non-functional in serverless/edge environments — each invocation gets a fresh module. Use Supabase for persistence or accept that data will be refetched.

### 4.2 All external HTTP calls must have timeouts

Every `fetch()` call to an external service (Firecrawl, OpenAI, OpenRouter) must have an `AbortController` timeout.

```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 10_000) // 10 seconds
try {
  const res = await fetch(url, { signal: controller.signal })
} finally {
  clearTimeout(timeout)
}
```

The only exceptions are calls that have SDK-level timeouts configured explicitly.

### 4.3 LLM calls must specify maxTokens

Every call to a language model (via `generateText`, `streamText`, or raw fetch) must set an explicit `maxTokens` limit. No open-ended generation.

### 4.4 No regex JSON parsing from LLM output

Do not use `/\[[\s\S]*\]/` or similar patterns to extract JSON from LLM responses. Use structured output where the provider supports it (`response_format: { type: "json_object" }` for OpenAI, or Zod schemas via the AI SDK). If structured output is not available, wrap the parsing in try/catch with a fallback.

### 4.5 No Math.random() for data fields

`Math.random()` may not be used to generate values stored in the database or returned as meaningful data to users. Use `crypto.randomUUID()` for IDs and deterministic logic for everything else.

### 4.6 No hardcoded URLs in production code

API URLs, external service URLs, and redirect targets must come from environment variables or a configuration module. The one exception is the Supabase client, which is already configured via environment variables.

---

## 5. Security Rules

### 5.1 Subscription tier is server-only

The subscription tier is fetched from Supabase using `getUserTier()` on every request that needs it. The client is never trusted to report its own tier. There is no endpoint that allows a user to set their own tier — the `POST /api/subscription` self-upgrade path was removed in Phase 1.

### 5.2 Redirect parameters must be validated

Any route that accepts a redirect URL as a parameter (e.g., `?next=`) must validate it against an explicit allowlist before redirecting. Never pass a user-supplied URL directly to `NextResponse.redirect()`.

```typescript
const ALLOWED_REDIRECTS = ['/', '/dashboard', '/chat', '/settling-in']
const next = url.searchParams.get('next') ?? '/'
const safePath = ALLOWED_REDIRECTS.includes(next) ? next : '/'
```

### 5.3 RLS is the last line of defence, not the first

Application code must verify ownership before making DB calls. Do not rely solely on RLS to prevent cross-user data access. Always include `.eq("user_id", user.id)` in queries that return user-specific rows.

---

## 6. Forbidden Patterns

These patterns exist in the codebase today and must not be repeated in new code. Where they exist, they are documented as gaps to be fixed.

| Pattern | Why forbidden | Where it exists today |
|---|---|---|
| Parallel visa lookup systems | Data inconsistency between systems | `visa-checker.ts`, `visa-recommendations.ts`, dashboard |
| In-memory cache objects | Non-functional in serverless | `web-research.ts` |
| Self-HTTP calls | Fragile; creates circular dependency risk | `research/trigger/route.ts` |
| Regex JSON extraction from LLM | Brittle; fails on edge cases | `checklist-generator.ts`, `settling-in-generator.ts` |
| `fetch()` without timeout | Hangs under load | Most Firecrawl calls |
| `console.error` without return | Silent errors | Multiple routes |
| `Math.random()` for data | Non-deterministic production data | `flight-search.ts` |
| `"use client"` on shared server/client modules | Runtime errors | `airports.ts` |

---

## 7. Change Protocol

Before making any change:

1. Read the relevant system document in `docs/systems/` for the area being changed.
2. Read `docs/audit.md` to understand whether this system is WORKING, PARTIAL, BROKEN, or MISSING.
3. Check the build phase in `docs/build-protocol.md` — is this change in the current phase?
4. Make the change.
5. Verify against the success criteria defined in `docs/build-protocol.md` for the current phase.

Full reading order for phase implementation: `docs/phase-status.md` → `docs/build-protocol.md` → `docs/phase-implementation-protocol.md`. See `/CLAUDE.md § Implementing a Build Phase` for the complete protocol.

If a change is not in any build phase, it is either:
- A bug fix (acceptable at any time if it does not break other systems)
- Out of scope (do not make it)

---

## 8. What Must Not Be Touched Without Explicit Instruction

The following systems are functional and fragile. Changes to these require explicit discussion:

- `lib/gomate/profile-schema.ts` — field additions/removals affect the entire interview flow
- `lib/gomate/state-machine.ts` — logic changes affect all chat sessions
- `lib/supabase/middleware.ts` — auth middleware failure lets all requests through
- `scripts/001_*.sql` through `scripts/010_*.sql` — never edit existing migrations
- `components/chat/` — the entire chat interface depends on the streaming format
