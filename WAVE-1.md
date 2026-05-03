# Wave 1 — V2 Foundation Scaffolding (Acceptance Report)

**Date**: 2026-05-02
**Branch**: `buildathon-v2`
**Pre-Wave-1 HEAD**: `3dbe21598a9ab1ee30e7d72ead062520c7afb94e`
**Plan**: `.local/tasks/v2-foundation-wave1.md`

---

## What landed

### 1. `@workspace/agents` package skeleton
- New workspace package: `lib/agents/`
- Exports `AGENTS_PACKAGE_VERSION` and `AgentRole` type from `src/index.ts`
- Empty subdirs (`.gitkeep`) for the v2 layout: `_kernel/`, `coordinators/`, `specialists/`, `tools/`, `prompts/`
- Wired into root `tsconfig.json` references and api-server `tsconfig.json` references
- api-server `package.json` declares `@workspace/agents: workspace:*`

### 2. `@workspace/integrations-anthropic-ai` package
- Copied from `.local/skills/ai-integrations-anthropic/templates/lib/integrations-anthropic-ai/`
- Provisioned env vars via `setupReplitAIIntegrations`:
  - `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
  - `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
- **Drive-by fixes** (template was written for older p-retry; mirrors the same bug present in `lib/integrations-openai-ai-server`):
  - Added missing `@types/node` devDep to `package.json`
  - Replaced `pRetry.AbortError` with the named export `AbortError` (p-retry v7 API change). 2 occurrences in `src/batch/utils.ts`.
- Skipped copying `.local/skills/ai-integrations-anthropic/templates/lib/db/src/schema/{conversations,messages}.ts` — those are for the AI-chat-history use case; v2 agents log to `agent_audit` / `agent_run_log` tables instead, and v1 chat history uses the existing `chat_history` table.

### 3. Agents health check route
- New: `artifacts/api-server/src/routes/agents-health.ts`
- Route: `GET /api/agents/health` (auth-required)
- Calls `claude-haiku-4-5` with `max_tokens: 32`, asserts the reply contains `"ok"`, returns latency, model, usage, package version.
- Mounted in `artifacts/api-server/src/routes/index.ts`

### 3a. Model routing (applies to all Wave 2+ agent implementations)
**Default agent model: `claude-sonnet-4-6`.** Coordinators, Specialists, Synthesizer, Critic, Question Director, Guide Composer, Pre-departure Narrator, and the Prioritization Agent all use `claude-sonnet-4-6` via the direct Replit Anthropic integration. The Extractor uses `claude-haiku-4-5` (single-field extraction, fast and cheap). Validator and Profile Writer are pure code (no LLM).

Opus 4.7 is reachable through the Anthropic integration but **is not the default** — reserved only for cases where Sonnet 4.6 visibly fails on quality (not just "could be slightly better"). Rationale: relocation work doesn't need Opus-tier reasoning, Sonnet's lower latency keeps the live agent panels (Spine step 7) snappy, and the OpenRouter Opus fallback discussed earlier is dropped — Replit's direct Anthropic integration covers everything.

Code anchor: the constant lives in `lib/agents/src/_kernel/models.ts` (`DEFAULT_AGENT_MODEL`, `EXTRACTOR_MODEL`, `HEALTH_PROBE_MODEL`) and is re-exported from `@workspace/agents`. Any new agent in Wave 2+ that doesn't have an explicit model assignment must import `DEFAULT_AGENT_MODEL`.

### 4. DB migrations (raw SQL files — apply manually in Supabase)
Location: `lib/db/migrations/`. **Not auto-applied** — user must run these via the Supabase SQL editor.

| Migration | What it does |
|---|---|
| `20260502120000_v2_lifecycle_stages.sql` | Drops the `relocation_plans_stage_check` constraint and re-adds it with two new values: `ready_for_pre_departure`, `pre_departure`. Backfills `complete + locked + future arrival_date` plans into `ready_for_pre_departure`. |
| `20260502120100_v2_agent_tables.sql` | Creates 4 new tables: `agent_audit`, `pre_departure_actions`, `guide_section_citations`, `agent_run_log`. All RLS-enabled following the v1 pattern (user-owned via `user_id`). |
| `20260502120200_v2_gomate_version_column.sql` | Adds `gomate_version text default 'v2' check (in 'v1','v2')` to `public.profiles`. Backfills all existing profiles to `'v1'` so they keep seeing v1 by default. |

