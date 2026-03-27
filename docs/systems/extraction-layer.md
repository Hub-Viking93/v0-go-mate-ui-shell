# Extraction Layer — System Document

**Phase:** 3.4
**Status:** Reality-first + Placeholder for target architecture
**Primary sources:**
- `app/api/chat/route.ts` — profile extraction (lines 305–537)
- `lib/gomate/checklist-generator.ts` — checklist extraction
- `app/api/research/visa/route.ts` — visa content extraction
- `app/api/research/local-requirements/route.ts` — local requirements extraction
**Last audited:** 2026-02-25

---

## 1. Overview

The extraction layer is responsible for converting unstructured text (web-scraped content, user messages) into structured data. In the current implementation, **there is no unified extraction protocol**. Each of the four extraction sites uses its own prompt design, AI model, response parsing strategy, and error handling.

---

## 2. Extraction Site Inventory

| Site | Input | Output type | AI model | JSON mode |
|---|---|---|---|---|
| Chat route | User message | `Partial<Profile>` with confidence | GPT-4o-mini | ✓ (json_object) |
| Checklist generator | Scraped web content | `ChecklistItem[]` | Claude Sonnet 4.5 | ✗ (regex) |
| Visa research | Scraped web content | `VisaOption[]` | GPT-4o-mini | ✓ (json_object) |
| Local requirements | Scraped web content | `LocalRequirementsResearch` (categories object) | GPT-4o-mini | ✓ (json_object) |

---

## 3. Profile Extraction (Chat Route)

### 3.1 Purpose

Extracts structured profile fields from a user's natural language message. Runs on every non-confirmed, non-locked turn.

### 3.2 Model Call

```
model: gpt-4o-mini
response_format: { type: "json_object" }
temperature: not set (default model behavior)
max_tokens: 1500
```

### 3.3 Input Construction

The extraction prompt is built dynamically each turn:

1. Current profile snapshot (JSON) embedded in prompt
2. Dynamic field list: `getRequiredFields(currentProfile)` → only unfilled fields sent
3. 11 extraction rules (multi-field, visa_role, partner fields, inference, purpose normalization, income stability, birth year, dual citizenship, yes/no, numbers, country normalization)
4. Full confidence level instructions (explicit / inferred / assumed)
5. Schema example with output format

**Dynamic field list:** Because `getRequiredFields()` returns only the fields still needed based on the current profile state, the extraction prompt shrinks as the profile fills in. This is the most sophisticated aspect of the extraction system.

### 3.4 Output Validation

Extracted fields go through a two-stage validation:

**Stage 1 — Key validation:** Extracted keys are checked against `new Set(ALL_FIELDS)`. Unknown keys are dropped.

**Stage 2 — Enum validation:** Five fields receive hard enum validation before writing:

| Field | Valid values |
|---|---|
| `purpose` | study / work / settle / digital_nomad / other |
| `visa_role` | primary / dependent |
| `partner_visa_status` | citizen / permanent_resident / work_visa / student_visa / other |
| `relationship_type` | spouse / fiancé / registered_partner / cohabitant / parent / child / other |
| `income_consistency` | stable / variable / new |

Fields that fail enum validation are silently dropped. All other fields are accepted as strings without further validation.

### 3.5 Confidence Levels

Each extracted field receives a confidence level: `explicit`, `inferred`, or `assumed`. Confidence is tracked in `ExtractionResultWithConfidence.confidence: Record<string, FieldConfidence>`.

Confidence is embedded into `profile_data.__field_confidence` before the chat route saves the profile. It is persisted, but only as an ad hoc JSON payload rather than a canonical first-class confidence model.

### 3.6 Backwards-Compatible Format Handling

The parser handles two response shapes:
- Current: `{ "fields": {...}, "confidence": {...} }`
- Legacy: `{ key: value, ... }` (flat object)

```typescript
const extractedFields = parsed.fields || parsed  // handles both shapes
```

### 3.7 Error Handling

If the API call fails (`!response.ok`), returns `null`. If JSON parsing fails, returns `null`. The chat route continues normally with the unmodified profile — no indication to the user that extraction failed.

---

## 4. Checklist Extraction (checklist-generator.ts)

### 4.1 Purpose

Converts scraped visa/immigration web content into a structured list of required documents for the user's specific relocation.

### 4.2 Model Call

```
model: "anthropic/claude-sonnet-4-20250514"
SDK: Vercel AI SDK (generateText)
maxTokens: 4000
temperature: not set
```

**This is the only Claude model call in the entire codebase.** All other AI calls use OpenAI. No architectural reason for this distinction is documented.

