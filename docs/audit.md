# GoMate — Full System Audit

**Version:** 1.0
**Status:** Authoritative baseline
**Source:** Synthesis of 31 system documents in `docs/systems/` + direct code audit
**Date:** 2026-02-25

This document is the single source of truth for GoMate's system state. It defines what is working, what is broken, and what must be true for the system to be considered production-ready at v1.

All build decisions derive from this document. When in doubt, this document wins over contracts, system docs, and aspirational specs.

---

## 1. System Classification

Every major system is classified as one of four states:

- **WORKING** — Implements its intended function end-to-end. Gaps are minor or cosmetic.
- **PARTIAL** — Core path functional. Known gaps in security, correctness, or completeness.
- **BROKEN** — Core path fails for all or most users.
- **MISSING** — System does not exist. Only design contracts or placeholder docs exist.

| # | System | Status | Notes |
|---|---|---|---|
| 1.1 | Profile Schema (65+ fields, Zod validation) | **WORKING** | Evidence-based; schema complete |
| 1.2 | Interview State Machine | **PARTIAL** | `confirmed` state unreachable; `computeNextState()` dead code |
| 1.3 | Persistence Layer (Supabase, RLS, migrations) | **PARTIAL** | Migration 004 missing; some columns used without migration |
| 2.1 | Chat Engine (streaming, extraction, response) | **WORKING** | Raw fetch instead of SDK but functional end-to-end |
| 2.2 | System Prompt Architecture | **PARTIAL** | `confirmed` handler missing; 5-destination context only |
| 2.3 | Visa Logic | **PARTIAL** | Three parallel systems; ghost field references |
| 3.1 | Research Orchestration | **PARTIAL** | Self-HTTP pattern; partial success = "completed" |
| 3.2 | Cost of Living | **PARTIAL** | Two parallel systems; live Firecrawl path effectively disabled |
| 3.3 | Source Fetch Layer | **PARTIAL** | No shared abstraction; in-memory cache non-functional |
| 3.4 | Extraction Layer | **PARTIAL** | No shared protocol; regex JSON parsing |
| 3.5 | Country / Destination Data | **PARTIAL** | `airports.txt` never loaded; `"use client"` on server module |
| 4.1 | Guide Generation + PDF Export | **BROKEN** | PDF renders 4 fields as `undefined` for every user (P0) |
| 4.2 | Plans System | **PARTIAL** | Non-atomic plan switch; archived plans count against limit |
| 4.3 | Subscription System | **BROKEN** | Any user can self-upgrade for free (P0); no expiry enforcement (P0) |
| 4.4 | Flight Search | **PARTIAL** | `Math.random()` for stop count; booking always mock in UI |
| 4.5 | Checklist Generation | **PARTIAL** | Table created but no API; naming confusion |
| 5.1 | Job System | **MISSING** | Does not exist |
| 5.2 | Observability | **MISSING** | Does not exist |
| 5.3 | Artifact System | **MISSING** | Does not exist |
| 5.4 | Reliability Contracts | **PARTIAL** | No retry anywhere; no circuit breaker |
| 6.1 | Auth and Sessions | **PARTIAL** | No password reset; open redirect; middleware silently allows errors |
| 6.2 | End-to-End Flow | **PARTIAL** | No chat history; guide insert broken; plan creation race |
| 7.1 | Frontend / UI Layer | **PARTIAL** | Settings non-functional; booking always mock; 3 checklist generators |
| 9.1 | Post-Arrival Stage & Arrival | **PARTIAL** | Arrival flow works; no stage checks on downstream routes |
| 9.2 | Settling-In Persistence | **PARTIAL** | Core works; undocumented migration; task_key never populated |
| 9.3 | Settling-In Checklist Engine | **PARTIAL** | Generation works; no stage check; no auto-trigger |
| 9.4 | Task Graph & Dependency | **PARTIAL** | Lock computation works; no cycle detection |
| 9.5 | Why-It-Matters Enrichment | **WORKING** | Functions correctly; minor gaps (no rate limit, no hedging) |
| 10.1 | Post-Arrival Chat Mode | **WORKING** | Server-authoritative mode selection functional |
| 10.2 | Task Completion via Chat | **PARTIAL** | Marker protocol functional; uses title not UUID; no stage check |
| 10.3 | Compliance Timeline & Alerting | **PARTIAL** | Renders correctly; dismissal not persisted |

