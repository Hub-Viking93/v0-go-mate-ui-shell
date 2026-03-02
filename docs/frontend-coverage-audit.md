# Frontend Coverage Audit — GoMate
## Frontend Wiring Authority Document

---

## Section 1: Metadata

| Field | Value |
|---|---|
| **Repository name** | GoMate |
| **Branch / Commit hash** | N/A — repository is not under git version control at time of audit (see Assumption A-001) |
| **Audit date** | 2026-02-28 (ISO 8601) |
| **Auditor identity** | Claude Code (claude-sonnet-4-6) |
| **Frontend root path confirmed** | `/Users/axel/Desktop/GoMate/app/` (Next.js 16 App Router) |
| **Documentation paths scanned** | `/Users/axel/Desktop/GoMate/docs/`, `/Users/axel/Desktop/GoMate/CLAUDE.md`, `/Users/axel/Desktop/GoMate/docs/systems/master-index.md`, `/Users/axel/Desktop/GoMate/docs/build-protocol.md`, `/Users/axel/Desktop/GoMate/docs/audit.md`, `/Users/axel/Desktop/GoMate/docs/engineering-contract.md` |
| **Total Assumptions logged** | 5 (see Section 10) |
| **Frontend files analyzed** | 131 TypeScript/TSX files across app/, components/, lib/, hooks/ |

---

## Section 2: Contract Authority Declaration

> This document is the Frontend Wiring Authority Document for this system, produced under Frontend Coverage Map Standard Contract v2.0. It governs all frontend wiring decisions for the Phase Implementation Protocol Frontend Wiring Gate. All wiring actions performed during implementation must be traceable to entries in this document.

---

## Section 3: Executive Summary

### Phase and Capability Totals

| Metric | Value |
|---|---|
| **Total Phases discovered** | 6 (Phase 0 through Phase 5) |
| **Total capabilities discovered** | 23 |

### Coverage Breakdown

| Status | Count | Percentage |
|---|---|---|
| ✅ Covered | 0 | 0% |
| ⚠️ Partial | 6 | 26% |
| ❌ Missing | 0 | 0% |
| ➖ Foundation-Only / No UI Expected | 17 | 74% |

### Critical Frontend Gaps (All Partial or Missing)

| ID | Capability | Status |
|---|---|---|
| Phase 1 — 1.1 | Remove self-upgrade UI and handle POST /api/subscription removal | ⚠️ Partial |
| Phase 1 — 1.3 | Render complete guide content without empty/fallback sections | ⚠️ Partial |
| Phase 2 — 2.3 | Display pre-arrival locked state in settling-in page | ⚠️ Partial |
| Phase 5 — 5.1 | Persist compliance alert dismissal to localStorage | ⚠️ Partial |
| Phase 5 — 5.2 | Handle 429 rate-limit response in why-it-matters UI | ⚠️ Partial |
| Phase 5 — 5.3 | Remove hardcoded mock flag from booking page flight search | ⚠️ Partial |

### Total Assumptions: 5 (moderate — see Section 10)

### Audit Readiness Declaration

**READY FOR WIRING**

All 6 frontend gaps have explicit Wiring Actions defined. No capabilities are Missing. Zero Phases have been skipped. All 23 capabilities are classified. This document is complete and verified per the Audit Completion Verification Protocol (Section 12).

---

## Section 4: How to Use This Document

- This document is the **PRIMARY and BINDING** wiring authority for GoMate's frontend during the Phase Implementation Protocol.
- This document **MUST be used** as the governing reference for the Frontend Wiring Gate during Phases 1–5.
- All frontend wiring decisions must be traceable to entries in this document.
- Any capability not listed in this document must trigger a contract amendment before implementation begins.
- Foundation-Only capabilities (17 of 23) require no frontend action; they are listed for completeness and traceability.
- The 6 Partial capabilities in the Gap Backlog (Section 7) are the authoritative work list for the Frontend Wiring Gate.

---

## Section 5: Frontend Inventory

### 5.1 All Frontend Routes Discovered

| Route | File | Type | Description |
|---|---|---|---|
| `/` | `app/page.tsx` | Page | Landing / home page |
| `/(app)/dashboard` | `app/(app)/dashboard/page.tsx` | Protected Page | Plan overview, visa research, budget, documents, settling-in transition |
| `/(app)/chat` | `app/(app)/chat/page.tsx` | Protected Page | Pre-arrival interview and post-arrival AI assistant |
| `/(app)/guides` | `app/(app)/guides/page.tsx` | Protected Page | List of generated relocation guides |
| `/(app)/guides/[id]` | `app/(app)/guides/[id]/page.tsx` | Protected Page | Individual guide view with PDF download |
| `/(app)/documents` | `app/(app)/documents/page.tsx` | Protected Page | Document checklist and progress tracking |
| `/(app)/settling-in` | `app/(app)/settling-in/page.tsx` | Protected Page (Pro+) | Post-arrival task checklist with DAG |
| `/(app)/booking` | `app/(app)/booking/page.tsx` | Protected Page (Pro) | Flight booking search |
| `/(app)/settings` | `app/(app)/settings/page.tsx` | Protected Page | User settings and subscription management |
| `/auth/login` | `app/auth/login/page.tsx` | Auth Page | Login |
| `/auth/sign-up` | `app/auth/sign-up/page.tsx` | Auth Page | Registration |
| `/auth/sign-up-success` | `app/auth/sign-up-success/page.tsx` | Auth Page | Post-signup confirmation |
| `/auth/error` | `app/auth/error/page.tsx` | Auth Page | Auth error display |
| `/auth/callback` | `app/auth/callback/route.ts` | Route Handler | OAuth callback (Supabase) |

### 5.2 All API Routes Discovered

