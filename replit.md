# Overview

This pnpm monorepo, built with TypeScript, aims to develop GoMate, an AI relocation assistant. Evolving from a v1 guide platform to a v2 multi-agent Relocation Agency OS, it provides comprehensive, AI-powered support for individuals relocating, offering personalized assistance throughout the process. Key capabilities include an AI-driven web application, a sophisticated multi-agent backend for data handling and personalized interactions, and dynamic management of user relocation plans. The project emphasizes robust data handling, atomic updates, and a modular architecture to support future expansion.

# User Preferences

*   **NO MOCK DATA IN AGENT OUTPUTS.** If a specialist's research tool fails (Firecrawl down, source 404, parsing fails), the agent returns `{ status: "partial", reason: "<specific cause>", available: {...} }`. It NEVER fabricates plausible-looking data to fill the gap. The user sees the partial state with the reason. Applies to all 13+ specialists, the Coordinator, the Synthesizer, the Critic, the Question Director, the Extractor — every agent.
*   **PLACEHOLDERS HAVE OWNERS.** When a prompt says "for now just placeholder, real version in [later prompt]", the placeholder MUST carry a TODO comment in the code referencing the prompt that owns it (e.g., `// TODO[prompt-4.3]: replace with real audit-trail-popover`). At each Stabilize Checkpoint between waves, grep for `TODO[prompt-X]` where X has already been completed — fail the checkpoint if any remain.
*   **STRIPE STAYS MOCK FOR BUILDATHON ONLY.** The Free + Pro tier flipping is intentional (per Prompt 9.3 + 9.10). Real Stripe integration happens post-buildathon. Do not silently make it real mid-buildathon. If a prompt's intent seems to require real payment, push back to the user before implementing.
*   **Tiers (post-9.3)**: Two tiers only — `free` and `pro`. The legacy `pro_single` / `pro_plus` strings have been removed everywhere; type is `Tier = "free" | "pro"`. Pricing: Free $0 (1 plan, basic overview), Pro $39/month or $299/year (saves ~36%, all features). The buildathon override `GOMATE_BUILDATHON_FREE` (default ON, set to `"false"` to disable) makes `getUserTier()` always return `"pro"` so judges/testers see the full Pro experience. **Supabase migration `029_consolidate_pro_tiers.sql`** drops the old CHECK constraint, rewrites `pro_single`/`pro_plus` rows to `pro`, normalizes legacy billing_cycles to `monthly`/`annual`, and re-adds the new CHECK. Apply via Supabase SQL Editor before launch — runtime is unaffected today because the override masks any stale stored values.
*   **Branch**: `buildathon-v2` (push from Replit Git pane — the agent has no GitHub creds).
*   From the end of Phase 2 onward, every phase ships:
    1.  **Frontend E2E** at `artifacts/gomate/e2e/phase-N.spec.ts` (Playwright) — ≥3 scenarios, screenshots to `/artifacts/screenshots/phase-N/`, real button clicks/network waits.
    2.  **Backend integration** at `artifacts/api-server/test/phase-N.integration.test.ts` (vitest or node:test) — ≥2 scenarios per significant endpoint, real Anthropic + real Supabase, per-test cleanup in `afterEach`.
    3.  **Report** at `PHASE-N-TESTS.md` summarizing what was tested + pass/fail + flake rates.
