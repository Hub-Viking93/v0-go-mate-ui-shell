# GoMate — Master Documentation Index

**Phase:** 10.3 (updated with Phase 9 + 10 post-relocation systems)
**Status:** Reality-first synthesis
**Scope:** All 31 system documents in `/docs/systems/`
**Last audited:** 2026-02-25
**Last gap update:** 2026-03-03 (Phases 6–11 gap closures)

---

## 1. Purpose

This document is the single entry point into the GoMate system documentation library. It provides:

1. A complete registry of all system documents with phase, status, and primary sources
2. A unified gap register — every gap code, description, and severity across all documents
3. A source-file-to-system cross-reference (which file is covered by which document)
4. A criticality-ranked list of gaps for implementation prioritisation
5. A correction register for known inaccuracies found during later phases
6. A record of systems and areas with no documentation

---

## 2. Document Registry

31 system documents exist in `/docs/systems/`. Documents are listed in phase order.

| Phase | Document | File | Status | Critical Gaps |
|---|---|---|---|---|
| 1.1 | Profile Schema | `profile-schema.md` | Reality-based | Source attribution missing; confidence not persisted |
| 1.2 | Interview State Machine | `interview-state-machine.md` | Reality-based | `confirmed` state unreachable; `computeNextState()` dead code |
| 1.3 | Persistence Layer | `persistence-layer.md` | Reality-based | Migration gap at 004; audit table missing |
| 2.1 | Chat Engine | `chat-engine.md` | Reality-first | Raw fetch (not SDK); dead `computeNextState()` call |
| 2.2 | System Prompt Architecture | `system-prompt.md` | Reality-first | `confirmed` handler missing; 5-destination context limit |
| 2.3 | Visa Logic | `visa-logic.md` | Reality-first | Three parallel visa lookup systems; 9–19 ghost fields |
| 3.1 | Research Orchestration | `research-orchestration.md` | Reality-first | ~~Self-HTTP pattern~~ (fixed Phase 2); partial success = "completed" |
| 3.2 | Cost of Living | `cost-of-living.md` | Reality-first | Two parallel cost systems; live path effectively disabled |
| 3.3 | Source Fetch Layer | `source-fetch-layer.md` | Reality-first + Placeholder | 5 independent scrapeUrl(); ~~in-memory cache non-functional~~ (fixed Phase 7) |
| 3.4 | Extraction Layer | `extraction-layer.md` | Reality-first + Placeholder | No shared extraction protocol; regex JSON parsing everywhere |
| 3.5 | Country / Destination Data | `country-destination-data.md` | Reality-first | airports.txt never loaded; "use client" on server module |
| 4.1 / 8 | Guide Generation + PDF Export | `guide-generation.md` | Reality-first | Guide generator not AI-powered; PDF renderer receives incompatible data |
| 4.2 | Plans System | `plans-system.md` | Reality-first | Non-atomic plan switch; archived plans count against limit |
| 4.3 | Subscription System | `subscription-system.md` | Reality-first | No server-side feature gating; any user can self-upgrade free |
| 4.4 | Flight Search | `flight-search.md` | Reality-first | Heuristic stop parsing; Google Flights URL hardcoded |
| 4.5 | Checklist Generation | `checklist-generation.md` | Reality-first | `checklist_progress` table has no API; items column confusion |
| 5.1 | Job System | `job-system.md` | **Placeholder — does not exist** | Entire system missing |
| 5.2 | Observability | `observability.md` | **Placeholder — does not exist** | Entire system missing |
| 5.3 | Artifact System | `artifact-system.md` | **Placeholder — does not exist** | Entire system missing |
| 5.4 | Reliability Contracts | `reliability-contracts.md` | Reality-first + Placeholder | No retry anywhere; all failures surface as 500 |
| 6.1 | Auth and Sessions | `auth-sessions.md` | Reality-first | No password reset; open redirect in callback |
| 6.2 | End-to-End Flow | `end-to-end-flow.md` | Reality-first | No chat history; wrong guide insert schema; race condition |
| 7.1 | Frontend / UI Layer | `frontend-ui-layer.md` | Reality-first | Settings non-functional; booking always mock; 3 checklist generators |
| 9.1 | Post-Arrival Stage & Arrival | `post-arrival-stage.md` | Reality-first | Stage enum divergence; settling-in gates remain inconsistent; arrival endpoint at wrong path |
| 9.2 | Settling-In Persistence | `settling-in-persistence.md` | Reality-first | Stale schema fields (`unlocked`, `cost_estimate`, `how_to`, `tips`); task identity still split across UUID/title/task_key |
| 9.3 | Settling-In Checklist Engine | `settling-in-engine.md` | Reality-first | No auto-trigger after arrival; no country_baselines table; no generation run table |
| 9.4 | Task Graph & Dependency | `task-graph.md` | Reality-first | DAG validation exists, but identity remains split and skipped tasks do not unblock dependents |
| 9.5 | Why-It-Matters Enrichment | `why-it-matters.md` | Reality-first | Per-plan cap exists; no hedging in prompt; no audit events; no arrival-stage gate |
| 10.1 | Post-Arrival Chat Mode | `post-arrival-chat-mode.md` | Reality-first | ~~No token limit on task injection~~ (fixed Phase 7); auth failure silently falls to pre-arrival mode |
| 10.2 | Task Completion via Chat | `task-completion-via-chat.md` | Reality-first | Marker uses title (V1 intentional design per CLAUDE.md — not a defect); no completion audit event |
| 10.3 | Compliance Timeline & Alerting | `compliance-timeline.md` | Reality-first | Alerts use localStorage dismissal; timeline still computes deadline state client-side; no dismissal table |

---

## 3. Status Legend

| Status | Meaning |
|---|---|
| **Reality-based** | System exists and is fully implemented. Document describes what exists. No significant target-state divergence. |
| **Reality-first** | System exists. Document describes what exists and compares to the target architecture. Gaps documented. |
| **Reality-first + Placeholder** | System partially exists. Target architecture section describes what should be built. |
| **Placeholder — does not exist** | The named system does not exist in the codebase. Document describes current workaround and the target contract. |

---

## 4. Complete Gap Register

Every gap identified across all 23 documents. Gaps use the code `G-[phase]-[letter]`.

