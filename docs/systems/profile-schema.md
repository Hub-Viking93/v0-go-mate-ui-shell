# GoMate — Profile Schema SystemDoc

**Phase:** 1.1
**Status:** Reality-based
**Source file:** `lib/gomate/profile-schema.ts`
**Last verified:** 2026-02-24

---

## Table of Contents

1. [Overview](#1-overview)
2. [The `FieldConfig` Interface](#2-the-fieldconfig-interface)
3. [All Fields Reference](#3-all-fields-reference)
4. [The Zod Schema (`ProfileSchema`)](#4-the-zod-schema-profileschema)
5. [Empty Profile Initialization](#5-empty-profile-initialization)
6. [`getRequiredFields()` — Dynamic Required Logic](#6-getrequiredfields--dynamic-required-logic)
7. [Purpose Types and Their Field Implications](#7-purpose-types-and-their-field-implications)
8. [Dependent Visa Branching](#8-dependent-visa-branching)
9. [Extraction Hints](#9-extraction-hints)
10. [Legacy Exports](#10-legacy-exports)
11. [What the Schema Does Not Capture](#11-what-the-schema-does-not-capture)
12. [Gap Analysis](#12-gap-analysis)
13. [Target State](#13-target-state)

---

## 1. Overview

The profile schema is the **central data contract for all user information** collected during the GoMate interview. Every field that the AI asks about, every value that is extracted from a conversation, and every data point used for visa analysis, guide generation, and cost-of-living calculations flows through this schema.

The schema is defined entirely in `lib/gomate/profile-schema.ts` (736 lines).

It provides:

- `ALL_FIELDS` — ordered tuple of all 45 field keys
- `FieldConfig` interface — metadata structure for each field
- `FIELD_CONFIG` — complete configuration record for all 45 fields
- `ProfileSchema` — Zod validation schema
- `Profile` — TypeScript type inferred from the Zod schema
- `EMPTY_PROFILE` — initialization object with all fields set to `null`
- `getRequiredFields()` — dynamic function returning required fields for a given profile state
- `FIELD_METADATA` — backwards-compatible metadata export
- `Purpose` type — union of valid purpose values

**Field count:** 45 fields across 7 categories.

> Note: Earlier documentation references "65+ fields." The actual implementation contains 45 fields.

---

## 2. The `FieldConfig` Interface

Defined at `lib/gomate/profile-schema.ts:86–98`.

```typescript
export interface FieldConfig {
  key: AllFieldKey
  label: string
  intent: string
  examples: string[]
  extractionHints: string[]
  required: boolean | ((profile: Profile) => boolean)
  category: "core" | "purpose_specific" | "family" | "financial" | "background" | "legal" | "special"
  dependsOn?: {
    field: AllFieldKey
    values: string[]
  }
}
```

Each field has exactly one `FieldConfig` entry in the `FIELD_CONFIG` record.

| Property | Type | Purpose |
|---|---|---|
| `key` | `AllFieldKey` | Identifies the field. Must match its position in `ALL_FIELDS`. |
| `label` | `string` | Human-readable name used in summaries and review screens. |
| `intent` | `string` | One-line description of why this field matters for relocation planning. |
| `examples` | `string[]` | Sample AI question phrasings for this field. Not directly used by AI — the system prompt handles actual question generation. |
| `extractionHints` | `string[]` | Keywords and phrases that signal this field is being answered. Used by the extraction prompt in `app/api/chat/route.ts`. |
| `required` | `boolean \| (profile: Profile) => boolean` | Static boolean or a function that evaluates the current profile state to determine if the field is required at that moment. |
| `category` | union | Groups the field for display and ordering purposes. |
| `dependsOn` | optional object | A secondary gate: even if `required` returns `true`, the field is suppressed unless the `dependsOn` condition is met. |

### The `dependsOn` Secondary Gate

`dependsOn` is checked **after** `required`. A field with `dependsOn` will only be included in the required set if:

1. Its `required` evaluates to `true`
2. AND the referenced field (`dependsOn.field`) has one of the listed `dependsOn.values` in the current profile

This prevents asking follow-up questions before their prerequisite is answered.

Example: `employer_sponsorship` has `required: (p) => p.purpose === "work" && p.job_offer === "yes"` AND `dependsOn: { field: "job_offer", values: ["yes", "in_progress"] }`. Both conditions must be satisfied.

---

## 3. All Fields Reference

The fields are listed in `ALL_FIELDS` at `lib/gomate/profile-schema.ts:4–78`. This ordering matters — the state machine's `FIELD_ORDER` in `lib/gomate/state-machine.ts` references these same keys to determine question sequence.

### Category: Core Identity

Always required unless noted.

| Field | Label | Required | Intent |
|---|---|---|---|
| `name` | Name | `true` | Personalization |
| `citizenship` | Citizenship | `true` | Visa eligibility lookup |
| `other_citizenships` | Other Citizenships | `false` | Additional passport pathways |
| `birth_year` | Birth Year | `false` | Age-restricted visa eligibility (Working Holiday, retirement) |
| `current_location` | Current Location | `true` | Consulate routing |

### Category: Destination and Purpose (Core)

| Field | Label | Required | Intent |
|---|---|---|---|
| `destination` | Destination Country | `true` | Target country for all downstream logic |
| `target_city` | Target City | `true` | Housing and cost-of-living specificity |
| `purpose` | Purpose | `true` | Master branching key — drives which purpose-specific fields apply |
| `visa_role` | Visa Role | `true` | `"primary"` or `"dependent"` — drives dependent visa branching |

> `visa_role` is positioned immediately after `purpose` in `ALL_FIELDS`. Its position is intentional: it must be resolved before the system can determine which question branch to follow.

### Category: Timeline (Core)

| Field | Label | Required | Intent |
|---|---|---|---|
| `duration` | Duration | `true` | Length of stay (drives temporary vs. permanent visa type) |
| `timeline` | Timeline | `true` | Move date (drives urgency and processing time planning) |

### Category: Purpose-Specific — Study

Active when `purpose === "study"`.

| Field | Label | Required Condition | `dependsOn` | Intent |
|---|---|---|---|---|
| `study_type` | Type of Study | `p.purpose === "study"` | `purpose` = `["study"]` | University / language school / vocational / exchange |
| `study_field` | Field of Study | `p.purpose === "study" && p.study_type !== "language_school"` | `study_type` = `["university", "vocational", "exchange"]` | Academic subject (not needed for language schools) |
| `study_funding` | Study Funding | `p.purpose === "study"` | `purpose` = `["study"]` | Scholarship / self-funded / loan |

### Category: Purpose-Specific — Work

Active when `purpose === "work"`.

| Field | Label | Required Condition | `dependsOn` | Intent |
|---|---|---|---|---|
| `job_offer` | Job Offer Status | `p.purpose === "work"` | `purpose` = `["work"]` | Has offer / no offer / in progress |
| `job_field` | Job Field | `p.purpose === "work"` | `purpose` = `["work"]` | Industry/profession for visa category matching |
| `employer_sponsorship` | Employer Sponsorship | `p.purpose === "work" && p.job_offer === "yes"` | `job_offer` = `["yes", "in_progress"]` | Whether employer handles visa |
| `highly_skilled` | Highly Skilled | `p.purpose === "work"` | `purpose` = `["work"]` | Eligibility for skilled worker programs |

### Category: Purpose-Specific — Digital Nomad

Active when `purpose === "digital_nomad"`.

| Field | Label | Required Condition | Intent |
|---|---|---|---|
| `remote_income` | Remote Income | `p.purpose === "digital_nomad"` | Confirms remote work capability |
| `income_source` | Income Source | `p.purpose === "digital_nomad"` | Freelance / remote employee / business owner |
| `monthly_income` | Monthly Income | `p.purpose === "digital_nomad"` | Income threshold for DN visa requirements |
| `income_consistency` | Income Consistency | `p.purpose === "digital_nomad"` | `"stable"` / `"variable"` / `"new"` — affects visa proof strength |
| `income_history_months` | Income History | `p.purpose === "digital_nomad"` | Months of provable income (many DN visas require 6–12 months) |

### Category: Purpose-Specific — Settlement

Active when `purpose === "settle"` or `visa_role === "dependent"`.

| Field | Label | Required Condition | Intent |
|---|---|---|---|
| `settlement_reason` | Settlement Reason | `p.purpose === "settle" \|\| p.visa_role === "dependent"` | Retirement / family reunion / investment / ancestry |
| `family_ties` | Family Ties | `p.purpose === "settle"` | Existing family in destination country |

### Category: Family and Dependents

| Field | Label | Required Condition | `dependsOn` | Intent |
|---|---|---|---|---|
| `moving_alone` | Moving Alone | `true` | none | Determines if family fields apply |
| `spouse_joining` | Spouse Joining | `p.moving_alone === "no"` | `moving_alone` = `["no"]` | Partner joining now vs. later |
| `children_count` | Number of Children | `p.moving_alone === "no"` | `moving_alone` = `["no"]` | Drives budget multipliers and school planning |
| `children_ages` | Children's Ages | `p.moving_alone === "no" && p.children_count && p.children_count !== "0"` | `children_count` = `["1","2","3","4","5"]` | School planning |

### Category: Partner / Sponsor Info

Active only when `visa_role === "dependent"` or `settlement_reason === "family_reunion"`.

| Field | Label | Required Condition | Intent |
|---|---|---|---|
| `partner_citizenship` | Partner's Citizenship | `p.visa_role === "dependent" \|\| p.settlement_reason === "family_reunion"` | Partner's nationality affects sponsorship eligibility |
| `partner_visa_status` | Partner's Visa/Residency Status | `p.visa_role === "dependent" \|\| p.settlement_reason === "family_reunion"` | `"citizen"` / `"permanent_resident"` / `"work_visa"` / `"student_visa"` / `"other"` |
| `partner_residency_duration` | Partner's Time in Country | `false` | How long partner has lived there |
| `relationship_type` | Relationship Type | `p.visa_role === "dependent" \|\| p.settlement_reason === "family_reunion"` | Spouse / fiancé / registered_partner / cohabitant / parent / child |
| `relationship_duration` | Relationship Duration | `false` | Length of relationship (some visas require minimum duration) |

### Category: Financial

| Field | Label | Required | Intent |
|---|---|---|---|
| `savings_available` | Available Savings | `true` | Total relocation budget |
| `monthly_budget` | Monthly Budget | `true` | Expected monthly spend for cost-of-living comparison |
| `need_budget_help` | Budget Help Needed | `false` | Signals need for budget estimation guidance |

### Category: Background

| Field | Label | Required Condition | Intent |
|---|---|---|---|
| `language_skill` | Language Skills | `false` | Proficiency in destination language |
| `education_level` | Education Level | `p.purpose === "work" \|\| p.purpose === "study"` | Highest qualification (degree level matters for skilled worker visas) |
| `years_experience` | Work Experience | `p.purpose === "work"` | Years of professional experience |

### Category: Legal / Visa History

| Field | Label | Required | Intent |
|---|---|---|---|
| `prior_visa` | Prior Visa History | `false` | Previous visas to destination country |
| `visa_rejections` | Visa Rejections | `false` | Past rejections (affects application strategy) |

### Category: Special Needs

| Field | Label | Required | Intent |
|---|---|---|---|
| `healthcare_needs` | Healthcare Needs | `false` | Ongoing medical requirements |
| `pets` | Pets | `false` | Animals traveling with user (quarantine planning) |
| `special_requirements` | Special Requirements | `false` | Any other considerations |

---

## 4. The Zod Schema (`ProfileSchema`)

Defined at `lib/gomate/profile-schema.ts:568–637`.

```typescript
export const ProfileSchema = z.object({
  // All 45 fields, each typed individually
})

export type Profile = z.infer<typeof ProfileSchema>
```

**All fields are nullable.** No field has a non-null runtime constraint. This is deliberate — the profile is built incrementally and a partially filled profile is valid at any point during the interview.

**Typing precision varies by field:**

| Field | Zod Type | Notes |
|---|---|---|
| `purpose` | `z.enum(["study","work","settle","digital_nomad","other"]).nullable()` | Strictly enumerated |
| `visa_role` | `z.enum(["primary","dependent"]).nullable()` | Strictly enumerated |
| `partner_visa_status` | `z.enum(["citizen","permanent_resident","work_visa","student_visa","other"]).nullable()` | Strictly enumerated |
| `relationship_type` | `z.enum(["spouse","fiancé","registered_partner","cohabitant","parent","child","other"]).nullable()` | Strictly enumerated |
| `income_consistency` | `z.enum(["stable","variable","new"]).nullable()` | Strictly enumerated |
| All other fields | `z.string().nullable()` | Free-form string |

**What the Zod schema validates:**

- Shape: all 45 fields must be present (even if `null`)
- Enum constraints on the 5 strictly typed fields above
- Null safety on all fields

**What the Zod schema does not validate:**

- Semantic correctness (e.g., whether a birth year is a plausible year)
- Cross-field logical consistency (e.g., `children_ages` makes sense given `children_count`)
- Format of free-form strings (savings amounts, income, timeline are plain strings like `"€20,000"` or `"next summer"`)
- Completeness for any given use case — completeness is governed by `getRequiredFields()`, not the Zod schema

---

## 5. Empty Profile Initialization

Defined at `lib/gomate/profile-schema.ts:642–688`.

```typescript
export const EMPTY_PROFILE: Profile = {
  name: null,
  citizenship: null,
  // ... all 45 fields set to null
}
```

`EMPTY_PROFILE` is used as the starting point when a new relocation plan is created. It is spread and merged with any extracted data.

The complete null state is intentional: it enables the state machine to detect which fields have been answered (non-null) and which remain pending (null).

---

## 6. `getRequiredFields()` — Dynamic Required Logic

Defined at `lib/gomate/profile-schema.ts:691–718`.

```typescript
export function getRequiredFields(profile: Profile): AllFieldKey[]
```

This function takes the **current profile state** and returns the list of fields that are required at that moment. Because many fields are conditional, the required set changes as the profile fills in.

**Algorithm:**

```
FOR each field in FIELD_CONFIG:
  1. Evaluate config.required
     - If boolean: use directly
     - If function: call with current profile, get boolean result
  2. If required = true AND config.dependsOn exists:
     a. Look up the value of the dependsOn.field in the current profile
     b. If that value is null OR not in dependsOn.values → required = false
  3. If still required = true → add to output list
```

**Practical implications:**

- Before `purpose` is answered: only core fields are required
- After `purpose === "work"`: `job_offer`, `job_field`, `highly_skilled`, `education_level`, `years_experience` become required
- After `purpose === "work"` AND `job_offer === "yes"`: `employer_sponsorship` also becomes required
- After `visa_role === "dependent"`: partner fields become required
- The required set can grow or shrink depending on what the user answers

This function is called by `lib/gomate/state-machine.ts:getNextPendingField()` and `getCompletionPercentage()` to drive the interview flow.

---

## 7. Purpose Types and Their Field Implications

`Purpose` is defined at `lib/gomate/profile-schema.ts:83`:

```typescript
export type Purpose = "study" | "work" | "settle" | "digital_nomad" | "other"
```

Each purpose value unlocks a different set of required fields:

### `"study"`
Unlocks: `study_type`, `study_field` (if not language school), `study_funding`, `education_level`

### `"work"`
Unlocks: `job_offer`, `job_field`, `highly_skilled`, `education_level`, `years_experience`
Conditionally unlocks: `employer_sponsorship` (only if `job_offer === "yes"`)

### `"digital_nomad"`
Unlocks: `remote_income`, `income_source`, `monthly_income`, `income_consistency`, `income_history_months`

### `"settle"`
Unlocks: `settlement_reason`, `family_ties`

### `"other"`
Unlocks no additional purpose-specific fields. Core and family fields still apply.

---

## 8. Dependent Visa Branching

The `visa_role` field is the pivot point for dependent visa logic.

**When `visa_role === "dependent"`:**

The interview shifts from asking about the user's own qualifications to asking about their partner or sponsor:

- `partner_citizenship` — required
- `partner_visa_status` — required
- `relationship_type` — required
- `partner_residency_duration` — optional (contextual)
- `relationship_duration` — optional (contextual)

Additionally, `settlement_reason` becomes required (even if `purpose` is not `"settle"`) because the system needs to classify the specific dependent/family reunion scenario.

**Why this matters:**

A user joining a spouse who holds a German Blue Card has a completely different visa pathway than a user applying for their own EU Blue Card. The branching ensures the AI asks the right questions and the downstream systems (visa-checker, guide-generator) receive the correct signal.

`settlement_reason` has a notably broad extraction hint list that covers all dependent scenarios:
```typescript
extractionHints: [
  "retire", "retirement",
  "family", "family reunion", "join family",
  "investment", "investor", "business",
  "ancestry", "heritage", "grandparents", "roots",
  "spouse", "husband", "wife", "partner", "spouse_work",
  "fiancé", "fiancee", "engaged", "getting married", "marriage",
  "cohabitant", "sambo", "living together", "move in",
]
```

---

## 9. Extraction Hints

Each field's `extractionHints` array contains keywords and short phrases that signal the field is being answered in a user message.

These hints are consumed by the extraction prompt in `app/api/chat/route.ts`. The extraction system sends the user's message to GPT-4o-mini with the field list and their hints, asking it to identify which fields are answered and at what confidence level.

Confidence levels returned by extraction: `"explicit"` / `"inferred"` / `"assumed"`

**Examples of hint usage:**

```typescript
// birth_year hints
["born in", "I'm", "years old", "age", "born", "birthday"]
// If a user says "I'm 28" → AI infers birth_year = ~1997

// citizenship hints
["nationality", "passport", "citizen of", "I'm from", "I hold"]
// If a user says "I hold a Swedish passport" → citizenship = "Sweden"

// income_consistency hints
["stable", "consistent", "regular", "variable", "fluctuates", "varies", "new", "just started"]
// If a user says "my income fluctuates" → income_consistency = "variable"
```

The hints are not exhaustive — the LLM uses them as starting signals but applies its own understanding of natural language.

---

## 10. Legacy Exports

The file contains two backwards-compatibility exports at `lib/gomate/profile-schema.ts:722–735`.

### `FIELD_METADATA`

```typescript
export const FIELD_METADATA = Object.fromEntries(
  Object.entries(FIELD_CONFIG).map(([key, config]) => [
    key,
    {
      intent: config.intent,
      examples: config.examples,
      extractionHints: config.extractionHints,
    },
  ])
)
```

Strips `required`, `category`, and `dependsOn` from the config. Used by older parts of the codebase that only need the AI-facing metadata.

### `REQUIRED_FIELDS` and `RequiredFieldKey`

```typescript
export const REQUIRED_FIELDS = ALL_FIELDS
export type RequiredFieldKey = AllFieldKey
```

`REQUIRED_FIELDS` is a simple re-export of `ALL_FIELDS`. The name is misleading — it contains all 45 fields, not only the statically required ones. This is a naming artifact from an earlier version of the schema where all fields were treated as required.

---

## 11. What the Schema Does Not Capture

The following aspects of profile data exist in the system but are not represented in the schema:

### Confidence Levels Per Field

The extraction system in `app/api/chat/route.ts` tracks confidence per extracted value (`"explicit"`, `"inferred"`, `"assumed"`). These confidence values are returned in the chat response metadata but are **not stored in the profile**. Every field in the `Profile` type is a plain nullable string — there is no `{ value: string, confidence: string }` wrapper.

This means confidence information is lost after each turn. The profile only stores the extracted value.

### Source of Truth Attribution

Related to the above — there is no record of whether a field value came from an explicit user statement, was inferred from context, or was assumed. The profile is a flat record of values without provenance.

### Field-Level Timestamps

There is no record of when each field was answered. The `relocation_plans.updated_at` timestamp reflects the last plan update, but not which fields changed in which turn.

### Validation State

The schema does not track whether a field's value has been confirmed by the user during the review phase. All values are treated equally regardless of confirmation status.

---

## 12. Gap Analysis

| Design Contract Requirement | Reality | Status |
|---|---|---|
| Profile fields as structured data with full metadata | `FIELD_CONFIG` with `FieldConfig` interface | **Exists** |
| Dynamic required field calculation | `getRequiredFields()` function | **Exists** |
| Field dependencies and branching | `dependsOn` in `FieldConfig`, function-based `required` | **Exists** |
| Extraction hints per field | `extractionHints` array | **Exists** |
| Zod validation | `ProfileSchema` | **Exists** |
| Confidence tracking per field value | Returned in chat metadata but not persisted in schema | **Partial** |
| Source attribution per field value | Not implemented | **Missing** |
| Enrichment fields from Batch 5 contracts | No enrichment layer exists | **Missing** |
| Profile synchronization protocol | No sync mechanism exists | **Missing** |
| Field-level timestamps | No timestamp per field | **Missing** |
| Audit trail of field changes | No change history | **Missing** |

---

## 13. Target State

The Batch 5 Contracts (Foundation Completion) describe a **Profile State Contract** and **Enrichment Data Contracts** that extend beyond what is currently implemented.

### Enrichment Fields

The contracts envision additional enrichment fields populated from external data sources (not from the user interview), such as:

- Verified visa processing times
- Real-time cost of living snapshots
- Country-specific regulatory data

These would be separate from the interview-collected profile and stored in a different structure.

### Confidence and Source Attribution

The target architecture persists confidence levels and source attribution per field, enabling:

- Different treatment of assumed vs. explicit values
- User confirmation flows for low-confidence fields
- Provenance tracking for audit purposes

### Profile Synchronization

The contracts describe a synchronization protocol for keeping profile data consistent across multiple systems (chat state, persistence layer, research pipeline). Currently, profile data flows from chat extraction to the `relocation_plans.profile_data` JSONB column with no formal sync protocol — it is a direct write on each turn.

---

*Document generated from direct code analysis of `lib/gomate/profile-schema.ts`. All claims are traceable to that file.*
