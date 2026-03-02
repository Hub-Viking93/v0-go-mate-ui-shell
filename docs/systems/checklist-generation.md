# Checklist Generation — System Document

**Phase:** 4.5
**Status:** Reality-first (documents what exists)
**Audit classification (audit.md):** PARTIAL — generation pipeline works; `checklist_progress` table created but has no API (completion tracking non-functional); naming confusion between `checklist` and `checklist_items` columns
**Primary sources:**
- `lib/gomate/checklist-generator.ts` (429 lines)
- `app/api/research/checklist/route.ts` (132 lines)
- `scripts/002_create_relocation_plans.sql` — `checklist_items` column
- `scripts/003_create_checklist_progress.sql` — progress tracking table
**Last audited:** 2026-02-25

---

## 1. Overview

The checklist generation system produces a personalized list of required documents and tasks for a user's specific relocation scenario. It uses Firecrawl web scraping to gather current visa/immigration requirements, then sends the content to Claude Sonnet 4.5 (Anthropic) for structured extraction into a `ChecklistItem[]` array.

This system is distinct from the `ChecklistSection` in guide generation (Phase 4.1): that section is a high-level task list embedded in the guide. This system generates a detailed document checklist with document-level granularity, priority levels, costs, and official links.

**Notable:** Checklist generation is the only system in the GoMate codebase that uses an Anthropic model (Claude Sonnet 4.5 via Vercel AI SDK). All other AI calls use OpenAI.

---

## 2. ChecklistItem Interface

```typescript
export interface ChecklistItem {
  id: string
  document: string                // Human-readable name, e.g. "Valid Passport"
  description: string
  priority: "critical" | "high" | "medium" | "low"
  required: boolean
  category: "identity" | "visa" | "financial" | "medical" | "education" |
            "housing" | "travel" | "legal" | "other"
  whereToGet?: string             // Where to obtain the document
  officialLink?: string           // Official source URL
  estimatedTime?: string          // e.g. "2-4 weeks"
  cost?: string                   // e.g. "€75"
  tips?: string[]                 // Advice strings
  visaSpecific?: boolean          // True if only required for specific visa type
}
```

---

## 3. Generation Flow

### 3.1 POST /api/research/checklist Flow

```
POST /api/research/checklist
{ planId?: string }
│
├── Auth check
├── Load plan (by planId or is_current=true)
├── Require profile.destination
│
├── generateChecklistFromPlan(plan)        ← checklist-generator.ts
│   │
│   ├── Extract profile fields:
│   │   citizenship, destination, purpose, visaType (from visa_research.visaOptions[selected] or [0]),
│   │   qualifications, hasJobOffer, hasUniversityAdmission
│   │
│   ├── If FIRECRAWL_API_KEY exists AND visaType is known:
│   │   ├── searchDocumentRequirements() — 2 Firecrawl searches, 3 results each:
│   │   │   • "{citizenship} {destination} {visaType} visa required documents"
│   │   │   • "{destination} immigration documents checklist {year}"
│   │   │
│   │   └── scrapeOfficialSources() — Firecrawl scrapes:
│   │       • getSourceUrl(dest, "immigration") — official immigration URL
│   │       • getSourceUrl(dest, "visa")        — official visa URL
│   │
│   ├── If research content obtained (> 0 chars):
│   │   └── generateChecklistWithAI(content, profile)
│   │       Model: "anthropic/claude-sonnet-4-20250514"
│   │       SDK: generateText() from Vercel AI SDK
│   │       maxTokens: 4000
│   │       Response: raw text → regex extract JSON array
│   │
│   └── If no research content OR AI fails:
│       └── getDefaultChecklist(profile)     ← 5-8 hardcoded items
│
├── Sort by priority (critical → high → medium → low)
│
├── Save to relocation_plans:
│   { checklist_items: checklist, updated_at: now }
│
└── Return { success, checklist, planId }
```

### 3.2 generateChecklistFromPlan()

Adapter function that converts a raw DB plan row into `ChecklistGeneratorInput`:

```typescript
interface ChecklistGeneratorInput {
  citizenship: string
  destination: string
  purpose: string
  visaType?: string              // from visa_research.visaOptions[selectedIndex] or [0]
  qualifications?: string        // profile.qualifications
  hasJobOffer?: boolean          // profile.job_offer === "yes"
  hasUniversityAdmission?: boolean // profile.university_admission === "yes"
  familySize?: number
}
```

The `visaType` is read from `plan.visa_research?.visaOptions?.[selectedIndex]?.type || plan.visa_research?.visaOptions?.[0]?.type`. This depends on the `visa_research` JSONB column being populated by the visa research route. If visa research has not been run, `visaType` will be undefined and the prompt will be less specific.

---

## 4. Firecrawl Integration in Checklist Generator

Checklist generation uses the Firecrawl **JS SDK** (`@mendable/firecrawl-js`), unlike all other research routes which use raw `fetch()`. This is documented in Phase 3.3 as a codebase inconsistency.

```typescript
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY })

// Search
firecrawl.search(query, { limit: 3, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } })

// Scrape
firecrawl.scrapeUrl(url, { formats: ["markdown"], onlyMainContent: true })
```

**Content limits:**
- Search results: 4,000 chars per result
- Scraped URLs: 5,000 chars per URL
- Total content sent to AI: up to 15,000 chars

---

## 5. AI Extraction (Claude Sonnet 4.5)

`generateChecklistWithAI(researchContent, profile)`:

```typescript
model: "anthropic/claude-sonnet-4-20250514"
SDK: generateText from "ai" (Vercel AI SDK)
maxTokens: 4000
```

The prompt provides:
- User profile summary (citizenship, destination, purpose, visaType, qualifications, job/admission flags)
- Official government source links from `official-sources.ts`
- Combined scraped research content (up to 15,000 chars)
- Detailed output schema with 9 required fields per item
- 7 generation instructions (all required docs, general docs, country-specific requirements, post-arrival docs, critical docs first, financial amounts, apostille/translation requirements)

**Output format:** `"Return ONLY a valid JSON array, no other text."`

**Response parsing:**

```typescript
result.text.match(/\[[\s\S]*\]/)  // regex to extract first JSON array
```

**Gap:** If Claude wraps the array in explanation or markdown fences, the regex may fail or extract incomplete content. See Phase 3.4, G-3.4-C.

---

## 6. Item Sanitization

After extraction, each item is sanitized:

```typescript
id:       item.id || `doc_${index}`
document: item.document || "Unknown Document"
priority: ["critical","high","medium","low"].includes(item.priority) ? item.priority : "medium"
required: typeof item.required === "boolean" ? item.required : false
category: item.category || "other"
tips:     Array.isArray(item.tips) ? item.tips : []
```

Other fields (`description`, `whereToGet`, `officialLink`, `estimatedTime`, `cost`, `visaSpecific`) are passed through without validation.

---

## 7. Default Checklist

`getDefaultChecklist(profile)` returns 5–8 hardcoded items when AI generation fails or no research content is available:

| # | Document | Priority | Category | Condition |
|---|---|---|---|---|
| 1 | Valid Passport | critical | identity | Always |
| 2 | Passport Photos | high | identity | Always |
| 3 | Visa Application Form | critical | visa | Always |
| 4 | Bank Statements | critical | financial | Always |
| 5 | Health Insurance Certificate | critical | medical | Always |
| 6 | Employment Contract | critical | visa | purpose=work OR hasJobOffer=true |
| 7 | University Admission Letter | critical | visa | purpose=study OR hasUniversityAdmission=true |
| 8 | Proof of Accommodation | high | housing | Always |

---

## 8. Storage

### 8.1 checklist_items Column (relocation_plans)

The generated checklist is stored in `relocation_plans.checklist_items` (added in migration 002 alongside other plan columns). Shape: `ChecklistItem[]` serialized as JSONB.