Severity is assessed as:
- **P0 — Critical:** Data loss, security risk, or complete feature failure visible to users
- **P1 — High:** Incorrect behaviour, silent failures, or security gaps
- **P2 — Medium:** Architectural inconsistency, technical debt, reliability concern
- **P3 — Low:** Code quality, minor inconsistency, cosmetic concern

### Phase 1 Gaps (Schema, State, Persistence)

Phase 1 documents use table-based gap analysis rather than `G-1.x-X` codes. Key findings:

| System | Finding | Severity |
|---|---|---|
| Profile Schema (1.1) | Confidence levels not persisted to DB — chat metadata only | P2 |
| Profile Schema (1.1) | Source attribution per field not implemented | P2 |
| Profile Schema (1.1) | Enrichment field layer (Batch 5 contracts) entirely missing | P2 |
| Interview State Machine (1.2) | `confirmed` state is declared but no code path produces it | P1 |
| Interview State Machine (1.2) | `computeNextState()` defined but not used by primary consumer (chat route) | P1 |
| Interview State Machine (1.2) | No audit trail of state changes | P2 |
| Interview State Machine (1.2) | ENRICHING state (post-lock research phase) has no representation | P2 |
| Persistence Layer (1.3) | Migration 004 is missing — sequence jumps 003 → 005, reason unknown | P2 |
| Persistence Layer (1.3) | `profiles.updated_at` has no auto-update trigger | P3 |
| Persistence Layer (1.3) | `guides.updated_at` has no auto-update trigger | P3 |
| Persistence Layer (1.3) | No state event / mutation audit table | P2 |
| Persistence Layer (1.3) | Stripe payment columns present; no Stripe integration | P1 |

### Phase 2 Gaps (Chat Engine, System Prompt, Visa Logic)

| Code | Description | Severity |
|---|---|---|
| G-2.1-A | Raw `fetch()` used instead of OpenAI SDK — non-standard, harder to maintain | P3 |
| G-2.1-B | `computeNextState()` is dead code — imported but result discarded | P2 |
| G-2.1-C | Profile extraction runs on every turn regardless of message content | P2 |
| G-2.1-D | Extraction prompt uses no temperature setting (defaults to 1.0 — too high for structured output) | P2 |
| G-2.1-E | No streaming error recovery — client receives no signal if stream dies mid-turn | P1 |
| G-2.1-F | Confidence levels computed but not persisted | P2 |
| G-2.1-G | `profile-summary.ts` references ghost fields that don't exist on the `Profile` type | P1 |
| G-2.1-H | Two parallel plan-update paths (`updatePlanProfile()` and direct Supabase write) | P2 |
| G-2.2-A | `confirmed` state has no handler in system prompt builder — falls through to interview | P1 |
| G-2.2-B | `EU_EEA_COUNTRIES` duplicated and divergent from `visa-checker.ts` | P2 |
| G-2.2-C | Destination context covers only 5 hardcoded destinations (6 EU names) | P2 |
| G-2.2-D | `VALIDATION COMPLETE` text trigger not validated — any response containing this string counts | P1 |
| G-2.2-E | `gomaterelocate.com` URL hardcoded in prompt without encoding | P3 |
| G-2.2-F | `VISA_DISCLAIMER` from `visa-advisor.ts` is never injected into the prompt | P2 |
| G-2.2-G | Profile summary in review state uses ghost fields from old schema | P1 |
| G-2.2-H | No token budget management — system prompt grows unbounded with profile data | P2 |
| G-2.3-A | `visa-advisor.ts` is unused — imported nowhere | P3 |
| G-2.3-B | Two `VisaRecommendation` interfaces with incompatible shapes exist in parallel | P2 |
| G-2.3-C | Three parallel static visa lookup systems (dashboard VISA_DATABASE, visa-recommendations.ts, visa-checker.ts) | P1 |
| G-2.3-D | `visa-recommendations.ts` references 9 fields not present on the current `Profile` type | P1 |
| G-2.3-E | `profile-summary.ts` references 19 ghost fields / name mismatches | P1 |
| G-2.3-F | DB columns for visa research (`visa_research`, `local_requirements_research`) not defined in any migration | P1 |
| G-2.3-G | `normalizeVisaResearch()` exists because of schema evolution without migration — technical debt made permanent | P2 |
| G-2.3-H | `analyzeVisaContent()` uses regex JSON extraction instead of `json_object` mode | P2 |
| G-2.3-I | `visa-required` badge in UI is unreachable — no code path produces `"required"` status | P2 |
| G-2.3-J | GET `/api/research/visa` returns duplicate key `visaOptions` — `normalized` and original both present | P2 |

### Phase 3 Gaps (Research, Cost of Living, Source Fetch, Extraction, Country Data)