**Summary:** 3 WORKING, 20 PARTIAL, 2 BROKEN, 3 MISSING.

---

## 2. V1 Contract — Non-Negotiable Invariants

These statements must be true for GoMate to be considered production-ready. They are not aspirations. They are exit criteria.

### 2.1 Security invariants

```
INV-S1: No authenticated user can grant themselves a higher subscription tier.
INV-S2: Subscription expiry is enforced — an expired subscription degrades to free tier. [ALREADY MET — getUserTier() checks expires_at]
INV-S3: The /auth/callback route validates the `next` parameter before redirecting.
INV-S4: Middleware errors redirect to an error page — they do not allow requests through.
```

### 2.2 Data integrity invariants

```
INV-D1: Every database column referenced by application code exists in a numbered migration.
INV-D2: settling_in_tasks rows are only created for plans with stage = 'arrived'.
INV-D3: settling_in_tasks completion is only permitted for plans with stage = 'arrived'.
INV-D4: The settling-in task graph is a valid DAG — no cycles can be generated or stored.
INV-D5: Guide PDF export renders all sections without undefined fields.
```

### 2.3 Functional invariants

```
INV-F1: The PDF download on a guide page renders a complete document.
INV-F2: A user with tier = free cannot reach any Pro+ API endpoint.
INV-F3: Post-arrival chat mode activates if and only if plan.stage === 'arrived'.
INV-F4: Task dependency unlock is computed correctly after every task completion.
```

---

## 3. Gap Priority for V1

### 3.1 MUST fix for v1 (P0 + blocking P1)

These gaps prevent the product from being safe or functional for real users.

| Gap | System | Description | File | Category |
|---|---|---|---|---|
| G-4.3-D | Subscription | Any user can self-upgrade via `POST /api/subscription` (action: "upgrade") — no payment verification | `app/api/subscription/route.ts` | code |
| G-6.2-D + G-4.1-G | Guide + End-to-End | Auto-generated guide (on plan lock) uses `sections` column that doesn't exist — all section columns stored as NULL — PDF renders blank for all users | `app/api/profile/route.ts:110–131` | code |
| G-6.1-C | Auth | Open redirect in `/auth/callback` — `next` param not validated | `app/auth/callback/route.ts` | code |
| G-6.1-D | Auth | Middleware catch returns `next()` — auth errors allow access | `middleware.ts` | code |
| G-9.2-A | Settling-In Persistence | Code uses `steps`, `documents_needed`, `cost` columns with no migration | `scripts/` | migration |
| G-9.1-F | Post-Arrival Stage | Settling-in GET/PATCH/generate routes do not check `plan.stage` | `app/api/settling-in/*/route.ts` | code |
| G-9.3-A | Settling-In Engine | Generate endpoint does not verify plan is in `arrived` stage | `app/api/settling-in/generate/route.ts` | code |
| G-10.2-C | Task Completion | PATCH endpoint does not verify `plan.stage === 'arrived'` | `app/api/settling-in/[id]/route.ts` | code |
| G-9.4-A | Task Graph | No DAG cycle detection — cycles lock tasks permanently | `lib/gomate/settling-in-generator.ts` | code |
| G-6.2-C | End-to-End | `visa_research`, `local_requirements_research` columns used without migration | `scripts/` | migration |
| G-7.1-D | Frontend | `document_statuses` column used without migration | `scripts/` | migration |

### 3.2 SHOULD fix for v1 (non-blocking P1 + critical P2)

These gaps create correctness issues or data integrity risks but do not block core functionality.

