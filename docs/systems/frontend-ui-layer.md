# Frontend / UI Layer — System Document

**Phase:** 7.1
**Status:** Reality-first
**Primary sources:**
- `components/layout/app-shell.tsx` (170 lines) — shell, navigation, sign-out
- `components/layout/bottom-nav.tsx` (49 lines) — unused mobile nav component
- `components/tier-gate.tsx` (354 lines) — feature gating
- `app/(app)/dashboard/page.tsx` (1044 lines)
- `app/(app)/chat/page.tsx` (830 lines)
- `app/(app)/guides/page.tsx` (263 lines)
- `app/(app)/documents/page.tsx` (605 lines)
- `app/(app)/settings/page.tsx` (341 lines)
- `app/(app)/booking/page.tsx` (452 lines)
- `app/api/documents/route.ts` (91 lines)
**Last audited:** 2026-02-25

---

## 1. Overview

The GoMate frontend is a Next.js App Router application using React 19. All `(app)/` pages are client components (`"use client"`). The layout wraps all protected pages in `AppShell`, which provides navigation and sign-out. Feature access is gated at the component level using `TierGate` and `FullPageGate`.

This document covers: navigation shell, each page's data flow and client state, the tier-gate system, and the document status system.

---

## 2. Navigation Shell — `AppShell`

`components/layout/app-shell.tsx` renders the full application chrome.

### 2.1 Structure

```
AppShell
├── Desktop sidebar (lg+, fixed 72px wide)
│   ├── Logo → /dashboard
│   ├── Navigation items (5)
│   ├── Country Guides link → external gomaterelocate.com
│   └── Sign out button
├── Mobile header (<lg)
│   └── Logo only
├── <main> content area
│   └── {children}
└── Mobile bottom navigation (<lg)
    └── Same 5 items as sidebar
```

### 2.2 Navigation Items

| Label | Route | Icon |
|---|---|---|
| Dashboard | `/dashboard` | LayoutDashboard |
| Chat | `/chat` | MessageSquare |
| Guides | `/guides` | BookOpen |
| Booking | `/booking` | Plane |
| Settings | `/settings` | Settings |

Active state: `pathname === item.href || pathname.startsWith(item.href + "/")`

### 2.3 Sign-Out

Sign-out is implemented in `AppShell`:

```typescript
const handleSignOut = async () => {
  const supabase = createClient()
  await supabase.auth.signOut()
  router.push("/auth/login")
}
```

Sign-out calls `supabase.auth.signOut()` (browser client), then navigates to `/auth/login`. **Correction to Phase 6.1 G-6.1-A**: sign-out is implemented in `AppShell`. The Phase 6.1 gap was based on incomplete search — it only checked `auth/` pages and API routes. The sign-out is reachable from every protected page via the sidebar (desktop) or settings navigation.

### 2.4 Unused Component

`components/layout/bottom-nav.tsx` (49 lines) renders an identical mobile bottom nav. It is never imported anywhere — `AppShell` renders its own mobile nav inline. `BottomNav` is dead code.

---

## 3. Feature Gating — `TierGate` and `FullPageGate`

`components/tier-gate.tsx` implements client-side feature access control.

### 3.1 Feature Matrix (Client Copy)

The `TIER_FEATURES` matrix in `tier-gate.tsx` is a **duplicate** of the matrix in `lib/gomate/tier.ts`. These two copies must be kept in sync manually.

| Feature | Free | Pro | Pro+ |
|---|---|---|---|
| chat | ✓ | ✓ | ✓ |
| visa_recommendation | — | ✓ | ✓ |
| local_requirements | — | ✓ | ✓ |
| cost_of_living | — | ✓ | ✓ |
| budget_planner | — | ✓ | ✓ |
| guides | — | ✓ | ✓ |
| documents | — | ✓ | ✓ |
| booking | — | ✓ | ✓ |
| plan_switcher | — | — | ✓ |
| post_relocation | — | — | ✓ |
| compliance_alerts | — | — | ✓ |
| post_arrival_assistant | — | — | ✓ |

