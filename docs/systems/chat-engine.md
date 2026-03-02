# Chat Engine — System Document

**Phase:** 2.1
**Status:** Reality-first (documents what exists)
**Primary source:** `app/api/chat/route.ts` (538 lines)
**Supporting sources:** `lib/gomate/profile-summary.ts`, `lib/gomate/web-research.ts`,
`lib/gomate/source-linker.ts`, `lib/gomate/official-sources.ts`
**Last audited:** 2026-02-24

---

## 1. Purpose

The chat engine is the central request handler for the GoMate conversational interface. Every user turn passes through this single `POST /api/chat` endpoint, which:

1. Loads and locks the user's current relocation plan from Supabase
2. Extracts structured profile data from the user's raw message (using a secondary AI call)
3. Merges extracted data into the in-memory profile and persists it to Supabase
4. Determines the current interview state (interview / review / complete)
5. Builds a state-specific system prompt
6. Streams the GPT-4o response back to the client via Server-Sent Events (SSE)
7. Appends a rich metadata payload to the end of the stream

---

## 2. File Reference

| Symbol | Type | Line | Description |
|---|---|---|---|
| `maxDuration` | `const number` | 34 | Vercel function timeout cap (30 seconds) |
| `FieldConfidence` | `type` | 37 | `"explicit" \| "inferred" \| "assumed"` |
| `ExtractionResultWithConfidence` | `type` | 40–43 | `{ fields: Partial<Profile>, confidence: Record<string, FieldConfidence> }` |
| `getMessageText()` | `function` | 46–51 | Extracts plain text from AI SDK `UIMessage.parts` array |
| `convertToOpenAIMessages()` | `function` | 54–59 | Maps `UIMessage[]` to `{ role, content }[]` for OpenAI API |
| `POST()` | `async function` | 61–302 | Main request handler |
| `extractProfileData()` | `async function` | 307–537 | Secondary extraction call (GPT-4o-mini, JSON mode) |

---

## 3. Request Lifecycle

```
POST /api/chat
│
├── Guard: OPENAI_API_KEY present?
│
├── Parse body: { messages, profile, confirmed }
│
├── Load Supabase session
│   └── Query relocation_plans WHERE user_id AND is_current=true
│       ├── Plan locked? → planLocked=true, load profile from DB
│       └── Not locked / no plan → continue with incoming profile
│
├── If lastUserText exists AND NOT confirmed AND NOT planLocked:
│   └── extractProfileData(lastUserText, profile) → ExtractionResultWithConfidence
│       ├── Calls GPT-4o-mini with JSON mode
│       ├── Validates extracted keys against ALL_FIELDS set
│       ├── Validates enum values (purpose, visa_role, partner_visa_status,
│       │   relationship_type, income_consistency) before writing
│       └── Saves updated profile to Supabase via saveProfileToSupabase()
│
├── Determine interviewState:
│   ├── isProfileComplete(profile) = false → "interview"
│   ├── isProfileComplete(profile) = true AND confirmed = false → "review"
│   └── isProfileComplete(profile) = true AND confirmed = true → "complete"
│   NOTE: "confirmed" state in InterviewState union is never produced here
│
├── buildSystemPrompt(profile, pendingFieldKey, interviewState)
│
├── Assemble metadata object (profile, state, sources, visa status,
│   research data, extraction feedback, ...)
│
├── Fetch OpenAI streaming endpoint (raw fetch, NOT OpenAI SDK)
│   model: gpt-4o, stream: true
│
└── Pipe through TransformStream:
    ├── START: emit "message-start" event
    ├── EACH CHUNK: parse delta, emit "text-delta" events
    └── [DONE]: emit "message-end" event (with full metadata), then [DONE]
```

---

## 4. SSE Protocol

The endpoint returns `Content-Type: text/event-stream`. Three custom event types are emitted in sequence.

### 4.1 Event Types

