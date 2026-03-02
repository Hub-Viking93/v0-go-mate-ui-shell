# Guide Generation — System Document

**Phase:** 4.1 / 8 (PDF Export addendum)
**Status:** Reality-first (documents what exists)
**Primary sources:**
- `lib/gomate/guide-generator.ts` (1,224 lines)
- `lib/gomate/pdf-generator.ts` (641 lines) — added Phase 8
- `app/api/guides/route.ts` (139 lines)
- `app/api/guides/[id]/route.ts` (65 lines)
- `app/(app)/guides/[id]/page.tsx` (936 lines) — added Phase 8
- `scripts/005_create_guides.sql`
- `scripts/007_add_guide_type.sql`
**Last audited:** 2026-02-25

---

## 1. Overview

The guide generation system produces a comprehensive, personalized relocation guide for a user once their profile is complete. Guide generation is **synchronous and entirely deterministic** — there is no AI call. Content is assembled from pre-compiled country data, profile-derived calculations, and static templates.

**Critical finding:** Despite the file being called `guide-generator.ts` and the system being described as "comprehensive guide generation," no language model is invoked. Every section of the guide is generated through pure TypeScript logic from profile data and a static `COUNTRY_DATA` registry.

---

## 2. Guide Interface

```typescript
export interface Guide {
  id?: string
  title: string
  destination: string
  destinationCity?: string
  purpose: string
  overview: GuideOverview
  visa: VisaSection
  budget: BudgetSection
  housing: HousingSection
  banking: BankingSection
  healthcare: HealthcareSection
  culture: CultureSection
  jobs?: JobsSection           // only if purpose === "work" | "digital_nomad"
  education?: EducationSection // only if purpose === "study"
  nightlife?: NightlifeSection       // interface defined, never assigned
  safety?: SafetySection             // interface defined, never assigned
  expatCommunity?: ExpatCommunitySection  // interface defined, never assigned
  transport?: TransportSection       // interface defined, never assigned
  food?: FoodSection                 // interface defined, never assigned
  timeline: TimelineSection
  checklist: ChecklistSection
  officialLinks: { name: string; url: string; category: string }[]
  usefulTips: string[]
  createdAt: string
  status: "draft" | "generating" | "complete"
}
```

### 2.1 Always-generated sections (8 core)

| Section | Interface | Content source |
|---|---|---|
| `overview` | `GuideOverview` | Profile + COUNTRY_DATA + getVisaStatus() |
| `visa` | `VisaSection` | generateVisaRecommendation() from profile-summary.ts + visa-checker.ts |
| `budget` | `BudgetSection` | getCostOfLivingData() + calculateMonthlyBudget() + calculateSavingsTarget() |
| `housing` | `HousingSection` | COUNTRY_DATA.rentalPlatforms + cost of living |
| `banking` | `BankingSection` | COUNTRY_DATA.popularBanks + COUNTRY_DATA.bankingNotes |
| `healthcare` | `HealthcareSection` | COUNTRY_DATA.healthcareSystem + destination-specific steps |
| `culture` | `CultureSection` | COUNTRY_DATA.cultureTips + language data |
| `timeline` | `TimelineSection` | Profile.timeline + purpose-based phase generation |

### 2.2 Purpose-specific sections (conditional)

| Purpose | Extra section |
|---|---|
| `work` or `digital_nomad` | `jobs` — using COUNTRY_DATA.jobPlatforms |
| `study` | `education` — using COUNTRY_DATA-derived institution data |
| All others | No extra section |

### 2.3 Defined but never generated

Five section interfaces are fully defined in the file (`NightlifeSection`, `SafetySection`, `ExpatCommunitySection`, `TransportSection`, `FoodSection`) and have corresponding fields in `COUNTRY_DATA`, but `generateGuide()` never assigns them to the `guide` object. These are effectively dead interface definitions in the current implementation.

---

## 3. COUNTRY_DATA Registry

`COUNTRY_DATA` is a `Record<string, {...}>` with rich data for **6 countries**:

| Country | Currency | Language | Has nightlife data | Has safety data |
|---|---|---|---|---|
| Germany | EUR | German | No | No |
| Netherlands | EUR | Dutch | No | No |
| Spain | EUR | Spanish | No | No |
| Portugal | EUR | Portuguese | No | No |
| Sweden | SEK | Swedish | No | No |
| Japan | JPY | Japanese | No | No |

Each entry contains:
- `currency`, `language`, `englishLevel`
- `healthcareSystem` (description string)
- `bankingNotes` (string)
- `cultureTips` (string array)
- `popularBanks` (array with name, type, features)
- `rentalPlatforms` (array with name, url, description)
- `jobPlatforms` (array with name, url, description)
- Optional: `nightlife`, `safety`, `expatCommunity`, `transport`, `food` (all null in current data)

**`DEFAULT_COUNTRY_DATA`** (`const DEFAULT_COUNTRY_DATA = {...}` at line 592) is used for all destinations not in the 6-country registry. It provides generic English-language placeholder content.

**Gap:** A user relocating to the United States, Canada, Australia, UAE, or any of the other ~50 destinations in `official-sources.ts` receives generic `DEFAULT_COUNTRY_DATA` content rather than country-specific guidance.

---

## 4. generateGuide() Function

`generateGuide(profile: Profile): Guide` — synchronous, no async, no external calls.

```
generateGuide(profile)
│
├── destination = profile.destination || "Unknown"
├── countryData = COUNTRY_DATA[destination] || DEFAULT_COUNTRY_DATA
├── costOfLiving = getCostOfLivingData(destination, city)   ← synchronous lookup
├── budgetData = calculateMonthlyBudget(profile, costOfLiving)
├── savingsData = calculateSavingsTarget(profile, budgetData.comfortable)
├── visaRec = generateVisaRecommendation(profile)           ← from profile-summary.ts
├── officialSources = getOfficialSourcesArray(destination)  ← from official-sources.ts
├── visaStatus = getVisaStatus(citizenship, destination)    ← from visa-checker.ts
│
├── Build guide object:
│   ├── Always: overview, visa, budget, housing, banking, healthcare, culture, timeline, checklist
│   ├── If purpose=work|digital_nomad: jobs
│   └── If purpose=study: education
│
└── Return Guide (status: "complete")
```

**No network I/O.** All data is pre-compiled in static TypeScript files.

### 4.1 guideToDbFormat()

Maps a `Guide` object to the `guides` table column structure:

```typescript
export function guideToDbFormat(guide: Guide, userId: string, planId?: string) {
  return {
    user_id, plan_id, title, destination, destination_city, purpose,
    overview,           // → overview JSONB column
    visa_section,       // → visa_section JSONB column
    budget_section,     // → budget_section JSONB column
    housing_section,    // → housing_section JSONB column
    banking_section,    // → banking_section JSONB column
    healthcare_section, // → healthcare_section JSONB column
    culture_section,    // → culture_section JSONB column
    jobs_section,       // → jobs_section JSONB column (null if not work/nomad)
    education_section,  // → education_section JSONB column (null if not study)
    timeline_section,   // → timeline_section JSONB column
    checklist_section,  // → checklist_section JSONB column
    official_links,     // → official_links JSONB column
    useful_tips,        // → useful_tips JSONB column
    status,
  }
}
```

Note: `nightlife_section`, `safety_section`, `expat_community_section`, `transport_section`, and `food_section` columns do not exist in the `guides` table. These optional sections have no DB representation.

### 4.2 generateGuideFromProfile()

An alternative entry point at line 1173 that wraps `generateGuide()` with additional formatting. Both functions call `generateGuide()` internally.

---

## 5. guides Table (migration 005 + 007)