**Gap:** `tier-gate.tsx` and `lib/gomate/tier.ts` define identical feature matrices independently. A change to one does not update the other. The server checks and client checks can diverge silently.

### 3.2 TierGate

Wraps content sections. If the user lacks access, renders a blurred/overlay version with an upgrade CTA:

- `variant="overlay"` (default): blurs children 6px, overlays an upgrade card
- `variant="card"`: replaces content with a bordered card CTA
- `variant="inline"`: inline pill with lock icon

### 3.3 FullPageGate

Gates entire pages. If the user lacks access, renders a centered lock-icon + upgrade CTA instead of `children`. Used on:
- `/documents` — requires `documents` (Pro+)
- `/booking` — requires `booking` (Pro+)
- `/guides` — requires `guides` (Pro+)

### 3.4 Tier Data Source — `useTier` Hook

Pages read the current tier from a `useTier` hook (not read in this phase). This hook fetches `GET /api/subscription` to get current tier, plan count, plan limit, and feature access.

---

## 4. Dashboard Page — `/dashboard`

`app/(app)/dashboard/page.tsx` (1044 lines). The most complex page in the frontend.

### 4.1 Data Fetching

On mount, three parallel fetches:

```typescript
const [planRes, guidesRes, docsRes] = await Promise.all([
  fetch("/api/profile"),       // → plan + profile_data + visa_research + local_requirements
  fetch("/api/guides"),        // → user's guides
  fetch("/api/documents"),     // → document_statuses + checklist_items
])
```

`/api/profile` response is used to also extract `visa_research`, `local_requirements_research`, and `research_status` from the plan — these undocumented JSONB columns are read directly from the plan object.

### 4.2 Onboarding Gate

If `filledCount < 3` (fewer than 3 profile fields filled), the page renders a welcome screen with a "Start planning" link to `/chat` instead of the full dashboard.

### 4.3 Client-Side Data Generation

The dashboard generates several data structures client-side from the profile, independently of the backend services:

**Budget data:** `generateBudgetFromProfile(profile, monthsUntilMove)` — hardcoded cost multipliers per destination keyword (Switzerland 1.5×, Portugal 0.7×, Japan 1.2×, etc.). This is a **separate, client-only budget calculation** from `calculateMonthlyBudget()` in `lib/gomate/web-research.ts`.

**Visa data:** `generateVisaDataFromProfile(profile)` draws from a client-side `VISA_DATABASE` constant with entries for Japan, Germany, United Kingdom, Singapore. This is a **separate, client-only visa database** from `lib/gomate/visa-recommendations.ts`.

**Document items:** `generateDocumentItems(profile)` — minimal hardcoded list. This is the **first of three independent document list functions** in the frontend (see Section 6.3).

### 4.4 Plan Lock / Unlock

Lock and unlock are performed directly from the dashboard header via `PATCH /api/profile`. On success, `setPlan(data.plan)` updates local state. Plan switch calls `window.location.reload()`.

### 4.5 Research Status Banner

Two banners conditionally rendered based on `researchStatus`:
- `"in_progress"` → spinner + "Researching your relocation requirements..."
- `"failed"` → alert + "You can manually trigger research from the visa and requirements sections below."

This is the only place in the UI where research failure is partially surfaced to the user. However, partial failures (where some sub-routes succeeded and `research_status` is `"completed"`) are invisible.

### 4.6 "Suggested Guide" External Link

The dashboard renders a "Suggested Guide" section that links to:
```
https://www.gomaterelocate.com/country-guides/{destination.toLowerCase().replace(/\s+/g, "-")}
```
This is an external link to `gomaterelocate.com`, not an in-app resource. The in-app guide (in `guides` table) is only shown if the plan is locked and a guide exists.

---

## 5. Chat Page — `/chat`

`app/(app)/chat/page.tsx` (830 lines). Wrapped in `<Suspense>` for `useSearchParams()`.

### 5.1 State

All conversation and profile state is client-only (React `useState`). Nothing is persisted except what `POST /api/chat` saves to Supabase via `saveProfileToSupabase()`.

