# GoMate — Phase 0 Baseline

**Status:** Complete (2026-02-28)
**Purpose:** Authoritative snapshot of the codebase state after Phase 0. This is the "before" picture for all subsequent phases.

Phase 0 verified that all three schema columns needed by existing application code were present in the live Supabase database (migrations 011/012/013). No application code was changed.

---

## 1. Runtime

| Item | Value |
|---|---|
| Framework | Next.js 16, App Router |
| React | 19 |
| Package manager | pnpm |
| TypeScript | Strict mode (`tsconfig.json`) |
| Dev port | `localhost:3000` (`pnpm dev`) |
| Deployment | Vercel (serverless) |
| Database | Supabase (PostgreSQL + GoTrue auth) |
| CSS | Tailwind CSS v4 (`postcss.config.mjs`) |
| Component library | shadcn/ui, new-york style (`components.json`) |

**Start the app locally:**
```bash
pnpm install
pnpm dev       # http://localhost:3000
```

**Environment variables required:** See `/.env.example` for the full list with descriptions.

---

## 2. Application Architecture

### 2.1 Page Routes (Next.js App Router)

**Auth pages (unauthenticated):**

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Root redirect |
| `/auth/login` | `app/auth/login/page.tsx` | Email/password login |
| `/auth/sign-up` | `app/auth/sign-up/page.tsx` | New account registration |
| `/auth/sign-up-success` | `app/auth/sign-up-success/page.tsx` | Post-signup confirmation |
| `/auth/callback` | `app/auth/callback/route.ts` | Supabase GoTrue OAuth callback |
| `/auth/error` | `app/auth/error/page.tsx` | Auth error fallback |

**Protected app pages (require active session):**

All protected pages live under `app/(app)/` and are wrapped by `app/(app)/layout.tsx`.

| Route | File | Purpose |
|---|---|---|
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Overview: plans, profile, status |
| `/chat` | `app/(app)/chat/page.tsx` | Pre-arrival or post-arrival chat |
| `/guides` | `app/(app)/guides/page.tsx` | Guide list |
| `/guides/[id]` | `app/(app)/guides/[id]/page.tsx` | Single guide + PDF download |
| `/documents` | `app/(app)/documents/page.tsx` | Document checklist |
| `/booking` | `app/(app)/booking/page.tsx` | Flight search (mock data in UI) |
| `/settling-in` | `app/(app)/settling-in/page.tsx` | Task graph + compliance timeline |
| `/settings` | `app/(app)/settings/page.tsx` | User settings (partially non-functional) |

**Session middleware:** `middleware.ts` (root) + `lib/supabase/middleware.ts` — refreshes session on every request.

### 2.2 API Routes (20 total)

| Route | Methods | Purpose |
|---|---|---|
| `/api/chat` | POST (streaming) | Pre/post-arrival interview (GPT-4o) |
| `/api/profile` | GET, PATCH | User profile read/update |
| `/api/plans` | GET, POST, PATCH | List, create, switch, rename, archive plans |
| `/api/subscription` | GET, POST | Get tier info; upgrade/downgrade |
| `/api/documents` | GET, PATCH | Document checklist |
| `/api/guides` | GET, POST | List guides; create guide |
| `/api/guides/[id]` | GET | Single guide by ID |
| `/api/research/trigger` | POST | Trigger full research pipeline |
| `/api/research/visa` | GET, POST | Visa research (Firecrawl + GPT-4o) |
| `/api/research/local-requirements` | GET | Local requirements lookup |
| `/api/research/checklist` | GET, POST | Requirements checklist |
| `/api/cost-of-living` | GET, POST | Numbeo scrape + comparison |
| `/api/flights` | GET, POST | Flight search |
| `/api/airports` | GET | Airport autocomplete |
| `/api/settling-in` | GET | Task list (arrived plans only) |
| `/api/settling-in/generate` | POST | Generate task DAG |
| `/api/settling-in/arrive` | POST | Confirm arrival (stage transition) |
| `/api/settling-in/[id]` | GET, PATCH, DELETE | Individual task operations |
| `/api/settling-in/[id]/why-it-matters` | GET | Task context enrichment |

---

## 3. Library Modules

### `lib/gomate/` — Core business logic