| Route | Methods | Description |
|---|---|---|
| `/api/chat` | POST | GPT-4o streaming chat with SSE, profile extraction, state machine |
| `/api/profile` | GET, PATCH | Fetch or update plan/profile; supports lock/unlock actions |
| `/api/plans` | GET, POST, PATCH | List, create, switch/rename/archive plans |
| `/api/guides` | GET, POST | Fetch or generate guides |
| `/api/guides/[id]` | GET, DELETE | Individual guide fetch and delete |
| `/api/documents` | GET | Document checklist status |
| `/api/research/trigger` | GET, POST | Trigger parallel research (visa, local reqs, checklist) |
| `/api/research/visa` | POST | Visa research (Firecrawl + Claude) |
| `/api/research/local-requirements` | POST | Local requirements research |
| `/api/research/checklist` | POST | Pre-arrival checklist generation |
| `/api/cost-of-living` | GET | Cost of living data (Numbeo) |
| `/api/flights` | POST | Flight search (currently hardcoded mock mode) |
| `/api/airports` | GET | Airport autocomplete |
| `/api/subscription` | GET, POST | Fetch subscription info; POST handles upgrade/downgrade (P0 vulnerability — POST to be removed in Phase 1) |
| `/api/settling-in` | GET | List settling-in tasks with stats |
| `/api/settling-in/generate` | POST | Generate settling-in task DAG |
| `/api/settling-in/[id]` | PATCH | Update individual task status |
| `/api/settling-in/[id]/why-it-matters` | POST | AI enrichment for task explanation |
| `/api/settling-in/arrive` | POST | Mark plan as arrived (stage transition) |

### 5.3 All Components Discovered

**Layout:**
`app-shell.tsx`, `bottom-nav.tsx`

**Chat:**
`chat-message.tsx`, `chat-message-list.tsx`, `chat-message-content.tsx`, `chat-composer.tsx`, `typing-indicator.tsx`, `question-card.tsx`, `plan-review-card.tsx`, `streaming-text.tsx`, `chat-error-message.tsx`

**Booking:**
`booking-search-form.tsx`, `airport-autocomplete.tsx`, `result-card.tsx`, `details-drawer.tsx`

**Data Display:**
`stat-card.tsx`, `profile-summary-card.tsx`, `profile-details-card.tsx`, `budget-card.tsx`, `budget-plan-card.tsx`, `cost-of-living-card.tsx`, `visa-research-card.tsx`, `visa-routes-card.tsx`, `visa-status-badge.tsx`, `local-requirements-card.tsx`, `document-progress-card.tsx`, `settling-in-task-card.tsx`, `compliance-timeline.tsx`, `compliance-alerts.tsx`, `guide-section.tsx`, `source-card.tsx`, `info-card.tsx`

**Navigation / UX:**
`plan-switcher.tsx`, `page-header.tsx`, `empty-state.tsx`, `arrival-banner.tsx`, `tier-gate.tsx` (with `FullPageGate`), `upgrade-modal.tsx`, `country-flag.tsx`, `country-card.tsx`, `countdown-timer.tsx`, `confetti.tsx`, `skeletons.tsx`, `theme-provider.tsx`

**UI Primitives (shadcn):**
`button`, `card`, `input`, `label`, `select`, `badge`, `tabs`, `sheet`, `dialog`, `tooltip`, `switch`, `slider`, `progress`, `checkbox`, `skeleton`, `separator`, `toast`, `toaster`

### 5.4 API Client Layer

All API calls originate directly from page components and feature components using native `fetch()`. No centralized API client module exists. Pattern: component-level `fetch("/api/...")` inside `useEffect` or event handlers.

Key patterns identified:
- Auth: Supabase session cookie forwarded automatically (Next.js server components + `createServerClient`)
- Error handling: Component-level try/catch with `res.ok` checks
- No shared retry wrapper currently (Phase 4 creates `fetchWithRetry`)

### 5.5 State Management Systems

| System | Mechanism | Notes |
|---|---|---|
| Profile / Plan data | React `useState` + re-fetch on action | No global store; fetched fresh per page load |
| Subscription tier | `hooks/use-tier.ts` (custom hook wrapping `fetch(/api/subscription)`) | Returns `tier`, `features`, `planCount`, `planLimit`, `refresh()` |
| Chat messages | React `useState` in `app/(app)/chat/page.tsx` | Client-only, no persistence |
| Settling-in tasks | React `useState` in `app/(app)/settling-in/page.tsx` | Fetched from API, updated via PATCH |
| Theme | `components/theme-provider.tsx` (React Context) | Light/dark mode |
| Toasts | `hooks/use-toast.ts` | Local state |
| Alert dismissal | React `useState(false)` in `compliance-alerts.tsx` | **BUG: not persisted — Phase 5 gap** |

### 5.6 Event Handling Systems

| System | Mechanism | File |
|---|---|---|
| Chat streaming | SSE via `ReadableStream` / `TransformStream` parsing OpenAI format | `app/api/chat/route.ts` + `app/(app)/chat/page.tsx` |
| Task marker detection | Regex parse of `[TASK_DONE:<id>]` in chat stream | `app/(app)/chat/page.tsx` |
| Task completion | PATCH `/api/settling-in/{taskId}` triggered by checkbox in `SettlingInTaskCard` | `components/settling-in-task-card.tsx` |
| Compliance alerts | `useEffect` polling `/api/settling-in` on component mount when `planStage === 'arrived'` | `components/compliance-alerts.tsx` |

---

## Section 6: Phase-by-Phase Coverage Matrix

---

### Phase 0 — Schema Integrity

**Phase type:** Foundation-Only / Infrastructure
**Purpose:** Create 3 missing database migration files that unblock all subsequent phases.
**UI Expected:** None.

---

#### Phase 0 — Capability 0.1: Create settling_in_tasks additional columns migration

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

**Notes:** Creates `scripts/011_add_settling_task_columns.sql` to add `steps text[]`, `documents_needed text[]`, `cost text` to `settling_in_tasks`. No frontend change. The `SettlingInTaskCard` already has `steps`, `documents_needed`, and `cost` fields in its TypeScript interface — the frontend is ready to render these fields once the columns exist.