Each migration has a matching `.down.sql` rollback.

### 5. Drizzle schema mirrors
For the 4 new tables, plain Drizzle table definitions (no `drizzle-zod` — see Note below):
- `lib/db/src/schema/agent-audit.ts`
- `lib/db/src/schema/pre-departure-actions.ts`
- `lib/db/src/schema/guide-section-citations.ts`
- `lib/db/src/schema/agent-run-log.ts`
- Barrel updated: `lib/db/src/schema/index.ts`

**Note**: Initial draft used `createInsertSchema` from `drizzle-zod`, but this workspace has both Zod v3 and v4 installed (catalog is v3, transitively v4 leaks in via other deps). The mismatch produced `_type` / `_parse` missing-property errors. For Wave 1 we only need the type-level inference, so I dropped the zod runtime dep and use `typeof table.$inferSelect / $inferInsert` directly. We can add zod schemas back in later waves once we choose a single zod version for the workspace.

### 6. Lifecycle type extension (frontend, type-only)
- `artifacts/gomate/src/lib/gomate/core-state.ts`:
  - `CanonicalPlanStage` now includes `generating | ready_for_pre_departure | pre_departure`
  - `CanonicalPlanLifecycle` now includes `generating | ready_for_pre_departure | pre_departure`
  - New `V2_PERSISTED_STAGES` precedence: when the DB has one of these v2 values, it's authoritative; otherwise fall back to v1 inference from `locked` + readiness.
  - `derivePlanAuthority` now maps the new stages into matching lifecycles.
- `artifacts/gomate/src/lib/gomate/dashboard-state.ts`:
  - `DashboardStateId` now includes `ready_for_pre_departure | pre_departure`. The `deriveDashboardState` switch is unchanged for now (those stages still flow through the existing `isLocked` branch — UI for them lands in a later wave).

### 7. Server-side plan-state helper
- New: `artifacts/api-server/src/lib/gomate/core-state.ts`
- Stripped-down server copy of the frontend file: `deriveCanonicalStageServer`, `canCoordinatorRun`, `canPreDepartureCoordinatorRun`. Per translation map rule 13, agents need plan-authority derivation server-side to gate runs.

### 8. Chat route split (per the Wave 1 plan, line 13)
- `artifacts/api-server/src/routes/chat.ts` — `POST /api/chat` returns an auth-gated **503 v2 placeholder** with a structured body (`{ error: "v2 chat is not yet wired", detail: "...", version: "v2-placeholder" }`). This reserves `/api/chat` for the v2 multi-agent flow that lands in Wave 2 (Prompt 1.3).
- `artifacts/api-server/src/routes/chat-v1.ts` — `POST /api/chat-v1` serves the **frozen v1 chat handler** (gpt-5.4 + GoMate system prompt). Identical to the previous v1 behaviour at `/api/chat`.
- Both routes are mounted in `routes/index.ts`. There is no separate `chat-v2.ts` file — the placeholder lives in `chat.ts` because `/api/chat` is the URL being reserved for v2.

> **Trade-off the plan acknowledges (line 129)**: "After Wave 1 the user temporarily can't chat in the workspace, which is fine because the next prompt (1.3) wires the v2 chat coordinator." The frontend's existing `useMutation` against `/api/chat` receives a 503 with a structured error body rather than crashing; an error toast may show until the v2 coordinator lands. The buildathon-comparison page introduced later can call `/api/chat-v1` to reach the v1 handler.

### 9. Buildathon-free tier flag (with prod-safety hardening)
- New helper `isBuildathonFreeMode()` in `artifacts/api-server/src/lib/gomate/tier.ts`
- `getEffectiveTier()` short-circuits to `pro_plus` when `GOMATE_BUILDATHON_FREE === "true"`
- `canCreatePlan()` short-circuits to `{ allowed: true, limit: 999, tier: "pro_plus" }` when the flag is on
- Env vars set in shared environment via `setEnvVars`:
  - `GOMATE_BUILDATHON_FREE = "true"`
  - `VITE_GOMATE_BUILDATHON_FREE = "true"` (exposed to the frontend for future use)