### 5.1 Column Definitions

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | uuid PK | gen_random_uuid() | |
| `user_id` | uuid FK → auth.users | | cascade delete |
| `plan_id` | uuid FK → relocation_plans | | set null on plan delete |
| `title` | text | — | Required |
| `destination` | text | — | Required |
| `destination_city` | text | — | Optional |
| `purpose` | text | — | study / work / settle / digital_nomad |
| `overview` | jsonb | `{}` | GuideOverview |
| `visa_section` | jsonb | `{}` | VisaSection |
| `budget_section` | jsonb | `{}` | BudgetSection |
| `housing_section` | jsonb | `{}` | HousingSection |
| `banking_section` | jsonb | `{}` | BankingSection |
| `healthcare_section` | jsonb | `{}` | HealthcareSection |
| `culture_section` | jsonb | `{}` | CultureSection |
| `jobs_section` | jsonb | `{}` | JobsSection (null if not applicable) |
| `education_section` | jsonb | `{}` | EducationSection (null if not applicable) |
| `timeline_section` | jsonb | `{}` | TimelineSection |
| `checklist_section` | jsonb | `{}` | ChecklistSection |
| `official_links` | jsonb | `[]` | Array of {name, url, category} |
| `useful_tips` | jsonb | `[]` | Array of strings |
| `status` | text | `'draft'` | draft / generating / complete / archived |
| `guide_type` | text | `'main'` | Added in migration 007 |
| `created_at` | timestamptz | now() | |
| `updated_at` | timestamptz | now() | |
| `completed_at` | timestamptz | — | Optional |

### 5.2 guide_type (migration 007)

Added via `scripts/007_add_guide_type.sql`. Default `'main'`. Two indexes:
- `idx_guides_type` on `guide_type`
- `idx_guides_user_destination` on `(user_id, destination, purpose, guide_type)`

**Gap:** `guide_type` is set to `'main'` by default but is never set to any other value in `guideToDbFormat()`. There is no code path that creates a non-`'main'` guide type. The column exists for future use.

### 5.3 RLS Policies

4 policies: select, insert, update, delete — all restricted to `auth.uid() = user_id`.

---

## 6. API Endpoints

### 6.1 GET /api/guides

Returns all guides for the authenticated user, ordered by `created_at DESC`.

```typescript
Response: { guides: Guide[] }
```

No query parameters. No filtering by destination or guide_type.

### 6.2 POST /api/guides

Generates or updates a guide for a plan.

```
POST /api/guides
{ planId?: string }
│
├── Auth check
├── Load profile from planId or current plan
├── Require profile.destination
│
├── Check for existing guide:
│   .eq("destination", profile.destination)
│   .eq("purpose", profile.purpose || "other")
│
├── If exists: generateGuide(profile) → UPDATE existing record
└── If not:    generateGuide(profile) → INSERT new record
```

**Upsert logic:** The uniqueness check is on `(destination, purpose)` — not on `plan_id`. A user can only have one guide per destination+purpose combination. A second request for the same destination/purpose updates the existing guide rather than creating a new one.

**maxDuration: 60 seconds** — set on the route handler. This is conservative; guide generation is synchronous and typically completes in milliseconds.

### 6.3 GET /api/guides/[id]

Returns a single guide by UUID. Enforces ownership via `user_id` check.

### 6.4 DELETE /api/guides/[id]

Deletes a guide by UUID. Enforces ownership. Returns `{ success: true }`.

**Gap:** No PATCH/PUT endpoint for updating specific sections of a guide. The only update path is POST /api/guides which regenerates the entire guide and overwrites the record.

---

## 7. Guide Generation Trigger

Guide generation is triggered by plan lock in `PATCH /api/profile`. When a user locks their profile (`locked: true`), the route calls `POST /api/guides` (via internal function import or direct HTTP). This is documented in detail in Phase 2.1 (Chat Engine SystemDoc).

Guide generation can also be called directly by the client at any time via `POST /api/guides`.

---

## 8. Gap Analysis — Critical Findings

### G-4.1-A: Guide generation is not AI-powered