| File | Role |
|---|---|
| `profile-schema.ts` | Zod schema for 65+ field user profile |
| `state-machine.ts` | Interview state machine (`collecting/generating/complete/arrived`) |
| `plan-factory.ts` | Plan creation helpers |
| `system-prompt.ts` | Pre-arrival and post-arrival system prompt builders |
| `profile-summary.ts` | Formats profile for injection into prompts |
| `settling-in-generator.ts` | Settling-in task generation pipeline (Claude Sonnet 4 via OpenRouter) |
| `guide-generator.ts` | Guide content generation (static TypeScript logic — not AI-powered) |
| `pdf-generator.ts` | PDF rendering for guide download |
| `tier.ts` | `getUserTier()` — reads subscription tier from DB |
| `web-research.ts` | Research orchestration (Firecrawl + OpenAI) |
| `numbeo-scraper.ts` | Cost-of-living data scrape (Firecrawl, 15s timeout) |
| `checklist-generator.ts` | Requirement checklist generation |
| `flight-search.ts` | Flight search (Firecrawl, 30s timeout; mock results in UI) |
| `visa-checker.ts` | Static visa lookup |
| `visa-recommendations.ts` | Visa recommendation logic |
| `visa-advisor.ts` | Visa advisor (currently unused — imported nowhere) |
| `airports.ts` | Airport list (30 hardcoded entries; `airports.txt` never loaded) |
| `official-sources.ts` | Government source URL registry |
| `source-linker.ts` | Source attribution helpers |
| `country-flags.ts` | Country flag emoji map |
| `supabase-utils.ts` | Supabase query helpers |
| `index.ts` | Module re-exports |

### `lib/supabase/` — Database client

| File | Role |
|---|---|
| `client.ts` | Browser-side Supabase client |
| `server.ts` | Server-side Supabase client (Next.js Server Components) |
| `middleware.ts` | Session refresh middleware |

---

## 4. Components

### Custom components (36 total)

| Directory | Files | Purpose |
|---|---|---|
| `components/` | `budget-card.tsx`, `budget-plan-card.tsx`, `confetti.tsx`, `country-card.tsx`, `country-flag.tsx`, `compliance-alerts.tsx`, `compliance-timeline.tsx`, `cost-of-living-card.tsx`, `document-progress-card.tsx`, `empty-state.tsx`, `guide-section.tsx`, `info-card.tsx`, `interactive-document-checklist.tsx`, `local-requirements-card.tsx`, `page-header.tsx`, `plan-switcher.tsx`, `profile-details-card.tsx`, `profile-summary-card.tsx`, `settling-in-task-card.tsx`, `skeletons.tsx`, `source-card.tsx`, `stat-card.tsx`, `theme-provider.tsx`, `tier-gate.tsx`, `upgrade-modal.tsx`, `visa-research-card.tsx`, `visa-routes-card.tsx`, `visa-status-badge.tsx`, `arrival-banner.tsx`, `countdown-timer.tsx` | Feature components |
| `components/chat/` | `chat-message.tsx`, `chat-message-content.tsx`, `chat-message-list.tsx`, `chat-composer.tsx`, `chat-error-message.tsx`, `streaming-text.tsx`, `question-card.tsx`, `plan-review-card.tsx`, `typing-indicator.tsx` | Chat UI |
| `components/layout/` | `app-shell.tsx`, `bottom-nav.tsx` | App shell + nav (`bottom-nav.tsx` is dead code) |
| `components/booking/` | `airport-autocomplete.tsx`, `booking-search-form.tsx`, `details-drawer.tsx`, `result-card.tsx` | Booking UI |

### shadcn/ui components (18 total, in `components/ui/`)

`badge`, `button`, `card`, `checkbox`, `dialog`, `input`, `label`, `progress`, `select`, `separator`, `sheet`, `skeleton`, `slider`, `switch`, `tabs`, `toast`, `toaster`, `tooltip`

---

## 5. Database

### 5.1 Migration State

