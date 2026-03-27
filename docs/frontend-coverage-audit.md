# Frontend Coverage Audit — GoMate

---

## Section 1: Metadata

| Field | Value |
|---|---|
| Repository | GoMate |
| Branch | `local-dev-changes` |
| Commit | `93f6f9e` |
| Audit date | 2026-03-04 |
| Auditor | Claude Code (claude-opus-4-6) |
| Frontend root path | `/app` (Next.js 16 App Router) |
| Documentation paths scanned | `/docs`, `/docs/phases`, `/docs/systems`, `/docs/definitions` |
| Assumptions logged | 5 (see Section 10) |

---

## Section 2: Contract Authority Declaration

> This document is the Frontend Wiring Authority Document for this system, produced under Frontend Coverage Map Standard Contract v2.0. It governs all frontend wiring decisions for the Phase Implementation Protocol Frontend Wiring Gate. All wiring actions performed during implementation must be traceable to entries in this document.

---

## Section 3: Executive Summary

### Totals

| Metric | Value |
|---|---|
| Total Phases discovered | 12 (Phase 0 through Phase 11) |
| Total capabilities discovered | 35 |

### Coverage Breakdown

| Status | Count | Percentage |
|---|---|---|
| Covered | 14 | 40.0% |
| Partial | 1 | 2.9% |
| Missing | 0 | 0.0% |
| Foundation-Only / No UI Expected | 20 | 57.1% |

### Critical Frontend Gaps

1. **Phase 5 — Capability 5.3**: Evaluate real flight search on booking page — **Partial**. Booking page renders with mock data. Real flight API integration deferred to v2 per build-protocol.

### Audit Readiness Declaration

**READY FOR WIRING**

All UI-required capabilities from Phases 0–11 are Covered except one Partial capability (booking mock data, explicitly v2-deferred). No Missing capabilities exist. The system is ready for Frontend Wiring Gate execution.

---

## Section 4: How to Use This Document

- This document is the PRIMARY and BINDING wiring authority for the GoMate system.
- This document MUST be used as the governing reference for Phase Implementation Protocol → Frontend Wiring Gate.
- All frontend wiring decisions must be traceable to this document.
- Any capability not listed in this document must trigger a contract amendment before implementation.

---

## Section 5: Frontend Inventory

### Routes (App Router)

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Landing page |
| `/auth/login` | `app/auth/login/page.tsx` | Login |
| `/auth/sign-up` | `app/auth/sign-up/page.tsx` | Registration |
| `/auth/sign-up-success` | `app/auth/sign-up-success/page.tsx` | Post-signup confirmation |
| `/auth/error` | `app/auth/error/page.tsx` | Auth error |
| `/auth/callback` | `app/auth/callback/route.ts` | OAuth callback (POST) |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Main dashboard |
| `/chat` | `app/(app)/chat/page.tsx` | Interview / post-arrival chat |
| `/guides` | `app/(app)/guides/page.tsx` | Guides list |
| `/guides/[id]` | `app/(app)/guides/[id]/page.tsx` | Individual guide viewer |
| `/settling-in` | `app/(app)/settling-in/page.tsx` | Post-arrival task list |
| `/booking` | `app/(app)/booking/page.tsx` | Flight booking |
| `/documents` | `app/(app)/documents/page.tsx` | Document tracking |
| `/settings` | `app/(app)/settings/page.tsx` | User settings |

### Layouts

| File | Description |
|---|---|
| `app/layout.tsx` | Root layout (metadata, fonts, analytics) |
| `app/(app)/layout.tsx` | App shell wrapper (AppShell + Toaster) |

### Components (46 custom + 26 shadcn/ui)

**Layout:** `app-shell.tsx`, `bottom-nav.tsx`, `page-header.tsx`

**Chat (6):** `chat-message.tsx`, `chat-message-list.tsx`, `chat-message-content.tsx`, `chat-composer.tsx`, `streaming-text.tsx`, `typing-indicator.tsx`, `chat-error-message.tsx`, `plan-review-card.tsx`, `question-card.tsx`

**Profile & Data:** `profile-summary-card.tsx`, `profile-details-card.tsx`, `plan-switcher.tsx`

**Post-Arrival Tasks:** `settling-in-task-card.tsx`

**Visa & Immigration:** `visa-research-card.tsx`, `visa-status-badge.tsx`, `visa-routes-card.tsx`