### 4.3 Prompt Design

The checklist prompt provides:
- User profile (citizenship, destination, purpose, visaType, qualifications, job/admission flags)
- Official government source links from `official-sources.ts`
- Combined scraped research content (up to 15,000 chars)
- Detailed output schema with 9 required fields per item
- 7 generation instructions (include all required docs, include general docs, include country-specific requirements, include post-arrival docs, prioritize critical docs, include financial amounts, specify apostille/translation requirements)

**Output format:** Raw JSON array. The prompt says "Return ONLY a valid JSON array, no other text."

### 4.4 Response Parsing

Regex extraction: `result.text.match(/\[[\s\S]*\]/)` — extracts first JSON array from response.

**Gap:** If Claude wraps the JSON in explanation or markdown fences, the regex extracts the array correctly only if the markdown fences don't wrap the `[`. If the model adds text after the array, the regex stops at the first `]` — which may be mid-array, producing invalid JSON.

### 4.5 Item Validation

Each extracted item is sanitized:
- `id`: defaults to `doc_{index}` if missing
- `document`: defaults to "Unknown Document"
- `priority`: validated against `["critical", "high", "medium", "low"]`, defaults to `"medium"`
- `required`: must be boolean, defaults to `false`
- `category`: defaults to `"other"`
- `tips`: must be array, defaults to `[]`

### 4.6 Fallback: getDefaultChecklist()

On any failure (no research content, AI call fails, JSON parse fails), the system falls back to 5–8 hardcoded items. See Phase 3.1 Section 6.4 for the default checklist definition.

---

## 5. Visa Content Extraction (app/api/research/visa/route.ts)

### 5.1 Purpose

Converts scraped immigration website content into structured visa options for the user's profile.

### 5.2 Model Call

```
model: gpt-4o-mini
temperature: 0.3
max_tokens: 4000
```

Note: This is the only research extraction that sets `temperature: 0.3`. The other GPT-4o-mini calls (local requirements) also use 0.3.

### 5.3 Prompt Design

The visa extraction prompt provides:
- User profile (nationality, destination, purpose, education, years_experience, job_offer, highly_skilled, monthly_income, duration)
- Full scraped content (up to 50,000 chars, truncated by `slice(0, 50000)`)
- Explicit JSON output schema with all VisaOption fields

**Output format:** Full JSON object `{ "visas": [...], "generalRequirements": [...], "importantNotes": [...] }`

### 5.4 Response Parsing

Visa research now uses `response_format: { type: "json_object" }` and parses the returned message content directly with `JSON.parse()`.

### 5.5 Post-Processing

After extraction, two transformations are applied:
1. Eligibility mapping: `likely_eligible → "high"`, `possibly_eligible → "medium"`, `unlikely_eligible → "low"`
2. Official link injection: each visa option gets `officialLink` from the scraped official URL

---

## 6. Local Requirements Extraction (app/api/research/local-requirements/route.ts)

### 6.1 Purpose

Converts scraped government and expat website content into a structured guide of local administrative requirements (registration, tax, healthcare, banking, etc.).

### 6.2 Model Call

```
model: gpt-4o-mini
temperature: 0.3
max_tokens: 4000
```

### 6.3 Prompt Design

The local requirements prompt provides:
- User profile (destination, city, purpose, citizenship, timeline, job offer flag, family size)
- Combined scraped content (up to 25,000 chars)
- Explicit JSON output schema with 8 required categories and per-item fields
- Instruction to respond ONLY with valid JSON

**Output format:** `{ "categories": { "registration": [...], "taxId": [...], ... }, "generalTips": [...], "importantDeadlines": [...] }`

### 6.4 Response Parsing

Local requirements now use `response_format: { type: "json_object" }` and parse the returned message content directly with `JSON.parse()`.

### 6.5 Post-Processing

Inline key normalization:
- `item.name → item.title`
- `item.requiredDocuments → item.documents`
- `item.officialLinks[0] → item.officialLink`
- Category keys (`registration`, `taxId`) → display labels (`Registration`, `Tax ID`)

Additionally, `normalizeLocalRequirements()` (GET handler) handles the old keyed-object shape for records written before the current array format.

---

## 7. Cross-Cutting Comparison

### 7.1 Model Selection

| Site | Model | Rationale documented? |
|---|---|---|
| Profile extraction | GPT-4o-mini | No |
| Checklist extraction | Claude Sonnet 4.5 | No |
| Visa extraction | GPT-4o-mini | No |
| Local requirements extraction | GPT-4o-mini | No |

Three sites use GPT-4o-mini, one uses Claude Sonnet. No architecture decision record exists for the Claude choice in checklist generation.