| Code | Description | Severity |
|---|---|---|
| G-3.1-A | Self-HTTP call pattern — trigger route calls its own app's routes via HTTP | P1 |
| G-3.1-B | Four independent `scrapeUrl()` implementations with no shared abstraction | P2 |
| G-3.1-C | AI model inconsistency — visa uses GPT-4o, checklist uses Claude Sonnet, local requirements uses GPT-4o-mini | P2 |
| G-3.1-D | Partial research success treated as `status = "completed"` — no partial-failure state | P1 |
| G-3.1-E | No retry logic on any research HTTP call | P1 |
| G-3.1-F | No explicit caching contract for visa research — always re-runs | P2 |
| G-3.1-G | `normalizeLocalRequirements()` and `normalizeVisaResearch()` exist because of silent schema evolution | P2 |
| G-3.2-A | Two parallel cost-of-living systems (`numbeo-scraper.ts` and `web-research.ts`) with different data shapes | P2 |
| G-3.2-B | `number_of_children` field name mismatch between cost system and profile schema | P2 |
| G-3.2-C | `FALLBACK_DATA` currency labels ("$") are misleading for non-USD destinations | P3 |
| G-3.2-D | ~~No data staleness contract — cached Numbeo data has no TTL~~ **— PARTIALLY FIXED in Phase 9.** Research freshness tracking added; dashboard shows staleness when >7 days old. | P3 |
| G-3.2-E | Live Firecrawl path is effectively disabled for known destinations (cache always hits) | P2 |
| G-3.2-F | `fetchLiveCostOfLiving()` in `web-research.ts` is defined but never called | P2 |
| G-3.2-G | Savings target computation uses hardcoded flat moving cost regardless of destination | P3 |
| G-3.3-A | Five independent `scrapeUrl()` functions with no shared abstraction | P2 |
| G-3.3-B | Two different Firecrawl integration methods (raw fetch + SDK) in the same codebase | P2 |
| G-3.3-C | No explicit timeout on most Firecrawl calls — only `numbeo-scraper.ts` (15s) and `flight-search.ts` (30s) have timeouts | P1 |
| G-3.3-D | ~~In-memory cache object (`cache = {}`) is non-functional in serverless environments~~ **— FIXED in Phase 7.** `dataCache` Map removed from `web-research.ts`. | FIXED |
| G-3.3-E | No Firecrawl rate limiting or credit tracking | P2 |
| G-3.3-F | `web-research.ts` ignores `official-sources.ts` registry — builds URLs independently | P2 |
| G-3.4-A | No shared extraction protocol — each of 4 extraction sites uses its own prompt, model, and parser | P2 |
| G-3.4-B | Profile extraction uses default OpenAI temperature (1.0) — too high for structured JSON output | P2 |
| G-3.4-C | Three of four extraction sites use regex JSON parsing instead of structured output modes | P2 |
| G-3.4-D | Checklist extraction uses Claude (Anthropic) while all other extractions use OpenAI | P3 |
| G-3.4-E | No retry logic on any extraction call | P1 |
| G-3.4-F | Confidence levels computed during extraction but not persisted | P2 |
| G-3.5-A | `airports.txt` is bundled in the repo but never loaded at runtime — `airports.ts` has its own 30-airport hardcoded list | P2 |
| G-3.5-B | `"use client"` directive on `airports.ts` — a file also imported by server code | P1 |
| G-3.5-C | No canonical destination list — destinations are accepted as free text with no validation | P2 |
| G-3.5-D | Official-sources registry has no staleness detection — government URLs may be outdated | P3 |
| G-3.5-E | Country name format inconsistency across modules (full name, ISO code, abbreviated) | P2 |
| G-3.5-F | `web-research.ts` ignores `official-sources.ts` and builds scrape targets independently | P2 |
| G-3.5-G | Airport search (`findAirportsByCity`) scoped to 30 entries with no indication to caller | P2 |

### Phase 4 Gaps (Guide, Plans, Subscription, Flight, Checklist)

| Code | Description | Severity |
|---|---|---|
| G-4.1-A | Guide generation is not AI-powered — entirely static TypeScript logic, no LLM call | P1 |
| G-4.1-B | `COUNTRY_DATA` covers only 6 of 50+ supported relocation destinations | P1 |
| G-4.1-C | Five guide sections (banking, culture, jobs, education, healthcare for some destinations) are defined but never generated | P2 |
| G-4.1-D | `guide_type` column added in migration 007 but always set to `"main"` — never differentiated | P3 |
| G-4.1-E | ~~No guide versioning or invalidation — regenerating a guide silently overwrites the previous~~ **— PARTIALLY FIXED in Phase 9.** `guide_version`, `plan_version_at_generation`, and staleness fields exist, but regeneration still mutates guide rows instead of preserving immutable version history. | P2 |
| G-4.1-F | Budget section uses dead-code cost data (`estimatedCosts` in `getCountryData()`) — never populated at runtime | P2 |
| G-4.1-G | PDF renderer receives incompatible guide data — four fields render as `undefined` in every downloaded PDF (insurance, Do's/Don'ts, timeline tasks, checklist items) | **P0** |
| G-4.1-H | Three independent guide type definitions in three files, no shared source — structural drift is what caused G-4.1-G | P1 |
| G-4.1-I | `app/(app)/guides/[id]/page.tsx` (936 lines, guide detail + PDF download) was undocumented until Phase 8 | P3 |
| G-4.2-A | Switching current plan is non-atomic — two sequential writes (`unset old` + `set new`) with no transaction | P1 |
| G-4.2-B | `RelocationPlan` interface has 4 unused or shadow fields | P3 |
| G-4.2-C | `plan.status = "completed"` is unreachable — no code path sets it | P2 |
| G-4.2-D | Archived plans count against the user's plan limit | P1 |
| G-4.2-E | `generatePlanTitle()` duplicated in `plan-factory.ts` and `app/api/plans/route.ts` | P3 |
| G-4.2-F | No plan DELETE endpoint — plans can only be archived | P2 |
| G-4.3-A | No server-side feature gating on API routes — subscription tier is not checked in API handlers | P0 |
| G-4.3-B | Subscription expiry (`expires_at`) not enforced in database or application code | P0 |
| G-4.3-C | No Stripe integration — Stripe columns exist but no payment flow is implemented | P1 |
| G-4.3-D | Any authenticated user can self-upgrade to any tier for free via `PATCH /api/subscription` | P0 |
| G-4.3-E | No subscription auto-creation trigger — users who sign up may have no subscription row | P1 |
| G-4.3-F | `price_sek` column comment says "oere/cents" but stores whole Swedish kronor | P3 |
| G-4.4-A | Google Flights URL is hardcoded and non-dynamic — returns same URL regardless of route | P2 |
| G-4.4-B | Stop count fallback is still heuristic (`i % 2`) when provider text does not expose stops — deterministic now, but still not reliable | P2 |
| G-4.4-C | Airport resolution limited to 30 airports — most of the world unreachable | P1 |
| G-4.4-D | No direct flight API integration — all results from web scraping, inherently stale | P2 |
| G-4.4-E | Real parsed flights lack airline, departure time, and flight number fields | P2 |
| G-4.4-F | `GET /api/flights` has no authentication — accessible without a session | P1 |
| G-4.5-A | `checklist_progress` table (migration 003) has no API route — created but never used | P1 |
| G-4.5-B | `visaType` dependency — checklist generator requires visa research to have run first | P2 |
| G-4.5-C | `checklist_items` column (JSONB array) vs `checklist` column naming confusion in code comments | P3 |
| G-4.5-D | Regex JSON parsing from Claude AI output — not using structured output mode | P2 |
| G-4.5-E | No TTL or staleness check for checklist — never refreshed after initial generation | P2 |
| G-4.5-F | Claude vs OpenAI inconsistency is undocumented in the codebase | P3 |

### Phase 5 Gaps (Infrastructure, Reliability)

Phases 5.1, 5.2, 5.3 are placeholder documents for systems that do not exist. Their absence is itself the gap.