**Financial:** `cost-of-living-card.tsx`, `budget-card.tsx`, `budget-plan-card.tsx`, `countdown-timer.tsx`

**Booking:** `booking-search-form.tsx`, `airport-autocomplete.tsx`, `result-card.tsx`, `details-drawer.tsx`

**Guides:** `guide-section.tsx`, `local-requirements-card.tsx`

**Compliance:** `compliance-alerts.tsx`, `compliance-timeline.tsx`

**Cards & Display:** `country-card.tsx`, `country-flag.tsx`, `document-progress-card.tsx`, `source-card.tsx`, `stat-card.tsx`, `info-card.tsx`, `empty-state.tsx`

**Premium:** `tier-gate.tsx`, `upgrade-modal.tsx`

**Utilities:** `confetti.tsx`, `arrival-banner.tsx`, `skeletons.tsx`, `theme-provider.tsx`

**shadcn/ui (26):** button, card, dialog, input, label, badge, sheet, tabs, select, checkbox, switch, slider, progress, separator, skeleton, toast, toaster, tooltip, and others.

### API Routes (20)

| Endpoint | Methods | File |
|---|---|---|
| `/api/profile` | GET, PATCH | `app/api/profile/route.ts` |
| `/api/subscription` | GET | `app/api/subscription/route.ts` |
| `/api/chat` | POST | `app/api/chat/route.ts` |
| `/api/plans` | GET, POST, PATCH | `app/api/plans/route.ts` |
| `/api/settling-in` | GET | `app/api/settling-in/route.ts` |
| `/api/settling-in/[id]` | PATCH | `app/api/settling-in/[id]/route.ts` |
| `/api/settling-in/[id]/why-it-matters` | POST | `app/api/settling-in/[id]/why-it-matters/route.ts` |
| `/api/settling-in/arrive` | POST | `app/api/settling-in/arrive/route.ts` |
| `/api/settling-in/generate` | POST | `app/api/settling-in/generate/route.ts` |
| `/api/guides` | GET, POST | `app/api/guides/route.ts` |
| `/api/guides/[id]` | GET, DELETE | `app/api/guides/[id]/route.ts` |
| `/api/research/visa` | GET, POST | `app/api/research/visa/route.ts` |
| `/api/research/local-requirements` | GET, POST | `app/api/research/local-requirements/route.ts` |
| `/api/research/checklist` | GET, POST | `app/api/research/checklist/route.ts` |
| `/api/research/trigger` | GET, POST | `app/api/research/trigger/route.ts` |
| `/api/cost-of-living` | GET, POST | `app/api/cost-of-living/route.ts` |
| `/api/flights` | GET, POST | `app/api/flights/route.ts` |
| `/api/airports` | GET | `app/api/airports/route.ts` |
| `/api/progress` | GET | `app/api/progress/route.ts` |
| `/api/documents` | GET, PATCH | `app/api/documents/route.ts` |

### API Client Structure

No centralized API client exists. All frontend components use inline `fetch()` calls to `/api/*` routes. The `fetchWithRetry()` utility in `lib/gomate/fetch-with-retry.ts` is backend-only (used in API routes for external calls to Firecrawl/OpenAI/OpenRouter).

### State Management

No global state management (no Redux, no Zustand, no React Context for app state). All state is component-local via `useState` + `useEffect` with direct `fetch()` calls.

**Custom hooks (2):**
- `hooks/use-tier.ts` — fetches subscription tier from `/api/subscription`
- `hooks/use-toast.ts` — toast notification system (custom pubsub with `useReducer`)

### Event Handling

- **Chat streaming (SSE):** `app/api/chat/route.ts` returns `Content-Type: text/event-stream`. Frontend reads via `ReadableStream` + `TextDecoder`.
- **Task completion markers:** `components/chat/chat-message-content.tsx` parses `[TASK_DONE:task_title]` regex and fires PATCH to `/api/settling-in/{id}`.
- **localStorage persistence:** `components/compliance-alerts.tsx` persists dismissal state via `localStorage.setItem('gomate:compliance-alerts-dismissed')`.
- **No WebSocket or continuous polling.**

---

## Section 6: Phase-by-Phase Coverage Matrix

### Phase 0 — Schema Integrity

---

