# Visa Logic — System Document

**Phase:** 2.3
**Status:** Reality-first (documents what exists)
**Primary sources:**
- `lib/gomate/visa-checker.ts` (149 lines)
- `lib/gomate/visa-recommendations.ts` (434 lines)
- `lib/gomate/visa-advisor.ts` (11 lines)
- `lib/gomate/profile-summary.ts` (410 lines)
- `app/api/research/visa/route.ts` (516 lines)
**Last audited:** 2026-02-24

---

## 1. Overview

The visa logic layer spans five files that collectively determine:

1. Whether a user needs a visa at all (EU freedom of movement check)
2. What visa type to recommend (static hardcoded recommendations)
3. How to present the profile back to the user in review state
4. What disclaimer text to attach to visa advice
5. How to research live visa requirements from official sources (Firecrawl + GPT-4o-mini)

These five files were developed somewhat independently and contain significant naming and field-reference mismatches relative to each other and to the current profile schema. The result is a fragmented visa logic layer with multiple ghost-field references and two parallel recommendation systems that serve different callers.

---

## 2. File Inventory

| File | Exports | Used by |
|---|---|---|
| `visa-checker.ts` | `isEuEea()`, `hasFreedomOfMovement()`, `getVisaStatus()`, `getVisaBadge()`, `VisaBadgeType` | `chat/route.ts`, `profile-summary.ts` |
| `visa-recommendations.ts` | `VisaRecommendation` (interface), `ProfileSummary` (interface), `generateProfileSummary()` (→ object), `generateVisaRecommendations()`, `formatRecommendationsForAI()` | `system-prompt.ts` |
| `visa-advisor.ts` | `VISA_DISCLAIMER`, `VISA_DISCLAIMER_SHORT`, `getVisaDisclaimer()` | **Nobody** — not imported anywhere in the codebase |
| `profile-summary.ts` | `generateProfileSummary()` (→ string), `VisaRecommendation` (different interface), `generateVisaRecommendation()`, `formatVisaRecommendation()` | `chat/route.ts` |
| `app/api/research/visa/route.ts` | `VisaOption` (interface), `VisaResearchResult` (interface), `POST` handler, `GET` handler | Dashboard/frontend that triggers visa research |

---

## 3. visa-checker.ts — Freedom of Movement

### 3.1 Purpose

Fast, synchronous, deterministic check: does this citizenship get EU freedom of movement to this destination? Returns a badge type (`visa-free`, `visa-required`, `check-required`) for UI display.

### 3.2 Data

```typescript
const euEeaCountries = new Set([
  "austria", "belgium", "bulgaria", "croatia", "cyprus",
  "czech republic", "czechia", "denmark", "estonia",
  "finland", "france", "germany", "greece", "hungary",
  "iceland", "ireland", "italy", "latvia", "liechtenstein",
  "lithuania", "luxembourg", "malta", "netherlands", "norway",
  "poland", "portugal", "romania", "slovakia", "slovenia",
  "spain", "sweden", "switzerland"     // ← Note: switzerland IS in this set
])

const swissCountries = new Set(["switzerland"])
```

**Note on Switzerland:** `switzerland` appears in both `euEeaCountries` and `swissCountries`. The `hasFreedomOfMovement()` logic checks `euEeaCountries.has(normalizedCitizenship)` for the EU path, and separately checks `swissCountries.has(normalizedCitizenship)` for the Swiss bilateral path. A Swiss citizen would satisfy the EU/EEA path check before reaching the Swiss bilateral check. The separation exists for the `reason` string in `getVisaStatus()` but has no practical routing difference.

### 3.3 normalizeCountry()

```typescript
const aliases: Record<string, string> = {
  "uk": "united kingdom",
  "usa": "united states",
  "uae": "united arab emirates",
  "holland": "netherlands",
  "the netherlands": "netherlands",
}
```

Only 5 aliases. Does not normalize:
- "america" → "united states"
- "england" → "united kingdom"
- "great britain" → "united kingdom"
- "emirates" → "united arab emirates"
- "czech" / "czechia" (handled via the Set having both strings)

### 3.4 Exports

| Function | Signature | Returns |
|---|---|---|
| `isEuEea(country)` | `(string) → boolean` | Whether country is in EU/EEA Set |
| `hasFreedomOfMovement(citizenship, destination)` | `(string, string) → boolean` | True for same-country or EU+EU or Swiss+EU |
| `getVisaStatus(citizenship, destination)` | `(string, string) → { visaFree, reason, badge }` | Full status with reason text |
| `getVisaBadge(citizenship, destination)` | `(string\|null, string\|null) → VisaBadgeType\|null` | Just the badge for UI |