---

#### Phase 0 — Capability 0.2: Create relocation_plans research columns migration

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

**Notes:** Creates `scripts/012_add_research_columns.sql` to add `visa_research`, `local_requirements_research` to `relocation_plans`. Frontend already renders visa research via `visa-research-card.tsx` and local requirements via `local-requirements-card.tsx`.

---

#### Phase 0 — Capability 0.3: Create relocation_plans document_statuses migration

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

**Notes:** Creates `scripts/013_add_document_statuses.sql` to add `document_statuses jsonb` to `relocation_plans`. Frontend `document-progress-card.tsx` renders document status. No frontend change required.

---

### Phase 1 — P0 Security Fixes

**Phase type:** Mixed — Security fixes with both backend and frontend impact
**Purpose:** Fix two P0 production blockers: self-upgrade vulnerability and guide PDF rendering failure. Also harden auth callback and middleware.
**UI Expected:** Yes — for capabilities 1.1 and 1.3.

---

#### Phase 1 — Capability 1.1: Disable self-upgrade UI and handle subscription endpoint removal

| Field | Value |
|---|---|
| **Coverage Status** | ⚠️ Partial |
| **UI entrypoint** | `/settings` → Subscription section → "Upgrade" / "Manage plan" button |
| **Component responsible** | `components/upgrade-modal.tsx` + `app/(app)/settings/page.tsx` |
| **API request used** | `POST /api/subscription` with `{ action: "upgrade", tier, billing_cycle }` — **this endpoint is removed in Phase 1** |
| **State update mechanism** | `onUpgradeComplete()` → `refreshTier()` in `use-tier` hook |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | **[WA-1.1-A]** In `upgrade-modal.tsx`, replace `handleUpgrade()` logic: instead of calling `POST /api/subscription`, display a user-visible message stating that plan activation requires manual verification (e.g., "Contact support to activate your plan"). Remove or disable the "Get Pro Single" and "Get Pro+" buttons. The note "Payment integration coming soon. Plans are activated immediately for early access users." already exists in the modal — expand it to explain the manual process. **[WA-1.1-B]** Optionally: verify that `handleDowngrade()` still calls `POST /api/subscription` with `{ action: "downgrade" }` — if Phase 1 removes the entire POST handler, this must also be updated or the downgrade path must be documented as deferred. |

**Evidence:** `upgrade-modal.tsx` line 48–56 calls `fetch("/api/subscription", { method: "POST", ... })`. After Phase 1 removes the POST handler, this will return 404/405. The current error handling only `console.error`s the failure — no user-visible error is shown. Settings page renders `UpgradeModal` correctly.

---

#### Phase 1 — Capability 1.2: Fix guide auto-generation schema key on plan lock

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None (backend API fix in `app/api/profile/route.ts:110-131`) |
| **Component responsible** | None — fix is in API route |
| **API request used** | None — internal PATCH handler change |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

**Notes:** The fix changes how the guide is stored when auto-generated during plan lock — using `guideToDbFormat()` instead of `sections: guideData.sections`. The frontend guide page (`guides/[id]/page.tsx`) already expects `guide.visa_section`, `guide.budget_section`, etc. and adds fallback defaults. After the backend fix stores data under the correct keys, the page will render real content automatically.

---

#### Phase 1 — Capability 1.3: Render complete guide content without empty/fallback sections

| Field | Value |
|---|---|
| **Coverage Status** | ⚠️ Partial |
| **UI entrypoint** | `/guides/[id]` — all tabs (Overview, Visa, Budget, Housing, Practical, Culture, Timeline, Checklist) |
| **Component responsible** | `app/(app)/guides/[id]/page.tsx` |
| **API request used** | `GET /api/guides/${id}` |
| **State update mechanism** | `setGuide(guideData)` via `useState` on fetch completion |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | **[WA-1.3-A]** After applying the Phase 1 backend fix (Capability 1.2), verify that `GET /api/guides/${id}` returns a guide with all section keys populated (`overview`, `visa_section`, `budget_section`, `housing_section`, `banking_section`, `healthcare_section`, `culture_section`, `timeline_section`, `checklist_section`). The page adds fallback defaults on lines 155–165; verify these fallbacks are no longer needed for any auto-generated guide after the fix. **[WA-1.3-B]** Ensure PDF generation via `downloadGuidePDF(guide)` receives fully-populated section data — verify by downloading a PDF post-fix and confirming no fields render as "undefined" or empty. No new code changes needed if the backend fix is correct; this is a verification wiring action. |

**Evidence:** `guides/[id]/page.tsx` lines 154–166 add fallback defaults for all sections. This proves the page is designed to handle missing sections gracefully, but users currently see empty guide content for auto-generated guides because the backend stores under the wrong key (`sections` instead of `visa_section`, etc.).

---

#### Phase 1 — Capability 1.4: Harden auth callback against open redirect

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — `app/auth/callback/route.ts` backend validation |
| **Component responsible** | None |
| **API request used** | None — GET handler internal change |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

**Notes:** Backend adds allowlist validation for `next` parameter. The `auth/error/page.tsx` already exists for error display. No frontend wiring change required.

---

#### Phase 1 — Capability 1.5: Fix middleware error catch to redirect to error page

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — `lib/supabase/middleware.ts` catch block change |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

**Notes:** `app/auth/error/page.tsx` already exists as the error destination. No frontend wiring change required.

---

### Phase 2 — Settling-In Stage Integrity

**Phase type:** Mixed — API enforcement with one frontend UX gap
**Purpose:** Add `plan.stage === 'arrived'` checks to all settling-in API routes and create DAG validator. One capability (2.3) requires frontend wiring.
**UI Expected:** Yes — for capability 2.3 only.

---

