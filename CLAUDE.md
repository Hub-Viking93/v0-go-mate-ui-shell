# GoMate — CLAUDE.md (Read this first)

**This is the canonical entry point for all Claude Code sessions. Read this file before making any change to the codebase.**

---

## Fresh Session Script

```
Read /CLAUDE.md → Read docs/audits/document-authority.md → Read docs/audits/definitions-vs-system-audit.md (gap register) → Read docs/engineering-contract.md → Begin work.
```

For system-specific work, also read the relevant doc in `docs/systems/` and `docs/audits/backend-audit.md` before touching any file.

> **Historical phase workflow (all phases complete):** Read `docs/phase-status.md` → `docs/build-protocol.md` → `docs/phase-implementation-protocol.md`.

---

## What is GoMate

GoMate is a relocation intelligence platform. Users complete a structured chat interview that builds a profile (65+ fields), which drives AI-generated guides, visa research, cost-of-living analysis, and a post-arrival settling-in checklist. After confirming arrival, users enter post-arrival mode with a task graph, compliance timeline, and a context-aware chat assistant.

Core v1 functionality is implemented through Phases 0–11. Remaining gaps between canonical definitions and implementation are documented in `docs/audits/definitions-vs-system-audit.md`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Database + Auth | Supabase (PostgreSQL + GoTrue) |
| Styling | Tailwind CSS v4, shadcn/ui (new-york style) |
| Package manager | pnpm |
| Chat (pre + post arrival) | GPT-4o via raw fetch to OpenAI |
| Settling-in generation + enrichment | Claude Sonnet 4 via `@ai-sdk/openai` → OpenRouter |
| Extraction | GPT-4o-mini |
| Web research | Firecrawl (search + scrape) |
| Deployment | Vercel (serverless) |

---

## System Status

Both P0 gaps (subscription self-upgrade, guide PDF rendering) were fixed in Phases 0–5. All 11 build phases are complete.

| Classification | Notes |
|---|---|
| BROKEN | 0 — both P0s resolved in Phase 1 |
| MISSING | 3 systems (Job System, Observability, Artifact System — deferred to v2) |
| Remaining gaps | 44 gaps between definitions and implementation (0 BLOCKER, 6 HIGH, 21 MEDIUM, 17 LOW) |

**Current state:** `docs/audits/backend-audit.md` (system-level). **Gap register:** `docs/audits/definitions-vs-system-audit.md`. **Original baseline:** `docs/audit.md`.

---

## Governance Documents

Read these documents before any substantive work:

| Document | Purpose |
|---|---|
| `docs/audits/backend-audit.md` | **Current system state** (2026-03-04). API routes, data model, generation pipelines, invariants. |
| `docs/audits/document-authority.md` | **Governance authority map** — defines which document layer is authoritative for target design, current reality, gaps, phases, and final acceptance. |
| `docs/audits/definitions-digest.md` | Canonical requirements extracted from all 24 definition documents. |
| `docs/audits/definitions-vs-system-audit.md` | **Gap register** — 44 gaps between definitions and implementation with severity and fix strategy. |
| `docs/audit.md` | Original baseline audit (2026-02-25). WORKING/PARTIAL/BROKEN/MISSING classification. V1 invariants. |
| `docs/engineering-contract.md` | Rules that govern every change. No exceptions. |
| `docs/build-protocol.md` | Historical phase specification — Phases 0–5, all complete. |
| `docs/phase-implementation-protocol.md` | Phase gate protocol — 7 mandatory gates, required artifacts, acceptance criteria. |
| `docs/phase-status.md` | Completion status of all Phases (0–11). Next steps for audit-based development. |
| `docs/definitions/` | 24 canonical system definition documents. |
| `docs/systems/master-index.md` | All 31 system documents with complete gap register (55+ codes). |
| `docs/glossary.md` | Definitions for all domain terms used in docs (stage, plan, profile, tier, DAG, etc.). |

---

## Development Workflow

**All build phases (0–11) are complete.** Current work is driven by the audit gap register.

### Current: Audit-Based Development

1. Read `docs/audits/document-authority.md` — which documentation layer governs which decision.
2. Read `docs/audits/definitions-vs-system-audit.md` — the gap register with severity and fix strategy for each gap.
3. Read `docs/audits/backend-audit.md` — how the system actually works today.
4. Read `docs/engineering-contract.md` — rules that apply to every change.
5. Identify the gap(s) to address. Follow the recommended fix strategy.
6. Verify against the engineering contract rules.