### 3.5 Coverage Limitation

For all non-EU cases, `getVisaStatus()` returns `badge: "check-required"` with the generic reason: `"Visa requirements depend on your specific situation. Check official sources."` It never returns `badge: "visa-required"`. This means:
- A Brazilian citizen asking about Japan → `"check-required"` (not "visa-required" even though a visa is needed)
- `badge: "visa-required"` can never appear in practice
- The `VisaBadgeType` union includes three values, but only two are ever returned by the logic

---

## 4. visa-recommendations.ts — Static Hardcoded Recommendations

### 4.1 Purpose

Provides static, hardcoded visa recommendations for a small set of destination/purpose combinations. Used only by `system-prompt.ts` (for the review and complete state blocks).

### 4.2 VisaRecommendation Interface

```typescript
interface VisaRecommendation {
  name: string
  type: "primary" | "alternative"
  description: string
  processingTime: string
  estimatedCost: string
  requirements: string[]
  pros: string[]
  cons: string[]
  likelihood: "high" | "medium" | "low"
}
```

This is **different** from the `VisaRecommendation` interface exported from `profile-summary.ts`. See Section 7 for collision analysis.

### 4.3 ProfileSummary Interface

```typescript
interface ProfileSummary {
  sections: {
    title: string
    items: { label: string; value: string }[]
  }[]
  completionPercentage: number
  missingFields: string[]
}
```

`generateProfileSummary()` always returns `completionPercentage: 100` and `missingFields: []` (hardcoded, line 179–180). It is only called when the profile is complete, so this is acceptable but fragile.

### 4.4 Hardcoded Recommendation Coverage

| Destination | Purpose | Visa recommended |
|---|---|---|
| Germany | study | German Student Visa (Visum zu Studienzwecken) |
| Germany | work (job_offer=yes AND employer_sponsorship=yes) | EU Blue Card |
| Germany | work (no job offer) | Job Seeker Visa |
| Germany | digital_nomad | Freelance Visa (Freiberufler) |
| Spain | digital_nomad | Spain Digital Nomad Visa |
| Portugal | digital_nomad | Portugal Digital Nomad Visa (D8) |
| (anything else) | study | Generic Student Visa |
| (anything else) | work | Generic Work Visa |
| (anything else) | digital_nomad | No fallback — empty array |
| (anything else) | settle | No fallback — empty array |

**Gap:** No recommendations exist for:
- Any country when purpose = "settle"
- Any country except DE/ES/PT when purpose = "digital_nomad"
- Dependent/family reunion visa scenarios (visa_role = "dependent")
- UK, USA, Canada, Australia, Japan, UAE, or any other major destination
- Any purpose other than study/work for Germany

### 4.5 Ghost Fields in generateProfileSummary()

`generateProfileSummary()` in `visa-recommendations.ts` references the following profile fields that **do not exist in the current `Profile` type** from `profile-schema.ts`:

| Field referenced | Current schema field | Impact |
|---|---|---|
| `profile.field_of_study` | None | Study section empty even when filled |
| `profile.accepted_to_school` | None | Admission status never shown |
| `profile.income_proof` | None | Income proof section always empty |
| `profile.remote_work_type` | None | Work type section always empty |
| `profile.partner_coming` | None | Partner section always empty (uses moving_alone + spouse_joining instead) |
| `profile.savings_range` | None | Savings section always empty |
| `profile.english_level` | None | English level always empty |
| `profile.industry` | None | Industry section always empty |
| `profile.job_title` | None | Job title section always empty |

These appear to be fields from an earlier schema version. The `generateProfileSummary()` function in this file cannot render a complete summary for any profile because the fields it reads do not exist.

### 4.6 Likelihood Calculation

`likelihood` is computed based on profile data for some visas:

| Visa | Condition | Likelihood |
|---|---|---|
| German Student Visa | `accepted_to_school === "yes"` | "high" (else "medium") |
| EU Blue Card | `highly_skilled === "yes"` | "high" (else "medium") |
| Job Seeker Visa | (static) | "medium" |
| Freelance Visa | `monthly_income` exists | "medium" (else "low") |
| Spain Digital Nomad | `income_proof === "yes"` | "high" (else "medium") |
| Portugal D8 | (static) | "medium" |

