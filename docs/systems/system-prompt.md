# System Prompt Architecture — System Document

**Phase:** 2.2
**Status:** Reality-first (documents what exists)
**Primary source:** `lib/gomate/system-prompt.ts` (558 lines)
**Last audited:** 2026-02-24

---

## 1. Purpose

`lib/gomate/system-prompt.ts` is the single file responsible for constructing the OpenAI system prompt used on every chat turn. It takes the current profile, the next pending field key, and the interview state as inputs and returns a single string that configures GPT-4o's persona, rules, data context, and task for that specific turn.

The prompt architecture is state-driven: a large shared base block applies on every turn, and a state-specific block is appended based on whether the user is in `interview`, `review`, or `complete` state.

---

## 2. Exports

| Export | Type | Description |
|---|---|---|
| `buildSystemPrompt()` | `function` | Main entry point — builds and returns the full system prompt string |
| `OPENING_MESSAGE` | `const string` | Static opening message shown before any user input |
| `getSmartOpeningMessage()` | `function` | Contextual opening message for returning users with complete profiles |

**Not exported (internal):**
- `EU_EEA_COUNTRIES` — private constant array (not the same as `euEeaCountries` in visa-checker.ts)
- `isEUCitizen()` — private function
- `getVisaHint()` — private helper used only in the review state block

---

## 3. Entry Point

```typescript
export function buildSystemPrompt(
  profile: Profile,
  pendingFieldKey: AllFieldKey | null,
  interviewState: "interview" | "review" | "confirmed" | "complete"
): string
```

| Parameter | Source (in chat/route.ts) |
|---|---|
| `profile` | Profile after extraction merge |
| `pendingFieldKey` | `getNextPendingField(profile)` |
| `interviewState` | Inline state determination (see Phase 2.1) |

**Note:** `"confirmed"` appears in the type signature but is never passed as a value by the caller. There is no `else if (interviewState === "confirmed")` branch. If it were ever passed, the function would return only the base block with no state-specific instructions.

---

## 4. Prompt Architecture

```
buildSystemPrompt()
│
├── BASE BLOCK (always included, ~180 lines)
│   ├── Persona: "GoMate, a relocation planning assistant"
│   ├── Core principle: profile builder, not interviewer
│   ├── NEVER RE-ASK rule
│   ├── Reversible inference rule
│   ├── Clarification handling
│   ├── Extraction confidence feedback loop
│   ├── Confirmation-of-understanding instructions
│   ├── Personality guidelines
│   ├── Questioning rules (one question at a time)
│   ├── Free question handling
│   ├── Family reunion / dependent detection
│   ├── Purpose inference guide
│   ├── Smart field skipping rules
│   ├── CURRENT PROFILE: ${profileSummary || "(No data collected yet)"}
│   └── PROGRESS: ${filled}/${total} fields (${percentage}%)
│
└── STATE BLOCK (one of three, appended after base)
    ├── "interview": field collection instructions
    ├── "review": summary + confirmation instructions
    └── "complete": plan generation instructions
```

---

## 5. Base Block

The base block is approximately 180 lines and is included verbatim on every turn regardless of state. It covers:

### 5.1 Core Persona

GoMate is positioned as a "PROFILE BUILDER, not an interviewer" and a "travel consultant, not a form."

### 5.2 NEVER RE-ASK Rule

The most prominent instruction. Requires the model to check `CURRENT PROFILE` before asking any question. Lists four explicit anti-patterns:

```
- User said "I'm Sarah" → Don't ask "What's your name?"
- User said "Moving to Germany" → Don't ask "Where are you relocating to?"
- User said "for my job" → Don't ask "What's your reason for moving?"
- User mentioned budget concerns → Don't ask "Do you need help with budgeting?"
```

### 5.3 Reversible Inference

The model is instructed to accept corrections silently and immediately, without questioning or apologizing. Example: if purpose was inferred as "work" and user says "actually I'm going to study" → accept instantly.

### 5.4 Extraction Confidence Loop

The base block explicitly tells the model to check `CURRENT PROFILE` after each turn to verify that extraction stored the expected value, and to either re-ask or clarify if the field is still empty. This is the behavioral counterpart to the technical extraction system in `chat/route.ts`.

### 5.5 Smart Field Skipping Rules

A detailed conditional matrix determines which fields to ask. Categories:

| Category | Condition |
|---|---|
| Essential (always ask) | name, destination, city, purpose, visa_role, timeline, duration, citizenship, current_location, moving_alone, savings, monthly_budget |
| Education level | Only for work or study purposes |
| Study fields | Only if purpose = "study" |
| Work fields | Only if purpose = "work" AND visa_role = "primary" |
| Digital nomad fields | Only if purpose = "digital_nomad" |
| Settlement fields | Only if purpose = "settle" |
| Partner fields | Only if visa_role = "dependent" or joining someone |
| Spouse/children | Only if NOT moving alone |
| Birth year / age | Only if destination has age-restricted visas (Working Holiday, Retirement) |
| Other citizenships | Only if user mentions dual nationality OR additional citizenship could unlock better pathway |
| Prior visa history | Only if user mentions past visits or concerns |
| Healthcare needs | Only if user mentions health conditions |
| Pets | Only if user mentions animals |

### 5.6 Dynamic Context Injection

The base block ends with two live template insertions:

```
CURRENT PROFILE:
${profileSummary || "(No data collected yet)"}

PROGRESS: ${progressInfo.filled}/${progressInfo.total} fields (${progressInfo.percentage}%)
```

`profileSummary` is produced by `formatProfileSummary()` from `lib/gomate/state-machine.ts`, which formats filled fields as a bullet list. `progressInfo` comes from `getProgressInfo()` in the same file.

---

## 6. Interview State Block

Appended when `interviewState === "interview"` and `pendingFieldKey` is not null.

### 6.1 Structure

```
CURRENT STATE: COLLECTING INFORMATION
NEXT FIELD NEEDED: ${pendingFieldKey}
FIELD LABEL: ${fieldConfig.label}
FIELD PURPOSE: ${fieldConfig.intent}
${destinationContext}   (optional, destination-specific)
${purposeContext}       (optional, purpose-specific)

YOUR TASK:
  1. Acknowledge what user just shared
  2. Ask ONE clear question about "${fieldConfig.label}"
  3. Make it conversational

NATURAL PHRASINGS:
  ${fieldConfig.examples}

WHAT TO LISTEN FOR:
  ${fieldConfig.extractionHints}

SMART QUESTIONING:
  ...

RESPONSE STYLE:
  2-3 sentences max, warm and helpful
```

### 6.2 Destination Context Blocks

Conditional context is injected based on `profile.destination`. Currently covers five destination groups:

| Trigger | Context |
|---|---|
| germany, france, italy, spain, netherlands, portugal | EU Country context: citizen check, Schengen rules, Blue Card mention |
| usa / united states / america | USA context: visa categories, sponsorship, processing times |
| japan | Japan context: Certificate of Eligibility, application location |
| uae / dubai / emirates | UAE context: employer vs self-sponsorship, Golden Visa |
| uk / united kingdom / britain | UK context: points-based system, salary thresholds |

**Gap:** The EU group includes only 6 specific countries by string match. Other EU/EEA countries (Sweden, Denmark, Poland, etc.) receive no destination context, even though they are in `euEeaCountries` in `visa-checker.ts`. The check is done by `dest.includes(c)` on a hardcoded list of 6 country names, not using the `euEeaCountries` Set.

**Gap:** `isEUCitizen()` is defined locally in `system-prompt.ts` and uses a private `EU_EEA_COUNTRIES` array. This is a duplicate of the `euEeaCountries` Set in `visa-checker.ts`. The two lists differ:

| | visa-checker.ts | system-prompt.ts |
|---|---|---|
| Format | `Set<string>` | `string[]` |
| Count | 36 entries | 32 entries |
| Missing in system-prompt | czech republic, czechia | ✗ present |
| Missing in system-prompt | liechtenstein | ✗ present |
| "czechia" alias | both | only visa-checker |

### 6.3 Purpose Context Blocks

Conditional context is injected based on `profile.purpose`:

| Purpose | Context injected |
|---|---|
| `study` | Relevant questions (study type, field, funding). Do NOT ask: job offers, sponsorship, work experience |
| `work` | Relevant questions (job offer, industry, sponsorship, highly skilled). Do NOT ask: study programs, tuition |
| `digital_nomad` | Relevant questions (remote income source, monthly income, work type). Do NOT ask: job offers, sponsorship, study |
| `settle` | Relevant questions (settlement reason, family ties). Do NOT ask: job offers (unless relevant), study |

### 6.4 Dependent Visa Context Block

When `profile.visa_role === "dependent"`, an additional block is appended after the purpose context:

```
VISA ROLE CONTEXT: The user is a DEPENDENT (joining someone else).
CRITICAL questions for dependent/family reunion visas:
- Partner's citizenship (determines visa pathway)
- Partner's visa/residency status (citizen, PR, work visa, etc.)
- Relationship type (spouse, fiancé, registered partner, cohabitant)
- Relationship duration (some visas require proof of relationship length)
...
DO NOT ask about: their own job offers or work plans unless they want to work there too
```

---

## 7. Review State Block

Appended when `interviewState === "review"`.

### 7.1 Structure

```
CURRENT STATE: PROFILE COMPLETE - READY FOR CONFIRMATION
ALL NECESSARY INFORMATION COLLECTED

VALIDATION COMPLETE: (static text, not actually validated)

YOUR TASK:
  1. Start with a warm, personalized message using ${profile.name}'s name
  2. Summarize their relocation profile clearly and organized
  3. Confirm accuracy / ask if everything looks correct
  4. Briefly mention the most promising visa pathway

PROFILE SUMMARY TO PRESENT:
  ${formattedSummary}

PRIMARY VISA RECOMMENDATION PREVIEW:
  ${primaryVisa ? ... : getVisaHint(profile)}

AFTER CONFIRMATION, THEY WILL RECEIVE: (preview list)

FORMAT: Use markdown headers. End with confirmation question.

IMPORTANT DISCLAIMER: Include brief note about official sources.
```

### 7.2 Live Data in Review Block

The review block calls two functions at prompt-build time:

1. `generateProfileSummary(profile)` from `lib/gomate/visa-recommendations.ts` — returns a structured `ProfileSummary` object. The sections are formatted into markdown and injected as `formattedSummary`.

2. `generateVisaRecommendations(profile)` from `lib/gomate/visa-recommendations.ts` — returns `VisaRecommendation[]`. The first recommendation with `type === "primary"` is used as the preview.

**Gap:** If `generateVisaRecommendations()` returns an empty array (no hardcoded match for the destination), the fallback is `getVisaHint(profile)`, a private function that generates a text hint based on purpose/visa_role fields.

**Gap:** `generateProfileSummary()` in `visa-recommendations.ts` references several ghost fields (see Phase 2.3 for full list). The review state summary presented to the user will omit data even when those fields are filled, because the field names don't match the actual schema.

### 7.3 Disclaimer Instruction

The review block instructs the AI to add its own disclaimer at the end of the summary. This is a soft instruction to the model — there is no hard-coded disclaimer string injected from `visa-advisor.ts`. The `VISA_DISCLAIMER` constant in `visa-advisor.ts` is never used by the system prompt.

---

## 8. Complete State Block

Appended when `interviewState === "complete"`.

### 8.1 Structure

```
CURRENT STATE: PLAN COMPLETE - PROFILE LOCKED

PROFILE SUMMARY:
  ${profileSummary}

VISA RECOMMENDATIONS DATA:
  ${visaDetails}

IF THIS IS THE FIRST MESSAGE AFTER CONFIRMATION:
  Generate complete relocation plan using this structure:
    ## Recommended Visa Pathway
    ## Your Timeline
    ## Budget Breakdown
    ## Document Checklist
    ## Settling In Tips
    ## Next Steps

IF USER ASKS FOLLOW-UP QUESTIONS:
  Answer clearly, reference profile, provide actionable advice.
  Link to gomaterelocate.com/country-guides/${destination}
  Never modify the locked profile.

TONE: Encouraging but realistic. Use ${profile.name}.
```

### 8.2 Live Data in Complete Block

1. `profileSummary` — from `formatProfileSummary()` in `lib/gomate/state-machine.ts` (already in the base block)
2. `visaDetails` — from `formatRecommendationsForAI(generateVisaRecommendations(profile))` in `lib/gomate/visa-recommendations.ts`

### 8.3 Hardcoded URL

The complete block hardcodes a link to `gomaterelocate.com/country-guides/${destination}`. This URL is not validated anywhere. If `profile.destination` contains spaces or non-ASCII characters, the URL will be malformed. No `encodeURIComponent` is applied.

---

## 9. getVisaHint() — Internal Helper

`getVisaHint(profile)` is a private function (not exported) that generates a visa hint string from the profile without calling any external service. Used only in the review state as a fallback when `generateVisaRecommendations()` returns an empty array.

### 9.1 Logic