| System | Gap | Severity |
|---|---|---|
| Job System (5.1) | No job queue, no job persistence, no worker, no retry — entire system absent | P1 |
| Observability (5.2) | No trace IDs, no span model, no structured events, no correlation — entire system absent | P1 |
| Artifact System (5.3) | No unified artifact container, no metadata envelope, no versioning — entire system absent | P2 |

| Code | Description | Severity |
|---|---|---|
| G-5.4-A | No retry logic anywhere in the codebase — every external call is single-attempt | P0 |
| G-5.4-B | No circuit breaker — a failing Firecrawl endpoint is called on every request indefinitely | P1 |
| G-5.4-C | Client-side timeouts on only 2 of ~20+ external calls | P1 |
| G-5.4-D | All external API failures (429, 401, 402, 500) surface identically as HTTP 500 | P1 |
| G-5.4-E | All failures are invisible to users — silent fallbacks throughout | P1 |
| G-5.4-F | Log prefix is inconsistent (`[GoMate]`, `[Research Trigger]`, `[ChecklistAPI]`, none) | P3 |

### Phase 6 Gaps (Auth, End-to-End Flow)

| Code | Description | Severity |
|---|---|---|
| G-6.1-A | ~~Sign-out is not implemented~~ **— CORRECTED in Phase 7.1.** Sign-out is implemented in `AppShell`. | CORRECTION |
| G-6.1-B | No password reset flow — no forgot-password page, no `resetPasswordForEmail()` call | P1 |
| G-6.1-C | Open redirect in `/auth/callback` — `next` parameter passed directly to `NextResponse.redirect()` without validation | P1 |
| G-6.1-D | Middleware error silently allows all requests — catch block returns `NextResponse.next()` | P1 |
| G-6.1-E | Inconsistent env-var error handling — `client.ts` and `server.ts` throw; `middleware.ts` logs and continues | P2 |
| G-6.1-F | Profile trigger failure is silent — if `on_auth_user_created` fails, user has no profile row | P1 |
| G-6.2-A | No chat history persistence — all conversation state is client-only `useState` | P1 |
| G-6.2-B | Profile completeness defined in two places — `plan-factory.ts` (15 fields) and `profile-schema.ts` (`getRequiredFields()`) — not guaranteed to stay in sync | P1 |
| G-6.2-C | ~~Research results stored in undocumented columns (`visa_research`, `local_requirements_research`) not present in any migration~~ **— PARTIALLY FIXED in Phase 6.** Migration 016 adds `research_status` and `research_completed_at`. Note: `visa_research` and `local_requirements_research` columns were already present via undocumented migration; 016 covers the research tracking columns. | P3 |
| G-6.2-D | Guide insert in lock handler uses `sections` key — column does not exist in `guides` table schema | P0 |
| G-6.2-E | Plan creation race condition in `GET /api/profile` — if two requests arrive simultaneously both may try to create a plan | P1 |
| G-6.2-F | Research trigger is not called server-side on lock — client is responsible for firing research after plan lock | P1 |
| G-6.2-G | Cost of living recomputed every chat turn by calling `web-research.ts` — no caching between turns | P2 |

### Phase 9 Gaps (Post-Relocation Foundation)

| Code | Description | Severity |
|---|---|---|
| G-9.1-A | Stage enum divergence: contract uses `planning/arrived/archived`; code uses `collecting/generating/complete/arrived` | P2 |
| G-9.1-B | `stage_updated_at` field specified in contract; does not exist in schema | P2 |
| G-9.1-C | Arrival endpoint at `/api/settling-in/arrive` not `/api/plan/arrive` as contract specifies | P3 |
| G-9.1-D | No Idempotency-Key header; duplicate POST silently overwrites `arrival_date` | P2 |
| G-9.1-E | Arrival transition is a single UPDATE; no events, no job enqueue, no transaction | P2 |
| G-9.1-F | Settling-in stage gates are inconsistent: generate/PATCH enforce `arrived`, GET soft-gates, why-it-matters has no stage gate | P1 |
| G-9.1-G | No shared `isPostArrivalEnabled(plan)` helper; each system checks stage independently and inconsistently | P2 |
| G-9.1-H | No arrival date validation (future date, max age) | P3 |
| G-9.1-I | Checklist generation not auto-triggered after arrival; entirely manual | P2 |
| G-9.2-A | Migration does not include `steps`, `documents_needed`, `cost` columns; at least one undocumented migration exists | P1 |
| G-9.2-B | `task_key` is populated, but runtime identity still splits across UUIDs, task_key, and titles | P2 |
| G-9.2-C | `unlocked` boolean defined in schema; never read or written by application code | P2 |
| G-9.2-D | `settling_in_generation_runs` table not implemented | P2 |
| G-9.2-E | `settling_in_task_events` audit log not implemented | P2 |
| G-9.2-F | Completion transaction is two separate DB round-trips; no transaction; no event emission | P2 |
| G-9.2-G | `deadline_source` column exists; never populated | P3 |
| G-9.3-A | ~~Generate endpoint does not verify `plan.stage === 'arrived'`; pre-arrival generation possible~~ **— FIXED in Phase 2.** Route now returns 400 unless the current plan is `arrived`. | FIXED |
| G-9.3-B | Checklist generation not auto-triggered after arrival | P2 |
| G-9.3-C | `country_baselines` table does not exist; hardcoded TypeScript fallback only | P2 |
| G-9.3-D | Idempotency uses boolean flag only; no `job_key` or generation run table | P2 |
| G-9.3-E | No Stage 4 merge/dedup/validate pass | P2 |
| G-9.3-F | No Stage 6 event emission | P2 |
| G-9.3-G | AI response parsed with regex instead of structured output mode | P2 |
| G-9.3-H | No merge of baseline + web + AI tasks — single direct path | P2 |
| G-9.3-I | Generation insert and `post_relocation_generated` update are two separate non-transactional queries | P2 |
| G-9.3-J | ~~`arrival_date` not passed to generator; deadlines are relative only~~ **— FIXED in Phase 6.** Generator stores `deadline_at` (absolute) computed from `arrival_date + deadline_days`. | FIXED |
| G-9.3-K | Model `anthropic/claude-sonnet-4-20250514` via `@ai-sdk/openai` appears to use OpenRouter; API key management undocumented | P2 |
| G-9.4-A | Generation path validates DAGs and strips dependencies on cycle, but no broader dependency integrity layer exists | P2 |
| G-9.4-B | `task_key` not used as stable dependency identifier; chat protocol uses title strings | P2 |
| G-9.4-C | Cross-plan UUID references not prevented; cause silent permanent lock | P2 |
| G-9.4-D | Self-referencing tasks not prevented | P2 |
| G-9.4-E | Skipped tasks do not unblock dependents — dependency chains permanently blocked | P2 |
| G-9.4-G | `unlocked` boolean column is dead schema | P3 |
| G-9.5-A | Why-it-matters uses a per-plan cap, not the contract's per-user daily rate limit | P2 |
| G-9.5-B | Prompt does not enforce hedging language against legal claims | P2 |
| G-9.5-C | No audit events on enrichment generation or cache-hit | P2 |
| G-9.5-D | Concurrent requests both make LLM calls and both write (double spend) | P3 |
| G-9.5-E | Endpoint uses UUID not `task_key` as URL identifier (contract terminology divergence) | P3 |
| G-9.5-F | Partial text not stored on failure; NULL remains | P3 |