| Gap | System | Description | File | Category |
|---|---|---|---|---|
| G-4.2-A | Plans | Plan switch is non-atomic — two sequential writes | `app/api/plans/route.ts` | code |
| G-6.2-E | End-to-End | Plan creation race condition on concurrent login | `app/api/profile/route.ts` | code |
| G-9.2-B | Settling-In | `task_key` unique constraint exists but never populated | `app/api/settling-in/generate/route.ts` | code |
| G-9.2-D | Settling-In | No `settling_in_generation_runs` table — no idempotency audit | `scripts/` | migration |
| G-3.3-C | Source Fetch | No timeout on most Firecrawl calls | `lib/gomate/*.ts` | code |
| G-5.4-A | Reliability | No retry logic on any external call | `lib/gomate/*.ts` | code |
| G-10.3-A/B | Compliance | Alert dismissal not persisted — resets on reload | `components/compliance-alerts.tsx` | code |
| G-4.4-F | Flight Search | `GET /api/flights` has no authentication | `app/api/flights/route.ts` | code |
| G-7.1-E | Frontend | Booking page always uses mock data | `app/(app)/booking/page.tsx` | code |
| G-9.5-A | Enrichment | No rate limiting on why-it-matters endpoint | `app/api/settling-in/[id]/why-it-matters/route.ts` | code |

### 3.3 Parked for v2

These systems are explicitly deferred. They will not be built in v1. Their absence is a documented decision, not an oversight.

| System/Gap | Reason for deferral |
|---|---|
| Job System (5.1) | Requires significant infrastructure; research pipeline works without it |
| Observability / trace_id (5.2) | Valuable for debugging; not required for user functionality |
| Artifact System (5.3) | Design-only; no user-facing impact |
| Stripe integration (4.3-C) | Requires business decisions beyond engineering |
| Chat history persistence (6.2-A) | Large scope; client-only state acceptable for v1 |
| Password reset (6.1-B) | Required for full auth; acceptable to defer with manual support |
| Three parallel visa systems (2.3-C) | Works; consolidation is refactoring, not a fix |
| `confirmed` state (1.2, 2.2-A) | Unreachable state; no user impact |
| All P3 gaps | Cosmetic or minor; deferred |

---

## 4. What Works and MUST NOT Be Changed

The following systems are functional and must not be touched unless a specific gap is being fixed. Breaking these to fix something else is not acceptable.

- Chat interview flow (profile extraction, streaming, state machine routing)
- Supabase auth flow (login, signup, callback, session refresh)
- Profile schema and Zod validation
- Settling-in task card UI (all status transitions, dependency display, enrichment button)
- Compliance timeline rendering (ComplianceTimeline component)
- Post-arrival chat mode switch
- `[TASK_DONE:]` marker parsing and badge rendering

---

## 5. The Three Critical Schema Gaps (Special Attention)

Three gaps require schema migrations before any other code work begins (Fas 0 of build-protocol.md). No code that references these columns should run until the migrations exist.

**G-9.2-A:** `settling_in_tasks` uses `steps text[]`, `documents_needed text[]`, `cost text` in both application code and TypeScript types but these columns are absent from migration 010. At minimum one undocumented migration exists in the deployed environment. The solution: write migration 011 that adds these columns with `add column if not exists`.

**G-6.2-C:** `relocation_plans.visa_research` and `relocation_plans.local_requirements_research` are written and read by the research routes but no migration defines them. Write migration 012.

**G-7.1-D:** `relocation_plans.document_statuses` is used by the documents page with no migration. Write migration 013.

---

## 6. Boundary: What This Audit Does NOT Cover

This audit does not address:

- UI design or visual consistency
- Performance optimization
- Scalability (load, concurrency beyond race conditions noted)
- Third-party API contracts (Firecrawl pricing, OpenAI rate limits, OpenRouter availability)
- Mobile-specific behaviour
- Internationalisation

These are out of scope for v1.
