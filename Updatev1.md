# Updatev1.md — GoMate Build Roadmap & Implementation Blueprint

---

## 1. Executive Summary

This update transforms GoMate from a **guidance product** into an **execution and tracking product**. The current system does the research and produces guides — it tells users what they need to do. This update adds the mechanisms for users to actually do it: tracking where they are in the visa process, following a step-by-step wizard to open a bank account, getting a proactive calendar of legal deadlines, and seeing whether their income can realistically support the move before they commit.

The fifteen features in scope span four strategic areas:

**Pre-move execution support**: Visa Application Tracker, Pre-Move Interactive Timeline, Income vs Cost Validation, Document Vault, Salary/Tax Overview. These transform the static pre-move guide into a live planning workspace.

**Post-move guided flows**: Banking Setup Wizard, Tax Registration Guide, Compliance Calendar, Visa Renewal Track, First 30 Days Mode. These extend the post-arrival task system from a checklist into a guided onboarding experience.

**Product baseline**: Chat History persistence, Wellbeing Check-In. These address a critical UX gap (losing the chat on reload) and add a retention mechanic.

**Proactive intelligence**: Plan Consistency Checks, Plan Change Summary, Commonly Forgotten Items. These transform GoMate from a passive guide into an active guardian — catching mismatches before they become problems, explaining what shifts when plans change, and surfacing the things users don't know to look for.

The most important finding from the repository inspection: **most of these features already have 60–80% of the backend data they need.** The visa research, local requirements, guide timeline section, Numbeo cost data, settling-in task DAG, and country data are all present. The gap is primarily in UI and light data model extensions — not in building new research or AI pipelines.

---

## 2. Current Repo Readout

### 2.1 Systems That Can Be Reused Directly

| System | Location | Reusable For |
|--------|----------|-------------|
| `visa_research` JSONB (VisaResearchResult) | `relocation_plans.visa_research` | Visa Tracker — visa type, requirements, processing time, validity |
| `local_requirements_research` JSONB | `relocation_plans.local_requirements_research` | Banking Wizard, Tax Guide — has categorized steps per destination |
| `checklist_items` JSONB (GeneratedChecklist) | `relocation_plans.checklist_items` | Document Vault — already has items with priority, required, whereToGet |
| `document_statuses` JSONB | `relocation_plans.document_statuses` | Document Vault — already persists completion state per canonical ID |
| `/app/api/documents/route.ts` | GET + PATCH | Document Vault — read/write of document_statuses, extend without rewriting |
| `settling_in_tasks` table | All columns + DAG logic | Compliance Calendar, First 30 Days Mode, Visa Renewal Track |
| `post-arrival.ts` (`buildSettlingView`, urgency, deadline computation) | `lib/gomate/post-arrival.ts` | Compliance Calendar — urgency and deadline_at already computed |
| `compliance-timeline.tsx` | `components/compliance-timeline.tsx` | Compliance Calendar — already renders deadline list, extend to calendar |
| Guide `timeline_section` | `guides.timeline_section` JSONB | Pre-Move Timeline — phases with tasks already generated, just need interactive rendering |
| Guide `checklist_section` | `guides.checklist_section` JSONB | Pre-Move Timeline — items with priority/timeframe already generated |
| `target_date` in profile | `relocation_plans.profile_data.target_date` | Pre-Move Timeline anchor |
| `monthly_income`, `monthly_budget`, `savings_available` | `relocation_plans.profile_data` | Income vs Cost Validation — raw inputs already in profile |
| Numbeo cost data (10 cities hardcoded + Firecrawl) | `lib/gomate/numbeo-scraper.ts` | Income vs Cost Validation — monthly budget ranges already computed |
| `COUNTRY_DATA` (6 countries) | `lib/gomate/guide-generator.ts` lines 271–607 | Banking Wizard — `popularBanks`, `bankingNotes` per country already present |
| `OFFICIAL_SOURCES` (224 countries) | `lib/gomate/official-sources.ts` | Banking Wizard, Tax Guide — official links already categorized |
| Guide `banking_section` | `guides.banking_section` JSONB | Banking Wizard — `recommendedBanks[]`, `accountOpeningGuide`, `requirements[]` already generated |
| `arrival_date` on plan | `relocation_plans.arrival_date` | Visa Renewal, Wellbeing Check-In anchor |
| `BudgetPlanCard`, `CostOfLivingCard` | `components/` | Income vs Cost Validation — extend rather than replace |
| `react-day-picker` | Already in package.json | Compliance Calendar — calendar component available |
| Chat `UIMessage[]` array | `app/(app)/chat/page.tsx` state | Chat History — defines the message shape to persist |

### 2.2 Systems That Are Partial and Need Extension

| System | Current State | What's Missing |
|--------|-------------|---------------|
| **Document Vault** | `document_statuses` JSONB stores `{completed, completedAt, documentName}` per canonical ID | `status` enum beyond boolean, `externalLink`, `notes`, `expiryDate` fields per document |
| **Compliance Alerts** | Shows reactive banners (overdue/urgent); localStorage dismissal | Proactive calendar view; export to iCal; reminder settings |
| **Settling-in Tasks** | Full DAG with deadlines and categories | No "first 30 days" filter mode; no calendar view of just legal tasks |
| **Settings Page** | UI-only notification toggles (no backend) | No persistence for any preference; notification settings not wired |
| **Guide Timeline Section** | Generated as static phases with task strings | Not rendered interactively; not connected to `target_date` for countdown |
| **COUNTRY_DATA** | 6 countries (DE, NL, ES, PT, SE, JP) with `popularBanks`, `bankingNotes` | No `taxInfo` or `taxRegimes` field; tax overview requires new structured field |

### 2.3 What Is Missing Entirely

| Feature | Gap |
|---------|-----|
| **Chat History** | No `conversations` or `messages` tables. Messages exist only in React `useState`. Zero persistence. |
| **Visa Application Tracker** | No tracking of user's own visa application status, dates, or application-level document checklist |
| **Visa Renewal Tracking** | No `visa_expiry_date`, no renewal reminder logic, no path-to-residency milestones |
| **Tax regime data** | COUNTRY_DATA has no structured tax info; informational tax overview requires new data |
| **Wellbeing Check-In** | No table or JSONB column for check-in responses; no prompt scheduling |
| **Notification delivery** | No email delivery (no SendGrid/Resend), no push, no cron/background jobs |
| **iCal export** | No calendar export of any kind |
| **Pre-move timeline interactivity** | `timeline_section` rendered as static read-only text in guide viewer |

---

## 3. Feature-by-Feature Breakdown

---

### Feature 1: Visa Application Tracker

**Goal**: Let users track their own visa application process — status, key dates, required documents, and deadlines — as a personal organizer. GoMate never submits anything.

**User Value**: The guide describes which visa to apply for. Users currently have nowhere to track whether they've started, submitted, or received a decision. This closes the loop between "knowing what to do" and "doing it."

**Current codebase support**:
- `relocation_plans.visa_research` already contains: visa type name, requirements list, processing time, official links, estimated cost, validity period
- `relocation_plans.checklist_items` already contains document checklist items with priority, required status, estimated time, and official links
- `relocation_plans.document_statuses` already has read/write API routes at `/api/documents`
- The visa research shape (`VisaResearchResult`) already surfaces `visaOptions[].validity` which can seed renewal date

**Required backend work**:
- Add `visa_application` JSONB column to `relocation_plans` (migration 025) with shape:
  ```
  {
    selectedVisaType: string | null,
    applicationStatus: "not_started" | "preparing" | "submitted" | "awaiting_decision" | "approved" | "rejected" | null,
    submittedAt: string | null,
    expectedDecisionAt: string | null,
    approvedAt: string | null,
    visaStartDate: string | null,
    visaExpiryDate: string | null,
    notes: string | null
  }
  ```
- New `/api/visa-tracker` route (single file with GET + PATCH handlers):
  - **GET**: returns `{visaApplication, visaResearch, documentChecklist, estimatedDeadline}` — reads `visa_application` JSONB, `visa_research`, and `checklist_items` filtered to `visaSpecific === true`
  - **PATCH**: accepts partial updates to `visa_application` JSONB fields. Any field in the JSONB shape can be updated individually. No status transition validation — any status can transition to any other status (user-controlled tracker, not a workflow engine)
- Deadline estimation: use shared `parseTimeRange()` utility (see §4.8) to extract days from `processingTime` string. Use upper bound. If unparseable, return `estimatedDeadline: null`
- No new tables needed — JSONB extension of existing row is sufficient

**Required frontend work**:
- New page: `/app/(app)/visa-tracker/page.tsx` (standalone page, linked from dashboard card and sidebar)
- Component: `VisaApplicationTracker` — status stepper (5 states), date inputs, notes field
- Visa type selector: render `visaOptions[]` as radio card list showing `{visaType, processingTime, estimatedCost, validity}` per option. User selects one to activate the tracker
- Document sub-checklist: render `checklist_items` filtered to `visaSpecific === true` (field exists on `ChecklistItem` type in `lib/gomate/checklist-generator.ts`), reuse existing document completion checkboxes from `/app/(app)/documents/page.tsx`
- Deadline display: compute "apply by" from `profile.target_date` minus parsed `processingTime` upper bound. If unparseable, show "Check processing times on the official website" with link
- Status badge rendering in dashboard if application is in-progress

**Required data/model work**:
- Migration 025: `ALTER TABLE relocation_plans ADD COLUMN IF NOT EXISTS visa_application jsonb DEFAULT '{}'`
- No new tables

**Required service/job/reminder logic**:
- None in v1 — no push/email reminders yet (see shared infrastructure)
- Status is manually updated by the user

**Dependencies**:
- Requires `visa_research` to be populated (plan must be locked and research completed)
- Reads `checklist_items` for the document list
- Reads `target_date` for deadline estimation

**Key edge cases / risks**:
- `visa_research` may be null (plan not yet researched) — show empty state with prompt to complete research first
- `visaOptions[]` may have multiple options — user must select one to "start" the tracker
- Processing time in research is a string like "4–8 weeks" — deadline estimation is approximate, must be labeled as such
- Rejected applications: reset flow (allow re-selecting visa type) without losing previous data

**What "done" means**:
- User can select a visa type from their research results
- User can move through 5 application statuses
- User sees the visa-specific document checklist
- User can input submitted date and expected decision date
- Status is persisted across sessions
- Dashboard shows current tracker status

---

### Feature 2: Pre-Move Interactive Timeline

**Goal**: Convert the static `timeline_section` in generated guides into an interactive countdown planner anchored to the user's `target_date`.

**User Value**: The guide has a 4-phase timeline (Research & Planning, Visa & Documentation, Pre-Move Preparation, Move & Settle) with tasks per phase. Currently it's read-only text in the guide viewer. Users need to check things off as they do them.

**Current codebase support**:
- `guides.timeline_section` already contains: `{totalMonths, phases: [{name, duration, tasks[], tips[]}]}`
- `guides.checklist_section` already contains: `{categories: [{name, items: [{task, priority, timeframe}]}]}`
- `profile.target_date` (stored in `relocation_plans.profile_data.target_date`) provides the countdown anchor
- `checklist_progress` table already exists with `(user_id, plan_id, item_id, completed, completed_at)` and unique constraint
- `GET/PATCH /api/progress` route exists for reading progress state

**Required backend work**:
- No new tables — `checklist_progress` can store timeline item completion
- Write path: `checklist_progress` uses the existing `GET/PATCH /api/progress` route. The PATCH handler already supports UPSERT on `(user_id, plan_id, item_id)` — pass `item_id` with the `timeline_` prefix. **Verify** the existing PATCH handler accepts arbitrary `item_id` strings (not just document IDs) before building
- Read path: extend `GET /api/progress` to accept an optional `?prefix=timeline_` query param that filters `item_id LIKE 'timeline_%'` — returns only timeline progress items

**Required frontend work**:
- New component: `PreMoveTimeline` that renders `timeline_section.phases` as expandable phase cards with checkboxes per task
- Countdown computation: `daysUntilMove = target_date - today`, shown prominently ("47 days until your move")
- Phase active state computation: each phase has a `duration` string (e.g., "2-3 months"). Compute phase boundaries by dividing `totalMonths` proportionally across phases using each phase's duration midpoint. The current phase is the one whose date range contains today relative to `target_date - totalMonths`. If durations are not parseable, fall back to equal division of `totalMonths` across phases
- Phase coloring: past (muted) / current (primary accent) / future (gray outline)
- Progress indicator per phase: "3 of 5 tasks done"
- Add Timeline tab to guide viewer (`/app/(app)/guides/[id]/page.tsx`) — renders inside the existing guide tab system, not as a standalone page
- `checklist_section` items rendered as supplementary to-do list below the timeline (flat, sorted by priority). These also use `checklist_progress` with `item_id = "checklist_{categoryIndex}_{itemIndex}"`

**Required data/model work**:
- No migrations needed — uses existing `checklist_progress` table
- Item IDs follow naming convention: `timeline_{phaseIndex}_{taskIndex}` to namespace from document checklist items. Do NOT include guideId — orphaned progress from guide regeneration is harmless (not rendered, not queried)

**Required service/job/reminder logic**:
- None — countdown is computed client-side from `target_date`

**Dependencies**:
- Requires guide to be generated (timeline_section only exists after guide generation)
- Requires `target_date` in profile — show "Set your move date to activate timeline" if null