| Event type | Timing | Payload fields |
|---|---|---|
| `message-start` | First frame, before any text | `{ type, id, role }` |
| `text-delta` | Each streaming chunk | `{ type, delta }` |
| `message-end` | After OpenAI sends `[DONE]` | `{ type, metadata }` |

After `message-end`, the raw `data: [DONE]\n\n` sentinel is forwarded.

### 4.2 Wire Format

Each event follows the SSE convention:

```
data: {"type":"message-start","id":"msg_1740398400000","role":"assistant"}

data: {"type":"text-delta","delta":"Hello"}

data: {"type":"message-end","metadata":{...}}

data: [DONE]
```

### 4.3 Response Headers

Two non-standard headers are also sent on the response:

| Header | Value | Notes |
|---|---|---|
| `X-GoMate-Profile` | `encodeURIComponent(JSON.stringify(profile))` | Full profile snapshot at request time |
| `X-GoMate-State` | `interviewState` | e.g. `"interview"`, `"review"`, `"complete"` |

**Gap:** These headers duplicate data already present in the `message-end` metadata payload. No evidence they are read on the client side. Redundant and potentially misleading if client reads state from header vs. stream.

---

## 5. Extraction Subsystem

### 5.1 Overview

`extractProfileData(userMessage, currentProfile)` is an async function that makes a separate, non-streaming call to GPT-4o-mini in JSON mode. It runs on every user turn unless the plan is locked or the user has confirmed the profile.

### 5.2 Model Call

```
POST https://api.openai.com/v1/chat/completions
model: gpt-4o-mini
response_format: { type: "json_object" }
messages: [{ role: "user", content: extractionPrompt }]
```

No `temperature` or `max_tokens` are set — uses model defaults (temperature=1, max_tokens=model default).

### 5.3 Extraction Prompt — 11 Rules

The prompt embeds the current profile as JSON and instructs the model to extract using 11 numbered rules:

| Rule | Subject |
|---|---|
| 1 | Multi-field extraction from a single message |
| 2 | `visa_role` — "primary" vs "dependent" detection |
| 3 | Partner fields (citizenship, visa_status, relationship_type, residency_duration, relationship_duration) |
| 4 | Intelligent inference (e.g. "with my wife" → `moving_alone="no"`) |
| 5 | `purpose` value normalization (exactly: study / work / settle / digital_nomad / other) |
| 6 | `income_consistency` and `income_history_months` for digital nomads |
| 7 | `birth_year` — extract or calculate from stated age |
| 8 | `other_citizenships` — dual/multiple passports |
| 9 | YES/NO fields as string `"yes"` or `"no"` |
| 10 | Numbers as strings (`"2"` not `2`) |
| 11 | Country/city normalization to proper names |

The prompt requests a JSON response in the shape `{ "fields": {...}, "confidence": {...} }`.

### 5.4 Confidence Levels

Each extracted field receives one of three confidence levels:

| Level | Meaning | Example |
|---|---|---|
| `explicit` | User directly stated the value | "I'm moving to Germany" → destination=explicit |
| `inferred` | Derived from context | "my husband" → relationship_type=spouse is inferred |
| `assumed` | Reasonable assumption from limited context | solo traveler → visa_role="primary" is assumed |

If no confidence is returned by the model, the code defaults to `"explicit"`.

**Gap:** Confidence levels are assembled into `metadata.lastExtraction.fieldConfidence` and sent to the client but are **never persisted to the database**. The information is available only for the duration of the stream response. No confidence field exists in the `relocation_plans.profile_data` JSONB column.

### 5.5 Enum Validation

Five fields receive hard validation before being written to the profile. Other fields are accepted as-is.

| Field | Valid values |
|---|---|
| `purpose` | `study`, `work`, `settle`, `digital_nomad`, `other` |
| `visa_role` | `primary`, `dependent` |
| `partner_visa_status` | `citizen`, `permanent_resident`, `work_visa`, `student_visa`, `other` |
| `relationship_type` | `spouse`, `fiancé`, `registered_partner`, `cohabitant`, `parent`, `child`, `other` |
| `income_consistency` | `stable`, `variable`, `new` |