| File | Status | Content |
|---|---|---|
| `scripts/001_create_profiles.sql` | ✅ In repo + applied | Creates `profiles` table with Supabase GoTrue trigger |
| `scripts/002_create_relocation_plans.sql` | ✅ In repo + applied | Creates `relocation_plans` table |
| `scripts/003_create_checklist_progress.sql` | ✅ In repo + applied | Creates `checklist_progress` table |
| `scripts/004_*.sql` | ❌ MISSING | Gap in sequence — no file, no explanation. Contents incorporated into adjacent migrations. Do not create a 004 file. |
| `scripts/005_create_guides.sql` | ✅ In repo + applied | Creates `guides` table |
| `scripts/006_add_document_statuses.sql` | ✅ In repo + applied | Adds document_statuses to profiles |
| `scripts/007_add_guide_type.sql` | ✅ In repo + applied | Adds guide_type column |
| `scripts/008_create_subscriptions.sql` | ✅ In repo + applied | Creates `user_subscriptions` table |
| `scripts/009_add_plan_metadata.sql` | ✅ In repo + applied | Adds plan metadata columns |
| `scripts/010_settling_in_checklist.sql` | ✅ In repo + applied | Creates `settling_in_tasks` table |
| Migration 011 | ✅ Applied to Supabase | Phase 0: `settling_in_tasks` — `steps`, `documents_needed`, `cost` columns. **SQL file not in scripts/ directory — was applied directly.** |
| Migration 012 | ✅ Applied to Supabase | Phase 0: `relocation_plans` — `visa_research`, `local_requirements_research` columns. **SQL file not in scripts/ directory.** |
| Migration 013 | ✅ Applied to Supabase | Phase 0: `relocation_plans` — `document_statuses` column. **SQL file not in scripts/ directory.** |
| `scripts/014` | Reserved | Phase 3: plan switch RPC (if needed). Do not use for anything else. |
| **Next migration:** `015` | — | The next migration file to write is `scripts/015_*.sql` |

> **Note:** Migrations 011–013 were applied to the live Supabase database during Phase 0 but the corresponding `.sql` files were not committed to the `scripts/` directory. If you need to reconstruct them, the content is described in `docs/audit.md` section 5 (Three Critical Schema Gaps).

### 5.2 Core Tables

| Table | Created by | Purpose |
|---|---|---|
| `auth.users` | Supabase GoTrue (built-in) | User accounts |
| `profiles` | migration 001 | User profile data (name, avatar, metadata) |
| `relocation_plans` | migration 002 | User relocation scenarios (65-field profile JSONB, stage, status, research data) |
| `checklist_progress` | migration 003 | Document checklist completion (created but has no API — bypassed by `document_statuses`) |
| `guides` | migration 005 | AI-generated country guides |
| `user_subscriptions` | migration 008 | Subscription tier and expiry |
| `settling_in_tasks` | migration 010 | Post-arrival task graph nodes |

### 5.3 Stage Enum

The `relocation_plans.stage` column uses a text enum with exactly four values:

```
collecting → generating → complete → arrived
```

- `collecting`: User is in the chat interview, answering questions
- `generating`: Plan is locked; research pipeline is running
- `complete`: Research finished; pre-arrival mode
- `arrived`: User confirmed arrival; post-arrival mode active

`archived` is a **`plan.status`** value, not a `plan.stage` value. Do not confuse these.

### 5.4 Tier Enum

The `user_subscriptions.tier` column uses:

```
free | pro_single | pro_plus
```

- `free` — basic interview and dashboard only
- `pro_single` — one-time lifetime purchase; unlocks all pre-arrival features (visa research, guides, cost of living, booking, documents)
- `pro_plus` — recurring subscription; adds multiple plans, settling-in, compliance timeline, post-arrival chat

Checked via `getUserTier(userId)` in `lib/gomate/tier.ts`.

---

## 6. External Integrations

| Service | Purpose | Config location |
|---|---|---|
| **Supabase** | PostgreSQL database + GoTrue auth + RLS | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **OpenRouter** | Routes all LLM calls (OpenAI + Anthropic) | `OPENAI_BASE_URL=https://openrouter.ai/api/v1`, `OPENAI_API_KEY` |
| **GPT-4o** (via OpenRouter) | Pre-arrival chat, extraction | `app/api/chat/route.ts` — raw `fetch()` to OpenRouter |
| **GPT-4o-mini** (via OpenRouter) | Profile field extraction during chat | `app/api/chat/route.ts` |
| **Claude Sonnet 4** (via OpenRouter) | Settling-in task generation | `lib/gomate/settling-in-generator.ts` — model string: `anthropic/claude-sonnet-4-20250514` |
| **Firecrawl** | Web research (search + scrape) for visa, cost, flights | `FIRECRAWL_API_KEY` |
| **Vercel** | Hosting (serverless) | `VERCEL_OIDC_TOKEN` (auto-set in production) |