The name "guide-generator.ts" implies AI generation, and the roadmap describes it as "comprehensive guide generation from completed profiles." In reality, all content is assembled from pre-compiled TypeScript data structures and simple string templates. No AI model is invoked at any point. The output quality is entirely dependent on the static `COUNTRY_DATA` registry.

### G-4.1-B: COUNTRY_DATA covers only 6 of 50+ supported destinations

Rich, country-specific content exists for Germany, Netherlands, Spain, Portugal, Sweden, and Japan. For all other destinations (United States, United Kingdom, Canada, Australia, UAE, Japan, and the remaining ~44 countries in `official-sources.ts`), users receive generic fallback content from `DEFAULT_COUNTRY_DATA`.

### G-4.1-C: Five guide sections are defined but never generated

`NightlifeSection`, `SafetySection`, `ExpatCommunitySection`, `TransportSection`, and `FoodSection` interfaces are fully defined and have optional counterpart fields in `COUNTRY_DATA`, but `generateGuide()` never assigns them. This is dead interface code — the `Guide` type accepts these fields but they are never populated.

### G-4.1-D: guide_type column exists but is always "main"

Migration 007 adds `guide_type text default 'main'`. The field is indexed for performance but `guideToDbFormat()` never sets it to anything other than the default. The infrastructure for guide type differentiation is in place but unused.

### G-4.1-E: No guide versioning or invalidation

When `POST /api/guides` is called, it overwrites the existing guide (by destination+purpose). There is no version history. If a user updates their profile after guide generation, re-triggering generation silently replaces the previous guide with no record of what changed.

### G-4.1-F: Budget section uses dead-code cost data

`generateBudgetSection()` calls `getCostOfLivingData()` from `web-research.ts` (the synchronous fallback, 12 countries, country-level estimates). The same data inconsistency documented in Phase 3.2 applies here: values may differ from the Numbeo-sourced data shown in the cost-of-living dashboard.

---

## 9. Target State

| Item | Current | Target |
|---|---|---|
| Content generation | Static COUNTRY_DATA templates | AI-assisted generation with live data enrichment |
| Country coverage | 6 countries with rich data | All 50+ destinations in official-sources.ts |
| Dead guide sections | 5 interfaces defined, never used | Either wire in (nightlife/safety/transport/food/expat) or remove |
| guide_type | Always "main" | Used to distinguish pre-relocation vs. post-arrival guides |
| Guide versioning | No history | Version snapshots on each regeneration |
| Invalidation | Manual regeneration only | Trigger re-generation when key profile fields change |
| API coverage | GET list, POST generate, GET single, DELETE | Add PATCH for section-level updates |

---

## 10. PDF Export System — `lib/gomate/pdf-generator.ts`

**Added:** Phase 8
**Source file:** `lib/gomate/pdf-generator.ts` (641 lines)
**Caller:** `app/(app)/guides/[id]/page.tsx` (936 lines)

### 10.1 Overview

`pdf-generator.ts` is a `"use client"` module that generates a downloadable A4 PDF from a guide object using `jsPDF` (version 4.0.0). It is the only PDF generation path in the codebase and is entirely client-side — no server-side rendering.

The module exposes two exports:

```typescript
export async function generateGuidePDF(guide: GuideData): Promise<Blob>
export function downloadGuidePDF(guide: GuideData, filename?: string): void
```

`generateGuidePDF()` builds the PDF in memory and returns a `Blob`. `downloadGuidePDF()` calls `generateGuidePDF()` then triggers a browser download via a synthetic `<a>` element with `URL.createObjectURL()`.

### 10.2 GuideData Interface

`pdf-generator.ts` defines its own `GuideData` interface. This is **not** the `Guide` type from `guide-generator.ts` and **not** the `Guide` type defined locally in `guides/[id]/page.tsx`. Three parallel guide type definitions exist across three files. None are imported from a shared module.