**Gap:** `accepted_to_school` and `income_proof` are both ghost fields (not in current schema). Likelihood calculations that depend on them will always use the fallback value.

---

## 5. visa-advisor.ts — Disclaimer Only

### 5.1 Purpose (as named)

The file is named `visa-advisor.ts`, implying an advisory capability. In reality, it contains only two static disclaimer strings and a formatter function.

### 5.2 Contents

```typescript
export const VISA_DISCLAIMER =
  `**Disclaimer:** This information is for general guidance only and does not
  constitute legal advice. Immigration laws and requirements change frequently.
  Always verify information with official government sources and consider consulting
  a licensed immigration advisor for your specific situation.`

export const VISA_DISCLAIMER_SHORT =
  `*Always verify with official sources. This is not legal advice.*`

export function getVisaDisclaimer(short = false): string {
  return short ? VISA_DISCLAIMER_SHORT : VISA_DISCLAIMER
}
```

### 5.3 Usage

**This file is not imported anywhere in the codebase.** A search of all TypeScript files confirms zero imports of `visa-advisor.ts`. The disclaimer strings are unused dead code. The system prompt instructs the AI to add its own disclaimer in natural language instead (see Phase 2.2, Section 7.3).

**Gap:** The controlled disclaimer text is available but unused. Visa advice in the chat is disclaimed only by AI-generated text, which varies per response.

---

## 6. profile-summary.ts — Parallel Recommendation System

### 6.1 Purpose

`lib/gomate/profile-summary.ts` is a second visa recommendation system, parallel to `visa-recommendations.ts`. It is used by `chat/route.ts` (for metadata assembly) rather than by `system-prompt.ts`.

### 6.2 generateProfileSummary() → string