*   Hard rules: REAL data flows (no mocked agent calls — Haiku 4.5 OK for cheap LLM calls); REAL Supabase; tests must NEVER be `.skip`-ed; fix bugs not tests; pause + report if a test reveals a design flaw.
*   **Test account credentials**: `TEST_EMAIL` and `TEST_PASSWORD` env-vars (set by user as Replit secrets) are the canonical Supabase login for E2E and persona-harness scripts. Use those — do not hardcode `axelcornelius93@gmail.com`/etc anywhere new.
*   **Personas Round 1 (task #9) — 10/10 onboarding ✅ achieved (2026-05-03).** Harness: `artifacts/api-server/scripts/e2e-personas-round1.mjs` (10 personas: Sofia, Hiroshi, Aisha, Liam, Maria, Chen, Olga, Tom, Fatima, Erik). Run with `ONBOARDING_ONLY=1` to skip the research phase (research is persistent in DB per user direction — kör one-shot via `e2e-personas-research.mjs`). **Root-cause bug fixed**: `lib/agents/src/intake-fields.ts` had `savings_available`/`monthly_budget`/`monthly_income`/`rental_budget_max` typed as `number`, causing the Extractor to coerce `"45000 EUR"` → `Number("45000EUR")` → NaN → loop. Changed to `type: "string"` so Extractor preserves the currency string and Validator's currency rule parses it. Research-pipeline timeout bumped 3min → 5min in `artifacts/api-server/src/routes/ai-research.ts` (visa specialist runs ~175s, near-cap).

# System Architecture

The project is a pnpm monorepo utilizing Node.js 24 and TypeScript 5.9.

**Core Components:**

*   **`gomate` (Frontend)**:
    *   **Technology**: Vite + React + wouter for routing.
    *   **Styling**: Tailwind v4, shadcn UI, with a "Paper White + Pulse Green + Midnight Slate" theme and a `gm-card` system.
    *   **UI/UX**: Features an animated mascot with 7 states (idle, waving, nodding, smiling, tilting_curious, thinking, celebrating), typewriter effect for speech bubbles, and an `onboarding-input` component. The mascot design mirrors the `gomate-avatar.tsx` brand mark, including a mint paper-airplane orbiting with state-specific behavior.
    *   **Authentication**: Supabase (PKCE, email/password) **+ anonymous sign-in** (`signInAnonymously`). Anonymous users get a real JWT so RLS and `/api/*` endpoints work unchanged. The save-progress modal upgrades anonymous → permanent via `supabase.auth.updateUser({ email, password })` (preserves `user_id`, so all `relocation_plans` / chat history / `agent_audit` rows survive the upgrade).
    *   **Key Pages**: `/landing` (anonymous-onboarding entry, CTA → `signInAnonymously` → `/onboarding`), Dashboard, chat, onboarding (driven by `/api/chat` SSE; triggers save-progress modal once when ≥5 profile fields populated), guides, visa-tracker, settling-in, documents, settings. `/` is a `RootRedirect` — session → `/dashboard`, no session → `/landing`.
    *   **Anonymous Session Plumbing**: `src/lib/anonymous-session.tsx` provides a global context exposing `{ isAnonymous, openSaveModal, maybeShowSaveModal }`. The provider mounts `<SaveProgressModal>` globally and clears the per-browser `save-progress-shown` dismissal flag on `SIGNED_OUT` and on successful anonymous→permanent upgrade. The `<GuestModeBanner>` in `AppShell` opens the modal manually.
*   **`api-server` (Backend)**:
    *   **Technology**: Express 5 API.
    *   **Authentication**: Supabase bearer tokens via `src/lib/supabase-auth.ts`.
    *   **Chat Endpoints**: `POST /api/chat` (v2) for SSE-driven agent orchestration, supporting new `mascot` events. `POST /api/chat-v1` for legacy interactions.
    *   **Data Handling**: Atomic JSONB merge for profile data using `apply_profile_field_patch` Postgres function.
    *   **Tier Gating**: `src/lib/gomate/tier.ts` manages feature access based on user subscriptions.
    *   **Research Orchestrator**: `artifacts/api-server/src/lib/agents/research-orchestrator.ts` manages the full research pipeline (Coordinator dispatch, parallel specialist runs, synthesis, critique, re-dispatch), returning 202 immediately and continuing work in the background. Live status is exposed via SSE (`GET /api/research/status`). Research is only triggered by explicit POST requests.
*   **`agents` (AI Agents)**:
    *   **Kernel**: `callLLM` routes LLM calls to specific models (e.g., `extractor` to `claude-haiku-4-5`).
    *   **Audit Logging**: `writeAuditRow` logs agent interactions to `agent_audit` table.
    *   **Orchestration**: `runAgentPipeline` handles sequential/parallel agent execution with retries.
    *   **Core Agents**:
        *   **Extractor**: `extractField` from user messages.
        *   **Validator**: `validate` (pure code) for data normalization and range checks.
        *   **Profile Writer**: `writeProfileField` to persist validated data using atomic JSONB merge.
        *   **Question Director**: `askNext` determines next onboarding question, including `animationCue` for mascot.
    *   **Specialist Agents**:
        *   **6 Always-Run Specialists**: `visaSpecialist`, `taxSpecialist`, `costSpecialist`, `housingSpecialist`, `culturalSpecialist`, `documentsSpecialist`. These read profile data, scrape official sources via Firecrawl (except `culturalSpecialist`), synthesize information via LLM, and return `SpecialistOutput` with citations. They never fabricate URLs.
        *   **13 Conditional Specialists**: `schoolsSpecialist`, `healthcareSpecialist`, `bankingSpecialist`, `petSpecialist`, `postedWorkerSpecialist`, `digitalNomadComplianceSpecialist`, `jobComplianceSpecialist`, `familyReunionSpecialist`, `departureTaxSpecialist`, `vehicleImportSpecialist`, `propertyPurchaseSpecialist`, `trailingSpouseCareerSpecialist`, `pensionContinuitySpecialist`. Dispatched based on specific profile triggers (e.g., `pets!=="none"`).
*   **`db` (Database)**:
    *   **ORM**: Drizzle ORM for schema management and migrations.
    *   **Features**: Includes schemas for `relocation_plans`, `agent_audit`, and RLS for agent tables.
*   **`integrations-anthropic-ai`**: Wrapper for Anthropic SDK.

**Key Design Decisions:**

*   **Monorepo**: Shared code across frontend, backend, and agents.
*   **Separation of Concerns**: Agents are testable and flexible with dependency injection.
*   **Atomic Updates**: Ensures data integrity for profile data.
*   **Robust Error Handling**: Agents provide partial results or explicit error reasons.
*   **Backward Compatibility**: Chat v2 SSE is compatible with existing frontend.
*   **Version Flagging**: `profiles.gomate_version` for managing behavior.

# External Dependencies

*   **Database**: PostgreSQL
*   **ORM**: Drizzle ORM
*   **Authentication**: Supabase (`@supabase/supabase-js`)
*   **AI/LLM Providers**:
    *   OpenAI (via Replit integration)
    *   Anthropic (via Replit AI integration; models: `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-7`)
    *   Google Gemini (planned `TODO`)
*   **Validation**: Zod (`zod/v4`), `drizzle-zod`
*   **API Codegen**: Orval
*   **Frontend Libraries**: React, wouter, Tailwind CSS v4, shadcn, Framer Motion
*   **Testing**: Playwright (frontend E2E), vitest or `node:test` (backend integration)
*   **Scraping**: Firecrawl (`api.firecrawl.dev/v1`)