### Phase 10 Gaps (Post-Relocation UI, Chat, Compliance)

| Code | Description | Severity |
|---|---|---|
| G-10.1-A | ~~No token limit on task injection; all tasks injected regardless of list length~~ **— FIXED in Phase 7.** Post-arrival system prompt caps task injection to ~2000 tokens with priority ordering (overdue → deadline → legal). | FIXED |
| G-10.1-B | No observability events on post-arrival mode selection | P2 |
| G-10.1-D | Missing-tasks state provides no prompt to generate checklist | P2 |
| G-10.1-E | Prompt does not prohibit AI from inventing tasks not on checklist | P2 |
| G-10.1-F | Prompt does not explicitly prohibit legal guarantees | P2 |
| G-10.1-G | Auth failure in chat route silently falls to pre-arrival mode | P1 |
| G-10.1-H | `nationality` field name mismatch (profile uses `citizenship`) | P3 |
| G-10.2-A | `[TASK_DONE:]` marker uses title string, not UUID as contract specifies | **V1 design decision** — intentional per CLAUDE.md. Title format is v1 canonical. UUID migration is V2+ only. Not a defect to fix in v1. |
| G-10.2-B | No explicit trigger phrase list in prompt | P2 |
| G-10.2-C | ~~PATCH endpoint does not verify `plan.stage === 'arrived'`; task completion possible pre-arrival~~ **— FIXED in Phase 2.** PATCH now verifies the owning plan is `arrived`. | FIXED |
| G-10.2-D | `processedRef` per-component only; resets on navigation | P3 |
| G-10.2-F | Silent failure on network error in fire-and-forget — badge shown, task may not update | P2 |
| G-10.3-A | `compliance_alert_dismissals` server-side table not implemented | P2 |
| G-10.3-B | Alert dismissal uses localStorage only; no server-side dismissal persistence exists | P2 |
| G-10.3-C | Deadline computation is only partially server-side: alerts/task cards use API urgency, but `ComplianceTimeline` still computes status client-side | P2 |
| G-10.3-D | No observability events on alert generation | P2 |
| G-10.3-E | Legal tasks not sorted first in compliance timeline | P3 |
| G-10.3-F | Toast fires on every component mount | P3 |

### Phase 7 Gaps (Frontend / UI Layer)

| Code | Description | Severity |
|---|---|---|
| G-7.1-A | Settings profile form has hardcoded placeholder values — not wired to DB; save button has no handler | P1 |
| G-7.1-B | Three independent document checklist generators (dashboard, documents page, backend service) produce divergent results | P1 |
| G-7.1-C | `checklist_progress` table permanently bypassed — completion tracking uses `document_statuses` JSONB instead | P1 |
| G-7.1-D | `document_statuses` column used by documents page has no SQL migration | P1 |
| G-7.1-E | ~~Booking page always uses `useMock: true` — real Firecrawl flight search is never invoked from the UI~~ **— CORRECTED.** UI now calls `/api/flights` without forcing mock mode; runtime behavior depends on Firecrawl availability and API fallback. | CORRECTION |
| G-7.1-F | Client-side data duplication — dashboard has own `VISA_DATABASE` (4 countries) and own `generateBudgetFromProfile()` separate from server implementations | P2 |
| G-7.1-G | Feature matrix (`TIER_FEATURES`) duplicated in `tier-gate.tsx` (client) and `lib/gomate/tier.ts` (server) | P2 |
| G-7.1-H | `BottomNav` component is dead code — never imported; `AppShell` renders its own mobile nav inline | P3 |
| G-7.1-I | Settings notification switches have no backend persistence — state is local only | P2 |
| G-7.1-J | "Country Guides" tab links to external `gomaterelocate.com/country-guides` — not rendered in-app | P3 |

---

## 5. Gap Criticality Summary

### P0 — Critical (6 gaps — unchanged from Phase 7.2)

These are data corruption, security, or total feature failures. Must be fixed before production use.

| Code | System | Description |
|---|---|---|
| G-4.1-G | Guide Generation | PDF renderer receives incompatible data — Download PDF is broken for all users |
| G-4.3-A | Subscription | No server-side feature gating — API routes do not check subscription tier |
| G-4.3-B | Subscription | Subscription expiry not enforced anywhere |
| G-4.3-D | Subscription | Any user can self-upgrade for free via `PATCH /api/subscription` |
| G-5.4-A | Reliability | No retry logic — every external call is single-attempt with silent failure |
| G-6.2-D | End-to-End Flow | Guide insert in lock handler uses wrong schema key — guide never saves |

### P1 — High (34 open gaps, 2 fixed in Phases 6–7)

Incorrect behaviour, silent failures, or security gaps that affect users or data integrity.

See gap register above for full list. Key P1 gaps to call out:

| Code | System | Description |
|---|---|---|
| G-2.1-E | Chat Engine | No streaming error recovery |
| G-2.2-A | System Prompt | `confirmed` state has no handler |
| G-2.2-D | System Prompt | `VALIDATION COMPLETE` trigger not validated |
| G-2.3-C | Visa Logic | Three parallel static visa lookup systems |
| G-2.3-F | Visa Logic | Visa research DB columns not in any migration |
| G-3.1-A | Research | Self-HTTP call pattern is fragile |
| G-3.1-D | Research | Partial research success treated as completed |
| G-3.3-C | Source Fetch | No timeout on most external calls |
| G-3.3-D | Source Fetch | ~~In-memory cache non-functional in serverless~~ **FIXED Phase 7** |
| G-4.1-A | Guide Generation | Guide generator is not AI-powered |
| G-4.1-B | Guide Generation | COUNTRY_DATA covers only 6 of 50+ destinations |
| G-4.2-A | Plans | Plan switch is non-atomic |
| G-4.2-D | Plans | Archived plans count against plan limit |
| G-4.3-C | Subscription | No Stripe integration |
| G-4.3-E | Subscription | No subscription auto-creation |
| G-4.4-F | Flight Search | Flight endpoint has no authentication |
| G-6.1-B | Auth | No password reset flow |
| G-6.1-C | Auth | Open redirect in callback |
| G-6.1-D | Auth | Middleware error silently allows all requests |
| G-6.2-A | End-to-End | No chat history persistence |
| G-6.2-B | End-to-End | Profile completeness defined in two places |
| G-6.2-C | End-to-End | ~~Research results in undocumented DB columns~~ **Partially fixed Phase 6** |
| G-6.2-E | End-to-End | Plan creation race condition |
| G-6.2-F | End-to-End | Research trigger not called server-side on lock |
| G-7.1-A | Frontend | Settings profile form non-functional |
| G-7.1-B | Frontend | Three independent checklist generators |
| G-7.1-C | Frontend | `checklist_progress` table permanently bypassed |
| G-7.1-D | Frontend | `document_statuses` column has no migration |
| G-7.1-E | Frontend | Booking runtime depends on `/api/flights` environment and fallback path, not forced mock mode |
| G-9.1-F | Post-Arrival Stage | Settling-in stage gates remain inconsistent across GET/generate/PATCH/why-it-matters |
| G-9.2-A | Settling-In Persistence | Schema documentation incomplete; undocumented migration for `steps`, `documents_needed`, `cost` |
| G-9.4-A | Task Graph | Generation path validates DAGs, but broader dependency integrity remains incomplete |
| G-10.1-G | Post-Arrival Chat | Auth failure silently falls to pre-arrival mode |

---

## 6. Source File to System Map

Which system document covers each primary source file.

### Application Routes

| File | Phase / Document |
|---|---|
| `app/api/chat/route.ts` | 2.1 Chat Engine + 3.4 Extraction Layer |
| `app/api/profile/route.ts` | 1.2 Interview State Machine + 4.2 Plans System + 6.2 End-to-End Flow |
| `app/api/plans/route.ts` | 4.2 Plans System |
| `app/api/guides/route.ts` | 4.1 Guide Generation |
| `app/api/guides/[id]/route.ts` | 4.1 Guide Generation |
| `app/api/documents/route.ts` | 7.1 Frontend / UI Layer |
| `app/api/flights/route.ts` | 4.4 Flight Search |
| `app/api/cost-of-living/route.ts` | 3.2 Cost of Living |
| `app/api/subscription/route.ts` | 4.3 Subscription System |
| `app/api/research/trigger/route.ts` | 3.1 Research Orchestration + 5.1 Job System |
| `app/api/research/visa/route.ts` | 2.3 Visa Logic + 3.1 Research Orchestration |
| `app/api/research/local-requirements/route.ts` | 3.1 Research Orchestration |
| `app/api/research/checklist/route.ts` | 4.5 Checklist Generation + 3.1 Research Orchestration |
| `app/auth/login/page.tsx` | 6.1 Auth and Sessions |
| `app/auth/sign-up/page.tsx` | 6.1 Auth and Sessions |
| `app/auth/sign-up-success/page.tsx` | 6.1 Auth and Sessions |
| `app/auth/callback/route.ts` | 6.1 Auth and Sessions |
| `app/(app)/layout.tsx` | 6.1 Auth and Sessions + 7.1 Frontend / UI Layer |
| `app/(app)/dashboard/page.tsx` | 7.1 Frontend / UI Layer |
| `app/(app)/chat/page.tsx` | 7.1 Frontend / UI Layer |
| `app/(app)/guides/page.tsx` | 7.1 Frontend / UI Layer |
| `app/(app)/documents/page.tsx` | 7.1 Frontend / UI Layer |
| `app/(app)/settings/page.tsx` | 7.1 Frontend / UI Layer |
| `app/(app)/booking/page.tsx` | 7.1 Frontend / UI Layer |
| `app/(app)/guides/[id]/page.tsx` | 4.1 Guide Generation (Phase 8 addendum) |
| `app/(app)/settling-in/page.tsx` | 9.3 Settling-In Engine + 9.4 Task Graph + 10.3 Compliance Timeline |
| `app/api/progress/route.ts` | Phase 6: progress API (interview + post-arrival progress) |
| `app/api/settling-in/arrive/route.ts` | 9.1 Post-Arrival Stage + Phase 8 (deadline recomputation) |
| `app/api/settling-in/generate/route.ts` | 9.3 Settling-In Engine |
| `app/api/settling-in/route.ts` | 9.2 Settling-In Persistence + 9.4 Task Graph + 10.3 Compliance Timeline |
| `app/api/settling-in/[id]/route.ts` | 9.2 Settling-In Persistence + 9.4 Task Graph + 10.2 Task Completion via Chat |
| `app/api/settling-in/[id]/why-it-matters/route.ts` | 9.5 Why-It-Matters Enrichment |

### Library Modules