**Architect-review hardening**: The flag intentionally has **no `NODE_ENV` guard** — the buildathon demo runs from a deployed Replit URL where `NODE_ENV=production`, so it must work in prod. To prevent it from quietly staying on after the buildathon, a loud one-time warning fires at server startup (`console.warn` from the `tier.ts` module init):

```
[gomate/tier] ⚠️  GOMATE_BUILDATHON_FREE=true — ALL authenticated users are being treated as pro_plus with unlimited plans. Disable this flag to restore Stripe-based gating.
```

Verified to fire in the api-server startup logs. Flip `GOMATE_BUILDATHON_FREE` to `"false"` (or delete the env var) to restore real Stripe-based gating immediately — no redeploy needed, takes effect on the next request.

**Note on frontend tier.ts**: `artifacts/gomate/src/lib/gomate/tier.ts` is dead code (Next.js leftover from migration — uses `await createClient()` from `@/lib/supabase/server`). Confirmed via ripgrep that nothing imports it. Skipped editing per "do what's asked, nothing more".

### 10. Per-user version flag helper
- New: `artifacts/api-server/src/lib/gomate/version-flag.ts`
- `getGomateVersion(ctx)` reads `profiles.gomate_version` and returns `'v1' | 'v2'` (default `'v2'`).
- Not used by any route yet — stub for v2 routes to gate v1-vs-v2 behaviour per user.

---

## Verification

### Workflows running clean
```
artifacts/api-server: API Server          → RUNNING (Server listening port: 8080)
artifacts/gomate: web                     → RUNNING
artifacts/mockup-sandbox: Component Preview → RUNNING
```

### Smoke tests (HTTP via `curl localhost:8080`)
| Endpoint | Status (unauth) | Meaning |
|---|---|---|
| `GET /api/agents/health` | `401 {"error":"Unauthorized"}` | Route mounted, auth gate works, Anthropic client initialized cleanly at server startup (otherwise import would have crashed). For an authed user this returns latency + token usage from a claude-haiku-4-5 ping. |
| `POST /api/chat` | `401 {"error":"Unauthorized"}` | **v2 placeholder reserved here** per the plan. For an authed user this returns 503 with the structured `{error, detail, version: "v2-placeholder"}` body. |
| `POST /api/chat-v1` | `401 {"error":"Unauthorized"}` | **Legacy v1 chat handler** (gpt-5.4 + GoMate system prompt). For an authed user, identical to the previous v1 behaviour. |
| `POST /api/chat-v2` | `404` | Intentionally not mounted — the v2 placeholder lives at `/api/chat`, not at a separate `/api/chat-v2`. |

### Server-startup safety log
The buildathon-free flag warning fires at module init:
```
[gomate/tier] ⚠️  GOMATE_BUILDATHON_FREE=true — ALL authenticated users are being treated as pro_plus with unlimited plans. Disable this flag to restore Stripe-based gating.
```