**Key edge cases / risks**:
- User regenerates guide — timeline_section changes, old `checklist_progress` items become orphaned. Safe to leave them (they won't be rendered). Add a note: "Timeline refreshed — your progress has been reset."
- `target_date` in the past — show "Your move date has passed. Activate post-arrival mode." nudge
- `timeline_section` may be null if guide was generated before this section existed — degrade gracefully with empty state

**What "done" means**:
- Guide viewer shows interactive timeline tab with checkboxes per task per phase
- Countdown shows days until target_date
- Current phase is highlighted
- Task completion persists across sessions
- No target_date = helpful prompt to set one

---

### Feature 3: Income vs Cost of Living Validation

**Goal**: Show users whether their income/budget can realistically support life in the destination city, using their own financial profile against Numbeo cost data.

**User Value**: People consistently underestimate what it costs to live abroad. This feature makes the gap between "what I earn" and "what I need" visible before they commit. It also validates digital nomads and workers who need to meet income thresholds for certain visas.

**Current codebase support**:
- Profile already captures: `monthly_income` (digital_nomad), `monthly_budget` (all), `savings_available` (all)
- Numbeo data already contains: `estimatedMonthlyBudget.single.{minimum, comfortable}` per city — computed from rent + utilities + transport + groceries
- `lib/gomate/numbeo-scraper.ts` already exports `getCostOfLivingData(destination, city)` and has fallback data for 10 cities
- `calculateMonthlyBudget(profile, numbeoData)` and `calculateSavingsTarget(profile, numbeoData)` already exist in guide-generator.ts
- `BudgetPlanCard` and `CostOfLivingCard` components already exist
- Dashboard already shows budget breakdown in "locked_pre_arrival" state

**Required backend work**:
- No new backend route needed — do NOT build `/api/cost-check` in v1. All computation is client-side using data already available from `GET /api/profile` and `GET /api/guides`

**Required frontend work**:
- New component: `AffordabilityCard` (or extend existing `BudgetPlanCard`)
- Inputs: user's `monthly_budget` vs Numbeo's `minimum` and `comfortable` for their family size
- Affordability tier thresholds:
  - **Below minimum**: `budget < minimum`
  - **Tight**: `minimum <= budget < comfortable`
  - **Comfortable**: `comfortable <= budget < comfortable * 1.5`
  - **Well above**: `budget >= comfortable * 1.5`
- Breakdown: show `estimatedMonthlyBudget` total and savings runway. Numbeo data provides aggregate totals (rent + utilities + transport + groceries combined), NOT itemized categories — do not attempt per-category percentages like "Rent takes X%"
- Warning state: if `monthly_budget < minimum * 1.1`, show "This may be tight — consider raising your budget or choosing a cheaper area"
- Savings runway: `savings_available / monthly_budget` → "Your savings cover X months of expenses". If `savings_available` is non-numeric text, show "Enter a specific savings amount to see your runway" inline edit prompt (text input that replaces the text, saves to profile on blur)
- Show on: dashboard (locked_pre_arrival state) and in `/guides/[id]` budget tab
- For digital nomads: compare `monthly_income` (not just budget) against cost

**Required data/model work**:
- None — all data exists. Uses `profile.monthly_income`, `profile.monthly_budget`, `profile.savings_available`, `profile.moving_alone`, `profile.children_count`, and Numbeo data
- Family size modifier: if `moving_alone === "no"` with spouse, use `couple` budget; if children_count > 0, use `family4`

**Required service/job/reminder logic**:
- None

**Dependencies**:
- Numbeo data for destination city (uses fallback if city not in 10-city list)
- Profile must have `monthly_budget` or `monthly_income` filled in

**Key edge cases / risks**:
- User hasn't set budget yet — show "Add your monthly budget to see affordability" prompt
- City not in Numbeo fallback data (150+ countries with no city data) — use country-level fallback or show "Cost data not available for this city yet"
- Savings field is vague ("some savings", "$20,000–$30,000") — cannot parse ranges reliably. Treat as unstructured text if not numeric; show input prompt for a number if text is not parseable
- The comparison must be clearly labeled "estimated — based on Numbeo averages, your costs may vary"

**What "done" means**:
- User sees their budget vs Numbeo minimum/comfortable ranges for their destination city
- Color-coded affordability verdict (tight / comfortable / well above)
- Savings runway shown ("covers X months")
- Warning shown if below minimum threshold

---

### Feature 4: Document Vault (Light Version)

**Goal**: Upgrade the existing document checklist to track each document's status across its lifecycle (gathering → scanned → submitted → expiring) and allow users to attach optional external links (Google Drive, Dropbox URL) per document.

**User Value**: Visa applications require 10–20 documents. Users lose track of what they have, what's missing, and what's about to expire. The current system only tracks boolean completion. Adding status granularity and external links makes it a real organizer.

**Current codebase support**:
- `relocation_plans.document_statuses` JSONB already persists per-document state
- `/app/api/documents/route.ts` GET + PATCH already handle read and update
- `canonicalDocumentId()` in `checklist-generator.ts` normalizes IDs
- `checklist_items` JSONB already has `id, document, description, priority, required, category, estimatedTime, cost, whereToGet, officialLink`
- `/app/(app)/documents/page.tsx` renders checklist with checkboxes

**Required backend work**:
- Extend `document_statuses` JSONB shape — no migration needed (JSONB is schemaless), just update the TypeScript type:
  ```typescript
  type DocumentStatusEntry = {
    status: "not_started" | "gathering" | "ready" | "submitted" | "expiring" | "expired"
    completedAt?: string // ISO — set when status = "submitted"
    externalLink?: string // URL to Drive/Dropbox/reference
    notes?: string // free text note
    expiryDate?: string // ISO — for time-limited docs (bank statements, background checks)
    documentName?: string // existing field
  }
  ```
- Update `PATCH /api/documents` to accept and store new fields (status enum, externalLink, notes, expiryDate)
- Add validation: `externalLink` must start with `https://` if present — no raw storage of sensitive doc content

**Required frontend work**:
- Extend document cards in `/app/(app)/documents/page.tsx`:
  - Replace binary checkbox with status selector (5 states shown as colored badge + dropdown)
  - Add expandable detail area with: external link input, notes field, expiry date picker
  - Show "Expiring soon" badge if `expiryDate < today + 30 days`
  - Show "Expired" badge if `expiryDate < today`
- Add document status summary bar: "7 gathered / 3 submitted / 2 not started"
- No file upload — input is a URL string only

**Required data/model work**:
- No new migration needed — JSONB column already exists and is schemaless
- TypeScript type update in `lib/gomate/checklist-generator.ts`

**Required service/job/reminder logic**:
- None in v1 — expiry display is client-computed from `expiryDate` field

**Dependencies**:
- `checklist_items` must be populated (requires research to have run)
- Requires `/api/documents` PATCH to accept extended payload

**Key edge cases / risks**:
- External link sanitization: must reject `javascript:` URLs, enforce `https://` prefix
- Expiry logic: bank statements are typically valid for 3 months — UI should clarify that `expiryDate` is user-set, not auto-computed
- Status "submitted" vs "ready": some documents are submitted individually, some as a package — keep status simple, don't over-engineer
- **Backward compatibility:** existing `document_statuses` entries use `{completed: boolean, completedAt?, documentName?}` (no `status` enum). New code must handle old shapes. Add a parse function:
  ```typescript
  function normalizeDocumentStatus(raw: any): DocumentStatusEntry {
    if (raw && typeof raw.status === 'string') return raw as DocumentStatusEntry
    // Legacy shape: { completed: boolean }
    return {
      status: raw?.completed ? "ready" : "not_started",
      completedAt: raw?.completedAt,
      documentName: raw?.documentName,
    }
  }
  ```
  Apply this on read (GET handler) so the frontend always receives the new shape. Old data is migrated lazily — the next PATCH for any document writes the new shape

**What "done" means**:
- Each document shows a 5-state status selector
- User can attach an optional external URL per document
- User can add notes per document
- User can set an expiry date per document
- Expiring/expired badge shown for documents with expired dates
- All state persists to DB via existing API

---

### Feature 5: Salary / Tax Overview

**Goal**: Show users an informational, lightweight overview of the tax regime in their destination country, estimated income tax at their income level, and estimated take-home pay. Framed as guidance, not legal advice.

**User Value**: Tax is the #1 financial surprise for expats. GoMate already knows the user's income (digital nomad and workers). Showing them "you'll keep approximately X after tax in Portugal" is high-value, low-risk information.

**Current codebase support**:
- Profile already has `monthly_income` (digital_nomad), `monthly_budget`, `savings_available`
- `COUNTRY_DATA` has 6 countries but no `taxInfo` field
- Guide's `budget_section` mentions take-home pay briefly but doesn't structure it
- `OFFICIAL_SOURCES` per country has links to tax authorities

**Required backend work**:
- No new API route needed
- Add `taxInfo` field to `COUNTRY_DATA` structure in `lib/gomate/guide-generator.ts`:
  ```typescript
  taxInfo?: {
    incomeTaxBrackets: { upTo: number | null; rate: number }[] // progressive marginal brackets; upTo in EUR annual; null = no cap
    socialContributions: string // human-readable description (not used in calculation)
    specialRegimes?: { name: string; summary: string; eligibility: string }[]
    taxYear: string // "Jan–Dec", "Apr–Mar"
    filingDeadline: string
    disclaimer: string
    officialLink: string
    lastVerified: string // ISO date — shown in UI as "Rates last verified: {date}"
  }
  ```
- Start with the 6 countries in COUNTRY_DATA: Germany, Netherlands, Spain, Portugal, Sweden, Japan
- Hardcode data — this is informational content, not a tax engine. Source bracket data from each country's official tax authority website (links in `OFFICIAL_SOURCES`). 3–5 brackets per country is sufficient for an informational estimate
- Hardcode 2025/2026 rates. Add `lastVerified: string` (ISO date) to the `taxInfo` type to track staleness

**Required frontend work**:
- New component: `TaxOverviewCard`
- Take-home computation: **progressive marginal tax calculation**. Walk the `incomeTaxBrackets` array: for each bracket, tax the portion of annual income that falls within that bracket at that bracket's rate. Sum all bracket taxes to get total annual tax. `monthlyTakeHome = (annualIncome - totalAnnualTax) / 12`. This is standard marginal tax math — do not use a single flat rate
- Social contributions: shown as informational text below the take-home figure. Do NOT subtract from the take-home number (social contribution rates vary too much by employment type to estimate reliably)
- Shows: tax bracket the user falls into at their income level
- Shows: special regimes table if applicable (Spain's Beckham Law, Netherlands' 30% ruling, etc.). Show all regimes for the country — do not attempt to auto-determine eligibility from the profile (too complex). Let the user read and self-assess
- Always shows: "This is an estimate based on published rates — consult a local tax advisor before filing"
- Shows: `lastVerified` date: "Rates last verified: March 2026"
- Official link to destination tax authority (from OFFICIAL_SOURCES)
- Location: Dashboard card (locked_pre_arrival) and Guide's Budget tab (add as a sub-section within the existing budget tab content, not a new tab)

**Required data/model work**:
- Extend `COUNTRY_DATA` TypeScript type with `taxInfo?` field
- Add hardcoded `taxInfo` for 6 existing countries
- For countries not in COUNTRY_DATA: show generic "Tax rates vary — check the official tax authority" with link from OFFICIAL_SOURCES

**Required service/job/reminder logic**:
- None

**Dependencies**:
- Requires `monthly_income` or `monthly_budget` in profile (show prompt if missing)
- Only meaningful when destination is one of the 6 supported countries initially — degrade gracefully for others

**Key edge cases / risks**:
- Tax law changes — data can become stale. Show "Based on 2026 published rates — verify before filing"
- Self-employed vs employed tax regimes differ significantly — keep to employee rates in v1, note that self-employed rates differ
- Digital nomads may not pay local income tax if they don't become tax residents — note 183-day residency threshold
- Never show as "your tax bill" — always "estimated guide figure"

**What "done" means**:
- User sees estimated take-home pay for their income level in destination country
- User sees relevant special regimes if applicable
- Always accompanied by disclaimer and official link
- Works for the 6 supported countries; graceful empty state for others

---

### Feature 6: Banking Setup Wizard

**Goal**: Country-specific, step-by-step interactive guide for opening a bank account after arrival, including which bank to choose, what to bring, in what order.

**User Value**: Banking is the #1 post-arrival friction point. The settling-in checklist has "Open bank account" as a checkbox. That's not enough. Users need to know which bank works for expats, whether to use a digital bridge (Wise/Revolut) in the interim, and exactly what documents to bring to which office.

**Current codebase support**:
- `COUNTRY_DATA.popularBanks[country]` already has: `{ name, type: "traditional"|"digital", features[] }` for 6 countries
- `COUNTRY_DATA.bankingNotes` has text notes per country
- `guides.banking_section` JSONB already has: `recommendedBanks[], requirements[], digitalBanks[], accountOpeningGuide, tips[]`
- `local_requirements_research` already has a "Banking" category with `items[{title, steps[], documents[], estimatedTime, cost, officialLink, tips[]}]`
- `settling_in_tasks` has a banking category task (post-arrival)
- `OFFICIAL_SOURCES[country].banking` has official bank/financial regulator links

**Required backend work**:
- New `/api/banking-wizard?planId=X` GET route that assembles the wizard data from: guide.banking_section + local_requirements_research banking category + COUNTRY_DATA.popularBanks
- Response shape: `{destination, city, banks[], steps[], documentsNeeded[], digitalBridgeOptions[], officialLinks[], estimatedTime}`
- `digitalBridgeOptions` source: hardcoded universal array — these are global services, not country-specific:
  ```typescript
  const DIGITAL_BRIDGE_OPTIONS = [
    { name: "Wise", url: "https://wise.com", features: ["Multi-currency", "Low fees", "Fast setup"] },
    { name: "Revolut", url: "https://revolut.com", features: ["Multi-currency", "Free ATM withdrawals", "Fast setup"] },
    { name: "N26", url: "https://n26.com", features: ["EU-based", "Free account", "IBAN included"] }
  ]
  ```

**Required frontend work**:
- New page: `/app/(app)/banking/page.tsx` (standalone page, linked from settling-in task card and sidebar)
- Wizard structure: 4 steps
  1. "Choose your bank" — show banks sorted by expat-friendliness, with requirements per bank
  2. "Get a digital bridge" — Wise/Revolut recommendation while waiting for traditional account
  3. "Gather your documents" — documents needed, with link to Document Vault checklist items
  4. "Go to the branch" — step-by-step visit instructions + official bank website link from `banking_section.recommendedBanks[].url` or `OFFICIAL_SOURCES[country].banking`. Do NOT include branch finder — no data source for branch addresses
- Track wizard progress in localStorage: `gomate:banking-wizard-step:{planId}` (integer 0–3). Do NOT use the `banking_wizard_progress` DB column — localStorage is sufficient for a 4-step wizard
- Link from settling-in task card for banking tasks: "View banking wizard →"
- Deep-link: settling-in task card's `official_link` can point to `/banking`

**Required data/model work**:
- No migration needed — wizard progress stored in localStorage (see above)

**Required service/job/reminder logic**:
- None

**Dependencies**:
- Requires guide to be generated (banking_section must exist)
- Requires local_requirements_research (banking category)
- Best results for 6 countries with COUNTRY_DATA; degrades to generic guide for others

**Key edge cases / risks**:
- banking_section may be empty for some guides generated before banking data was present — check null before rendering
- Bank recommendations should not imply endorsement — add "We don't have commercial relationships with these institutions"
- Country-specific requirements change — link to official bank website rather than listing static requirements

**What "done" means**:
- Post-arrival users can open the banking wizard from the settling-in page or a direct link
- Wizard shows recommended banks for their destination with expat-friendliness notes
- Interim digital bank recommendation shown
- Document list shown with Document Vault integration
- Branch visit steps shown with official links

---

### Feature 7: Tax Registration Guide

**Goal**: Country-specific interactive guide for registering for a tax ID after arrival — the process, which office, required documents, timeline, and what the ID is called in that country.

**User Value**: Tax ID registration is often the most confusing first step, and many other tasks (banking, employment) depend on it. Getting a BSN, NIF, NIE, Steueridentifikationsnummer, or equivalent is non-trivial for first-time expats.

**Current codebase support**:
- `local_requirements_research` already has categories including "Registration" and "Tax" with structured steps, documents, and official links
- `settling_in_tasks` has tax-related tasks with `steps[]` and `documents_needed[]`
- `OFFICIAL_SOURCES[country].immigration` and `.banking` have government registration authority links
- `COUNTRY_DATA` has some registration notes embedded in `cultureTips` and `bankingNotes`

**Required backend work**:
- New `/api/tax-guide?planId=X` GET route that assembles from: local_requirements_research (tax + registration categories) + OFFICIAL_SOURCES[destination] + TAX_ID_MAP
- Add hardcoded `TAX_ID_MAP` to `lib/gomate/country-data.ts` (or inline in the route):
  ```typescript
  const TAX_ID_MAP: Record<string, { idName: string; officeName: string }> = {
    DE: { idName: "Steueridentifikationsnummer", officeName: "Finanzamt" },
    NL: { idName: "BSN (Burgerservicenummer)", officeName: "Gemeente (Municipality)" },
    ES: { idName: "NIE / NIF", officeName: "Oficina de Extranjería" },
    PT: { idName: "NIF (Número de Identificação Fiscal)", officeName: "Finanças (Tax Office)" },
    SE: { idName: "Personnummer", officeName: "Skatteverket" },
    JP: { idName: "My Number (マイナンバー)", officeName: "Ward Office (区役所)" },
  }
  ```
- Category matching in `local_requirements_research`: match categories where `category.toLowerCase()` contains `"tax"` OR `"registration"`. If no match, return empty steps with `fallbackToOfficialLink: true`
- Response: `{destination, taxIdName, officeName, registrationSteps[], documentsNeeded[], officialLink, estimatedTime, cost, tips[], relatedTasks[], fallbackToOfficialLink}`
- Note: `registrationSteps[]` come from AI-generated `items[].steps[]` in local_requirements_research. These are variable quality. If steps are missing or fewer than 2, set `fallbackToOfficialLink: true`

**Required frontend work**:
- New page: `/app/(app)/tax-registration/page.tsx` (standalone page, linked from settling-in task card and sidebar)
- Structure:
  - Header: "What is it called? [Tax ID name for country]" — e.g. "BSN" for Netherlands, "NIF" for Portugal
  - Step-by-step numbered process from local_requirements_research
  - Documents checklist (link to Document Vault)
  - Office / official portal link
  - Timeline: "Usually takes X days"
  - Common mistakes / tips section
- Link from settling-in task card: "View tax registration guide →"
- Progress tracking: user can mark steps as done (reuse checklist_progress table via `PATCH /api/progress` with `item_id = "tax_guide_{stepIndex}"` — same write path as Feature 2)
- When `fallbackToOfficialLink` is true: show simplified view with just the tax ID name, office name, official link, and "Visit the official website for step-by-step instructions"

**Required data/model work**:
- No migration needed — uses checklist_progress for step tracking

**Required service/job/reminder logic**:
- None

**Dependencies**:
- local_requirements_research must be populated
- OFFICIAL_SOURCES for destination country must have relevant links

**Key edge cases / risks**:
- Not all countries are in local_requirements_research (research may have failed or been partial) — show generic guide with official_sources link as fallback
- Some countries auto-assign a tax ID (Germany's Steueridentifikationsnummer is mailed automatically) vs others require in-person registration — the guide must handle both cases
- Research may use different terminology — normalize display to "Tax ID Registration"

**What "done" means**:
- Post-arrival users see country-specific tax ID guide from settling-in task card
- Guide shows the local name, steps, documents, official link, and estimated time
- Steps are checkable and progress persists
- Fallback to official source link if research not available

---

### Feature 8: Compliance Calendar

**Goal**: Show a proactive calendar view of all legal deadlines drawn from settling_in_tasks, with the ability to export to iCal/Google Calendar.

**User Value**: The current compliance system is reactive — banners appear when things are overdue or in 7 days. Users need to see all deadlines 30–60 days out to prepare. A calendar format (vs a list) also makes time-based planning intuitive.

**Current codebase support**:
- `settling_in_tasks` has `deadline_at` (absolute timestamp), `is_legal_requirement`, `status`, and full task metadata
- `post-arrival.ts` already computes `urgency`, `compliance_status`, `days_until_deadline` via `buildSettlingView()`
- `GET /api/settling-in` already returns enriched tasks with all deadline fields
- `compliance-timeline.tsx` already renders a sorted list of legal requirement deadlines
- `react-day-picker` is already in package.json (used in date picker components)

**Required backend work**:
- No new tables or routes needed
- Add `/api/settling-in/export-ical` GET route that:
  - Fetches all tasks with `deadline_at != null` and `is_legal_requirement = true`
  - Generates iCal (.ics) format string
  - Returns with header `Content-Type: text/calendar; charset=utf-8`
  - Each task becomes a VEVENT with: SUMMARY (task title), DTSTART (deadline_at - 1 day for reminder), DTEND, DESCRIPTION (task description + official_link), CATEGORIES (GoMate)
  - Uses pure string generation — no new dependency needed

**Required frontend work**:
- Extend `compliance-timeline.tsx` OR create new `ComplianceCalendar` component
- Calendar view using `react-day-picker` — mark deadline dates with colored dots:
  - Red dot: overdue legal requirement
  - Amber dot: due within 7 days
  - Blue dot: upcoming legal requirement
  - Green dot: completed legal requirement
- Popover on date click: shows task title, status, days remaining, "Mark done" button (calls existing `PATCH /api/settling-in/[id]` to update task status)
- Toggle between calendar view and list view (list = current compliance-timeline.tsx behavior)
- Export button: "Add to Calendar" → calls `/api/settling-in/export-ical` → triggers browser download of .ics file
- Google Calendar add link: `https://calendar.google.com/calendar/r?cid=webcal://...` (alternative one-click option)
- Location: Add calendar tab to `/app/(app)/settling-in/page.tsx`

**Required data/model work**:
- No migration needed

**Required service/job/reminder logic**:
- iCal export handles reminders via VALARM blocks in the .ics file — user's calendar app fires the reminder

**Dependencies**:
- Requires settling_in_tasks to be generated (stage = arrived, post_relocation_generated = true)
- Requires arrival_date to be set (for deadline_at computation)

**Key edge cases / risks**:
- No settling-in tasks generated yet — show "Generate your settling-in checklist first" CTA
- Tasks with no deadline_at — exclude from calendar but show in list
- iCal file must use UTC times correctly — deadline_at is already timestamptz, convert to YYYYMMDDTHHMMSSZ format
- Google Calendar link: requires publicly accessible webcal URL — not feasible for auth-protected route. Offer only the .ics download option in v1

**What "done" means**:
- Settling-in page has calendar tab showing legal deadlines on a monthly calendar
- Calendar days with deadlines show color-coded dots
- Clicking a day shows task details
- "Download calendar" button downloads .ics file with all deadlines
- List view toggle (existing compliance-timeline.tsx behavior preserved)

---

### Feature 9: Visa Renewal Track (Optional)

**Goal**: Let users optionally record their visa start date and expiry, and get a reminder track with milestones toward renewal or permanent residency.

**User Value**: Most users have a 1–2 year visa. Renewal is stressful and has strict deadlines. Visa renewal is the main reason users would re-engage with GoMate 12 months after moving.

**Current codebase support**:
- `visa_application` JSONB (added in Feature 1, migration 025) already has `visaStartDate` and `visaExpiryDate` fields
- `local_requirements_research` may contain visa renewal notes
- `visa_research.visaOptions[].validity` gives the expected validity period

**Required backend work**:
- If Feature 1 is built first, `visa_application` JSONB already provides the storage
- Add renewal milestone computation to `/api/visa-tracker` GET response:
  ```
  renewalMilestones: [
    { label: "Start renewal prep", daysBeforeExpiry: 90, date: ISO },
    { label: "Submit renewal application", daysBeforeExpiry: 60, date: ISO },
    { label: "Visa expires", daysBeforeExpiry: 0, date: ISO }
  ]
  ```
- Logic: computed from `visaExpiryDate` in visa_application JSONB, only shown if expiry is set

**Required frontend work**:
- Add "Visa Renewal" section to the Visa Application Tracker UI (Feature 1)
- Shown only after application is "approved" and visa start/expiry dates are set
- Timeline showing: current date vs expiry, renewal prep window highlighted
- Color progression: green (> 90 days) → amber (30–90 days) → red (< 30 days)
- CTA when entering renewal window: "It's time to prepare for renewal — see the renewal checklist"
- Path-to-residency note: shown ONLY if `visa_research.visaOptions[selected]` contains explicit residency pathway text. The residency eligibility period is NOT reliably present in all visa research results — if the text doesn't mention a specific year/duration for permanent residency, do not show this section. Do not attempt to compute eligibility dates from visa validity alone

**Required data/model work**:
- Piggybacks on Feature 1's `visa_application` JSONB — no additional migration needed

**Required service/job/reminder logic**:
- None in v1 — displayed only when user visits the tracker
- Future: email reminder at 90/30 days before expiry

**Dependencies**:
- Depends on Feature 1 (Visa Application Tracker) being built first
- Requires user to input visa expiry date

**Key edge cases / risks**:
- Feature is entirely optional — if user doesn't set expiry date, section simply doesn't appear
- Visa renewals are country-specific and complex — track only the personal timeline, never claim to advise on renewal eligibility
- Path-to-residency data may be absent from visa_research — only show when explicitly present in research text
- Renewal milestones are fixed at 90/60/0 days before expiry for all visa types in v1 — do not vary by country or visa type

**What "done" means**:
- User who has entered visa expiry date sees a countdown to renewal prep window
- Renewal milestone timeline shown with color-coded urgency
- Path to permanent residency shown if available in visa_research

---

### Feature 10: First 30 Days Mode

**Goal**: A filtered view of the settling-in dashboard that shows only the most urgent tasks for the first 30 days, reducing overwhelm for newly-arrived users.

**User Value**: The current settling-in dashboard shows 15–25 tasks simultaneously. A new arrival who's jet-lagged and overwhelmed doesn't need to see all of them at once. Filtering to the highest-priority first-30-days tasks — legal requirements, banking, registration — is dramatically more usable.

**Current codebase support**:
- `settling_in_tasks` already has:
  - `deadline_days` (relative days from arrival) — tasks due within 30 days
  - `is_legal_requirement` boolean — highest priority tasks
  - `sort_order` — AI-assigned completion order
  - `status` and `urgency` already computed by buildSettlingView()
- `/app/(app)/settling-in/page.tsx` already has category grouping and task rendering
- No filtering mode currently exists — all tasks shown at once

**Required backend work**:
- No backend changes needed
- Client-side filter: "first 30 days" = tasks where `deadline_days <= 30` OR `is_legal_requirement = true` AND `status !== completed`
- Sort: legal requirements first, then by deadline_days ASC, then by sort_order

**Required frontend work**:
- Add toggle to settling-in page header: "All tasks / First 30 days"
- When "First 30 days" active:
  - Filter task list to `deadline_days <= 30 || is_legal_requirement`
  - Show "Day X of your first 30 days" counter at top (computed from arrival_date)
  - Show "Focus: Get settled" header with count of remaining tasks
  - Hide category grouping — show flat priority-sorted list instead
  - Show "See all tasks →" link at bottom
- Day counter component: `DayCounter` — shows "Day 8" with progress bar 8/30
- Auto-activate: when `days_since_arrival < 7`, default to 30-day view; after day 7, user can switch

**Required data/model work**:
- No migration needed
- Store user preference for view mode: `localStorage.setItem('gomate:settling-view', 'first30|all')`

**Required service/job/reminder logic**:
- None

**Dependencies**:
- Settling-in tasks must be generated (post-arrival, post_relocation_generated = true)
- arrival_date must be set

**Key edge cases / risks**:
- User arrives and none of their tasks have deadline_days set (AI-generated tasks sometimes omit deadlines) — show all is_legal_requirement tasks as fallback
- Some destinations have no 30-day deadlines — show "You have more time to settle in — here are the important tasks" with first 5 by sort_order
- Day counter past day 30 — transition to "All tasks" view automatically after day 30

**What "done" means**:
- Settling-in page has "First 30 Days" toggle
- When active: filtered view showing only urgent/legal tasks, day counter visible
- Default to first-30-days view for first 7 days after arrival
- User can switch to full view at any time

---

### Feature 11: Chat History

**Goal**: Persist all chat messages to the database so users can return to their conversation after leaving the page or closing the browser.

**User Value**: This is a baseline UX expectation that is currently broken. Every time a user refreshes the chat page, their conversation is gone. This erodes trust, especially for the interview flow where users have shared significant personal information.

**Current codebase support**:
- Chat UI in `/app/(app)/chat/page.tsx` — messages are `UIMessage[]` in React state (array of `{id, role, content}`)
- Supabase is already the persistence layer for all other data
- `user_id` and `plan_id` are both available in chat route
- The chat API route (`/api/chat/route.ts`) already has access to user + plan context
- **Nothing is persisted** — this is a clean-slate addition

**Required backend work**:
- New migration 025 (or part of combined 025): Create `chat_messages` table:
  ```sql
  CREATE TABLE IF NOT EXISTS chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES relocation_plans(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS chat_messages_plan_created ON chat_messages (plan_id, created_at ASC);
  -- RLS: users can only access own messages
  ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "users_own_messages" ON chat_messages
    FOR ALL USING (auth.uid() = user_id);
  ```
  **Design note:** `sequence_number` has been removed. Use `created_at ASC` for ordering instead. This eliminates the MAX+1 race condition entirely. Two messages inserted at the same millisecond within the same plan are extremely unlikely given the streaming flow (user message first, then assistant after stream completes). If it ever happens, `id` (uuid) provides a stable tiebreaker.
- Do NOT persist system messages (role CHECK constraint enforces `'user' | 'assistant'` only)
- New `/api/chat/history` GET route:
  - Auth check
  - Fetch last 50 messages for current plan: `ORDER BY created_at ASC LIMIT 50`
  - Returns `{messages: {id, role, content, createdAt}[], planId}`
  - On history load, the system prompt / interview state context is NOT included in the returned messages — it is re-injected by the chat route on the next user message (the chat route already does this today)
- Extend `/api/chat` POST route to persist messages:
  - **Content serialization:** `UIMessage.content` may be a string or an array of content parts (Vercel AI SDK). Serialize as: `typeof content === 'string' ? content : content.filter(p => p.type === 'text').map(p => p.text).join('\n')`. Store only the text — do not store tool calls or other part types
  - **Streaming capture:** Use the Vercel AI SDK `streamText()` `onFinish` callback. This callback receives the complete assistant response text after the stream ends. Inside `onFinish`: insert both the user message and the assistant response in a single batch insert (two rows). If the stream errors before completing, `onFinish` is not called — the user's message is NOT persisted (no partial saves)
  - **Transaction boundary:** Both inserts happen in `onFinish` — not during streaming. If the DB insert fails, the user saw the streamed response but it won't appear in history on next load. This is acceptable for v1 — the message was delivered, just not persisted. Log the error
  - No sequence_number needed — `created_at` provides ordering

**Required frontend work**:
- On chat page mount: fetch `/api/chat/history` and hydrate `messages` state
- Show loading skeleton while fetching history
- "No chat history yet" empty state for new plans
- Optional: "Continue where you left off" scroll-to-bottom after load
- No pagination needed in v1 — load last 50 messages

**Required data/model work**:
- New `chat_messages` table (migration 025)
- Indexed on `(plan_id, created_at ASC)` for efficient history queries

**Required service/job/reminder logic**:
- None

**Dependencies**:
- Requires active plan (plan_id) to scope messages
- When plan is switched, chat history changes to the new plan's messages
- When plan is archived, messages are retained (ON DELETE CASCADE only fires on plan deletion, not archival)

**Key edge cases / risks**:
- **Streaming delay**: response is inserted after stream completes via `onFinish` — brief delay between user seeing the response and it being persisted. If the user refreshes during streaming, the in-progress message will not appear in history. Acceptable for v1.
- **Stream errors**: if the stream errors before completing, `onFinish` is not called, and neither the user message nor the partial assistant response is persisted. The user saw the partial response but it's lost on refresh. Acceptable for v1.
- **Long conversations**: 50-message limit in v1. If history is truncated, show "Showing last 50 messages" notice.
- **Multiple tabs**: Two tabs open with the same plan — both tabs can insert messages independently. `created_at` ordering handles interleaving. Duplicate user messages are possible if the user sends the same message from two tabs — acceptable for v1.
- **Plan switch**: Messages scoped to plan_id — switching plan loads that plan's chat history. Make this explicit in the UI.
- **Privacy**: chat_messages contains personal information. RLS policy is critical — verify before deploying.

**What "done" means**:
- User refreshes chat page — conversation is still there
- Last 50 messages loaded on mount
- New messages persisted as they happen
- Plan switch loads the correct plan's history

---

### Feature 12: Wellbeing Check-In (Light)

**Goal**: A lightweight weekly prompt ("How's settling in going?") that surfaces relevant resources if the user is struggling, and creates a gentle re-engagement touch point.

**User Value**: Relocation is emotionally difficult. No current product feature addresses the human side. This is also a retention mechanism — it brings users back to the app weekly in the post-arrival phase.

**Current codebase support**:
- `arrival_date` in relocation_plans can anchor the check-in schedule
- `settling_in_tasks` completion data can contextualize the check-in response
- No check-in infrastructure exists

**Required backend work**:
- Add `wellbeing_checkins` JSONB column to `relocation_plans` in migration 025 (part of combined 025 migration):
  ```typescript
  wellbeing_checkins: Array<{
    checkInAt: string // ISO
    mood: "great" | "good" | "okay" | "struggling" | "overwhelmed"
    note: string | null
  }>
  ```
- Alternatively: small separate table if array size becomes a concern (unlikely in v1)
- New `/api/wellbeing` POST route:
  - Auth check + stage check (`arrived` only)
  - Appends new check-in entry to JSONB array
  - Returns `{success: true, message: string}` with hardcoded supportive response per mood (no AI generation in v1):
    - `great`: "That's wonderful to hear! Keep the momentum going."
    - `good`: "Glad things are going well. You're making great progress."
    - `okay`: "Settling in takes time — you're doing better than you think."
    - `struggling`: "It's completely normal to have hard days. You're not alone in this."
    - `overwhelmed`: "Moving abroad is one of life's biggest changes. Please be kind to yourself."
- No GET route for trend display in v1 — defer to v2

**Required frontend work**:
- Check-in prompt logic: show after `arrival_date + 7 days` and then every 7 days, using localStorage to track last shown: `gomate:last-checkin-prompt`
- Prompt UI: small dismissible card on dashboard or settling-in page
  - "How are you settling in this week?" with 5 emoji/label options
  - Optional short text note
  - Submit → shows a short supportive message based on mood
  - Dismiss → sets localStorage timestamp, does not show again for 7 days
- For "struggling" / "overwhelmed" moods: surface resource links:
  - Expat community info from `COUNTRY_DATA[destination].expatCommunity` (already exists — has `population`, `mainNationalities`, `socialGroups`, `onlineCommunities`). Show the `onlineCommunities` and `socialGroups` arrays as links/names
  - Generic mental health resources (hardcoded, not country-specific):
    ```typescript
    const MENTAL_HEALTH_RESOURCES = [
      { name: "International Association for Suicide Prevention", url: "https://www.iasp.info/resources/Crisis_Centres/" },
      { name: "Befrienders Worldwide", url: "https://www.befrienders.org/find-support" },
      { name: "Crisis Text Line (US/UK/CA)", url: "https://www.crisistextline.org/" },
    ]
    ```
  - Post-arrival chat link: "Talk to your settling-in assistant →" (links to `/chat`)
- Keep it intentionally small — 1 component, 1 route, 1 JSONB array

**Required data/model work**:
- `wellbeing_checkins` JSONB array on `relocation_plans` (migration 025)
- No standalone table needed — array of small objects per plan is sufficient

**Required service/job/reminder logic**:
- No server-side scheduling needed in v1 — client-side localStorage tracks prompt timing

**Dependencies**:
- arrival_date must be set (only show in post-arrival state)
- stage must be "arrived"

**Key edge cases / risks**:
- Users who dismiss the prompt repeatedly — respect it, don't show more than once per 7 days
- "Struggling" response must be warm, not clinical — avoid overengineering the response
- No mental health advice — resource links only, always recommend professional help

**What "done" means**:
- Post-arrival users see a weekly check-in prompt on the settling-in page
- 5 mood options shown
- Mood response persisted to JSONB array
- Supportive response shown after submission
- Dismissal tracked in localStorage for 7 days

---

### Feature 13: Plan Consistency Checks ("You're About To Mess This Up")

**Goal**: Proactively detect mismatches between the user's profile, visa requirements, timeline, and budget — and surface them as warnings before the user commits to a bad decision.

**User Value**: GoMate already tells users what to do. This feature tells them what they're about to get wrong. It's the difference between a guide and a guardian. Examples: "Your visa requires €2,000/month income — your profile says €1,400", "You arrive May 1 but registration deadline is May 7 — your timeline shows you plan housing first", "You marked bank account ready but tax ID is required first in this country."

**Current codebase support**:
- `profile_data` has income, budget, savings, family size, employment type, target_date
- `visa_research` has income requirements, processing times, required documents, validity
- `local_requirements_research` has registration deadlines, banking prerequisites, tax requirements
- `settling_in_tasks` has DAG dependencies (`blocked_by`), `deadline_days`, `is_legal_requirement`
- `checklist_items` has document requirements with priority and required status
- `arrival_date` and `target_date` provide timeline anchors
- `compliance-alerts.tsx` already renders urgency banners — can be extended for consistency warnings

**Required backend work**:
- New utility: `lib/gomate/plan-consistency.ts` with `validatePlanConsistency(plan): ConsistencyWarning[]`
- Return shape:
  ```typescript
  type ConsistencyWarning = {
    severity: "critical" | "warning" | "suggestion"
    code: string // e.g. "INCOME_BELOW_VISA_MINIMUM"
    message: string // human-readable
    fix: string // actionable suggestion
    relatedField: string // profile field or system that triggered it
  }
  ```
- Initial checks — 10 heuristic rules. Each rule specifies its data source and skip condition:
  1. `INCOME_BELOW_VISA_MINIMUM` — monthly_income < visa income requirement. **Parse:** use shared `parseAmountFromText()` (see §4.8) on `visa_research.visaOptions[selected].requirements` entries. **Skip if:** no selected visa type, or no numeric amount parseable from requirements text
  2. `BUDGET_BELOW_COL_MINIMUM` — monthly_budget < Numbeo minimum for destination city. **Source:** Numbeo fallback data. **Skip if:** city not in Numbeo data or budget not set
  3. `SAVINGS_INSUFFICIENT` — savings_available / monthly_budget < 3 months runway. **Skip if:** either value is non-numeric or not set
  4. `ARRIVAL_BEFORE_VISA_READY` — target_date < today + visa processing time estimate. **Parse:** use shared `parseTimeRange()` (see §4.8) on `processingTime`, take upper bound. **Skip if:** no selected visa type or processingTime unparseable
  5. ~~`TIMELINE_CONFLICT_REGISTRATION`~~ — **REMOVED.** The "days planned for housing search" input data does not exist in any data source
  6. `TASK_DEPENDENCY_VIOLATION` — user completed a task whose `blocked_by` task is still incomplete (DAG integrity). **Source:** `settling_in_tasks` table. **Skip if:** no settling-in tasks generated
  7. `DOCUMENT_EXPIRED` — document with expiryDate < today marked as "ready" (Feature 4 integration). **Source:** `document_statuses` JSONB. **Skip if:** no expiryDate set on any document (Feature 4 not yet used)
  8. ~~`NO_HEALTH_INSURANCE`~~ — **REMOVED.** No data source exists for "destination requires health insurance." Reintroduce in v2 when `COUNTRY_DATA` is extended with a `healthInsuranceRequired` boolean
  9. `TARGET_DATE_PASSED` — target_date < today and stage still "generating" or "complete". **Source:** plan fields. Always runs
  10. `MISSING_CRITICAL_DOCUMENTS` — required documents with priority "critical" still not_started within 30 days of target_date. **Source:** `checklist_items` + `document_statuses`. **Skip if:** checklist_items not populated
  - **Global rule:** if any check's required data is missing or unparseable, skip that check silently. Never produce a warning based on guessed or default values
- New `/api/plan-checks` GET route:
  - Auth check, tier check (pro_single+)
  - Fetch plan with all JSONB fields
  - Call `validatePlanConsistency(plan)`
  - Return `{ warnings: ConsistencyWarning[], checkedAt: ISO }`

**Required frontend work**:
- New component: `PlanConsistencyAlerts` — renders warnings grouped by severity
  - Critical: red banner at top of dashboard, cannot be dismissed
  - Warning: amber card, dismissible (localStorage per warning code)
  - Suggestion: blue, collapsible section
- Each warning shows: icon + message + "How to fix" expandable with `fix` text
- Location: dashboard (all stages), settling-in page (post-arrival)
- Fetch on page mount, cache in state (no polling)
- Empty state: green checkmark "No issues detected with your plan"

**Required data/model work**:
- No migration needed — reads existing data only
- No new JSONB columns — warnings are computed on-read, not stored

**Required service/job/reminder logic**:
- None — computed on each GET request

**Dependencies**:
- Requires plan to have profile_data populated (at minimum)
- Richer checks unlock as more data becomes available (visa_research, local_requirements, settling_in_tasks)
- Feature 4 (Document Vault) enhances document-related checks with expiryDate

**Key edge cases / risks**:
- visa_research income requirements are often free-text ("sufficient funds") — only check when a numeric value is parseable
- Processing time is a range ("4–8 weeks") — use the upper bound for safety
- False positives: rules must be conservative — a wrong warning is worse than no warning. Default to "suggestion" severity when uncertain
- Don't block the user — warnings are informational, never prevent actions

**What "done" means**:
- Dashboard shows consistency warnings when plan has detectable issues
- 8 heuristic checks implemented (rules 5 and 8 deferred to v2 pending data sources)
- Warnings grouped by severity with actionable fix text
- No false positives for standard profiles
- Green "all clear" state when no issues found

---

### Feature 14: Plan Change Summary ("Here's What Shifted")

**Goal**: When a user changes a key profile field (destination, budget, arrival_date, family size) after their plan is already generated, show a clear summary of what downstream effects that change has — before and after.

**User Value**: Users change their plans. Currently, the system marks the guide as stale (Phase 9) and recomputes deadlines (Phase 8), but the user has no visibility into *what actually changed*. They don't know if their timeline shifted, if new tasks appeared, or if their budget went from comfortable to tight. This feature makes the system feel alive instead of opaque.

**Current codebase support**:
- Phase 9 already detects profile changes and marks `guide_stale = true` with `guide_stale_reason`
- Phase 8 recomputes `deadline_at` on settling-in tasks when `arrival_date` changes
- `plan_version` (Phase 7, migration 018) increments on significant changes
- `profile_snapshot` on guides (migration 023) captures the profile state at generation time
- Guide staleness banner already renders in the guide viewer
- Compliance alerts already react to deadline changes

**Required backend work**:
- New utility: `lib/gomate/plan-diff.ts` with `computePlanChangeSummary(oldProfile, newProfile, plan): PlanChangeSummary`
- Return shape:
  ```typescript
  type PlanChangeEffect = {
    area: "timeline" | "budget" | "visa" | "tasks" | "documents" | "guide"
    description: string // "Your move date shifted from June 1 to July 15 — all deadlines moved by 44 days"
    severity: "info" | "attention" | "action_required"
  }
  type PlanChangeSummary = {
    changedFields: string[] // ["arrival_date", "monthly_budget"]
    effects: PlanChangeEffect[]
    guideNeedsRegeneration: boolean
    previousSnapshot: Record<string, unknown> | null
  }
  ```
- Compute effects by comparing old vs new profile values:
  - `destination` changed → guide stale, all research stale, visa research stale, tasks stale → action_required
  - `arrival_date` changed → deadline shift computed, show delta in days → attention
  - `monthly_budget` changed → re-run affordability check, show old vs new tier → info or attention
  - `family_size` changed → budget calculation changes → info
  - `target_date` changed → pre-move timeline shift → attention
- Hook into `PATCH /api/profile`: after updating profile, compute diff, return `changeSummary` in response alongside existing data. The current PATCH response returns `{success: true, profile}` — add `changeSummary` as an optional field: `{success: true, profile, changeSummary?: PlanChangeSummary}`. Existing frontend consumers that don't read `changeSummary` are unaffected (additive change, backward-compatible)
- **Which snapshot to compare against:** use the `profile_snapshot` from the guide where `is_current = true` for this plan. If no guide exists (never generated), return `changeSummary: null` (nothing to compare against)
- No new route needed — extend existing PATCH response
- Budget impact comparison: compare raw `monthly_budget` values (old vs new) against Numbeo minimum/comfortable thresholds. Use the shared `AffordabilityAssessment` computation from Feature 3 for both old and new values. Import the computation as a shared utility from `lib/gomate/affordability.ts` (extracted from Feature 3's frontend logic into a shared isomorphic module)

**Required frontend work**:
- New component: `PlanChangeSummary` — modal or slide-over that appears after a profile update that affects downstream systems
- Shows: list of changed fields + computed effects with severity badges
- If `guideNeedsRegeneration`: prominent CTA "Regenerate your guide to reflect these changes"
- If deadline shift: show "Your deadlines moved by X days" with before/after
- If budget impact: show old vs new affordability tier
- Dismissible — user acknowledges the summary, it doesn't persist
- Trigger: after `PATCH /api/profile` returns with a non-empty `changeSummary`

**Required data/model work**:
- No migration needed
- Uses existing `profile_snapshot` from migration 023 as the "old" profile for comparison
- If no snapshot exists (guide never generated), skip — nothing to compare against

**Required service/job/reminder logic**:
- None — computed synchronously on PATCH

**Dependencies**:
- Requires guide to have been generated at least once (so `profile_snapshot` exists for comparison)
- Feature 13 (Consistency Checks) benefits from this — a plan change can trigger new warnings

**Key edge cases / risks**:
- First profile update before any guide generated — no snapshot to compare, skip summary
- Multiple fields changed at once — show all effects, grouped by area
- Minor changes (notes, preferences) should not trigger a summary — only track fields that affect downstream systems. Tracked profile field names (exact keys from `profile_data`): `destination`, `destination_city`, `citizenship`, `arrival_date`, `target_date`, `monthly_budget`, `monthly_income`, `savings_available`, `moving_alone`, `children_count`, `employment_type`, `visa_type`
- Performance: diff computation must be fast — pure comparison, no DB queries beyond what PATCH already does

**What "done" means**:
- User updates a key profile field → sees a summary of downstream effects
- Effects grouped by area (timeline, budget, visa, tasks, guide)
- Regeneration CTA shown when guide is stale
- Deadline shifts shown with day delta
- No summary shown for minor/irrelevant field changes

---

### Feature 15: Commonly Forgotten Items ("Unknown Unknowns")

**Goal**: Surface a curated, country-specific list of things that relocating people commonly forget — items that don't appear in standard checklists because they're not "requirements" but are practically essential.

**User Value**: Users don't know what they don't know. Standard visa checklists cover legal requirements, but nobody tells you about garbage tax in Germany, the need to deregister from your home country, insurance gaps during transit, buying a local SIM card, or that you need an apostille on your birth certificate. This section builds trust by showing the user "we've thought of everything."

**Current codebase support**:
- `COUNTRY_DATA` (6 countries) in `lib/gomate/guide-generator.ts` already has structured per-country data (`cultureTips`, `bankingNotes`, etc.)
- `local_requirements_research` sometimes captures these items but inconsistently — depends on Firecrawl research quality
- `settling_in_tasks` may include some of these as low-priority tasks but they're buried in the full list
- `OFFICIAL_SOURCES` has links that can supplement forgotten-item descriptions

**Required backend work**:
- Add `commonlyForgotten` field to `COUNTRY_DATA` type:
  ```typescript
  commonlyForgotten?: Array<{
    item: string // "Deregister from home country"
    why: string // "Many countries require formal deregistration — failing to do so can cause tax complications"
    when: "before_move" | "first_week" | "first_month" | "ongoing"
    applies_to?: string[] // e.g. ["eu_citizen", "non_eu"] — null means applies to everyone
    lastVerified: string // ISO date — "2026-03-01"
  }>
  ```
- `applies_to` resolution from user profile: use `profile_data.citizenship` (country code) checked against a hardcoded EU country code set:
  ```typescript
  const EU_COUNTRY_CODES = new Set([
    "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
    "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"
  ])
  function getCitizenshipCategory(citizenship: string): string {
    return EU_COUNTRY_CODES.has(citizenship.toUpperCase()) ? "eu_citizen" : "non_eu"
  }
  ```
  If `applies_to` is null/undefined, the item applies to everyone. If `applies_to` contains the user's category, show it. Otherwise hide it
- Populate for 6 existing countries. Examples per country:
  - **Germany**: Anmeldung within 14 days, Rundfunkbeitrag (TV tax), liability insurance (Haftpflichtversicherung), deregister from home, SCHUFA credit history, garbage separation rules
  - **Netherlands**: BSN appointment must be booked in advance (often 2–4 week wait), DigiD registration, health insurance mandatory from day 1, deregister from home, bike purchase
  - **Spain**: NIE vs NIF confusion, empadronamiento (municipal registration), siesta hours affect office availability, autónomo registration if freelance
  - **Portugal**: NIF appointment often requires fiscal representative for non-EU, NISS for social security, MB Way for payments, deregister from home
  - **Sweden**: personnummer wait time (2–6 weeks, blocks everything), BankID required for most services, Skatteverket registration in person, winter gear before October
  - **Japan**: Residence card at airport immigration, ward office registration within 14 days, hanko/inkan seal, National Health Insurance enrollment, garbage sorting rules
- No new API route needed — include in existing guide data or serve from `COUNTRY_DATA` directly
- Serve from `/api/plan-checks` response as a `forgottenItems` array alongside `warnings` — one endpoint returns both consistency warnings and forgotten items for the user's destination

**Required frontend work**:
- New component: `CommonlyForgottenSection` — collapsible card with items grouped by timing (before_move / first_week / first_month / ongoing)
- Each item shows: title + expandable "why this matters" text
- Checkbox per item (persist to `checklist_progress` via `PATCH /api/progress` with `item_id = "forgotten_{countryCode}_{index}"`)
- Location:
  - Pre-arrival: show on dashboard (locked_pre_arrival state), filtered to `before_move` items
  - Post-arrival: show on settling-in page, filtered to `first_week` / `first_month` / `ongoing` items
- For countries not in COUNTRY_DATA: show generic list (deregister from home, insurance gap check, emergency numbers, local SIM, basic language phrases)
- Header: "Things people often forget" with a lightbulb or checklist icon

**Required data/model work**:
- No migration needed
- Extend `COUNTRY_DATA` TypeScript type with `commonlyForgotten?` field
- Reuse `checklist_progress` table for completion tracking

**Required service/job/reminder logic**:
- None

**Dependencies**:
- Destination must be known (profile must have destination country)
- Best results for 6 COUNTRY_DATA countries; generic fallback for others

**Key edge cases / risks**:
- Content accuracy: these items must be verified — wrong advice (e.g., "you don't need to deregister") is worse than no advice. Source from official government pages where possible
- Content staleness: rules change (e.g., Germany's Anmeldung deadline). Add a `lastVerified: string` date to the data structure and show "Last verified: March 2026" in the UI
- Generic fallback list must be genuinely universal — don't include country-specific items in the generic list. The 5 generic items are:
  1. "Deregister from your home country" — when: before_move
  2. "Check for insurance gaps during transit" — when: before_move
  3. "Save emergency numbers for your destination" — when: first_week
  4. "Get a local SIM card or eSIM" — when: first_week
  5. "Learn 10 essential phrases in the local language" — when: first_month
- `applies_to` filter: if the user's citizenship/visa type is known, filter items accordingly (e.g., EU citizens skip "fiscal representative" in Portugal)

**What "done" means**:
- Users see a "Things people often forget" section with 5–8 country-specific items
- Items grouped by timing (before move / first week / first month)
- Each item has an explanation of why it matters
- Items are checkable and persist across sessions
- 6 countries have curated lists; all others get a generic 5-item list
- Content is sourced and verifiable

---

## 4. Shared Infrastructure / Cross-Cutting Changes

### 4.1 Migration 025 (Combined)

All small JSONB additions to `relocation_plans` should be combined into a single migration 025. All statements use `IF NOT EXISTS` / `IF NOT EXISTS` so the migration is safe to re-run:

```sql
-- Migration 025: Update v1 additions
ALTER TABLE relocation_plans
  ADD COLUMN IF NOT EXISTS visa_application jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wellbeing_checkins jsonb DEFAULT '[]';

-- Note: banking_wizard_progress is NOT added — wizard progress uses localStorage (see Feature 6)

-- Chat history table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES relocation_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_plan_created ON chat_messages (plan_id, created_at ASC);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_chat_messages" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);
```

**Migration safety:** This migration has two parts — ALTER TABLE (adds columns to existing table) and CREATE TABLE (new table). If the first part fails, the second won't run. Consider splitting into `025a_plan_columns.sql` and `025b_chat_messages.sql` if your deployment process doesn't support transactional DDL. Supabase Dashboard SQL editor runs the full script as a single transaction — safe to keep combined.

### 4.2 Date & Timezone Handling

All deadline computations use server-side UTC timestamps. No change needed to the existing system. New date computations (visa expiry countdown, pre-move countdown) should:
- Compute client-side from `target_date` / `arrival_date` in UTC
- Display in user's local timezone via `Intl.DateTimeFormat`
- Use `date-fns` (already in package.json via react-day-picker) for date arithmetic

### 4.3 Country Data Normalization

`COUNTRY_DATA` currently covers 6 countries. `OFFICIAL_SOURCES` covers 224. For features that need structured country data (Banking Wizard, Tax Overview), the pattern should be:

1. Check `COUNTRY_DATA[country]` for rich structured data
2. Fall back to `OFFICIAL_SOURCES[country]` for official links only
3. Show "Basic information available — check official sources" for unsupported countries

Do NOT add new countries to `COUNTRY_DATA` as part of this update — that's a content project, not a code project.

### 4.4 Document Status Model

The extended document status shape (Feature 4) should be defined in a shared type file. Both the Documents API and the Visa Tracker's document sub-checklist use the same `document_statuses` JSONB.

```typescript
// lib/gomate/types/document-status.ts
export type DocumentStatus =
  "not_started" | "gathering" | "ready" | "submitted" | "expiring" | "expired"

export type DocumentStatusEntry = {
  status: DocumentStatus
  documentName?: string
  completedAt?: string
  externalLink?: string
  notes?: string
  expiryDate?: string
}
```

### 4.5 Tier Gating for New Features

New features map to existing feature flags as follows:

| Feature | Tier Gate |
|---------|-----------|
| Visa Application Tracker | `pro_single` (documents feature) |
| Pre-Move Interactive Timeline | `pro_single` (guides feature) |
| Income vs Cost Validation | `pro_single` (budget_planner feature) |
| Document Vault enhancements | `pro_single` (documents feature) |
| Salary/Tax Overview | `pro_single` (budget_planner feature) |
| Banking Setup Wizard | `pro_plus` (post_arrival_assistant feature) |
| Tax Registration Guide | `pro_plus` (post_arrival_assistant feature) |
| Compliance Calendar | `pro_plus` (compliance_alerts feature) |
| Visa Renewal Track | `pro_plus` (post_arrival_assistant feature) |
| First 30 Days Mode | `pro_plus` (post_relocation feature) |
| Chat History | All tiers (chat feature) |
| Wellbeing Check-In | `pro_plus` (post_arrival_assistant feature) |
| Plan Consistency Checks | `pro_single` (guides feature) |
| Plan Change Summary | `pro_single` (guides feature) |
| Commonly Forgotten Items | All tiers (free = generic list only; `pro_single`+ = country-specific) |

No new feature flags needed — map to existing ones.

### 4.6 iCal Generation

For Compliance Calendar export: iCal is a simple text format. Generate it as a server-side string with no additional library:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//GoMate//Compliance Calendar//EN
BEGIN:VEVENT
UID:{task.id}@gomate
DTSTART:{deadline_at in YYYYMMDDTHHMMSSZ}
DTEND:{deadline_at + 1 hour}
SUMMARY:{task.title}
DESCRIPTION:{task.description}\n\nOfficial: {task.official_link}
CATEGORIES:GOMATE,COMPLIANCE
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-P7D
DESCRIPTION:Reminder: {task.title}
END:VALARM
END:VEVENT
...
END:VCALENDAR
```

### 4.7 Navigation / App Shell Integration

New pages must be discoverable. The app shell sidebar and dashboard cards are the two discovery mechanisms:

**Sidebar additions** (add to existing `app/(app)/layout.tsx` sidebar):
- Pre-arrival stage (`collecting`, `generating`, `complete`):
  - "Visa Tracker" → `/visa-tracker` (show only when `visa_research` exists)
  - "Timeline" → link to guide timeline tab (not a separate page)
  - "Documents" → existing `/documents` (already in sidebar)
- Post-arrival stage (`arrived`):
  - "Visa Tracker" → `/visa-tracker` (persists across stages)
  - "Banking Guide" → `/banking` (show only when `settling_in_tasks` exist)
  - "Tax Registration" → `/tax-registration` (show only when `settling_in_tasks` exist)
  - "Documents" → existing `/documents`

**Dashboard card CTAs** (link to new pages):
- `VisaTrackerCard` → links to `/visa-tracker`
- Settling-in task cards for banking/tax → link to `/banking` and `/tax-registration` via "View guide →" CTA
- Compliance calendar is a tab on the settling-in page, not a separate nav item

**Tier gating in sidebar:** items for features gated to `pro_single` or `pro_plus` should show as disabled with a lock icon for lower tiers, not hidden entirely. This signals the feature exists.

### 4.8 Shared Utilities — Freetext Parsing

Multiple features need to parse AI-generated freetext into structured values. Create `lib/gomate/text-parsers.ts` with these shared functions:

```typescript
/**
 * Parse a time range string like "4–8 weeks", "2-3 months", "6 weeks"
 * Returns { min, max } in days, or null if unparseable
 */
export function parseTimeRange(text: string): { min: number; max: number } | null {
  // Match patterns: "N–M weeks/months", "N weeks", "N-M months", "approximately N weeks"
  const match = text.match(/(\d+)\s*[–\-–to]+\s*(\d+)\s*(week|month|day)/i)
    || text.match(/(\d+)\s*(week|month|day)/i)
  if (!match) return null
  const unit = match[match.length - 1].toLowerCase()
  const multiplier = unit.startsWith('month') ? 30 : unit.startsWith('week') ? 7 : 1
  if (match[2] && !isNaN(Number(match[2]))) {
    return { min: Number(match[1]) * multiplier, max: Number(match[2]) * multiplier }
  }
  const val = Number(match[1]) * multiplier
  return { min: val, max: val }
}

/**
 * Parse a monetary amount from freetext like "€2,000/month", "$1400", "2000 EUR"
 * Returns the numeric value in the stated currency, or null if unparseable
 */
export function parseAmountFromText(text: string): number | null {
  const match = text.match(/[\$€£]?\s?([\d,]+(?:\.\d{2})?)\s*(?:EUR|USD|GBP|\/month)?/i)
  if (!match) return null
  return Number(match[1].replace(/,/g, ''))
}
```

Used by: Feature 1 (deadline estimation), Feature 9 (renewal milestones), Feature 13 (consistency checks rules 1, 4).

### 4.9 Loading / Error / Empty State Pattern

All new components must handle three states:

1. **Loading**: show a skeleton placeholder matching the component's layout (use `shadcn/ui` `Skeleton` component). Show immediately on mount while data fetches
2. **Error**: show `"Could not load [component name]. Try refreshing the page."` with a "Retry" button that re-fetches. Do not show raw error messages to users
3. **Empty**: show a contextual CTA explaining why the data is missing and what the user should do (e.g., "Complete your research to see visa requirements")

Standard error response shape for all new API routes:
```typescript
// On success: return specific shape per route
// On error: always return this shape
{ error: string } // with appropriate HTTP status code (400, 401, 403, 404, 500)
```

### 4.10 Responsive / Mobile Behavior

All new components must be usable at 375px viewport width:
- Wizards (Banking, Tax Registration): steps stack vertically, one step visible at a time
- Calendar (Compliance Calendar): falls back to list view on viewports < 640px (existing `compliance-timeline.tsx` list is the mobile fallback)
- Stepper (Visa Tracker): vertical layout on mobile, horizontal on desktop
- Dashboard cards: single-column stack on mobile (existing behavior, no change needed)
- Modals (Plan Change Summary): use `shadcn/ui` sheet (bottom drawer) on mobile instead of centered modal

### 4.11 Analytics / Telemetry

No analytics instrumentation in this update. Feature usage tracking is deferred to v2. If a lightweight event system is added later, the key events to track would be:
- Feature page visits (visa-tracker, banking, tax-registration)
- Wellbeing check-in submissions by mood
- Plan consistency warning impressions
- Chat history loads (proxy for return usage)

### 4.12 Feature Flags / Gradual Rollout

No feature flags beyond tier gating (§4.5). All features ship to their tier simultaneously. If a feature causes issues post-deploy, it can be disabled by temporarily changing its tier gate to `null` in the tier mapping — this hides it from all users without a code deploy. This is the kill switch mechanism for v1.

### 4.13 `checklist_progress` Write API Contract

Features 2, 7, and 15 all write to the `checklist_progress` table. The write path is:

- **Route:** `PATCH /api/progress` (existing route at `app/api/progress/route.ts`)
- **Request:** `{ planId: string, itemId: string, completed: boolean }`
- **Behavior:** UPSERT on `(user_id, plan_id, item_id)` — creates the row if it doesn't exist, updates if it does
- **Auth:** `supabase.auth.getUser()` → 401 if no session
- **Item ID namespaces:**
  - Timeline items: `timeline_{phaseIndex}_{taskIndex}`
  - Checklist items: `checklist_{categoryIndex}_{itemIndex}`
  - Tax guide steps: `tax_guide_{stepIndex}`
  - Forgotten items: `forgotten_{countryCode}_{index}`
  - Document items (existing): un-prefixed canonical IDs from `checklist_items`

**Namespace collision prevention:** All new item IDs use a category prefix (`timeline_`, `tax_guide_`, `forgotten_`). Existing document checklist IDs are un-prefixed strings like `passport_valid` or `health_insurance_proof`. No collision is possible because existing IDs never start with these prefixes.

**Before building:** Verify that the existing `PATCH /api/progress` handler accepts arbitrary `item_id` strings and performs UPSERT. If it validates against a known list of IDs, it must be relaxed to accept any string.

### 4.14 COUNTRY_DATA Extension Coordination

Three features extend `COUNTRY_DATA` in `lib/gomate/guide-generator.ts`:
- Feature 5: `taxInfo` field
- Feature 15: `commonlyForgotten` field
- Feature 12: reads `expatCommunity` (already exists, no change needed)

**Coordination rule:** All `COUNTRY_DATA` type extensions must happen in a single commit at the start of Phase B. Update the TypeScript interface first, then populate data per-feature. This prevents merge conflicts when features are built in parallel.

The updated `COUNTRY_DATA` type should add:
```typescript
taxInfo?: { /* see Feature 5 */ }
commonlyForgotten?: Array<{ /* see Feature 15 */ }>
```

### 4.15 Stale Research Data Policy

Multiple features read from AI-generated JSONB fields (`visa_research`, `local_requirements_research`, `banking_section`, `timeline_section`). These can be stale if research was run weeks or months ago.

**Policy for v1:**
- Show "Last researched: {research_completed_at}" date on any view that renders research data (Visa Tracker, Banking Wizard, Tax Registration Guide)
- If `research_completed_at` is more than 30 days ago, show an amber notice: "Research data may be outdated — consider re-running research"
- Do NOT auto-trigger re-research — this is user-initiated
- The `research_completed_at` field already exists on `relocation_plans` (migration 016)

---

## 5. Recommended Build Phases

### Phase A: Data Foundation (Migration + Chat History)

**What is built**: Migration 025 (all new columns + chat_messages table) + chat history API + chat history frontend.

**Why first**: Chat history is a trust-baseline feature. Every other feature adds value on top of a foundation that users trust works. Also, migration 025 unblocks all JSONB-extension features. Running it first means later phases don't need additional DB work.

**Backend tasks**:
- Write `scripts/025_updatev1.sql` with all ALTER TABLE + new chat_messages table (see §4.1 for exact SQL)
- New `/api/chat/history` GET route (fetch last 50 messages for plan, ordered by `created_at ASC`)
- Extend `/api/chat` POST route: use `streamText()` `onFinish` callback to persist both user message and full assistant response (see Feature 11 for streaming capture details)
- RLS policy on chat_messages

**Frontend tasks**:
- On chat page mount: call `/api/chat/history`, hydrate messages state
- Loading state: skeleton messages while fetching
- Empty state: "Start your conversation" for new plans

**Data/model tasks**:
- Migration 025 (run in Supabase dashboard)
- TypeScript types for `ChatMessage`

**Test/verification tasks**:
- Start conversation, refresh page, confirm messages load (ordered by created_at)
- Switch plan, confirm different history loads
- Ensure RLS prevents cross-user reads
- Ensure streaming response is captured via `onFinish` callback — full text persisted, not partial
- Verify that a stream error (e.g., OpenAI timeout) does NOT persist a partial message

**Blockers**: None — independent of all other features.

---

### Phase B: Pre-Move Data Features (No New Tables Needed)

**What is built**: Income vs Cost Validation, Pre-Move Interactive Timeline, Salary/Tax Overview. These three features reuse existing data exclusively.

**Why this order**: All backend data already exists. These are purely frontend + light data extension work. High user value, low risk.

**Backend tasks**:
- Extend `COUNTRY_DATA` type with `taxInfo?` and `commonlyForgotten?` fields in a single type-update commit (see §4.14). Populate `taxInfo` data for 6 countries in this phase; `commonlyForgotten` data is populated in Phase H
- Add `AffordabilityAssessment` computed output as a shared isomorphic utility in `lib/gomate/affordability.ts` (used by both AffordabilityCard frontend and Plan Change Summary backend in Phase H)
- Create `lib/gomate/text-parsers.ts` with `parseTimeRange()` and `parseAmountFromText()` (see §4.8) — used across Phases D and H
- No new routes needed — reads from `/api/guides` + `/api/profile`

**Frontend tasks**:
- `AffordabilityCard` component (income vs cost comparison, tier badge, savings runway)
- `TaxOverviewCard` component (take-home estimate, tax brackets, special regimes, disclaimer)
- `PreMoveTimeline` component (phases from guide, checkboxes, countdown from target_date)
- Wire both cards into dashboard (locked_pre_arrival state)
- Add Timeline tab to `/guides/[id]` page

**Data/model tasks**:
- `taxInfo` field added to COUNTRY_DATA TypeScript type
- Item ID convention for timeline checklist_progress items: `timeline_{phaseIndex}_{taskIndex}` (no guideId — see Feature 2 and §4.13)

**Test/verification tasks**:
- Confirm affordability shows correct amounts from Numbeo fallback for supported cities
- Confirm graceful empty state when city not in Numbeo data
- Confirm tax data correct for all 6 countries (spot-check Germany, Portugal, Netherlands rates)
- Confirm timeline checkboxes persist via checklist_progress API
- Confirm pre-move timeline shows empty state when guide not yet generated

**Blockers**: Guide must be generated (timeline_section must exist).

---

### Phase C: Document Vault Enhancement

**What is built**: Extended document status model with 5 states, external links, notes, expiry dates.

**Why this order**: Simple API + frontend extension on existing system. No migration needed (JSONB is schemaless). Self-contained.

**Backend tasks**:
- Update TypeScript type for `DocumentStatusEntry` in `lib/gomate/types/document-status.ts` (new file)
- Update `PATCH /api/documents` to accept and store new fields (status, externalLink, notes, expiryDate)
- Add URL validation for externalLink: reject non-https, reject javascript: protocol

**Frontend tasks**:
- Extend document card in `/app/(app)/documents/page.tsx`:
  - 5-state status selector (colored badge + dropdown)
  - Expandable detail drawer with external link input, notes textarea, expiry date picker
  - "Expiring soon" / "Expired" badges computed from expiryDate vs today
- Summary bar: "X of Y documents ready"

**Data/model tasks**:
- No migration — JSONB column already exists

**Test/verification tasks**:
- Test each status transition persists correctly
- Test external link validation (reject http://, reject javascript:)
- Test expiry badge display for past and future dates
- Test empty state when checklist_items not yet generated

**Blockers**: None — independent.

---

### Phase D: Visa Application Tracker

**What is built**: Visa application status tracking, document sub-checklist for visa-specific documents, deadline estimation.

**Why this order**: Depends on migration 025 (Phase A) for `visa_application` JSONB column. Should come after Document Vault (Phase C) because it shares the document status model.

**Backend tasks**:
- New `/api/visa-tracker` GET route: returns `{visaApplication, visaResearch, documentChecklist, estimatedDeadline}`
  - Reads `visa_application` JSONB from relocation_plans
  - Reads `visa_research` for visa options and validity
  - Reads `checklist_items` filtered to `visaSpecific === true` items
- New PATCH `/api/visa-tracker` route: updates `visa_application` JSONB fields
- Compute `estimatedDeadline` server-side: `target_date - parseProcessingTime(selectedVisa.processingTime)`

**Frontend tasks**:
- New page: `/app/(app)/visa-tracker/page.tsx`
- Component: `VisaStatusStepper` — 5 steps with colored state
- Component: `VisaDocumentChecklist` — visa-specific documents, reuses document status model
- Component: `VisaDeadlineCard` — estimated apply-by date with countdown
- Dashboard card: `VisaTrackerCard` — shows current status + CTA to open tracker

**Data/model tasks**:
- `visa_application` JSONB column added in migration 025 (Phase A)

**Test/verification tasks**:
- Test visa type selection and status transitions
- Test null state when visa_research not yet populated
- Test estimated deadline with various processing times ("4–8 weeks" → range)
- Test document checklist shows correct items for selected visa type

**Blockers**: Phase A (migration 025).

---

### Phase E: Post-Arrival Guided Flows

**What is built**: Banking Setup Wizard, Tax Registration Guide, First 30 Days Mode.

**Why this order**: Three related post-arrival features. Banking Wizard and Tax Guide both read from local_requirements_research and COUNTRY_DATA. First 30 Days Mode is purely frontend filter on existing tasks.

**Backend tasks**:
- New `/api/banking-wizard` GET route: assembles banking data from guide.banking_section + local_requirements_research (banking category) + COUNTRY_DATA.popularBanks
- New `/api/tax-guide` GET route: assembles tax registration data from local_requirements_research (tax + registration categories) + OFFICIAL_SOURCES[destination]
- Both routes: return assembled wizard JSON — no new DB writes

**Frontend tasks**:
- `/app/(app)/banking/page.tsx` — 4-step wizard (bank selection, digital bridge, documents, branch visit)
- `/app/(app)/tax-registration/page.tsx` — step-by-step guide with checkboxes (persisted to checklist_progress)
- Add "First 30 Days" toggle to settling-in page header
- `DayCounter` component: "Day X" with progress bar
- Filter logic: `deadline_days <= 30 || is_legal_requirement` when toggle active

**Data/model tasks**:
- No migration needed
- Checklist_progress item IDs: `tax_guide_{stepIndex}` (no planId — checklist_progress already scopes by plan_id). Banking wizard uses localStorage, not checklist_progress (see Feature 6)

**Test/verification tasks**:
- Banking wizard shows correct banks for Germany, Netherlands, Portugal, Spain
- Banking wizard falls back to generic for unsupported countries
- Tax guide shows correct country-specific ID name (BSN, NIF, NIE, etc.)
- First 30 days filter correctly excludes tasks with deadline_days > 30 that aren't legal requirements
- DayCounter shows correct day from arrival_date

**Blockers**: Settling-in tasks must exist (stage = arrived, tasks generated). local_requirements_research must be populated.

---

### Phase F: Compliance Calendar + Visa Renewal Track

**What is built**: Calendar view of deadlines with iCal export; visa renewal tracking.

**Why this order**: Both depend on post-arrival data (settling-in tasks + visa application tracker). Comes after Phase E.

**Backend tasks**:
- New `/api/settling-in/export-ical` GET route: generates .ics file from legal requirement tasks
- Extend `/api/visa-tracker` GET to include renewal milestones when visaExpiryDate is set

**Frontend tasks**:
- Extend settling-in page with "Calendar" tab
- `ComplianceCalendar` component using react-day-picker with dot markers per date
- Day popover: task title + status + days remaining + "Mark done" button
- "Download Calendar" button triggering iCal download
- Visa renewal timeline section in visa-tracker page (only shown when expiry date is set)

**Data/model tasks**:
- No migration needed

**Test/verification tasks**:
- iCal file opens correctly in Apple Calendar, Google Calendar
- Calendar dots appear on correct dates
- Day popover shows correct task info
- Renewal timeline shows correct milestones from expiry date

**Blockers**: Phase D (Visa Tracker for renewal feature), Phase E (Compliance Calendar for settling-in tasks).

---

### Phase G: Light Features (Wellbeing Check-In)

**What is built**: Weekly wellbeing check-in prompt with mood tracking.

**Why last**: Nice-to-have. Depends on Phase A (migration 025 for wellbeing_checkins JSONB). Independent of all other phases except A.

**Backend tasks**:
- New `/api/wellbeing` POST route: appends check-in entry to wellbeing_checkins JSONB array (see Feature 12 for response shape and hardcoded messages)
- No GET route in v1 — trend display deferred to v2

**Frontend tasks**:
- `WellbeingCheckin` component: dismissible prompt card with 5 mood options
- Show on settling-in page after arrival_date + 7 days
- localStorage: `gomate:last-checkin-shown` (ISO timestamp, suppress for 7 days)
- Post-submission: short supportive message per mood (hardcoded in v1)
- For struggling/overwhelmed: show expat community links from COUNTRY_DATA.expatCommunity

**Data/model tasks**:
- wellbeing_checkins JSONB added in migration 025 (Phase A)

**Test/verification tasks**:
- Check-in prompt appears after 7 days post-arrival
- Dismissed prompt doesn't reappear for 7 days
- Mood response persists to DB
- Struggling/overwhelmed response shows correct resource links

**Blockers**: Phase A (migration 025).

---

### Phase H: Proactive Intelligence (Consistency Checks + Plan Change Summary + Commonly Forgotten)

**What is built**: Plan consistency checks engine, plan change summary UI, and commonly forgotten items per country. These three features share a theme: making the system proactively helpful rather than passively informational.

**Why this order**: Can be built at any point after Phase B (needs affordability data for budget checks) and Phase C (needs document status for expiry checks). No migration needed. All three are read-only computation layers on existing data. Grouped because they share the same design philosophy and can share UI patterns (alert cards, severity badges).

**Backend tasks**:
- New file: `lib/gomate/plan-consistency.ts` — `validatePlanConsistency(plan)` with 8 heuristic checks (see Feature 13 — rules 5 and 8 removed due to missing data sources)
- New file: `lib/gomate/plan-diff.ts` — `computePlanChangeSummary(oldProfile, newProfile, plan)`
- New route: `/api/plan-checks` GET — returns warnings + commonly forgotten items
- Extend `PATCH /api/profile` response to include `changeSummary` when downstream systems are affected
- Extend `COUNTRY_DATA` type with `commonlyForgotten[]` field; populate for 6 countries

**Frontend tasks**:
- New component: `PlanConsistencyAlerts` — severity-grouped warnings on dashboard
- New component: `PlanChangeSummary` — modal after profile update showing downstream effects
- New component: `CommonlyForgottenSection` — collapsible checklist grouped by timing
- Wire `PlanConsistencyAlerts` into dashboard (all stages)
- Wire `CommonlyForgottenSection` into dashboard (pre-arrival) and settling-in page (post-arrival)
- Wire `PlanChangeSummary` as response handler after profile PATCH calls

**Data/model tasks**:
- No migration needed
- `commonlyForgotten` data for 6 countries (5–8 items each)
- Generic fallback list (5 items) for unsupported countries
- Reuse `checklist_progress` table for forgotten-item checkboxes

**Test/verification tasks**:
- Consistency: set income below visa minimum → critical warning appears
- Consistency: set budget above Numbeo comfortable → green "all clear"
- Consistency: set target_date in the past → warning appears
- Plan change: change arrival_date → summary shows deadline shift with day delta
- Plan change: change destination → summary shows guide stale + action_required
- Forgotten: Germany destination → shows Anmeldung, Rundfunkbeitrag, etc.
- Forgotten: unsupported country → shows generic list
- Forgotten: checkbox persists via checklist_progress

**Blockers**: Phase B (affordability data for budget checks), Phase C (document status for expiry checks). Can run in parallel with Phases D–G.

---

## 6. Detailed Implementation Guidance

### 6.1 Files Affected by Phase

**Phase A: Chat History**
- New file: `scripts/025_updatev1.sql`
- Modified: `app/api/chat/route.ts` — add insert after stream completes
- New file: `app/api/chat/history/route.ts`
- Modified: `app/(app)/chat/page.tsx` — add history fetch on mount

**Phase B: Pre-Move Data Features**
- Modified: `lib/gomate/guide-generator.ts` — add `taxInfo` and `commonlyForgotten` to COUNTRY_DATA type; populate `taxInfo` data for 6 countries
- New file: `lib/gomate/affordability.ts` — shared isomorphic affordability computation (used by frontend card + Phase H plan-diff)
- New file: `lib/gomate/text-parsers.ts` — `parseTimeRange()` + `parseAmountFromText()` (see §4.8)
- New file: `components/affordability-card.tsx`
- New file: `components/tax-overview-card.tsx`
- New file: `components/pre-move-timeline.tsx`
- Modified: `app/(app)/dashboard/page.tsx` — add new cards to locked_pre_arrival state
- Modified: `app/(app)/guides/[id]/page.tsx` — add Timeline tab

**Phase C: Document Vault**
- New file: `lib/gomate/types/document-status.ts`
- Modified: `app/api/documents/route.ts` — accept new fields in PATCH
- Modified: `app/(app)/documents/page.tsx` — extend card UI

**Phase D: Visa Application Tracker**
- New file: `app/api/visa-tracker/route.ts`
- New file: `app/(app)/visa-tracker/page.tsx`
- New files: `components/visa-status-stepper.tsx`, `components/visa-document-checklist.tsx`, `components/visa-deadline-card.tsx`
- Modified: `app/(app)/dashboard/page.tsx` — add VisaTrackerCard

**Phase E: Post-Arrival Guided Flows**
- New file: `app/api/banking-wizard/route.ts`
- New file: `app/api/tax-guide/route.ts`
- New file: `app/(app)/banking/page.tsx`
- New file: `app/(app)/tax-registration/page.tsx`
- Modified: `app/(app)/settling-in/page.tsx` — add First 30 Days toggle + DayCounter

**Phase F: Compliance Calendar + Visa Renewal**
- New file: `app/api/settling-in/export-ical/route.ts`
- New file: `components/compliance-calendar.tsx`
- Modified: `app/(app)/settling-in/page.tsx` — add Calendar tab
- Modified: `app/(app)/visa-tracker/page.tsx` — add renewal section

**Phase G: Wellbeing**
- New file: `app/api/wellbeing/route.ts`
- New file: `components/wellbeing-checkin.tsx`
- Modified: `app/(app)/settling-in/page.tsx` — add check-in card

**Phase H: Proactive Intelligence**
- New file: `lib/gomate/plan-consistency.ts` — consistency check engine (8 rules)
- New file: `lib/gomate/plan-diff.ts` — plan change diff computation (imports `lib/gomate/affordability.ts` from Phase B)
- New file: `app/api/plan-checks/route.ts` — consistency warnings + forgotten items endpoint
- New file: `components/plan-consistency-alerts.tsx` — dashboard warning cards
- New file: `components/plan-change-summary.tsx` — post-update modal
- New file: `components/commonly-forgotten-section.tsx` — country-specific forgotten items
- Modified: `lib/gomate/guide-generator.ts` — add `commonlyForgotten` to COUNTRY_DATA type + data for 6 countries
- Modified: `app/api/profile/route.ts` — extend PATCH response with changeSummary
- Modified: `app/(app)/dashboard/page.tsx` — add PlanConsistencyAlerts + CommonlyForgottenSection
- Modified: `app/(app)/settling-in/page.tsx` — add CommonlyForgottenSection (post-arrival items)

### 6.2 Reuse Patterns — Do Not Duplicate

| Pattern | Existing Location | How to Reuse |
|---------|-----------------|-------------|
| Document status read/write | `/app/api/documents/route.ts` | Extend PATCH to accept new fields; don't create duplicate route |
| Urgency computation | `lib/gomate/post-arrival.ts` buildSettlingView() | Import and call for Compliance Calendar — don't reimplement |
| Cost calculations | `lib/gomate/guide-generator.ts` calculateMonthlyBudget() | Call directly from AffordabilityCard — don't recompute |
| Country official sources | `lib/gomate/official-sources.ts` OFFICIAL_SOURCES | Import for Banking Wizard and Tax Guide — don't hardcode URLs |
| Tier checking | `lib/gomate/tier.ts` getUserTier() | Use in all new API routes — same pattern as existing routes |
| fetchWithRetry | `lib/gomate/fetch-with-retry.ts` | Wrap all new external HTTP calls |
| Auth pattern | Every existing route: `supabase.auth.getUser()` → 401 if no session | Copy exact pattern — no variations |
| Checklist progress | `checklist_progress` table + existing completion API | Reuse for timeline checkboxes, tax guide steps, and commonly forgotten items |
| Profile snapshot | `guides.profile_snapshot` (migration 023) | Use as "old" profile for plan change diff — don't store a separate snapshot |
| Guide staleness | Phase 9 `guide_stale` + `guide_stale_reason` | Plan change summary reads these instead of recomputing staleness |
| Compliance alerts UI | `components/compliance-alerts.tsx` | Consistency check alerts follow the same card pattern — extend, don't duplicate |

### 6.3 What to Keep Lightweight

- **Tax Overview**: Hardcode tax data for 6 countries. Don't build a tax calculation engine. Two tax brackets per country is enough.
- **Banking Wizard**: 4 steps, read from existing data. Don't add bank-specific API integrations or affiliate links.
- **Wellbeing Check-In**: 1 component, 5 mood options, hardcoded responses per mood. No AI generation for responses in v1.
- **First 30 Days Mode**: Client-side filter. No new API. No new DB column.
- **Visa Renewal Track**: Optional section in Visa Tracker. One timeline component. No automated reminders in v1.
- **Plan Consistency Checks**: 10–15 hardcoded heuristic rules. No ML, no dynamic rule engine, no user-configurable thresholds. Pure if/else logic with clear severity assignment.
- **Plan Change Summary**: Computed synchronously on profile PATCH. No stored diff history, no "undo" capability. Show once, dismiss, done.
- **Commonly Forgotten Items**: Hardcoded per-country arrays in COUNTRY_DATA. 5–8 items per country. Do not AI-generate these — curate manually from official sources and expat community knowledge.

### 6.4 What Not to Build

- Email notification delivery — no infrastructure exists and adding SendGrid/Resend is a significant infrastructure project
- Background jobs / cron — Vercel serverless doesn't support persistent background workers; use client-side scheduling only in v1
- File upload / document storage — stay as URL references to external storage only
- Country data expansion beyond 6 existing countries — content project, not an engineering task
- Multiple visa applications on same plan — one tracker per plan is sufficient

---

## 7. Verification & Testing Strategy

### 7.1 Phase A: Chat History

| Test | Type | How |
|------|------|-----|
| Messages persist after page refresh | E2E | Send 3 messages, refresh, confirm they appear |
| Correct plan scoping | Integration | Two plans — confirm chat shows only that plan's history |
| RLS isolation | Security | Attempt to fetch another user's plan_id — must return 0 messages |
| Streaming capture | Integration | Send message, wait for stream completion, check DB row |
| Empty state | UI | New plan — "Start your conversation" shown |
| Plan switch reloads history | E2E | Switch plan in plan switcher, confirm chat changes |

### 7.2 Phase B: Pre-Move Data Features

| Test | Type | How |
|------|------|-----|
| Affordability shows correct budget tiers | Unit | Call calculateMonthlyBudget with Berlin profile → compare to hardcoded Berlin data |
| Graceful fallback for missing city | UI | Set city to "Zurich" (not in Numbeo) → shows "Data not available" state |
| Timeline checkboxes persist | Integration | Check item, refresh page, confirm still checked |
| Countdown shows correct days | Unit | Set target_date 30 days out → shows "30 days until your move" |
| Tax brackets correct | Manual | Spot-check: €5,000/month in Netherlands → confirm ~37% effective rate shown |
| Empty guide state | UI | No guide generated → timeline shows "Generate a guide to activate your timeline" |

### 7.3 Phase C: Document Vault

| Test | Type | How |
|------|------|-----|
| Status transitions persist | Integration | Move document from "not_started" → "ready" → confirm DB updated |
| External link validation | Unit | Submit "http://..." → rejected; "javascript:..." → rejected; "https://..." → accepted |
| Expiry badge correct | UI | Set expiryDate to yesterday → "Expired" badge shown |
| Expiring soon badge | UI | Set expiryDate to today + 15 days → "Expiring soon" badge shown |
| Summary bar count correct | UI | Mark 3 of 7 documents "ready" → "3 of 7 documents ready" |

### 7.4 Phase D: Visa Application Tracker

| Test | Type | How |
|------|------|-----|
| Status persists | Integration | Move to "submitted", refresh → status preserved |
| Null state (no research) | UI | Plan with no visa_research → "Complete your profile and run research first" |
| Multiple visa options | UI | Plan with 3 visa options → user selects one, tracker scopes to that visa |
| Estimated deadline shown | UI | Processing time "4–8 weeks", target_date in 10 weeks → "Apply within X weeks" |
| Document checklist filters visa-specific | Integration | Only documents where visaSpecific=true shown in tracker |

### 7.5 Phase E: Post-Arrival Guided Flows

| Test | Type | How |
|------|------|-----|
| Banking wizard shows correct banks | Manual | Germany destination → Deutsche Bank, ING, N26 shown |
| Banking wizard fallback | UI | Tanzania destination → generic Wise/Revolut recommendation |
| Tax guide shows correct country name | Manual | Netherlands → "BSN Number"; Portugal → "NIF" |
| Tax guide steps checkable | Integration | Check step 1, refresh → step 1 still checked |
| First 30 days filters correctly | Unit | 25 tasks — 8 with deadline_days <= 30 + 3 legal req → 11 shown in filter mode |
| Day counter correct | Unit | arrival_date = today - 8 → shows "Day 8" |
| First 30 days auto-activates | UI | arrival < 7 days ago → default to 30-day mode |

### 7.6 Phase F: Compliance Calendar

| Test | Type | How |
|------|------|-----|
| iCal file validates | Integration | Download .ics, import to Apple Calendar → events appear on correct dates |
| Calendar dots on correct dates | UI | Task deadline_at = 2026-04-15 → April 15 has red dot |
| Day popover content | UI | Click April 15 → shows task title, "5 days left", "Mark done" button |
| Mark done from calendar | Integration | Click "Mark done" → task status updated, dot turns green |
| No tasks state | UI | Pre-generation → "Generate your checklist to see your compliance calendar" |

### 7.7 Phase G: Wellbeing Check-In

| Test | Type | How |
|------|------|-----|
| Prompt appears after 7 days | UI | Set arrival_date = 8 days ago → prompt visible |
| Prompt not shown before 7 days | UI | Set arrival_date = 3 days ago → no prompt |
| Dismissal suppresses for 7 days | UI | Dismiss → check localStorage timestamp → prompt not shown on reload |
| Mood response correct | Integration | Submit "overwhelmed" → supportive message + expat community links shown |
| Response persists to DB | Integration | Submit mood, check relocation_plans.wellbeing_checkins array |

### 7.8 Phase H: Proactive Intelligence

| Test | Type | How |
|------|------|-----|
| Income below visa minimum triggers critical warning | Integration | Set monthly_income = 1400, visa requires 2000 → INCOME_BELOW_VISA_MINIMUM warning shown |
| Budget above Numbeo comfortable shows all-clear | Integration | Set monthly_budget = 4000 for Berlin → no budget warnings, green state |
| Target date in the past triggers warning | Unit | Set target_date = yesterday, stage = complete → TARGET_DATE_PASSED warning |
| Savings insufficient triggers warning | Unit | savings = 2000, budget = 1500 → SAVINGS_INSUFFICIENT (< 3 months) |
| Plan change: destination triggers action_required | Integration | Change destination from Germany to Portugal → summary shows guide stale + visa stale |
| Plan change: arrival_date shows day delta | Integration | Move arrival_date by 14 days → summary shows "deadlines shifted by 14 days" |
| Plan change: minor field no summary | Integration | Change a non-tracked field → no summary modal appears |
| Forgotten items: Germany shows correct items | UI | Germany destination → Anmeldung, Rundfunkbeitrag, Haftpflichtversicherung visible |
| Forgotten items: unsupported country shows generic | UI | Set destination to "Kenya" → generic 5-item list shown |
| Forgotten items: checkbox persists | Integration | Check "Deregister from home", refresh → still checked |
| Forgotten items: timing filter works | UI | Pre-arrival shows "before_move" items; post-arrival shows "first_week" + "first_month" |
| Consistency checks handle null visa_research | UI | Plan with no visa_research → income vs visa check skipped, no crash |

### 7.9 Regression Tests

After each phase, verify these existing flows still work:
- Post to `/api/chat` → extracts profile fields, responds correctly
- PATCH `/api/profile` with action="lock" → locks plan, generates guide, triggers research
- GET `/api/settling-in` → returns correct task list with urgency computed
- PATCH `/api/settling-in/[id]` → status update triggers dependency unlock
- Compliance alerts show on dashboard when overdue tasks exist

---

## 8. Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|-----------|
| Tax data becomes stale (rate changes) | Medium | High | Show year on all tax data; link to official source; add "verify before filing" disclaimer on every display |
| Banking recommendations perceived as endorsements | Medium | Medium | Add explicit "no commercial relationship" disclaimer; show multiple options |
| visa_research null when Visa Tracker accessed | High | Medium | Check null on every read; return 404 or empty state with clear CTA |
| Chat history insert timing (stream + DB) | Low | Low | Insert via `onFinish` callback after stream completes; brief delay acceptable; `created_at` ordering eliminates concurrency issues |
| iCal timezone handling | Medium | Medium | All DTSTART must use UTC (Z suffix); test with iOS and Google Calendar explicitly |
| Affordability comparisons misinterpreted as guarantees | Medium | Medium | Always show "estimated range"; never show single number without range qualifier |
| Document external links pointing to phishing/malware | High | Low | Validate https:// only; user types their own URL (Drive/Dropbox); add disclaimer that GoMate doesn't vet external links |
| COUNTRY_DATA covers only 6 countries | Medium | High | Graceful fallback pattern everywhere; clearly labeled "Basic guidance available" for unsupported countries |
| First 30 Days filter leaves user with 0 tasks | Low | Low | If filter returns 0 tasks, fall back to showing first 5 by sort_order with note "No time-sensitive tasks found" |
| Wellbeing data stored in JSONB array grows large | Low | Very Low | Cap at 52 entries (1 year of weekly check-ins) in the PATCH route; old entries auto-trimmed |
| Chat history grows unbounded | Low | Low | LIMIT 50 in GET route; older messages not loaded in v1 (acceptable) |
| local_requirements_research is partial or failed | Medium | Medium | Every feature reading from it must handle null gracefully; fallback to OFFICIAL_SOURCES links |
| Consistency check false positives | High | Medium | Default to "suggestion" severity when uncertain; only promote to "critical" for clearly parseable numeric mismatches (income < requirement). Better to miss a warning than show a wrong one |
| Plan change summary noise | Medium | Medium | Only trigger summary for fields that affect downstream systems (10 tracked fields). Ignore cosmetic profile changes (name, notes). If no effects computed, don't show the modal |
| Commonly forgotten items become stale | Medium | High | Add `lastVerified` date to data; show "Last verified: [date]" in UI. Review content quarterly. Link to official sources where possible |
| Commonly forgotten generic list too vague | Low | Medium | Keep generic list to universally applicable items (deregister, insurance gaps, emergency numbers, SIM, language basics). Don't include anything country-specific in the fallback |

---

## 9. Practical Recommendations

### What to Build First

1. **Migration 025 + Chat History (Phase A)** — Run the migration immediately, build chat persistence in the same session. This is the highest-trust fix. Users currently lose their chat on every refresh. Fix this before everything else.

2. **Income vs Cost Validation + Pre-Move Timeline (Phase B)** — No backend work. Pure frontend. High perceived value. Can ship within 1–2 sessions.

3. **Document Vault Enhancement (Phase C)** — Small, contained, no migration. Ships fast.

4. **Proactive Intelligence (Phase H)** — After Phases B and C are done. No migration, no new tables. Pure logic + UI. This is the feature set that makes GoMate feel like a guardian, not just a guide. High differentiation value.

### What to Keep Intentionally Simple

- **Salary/Tax Overview**: 6 countries, hardcoded rates, clear disclaimer. Do not build a tax calculation engine. Do not add more countries until the 6 are verified accurate.
- **Wellbeing Check-In**: 1 component, 5 moods, hardcoded responses. No AI generation for v1. The value is the gesture, not the sophistication.
- **First 30 Days Mode**: A CSS class + a filter function. That's it.
- **Banking Wizard**: Read-only guide using existing data. No bank API integrations. No affiliate setup.
- **Plan Consistency Checks**: 10–15 if/else rules. No dynamic rule engine. Conservative severity defaults.
- **Commonly Forgotten Items**: Curated static arrays. No AI generation. 5–8 items per country.

### What Must NOT Be Overbuilt

- **Notifications**: Do not add email delivery infrastructure to this update. No background jobs. No cron. The compliance calendar export to iCal is the v1 answer to the reminder problem — users' calendar apps handle the actual alerts.
- **Document Storage**: No Supabase Storage uploads for user documents. URLs only. The legal and security risk of storing passports and bank statements outweighs the UX benefit.
- **Tax Engine**: No dynamic tax calculation from rates + brackets + deductions. Show one bracket, one effective rate estimate, and link to the official calculator.

### Where the Repo Gives Leverage

- **Numbeo + guide budget calculations already work** — AffordabilityCard is 90% data plumbing of existing outputs.
- **local_requirements_research is already structured** — Banking Wizard and Tax Guide are presentation layers on top of existing research data.
- **checklist_progress table is already there** — Timeline checkboxes and Tax Guide step tracking cost nothing in backend terms.
- **react-day-picker is already installed** — Compliance Calendar is a styling + data-mapping problem, not a dependency problem.
- **compliance-timeline.tsx already renders deadline list** — Calendar is a view mode extension of this component.

### Where to Be Careful

- **chat_messages ordering**: Uses `created_at ASC` instead of a sequence_number column. This eliminates the MAX+1 race condition entirely. Multi-tab concurrent inserts are ordered by timestamp — no conflict possible.
- **Visa application tracking**: The estimated "apply by" deadline derived from processing time strings is approximate at best. Label it clearly: "Based on typical processing times — verify with the embassy."
- **Country data for Banking and Tax features**: The 6-country limitation is real. Ship with a clear "not yet available" state for other countries rather than showing incomplete or wrong data.
- **Guide staleness**: Pre-Move Timeline reads from the guide's timeline_section. If the user regenerates their guide, the checklist_progress entries for old timeline items become orphaned. This is acceptable in v1 — just document it and show a "Timeline refreshed" notice.