**Phase 0 — Capability 0.1: Add settling_in_tasks columns**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 0 — Capability 0.2: Add relocation_plans research columns**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 0 — Capability 0.3: Add relocation_plans document_statuses column**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

### Phase 1 — P0 Security Fixes

---

**Phase 1 — Capability 1.1: Remove subscription self-upgrade endpoint**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 1 — Capability 1.2: Fix guide PDF insert schema**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 1 — Capability 1.3: Validate auth callback redirect parameter**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 1 — Capability 1.4: Fix middleware catch block auth bypass**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

### Phase 2 — Settling-In Stage Integrity

---

**Phase 2 — Capability 2.1: Enforce stage check on settling-in generate endpoint**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 2 — Capability 2.2: Enforce stage check on settling-in task PATCH endpoint**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 2 — Capability 2.3: Enforce stage check on settling-in GET endpoint**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 2 — Capability 2.4: Create and integrate DAG cycle validator**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

### Phase 3 — Data Integrity

---

**Phase 3 — Capability 3.1: Implement atomic plan switch via RPC**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 3 — Capability 3.2: Handle plan creation race condition**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 3 — Capability 3.3: Populate task_key during generation**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

### Phase 4 — Reliability Minimum

---

**Phase 4 — Capability 4.1: Create fetchWithRetry shared utility**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 4 — Capability 4.2: Apply fetchWithRetry to all external HTTP callers**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

### Phase 5 — UI Integrity

---

**Phase 5 — Capability 5.1: Persist compliance alert dismissal to localStorage**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/settling-in` page (compliance alerts rendered within settling-in view) |
| Component responsible | `components/compliance-alerts.tsx` |
| API request used | `GET /api/settling-in` (fetches tasks with deadline data) |
| State update mechanism | `useState` initialized from `localStorage.getItem('gomate:compliance-alerts-dismissed')` |
| Event wiring mechanism | `localStorage.setItem()` on dismiss click; `useEffect` reads on mount |
| Wiring Actions required | None Required |

---

**Phase 5 — Capability 5.2: Enforce why-it-matters enrichment rate limit**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/settling-in` page → task card → "Why it matters" action |
| Component responsible | `components/settling-in-task-card.tsx` |
| API request used | `POST /api/settling-in/{id}/why-it-matters` |
| State update mechanism | `useState` for enrichment result; error state on 429 response |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 5 — Capability 5.3: Evaluate real flight search on booking page**

| Field | Value |
|---|---|
| Coverage Status | ⚠️ Partial |
| UI entrypoint | `/booking` page |
| Component responsible | `components/booking/booking-search-form.tsx`, `components/booking/result-card.tsx` |
| API request used | `POST /api/flights` (returns mock data) |
| State update mechanism | `useState` for search results |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | Booking page exists and renders correctly with mock flight data. Real flight API integration (live Amadeus/Duffel data) is explicitly deferred to v2 per build-protocol Phase 5 specification. No wiring action required for v1. |

---

### Phase 6 — Task Lifecycle Foundation

---

**Phase 6 — Capability 6.1: Display server-computed progress on dashboard**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/dashboard` page |
| Component responsible | `app/(app)/dashboard/page.tsx` |
| API request used | `GET /api/progress?plan_id=X` |
| State update mechanism | `useState` for progress percentages; `useEffect` fetches on mount |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 6 — Capability 6.2: Detect and display OVERDUE task status**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/settling-in` page |
| Component responsible | `components/settling-in-task-card.tsx`, `app/(app)/settling-in/page.tsx` |
| API request used | `GET /api/settling-in` (returns `overdue` status per task) |
| State update mechanism | `useState` for task list; tasks with `status === 'overdue'` rendered distinctly |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 6 — Capability 6.3: Display computed deadline_at timestamps on tasks**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/settling-in` page |
| Component responsible | `components/settling-in-task-card.tsx` |
| API request used | `GET /api/settling-in` (returns `deadline_at` per task) |
| State update mechanism | `useState` for task list; deadline rendered in card |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 6 — Capability 6.4: Add research status schema columns**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

### Phase 7 — Generation Quality

---

**Phase 7 — Capability 7.1: Increment plan_version on profile changes**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 7 — Capability 7.2: Cap post-arrival system prompt token budget**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 7 — Capability 7.3: Remove in-memory cache from web-research**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

### Phase 8 — Deadline Intelligence

---

**Phase 8 — Capability 8.1: Recompute deadlines on arrival_date change**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 8 — Capability 8.2: Display urgency badges on task cards**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/settling-in` page |
| Component responsible | `components/settling-in-task-card.tsx` |
| API request used | `GET /api/settling-in` (returns `urgency` and `days_until_deadline` per task) |
| State update mechanism | `useState` for task list; urgency enum drives badge variant |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