**Important:** All model strings that look like Anthropic model IDs (`anthropic/...`) route through OpenRouter via the `@ai-sdk/openai` adapter. Do not change this routing.

---

## 7. System Status at Phase 0 Completion

| System | Status | Key issue |
|---|---|---|
| Profile Schema | WORKING | — |
| Chat Engine | WORKING | — |
| Why-It-Matters Enrichment | WORKING | — |
| Interview State Machine | PARTIAL | `confirmed` state unreachable |
| Persistence Layer | PARTIAL | Migration 004 gap; 011–013 not committed |
| System Prompt Architecture | PARTIAL | `confirmed` handler missing |
| Visa Logic | PARTIAL | 3 parallel systems; ghost fields |
| Research Orchestration | PARTIAL | Self-HTTP pattern; partial success = "completed" |
| Cost of Living | PARTIAL | 2 parallel systems; live path effectively disabled |
| Source Fetch Layer | PARTIAL | No shared abstraction; in-memory cache non-functional |
| Extraction Layer | PARTIAL | No shared protocol; regex JSON parsing |
| Country / Destination Data | PARTIAL | `airports.txt` never loaded |
| Plans System | PARTIAL | Non-atomic plan switch; archived plans count against limit |
| Flight Search | PARTIAL | `Math.random()` for stop count; mock-only in UI |
| Checklist Generation | PARTIAL | Table created; no API |
| Reliability Contracts | PARTIAL | No retry anywhere; no circuit breaker |
| Auth and Sessions | PARTIAL | No password reset; open redirect; middleware silent-fail |
| End-to-End Flow | PARTIAL | No chat history; guide insert broken; race condition |
| Frontend / UI Layer | PARTIAL | Settings non-functional; booking always mock |
| Post-Arrival Stage | PARTIAL | Arrival works; no stage checks on downstream routes |
| Settling-In Persistence | PARTIAL | Core works; undocumented migration; task_key unpopulated |
| Settling-In Checklist Engine | PARTIAL | Generation works; no stage check; no auto-trigger |
| Task Graph & Dependency | PARTIAL | Lock computation works; no cycle detection |
| Task Completion via Chat | PARTIAL | Marker protocol works; no stage check |
| Compliance Timeline | PARTIAL | Renders correctly; dismissal not persisted |
| Guide Generation + PDF | BROKEN | PDF renders 4 fields as `undefined` for all users (P0) |
| Subscription System | BROKEN | Any user can self-upgrade for free (P0) |
| Job System | MISSING | Does not exist |
| Observability | MISSING | Does not exist |
| Artifact System | MISSING | Does not exist |

Full gap register: `docs/systems/master-index.md`

---

## 8. What Phase 0 Verified

Phase 0 confirmed the following columns are present in the live Supabase database:

**Migration 011** — `settling_in_tasks` table:
- `steps text[]`
- `documents_needed text[]`
- `cost text`

**Migration 012** — `relocation_plans` table:
- `visa_research jsonb`
- `local_requirements_research jsonb`

**Migration 013** — `relocation_plans` table:
- `document_statuses jsonb`

Verification method: Supabase REST API column existence check.
Completion date: 2026-02-28.

No application code was changed during Phase 0.

---

## 9. What Comes Next

**Phase 1 — P0 Security Fixes** (next to implement)

Fixes the two BROKEN systems and the two critical auth gaps:

1. Remove `PATCH /api/subscription` self-upgrade endpoint (`app/api/subscription/route.ts`)
2. Fix guide PDF schema key mismatch (`app/(app)/guides/[id]/page.tsx`)
3. Add `next` parameter validation to `/auth/callback` (`app/auth/callback/route.ts`)
4. Change middleware error catch to redirect instead of allow-through (`middleware.ts`)

Authority: `docs/build-protocol.md` (Phase 1 section)
Gate protocol: `docs/phase-implementation-protocol.md`
Current status: `docs/phase-status.md`