**Note:** `"fiancee"` → `"fiancé"` normalization is applied to `relationship_type` (line 505).

### 5.6 Key Filtering

Extracted keys are validated against `new Set(ALL_FIELDS)` before writing. Unknown keys from the model are silently dropped. Empty strings are also rejected.

### 5.7 Backwards-Compatibility Format Handling

The code handles both:
- New format: `{ fields: {...}, confidence: {...} }` (current prompt)
- Old format: flat object `{ key: value, ... }` (legacy, pre-confidence)

---

## 6. State Determination

The chat route implements its own inline state logic. It does **not** call `computeNextState()` from `lib/gomate/state-machine.ts` (see Phase 1.2 gap documentation).

```typescript
let interviewState: "interview" | "review" | "confirmed" | "complete" = "interview"
if (complete && !userConfirmed) {
  interviewState = "review"
} else if (complete && userConfirmed) {
  interviewState = "complete"
}
```

| Condition | State |
|---|---|
| `isProfileComplete = false` | `"interview"` |
| `isProfileComplete = true` AND `confirmed = false` | `"review"` |
| `isProfileComplete = true` AND `confirmed = true` | `"complete"` |
| `planLocked = true` | Forces metadata state to `"complete"` (line 213) |

**Critical Gap:** The type declaration on line 135 includes `"confirmed"` in the union, but no code path in this function produces the `"confirmed"` state. It is dead code inherited from the InterviewState type. See Phase 1.2 documentation for full analysis.

---

## 7. Metadata Assembly

A single `metadata` object is assembled before the stream starts and sent wholesale in the `message-end` event.

### 7.1 Metadata Shape

```typescript
{
  profile: Profile,                    // Full profile after extraction
  state: "interview"|"review"|"complete",
  pendingField: string,                // Key of next unfilled field (or "")
  filledFields: AllFieldKey[],         // All fields with non-null values
  requiredFields: AllFieldKey[],       // Dynamic required fields for current profile
  progressInfo: { filled, total, percentage },
  relevantSources: Source[],           // From source-linker, based on user message + destination
  visaStatus: VisaStatusResult | null, // From visa-checker (EU/non-EU check)
  officialSources: OfficialSource[],   // Only populated when profile is complete
  planLocked: boolean,
  profileSummary: string | null,       // Markdown string, only when complete
  visaRecommendation: string | null,   // Formatted markdown, only when complete
  costOfLiving: CostOfLivingData | null,  // Only when complete + destination set
  budget: BudgetData | null,           // Only when complete + costOfLiving available
  savings: SavingsData | null,         // Only when complete + budget available
  researchReport: string | null,       // Only when complete
  lastExtraction: {                    // Only if extraction was attempted this turn
    attempted: boolean,
    fieldsExtracted: string[],
    extractedValues: Partial<Profile>,
    fieldConfidence: Record<string, FieldConfidence>,
    success: boolean,
    pendingFieldBefore: AllFieldKey | null,
  } | null
}
```

### 7.2 Conditional Population

Several metadata fields are only populated when `isProfileComplete(profile) = true`:

- `profileSummary` — calls `generateProfileSummary()` from `lib/gomate/profile-summary.ts`
- `visaRecommendation` — calls `generateVisaRecommendation()` then `formatVisaRecommendation()` from `lib/gomate/profile-summary.ts`
- `costOfLivingData` — calls `getCostOfLivingData()` from `lib/gomate/web-research.ts`
- `budgetData` — calls `calculateMonthlyBudget()` from `lib/gomate/web-research.ts`
- `savingsData` — calls `calculateSavingsTarget()` from `lib/gomate/web-research.ts`
- `researchReport` — calls `generateResearchReport()` from `lib/gomate/web-research.ts`
- `officialSources` — populated only when complete (empty array otherwise)