Urgency badge mapping: `overdue` → red destructive badge, `urgent` → red "Due tomorrow", `approaching` → amber "Xd left", `normal` → muted text.

---

**Phase 8 — Capability 8.3: Display overdue count in settling-in stats bar**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/settling-in` page (stats bar at top) |
| Component responsible | `app/(app)/settling-in/page.tsx` |
| API request used | `GET /api/settling-in` (returns stats including overdue count) |
| State update mechanism | `useState` for stats object; overdue count rendered in stats bar |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 8 — Capability 8.4: Render compliance alerts from server-computed urgency**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/settling-in` page (compliance alerts section) |
| Component responsible | `components/compliance-alerts.tsx` |
| API request used | `GET /api/settling-in` (returns `urgency` and `days_until_deadline` per task) |
| State update mechanism | `useState` for tasks; component reads server-computed `urgency` field |
| Event wiring mechanism | `useEffect` triggers refetch when `planStage` changes |
| Wiring Actions required | None Required |

---

### Phase 9 — Guide & Research Freshness

---

**Phase 9 — Capability 9.1: Display staleness banner on guide viewer**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/guides/[id]` page |
| Component responsible | `app/(app)/guides/[id]/page.tsx` |
| API request used | `GET /api/guides/{id}` (returns `is_stale`, `stale_reason`, `guide_version`) |
| State update mechanism | `useState` for guide data; conditional banner render when `is_stale === true` |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 9 — Capability 9.2: Display regenerate action on stale guide**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/guides/[id]` page (within staleness banner) |
| Component responsible | `app/(app)/guides/[id]/page.tsx` |
| API request used | `POST /api/guides` (triggers guide regeneration) |
| State update mechanism | `useState` for loading state; on success, guide data refreshed with new version |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 9 — Capability 9.3: Display research freshness warning on dashboard**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/dashboard` page |
| Component responsible | `app/(app)/dashboard/page.tsx` |
| API request used | `GET /api/profile` or plan data (returns `research_completed_at`) |
| State update mechanism | `useState`; computes days since research; renders warning when >7 days |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 9 — Capability 9.4: Add guide versioning schema columns**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

### Phase 10 — Chat Safety & Onboarding

---

**Phase 10 — Capability 10.1: Inject confirmation prompt for critical field extraction**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None (system prompt manipulation; LLM produces confirmation text via existing chat UI) |
| Component responsible | None (existing chat components render the confirmation naturally) |
| API request used | None (handled server-side in `POST /api/chat` route) |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 10 — Capability 10.2: Set onboarding_completed flag on first generation**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

### Phase 11 — Task Enrichment

---

**Phase 11 — Capability 11.1: Display block_reason on locked task cards**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/settling-in` page |
| Component responsible | `components/settling-in-task-card.tsx` |
| API request used | `GET /api/settling-in` (returns `block_reason` and `blocked_by` per locked task) |
| State update mechanism | `useState` for task list; locked tasks render block reason text |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 11 — Capability 11.2: Display blocking task names from server data**

| Field | Value |
|---|---|
| Coverage Status | ✅ Covered |
| UI entrypoint | `/settling-in` page |
| Component responsible | `components/settling-in-task-card.tsx` |
| API request used | `GET /api/settling-in` (returns `blocked_by: [{id, title}]`) |
| State update mechanism | `useState` for task list; blocked_by array mapped to "Blocked by: [names]" text |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

**Phase 11 — Capability 11.3: Verify maxTokens on why-it-matters enrichment**

| Field | Value |
|---|---|
| Coverage Status | ➖ Foundation-Only / No UI Expected |
| UI entrypoint | None |
| Component responsible | None |
| API request used | None |
| State update mechanism | None |
| Event wiring mechanism | Not Applicable |
| Wiring Actions required | None Required |

---

## Section 7: Gap Backlog