| Purpose | Conditions | Output example |
|---|---|---|
| study | study_type = language_school | "Student visa for [dest] (Language study visas are usually shorter-term)" |
| study | study_type = university | "Student visa for [dest] (University student visas often allow part-time work)" |
| work | job_offer=yes AND employer_sponsorship=yes | "Employer-sponsored work visa for [dest]" |
| work | highly_skilled=yes | "Highly skilled worker / talent visa for [dest]" |
| work | other | "Work visa for [dest] (job offer may be required)" |
| digital_nomad | any | "Digital nomad / remote worker visa for [dest]" |
| settle | settlement_reason=retirement | "Retirement visa for [dest]" |
| settle | settlement_reason=family_reunion | "Family reunification visa for [dest]" |
| settle | family_ties=yes | "May qualify for family-based immigration" |
| dependent | partner_visa_status=citizen | "Spouse/partner of citizen visa pathway" |
| dependent | partner_visa_status=permanent_resident | "Family reunification with permanent resident" |
| dependent | partner_visa_status=work_visa | "Dependent visa attached to partner's work permit" |
| dependent | relationship_type=fiancé | "(May need fiancé/marriage visa first)" |
| dependent | relationship_type=cohabitant | "(Cohabitation/sambo visa may apply)" |

---

## 10. Opening Messages

### 10.1 OPENING_MESSAGE

Static string (lines 509–515). Shown before any user input. Introduces GoMate and asks for the user's name.

```
Hi! I'm GoMate, your relocation planning assistant.
I'll help you build a personalized relocation plan based on your specific situation.
I only ask what's necessary for your move - no long forms or irrelevant questions.
Once I understand your plans, you'll get visa recommendations, a timeline, budget
breakdown, and practical tips tailored to you.
Feel free to ask me questions anytime along the way. To get started, what's your name?
```

### 10.2 getSmartOpeningMessage(profile)

Used for returning users who already have a complete profile. Takes the profile and generates 3–4 contextual question suggestions based on `purpose`, then adds two generic suggestions. Returns a welcome-back message with suggestions.

| Purpose | Suggested questions |
|---|---|
| work | salary expectations, qualification recognition, job market for foreigners |
| study | top universities, student work permits, scholarships |
| digital_nomad | coworking spaces, how nomad visas work, internet infrastructure |
| other/settle | neighborhood recommendations, expat community, local culture |
| (always) | documents to gather, budget refinement |

---

## 11. EU_EEA_COUNTRIES Duplication

`lib/gomate/system-prompt.ts` declares its own `EU_EEA_COUNTRIES` array at line 11. `lib/gomate/visa-checker.ts` declares `euEeaCountries` as a `Set`. These are parallel definitions of the same concept with no shared source.

### Discrepancy Table

| Country | In visa-checker.ts | In system-prompt.ts |
|---|---|---|
| austria | ✓ | ✓ |
| belgium | ✓ | ✓ |
| bulgaria | ✓ | ✓ |
| croatia | ✓ | ✓ |
| cyprus | ✓ | ✓ |
| czech republic | ✓ | ✓ |
| czechia | ✓ | ✓ |
| denmark | ✓ | ✓ |
| estonia | ✓ | ✓ |
| finland | ✓ | ✓ |
| france | ✓ | ✓ |
| germany | ✓ | ✓ |
| greece | ✓ | ✓ |
| hungary | ✓ | ✓ |
| iceland | ✓ | ✓ |
| ireland | ✓ | ✓ |
| italy | ✓ | ✓ |
| latvia | ✓ | ✓ |
| liechtenstein | ✓ | ✓ |
| lithuania | ✓ | ✓ |
| luxembourg | ✓ | ✓ |
| malta | ✓ | ✓ |
| netherlands | ✓ | ✓ |
| norway | ✓ | ✓ |
| poland | ✓ | ✓ |
| portugal | ✓ | ✓ |
| romania | ✓ | ✓ |
| slovakia | ✓ | ✓ |
| slovenia | ✓ | ✓ |
| spain | ✓ | ✓ |
| sweden | ✓ | ✓ |
| switzerland | ✓ | ✓ |