```typescript
// pdf-generator.ts — GuideData
interface GuideData {
  title: string
  destination: string
  destination_city?: string
  purpose: string
  overview?: { title, subtitle, summary, keyFacts, lastUpdated }
  visa_section?: { recommendedVisa, visaType, eligibility, processingTime,
                   estimatedCost, requirements[], applicationSteps[], tips[], warnings[], officialLink? }
  budget_section?: { monthlyBudget: { minimum, comfortable, breakdown },
                     savingsTarget: { emergencyFund, movingCosts, initialSetup, visaFees, total, timeline },
                     costComparison?, tips[] }
  housing_section?: { overview, averageRent: { studio, oneBed, twoBed },
                      rentalPlatforms[], depositInfo, tips[], warnings[] }
  banking_section?: { overview, recommendedBanks[], requirements[], tips[] }
  healthcare_section?: { overview, systemType, insuranceRequired: boolean,
                         averageCost: string, emergencyInfo, tips[] }
  culture_section?: { overview, doAndDont: { do: string[], dont: string[] },
                      languageTips[], socialNorms[] }
  timeline_section?: { phases: { name, timeframe, tasks: { task, priority, completed? }[] }[] }
  checklist_section?: { categories: { name, items: { item, priority, completed? }[] }[] }
  official_links?: { name, url, category }[]
  useful_tips?: string[]
}
```

### 10.3 PDF Structure

The generator produces an A4 portrait document with the following page sequence:

| Page | Content |
|---|---|
| 1 (Cover) | Blue header band, destination name, "RELOCATION GUIDE" subtitle, purpose label, overview summary, key facts table, generation date footer |
| 2 | Visa & Immigration section |
| 3 | Budget & Finances section |
| 4 | Housing & Accommodation section |
| 5 | Banking & Finances section |
| 6 | Healthcare section |
| 7 | Culture & Lifestyle section |
| 8 | Relocation Timeline section (phases with priority-coloured task markers) |
| 9 | Document Checklist section (printable checkbox items) |
| 10 | Additional Resources (useful tips + official links) |

Sections are skipped entirely if their corresponding guide field is `undefined` or `null`. Pages are numbered in the footer. `addNewPageIfNeeded()` handles overflow by adding pages mid-section when content exceeds the page margin.

**Note:** The budget section hardcodes the `€` symbol for all monetary values regardless of destination currency.

### 10.4 Call Site — `app/(app)/guides/[id]/page.tsx`

`app/(app)/guides/[id]/page.tsx` is the guide detail page. It was not documented in any prior phase. Key behaviours:

- Fetches a single guide from `GET /api/guides/[id]` on mount
- Applies defensive defaults for missing sections (e.g. `guideData.visa_section = guideData.visa_section || { recommendedVisa: "Not available", ... }`)
- Renders the guide in a tabbed interface: Overview, Visa, Budget, Housing, Practical (banking + healthcare), Culture, Jobs (conditional), Education (conditional), Timeline, Checklist
- "Download PDF" button calls `downloadGuidePDF(guide)` — passing its own local `Guide` type to the function, which expects `GuideData`
- "Regenerate" button calls `POST /api/guides` with an empty body
- "Delete" button calls `DELETE /api/guides/[id]` then navigates to `/guides`

### 10.5 Interface Mismatch Table

The three guide type definitions (`guide-generator.ts → Guide`, `guides/[id]/page.tsx → Guide`, `pdf-generator.ts → GuideData`) diverge on several fields. Fields passed from the page to the PDF renderer that do not match:

| Field path | `guides/[id]/page.tsx` | `pdf-generator.ts GuideData` | Effect |
|---|---|---|---|
| `healthcare_section.insuranceRequired` | `insuranceRequirements: string` | `insuranceRequired: boolean` | PDF renders `undefined` for insurance field |
| `culture_section.doAndDont` | `doAndDonts: { dos[], donts[] }` | `doAndDont: { do[], dont[] }` | PDF renders empty Do's/Don'ts lists |
| `timeline_section.phases[].tasks` | `string[]` (flat strings) | `{ task, priority, completed? }[]` (objects) | PDF renders `undefined` for each task text; priority markers malfunction |
| `checklist_section.categories[].items[].item` | `item.task: string` | `item.item: string` | PDF renders `undefined` for each checklist item label |
| `banking_section` | includes `digitalBanks[]` field | no `digitalBanks` field | Extra field silently ignored |
| `timeline_section.totalMonths` | present | absent | Not used by PDF anyway |