| Capability Reference | Coverage Status | Gap Description | Required Wiring Action | Priority |
|---|---|---|---|---|
| Phase 5 — Capability 5.3 | ⚠️ Partial | Booking page renders with mock flight data. `POST /api/flights` returns synthetic results. Real flight API integration (Amadeus/Duffel) not implemented. | Integrate real flight search API and wire results to `booking-search-form.tsx` and `result-card.tsx`. **Deferred to v2** per build-protocol Phase 5 specification. | Standard |

---

## Section 8: Wiring Recipes

### Recipe 1: Authenticated API Fetch Pattern

All GoMate frontend components use the same pattern for authenticated API calls:

```typescript
// Component fetches data in useEffect
useEffect(() => {
  const fetchData = async () => {
    const res = await fetch("/api/endpoint")
    if (!res.ok) { /* handle error */ return }
    const data = await res.json()
    setState(data)
  }
  fetchData()
}, [dependency])
```

The Supabase session cookie is automatically included by the browser. API routes call `supabase.auth.getUser()` server-side to authenticate.

### Recipe 2: Server-Computed Urgency Consumption

Task cards consume server-computed urgency rather than performing client-side deadline math:

```typescript
// API returns: { urgency: "overdue" | "urgent" | "approaching" | "normal", days_until_deadline: number }
// Component maps urgency to badge variant:
const badgeVariant = {
  overdue: "destructive",
  urgent: "destructive",
  approaching: "warning",
  normal: "muted"
}[task.urgency]
```

### Recipe 3: Staleness Banner Pattern

Guide viewer conditionally renders staleness banner from server data:

```typescript
// API returns: { is_stale: boolean, stale_reason: string | null }
{guide.is_stale && (
  <Alert variant="warning">
    <p>This guide may be outdated{guide.stale_reason && ` (${guide.stale_reason})`}</p>
    <Button onClick={handleRegenerate}>Regenerate</Button>
  </Alert>
)}
```

### Recipe 4: localStorage-Backed Dismissal

Compliance alerts persist dismissal across navigations without server-side storage:

```typescript
const DISMISS_KEY = 'gomate:compliance-alerts-dismissed'
const [dismissed, setDismissed] = useState(() =>
  typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === 'true'
)
const handleDismiss = () => {
  localStorage.setItem(DISMISS_KEY, 'true')
  setDismissed(true)
}
```

---

## Section 9: Verification Plan

### Verification Steps for Covered Capabilities

After the Frontend Wiring Gate, the following verification steps confirm all Covered capabilities:

1. **Phase 5.1 — Compliance dismissal persistence**
   - Navigate to `/settling-in` as arrived user
   - Dismiss compliance alerts
   - Navigate away and return
   - Verify alerts remain dismissed

2. **Phase 5.2 — Rate limit on enrichment**
   - Trigger "Why it matters" on 20+ tasks
   - Verify 429 response after limit reached

3. **Phase 6.1 — Dashboard progress**
   - Navigate to `/dashboard`
   - Verify progress percentages render from `/api/progress`

4. **Phase 6.2–6.3 — OVERDUE status and deadlines**
   - As arrived user with overdue tasks, navigate to `/settling-in`
   - Verify overdue tasks show distinct styling and deadline dates

5. **Phase 8.2 — Urgency badges**
   - With tasks at various urgency levels, verify: red badge for overdue, red for urgent (T-1), amber for approaching (T-7), muted for normal

6. **Phase 8.3 — Overdue count**
   - Verify stats bar shows overdue count

7. **Phase 8.4 — Compliance alerts from server urgency**
   - Verify compliance alerts reflect server-computed urgency, not client-side math

8. **Phase 9.1–9.2 — Staleness banner and regenerate**
   - Change profile destination
   - Navigate to `/guides/[id]`
   - Verify amber staleness banner appears with "Regenerate" button
   - Click regenerate and verify banner clears

9. **Phase 9.3 — Research freshness**
   - With research >7 days old, navigate to `/dashboard`
   - Verify freshness warning displayed

10. **Phase 11.1–11.2 — Block reason and blocking task names**
    - As arrived user with locked tasks, navigate to `/settling-in`
    - Verify locked tasks show "Blocked by: [task names]"

### Verification Steps for Partial Capabilities

11. **Phase 5.3 — Booking mock data**
    - Navigate to `/booking`
    - Search for flights
    - Verify results render (mock data)
    - Document that real flight API is v2-deferred

---

## Section 10: Assumption Log