Both lists appear to have 32 common entries. The `euEeaCountries` Set in visa-checker.ts **excludes** `switzerland` from the EU/EEA set (it's handled separately in `swissCountries`), while `system-prompt.ts` **includes** `switzerland` directly in `EU_EEA_COUNTRIES`.

**Impact:** `isEUCitizen("Swiss")` returns `true` in `system-prompt.ts` (Swiss = EU context applied), while `isEuEea("Switzerland")` returns `false` in `visa-checker.ts` (Swiss handled as separate bilateral case). The two files disagree on whether Swiss citizens trigger EU-citizen handling.

---

## 12. Gap Analysis — Critical Findings

### G-2.2-A: "confirmed" state has no handler

The function signature accepts `"confirmed"` as a valid `interviewState` value but no `else if (interviewState === "confirmed")` branch exists. If this value were ever passed, the function returns only the base block. In practice the caller never passes `"confirmed"` — but the dead type propagates through the codebase. See also Phase 1.2 G-1.2-A.

### G-2.2-B: EU_EEA_COUNTRIES duplicated and divergent from visa-checker.ts

Two parallel definitions of EU/EEA countries exist with no shared source of truth. The Switzerland handling differs between files. Any future update to EU/EEA membership (e.g., a new accession country) must be made in both places or will produce inconsistent behavior.

### G-2.2-C: Destination context covers only 5 hardcoded destinations (6 EU names)

Destination context is triggered by string matching against a short hardcoded list. The 30+ countries in `euEeaCountries` that are not in the 6-country EU list receive no destination-specific context in the interview prompt. This affects: Sweden, Denmark, Poland, Austria, Belgium, Netherlands (the Netherlands is in the EU list but netherlands.includes match could fail if user says "the Netherlands"), and all others.

### G-2.2-D: VALIDATION COMPLETE text is not actually validated

The review state block includes the static text "VALIDATION COMPLETE: All mandatory core fields filled, All destination-specific questions answered, No critical areas missing." This is injected as a static string, not computed. The system prompt tells the AI that validation is complete without actually checking whether all critical fields are present for the specific destination/purpose combination.

### G-2.2-E: Hardcoded gomaterelocate.com URL without encoding

The complete state block injects `gomaterelocate.com/country-guides/${profile.destination?.toLowerCase().replace(/\s+/g, "-")}`. This:
- Is not URL-encoded beyond space→hyphen replacement
- Will produce invalid URLs for destinations with special characters
- References a domain that may not be live
- Is not configurable via environment variable

### G-2.2-F: VISA_DISCLAIMER from visa-advisor.ts is never injected

The system prompt instructs the AI to add a disclaimer in its own words. The `VISA_DISCLAIMER` string exported from `lib/gomate/visa-advisor.ts` is never imported or used by `system-prompt.ts`. The disclaimer in the user-facing chat is therefore model-generated, variable, and unpredictable — not the controlled string from `visa-advisor.ts`.

### G-2.2-G: Profile summary in review state uses ghost fields

`generateProfileSummary()` from `visa-recommendations.ts` (called during review state prompt construction) references `profile.field_of_study`, `profile.accepted_to_school`, `profile.income_proof`, `profile.remote_work_type`, `profile.partner_coming`, `profile.savings_range`, `profile.english_level`, `profile.industry`, `profile.job_title`. These are not present in the current `Profile` type. The review summary presented to the AI will have empty sections for these fields. See Phase 2.3 for full ghost field analysis.

### G-2.2-H: No token budget management

The system prompt grows with each user turn as `profileSummary` (formatted profile) and `progressInfo` expand. The interview state block adds another ~60–100 lines. The review state injects the full formatted profile summary again. No token counting or truncation is applied. Long conversations with large profiles could approach GPT-4o's system message token limits.

---

## 13. Target State

| Item | Current | Target |
|---|---|---|
| EU_EEA_COUNTRIES | Duplicated in system-prompt.ts | Import from visa-checker.ts or shared constants |
| Switzerland handling | Inconsistent (EU vs bilateral) | Align with visa-checker.ts bilateral logic |
| "confirmed" state | No handler branch | Either add handler or remove from type union |
| Destination context | 5 hardcoded destinations | Use euEeaCountries Set; extend to top 20 destinations |
| VALIDATION COMPLETE | Static text | Compute actual field-coverage check |
| VISA_DISCLAIMER | AI-generated text | Inject controlled string from visa-advisor.ts |
| gomaterelocate.com URL | Hardcoded, not encoded | Configurable via env var; apply full URL encoding |
| Ghost fields in review summary | ~9 mismatches | Reconcile visa-recommendations.ts against schema |
| Token budget | Unmanaged | Add profile summary truncation for long profiles |