| State | Type | Description |
|---|---|---|
| `messages` | `Message[]` | Full conversation history |
| `profile` | `Profile` | Current profile state |
| `interviewState` | `"interview"\|"review"\|"confirmed"\|"complete"` | Chat phase |
| `pendingField` | `AllFieldKey \| null` | Next field to collect |
| `filledFields` | `AllFieldKey[]` | Filled field keys |
| `planLocked` | `boolean` | Whether DB plan is locked |
| `planId` | `string \| null` | Current plan ID (for research trigger) |

### 5.2 Profile Load on Mount

`useEffect` calls `GET /api/profile` and:
- Sets `planId`
- If locked: sets `interviewState = "complete"` and `planLocked = true`
- If not locked: recomputes required/filled fields, sets next pending field

### 5.3 Message Send Flow

Per `sendMessage()`:
1. Append user message to `messages`
2. `POST /api/chat` with full message array + current profile + confirmed flag
3. Read `X-GoMate-Profile`, `X-GoMate-State`, `X-GoMate-Pending-Field`, `X-GoMate-Filled-Fields` response headers
4. Read SSE stream: accumulate `text-delta` events into `streamingContent`
5. On `message-end`: update profile, state, pendingField, filledFields, officialSources, visaStatus, planLocked, profileSummary, visaRecommendation, budget, savings from `metadata`
6. Add final assistant message to `messages`

### 5.4 Research Trigger from Chat

Research is fired from `handleConfirm()` — when the user clicks "Looks good, generate plan":

```typescript
fetch("/api/research/trigger", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ planId }),
}).catch(err => {
  console.error("[GoMate] Failed to trigger research:", err)
})
```

This is **fire-and-forget** — the `.catch()` handles failure silently. The research results are not awaited. The user is not notified of success or failure from this call.

### 5.5 Field Deeplink

`/chat?field=X&label=Y` triggers asking about a specific profile field. The URL params cause an assistant message to be prepended asking about that field, and `pendingField` is set to `X`. This path is used by the dashboard's profile card "click to update" feature.

### 5.6 Quick-Send Buttons

Context-sensitive quick-reply buttons appear below the input when `pendingField` matches specific keys:

| Pending field | Quick options |
|---|---|
| `moving_alone` | "Moving alone", "With partner", "With family" |
| `purpose` | "Study", "Work", "Settle", "Digital Nomad" |
| `study_type` | "University", "Language School", "Vocational" |
| `job_offer` | "Have offer", "Still looking", "In progress" |
| `healthcare_needs` | "None", "Chronic condition" |
| `pets` | "No pets", "Dog", "Cat" |
| `need_budget_help` | "Yes, help me", "No thanks" |
| `visa_rejections` | "No rejections", "Had rejection" |
| `special_requirements` | "None", "Accessibility", "Dietary" |

When `interviewState === "complete"` or `planLocked`, smart context suggestions replace field buttons ("Best neighborhoods", "Rent costs", "Job market", etc.).

### 5.7 Confetti

`<Confetti>` fires once when `progressPercent === 100 && !planLocked && interviewState === "review"` — the first time the profile reaches 100% completion. `confettiShown` flag prevents repeat fires.

---

## 6. Documents Page — `/documents`

`app/(app)/documents/page.tsx` (605 lines). Gated by `FullPageGate` (requires `documents` feature).

### 6.1 Data Fetching

Three parallel fetches on mount:
- `GET /api/profile` → profile data, plan ID
- `GET /api/documents` → document completion statuses (`document_statuses` JSONB)
- `GET /api/research/checklist` → cached AI-generated checklist

### 6.2 Document Status Storage

Document completion status is stored in `relocation_plans.document_statuses` (a JSONB column) via `PATCH /api/documents`. This column is **not in any SQL migration** and **not in the `RelocationPlan` TypeScript interface**.

**The `checklist_progress` table (migration 003) is completely bypassed.** The `app/api/documents/route.ts` handler reads and writes `document_statuses` on `relocation_plans` instead. No row is ever written to `checklist_progress`.

```typescript
// app/api/documents/route.ts — writes to relocation_plans.document_statuses
const newStatuses = {
  ...currentStatuses,
  [documentId]: { completed, completedAt: ... }
}
await supabase.from("relocation_plans").update({ document_statuses: newStatuses })
```