| File | Phase / Document |
|---|---|
| `lib/gomate/profile-schema.ts` | 1.1 Profile Schema |
| `lib/gomate/state-machine.ts` | 1.2 Interview State Machine |
| `lib/gomate/plan-factory.ts` | 1.2 Interview State Machine + 4.2 Plans System |
| `lib/gomate/system-prompt.ts` | 2.2 System Prompt Architecture |
| `lib/gomate/profile-summary.ts` | 2.2 System Prompt Architecture + 2.3 Visa Logic |
| `lib/gomate/visa-checker.ts` | 2.3 Visa Logic |
| `lib/gomate/visa-recommendations.ts` | 2.3 Visa Logic |
| `lib/gomate/visa-advisor.ts` | 2.3 Visa Logic (unused) |
| `lib/gomate/web-research.ts` | 3.1 Research Orchestration + 3.2 Cost of Living + 3.3 Source Fetch Layer |
| `lib/gomate/numbeo-scraper.ts` | 3.2 Cost of Living + 3.3 Source Fetch Layer |
| `lib/gomate/checklist-generator.ts` | 3.3 Source Fetch Layer + 3.4 Extraction Layer + 4.5 Checklist Generation |
| `lib/gomate/guide-generator.ts` | 4.1 Guide Generation |
| `lib/gomate/pdf-generator.ts` | 4.1 Guide Generation (Phase 8 addendum) |
| `lib/gomate/tier.ts` | 4.3 Subscription System |
| `lib/gomate/flight-search.ts` | 4.4 Flight Search |
| `lib/gomate/airports.ts` | 3.5 Country / Destination Data + 4.4 Flight Search |
| `lib/gomate/country-flags.ts` | 3.5 Country / Destination Data |
| `lib/gomate/official-sources.ts` | 3.5 Country / Destination Data |
| `lib/gomate/source-linker.ts` | 3.3 Source Fetch Layer |
| `lib/gomate/supabase-utils.ts` | 1.3 Persistence Layer |
| `lib/gomate/progress.ts` | Phase 6: server-side progress computation (interview + post-arrival) |
| `lib/gomate/settling-in-generator.ts` | 9.3 Settling-In Engine + 9.4 Task Graph |
| `lib/gomate/system-prompt.ts` (post-arrival functions) | 10.1 Post-Arrival Chat Mode + 10.2 Task Completion via Chat |
| `lib/supabase/client.ts` | 1.3 Persistence Layer + 6.1 Auth and Sessions |
| `lib/supabase/server.ts` | 1.3 Persistence Layer + 6.1 Auth and Sessions |
| `lib/supabase/middleware.ts` | 6.1 Auth and Sessions |
| `middleware.ts` | 6.1 Auth and Sessions |

### Database Migrations

| Script | Phase / Document |
|---|---|
| `scripts/001_create_profiles.sql` | 1.3 Persistence Layer + 6.1 Auth and Sessions |
| `scripts/002_create_relocation_plans.sql` | 1.3 Persistence Layer + 4.2 Plans System + 4.5 Checklist Generation |
| `scripts/003_create_checklist_progress.sql` | 1.3 Persistence Layer + 4.5 Checklist Generation |
| `scripts/004_*.sql` | **Missing** — no file exists |
| `scripts/005_create_guides.sql` | 1.3 Persistence Layer + 4.1 Guide Generation |
| `scripts/006_add_document_statuses.sql` | 1.3 Persistence Layer |
| `scripts/007_add_guide_type.sql` | 1.3 Persistence Layer + 4.1 Guide Generation |
| `scripts/008_create_subscriptions.sql` | 1.3 Persistence Layer + 4.3 Subscription System |
| `scripts/009_add_plan_metadata.sql` | 1.3 Persistence Layer + 4.2 Plans System + 9.1 Post-Arrival Stage |
| `scripts/010_settling_in_checklist.sql` | 9.1 Post-Arrival Stage + 9.2 Settling-In Persistence + 9.4 Task Graph |
| `scripts/011_add_settling_task_columns.sql` | Phase 0: settling_in_tasks additional columns |
| `scripts/012_add_research_columns.sql` | Phase 0: relocation_plans research columns |
| `scripts/013_add_document_statuses.sql` | Phase 0: relocation_plans document_statuses |
| `scripts/016_add_research_status_columns.sql` | Phase 6: research_status + research_completed_at on relocation_plans |
| `scripts/017_add_deadline_at_and_overdue.sql` | Phase 6: deadline_at + deadline_anchor on settling_in_tasks; OVERDUE status |
| `scripts/018_add_plan_version.sql` | Phase 7: plan_version on relocation_plans |
| `scripts/019_add_guide_staleness.sql` | Phase 9: guide versioning + staleness columns on guides; research_freshness_days on relocation_plans |
| `scripts/020_add_onboarding_completed.sql` | Phase 10: onboarding_completed on relocation_plans |

### Components

| File | Phase / Document |
|---|---|
| `components/layout/app-shell.tsx` | 7.1 Frontend / UI Layer |
| `components/layout/bottom-nav.tsx` | 7.1 Frontend / UI Layer (dead code) |
| `components/tier-gate.tsx` | 7.1 Frontend / UI Layer |
| `components/arrival-banner.tsx` | 9.1 Post-Arrival Stage |
| `components/settling-in-task-card.tsx` | 9.2 Settling-In Persistence + 9.4 Task Graph + 9.5 Why-It-Matters Enrichment |
| `components/compliance-timeline.tsx` | 10.3 Compliance Timeline & Alerting |
| `components/compliance-alerts.tsx` | 10.3 Compliance Timeline & Alerting |
| `components/chat/chat-message-content.tsx` | 10.2 Task Completion via Chat |

---

## 7. Systems With No Documentation

The following areas exist in the codebase but are not covered by any system document:

| Area | Files | Notes |
|---|---|---|
| UI component library | `components/ui/*.tsx` (shadcn/ui) | External library; no custom logic documented |
| Stripe webhook handler | None found | Columns exist for Stripe; no webhook route exists |
| Error page | `app/auth/error` implied by callback redirect | No document |
| Dark mode / theming | Referenced in `settings/page.tsx` | Non-functional; no document needed |
| `lib/gomate/supabase-utils.ts` | Utility helpers | Covered briefly in 1.3; no standalone document |
| `lib/data/airports.txt` | 7,698-entry dataset | Referenced in 3.5; bundled but never loaded |

---

## 8. Correction Register

Known inaccuracies found in earlier documents, corrected in later phases.

| Original Gap | Document | Correction | Discovered In |
|---|---|---|---|
| G-6.1-A: Sign-out not implemented | `auth-sessions.md` (Phase 6.1) | Sign-out IS implemented. `AppShell` (`components/layout/app-shell.tsx`) calls `supabase.auth.signOut()` + `router.push("/auth/login")` in `handleSignOut()`. The gap code is retired. | Phase 7.1 (`frontend-ui-layer.md`) |

---

## 9. Missing Contract Files

> **Batch 4 audit (2026-03-01):** The three files listed below **do not exist** anywhere in the repository — not at `docs/`, not at `docs/systems/`, not anywhere. They were referenced in earlier documentation as binary `.docx` files, but `ls` and `file` commands confirm they are absent from the repo entirely.