#### Phase 2 — Capability 2.1: Gate settling-in generation API behind arrived stage

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — `app/api/settling-in/generate/route.ts` internal change |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

**Notes:** The settling-in page will receive a 400 error if stage !== 'arrived' and user clicks "Generate checklist". See Capability 2.3 for the frontend UX response to this 400.

---

#### Phase 2 — Capability 2.2: Gate task completion API behind arrived stage

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — `app/api/settling-in/[id]/route.ts` PATCH internal change |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

**Notes:** `SettlingInTaskCard` handles PATCH errors via `onStatusChange` → re-throws → `settling-in/page.tsx` `handleStatusChange` shows error state. The error message from 400 response will surface generically. No additional wiring needed beyond capability 2.3's pre-arrival gate.

---

#### Phase 2 — Capability 2.3: Display pre-arrival locked state in settling-in page

| Field | Value |
|---|---|
| **Coverage Status** | ⚠️ Partial |
| **UI entrypoint** | `/settling-in` — main page for Pro+ users with non-arrived plans |
| **Component responsible** | `app/(app)/settling-in/page.tsx` |
| **API request used** | `GET /api/settling-in` (returns `{ tasks: [], stage, arrivalDate }` for non-arrived after Phase 2 fix) |
| **State update mechanism** | `setTasks`, `setArrivalDate`, `setGenerated` via `useState` |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | **[WA-2.3-A]** In `app/(app)/settling-in/page.tsx`, add detection for pre-arrival state. The `fetchTasks()` function receives `data.stage` from GET /api/settling-in after Phase 2. Add a `planStage` state variable and set it from `data.stage`. **[WA-2.3-B]** Add a pre-arrival empty state UI: when `planStage !== 'arrived'` and `!generated`, instead of rendering the "Generate checklist" button, render a locked/pending state card that says "Your settling-in checklist will be available once you confirm arrival. Visit your dashboard to confirm arrival." Include a link to `/dashboard`. This prevents the confusing generic "Failed to generate tasks" error that would appear after Phase 2 adds the stage check to the generate endpoint. |

**Evidence:** `settling-in/page.tsx` fetches `GET /api/settling-in` and checks `res.status === 403` but does not check `data.stage`. The "not yet generated" state (line 197) renders the "Generate checklist" button regardless of whether the user has arrived. After Phase 2, clicking "Generate checklist" for a pre-arrived Pro+ user will return 400, which shows "Something went wrong: Settling-in requires arrival" — a correct but unhelpful error. Proper UX requires a pre-arrival locked state instead.

---

#### Phase 2 — Capability 2.4: Create DAG cycle detection validator library

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — new file `lib/gomate/dag-validator.ts` |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

---

#### Phase 2 — Capability 2.5: Validate task DAG before persisting generated tasks

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — `app/api/settling-in/generate/route.ts` internal change |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

---

### Phase 3 — Data Integrity

**Phase type:** Foundation-Only / Infrastructure
**Purpose:** Atomic plan switching, race condition fix, and task_key population. All changes are backend-only.
**UI Expected:** None.

---

#### Phase 3 — Capability 3.1: Create atomic plan switch RPC in database

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

**Notes:** Creates `scripts/014_add_plan_switch_rpc.sql` with `switch_current_plan()` RPC. Frontend `plan-switcher.tsx` already calls `PATCH /api/plans` correctly.

---

#### Phase 3 — Capability 3.2: Execute atomic plan switch via RPC in API route

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — `app/api/plans/route.ts` internal change |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

**Notes:** `plan-switcher.tsx` calls `PATCH /api/plans` — no frontend change needed. The atomicity improvement is invisible to the frontend.

---

#### Phase 3 — Capability 3.3: Handle plan creation race condition in profile route

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — `app/api/profile/route.ts:29-48` internal change |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

---

#### Phase 3 — Capability 3.4: Populate task_key with deterministic slug on generation

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — `app/api/settling-in/generate/route.ts` internal change |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

---

### Phase 4 — Reliability Minimum

**Phase type:** Foundation-Only / Infrastructure
**Purpose:** Create shared fetch retry wrapper and apply it to all Firecrawl/external HTTP calls.
**UI Expected:** None.

---

#### Phase 4 — Capability 4.1: Create fetchWithRetry utility with timeout and exponential backoff

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — new file `lib/gomate/fetch-with-retry.ts` |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

---

#### Phase 4 — Capability 4.2: Replace Firecrawl calls with fetchWithRetry in settling-in generator

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — `lib/gomate/settling-in-generator.ts` internal change |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

---

#### Phase 4 — Capability 4.3: Apply fetchWithRetry to all other external HTTP calls

| Field | Value |
|---|---|
| **Coverage Status** | ➖ Foundation-Only / No UI Expected |
| **UI entrypoint** | None — backend API routes |
| **Component responsible** | None |
| **API request used** | None |
| **State update mechanism** | None |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | None Required |

---

### Phase 5 — UI Integrity

**Phase type:** Frontend — All three capabilities require UI wiring.
**Purpose:** localStorage dismissal persistence, rate-limit UX handling, and booking mock flag resolution.
**UI Expected:** Yes — all three capabilities.

---

#### Phase 5 — Capability 5.1: Persist compliance alert dismissal to localStorage