---

## 8. Plan Lock Mechanism

At the start of every request, the chat route queries the current plan's `locked` column:

```typescript
const { data: plan } = await supabase
  .from("relocation_plans")
  .select("locked, profile_data")
  .eq("user_id", user.id)
  .eq("is_current", true)
  .maybeSingle()

if (plan?.locked) {
  planLocked = true
  profile = { ...EMPTY_PROFILE, ...plan.profile_data }
}
```

**Effect of lock:**
- Extraction is skipped entirely
- Profile is loaded from the locked DB snapshot
- `metadata.state` is overridden to `"complete"` regardless of `interviewState`
- `metadata.planLocked = true`

**Gap:** The lock query uses `.maybeSingle()` which returns `null` if no plan exists (does not throw). If the Supabase call throws (catch block at line 108), the code silently continues with `planLocked = false`. No warning is logged.

---

## 9. Imports and Dependencies

```
app/api/chat/route.ts
├── @/lib/supabase/server              createClient()
├── @/lib/gomate/profile-schema        Profile, EMPTY_PROFILE, ALL_FIELDS,
│                                      FIELD_CONFIG, getRequiredFields
├── @/lib/gomate/state-machine         updateProfile, getNextPendingField,
│                                      isProfileComplete, getFilledFields,
│                                      getProgressInfo
├── @/lib/gomate/system-prompt         buildSystemPrompt
├── @/lib/gomate/source-linker         getRelevantSources
├── @/lib/gomate/official-sources      getOfficialSourcesArray
├── @/lib/gomate/visa-checker          getVisaStatus
├── @/lib/gomate/supabase-utils        saveProfileToSupabase
├── @/lib/gomate/profile-summary       generateProfileSummary (→ string),
│                                      generateVisaRecommendation,
│                                      formatVisaRecommendation
└── @/lib/gomate/web-research          getCostOfLivingData, calculateMonthlyBudget,
                                       calculateSavingsTarget, generateResearchReport
```

**Note:** The chat route imports `generateProfileSummary` from `lib/gomate/profile-summary`, which returns a **markdown string**. The system prompt file (`lib/gomate/system-prompt.ts`) imports a **different** `generateProfileSummary` from `lib/gomate/visa-recommendations`, which returns a **structured object** (`ProfileSummary`). These are two different functions with the same name in different files. See Phase 2.3 documentation for full analysis.

---

## 10. Gap Analysis — Critical Findings

### G-2.1-A: Raw fetch instead of OpenAI SDK

The route uses `fetch("https://api.openai.com/v1/chat/completions", ...)` directly rather than the official `openai` npm package. A comment on line 145 states: `"// Use fetch directly for streaming to avoid OpenAI SDK compatibility issues"`. This is pragmatic but means:
- No retry logic
- No automatic timeout handling beyond the 30s `maxDuration`
- No SDK-level type safety on request/response shape
- Harder to upgrade to new API features (e.g., structured outputs, tool use)

### G-2.1-B: computeNextState() is dead code

`computeNextState()` from `lib/gomate/state-machine.ts` is imported indirectly but never called. The chat route implements equivalent logic inline (lines 132–140). The two implementations are **not in sync** — if state machine logic is updated in one place, the other is not updated. See Phase 1.2 documentation.

### G-2.1-C: Extraction runs on every turn regardless of context

Extraction is attempted on every user turn unless `planLocked = true` or `confirmed = true`. There is no caching, deduplication, or skip-if-already-filled optimization at the extraction call level. For a profile that is 90% complete, the extraction prompt still includes all `getRequiredFields()` for the remaining fields. This means GPT-4o-mini is called even when the user says "yes" to a confirmation question.

### G-2.1-D: Extraction uses no temperature setting