### 7.2 JSON Mode Usage

| Site | JSON enforcement | Reliability |
|---|---|---|
| Profile extraction | `response_format: { type: "json_object" }` | High |
| Checklist extraction | Prompt instruction only | Medium — regex array extraction still fragile |
| Visa extraction | `response_format: { type: "json_object" }` | High |
| Local requirements extraction | `response_format: { type: "json_object" }` | High |

Checklist extraction remains the outlier. The other three extraction sites now use JSON mode.

### 7.3 Temperature Settings

| Site | Temperature | Appropriate? |
|---|---|---|
| Profile extraction | Default (1.0) | No — extraction should be deterministic |
| Checklist extraction | Default (model default) | Unknown |
| Visa extraction | 0.3 | Yes — lower temperature for factual extraction |
| Local requirements extraction | 0.3 | Yes |

Profile extraction uses the highest temperature for a task that requires the most deterministic behavior.

### 7.4 Error Handling Consistency

All four extraction sites:
- Return `null` or fallback data on failure
- Log errors with `console.error("[GoMate] ...")`
- No retry logic
- No structured error events
- No user notification on failure

---

## 8. Target Architecture (from Contracts)

The Batch 3 contracts describe a unified **Extraction Protocol** and **Extraction Retry Strategy**.

### 8.1 Unified Extraction Protocol (Target)

```typescript
interface ExtractionRequest {
  content: string
  schema: JSONSchema
  model: "gpt-4o-mini" | "claude-sonnet"
  temperature?: number
  maxTokens?: number
  context?: Record<string, unknown>
}

interface ExtractionResult<T> {
  data: T | null
  confidence: number
  source: string
  extractedAt: string
  model: string
  tokensUsed: number
}

function extract<T>(request: ExtractionRequest): Promise<ExtractionResult<T>>
```

### 8.2 Extraction Retry Strategy (Target)

- Initial attempt with primary model
- On JSON parse failure: retry with stricter prompt ("Return ONLY valid JSON, no other text")
- On model failure: retry with exponential backoff (1s, 2s, 4s)
- After 3 failures: return structured error result (not silent null)
- Log all retry events with structured format

### 8.3 Link Enrichment (Target, Batch 3)

The contracts describe a Link Enrichment system that takes raw extracted content and enriches it with official source links. This does not exist — official links are currently appended via hardcoded `officialLink` injection after extraction.

---

## 9. Gap Analysis — Critical Findings

### G-3.4-A: No shared extraction protocol

Four independent extraction implementations with different models, JSON modes, temperature settings, and error handling. Changes to extraction strategy must be applied in four places.

### G-3.4-B: Profile extraction uses default temperature (1.0)

The most structurally critical extraction (profile data that drives the entire conversation) uses no temperature setting, defaulting to 1.0. For deterministic field extraction, 0 or 0.1 would be more appropriate.

### G-3.4-C: Three of four extraction sites use regex JSON parsing

Only profile extraction uses the reliable `json_object` response format. Visa, checklist, and local requirements extractions rely on regex extraction from free-form text, which can silently produce incomplete or invalid results.

### G-3.4-D: Checklist extraction uses a different AI provider

Claude Sonnet 4.5 is used for checklist generation while GPT-4o-mini is used everywhere else. No documented reason. This creates a hidden dependency on Anthropic API keys in addition to OpenAI API keys.

### G-3.4-E: No retry logic anywhere

All four extraction sites make a single attempt. API rate limits, transient failures, and malformed responses all produce silent fallbacks with no retry.

### G-3.4-F: Confidence levels not persisted

Profile extraction computes `explicit` / `inferred` / `assumed` confidence per field, but this is only sent to the client in `lastExtraction.fieldConfidence`. It is never stored in the database. There is no way to later query which fields were confidently extracted.

---

## 10. Target State

| Item | Current | Target |
|---|---|---|
| Extraction protocol | 4 independent implementations | Single `lib/gomate/extract.ts` with shared interface |
| JSON mode | Only profile extraction uses json_object | All extractions use json_object or structured outputs |
| Temperature | Inconsistent (default, 0.3) | Standardize: 0.1 for factual extraction |
| Model selection | GPT-4o-mini + Claude Sonnet (undocumented) | Documented model choice with fallback strategy |
| Retry strategy | None | Exponential backoff, 3 retries |
| Confidence persistence | Not persisted | Add `field_confidence` JSONB to profile schema |
| Error handling | Silent null returns | Structured `ExtractionError` with error_code |
| Link enrichment | None | Post-extraction enrichment from official-sources.ts |