**Note:** The `RelocationPlan` TypeScript interface has a `checklist: any | null` field (migration 002 column), which is separate from `checklist_items`. The research route writes to `checklist_items`, not to `checklist`. The TypeScript interface does not include `checklist_items`. See Phase 4.2 for the full JSONB field mismatch.

### 8.2 GET /api/research/checklist

Retrieves the stored checklist:

```typescript
Response: {
  checklist: ChecklistItem[]
  planId: string
  hasVisaResearch: boolean   // whether visa_research JSONB is populated
}
```

No normalization step — the raw `checklist_items` value is returned directly. There is no shape normalization (unlike the local requirements GET handler which handles two historical shapes).

---

## 9. checklist_progress Table (migration 003)

A separate table for tracking per-item completion status:

```sql
checklist_progress:
  id uuid PK
  user_id uuid FK → auth.users (cascade delete)
  plan_id uuid FK → relocation_plans (cascade delete)
  item_id text          -- matches ChecklistItem.id
  completed boolean     -- default false
  completed_at timestamptz
  notes text
  created_at, updated_at
  UNIQUE(user_id, plan_id, item_id)
```

RLS: 4 policies (select, insert, update, delete) — own records only.

**Gap:** There is no API route for `checklist_progress`. The table exists with full schema and RLS, but there is no `GET`, `POST`, `PATCH`, or `DELETE` endpoint to read or write completion status. The table is completely inaccessible via the API. Checklist item completion tracking is non-functional.

---

## 10. Priority Ordering

After generation, items are sorted by priority before saving:

```typescript
const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
checklist.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
```

---

## 11. Gap Analysis — Critical Findings

### G-4.5-A: checklist_progress table has no API

The `checklist_progress` table (migration 003) provides a proper schema for tracking which checklist items the user has completed, with per-item completion timestamps and notes. There is no corresponding API route. The table is never read or written through the application. Checklist completion tracking is not functional.

### G-4.5-B: visaType dependency on visa research

Checklist generation reads `visaType` from `plan.visa_research.visaOptions`. If the visa research route has not been run (or failed), `visaType` is undefined. The AI prompt then lacks specificity about the visa type, producing generic rather than visa-specific document requirements.

### G-4.5-C: checklist_items vs checklist column confusion

Migration 002 creates both `checklist` and `checklist_items` columns. The checklist route writes to `checklist_items`. The `RelocationPlan` TypeScript interface includes `checklist` but not `checklist_items`. Callers using the TypeScript type cannot access `checklist_items` without casting.

### G-4.5-D: Regex JSON parsing from AI output

Claude is instructed to return only a JSON array, but the response is parsed with `result.text.match(/\[[\s\S]*\]/)`. If the model adds any explanation, wraps in markdown fences, or produces nested arrays, the regex may extract incomplete or invalid JSON. There is no structured output mode (equivalent to OpenAI's `response_format: { type: "json_object" }`).

### G-4.5-E: No TTL or staleness check for checklist

Local requirements enforces a 7-day cache TTL. The checklist has no TTL — a cached checklist from the initial generation persists indefinitely. There is no mechanism to detect when a checklist is stale relative to profile changes or visa type selection.

### G-4.5-F: Claude vs OpenAI inconsistency undocumented

The use of Claude Sonnet 4.5 for checklist generation while all other AI calls use GPT-4o-mini is not architecturally documented anywhere in the codebase. This creates a hidden dependency on an Anthropic API key in addition to the OpenAI API key. See Phase 3.1 G-3.1-C.

---

## 12. Target State

| Item | Current | Target |
|---|---|---|
| checklist_progress API | No routes — table unused | Add GET/POST/PATCH endpoints for completion tracking |
| visaType dependency | May be undefined if visa research not run | Default to profile.purpose-based document list if visaType unknown |
| checklist_items vs checklist naming | Confusing dual columns | Consolidate; align TypeScript interface with actual DB column |
| AI response parsing | Regex on free-form text | Structured output or stricter JSON extraction |
| Cache TTL | No TTL | Explicit TTL matching local-requirements (7 days) |
| Claude vs OpenAI | Undocumented inconsistency | Document the choice; consider standardizing on one provider |