| Field | Value |
|---|---|
| **Coverage Status** | ⚠️ Partial |
| **UI entrypoint** | Dashboard (renders `ComplianceAlerts`) + Settling-in page — wherever `ComplianceAlerts` is rendered |
| **Component responsible** | `components/compliance-alerts.tsx` |
| **API request used** | `GET /api/settling-in` (used to fetch alerts data, no change) |
| **State update mechanism** | `useState(false)` for `dismissed` — **must be replaced with localStorage** |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | **[WA-5.1-A]** In `components/compliance-alerts.tsx`, replace the dismissed state initialization `const [dismissed, setDismissed] = useState(false)` with: `const [dismissed, setDismissed] = useState(() => localStorage.getItem('compliance-alerts-dismissed') === 'true')`. **[WA-5.1-B]** In the dismiss button `onClick` handler (`onClick={() => setDismissed(true)}`), also write to localStorage: `onClick={() => { setDismissed(true); localStorage.setItem('compliance-alerts-dismissed', 'true') }}`. **[WA-5.1-C]** Add a `useEffect` that clears the localStorage key when new alerts appear (e.g., when `alerts.length` changes from 0 to > 0 and a new compliance period starts), preventing stale dismissals. See `docs/build-protocol.md` Phase 5 for the exact const key: `'compliance-alerts-dismissed'`. |

**Evidence:** `compliance-alerts.tsx` line 35: `const [dismissed, setDismissed] = useState(false)`. Line 143/186: `onClick={() => setDismissed(true)}` — no localStorage write. After page reload or tab navigation, dismissed state resets to false and alerts reappear. The `useState` initial value does not read from localStorage.

---

#### Phase 5 — Capability 5.2: Handle 429 rate-limit response in why-it-matters UI

| Field | Value |
|---|---|
| **Coverage Status** | ⚠️ Partial |
| **UI entrypoint** | `/settling-in` → task card → "Why does this matter?" button |
| **Component responsible** | `components/settling-in-task-card.tsx` |
| **API request used** | `POST /api/settling-in/${task.id}/why-it-matters` |
| **State update mechanism** | `setWhyText(data.whyItMatters)` on success; `setWhyLoading(false)` on any failure (including 429) |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | **[WA-5.2-A]** In `components/settling-in-task-card.tsx`, in the `onClick` handler of the "Why does this matter?" button (lines 265–279), add explicit handling for HTTP 429: `if (res.status === 429) { setWhyText("You've reached your daily limit for this feature. Try again tomorrow."); return; }`. Currently `if (res.ok)` silently does nothing on 429 — the button reverts to its initial state with no user feedback. **[WA-5.2-B]** Add a `whyError` state (`const [whyError, setWhyError] = useState<string | null>(null)`) and render the error message below the "Why does this matter?" button when non-null. |

**Evidence:** `settling-in-task-card.tsx` lines 265–280: the onClick handler checks `if (res.ok)` to set `whyText`, but only calls `setWhyLoading(false)` in the finally block on any non-ok response. A 429 response causes the button to silently revert with no user feedback. Users cannot distinguish a rate-limit error from a transient failure.

---

#### Phase 5 — Capability 5.3: Remove hardcoded mock flag from booking page flight search

| Field | Value |
|---|---|
| **Coverage Status** | ⚠️ Partial |
| **UI entrypoint** | `/booking` — flight search form |
| **Component responsible** | `app/(app)/booking/page.tsx` |
| **API request used** | `POST /api/flights` with `useMock: true` hardcoded |
| **State update mechanism** | `setSearchResults(results)` — already handles `isMock` flag correctly |
| **Event wiring mechanism** | Not Applicable |
| **Wiring Actions required** | **[WA-5.3-A]** Evaluate whether the flight API integration is functional. If the real Skyscanner / Google Flights integration is working, remove `useMock: true` from `booking/page.tsx` line 82 (`body: JSON.stringify({ ..., useMock: true })`). **[WA-5.3-B]** If the flight API is not yet functional, document the booking page as v2-deferred in `docs/audit.md` under "Out of Scope for v1" and add a visible "Demo mode" banner on the booking page so users are not misled. The page already renders a "(Demo data)" badge when `searchResults.isMock` is true — verify this badge is visible and prominent. **[WA-5.3-C]** Remove `Math.random()` usage in `lib/gomate/flight-search.ts` for generating mock prices if the real integration is not activated — or ensure it is only used in mock mode (already gated by `useMock` flag). |

**Evidence:** `booking/page.tsx` line 82: `useMock: true` is hardcoded in the POST body. The `SearchResults` interface has an `isMock?: boolean` field, and the results list shows "(Demo data)" badge when `searchResults?.isMock` is true. The full UI (search form, filters, result cards, details drawer) exists and is functional for mock data.

---

## Section 7: Gap Backlog

All capabilities with ⚠️ Partial coverage status.

---

### Gap 1

| Field | Value |
|---|---|
| **Capability reference** | Phase 1 — Capability 1.1 |
| **Coverage Status** | ⚠️ Partial |
| **Gap description** | `upgrade-modal.tsx` calls `POST /api/subscription` with `{ action: "upgrade" }`. Phase 1 removes this POST handler entirely as a P0 security fix. After removal, the "Get Pro Single", "Get Pro+", and "Switch to Pro Single" buttons will silently fail (console.error only, no user-visible feedback). The "Downgrade" button may also break if the entire POST handler is removed. |
| **Required Wiring Action** | [WA-1.1-A]: Replace upgrade button `handleUpgrade()` logic — remove the POST /api/subscription call and display a static message directing users to contact support. [WA-1.1-B]: Verify downgrade path — if POST handler is fully removed, update or disable `handleDowngrade()` as well. |
| **Priority** | Critical (blocks Phase 1 security fix from being deployed cleanly — broken UI after backend change) |

---

### Gap 2

| Field | Value |
|---|---|
| **Capability reference** | Phase 1 — Capability 1.3 |
| **Coverage Status** | ⚠️ Partial |
| **Gap description** | Auto-generated guides (triggered on plan lock via `app/api/profile/route.ts`) store section data under the wrong schema key, causing the guide page to render empty fallback sections. The frontend adds defaults (`overview || {}`, `visa_section || {}`, etc.) so the page does not crash, but users see empty/placeholder guide content. This is caused by the backend using `sections: guideData.sections` instead of `guideToDbFormat()`. |
| **Required Wiring Action** | [WA-1.3-A]: After the Phase 1 backend fix, verify that guide sections render with real data, not fallback defaults. [WA-1.3-B]: Verify PDF download produces complete output. No new frontend code may be needed — this is a verification wiring action. |
| **Priority** | Critical (P0 — G-4.1-G in audit.md — guide PDF renders undefined fields for all users) |

