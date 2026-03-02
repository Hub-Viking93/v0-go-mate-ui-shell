# GoMate — Interview State Machine SystemDoc

**Phase:** 1.2
**Status:** Reality-based
**Primary source files:**
- `lib/gomate/state-machine.ts` (295 lines)
- `lib/gomate/plan-factory.ts` (280 lines)
- `app/api/chat/route.ts` (state derivation, lines 131–140)
- `app/api/profile/route.ts` (lock/unlock, stage transitions)

**Last verified:** 2026-02-24

---

## Table of Contents

1. [Overview](#1-overview)
2. [Two Parallel State Systems](#2-two-parallel-state-systems)
3. [InterviewState — The Four States](#3-interviewstate--the-four-states)
4. [PlanStage — The Three Stages](#4-planstage--the-three-stages)
5. [GoMateState — The Runtime State Object](#5-gomatestate--the-runtime-state-object)
6. [FIELD_ORDER — Conversation Sequencing](#6-field_order--conversation-sequencing)
7. [State Machine Functions](#7-state-machine-functions)
8. [How State Is Derived Per Turn](#8-how-state-is-derived-per-turn)
9. [The Lock Mechanism](#9-the-lock-mechanism)
10. [State Transition Diagram — Reality](#10-state-transition-diagram--reality)
11. [Known Inconsistencies](#11-known-inconsistencies)
12. [What the State Machine Does Not Do](#12-what-the-state-machine-does-not-do)
13. [Gap Analysis](#13-gap-analysis)
14. [Target State](#14-target-state)

---

## 1. Overview

The GoMate interview state machine governs the progression of a user through the relocation interview — from an empty profile to a confirmed, locked plan.

It is not a traditional finite state machine with explicit guards and transition functions. Instead it is a **computed-on-demand system**: state is derived fresh on every request by evaluating the current profile against the set of required fields.

There is no persisted `interview_state` column in the database. State is always calculated, never stored as a discrete value.

The system is split across two files with distinct responsibilities:

- `lib/gomate/state-machine.ts` — pure functions operating on `Profile` data
- `lib/gomate/plan-factory.ts` — Supabase persistence functions for the `relocation_plans` table

---

## 2. Two Parallel State Systems

GoMate has **two overlapping state systems** that represent different aspects of progress. They are not directly synchronized.

| Dimension | Type | Values | Location | Persisted? |
|---|---|---|---|---|
| **Interview state** | `InterviewState` | `"interview"` / `"review"` / `"confirmed"` / `"complete"` | Computed per turn in `chat/route.ts` | No |
| **Plan stage** | `PlanStage` | `"collecting"` / `"generating"` / `"complete"` | Stored in `relocation_plans.stage` | Yes |

These two systems loosely correspond but are not formally linked:

- While the interview is active, `stage` is `"collecting"`
- When the plan is locked (`locked = true`), `stage` is set to `"complete"` by `PATCH /api/profile`
- The `"generating"` stage can be set by `updatePlanStage()` in `plan-factory.ts` but there is no automatic trigger for it — it requires an explicit call

Additionally, the `relocation_plans` table has a `locked` boolean column that acts as a third state signal independent of both `InterviewState` and `PlanStage`. The lock is the definitive completion signal.

---

## 3. InterviewState — The Four States

Defined at `lib/gomate/state-machine.ts:9`:

```typescript
export type InterviewState = "interview" | "review" | "confirmed" | "complete"
```

### `"interview"` — Active data collection

The default state. The AI is asking questions and the user is providing answers. Profile extraction runs on every user turn.

**Condition:** Profile is not yet complete (at least one required field is still `null`).

### `"review"` — All fields filled, awaiting confirmation

All currently required fields have been answered. The AI presents a summary and asks the user to confirm.

**Condition:** `isProfileComplete(profile) === true` AND the user has not yet confirmed in this request.

### `"complete"` — Confirmed and ready to finalize

The user has confirmed the profile summary. The plan is ready to be locked.

**Condition:** `isProfileComplete(profile) === true` AND `confirmed: true` was sent in the request body.

### `"confirmed"` — Stranded state

This value exists in the `InterviewState` type union but is **never produced by any live code path**.

- `computeNextState()` in `state-machine.ts` produces `"interview"`, `"review"`, or `"complete"` — not `"confirmed"`
- The inline state logic in `chat/route.ts` (lines 135–140) also never assigns `"confirmed"`
- `computeNextState()` itself is defined in `state-machine.ts` but is never called by `chat/route.ts`, which implements its own equivalent logic inline

`"confirmed"` appears to be a remnant of an earlier design iteration. It is not reachable in the current system.

See [Known Inconsistencies](#11-known-inconsistencies) for full details.

---

## 4. PlanStage — The Three Stages

Defined at `lib/gomate/plan-factory.ts:6`:

```typescript
export type PlanStage = "collecting" | "generating" | "complete"
```

`PlanStage` is stored in the `relocation_plans.stage` column (persisted in Supabase).

### `"collecting"`

Default stage. Profile data is being gathered through the interview. Set on plan creation.

### `"generating"`

Intermediate stage indicating that plan outputs (guides, checklists, research) are being generated. This stage can be set via `updatePlanStage(planId, "generating")` from `plan-factory.ts`. There is no automatic trigger — it must be called explicitly.

### `"complete"`

The plan has been locked. Set by `PATCH /api/profile` when `action === "lock"` is received (see `app/api/profile/route.ts:92–139`).

---

## 5. GoMateState — The Runtime State Object

Defined at `lib/gomate/state-machine.ts:11–18`:

```typescript
export interface GoMateState {
  profile: Profile
  interviewState: InterviewState
  pendingFieldKey: AllFieldKey | null
  filledFields: AllFieldKey[]
  requiredFields: AllFieldKey[]
  confirmationPending: boolean
}
```

| Field | Description |
|---|---|
| `profile` | The full profile object as currently known |
| `interviewState` | Current `InterviewState` value |
| `pendingFieldKey` | The next required field that has no value, or `null` if all required fields are filled |
| `filledFields` | Array of field keys that are both required and non-null |
| `requiredFields` | Array of all currently required field keys (dynamic — changes as profile fills in) |
| `confirmationPending` | `true` when `interviewState === "review"` and the user has not yet confirmed |

**Important:** `GoMateState` is constructed by `createInitialState()` and `computeNextState()` in `state-machine.ts`. However, `chat/route.ts` does **not** use these functions to build a `GoMateState` object. It calls individual state machine functions directly (`isProfileComplete`, `getNextPendingField`, `getFilledFields`, `getProgressInfo`) and constructs its own equivalent metadata inline.

`GoMateState` is used by callers that want the full packaged state object, but the primary consumer (the chat route) bypasses it.

---

## 6. FIELD_ORDER — Conversation Sequencing

Defined at `lib/gomate/state-machine.ts:22–80`.

```typescript
const FIELD_ORDER: AllFieldKey[] = [
  "name", "destination", "target_city", "purpose", "timeline",
  "citizenship", "moving_alone",
  // ... purpose branches, family, financial, background, legal, special
]
```

`FIELD_ORDER` is the ordered sequence in which the state machine prefers to ask questions. It is not a flat required list — it is a preference ordering applied on top of the dynamic required fields from `getRequiredFields()`.

**How it works:**

`getNextPendingField()` iterates through `FIELD_ORDER` and returns the first field that is both:
1. In the current `requiredFields` set (from `getRequiredFields(profile)`)
2. Has a `null` / empty value in the current profile

Fields that appear in `FIELD_ORDER` but are not currently required (because `purpose` hasn't been answered yet, for example) are skipped silently.

**Key ordering decisions:**

| Position | Fields | Rationale |
|---|---|---|
| First block | `name`, `destination`, `target_city`, `purpose`, `timeline`, `citizenship`, `moving_alone` | Core mandatory fields always asked first |
| After core | Purpose branches: study, work, digital_nomad, settlement | Only relevant fields once purpose is known |
| Middle | Family fields (`spouse_joining`, `children_count`, `children_ages`) | Conditional on `moving_alone === "no"` |
| Later | `savings_available`, `monthly_budget` | Financial always required but asked after purpose context |
| `current_location`, `duration` | Asked later despite being core fields | Ordering choice — context established first |
| Near end | `language_skill`, `education_level`, `prior_visa`, `visa_rejections` | Background and legal — supplementary |
| Last | `healthcare_needs`, `pets`, `special_requirements` | Special needs — least frequently relevant |

**Notable omissions from FIELD_ORDER:**

The following fields from the profile schema are **not present** in `FIELD_ORDER`:

- `visa_role`
- `partner_citizenship`
- `partner_visa_status`
- `partner_residency_duration`
- `relationship_type`
- `relationship_duration`
- `birth_year`
- `other_citizenships`
- `income_consistency`
- `income_history_months`
- `need_budget_help`

Fields absent from `FIELD_ORDER` will never be returned by `getNextPendingField()`, even if they are in the required set. This means the system prompt will not be directed to ask for them via the state machine's field prompting mechanism. They may still be extracted if the user mentions them voluntarily.

---

## 7. State Machine Functions

All functions are pure — they take a `Profile` and return a result without side effects or database access.

---

### `createInitialState()`

`lib/gomate/state-machine.ts:83–95`

```typescript
export function createInitialState(): GoMateState
```

Returns a `GoMateState` with `EMPTY_PROFILE`, `interviewState: "interview"`, `pendingFieldKey: "name"`, and empty arrays for `filledFields` and `requiredFields`.

`pendingFieldKey` is hardcoded to `"name"` on initialization rather than computed, since `name` is always the first required field.

---

### `getFilledFields(profile)`

`lib/gomate/state-machine.ts:98–105`

```typescript
export function getFilledFields(profile: Profile): AllFieldKey[]
```

Returns all field keys that are both currently required AND have a non-null, non-empty value. A field with a value that is not in the required set is not counted.

---

### `getNextPendingField(profile)`

`lib/gomate/state-machine.ts:108–122`

```typescript
export function getNextPendingField(profile: Profile): AllFieldKey | null
```

The core sequencing function. Iterates `FIELD_ORDER`, checking each field against the current required set and the current profile values. Returns the first unanswered required field in order, or `null` if all required fields are answered.

`null` return value is the signal that the profile is complete and the state should advance to `"review"`.

---

### `isProfileComplete(profile)`

`lib/gomate/state-machine.ts:125–127`

```typescript
export function isProfileComplete(profile: Profile): boolean
```

Returns `true` if `getNextPendingField(profile) === null`. Completeness is defined entirely as: no pending required field remains.

---

### `getCompletionPercentage(profile)`

`lib/gomate/state-machine.ts:130–136`

```typescript
export function getCompletionPercentage(profile: Profile): number
```

Returns `Math.round((filledFields.length / requiredFields.length) * 100)`.

The denominator is the **current required set size**, which grows as the profile fills in (e.g., answering `purpose = "work"` adds new required fields, temporarily decreasing the percentage). This means the percentage can go down when a branching answer expands the required set.

Returns `0` if `requiredFields.length === 0`.

---

### `updateProfile(currentProfile, extraction)`

`lib/gomate/state-machine.ts:139–157`

```typescript
export function updateProfile(currentProfile: Profile, extraction: Partial<Profile>): Profile
```

Merges extracted field values into the current profile. Only writes values that are:
- Non-null
- Non-undefined
- Non-empty string
- Keys that exist in the current profile

This is a safe merge — it will not overwrite existing values with empty values, and it will not add keys that are not part of the `Profile` type.

---

### `computeNextState(profile, confirmationReceived)`

`lib/gomate/state-machine.ts:160–184`

```typescript
export function computeNextState(profile: Profile, confirmationReceived: boolean): GoMateState
```

Computes the full `GoMateState` from a profile and a confirmation flag.

State assignment logic:
- Incomplete profile → `"interview"`, `confirmationPending: false`
- Complete + not confirmed → `"review"`, `confirmationPending: true`
- Complete + confirmed → `"complete"`, `confirmationPending: false`

**This function is never called by `app/api/chat/route.ts`.** The chat route implements an equivalent but shorter inline version. `computeNextState()` is available for callers that need the full `GoMateState` object.

---

### `getPendingFieldMetadata(pendingFieldKey)`

`lib/gomate/state-machine.ts:187–190`

```typescript
export function getPendingFieldMetadata(pendingFieldKey: AllFieldKey | null)
```

Returns the `FieldConfig` for the pending field, or `null` if there is no pending field. Allows the system prompt builder and other consumers to access the label, intent, and examples for the field currently being asked.

---

### `formatProfileSummary(profile)`

`lib/gomate/state-machine.ts:193–271`

```typescript
export function formatProfileSummary(profile: Profile): string
```

Formats the filled required fields into a human-readable markdown string organized into six sections:

| Section | Fields |
|---|---|
| Basic Information | `name`, `citizenship`, `current_location`, `destination`, `target_city`, `purpose`, `duration`, `timeline` |
| Purpose Details | All purpose-specific fields (study, work, nomad, settlement) |
| Family & Dependents | `moving_alone`, `spouse_joining`, `children_count`, `children_ages` |
| Financial | `savings_available`, `monthly_budget`, `need_budget_help` |
| Background | `language_skill`, `education_level`, `years_experience` |
| Legal & Health | `prior_visa`, `visa_rejections`, `healthcare_needs`, `pets`, `special_requirements` |

Only fields that are both required and non-null are included. Empty sections are omitted.

Output format: markdown with bold section headers and bulleted `Label: value` items.

Used by: the system prompt builder during the `"review"` state to show the user what has been collected.

---

### `getProgressInfo(profile)`

`lib/gomate/state-machine.ts:274–294`

```typescript
export function getProgressInfo(profile: Profile): {
  filled: number
  total: number
  percentage: number
  currentField: AllFieldKey | null
  currentFieldLabel: string | null
}
```

Returns a structured progress object for the UI. All values are derived fresh from the profile on each call.

`currentFieldLabel` is the human-readable label from `FIELD_CONFIG` for the next pending field, or `null` if complete.

This is included in the `metadata` object sent with every chat response.

---

## 8. How State Is Derived Per Turn

The chat route (`app/api/chat/route.ts:131–140`) derives `InterviewState` inline on each request:

```typescript
const complete = isProfileComplete(profile)
const pendingFieldKey = getNextPendingField(profile)

let interviewState: "interview" | "review" | "confirmed" | "complete" = "interview"
if (complete && !userConfirmed) {
  interviewState = "review"
} else if (complete && userConfirmed) {
  interviewState = "complete"
}
```

Inputs to this logic:
- `profile` — the profile as updated by extraction in this same request
- `userConfirmed` — the `confirmed` boolean from the request body (default: `false`)
- `planLocked` — checked earlier; if `true`, extraction is skipped entirely and the metadata state is forced to `"complete"`

The derived `interviewState` is then:
1. Passed to `buildSystemPrompt()` to generate the correct state-specific system prompt
2. Included in the response metadata as `state`
3. Sent as the `X-GoMate-State` response header

**The `confirmed` flow in practice:**

When a user confirms their profile in the UI, the client resends the request with `confirmed: true` in the body. The chat route sees `userConfirmed = true`, `complete = true`, and sets `interviewState = "complete"`. The system prompt then shifts to the completion mode. The actual plan locking (setting `locked = true` in the DB) happens as a separate subsequent call to `PATCH /api/profile` with `action: "lock"`.

---

## 9. The Lock Mechanism

The `locked` boolean column in `relocation_plans` is the definitive signal that a plan is finalized.

**Lock is triggered by:** `PATCH /api/profile` with `{ action: "lock" }` in the request body.

**What the lock action does** (`app/api/profile/route.ts:92–139`):

```
1. Sets relocation_plans.locked = true
2. Sets relocation_plans.locked_at = current timestamp
3. Sets relocation_plans.stage = "complete"
4. If profile.destination exists AND no guide exists for this plan:
   a. Calls generateGuideFromProfile(profile)
   b. Inserts the generated guide into the guides table
   (Guide generation failure does NOT fail the lock operation)
```

**Effect on the chat route:**

When `plan.locked === true`, the chat route:
- Skips extraction entirely (no GPT-4o-mini call for profile data)
- Loads the locked profile from the database
- Forces `metadata.state = "complete"` regardless of other state logic
- The AI still responds, but in post-lock mode (guided by the system prompt's `"complete"` branch)

**Unlock:** `PATCH /api/profile` with `{ action: "unlock" }`:
- Sets `locked = false`
- Clears `locked_at`
- Does NOT reset `stage` — it remains `"complete"` after unlock

---

## 10. State Transition Diagram — Reality

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
         New plan   │          profile incomplete             │
         created    │                                         │
              │     ▼                                         │
              └──▶ "interview" ─────── extraction per turn ──┘
                       │
                       │ isProfileComplete() returns null
                       │ (all required fields filled)
                       ▼
                   "review"  ◀─── system prompt shows summary
                       │          asks user to confirm
                       │
                       │ request body: confirmed: true
                       ▼
                   "complete" (in-memory per turn)
                       │
                       │ PATCH /api/profile { action: "lock" }
                       ▼
               plan.locked = true          ──── guide generated
               plan.stage = "complete"     ──── extraction disabled
               plan.locked_at = timestamp

         ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                   "confirmed"    (defined in type, unreachable)
         ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
```

---

## 11. Known Inconsistencies

### A — `"confirmed"` state is unreachable

`InterviewState` includes `"confirmed"` but no code path ever produces it.

Both `computeNextState()` and the inline logic in `chat/route.ts` transition directly from `"review"` to `"complete"` when `confirmed: true`. The `"confirmed"` value in the type is dead code.

### B — `computeNextState()` is unused by the primary consumer

`computeNextState()` in `state-machine.ts` is defined as the canonical way to compute state, but `chat/route.ts` does not call it. The chat route implements an equivalent inline:

```typescript
// In chat/route.ts — what actually runs:
if (complete && !userConfirmed) { interviewState = "review" }
else if (complete && userConfirmed) { interviewState = "complete" }
```

This is functionally equivalent for the two states it produces, but it bypasses the `GoMateState` object and `confirmationPending` tracking.

### C — `PATCH /api/profile` uses a hardcoded stale field list

`app/api/profile/route.ts:176–180` contains a hardcoded `requiredFields` array that is used to determine whether to set `stage` to `"generating"`:

```typescript
const requiredFields = [
  "name", "citizenship", "current_location", "destination", "purpose",
  "sub_purpose", "duration", "timeline", "budget", "dependents",
  "language_skill", "work_eligibility", "education", "prior_visa", "special_needs"
]
const filledCount = requiredFields.filter(f => mergedProfile[f]).length
const isComplete = filledCount === requiredFields.length
```

Several of these field names **do not exist** in the current profile schema:

| Name used in `profile/route.ts` | Actual field name in schema |
|---|---|
| `sub_purpose` | Does not exist |
| `budget` | `savings_available` / `monthly_budget` |
| `dependents` | `moving_alone` |
| `work_eligibility` | `job_offer` / `employer_sponsorship` |
| `education` | `education_level` |
| `special_needs` | `special_requirements` |

Because `mergedProfile["sub_purpose"]` and others will always be `undefined`, `isComplete` will never be `true` in this code path. The `stage` will therefore never be automatically set to `"generating"` through `PATCH /api/profile` with a profile update. The `"generating"` stage can only be reached via an explicit call to `updatePlanStage()` from `plan-factory.ts`.

This is an orphaned code block from an earlier version of the schema.

### D — Required fields are computed in two different ways

`getRequiredFields()` from `profile-schema.ts` is the canonical dynamic computation. But `app/api/profile/route.ts` uses its own static hardcoded list (see Inconsistency C). These two systems are not synchronized.

---

## 12. What the State Machine Does Not Do

### No state persistence

There is no `interview_state` column in the database. State is always recomputed from the profile. This means:

- If the profile changes outside the chat (e.g., direct DB edit), the state adjusts automatically on next computation
- There is no history of state transitions
- There is no way to query "what state was this plan in at timestamp X"

### No event emission

No structured event is emitted when the state transitions. There are `console.log` statements throughout but no formal event system.

### No idempotency guarantees

Profile merges via `updateProfile()` are straightforward object spreads. There is no deduplication or versioning. If the same extraction runs twice (e.g., due to a network retry), the same values will be written twice — but because `updateProfile()` only accepts non-null values, this is generally harmless.

### No rollback

There is no mechanism to undo a profile update or state transition. `unlock` can reverse the lock, but it does not restore the profile to a prior state.

### No state recovery

If the server restarts mid-turn, the in-memory state (the profile as it existed at that point in the turn) is lost. The next turn starts from whatever is persisted in `relocation_plans.profile_data`.

---

## 13. Gap Analysis

| Design Contract Requirement | Reality | Status |
|---|---|---|
| Five states: INITIALIZED, IN_PROGRESS, ENRICHING, COMPLETE, ARCHIVED | Four states: `interview`, `review`, `confirmed`, `complete` (names differ; `confirmed` unreachable) | **Different** |
| State names match contract | `interview`/`review`/`confirmed`/`complete` vs `INITIALIZED`/`IN_PROGRESS`/`ENRICHING`/`COMPLETE`/`ARCHIVED` | **Different** |
| ENRICHING state for research phase | No equivalent state — research runs after lock, not as a distinct interview state | **Missing** |
| ARCHIVED state | No equivalent in `InterviewState`; `PlanStage` has `"archived"` as a `status` value | **Partial** |
| Event sourcing — state mutations emit structured events | No events emitted. `console.log` only. | **Missing** |
| Idempotent state transitions | Merge-safe profile updates but no formal idempotency keys | **Partial** |
| Audit trail of state changes | No audit table, no change history | **Missing** |
| State recovery after failure | No recovery mechanism | **Missing** |
| Formal transition guards | State is derived, not guarded — any external profile write can affect computed state | **Missing** |
| `computeNextState()` as canonical state producer | Defined but unused by primary consumer (chat route) | **Inconsistency** |
| `confirmed` state reachable | Type-declared but no code path produces it | **Inconsistency** |

---

## 14. Target State

The GoMate — Profile State Machine contract describes an architecture with five named states:

```
INITIALIZED → IN_PROGRESS → ENRICHING → COMPLETE → ARCHIVED
```

### Key differences from current implementation:

**ENRICHING state** — intended to represent the phase after the user confirms their profile but while external research (visa data, cost of living, checklists) is being gathered asynchronously. Currently this phase has no distinct state. Research is triggered after lock as a fire-and-forget operation.

**ARCHIVED state** — intended to represent a plan that has been explicitly retired. Currently `PlanStage` has no `"archived"` value, but `relocation_plans.status` does include `"archived"` (set by `archivePlan()` in `plan-factory.ts`). The concept exists but not as an `InterviewState`.

**Event sourcing** — the target architecture emits structured events on every state transition, enabling replay, debugging, and audit. This requires:
- An event table in the database
- Structured event types per transition
- A trace_id propagated through all events

**Idempotent transitions** — the target requires formal idempotency keys on state-changing operations to prevent duplicate writes from causing incorrect state transitions.

**State persistence** — the target stores the current state as a discrete value, not derives it on every request. This enables efficient queries and reliable state recovery.

---

*Document generated from direct code analysis of `lib/gomate/state-machine.ts`, `lib/gomate/plan-factory.ts`, `app/api/chat/route.ts`, and `app/api/profile/route.ts`. All claims are traceable to those files.*