### 6.3 Three Independent Document List Implementations

The codebase has three separate client-side functions that generate document checklists independently:

| Location | Function | Basis |
|---|---|---|
| `app/(app)/dashboard/page.tsx` | `generateDocumentItems(profile)` | 4–7 items, minimal |
| `app/(app)/documents/page.tsx` | `generateDocumentChecklist(profile)` | 15–20 items, destination-specific (Germany, Netherlands) |
| `lib/gomate/checklist-generator.ts` | `getDefaultChecklist(profile)` | 5–8 items, purpose-based |

None of these three functions share logic. A user may see different document requirements on the dashboard vs. the documents page.

### 6.4 AI Checklist Overlay

When `GET /api/research/checklist` returns a populated checklist with items, the AI-generated list replaces the static one (`setItems(data.checklist.items)`). The UI shows an "AI Generated" badge and a staleness indicator (7-day threshold, computed client-side from `aiChecklist.generatedAt`).

### 6.5 Optimistic Updates

`handleStatusChange()` uses optimistic update — status is updated in local state immediately, then persisted. On failure, state is reverted.

---

## 7. Guides Page — `/guides`

`app/(app)/guides/page.tsx` (263 lines). Gated by `FullPageGate` (requires `guides` feature).

### 7.1 Two Tabs

**My Guides** — fetches `GET /api/guides`, displays user's generated guides as cards. Clicking navigates to `/guides/{id}`.

**Country Guides** — renders a single card with a button linking to `https://gomaterelocate.com/country-guides` in a new tab. No in-app country guide browser exists. The `countries` array (2 entries: USA, Canada) defined at the top of the file is never rendered.

### 7.2 Guide Generation Button

The "Generate Guide" button calls `POST /api/guides` with an empty body `{}`, then navigates to the returned guide's page. The POST handler reads the user's current plan from DB to determine destination and purpose.

---

## 8. Booking Page — `/booking`

`app/(app)/booking/page.tsx` (452 lines). Gated by `FullPageGate` (requires `booking` feature).

### 8.1 Always Mock Mode

All flight searches are sent with `useMock: true`:

```typescript
body: JSON.stringify({
  from: data.from.iataCode,
  to: data.to.iataCode,
  // ...
  useMock: true, // Use mock data for demo
})
```

The real Firecrawl-based flight search is never invoked from the UI. All results displayed are the 6 hardcoded mock flights from `generateMockFlights()`.

### 8.2 Hotels Tab

The Hotels tab button is `disabled` with a "Coming Soon" label. No hotels functionality exists.

### 8.3 Booking Action

"Book" buttons call `window.open(flight.bookingUrl, "_blank")`. These links are the external booking site URLs from the mock data (Skyscanner, Google Flights, etc.). No in-app booking flow exists.

---

## 9. Settings Page — `/settings`

`app/(app)/settings/page.tsx` (341 lines).

### 9.1 Profile Form — Non-Functional

The Profile section renders a form with hardcoded `defaultValue` placeholders:

```typescript
<Input id="name" defaultValue="Alex Johnson" />
<Input id="email" defaultValue="alex@example.com" />
<Input id="citizenship" defaultValue="United States" />
<Input id="destination" defaultValue="Germany" />
```

The "Save changes" button has no `onClick` handler. The form is **not wired to the database**. Displayed values are hardcoded demo values, not the user's actual data.

### 9.2 Subscription Section — Functional

The only functional part of the settings page. Reads `tier`, `planCount`, `planLimit` from the `useTier` hook. Clicking "Upgrade" / "Manage plan" opens `UpgradeModal`.

### 9.3 Preferences — Non-Functional

Dark mode, language, notification switches:
- `setDarkMode(bool)` has no side effect — does not apply a CSS class or trigger theme change
- Notification switches (`emailNotifications`, `pushNotifications`, `weeklyDigest`) have no backend persistence

### 9.4 Data Actions — Non-Functional

"Download my data" button: no `onClick` handler.
"Delete my account" button: no `onClick` handler.
"Change password" button: no `onClick` handler.

---