### Historical: Build Phases 0–5 (completed 2026-02-28 through 2026-03-02)

Used full 7-gate protocol per `docs/phase-implementation-protocol.md` with specification in `docs/build-protocol.md`.

### Historical: Build Phases 6–11 (completed 2026-03-03)

Used lighter gate protocol (TypeScript verification + user testing). Details in `docs/phase-status.md`.

---

## Deployment Environment — Testing Constraints

GoMate runs on **Vercel** (frontend + API routes) with **Supabase** (database + auth). There is no persistent local runtime. This affects how phase gates are executed in practice.

**Claude Code cannot:**
- Make HTTP calls to the running API (unless local dev server is running)
- Execute SQL against the Supabase database
- Verify runtime behavior directly without local setup

**Claude Code can always:**
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
pnpm dev       # starts localhost:3000
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
| Frontend Wiring Gate (gate 3) | Code-review wiring against `docs/frontend-coverage-audit.md` | Curl to verify UI→API contract at runtime |
| User Acceptance Gate (gate 5) | First actual runtime check (Vercel preview) | Confirm in browser after Claude's API tests pass |
| Regression Gate (gate 6) | User re-runs prior specs against Vercel preview | Claude re-runs prior curl test suites locally |

If `.env.local` is not set up, Claude Code falls back to static verification only and will say so explicitly when starting a Phase.

---

## Before Making Any Change (non-Phase work)

1. Read `docs/audits/document-authority.md` to confirm which layer is authoritative for the decision you are making.
2. Read the relevant document in `docs/systems/` for the system you are changing.
3. Read `docs/audits/backend-audit.md` to understand the current state of that system.
4. If the work is phase-scoped, verify the change is in scope for the current build phase in `docs/build-protocol.md`.
5. Make the change.
6. Verify against the applicable success criteria.

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
- The next migration number is: **024**

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

**Known violations (as of 2026-03-04, per `docs/audits/backend-audit.md` §5.7):**

- In-memory cache: `lib/gomate/numbeo-scraper.ts` (24h TTL, non-functional in serverless)
- Self-HTTP calls: `app/api/research/trigger/route.ts` (calls sibling research routes via fetch)
- `fetch()` without timeout: Several `app/api/research/` routes and `app/api/chat/route.ts` (OpenAI calls)
- `Math.random()` for data: `lib/gomate/flight-search.ts` (mock flight generation)

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
| `scripts/014` | Phase 3: plan switch RPC |
| `scripts/015` | Phase 3: settling_in_tasks task_key column |
| `scripts/016` | Phase 6: research_status + research_completed_at on relocation_plans |
| `scripts/017` | Phase 6: deadline_at + deadline_anchor on settling_in_tasks; OVERDUE status |
| `scripts/018` | Phase 7: plan_version on relocation_plans |
| `scripts/019` | Phase 9: guide versioning + staleness columns |
| `scripts/020` | Phase 10: onboarding_completed on relocation_plans |
| `scripts/021` | Phase 2 (master-audit): research_meta JSONB on relocation_plans |
| `scripts/022` | Phase 2 (master-audit): add 'partial' to research_status check constraint |
| `scripts/023` | Phase 4 (master-audit): guide artifact integrity — profile_snapshot, is_current, unique index |
| `supabase/migrations/024` | Destination images table + hero image columns on guides + storage bucket |
| Next: **`025`** | Next migration to write |

### Migration 004 Gap

There is no `scripts/004_*.sql` file. This gap is intentional — the schema it would have defined was incorporated inline into adjacent migrations. Do not create a `004` file. The sequence continues from `003` to `005` with no data loss.

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
| `lib/gomate/progress.ts` | Progress computation (Phase 6) |
| `lib/gomate/numbeo-scraper.ts` | Cost of living data (has in-memory cache — known violation) |
| `docs/audits/` | System audit outputs (2026-03-04): backend-audit, definitions-digest, gap analysis |
| `docs/definitions/` | 24 canonical system definition documents |
| `docs/systems/master-index.md` | Complete gap register |
| `docs/glossary.md` | Term definitions |

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