| File (referenced, not found) | Expected Content |
|---|---|
| `docs/batch5-contracts.md` | GoMate Batch 5 — Foundation Completion contracts |
| `docs/batch6-contracts.md` | GoMate Batch 6 — Feature Expansion contracts |
| `docs/full-system-architecture.md` | GoMate Full System Architecture document |

Target-state descriptions in Phases 5.x system documents are derived from the `docs/roadmap.md` summary of those contracts rather than from the contracts themselves. The absence of these files has no impact on v1 implementation — all required specifications are covered by `docs/build-protocol.md` and the 31 system documents.

---

## 10. Recommended Implementation Priority

Ordered by impact and dependencies. Groups can often be parallelised within a group.

### Group 1 — Fix Before Any Real Users (P0 gaps + critical P1)

1. **G-4.3-D** — Remove the self-upgrade endpoint or add tier validation
2. **G-4.3-A** — Add server-side tier checks to API routes (chat, research, plans)
3. **G-4.3-B** — Enforce subscription expiry in `getTier()` and route handlers
4. **G-6.2-D** — Fix guide insert in lock handler to use correct column schema
5. **G-6.1-C** — Add allowlist validation on `next` parameter in `/auth/callback`
6. **G-6.1-D** — Change middleware error catch to redirect to error page, not allow through
7. **G-4.4-F** — Add authentication to `GET /api/flights`

### Group 2 — Data Integrity and Persistence

8. **G-6.2-C + G-7.1-D** — Write migrations for `visa_research`, `local_requirements_research`, and `document_statuses` columns
9. **G-7.1-C** — Decide: adopt `document_statuses` as canonical or migrate to `checklist_progress` table
10. **G-4.2-A** — Make plan switching atomic (use a transaction or stored procedure)
11. **G-4.2-D** — Exclude archived plans from plan count
12. ~~**G-3.3-D** — Replace in-memory cache with Supabase-backed caching for Numbeo data~~ **FIXED Phase 7** — in-memory cache removed

### Group 3 — Reliability and Observability

13. **G-5.4-A + G-3.1-E + G-3.4-E** — Add exponential backoff retry (3 attempts) to all external calls
14. **G-5.4-C + G-3.3-C** — Add `AbortController` timeouts to all Firecrawl and OpenAI calls
15. **G-5.4-D** — Map external API error status codes to appropriate HTTP responses (429, 503, 504)
16. **G-5.4-B** — Implement per-service circuit breaker for Firecrawl and OpenAI
17. Implement Job System (Phase 5.1 target) — replace synchronous inline research orchestration with queued execution

### Group 4 — Core Feature Gaps

18. **G-6.1-B** — Add password reset flow (`/auth/forgot-password`, `/auth/reset-password`)
19. **G-6.2-A** — Add chat history persistence (store messages in Supabase)
20. **G-4.1-A + G-4.1-B** — Expand COUNTRY_DATA coverage or transition to AI-generated guide sections
21. **G-4.3-C** — Integrate Stripe for actual payment processing
22. **G-7.1-A** — Wire settings profile form to DB
23. **G-7.1-E** — Connect booking page to real flight search

### Group 5 — Architecture Clean-Up

24. **G-2.3-C** — Consolidate three parallel visa lookup systems into one
25. **G-3.3-A + G-3.1-B** — Create unified `scrapeUrl()` abstraction
26. **G-3.4-A** — Create unified extraction protocol
27. **G-7.1-B** — Consolidate three document checklist generators
28. **G-7.1-G** — Single source of truth for `TIER_FEATURES` matrix (server only, passed to client via API)
29. **G-2.3-F + G-2.3-E** — Fix ghost field references in `profile-summary.ts` and `visa-recommendations.ts`

---

## 11. Additional Documentation Created in Audit (2026-03-01)

The following files were created during the documentation audit that produced this index. They are not system documents but are part of the governance layer:

| File | Purpose |
|---|---|
| `/CLAUDE.md` | Root entry point for Claude Code (canonical read-first file for new sessions) |
| `docs/glossary.md` | Definitions for all domain-specific terms: Stage, Plan, Profile, Tier, DAG, Marker Protocol, etc. |
| `docs/phases/phase-0-baseline.md` | Authoritative snapshot of codebase state after Phase 0: all routes, tables, integrations, and migration state |
| `docs/phases/phase-1-p0-security-fixes.md` | Phase 1 implementation guide: P0 security fixes (subscription, PDF, open redirect, middleware) |
| `docs/phases/phase-2-settling-in-stage-integrity.md` | Phase 2 implementation guide: stage checks on settling-in routes, DAG cycle detection |
| `docs/phases/phase-3-data-integrity.md` | Phase 3 implementation guide: atomic plan switch, archived plan limit, task_key slugs |
| `docs/phases/phase-4-reliability-minimum.md` | Phase 4 implementation guide: `fetchWithRetry()` utility, timeout audit |
| `docs/phases/phase-5-ui-integrity.md` | Phase 5 implementation guide: compliance alert persistence, settings wiring, booking decision |
| `docs/systems/system-index.md` | Quick-reference navigation hub: all 31 system docs with status and file paths |
| `docs/phases/phase-6-task-lifecycle.md` | Phase 6 build doc: OVERDUE detection, deadline anchoring, progress API, research schema repair |
| `docs/phases/phase-7-generation-quality.md` | Phase 7 build doc: plan_version counter, token budget cap, in-memory cache removal |
| `docs/phases/phase-8-deadline-intelligence.md` | Phase 8 build doc: deadline recomputation on arrival_date change, T-7/T-1 urgency indicators |
| `docs/phases/phase-9-guide-research-freshness.md` | Phase 9 build doc: guide versioning, staleness marking, research freshness TTL |
| `docs/phases/phase-10-chat-safety-onboarding.md` | Phase 10 build doc: confirmation flow for critical fields, onboarding_completed flag |
| `docs/phases/phase-11-task-enrichment.md` | Phase 11 build doc: block reason surfacing, why-it-matters maxTokens verification |
| `docs/definitions/` | 24 canonical system definitions with V1 Scope Blocks documenting target vs current gaps |

---

*Document generated by systematic audit of all 23 `/docs/systems/` files and their primary source files. All gap codes are traceable to the originating system document.*