---

### Gap 3

| Field | Value |
|---|---|
| **Capability reference** | Phase 2 — Capability 2.3 |
| **Coverage Status** | ⚠️ Partial |
| **Gap description** | The settling-in page (`/settling-in`) does not check `plan.stage` before rendering. A Pro+ user who has not yet confirmed arrival sees the "Generate checklist" button. After Phase 2 adds stage enforcement to `POST /api/settling-in/generate`, clicking this button returns 400 and the page shows "Something went wrong: Settling-in requires arrival" — a confusing and unhelpful error. The page should show a clear pre-arrival locked state with a link to confirm arrival on the dashboard instead. |
| **Required Wiring Action** | [WA-2.3-A]: Read `data.stage` from `GET /api/settling-in` response and store in local state. [WA-2.3-B]: Render a pre-arrival locked state card when `planStage !== 'arrived'` and `!generated`, replacing the "Generate checklist" button with an informational message and link to `/dashboard`. |
| **Priority** | Standard (not a P0, but required for acceptable UX after Phase 2 backend change) |

---

### Gap 4

| Field | Value |
|---|---|
| **Capability reference** | Phase 5 — Capability 5.1 |
| **Coverage Status** | ⚠️ Partial |
| **Gap description** | `compliance-alerts.tsx` uses `useState(false)` for the `dismissed` flag. This state is ephemeral — it resets on every page reload, route navigation, or tab open. Users who dismiss the compliance alerts see them reappear immediately after any navigation. The v1 target per `docs/build-protocol.md` Phase 5 is localStorage persistence. |
| **Required Wiring Action** | [WA-5.1-A]: Initialize `dismissed` from `localStorage.getItem('compliance-alerts-dismissed')`. [WA-5.1-B]: Write to localStorage on dismiss. [WA-5.1-C]: Clear localStorage entry when new alert cycle begins. |
| **Priority** | Standard (P1 in audit.md — G-10.3-A — dismissal not persisted) |

---

### Gap 5

| Field | Value |
|---|---|
| **Capability reference** | Phase 5 — Capability 5.2 |
| **Coverage Status** | ⚠️ Partial |
| **Gap description** | `settling-in-task-card.tsx` makes `POST /api/settling-in/${task.id}/why-it-matters` and only processes success responses (`if (res.ok)`). When Phase 5 adds rate limiting (HTTP 429 after 20 calls/day), the button silently reverts to its initial state with no user feedback. Users cannot tell whether the request failed due to a rate limit, a network error, or a server error. |
| **Required Wiring Action** | [WA-5.2-A]: Add explicit HTTP 429 handling — display "Daily limit reached. Try again tomorrow." [WA-5.2-B]: Add a `whyError` state and render the error message in the UI. |
| **Priority** | Standard (UX gap — users must understand why the feature stops working) |

---

### Gap 6

| Field | Value |
|---|---|
| **Capability reference** | Phase 5 — Capability 5.3 |
| **Coverage Status** | ⚠️ Partial |
| **Gap description** | `booking/page.tsx` line 82 hardcodes `useMock: true` in the POST to `/api/flights`. All flight search results are generated mock data, not real flight prices or availability. The booking functionality is complete in UI terms (search form, filters, results, details drawer, external booking link) but non-functional for real booking. Phase 5 requires evaluating whether to activate the real API or formally defer to v2 with a visible "Demo mode" label. |
| **Required Wiring Action** | [WA-5.3-A]: Evaluate flight API readiness. [WA-5.3-B]: If not functional, add prominent "Demo mode" banner and document as v2-deferred. [WA-5.3-C]: Remove `Math.random()` in mock data generation if mock mode stays, or activate real integration. |
| **Priority** | Standard (documented gap — booking is listed as PARTIAL in audit.md, gap G-4.4-A) |

---

## Section 8: Wiring Recipes

### Recipe 1: Reading from localStorage with SSR Safety (for WA-5.1-A)

```typescript
// Safe localStorage initialization in Next.js (avoids SSR mismatch)
const [dismissed, setDismissed] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('compliance-alerts-dismissed') === 'true'
})
```

### Recipe 2: Handling specific HTTP error codes in fetch (for WA-5.2-A)

```typescript
const res = await fetch(`/api/settling-in/${task.id}/why-it-matters`, { method: "POST" })
if (res.status === 429) {
  setWhyError("You've reached your daily limit (20/day). Try again tomorrow.")
  return
}
if (res.ok) {
  const data = await res.json()
  setWhyText(data.whyItMatters)
} else {
  setWhyError("Failed to load explanation. Please try again.")
}
```

### Recipe 3: Graceful upgrade modal with removed endpoint (for WA-1.1-A)

```typescript
// Instead of calling POST /api/subscription, show contact information
function handleUpgrade(tier: Tier) {
  // Phase 1: Self-service upgrade endpoint removed as a security measure.
  // Direct users to support for plan activation.
  alert("To activate your plan, please contact support at support@gomate.io or refresh your session if you have already arranged payment.")
}
```

---

## Section 9: Verification Plan

After all Wiring Actions are implemented during the Frontend Wiring Gate, verify as follows:

### Gap 1 Verification (WA-1.1)
1. Navigate to `/settings` as a free-tier user.
2. Click "Upgrade" button — verify UpgradeModal opens.
3. Click "Get Pro Single" — verify NO POST to `/api/subscription` is made (check Network tab). Verify a contact/info message is shown.
4. Click "Get Pro+" — same verification.
5. As a pro_plus user, click "Manage plan" → verify "Downgrade" does not call removed endpoint OR is disabled with explanation.

