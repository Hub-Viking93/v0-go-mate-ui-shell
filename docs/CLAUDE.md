# GoMate — CLAUDE.md

> **Note:** The canonical entry point for Claude Code is `/CLAUDE.md` at the repo root. This file (`docs/CLAUDE.md`) contains the same content and is kept for reference. Always read `/CLAUDE.md` first.

**Read this file before making any change to the codebase.**

---

## What is GoMate

GoMate is a relocation intelligence platform. Users complete a structured chat interview that builds a profile (65+ fields), which drives AI-generated guides, visa research, cost-of-living analysis, and a post-arrival settling-in checklist. After confirming arrival, users enter post-arrival mode with a task graph, compliance timeline, and a context-aware chat assistant.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Database + Auth | Supabase (PostgreSQL + GoTrue) |
| Chat (pre + post arrival) | GPT-4o via raw fetch to OpenAI |
| Settling-in generation + enrichment | Claude Sonnet 4 via `@ai-sdk/openai` → OpenRouter |
| Extraction | GPT-4o-mini |
| Web research | Firecrawl (search + scrape) |

---

## System Status

GoMate is approximately 70–75% implemented. The current baseline is defined in `docs/audit.md`.

| Classification | Count |
|---|---|
| WORKING | 3 systems |
| PARTIAL | 20 systems |
| BROKEN | 2 systems (P0) |
| MISSING | 3 systems (explicitly deferred to v2) |

**Two P0 gaps make the system unsafe for production users.** They are fixed in Phase 1 of `docs/build-protocol.md`.

---

## Governance Documents

Read these documents before any substantive work:

| Document | Purpose |
|---|---|
| `docs/audit.md` | Single source of truth for system state. WORKING/PARTIAL/BROKEN/MISSING classification. V1 invariants. Gap register. |
| `docs/engineering-contract.md` | Rules that govern every change. No exceptions. |
| `docs/build-protocol.md` | **Phase specification authority** — exact files, diffs, and success criteria for every Phase (0–5). Read this to know **what** to build. |
| `docs/phase-implementation-protocol.md` | **Phase gate protocol** — 7 mandatory gates, required artifacts, acceptance criteria. Read this to know **how** to execute and verify. |
| `docs/phase-status.md` | Current completion status of each Phase. Read before starting any Phase to know which is next. |
| `docs/systems/master-index.md` | All 31 system documents with complete gap register (55+ codes). |

---

## Implementing a Build Phase

If you are implementing a build Phase (Phase 0–5), follow this exact reading order:

1. Read `docs/phase-status.md` — determine which Phase is next and confirm all prior Phases are complete.
2. Read `docs/build-protocol.md` — this is the **specification authority**: exact files to change, exact diffs, and verifiable success criteria for the Phase.
3. Read `docs/phase-implementation-protocol.md` — this is the **gate protocol**: the 7 mandatory gates, required artifacts, and acceptance criteria.
4. Execute the Phase per `docs/build-protocol.md`, following the gate sequence in `docs/phase-implementation-protocol.md`.
5. Update `docs/phase-status.md` when Phase Completion is declared.

`docs/build-protocol.md` answers: **what to build.**
`docs/phase-implementation-protocol.md` answers: **how to verify and accept it.**

---

## Deployment Environment — Testing Constraints

GoMate runs on **Vercel** (frontend + API routes) with **Supabase** (database + auth). There is no local runtime. This affects how the `docs/phase-implementation-protocol.md` gates are executed in practice.

**Claude Code cannot:**
- Make HTTP calls to the running API
- Execute SQL against the Supabase database
- Verify runtime behavior directly

**Claude Code can:**
- Write all code changes and SQL migrations
- Run `tsc --noEmit` to verify TypeScript compilation
- Perform static code review against the spec in `docs/build-protocol.md`

### Practical Phase Execution Flow

```
1. Claude Code writes all code changes + SQL migrations
2. Claude Code performs static verification (TypeScript + spec review)
3. Claude Code produces PHASE_N_USER_TEST.md with deterministic test steps
4. User runs SQL migrations in the Supabase dashboard SQL editor
5. User pushes code → Vercel builds a preview deployment
6. User executes the test steps in PHASE_N_USER_TEST.md against the preview URL
7. User reports bugs → Claude Code fixes → repeat from step 5
8. User declares User Acceptance PASSED
```

### Local Dev Setup (Recommended for Phase Testing)

Running the app locally at `localhost:3000` gives Claude Code full runtime access: real HTTP calls, real API responses, real error codes. This enables genuine Backend Acceptance Gate testing instead of static code review only.

**One-time setup (you do this once):**

1. Pull all env vars from Vercel automatically:
   ```bash
   npm i -g vercel   # if not already installed
   vercel login
   vercel env pull .env.local
   ```
2. Run SQL migrations in Supabase Dashboard SQL editor (one per Phase, takes ~30 seconds)

**Per-session (Claude Code does this automatically):**

```bash
npm run dev        # starts localhost:3000
# Claude makes curl calls to localhost:3000/api/...
# Claude stops the server when done
```

**What this enables:**
- Real API calls with auth tokens and Supabase data
- Verified HTTP status codes, response shapes, error paths
- Full Backend Acceptance Gate and Regression Gate testing

### Gate Reinterpretation for This Project