### Migration idempotency
- `20260502120000_v2_lifecycle_stages.sql`: drops + recreates the stage CHECK constraint with the v2 stage set; backfills **every** `stage='complete' AND locked=true` row to `ready_for_pre_departure` (no arrival-date filter, per plan line 11). Re-running with v2 stages already present is safe — the CHECK is recreated identically and the UPDATE matches zero rows on the second run.
- `20260502120100_v2_agent_tables.sql`: every `create policy` is wrapped in a `do $$ ... if not exists in pg_policies ... end $$` block (PostgreSQL <15 doesn't support `CREATE POLICY IF NOT EXISTS`). All tables/indexes use `if not exists`. Safe to re-run.
- `20260502120200_v2_gomate_version_column.sql`: the entire add-column-and-backfill block is gated on a `not exists` check against `information_schema.columns`. Re-running after the column already exists is a no-op — `v2` users will NOT be flipped back to `v1`.

### Direct Anthropic SDK smoke (in code-execution sandbox)
Couldn't run — sandbox doesn't have `@anthropic-ai/sdk` resolvable from workspace root. Indirect verification: api-server boots without throwing the env-var/missing-key errors from `client.ts`, proving `AI_INTEGRATIONS_ANTHROPIC_*` env vars are present and the SDK initialized. The 401 above further confirms the route handler reaches `authenticate()` — so the import chain `agents-health.ts → @workspace/integrations-anthropic-ai → @anthropic-ai/sdk` resolves at runtime.

### Typecheck status

`pnpm run typecheck` **still fails** with the **same 5 pre-existing baseline errors that existed before Wave 1**:

```
lib/integrations-openai-ai-server/src/batch/utils.ts(77,30): TS2339 — pRetry.AbortError
lib/integrations-openai-ai-server/src/batch/utils.ts(117,32): TS2339 — pRetry.AbortError
lib/integrations-openai-ai-server/src/image/client.ts(31,18): TS18048 — response.data possibly undefined
lib/integrations-openai-ai-server/src/image/client.ts(54,23): TS18048 — response.data possibly undefined
TS2688 (twice) — Cannot find type definition file for 'node' (in openai-ai-server; not in our new packages)
```

**These are NOT from Wave 1.** They were present at HEAD `3dbe21598a` before any Wave 1 commits. The same template-bug existed in the Anthropic template I copied; I fixed it in `lib/integrations-anthropic-ai` (`AbortError` named import + missing `@types/node`) but explicitly **did not** touch the v1 OpenAI integration per the plan ("out of scope for Wave 1").

Per-artifact typechecks (all errors verified to be pre-existing; none from Wave 1):
- `pnpm --filter @workspace/gomate run typecheck` — fails with ~22 errors, **all in files Wave 1 did NOT touch**:
  - `src/lib/gomate/tier.ts` (the dead Next.js-leftover file confirmed unused — ripgrep returned zero importers)
  - `src/lib/gomate/visa-recommendations.ts` (profile-schema field-name drift: `field_of_study`, `accepted_to_school`, `industry`, etc. — pre-existing v1→migration mismatch)
  - `src/pages/chat/index.tsx` (`isStreaming` prop on ChatMessageContent doesn't match component def)
  - `src/pages/documents/index.tsx` (`visaType`, `isFallback` props on GeneratedChecklist don't match)
  - The Wave-1-touched files (`core-state.ts`, `dashboard-state.ts`) compile clean.
- `pnpm --filter @workspace/api-server run typecheck` — fails with **one** cascade error: `TS6305: Output file '.../openai-ai-server/dist/index.d.ts' has not been built from source file`. This is because the openai-ai-server library's composite build failed (pre-existing baseline bug), so its `.d.ts` files weren't emitted, so api-server can't resolve the type imports from `@workspace/integrations-openai-ai-server`. Same root cause as the baseline TS errors above. Runtime build via esbuild bundles fine (api-server is running clean).

---

## What you (the user) need to do next

1. **Apply the 3 SQL migrations to Supabase** (in order):
   - `lib/db/migrations/20260502120000_v2_lifecycle_stages.sql`
   - `lib/db/migrations/20260502120100_v2_agent_tables.sql`
   - `lib/db/migrations/20260502120200_v2_gomate_version_column.sql`
   Open the Supabase project's SQL editor and paste each one. They're idempotent (use `if not exists` / `do $$ ... drop constraint ... $$`), so re-running them is safe.

2. **Push to GitHub**: I can't push from here (no creds). Open the Replit Git pane and push `buildathon-v2`.

3. **Optional but recommended**: Authenticated end-to-end smoke of `/api/agents/health` from a logged-in browser session. Should return `{ ok: true, model: "claude-haiku-4-5-...", latencyMs: ~1500, agentsPackageVersion: "0.0.0-wave1", reply: "ok", usage: {...} }`.

---

## Pre-existing baseline errors (carried over, not from Wave 1)

For full transparency — these existed at `3dbe21598a` and remain unchanged:
1. `lib/integrations-openai-ai-server/src/batch/utils.ts` lines 77 & 117 — `pRetry.AbortError` should be `AbortError` named import (p-retry v7 API).
2. `lib/integrations-openai-ai-server/src/image/client.ts` lines 31 & 54 — `response.data` typed as `T[] | undefined` since openai SDK 6.x; needs a null guard.
3. `lib/integrations-openai-ai-server` TS2688 missing 'node' type — `@types/node` works at runtime via hoisting but isn't declared in the package's own deps.

Each is a 1–2 line fix and would make `pnpm run typecheck` clean if you want me to do it as a separate task.