## 10. API Routes Discovered from Frontend

Reading the frontend revealed an undocumented API route:

### 10.1 `GET /api/documents` and `PATCH /api/documents`

`app/api/documents/route.ts` — not covered in any prior phase.

**GET:** Returns `{ planId, statuses, checklistItems }` from `relocation_plans.document_statuses` (JSONB) and `relocation_plans.checklist_items`.

**PATCH:** Merges a new status into `relocation_plans.document_statuses`:
```typescript
{ [documentId]: { completed: boolean, completedAt?: string } }
```

**Key gap:** `document_statuses` is not in any SQL migration. It is a column that was added or used without a migration file. It is not in the `RelocationPlan` TypeScript interface.

---

## 11. Gap Analysis — Critical Findings

### G-7.1-A: Settings profile form is non-functional placeholder

The Profile section in `/settings` displays hardcoded placeholder values ("Alex Johnson", "Germany") and has no save handler. A user cannot update their name, email, or profile fields from Settings. Profile updates must go through chat only.

### G-7.1-B: Three independent document checklist generators

Dashboard, documents page, and `checklist-generator.ts` each implement their own document list logic independently. The items shown on `/dashboard` and `/documents` can differ. Neither shares logic with the AI checklist generator backend.

### G-7.1-C: checklist_progress table permanently bypassed

Migration 003 created `checklist_progress` for per-item completion tracking. The actual implementation stores completion in `relocation_plans.document_statuses` JSONB via a different API route. `checklist_progress` is never read or written in production. This is a schema artifact.

### G-7.1-D: document_statuses column has no migration

`relocation_plans.document_statuses` is accessed by `app/api/documents/route.ts` but does not appear in any SQL migration file (scripts 001–009). This column was added to the DB outside the migration system. New deployments from migration history only would not have this column.

### G-7.1-E: Booking always uses mock data

The booking page hardcodes `useMock: true` in every search request. The Firecrawl-based multi-source flight search (the only reason flight-search.ts and its complex scraping logic exist) is never invoked from the UI.

### G-7.1-F: Client-side data duplication

The dashboard contains client-side copies of:
- `VISA_DATABASE` (4 countries) — duplicate of `lib/gomate/visa-recommendations.ts`
- `generateBudgetFromProfile()` — duplicate of `lib/gomate/web-research.ts::calculateMonthlyBudget()`

These duplicates are not called with live data and may diverge from server-side calculations.

### G-7.1-G: Feature matrix duplicated client/server

`tier-gate.tsx::TIER_FEATURES` and `lib/gomate/tier.ts::TIER_FEATURES` define the same matrix. A tier change on the server that isn't reflected in the client will show incorrect gating in the UI (or vice versa).

### G-7.1-H: BottomNav is dead code

`components/layout/bottom-nav.tsx` is never imported. `AppShell` renders its own mobile nav inline. The file is unreferenced.

### G-7.1-I: Settings notifications have no backend

Email, push, and weekly digest notification preferences are stored only in React state. They reset on page reload and are not persisted anywhere.

### G-7.1-J: Suggested guide links to external site

The "Suggested Guide" card in the dashboard links to `gomaterelocate.com/country-guides/{destination}`. There is no in-app country guide browser. The "Country Guides" tab on `/guides` similarly redirects externally.

---

## 12. Complete Page Inventory

| Page | Route | Auth | Tier gate | Data sources |
|---|---|---|---|---|
| Dashboard | `/dashboard` | Middleware | Per-section TierGate | /api/profile, /api/guides, /api/documents |
| Chat | `/chat` | Middleware | None (chat is free) | /api/profile, /api/chat (SSE), /api/research/trigger |
| Guides | `/guides` | Middleware | FullPageGate (guides) | /api/guides |
| Guide Detail | `/guides/[id]` | Middleware | None (if on page) | /api/guides/[id] |
| Documents | `/documents` | Middleware | FullPageGate (documents) | /api/profile, /api/documents, /api/research/checklist |
| Booking | `/booking` | Middleware | FullPageGate (booking) | /api/flights (mock only) |
| Settings | `/settings` | Middleware | None | /api/subscription (tier read only) |