| Gate | Without local dev | With local dev (`localhost:3000`) |
|---|---|---|
| Backend Acceptance Gate (gate 2) | Static code review + TypeScript check | Real API calls — full runtime verification |
| Frontend Wiring Gate (gate 3) | Code-review wiring against `frontend-coverage-audit.md` | Curl to verify UI→API contract at runtime |
| User Acceptance Gate (gate 5) | First actual runtime check (Vercel preview) | Confirm in browser after Claude's API tests pass |
| Regression Gate (gate 6) | User re-runs prior specs against Vercel preview | Claude re-runs prior curl test suites locally |

If `.env.local` is not set up, Claude Code falls back to static verification only and will say so explicitly when starting a Phase.

---

## Before Making Any Change (non-Phase work)

1. Read the relevant document in `docs/systems/` for the system you are changing.
2. Read `docs/audit.md` to understand the current state of that system.
3. Verify the change is in scope for the current build phase in `docs/build-protocol.md`.
4. Make the change.
5. Verify against the success criteria for that phase.

If the change is a bug fix not in any build phase, proceed only if it does not risk breaking a working system. If unsure, do not proceed.

---

## Mandatory Rules (from `docs/engineering-contract.md`)

### Every new API route must:
- Call `supabase.auth.getUser()` and return `401` if no session
- Return an HTTP status code on every error path (never `console.error` without a `return`)

### Every Pro+ gated route must:
- Call `getUserTier(user.id)` and return `403` if tier does not qualify

### Every settling-in route must:
- Verify `plan.stage === 'arrived'` and return `400` if not

### Every external HTTP call must:
- Use `fetchWithRetry()` from `lib/gomate/fetch-with-retry.ts` (or equivalent `AbortController` timeout)

### Every LLM call must:
- Set explicit `maxTokens`

### Every new database column must:
- Have a corresponding migration file in `scripts/` using `add column if not exists`
- The next migration number is: **015**

---

## Forbidden Patterns

Do not introduce any of the following:

| Pattern | Rule |
|---|---|
| In-memory cache objects (`const cache = {}`) | Non-functional in serverless |
| `fetch()` without `AbortController` timeout | Hangs under load |
| Regex JSON extraction from LLM output | Brittle; fails on edge cases |
| `Math.random()` for data fields | Non-deterministic; breaks data integrity |
| Self-HTTP calls (`fetch("/api/...")` from another route) | Fragile; circular dependency risk |
| `PATCH /api/subscription` (self-upgrade) | Removed in Phase 1 |
| `console.error` without a subsequent `return` | Silent errors |
| `drop table` or `drop column` in migrations | Requires explicit approval |
| Hardcoded URLs in production code | Must use environment variables |

---

## Critical Architecture Facts

### Stage Enum (Reality vs Contract)

The code uses: `collecting → generating → complete → arrived`

`archived` is a **`plan.status`** value, not a `plan.stage` value.

### Marker Protocol

The post-arrival chat emits `[TASK_DONE:exact task title]` (title, not UUID). The frontend parses this with regex and fires PATCH to the task endpoint. This is intentional. Do not change the format without updating both the system prompt and the frontend parser.

### Model Routing

`anthropic/claude-sonnet-4-20250514` strings used in `generateText()` calls route through OpenRouter via `@ai-sdk/openai` adapter — not directly to Anthropic. This is working correctly; do not change it.

### Migration State

| File | Content |
|---|---|
| `scripts/001` – `scripts/010` | Existing migrations — never edit |
| `scripts/011` | Phase 0: settling_in_tasks columns |
| `scripts/012` | Phase 0: relocation_plans research columns |
| `scripts/013` | Phase 0: relocation_plans document_statuses |
| `scripts/014` | Phase 3: plan switch RPC (if needed) |
| Next: `015` | |

---

## Systems That Must Not Be Changed Without Explicit Instruction

These are functional. Breaking them to fix something else is not acceptable:

- `lib/gomate/profile-schema.ts` — field changes affect the entire interview flow
- `lib/gomate/state-machine.ts` — logic changes affect all chat sessions
- `lib/supabase/middleware.ts` — failure lets all requests through
- `scripts/001_*.sql` through `scripts/010_*.sql` — never edit existing migrations
- `components/chat/` — streaming format; all chat depends on it
- `computeAvailableTasks()` in `lib/gomate/settling-in-generator.ts` — working correctly

---

## Key File Reference

| File | Role |
|---|---|
| `lib/gomate/settling-in-generator.ts` | Settling-in generation pipeline; DAG validation goes here |
| `lib/gomate/tier.ts` | `getUserTier()` — reads and enforces subscription tier |
| `app/api/settling-in/*/route.ts` | All need `plan.stage` check (Phase 2) |
| `app/api/subscription/route.ts` | PATCH removed in Phase 1 |
| `app/(app)/guides/[id]/page.tsx` | PDF guide page — schema key fixed in Phase 1 |
| `app/auth/callback/route.ts` | Open redirect fixed in Phase 1 |
| `middleware.ts` | Auth catch block fixed in Phase 1 |
| `lib/gomate/dag-validator.ts` | Created in Phase 2 |
| `lib/gomate/fetch-with-retry.ts` | Created in Phase 4 |
| `components/compliance-alerts.tsx` | Dismissal persistence fixed in Phase 5 |
| `docs/systems/master-index.md` | Complete gap register |

---

## What Is Out of Scope for v1

Do not build these:

- Job System
- Observability / trace_id infrastructure
- Artifact System
- Stripe payment processing
- Chat history persistence
- Password reset
- Parallel visa system consolidation (works; refactoring is not a fix)
- `confirmed` state machine state (unreachable; no user impact)
- `compliance_alert_dismissals` server-side table (localStorage is the v1 target)