The extraction call omits `temperature` (defaults to 1 for gpt-4o-mini). For a structured extraction task requiring deterministic output, temperature=0 or 0.1 would be appropriate. The main chat uses no temperature setting either.

### G-2.1-E: No streaming error recovery

If the OpenAI stream is interrupted mid-response (network error, timeout), the TransformStream has no error handler. The client will receive a partial stream and no `message-end` event, meaning the metadata (and profile sync) will be lost for that turn.

### G-2.1-F: Confidence levels not persisted

Field confidence levels (`explicit`/`inferred`/`assumed`) are computed per-turn and sent to the client but never saved to the database. There is no schema column for confidence tracking in `relocation_plans.profile_data` JSONB or elsewhere. This limits the ability to show users which fields were inferred vs. confirmed.

### G-2.1-G: profile-summary.ts references ghost fields

`generateProfileSummary()` in `lib/gomate/profile-summary.ts` (imported here for metadata assembly) references the following fields that do not exist in the current profile schema:

| Field used in profile-summary.ts | Schema equivalent | Status |
|---|---|---|
| `profile.age_range` | none | Ghost field |
| `profile.study_institution` | none | Ghost field |
| `profile.study_admission` | `accepted_to_school` (visa-rec) | Name mismatch |
| `profile.job_industry` | `job_field` | Name mismatch |
| `profile.job_title` | none | Ghost field |
| `profile.employer_sponsor` | `employer_sponsorship` | Name mismatch |
| `profile.skilled_worker` | `highly_skilled` | Name mismatch |
| `profile.partner_moving` | `spouse_joining` | Name mismatch |
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

**Effect:** `metadata.profileSummary` (populated when profile is complete) will render with many empty fields. The displayed summary will be incomplete even when the profile is fully filled.

### G-2.1-H: Two parallel plan-update paths

When extraction succeeds, the profile is saved via `saveProfileToSupabase(profile)` from `supabase-utils.ts`. This function uses the user's current plan record. This is a separate path from `createPlan()` in `plan-factory.ts` and the `PATCH /api/profile` route. The three paths have divergent logic. See Phase 1.3 documentation.

---

## 11. Data Flow Diagram

```
Browser
  │
  │  POST /api/chat
  │  { messages, profile, confirmed }
  │
  ▼
app/api/chat/route.ts
  │
  ├─── Supabase: load plan, check lock
  │
  ├─── extractProfileData()
  │      │
  │      └─── POST api.openai.com/v1/chat/completions
  │             model: gpt-4o-mini, json_object
  │
  ├─── saveProfileToSupabase()
  │      └─── Supabase: UPSERT relocation_plans.profile_data
  │
  ├─── buildSystemPrompt()
  │
  ├─── POST api.openai.com/v1/chat/completions
  │      model: gpt-4o, stream: true
  │      │
  │      └─── TransformStream
  │             message-start event
  │             text-delta events (one per chunk)
  │             message-end event (with full metadata)
  │             [DONE]
  │
  └─── Response: text/event-stream
         X-GoMate-Profile: <encoded>
         X-GoMate-State: <state>
```

---

## 12. Target State

| Item | Current | Target |
|---|---|---|
| OpenAI calls | Raw `fetch()` | OpenAI SDK with retry/timeout |
| State determination | Inline duplication | Call `computeNextState()` or merge into one authoritative function |
| Confidence levels | Computed, not persisted | Add `field_confidence` JSONB column to profile |
| Ghost fields in profile-summary | 19 mismatches | Reconcile `profile-summary.ts` against current schema |
| Extraction temperature | Default (1.0) | Set `temperature: 0` for deterministic extraction |
| Stream error handling | None | Add `cancel()` handler to TransformStream |
| Extraction on every turn | Always | Skip if pending field is not present in user message |
| Response headers | Redundant (duplicated in metadata) | Remove `X-GoMate-Profile` / `X-GoMate-State` headers or document their consumer |