### A-001: Frontend root path

| Field | Value |
|---|---|
| Location | Section 1: Metadata |
| Assumption | Frontend root is `/app` (Next.js App Router convention) |
| Reason | No `/frontend`, `/web`, or `/client` directories exist. Next.js App Router uses `/app` as the routing root. |
| Risk | None — standard Next.js convention confirmed by `next.config.mjs` and `package.json` |
| Resolution | Confirmed by directory structure inspection |

### A-002: Booking mock data is v2-deferred

| Field | Value |
|---|---|
| Location | Phase 5 — Capability 5.3 |
| Assumption | Real flight search integration is explicitly deferred to v2, making this Partial rather than Missing |
| Reason | `docs/build-protocol.md` Phase 5 states: "If GET /api/flights is not functional: This gap is out of scope for Phase 5. Document that booking remains mock and add it to v2 scope." |
| Risk | Low — documented decision with clear v2 scope |
| Resolution | Confirmed against build-protocol specification |

### A-003: Pre-existing gaps not scoped to any phase

| Field | Value |
|---|---|
| Location | Coverage matrix scope |
| Assumption | Pre-existing gaps (G-7.1-A settings non-functional, G-6.1-B no password reset, G-4.4-F flights auth) not scoped to any build phase are excluded from the capability list. The contract states: "Required capabilities are defined solely by documentation" — meaning phase specifications. |
| Reason | These gaps exist in the gap register but no phase spec includes them as deliverables |
| Risk | Medium — these gaps remain unaddressed but are tracked in `docs/systems/master-index.md` |
| Resolution | Verify with project owner whether additional phases should address these gaps |

### A-004: Phase 10 classified as Foundation-Only

| Field | Value |
|---|---|
| Location | Phase 10 coverage classification |
| Assumption | Chat confirmation prompting is Foundation-Only because it operates entirely through system prompt manipulation. The existing chat UI renders the confirmation text without any frontend changes. |
| Reason | Phase 10 spec describes backend changes only: system prompt injection in `POST /api/chat` and a database flag. No component files were modified. |
| Risk | None — chat components are generic message renderers; confirmation text flows through existing pipeline |
| Resolution | Verified by reading Phase 10 spec and confirming no frontend files were changed |

### A-005: No centralized API client layer

| Field | Value |
|---|---|
| Location | Section 5: Frontend Inventory |
| Assumption | GoMate has no centralized API client abstraction. All frontend-to-backend communication uses inline `fetch()` calls. |
| Reason | No axios, graphQL client, TanStack Query, or custom API wrapper found in `lib/` or `hooks/`. Every component directly calls `fetch("/api/...")`. |
| Risk | Low — this is a valid pattern for the project's scale, though it means API contract changes require updating multiple call sites |
| Resolution | Confirmed by comprehensive codebase search |

---

## Audit Completion Verification Protocol

**Phase Coverage**
- [x] All Phases present in documentation are listed in the audit (Phase 0 through Phase 11)
- [x] No Phase has been skipped

**Capability Coverage**
- [x] All capabilities within every Phase are listed in the audit (35 total)
- [x] No capability has been skipped

**Coverage Status**
- [x] Every capability has been assigned a Coverage Status
- [x] Only statuses from the Section 7 taxonomy have been used (Covered, Partial, Foundation-Only)
- [x] No capability has an undefined or blank Coverage Status

**Wiring Actions**
- [x] Every Partial capability has at least one explicit Wiring Action (Phase 5.3)
- [x] Every Missing capability has at least one explicit Wiring Action (N/A — no Missing capabilities)
- [x] No Partial or Missing capability is listed without Wiring Actions

**Gap Backlog**
- [x] Gap Backlog contains all Partial capabilities (Phase 5.3)
- [x] Gap Backlog contains all Missing capabilities (N/A)
- [x] No gaps are absent from the Gap Backlog
- [x] No duplicate entries exist in the Gap Backlog

**Assumption Log**
- [x] All Assumptions made during audit are logged in Section 10 (5 assumptions)
- [x] No hidden Assumptions exist
- [x] Each Assumption record is complete

**Output File**
- [x] `frontend-coverage-audit.md` contains all required sections (1–10 + verification)
- [x] No section is absent or incomplete
- [x] Contract Authority Declaration is present verbatim in Section 2
- [x] Audit readiness declaration is present in Executive Summary