### Gap 2 Verification (WA-1.3)
1. Complete a profile interview and lock the plan (triggers guide auto-generation).
2. Navigate to `/guides` — verify a guide was created.
3. Open the guide — verify all tabs (Overview, Visa, Budget, Housing, Practical, Culture, Timeline, Checklist) show real content, not empty/placeholder defaults.
4. Click "Download PDF" — verify the PDF contains all sections with real data, no "undefined" text anywhere.

### Gap 3 Verification (WA-2.3)
1. Log in as a Pro+ user with `plan.stage = 'collecting'` (not arrived).
2. Navigate to `/settling-in`.
3. Verify a pre-arrival locked state is displayed — NOT the "Generate checklist" button.
4. Verify the locked state message explains that arrival confirmation is required.
5. Verify a link to `/dashboard` is present.
6. Confirm arrival on dashboard → navigate back to `/settling-in` → verify "Generate checklist" button now appears.

### Gap 4 Verification (WA-5.1)
1. Navigate to `/dashboard` or wherever ComplianceAlerts renders with an arrived plan that has overdue tasks.
2. Verify compliance alert banner appears.
3. Click the X dismiss button.
4. Reload the page — verify the banner does NOT reappear (localStorage persisted).
5. Open a new browser tab to the same page — verify banner also stays dismissed.
6. Clear localStorage manually: `localStorage.removeItem('compliance-alerts-dismissed')` in devtools.
7. Reload — verify banner reappears.

### Gap 5 Verification (WA-5.2)
1. Navigate to `/settling-in` as a Pro+ arrived user with tasks.
2. Expand a task card — click "Why does this matter?" for 20 different tasks.
3. On the 21st request (after backend rate limit is hit), verify the UI shows a human-readable message like "Daily limit reached. Try again tomorrow." — NOT a silent revert to the initial button state.

### Gap 6 Verification (WA-5.3)
1. Navigate to `/booking`.
2. If mock mode remains: verify "(Demo data)" badge or "Demo mode" banner is clearly visible.
3. Verify external booking links open to legitimate travel sites (not `#` or `undefined`).
4. If real API is activated: verify `useMock: true` is removed from `booking/page.tsx`, search returns real flight data, and no `Math.random()` is used for prices.

---

## Section 10: Assumption Log

### A-001
| Field | Value |
|---|---|
| **Assumption identifier** | A-001 |
| **Location** | Section 1 — Metadata, branch/commit hash |
| **Assumption made** | The GoMate repository is not under git version control. No commit hash is available for this audit. |
| **Reason assumption was necessary** | The `docs/frontend-coverage-map.md` contract requires a branch and commit hash. Checking the filesystem revealed no `.git` directory. |
| **Risk introduced** | No exact snapshot of the codebase at audit time can be recorded. If code changes after this audit, there is no reference hash to detect drift. |
| **Recommended action** | Initialize a git repository and tag a commit immediately after this audit is accepted. Reference that tag in all Phase implementation work. |

---

### A-002
| Field | Value |
|---|---|
| **Assumption identifier** | A-002 |
| **Location** | Section 6, Phase 1 — Capability 1.1 |
| **Assumption made** | The Phase 1 change removes the entire POST handler from `app/api/subscription/route.ts`, including both the upgrade action (`action: "upgrade"`) and the downgrade action (`action: "downgrade"`). |
| **Reason assumption was necessary** | `docs/build-protocol.md` Phase 1 says "Remove POST handler entirely" but the subscription route currently handles both upgrade and downgrade via POST with an `action` field. It is ambiguous whether downgrade should also be removed. |
| **Risk introduced** | If only the upgrade path is removed (not the entire POST handler), Wiring Action WA-1.1-B may not be needed. If the entire handler is removed, `handleDowngrade()` in `upgrade-modal.tsx` will also break. |
| **Recommended action** | Confirm with project owner: is the entire POST handler removed, or only the `action: "upgrade"` path? Update Wiring Actions 1.1-A and 1.1-B accordingly. |

---

### A-003
| Field | Value |
|---|---|
| **Assumption identifier** | A-003 |
| **Location** | Section 6, Phase 2 — Capability 2.3 |
| **Assumption made** | After Phase 2, `GET /api/settling-in` returns `data.stage` in its response body for non-arrived plans, making the `planStage` readable in the frontend without a separate profile fetch. |
| **Reason assumption was necessary** | `docs/build-protocol.md` Phase 2 says "GET /api/settling-in with pre-arrival stage returns `{ tasks: [], stage, arrivalDate }`". The current API response shape was not verified via code inspection — only the Phase specification was checked. |
| **Risk introduced** | If the Phase 2 backend change does not add `stage` to the GET response, WA-2.3-A would require an additional fetch to `/api/profile` to determine plan stage instead. |
| **Recommended action** | After Phase 2 backend implementation, verify the GET /api/settling-in response includes `stage` field. Update WA-2.3-A if the field name differs. |

---

### A-004
| Field | Value |
|---|---|
| **Assumption identifier** | A-004 |
| **Location** | Section 6, Phase 5 — Capability 5.2 |
| **Assumption made** | The rate limiting in Phase 5 for `POST /api/settling-in/{id}/why-it-matters` returns HTTP 429 (Too Many Requests) as its response code. |
| **Reason assumption was necessary** | `docs/build-protocol.md` Phase 5 says "rate-limited to 429 after 20 calls". This is consistent with REST conventions and is treated as authoritative. |
| **Risk introduced** | Low. HTTP 429 is the documented target per build-protocol. If a different status code were used, the error handling in WA-5.2-A would need updating. |
| **Recommended action** | None — accept the assumption. Confirm 429 is returned during Phase 5 verification. |

---