---

## 11. Gap Analysis — Critical Findings (Updated)

### G-4.1-A: Guide generation is not AI-powered

The name "guide-generator.ts" implies AI generation, and the roadmap describes it as "comprehensive guide generation from completed profiles." In reality, all content is assembled from pre-compiled TypeScript data structures and simple string templates. No AI model is invoked at any point. The output quality is entirely dependent on the static `COUNTRY_DATA` registry.

### G-4.1-B: COUNTRY_DATA covers only 6 of 50+ supported destinations

Rich, country-specific content exists for Germany, Netherlands, Spain, Portugal, Sweden, and Japan. For all other destinations, users receive generic fallback content from `DEFAULT_COUNTRY_DATA`.

### G-4.1-C: Five guide sections are defined but never generated

`NightlifeSection`, `SafetySection`, `ExpatCommunitySection`, `TransportSection`, and `FoodSection` interfaces are fully defined and have optional counterpart fields in `COUNTRY_DATA`, but `generateGuide()` never assigns them.

### G-4.1-D: guide_type column exists but is always "main"

Migration 007 adds `guide_type text default 'main'`. The field is indexed for performance but `guideToDbFormat()` never sets it to anything other than the default.

### G-4.1-E: No guide versioning or invalidation

When `POST /api/guides` is called, it overwrites the existing guide (by destination+purpose). There is no version history.

### G-4.1-F: Budget section uses dead-code cost data

`generateBudgetSection()` calls `getCostOfLivingData()` from `web-research.ts` (the synchronous fallback, 12 countries, country-level estimates). Values may differ from the Numbeo-sourced data shown in the cost-of-living dashboard.

### G-4.1-G: PDF renderer receives incompatible data at runtime

`downloadGuidePDF(guide)` in `guides/[id]/page.tsx` passes the page's local `Guide` type to a function expecting `GuideData`. TypeScript does not catch this at compile time because the call uses the same variable name. At runtime, four fields render as `undefined` in the generated PDF: insurance field, Do's/Don'ts lists, timeline task text, and checklist item labels. The PDF is partially broken for every user who downloads it.

### G-4.1-H: Three independent guide type definitions, no shared source

`guide-generator.ts`, `guides/[id]/page.tsx`, and `pdf-generator.ts` each define their own `Guide`/`GuideData` interface without importing from a shared module. These have drifted apart (see mismatch table above). Any change to guide structure requires updating three separate type definitions.

### G-4.1-I: `guides/[id]/page.tsx` undocumented until Phase 8

The guide detail page (936 lines) was not covered in any prior phase document. It is the only route that renders a full individual guide and the only UI that provides the PDF download, regenerate, and delete actions.

---

## 12. Target State

| Item | Current | Target |
|---|---|---|
| Content generation | Static COUNTRY_DATA templates | AI-assisted generation with live data enrichment |
| Country coverage | 6 countries with rich data | All 50+ destinations in official-sources.ts |
| Dead guide sections | 5 interfaces defined, never used | Either wire in or remove |
| guide_type | Always "main" | Distinguish pre-relocation vs. post-arrival guides |
| Guide versioning | No history | Version snapshots on each regeneration |
| Invalidation | Manual regeneration only | Trigger re-generation when key profile fields change |
| API coverage | GET list, POST generate, GET single, DELETE | Add PATCH for section-level updates |
| Guide type definitions | Three divergent interfaces | Single shared `Guide` type imported by all consumers |
| PDF export | Browser-only, partially broken | Fix interface mismatch; optionally add server-side PDF |
| Budget currency | Hardcoded `€` | Derive currency symbol from destination |
