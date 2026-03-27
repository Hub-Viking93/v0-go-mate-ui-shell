# GoMate System Architecture

**Status:** Repository-level overview
**Scope:** Actual implemented architecture as of the current codebase
**Read alongside:** `CLAUDE.md`, `docs/systems/master-index.md`, `docs/audits/backend-audit.md`

---

## 1. Purpose

This document is the readable high-level architecture overview for GoMate.

It summarizes:

1. The main runtime layers
2. The core request and data flows
3. The primary storage model
4. The external service dependencies
5. Where detailed system-level documentation lives

It is intentionally shorter than the documents in `docs/systems/`. For system-specific behavior, invariants, and gaps, use those documents as the source of detail.

---

## 2. System Summary

GoMate is a serverless relocation intelligence application built on Next.js 16 App Router. The product combines:

- authenticated user accounts and plan persistence via Supabase
- an AI-driven onboarding chat that builds a structured relocation profile
- post-lock research flows for visa, local requirements, cost-of-living, and checklist generation
- generated relocation guides and a post-arrival settling-in experience

At a high level, the architecture is:

```text
Browser UI
  -> Next.js App Router pages and client components
  -> /api/* route handlers
  -> lib/gomate/* domain services
  -> Supabase + external AI/research providers
```

---

## 3. Architecture Layers

### 3.1 Presentation Layer

Primary UI routes live in `app/(app)/` and `app/auth/`.

Main surfaces:

- `app/(app)/dashboard/page.tsx`
- `app/(app)/chat/page.tsx`
- `app/(app)/guides/page.tsx`
- `app/(app)/documents/page.tsx`
- `app/(app)/booking/page.tsx`
- `app/(app)/settling-in/page.tsx`
- `app/auth/*`

Reusable UI is composed from:

- `components/chat/*`
- `components/booking/*`
- `components/layout/*`
- `components/ui/*`

This layer is responsible for rendering the user experience, collecting user input, and calling the internal API routes.

### 3.2 Application API Layer

The application backend is primarily implemented as Next.js route handlers in `app/api/`.

Key route groups:

- profile and plan state: `app/api/profile/route.ts`, `app/api/plans/route.ts`, `app/api/progress/route.ts`
- conversational AI: `app/api/chat/route.ts`
- generated artifacts: `app/api/guides/route.ts`, `app/api/guides/[id]/route.ts`, `app/api/documents/route.ts`
- research: `app/api/research/*`
- booking and travel: `app/api/flights/route.ts`, `app/api/airports/route.ts`
- post-arrival flows: `app/api/settling-in/*`
- subscription and media helpers: `app/api/subscription/route.ts`, `app/api/images/destination/route.ts`

These handlers perform auth checks, load and persist plan data, call domain services, and shape responses for the frontend.

### 3.3 Domain Service Layer

Most business logic lives in `lib/gomate/`.

Core modules include:

- profile and interview logic: `profile-schema.ts`, `state-machine.ts`, `progress.ts`, `profile-summary.ts`
- chat prompt and chat helpers: `system-prompt.ts`, `source-linker.ts`, `visa-checker.ts`, `visa-advisor.ts`
- research and external data: `research-visa.ts`, `research-local-requirements.ts`, `research-checklist.ts`, `web-research.ts`, `numbeo-scraper.ts`, `official-sources.ts`
- guide and post-arrival systems: `guide-generator.ts`, `guide-enrichment.ts`, `post-arrival.ts`, `settling-in-generator.ts`, `dag-validator.ts`
- travel and destination utilities: `flight-search.ts`, `airports.ts`, `country-flags.ts`, `currency.ts`
- cross-cutting helpers: `fetch-with-retry.ts`, `tier.ts`, `supabase-utils.ts`

This layer is where most system behavior is encoded.

### 3.4 Persistence and Auth Layer

Persistence is provided by Supabase PostgreSQL and Supabase Auth.

Primary client setup:

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
- `lib/supabase/service.ts`

Schema evolution is tracked in:

- `supabase/migrations/*`
- `supabase/scripts/*`

The app relies on row-level security and authenticated server-side access for protected user data.

### 3.5 External Integration Layer

The main third-party dependencies are:

- OpenAI for pre-arrival and post-arrival chat
- OpenRouter for Claude Sonnet guide and settling-in generation paths
- Firecrawl for search and scraping
- Vercel as the deployment runtime

These integrations are called from API routes and `lib/gomate/*` service modules, not directly from the client.

---

## 4. Core Data Model

The central product entity is the relocation plan.

Main persistent records:

- `profiles`: user identity row created on signup
- `relocation_plans`: current profile data, stage, lock state, research outputs, arrival metadata
- `guides`: generated relocation guides tied to a plan
- `checklist_progress`: checklist progress tracking
- subscription and related support tables introduced through later migrations

In practice, `relocation_plans` is the operational center of the product. Most user-specific relocation state is stored there, often as JSONB.

---

## 5. Primary Runtime Flows

### 5.1 Authentication and Session Flow

1. User signs up or logs in through Supabase auth pages under `app/auth/`
2. Middleware refreshes and validates the session
3. Protected routes and API handlers call Supabase server auth before reading or mutating user data

### 5.2 Onboarding Chat Flow

1. Frontend sends conversation turns to `app/api/chat/route.ts`
2. The route authenticates the user and loads the current plan
3. GPT-4o-mini extracts structured profile fields from the latest user message
4. The merged profile is persisted to the active relocation plan
5. GPT-4o generates the streamed assistant reply
6. Response metadata updates frontend interview state and progress UI

### 5.3 Plan Lock and Research Flow

1. User confirms the profile via `app/api/profile/route.ts`
2. The plan is locked and guide generation runs
3. Research endpoints in `app/api/research/*` gather visa, local requirement, and checklist data
4. Results are written back onto plan-linked storage for downstream UI consumption

### 5.4 Post-Arrival Flow

1. User marks arrival through `app/api/settling-in/arrive/route.ts`
2. Settling-in generation and dependency logic produce task state
3. The settling-in page renders tasks, compliance timeline, and related post-arrival chat/context features

---

## 6. Deployment Model

GoMate is designed for a serverless deployment model:

- frontend and API routes run on Vercel
- persistent state lives in Supabase
- there is no long-running internal worker in the current implementation

This has two important architectural consequences:

- background-style work is handled inline or via chained route execution rather than a true job queue
- in-memory process state is not considered durable or authoritative

---

## 7. Current Architectural Shape

The implemented system is best described as:

- modular in code organization
- serverless in runtime model
- centralized around API routes plus domain service modules
- strongly dependent on Supabase as the persistence backbone
- functionally rich, but flatter than the target architecture described in the definition documents

Notably absent as first-class runtime systems:

- a real job queue / worker layer
- a formal observability and tracing layer
- a unified artifact platform
- a unified source registry and extraction protocol

Those gaps are documented in:

- `docs/audits/definitions-vs-system-audit.md`
- `docs/systems/master-index.md`

---

## 8. Detailed References

Use these documents for deeper system understanding:

- `CLAUDE.md`: entry point, stack, rules, and current operating assumptions
- `docs/systems/end-to-end-flow.md`: request and lifecycle flow through the product
- `docs/systems/master-index.md`: full registry of system docs and gap map
- `docs/systems/system-index.md`: quick lookup for system-level documentation
- `docs/audits/backend-audit.md`: current system behavior
- `docs/audits/definitions-vs-system-audit.md`: target-vs-reality gaps

If this document and a system-specific document differ in detail, prefer the system-specific document.