### A-005
| Field | Value |
|---|---|
| **Assumption identifier** | A-005 |
| **Location** | Section 5.1, Section 6 Phase 5 — Capability 5.3 |
| **Assumption made** | The flight API integration in `lib/gomate/flight-search.ts` and `app/api/flights/route.ts` is not yet functional with real data sources. The `useMock: true` flag is the intended production state until a real integration is activated. |
| **Reason assumption was necessary** | `docs/audit.md` classifies the Flight Search system (4.4) as PARTIAL with gap G-4.4-A (Math.random, hardcoded URL). `docs/build-protocol.md` Phase 5 says "if flight API functional, remove mock; else document for v2". Without running the code, the actual API integration status is unknown. |
| **Risk introduced** | If the real flight API is actually functional, WA-5.3-A resolution could be immediate (just remove `useMock: true`). This audit conservatively treats it as non-functional pending evaluation. |
| **Recommended action** | Evaluate `lib/gomate/flight-search.ts` and the flights API route to determine if the real integration works. Make the explicit v1/v2 decision as part of Phase 5. |

---

## Section 11: Summary Table — All 23 Capabilities

| ID | Capability Name | Phase | Status | Wiring Actions |
|---|---|---|---|---|
| 0.1 | Create settling_in_tasks columns migration | 0 | ➖ Foundation-Only | None Required |
| 0.2 | Create relocation_plans research columns migration | 0 | ➖ Foundation-Only | None Required |
| 0.3 | Create relocation_plans document_statuses migration | 0 | ➖ Foundation-Only | None Required |
| 1.1 | Disable self-upgrade UI and handle subscription endpoint removal | 1 | ⚠️ Partial | WA-1.1-A, WA-1.1-B |
| 1.2 | Fix guide auto-generation schema key on plan lock | 1 | ➖ Foundation-Only | None Required |
| 1.3 | Render complete guide content without empty/fallback sections | 1 | ⚠️ Partial | WA-1.3-A, WA-1.3-B |
| 1.4 | Harden auth callback against open redirect | 1 | ➖ Foundation-Only | None Required |
| 1.5 | Fix middleware error catch to redirect to error page | 1 | ➖ Foundation-Only | None Required |
| 2.1 | Gate settling-in generation API behind arrived stage | 2 | ➖ Foundation-Only | None Required |
| 2.2 | Gate task completion API behind arrived stage | 2 | ➖ Foundation-Only | None Required |
| 2.3 | Display pre-arrival locked state in settling-in page | 2 | ⚠️ Partial | WA-2.3-A, WA-2.3-B |
| 2.4 | Create DAG cycle detection validator library | 2 | ➖ Foundation-Only | None Required |
| 2.5 | Validate task DAG before persisting generated tasks | 2 | ➖ Foundation-Only | None Required |
| 3.1 | Create atomic plan switch RPC in database | 3 | ➖ Foundation-Only | None Required |
| 3.2 | Execute atomic plan switch via RPC in API route | 3 | ➖ Foundation-Only | None Required |
| 3.3 | Handle plan creation race condition in profile route | 3 | ➖ Foundation-Only | None Required |
| 3.4 | Populate task_key with deterministic slug on generation | 3 | ➖ Foundation-Only | None Required |
| 4.1 | Create fetchWithRetry utility with timeout and backoff | 4 | ➖ Foundation-Only | None Required |
| 4.2 | Replace Firecrawl calls with fetchWithRetry | 4 | ➖ Foundation-Only | None Required |
| 4.3 | Apply fetchWithRetry to all other external HTTP calls | 4 | ➖ Foundation-Only | None Required |
| 5.1 | Persist compliance alert dismissal to localStorage | 5 | ⚠️ Partial | WA-5.1-A, WA-5.1-B, WA-5.1-C |
| 5.2 | Handle 429 rate-limit response in why-it-matters UI | 5 | ⚠️ Partial | WA-5.2-A, WA-5.2-B |
| 5.3 | Remove hardcoded mock flag from booking page flight search | 5 | ⚠️ Partial | WA-5.3-A, WA-5.3-B, WA-5.3-C |

---

## Section 12: Audit Completion Verification

### Phase Coverage
- [x] All Phases present in documentation (Phase 0–5) are listed in the audit
- [x] No Phase has been skipped

### Capability Coverage
- [x] All capabilities within every Phase are listed in the audit (23 total)
- [x] No capability has been skipped

### Coverage Status
- [x] Every capability has been assigned a Coverage Status
- [x] Only statuses from the Section 7 taxonomy have been used (✅ Covered, ⚠️ Partial, ❌ Missing, ➖ Foundation-Only)
- [x] No capability has an undefined or blank Coverage Status

### Wiring Actions
- [x] Every Partial capability has at least one explicit Wiring Action (6 Partial capabilities, all with Wiring Actions)
- [x] Every Missing capability has at least one explicit Wiring Action (0 Missing capabilities)
- [x] No Partial or Missing capability is listed without Wiring Actions

### Gap Backlog
- [x] Gap Backlog contains all Partial capabilities (6 gaps listed)
- [x] Gap Backlog contains all Missing capabilities (none)
- [x] No gaps are absent from the Gap Backlog
- [x] No duplicate entries exist in the Gap Backlog

### Assumption Log
- [x] All Assumptions made during audit are logged in Section 10 (5 assumptions)
- [x] No hidden Assumptions exist
- [x] Each Assumption record is complete (identifier, location, assumption, reason, risk, action)

### Output File
- [x] `frontend-coverage-audit.md` contains all required sections (Sections 1–12)
- [x] No section is absent or incomplete
- [x] Contract Authority Declaration is present verbatim in Section 2
- [x] Audit readiness declaration is present in Executive Summary: **READY FOR WIRING**

---

**All checklist items pass. Audit is complete and verified.**

`frontend-coverage-audit.md` is the binding wiring authority for GoMate. Phase Implementation Protocol → Frontend Wiring Gate may proceed.

---

*Produced under Frontend Coverage Map Standard Contract v2.0 on 2026-02-28 by Claude Code (claude-sonnet-4-6).*