Returns a markdown-formatted string (NOT a structured object like `visa-recommendations.ts`'s version). Contains sections for identity, destination, purpose/plans, family, finances, background, practical needs, and legal history.

**Ghost fields referenced (fields not in current schema):**

| Field used | Schema equivalent | Type |
|---|---|---|
| `profile.age_range` | none | Ghost field |
| `profile.study_institution` | none (has study_type, study_field) | Ghost field |
| `profile.study_admission` | `accepted_to_school` (visa-rec) / none | Name mismatch |
| `profile.job_industry` | `job_field` | Name mismatch |
| `profile.job_title` | none | Ghost field |
| `profile.employer_sponsor` | `employer_sponsorship` | Name mismatch |
| `profile.skilled_worker` | `highly_skilled` | Name mismatch |
| `profile.partner_moving` | `spouse_joining` / `moving_alone` | Name mismatch |
| `profile.num_children` | `children_count` | Name mismatch |
| `profile.children_ages` | none | Ghost field |
| `profile.children_schooling` | none | Ghost field |
| `profile.language_destination` | `language_skill` | Name mismatch |
| `profile.language_english` | none | Ghost field |
| `profile.work_experience` | `years_experience` | Name mismatch |
| `profile.funding_source` | `study_funding` (partial) | Name mismatch |
| `profile.prior_visa` | none | Ghost field |
| `profile.criminal_record` | none | Ghost field |
| `profile.remote_income` | `remote_work` | Name mismatch |
| `profile.visa_rejections` | none | Ghost field |

**Effect:** `metadata.profileSummary` (sent to client in `message-end` event when profile is complete) will show empty values for all these sections. A user who has answered all profile questions will still see an incomplete summary.

### 6.3 VisaRecommendation Interface (profile-summary.ts)

```typescript
export interface VisaRecommendation {
  primaryVisa: string
  alternativeVisas: string[]
  processingTime: string
  requirements: string[]
  tips: string[]
  visaFreeStatus: {
    visaFree: boolean
    reason: string
  } | null
}
```

This is structurally different from `visa-recommendations.ts`'s `VisaRecommendation`. Both are exported under the same name from different files.

### 6.4 generateVisaRecommendation() (singular)

Uses a combination of `getVisaStatus()` (from visa-checker) and purpose/profile logic to produce a `VisaRecommendation`. For EU-to-EU moves: returns "Freedom of Movement (No visa required)". For all others: uses helper functions (`getStudyVisa()`, `getWorkVisa()`, `getSkilledWorkerVisa()`, etc.) to produce country-specific visa names.

**Coverage:** More comprehensive than `visa-recommendations.ts` — covers Germany, France, Spain, Netherlands, Sweden, Portugal, Italy, USA, UK, Canada, Australia, Japan for major visa types.

**Ghost fields:** References `profile.study_admission` (not in schema), `profile.employer_sponsor` (not in schema, should be `employer_sponsorship`), `profile.skilled_worker` (not in schema, should be `highly_skilled`), `profile.partner_moving` (not in schema).

### 6.5 Helper Functions

`profile-summary.ts` contains six private helper functions that map country name (lowercase) to country-specific visa names:

| Function | Covers |
|---|---|
| `getStudyVisa(country)` | 12 countries: DE, FR, ES, NL, SE, PT, IT, USA, UK, CA, AU, JP |
| `getWorkVisa(country)` | 12 countries: same set |
| `getSkilledWorkerVisa(country)` | 6 countries: DE, FR, NL, UK, CA, AU |
| `getJobSeekerVisa(country)` | 4 countries: DE, AT, PT, SE |
| `getDigitalNomadVisa(country)` | 10 countries: DE, PT, ES, HR, EE, GR, IT, MT, NL, CZ |
| `getSettlementVisa(country)` | 8 countries: DE, FR, ES, NL, UK, USA, CA, AU |

---

## 7. Interface Name Collision

Two different `VisaRecommendation` interfaces are exported from two different files in the same directory:

| File | Export name | Shape |
|---|---|---|
| `lib/gomate/visa-recommendations.ts` | `VisaRecommendation` | `{ name, type, description, processingTime, estimatedCost, requirements[], pros[], cons[], likelihood }` |
| `lib/gomate/profile-summary.ts` | `VisaRecommendation` | `{ primaryVisa, alternativeVisas[], processingTime, requirements[], tips[], visaFreeStatus }` |

These interfaces are incompatible. Any file that imports `VisaRecommendation` without explicit path disambiguation could receive either type. Currently, `chat/route.ts` imports from `profile-summary.ts` and `system-prompt.ts` imports from `visa-recommendations.ts`, so there is no runtime conflict — but the naming causes confusion when reading the codebase.

---

## 8. app/api/research/visa/route.ts — Live Visa Research

### 8.1 Purpose

The visa research endpoint performs live web research by:
1. Scraping official immigration websites via Firecrawl
2. Searching for additional visa information via Firecrawl search
3. Analyzing scraped content with GPT-4o-mini
4. Saving results to the `relocation_plans` table

This is the only "live" visa data system — all other visa logic is static/hardcoded.

### 8.2 POST Handler Flow

```
POST /api/research/visa
{ planId: string }
│
├── Auth check (supabase.auth.getUser)
├── Load plan by planId + user_id
├── Extract profileData (citizenship, destination, purpose + optional fields)
├── Update research_status = "in_progress"
│
├── Scrape official immigration URL (if available via getSourceUrl())
├── Scrape visa portal URL (if different from immigration URL)
├── Search (up to 2 queries from buildSearchQueries(), limit 2 results each)
│
├── If any content scraped:
│   └── analyzeVisaContent(scrapedContent, profileData) → VisaOption[]
│       └── GPT-4o-mini, temperature=0.3, max_tokens=4000
│           JSON regex extraction from response
│
├── Map eligibility: likely_eligible→"high", possibly_eligible→"medium", unlikely_eligible→"low"
├── Rename recommendedVisas → visaOptions
├── Add officialLink to each visa option
│
├── Build researchResult object:
│   { destination, citizenship, purpose, visaOptions, summary,
│     disclaimer, generalRequirements, importantNotes,
│     officialSources, researchedAt, confidence }
│
├── Save to relocation_plans:
│   { visa_research: researchResult,
│     research_status: "completed",
│     research_completed_at: new Date().toISOString() }
│
└── Return { research: researchResult }
```

### 8.3 GET Handler

Retrieves cached visa research by planId. Returns:

```typescript
{
  research: normalizeVisaResearch(plan.visa_research),
  visaResearch: normalizeVisaResearch(plan.visa_research),  // duplicate key
  status: plan.research_status,
  completedAt: plan.research_completed_at,
}
```

**Gap:** The response contains `research` and `visaResearch` keys pointing to the same normalized object. This is a double-key response that exists to support two different client access patterns (`data.research` and `data.visaResearch`), suggesting the API was changed mid-development without consolidating client code.

### 8.4 normalizeVisaResearch()

A shape-mapper that handles the mismatch between old and new DB formats:
- `recommendedVisas` → `visaOptions`
- `eligibility: "likely_eligible"` → `eligibility: "high"` (and medium/low equivalents)
- `nationality` → `citizenship`

This function exists because the DB schema evolution changed the shape of `visa_research` JSONB without a migration.

### 8.5 VisaOption Interface (research route)

```typescript
interface VisaOption {
  name: string
  type: "work" | "student" | "digital_nomad" | "settlement" | "family" | "investor" | "other"
  eligibility: "likely_eligible" | "possibly_eligible" | "unlikely_eligible" | "unknown"
  eligibilityReason: string
  requirements: string[]
  processingTime: string
  cost: string
  validity: string
  benefits: string[]
  limitations: string[]
  officialLink?: string
}
```

This is a **third** `VisaOption`/`VisaRecommendation`-style interface in the visa layer (in addition to the two named `VisaRecommendation` in the other files). Note that after `normalizeVisaResearch()`, `eligibility` values are mapped to `"high"/"medium"/"low"` — so the interface definition is immediately violated by the mapper that processes every stored result.

### 8.6 buildSearchQueries()

Builds 2–4 search queries based on purpose. Used for Firecrawl `/v1/search`:

| Purpose | Queries generated |
|---|---|
| work | base + work visa query, optionally + skilled/shortage + employer sponsorship |
| study | base + student visa, optionally + university application |
| digital_nomad | base + digital nomad + self-employment queries |
| settle | base + residence permit, optionally + retirement or family reunion |
| (other) | base + long term visa options |

Only the first 2 queries are used (`queries.slice(0, 2)`), each with `limit: 2` results.

### 8.7 analyzeVisaContent()

```
model: gpt-4o-mini
temperature: 0.3
max_tokens: 4000
```

Uses a JSON regex (`/\{[\s\S]*\}/`) to extract JSON from the response rather than using `response_format: { type: "json_object" }`. This is less reliable than JSON mode — if the model wraps the JSON in markdown fences or adds text before/after, the regex may extract only partial JSON or fail.

### 8.8 Confidence Calculation

```typescript
confidence = scrapedContent.length >= 3 ? "high" : "medium"
```

If no content is scraped, `confidence = "low"` (initial value). This is a coarse proxy for research quality.

---

## 9. Critical Finding: DB Columns Not in Migrations

The visa research endpoint writes to three columns on `relocation_plans`:

```typescript
await supabase.from("relocation_plans").update({
  visa_research: researchResult,
  research_status: "completed",
  research_completed_at: new Date().toISOString(),
}).eq("id", planId)
```

And reads them back:

```typescript
.select("visa_research, research_status, research_completed_at")
```

A review of all migration scripts (001–009, with 004 missing) confirms that **none of these three columns are defined in any migration**:

| Column | Type | In migrations | Status |
|---|---|---|---|
| `visa_research` | JSONB | Not found | Undocumented column |
| `research_status` | text | Not found | Undocumented column |
| `research_completed_at` | timestamptz | Not found | Undocumented column |

These columns either:
1. Were added via direct Supabase Studio DDL (not captured in migration files), or
2. Do not actually exist in the current database (in which case the writes silently fail due to Supabase's lenient UPSERT behavior with unknown columns)

**If these columns do not exist in production, visa research results are silently discarded on every POST.** The endpoint would return a 200 with research data (built in memory) but nothing would be saved.

---

## 10. Gap Analysis — Critical Findings

### G-2.3-A: visa-advisor.ts is unused

Despite being named `visa-advisor.ts`, this file exports only two static disclaimer strings and is imported by no other file. The name implies functionality that does not exist. The disclaimer strings it provides are not used anywhere.

### G-2.3-B: Two VisaRecommendation interfaces with incompatible shapes

`visa-recommendations.ts` and `profile-summary.ts` both export `VisaRecommendation` but with completely different shapes. Both are exported from the `lib/gomate` directory. TypeScript consumers must import by specific path to avoid confusion.

### G-2.3-C: Three parallel static visa lookup systems

The codebase contains three separate static visa determination mechanisms:
1. `visa-recommendations.ts::generateVisaRecommendations()` — structured objects, used by system-prompt.ts
2. `profile-summary.ts::generateVisaRecommendation()` — different structured object, used by chat/route.ts
3. `system-prompt.ts::getVisaHint()` — inline text hints, used as fallback in review state

All three have different coverage, different interfaces, and are not synchronized. A change to visa requirements must be made in up to three places.

### G-2.3-D: visa-recommendations.ts references 9 ghost fields

`generateProfileSummary()` and `generateVisaRecommendations()` in `visa-recommendations.ts` reference `field_of_study`, `accepted_to_school`, `income_proof`, `remote_work_type`, `partner_coming`, `savings_range`, `english_level`, `industry`, `job_title` — none of which exist in the current `Profile` type. All sections that depend on these fields will render as empty.

### G-2.3-E: profile-summary.ts references 19 ghost fields / name mismatches

`generateProfileSummary()` in `profile-summary.ts` references approximately 19 fields that are either missing from the current schema or use the wrong field name. See Section 6.2 for the full table.

### G-2.3-F: DB columns for visa research not defined in migrations

`visa_research`, `research_status`, and `research_completed_at` are written and read by `app/api/research/visa/route.ts` but appear in no migration file. If they don't exist in the database, research results are silently lost.

### G-2.3-G: normalizeVisaResearch() exists because of schema evolution without migration

The `normalizeVisaResearch()` mapper was added to handle a data shape change in `visa_research` JSONB. This is evidence of undocumented schema evolution — the DB column was modified without creating a migration.

### G-2.3-H: analyzeVisaContent() uses regex JSON extraction instead of json_object mode

The visa analysis call uses a regex to extract JSON from the model response rather than requesting `response_format: { type: "json_object" }`. This is less reliable and could fail if the model adds explanatory text around the JSON.

### G-2.3-I: `visa-required` badge is unreachable

`getVisaStatus()` returns `badge: "check-required"` for all non-EU cases. The `"visa-required"` badge in the `VisaBadgeType` union is never returned by any code path. Any UI that renders different states for `"visa-required"` vs `"check-required"` will never show the `"visa-required"` state.

### G-2.3-J: Double-key response in GET /api/research/visa

The GET handler returns both `research` and `visaResearch` with identical values. This suggests client-side code was inconsistent in how it accessed the response, and both keys were added as a workaround rather than updating the client.

---

## 11. Dependency Map

```
chat/route.ts
  ├── visa-checker.ts         (getVisaStatus → metadata.visaStatus)
  └── profile-summary.ts      (generateProfileSummary → metadata.profileSummary)
                               (generateVisaRecommendation → metadata.visaRecommendation)
                               (formatVisaRecommendation)

system-prompt.ts
  ├── visa-recommendations.ts (generateProfileSummary → review block formatted summary)
  │                           (generateVisaRecommendations → review + complete blocks)
  │                           (formatRecommendationsForAI → complete block)
  └── (internal)              getVisaHint() → review block fallback

visa-advisor.ts               (NOT imported by anyone)

app/api/research/visa/route.ts
  └── official-sources.ts     (getAllSources, getSourceUrl)

profile-summary.ts
  └── visa-checker.ts         (getVisaStatus)
```

---

## 12. Target State

| Item | Current | Target |
|---|---|---|
| visa-advisor.ts | Unused; misleading name | Either import VISA_DISCLAIMER into system-prompt.ts, or rename file and document its role |
| Duplicate VisaRecommendation types | Two incompatible interfaces with same name | Consolidate into single canonical interface in shared types file |
| Three parallel static visa systems | Fragmented, out of sync | Consolidate into one authoritative `getVisaRecommendation()` function |
| visa-recommendations.ts ghost fields (9) | Broken sections in review state | Reconcile all field references against current profile-schema.ts |
| profile-summary.ts ghost fields (19) | Broken metadata summary | Reconcile all field references against current profile-schema.ts |
| DB columns not in migrations | visa_research, research_status, research_completed_at | Create migration 010 to add these columns with proper types |
| normalizeVisaResearch() | Workaround for undocumented shape change | After migration 010, remove mapper or make it an identity function |
| analyzeVisaContent() | Regex JSON extraction | Use `response_format: { type: "json_object" }` |
| "visa-required" badge unreachable | Dead enum value | Expand getVisaStatus() to cover known bilateral cases, or remove from union |
| GET double-key response | `research` + `visaResearch` duplicate | Pick one key; update client to use it consistently |
| EU_EEA_COUNTRIES duplicated | In visa-checker.ts AND system-prompt.ts | Export from visa-checker.ts; import in system-prompt.ts |
