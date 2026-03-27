# Plans System — System Document

**Phase:** 4.2
**Status:** Reality-first (documents what exists)
**Primary sources:**
- `lib/gomate/plan-factory.ts` (280 lines)
- `app/api/plans/route.ts` (221 lines)
- `app/api/profile/route.ts` — plan lock operations
- `scripts/002_create_relocation_plans.sql`
- `scripts/009_add_plan_metadata.sql`
**Last audited:** 2026-02-25

---

## 1. Overview

The plans system manages the lifecycle of a user's relocation plans. Each plan is the central data container for the entire GoMate workflow: it holds the user's profile, research results, checklist, and visa data. A user can have one or more plans (depending on their subscription tier), but only one plan is "current" at a time.

---

## 2. RelocationPlan Interface

```typescript
export type PlanStage = "collecting" | "generating" | "complete"

export interface RelocationPlan {
  id: string
  user_id: string
  profile_data: Profile
  stage: PlanStage
  title: string | null
  status: "active" | "archived" | "completed"
  is_current: boolean
  visa_recommendations: any | null
  timeline: any | null
  budget_plan: any | null
  checklist: any | null
  created_at: string
  updated_at: string
}
```

### 2.1 Plan Stage

| Stage | Meaning |
|---|---|
| `collecting` | Profile is being built through chat interview |
| `generating` | Profile is locked; research/guide generation is running |
| `complete` | Research is done; the plan is fully generated |

**Gap:** The interview state machine (Phase 1.2) independently derives interview state (`interview`, `review`, `confirmed`, `complete`) from `profile_data` and `locked` status. The plan `stage` is a separate parallel concept tracked at the database row level. These two state systems are not formally synchronized — there is no enforced invariant that `stage = "generating"` implies `interview_state = "confirmed"`.

### 2.2 Plan Status

| Value | Meaning |
|---|---|
| `active` | Plan is in use (default) |
| `archived` | User archived the plan; no longer current |
| `completed` | (Exists in constraint but not set by any current code path) |

**Gap:** `status = "completed"` is allowed by the DB constraint but no function sets it. Only `"active"` and `"archived"` are used in practice.

### 2.3 JSONB Fields in RelocationPlan

The TypeScript interface declares four `any | null` JSONB fields that are NOT populated by the current main workflow:

| Field | Status | Notes |
|---|---|---|
| `visa_recommendations` | Declared but not written by current code | Separate `visa_research` column used instead (undocumented, see Phase 3.1) |
| `timeline` | Declared but not written | Never set |
| `budget_plan` | Declared but not written | Budget data is computed on-demand, not persisted here |
| `checklist` | Declared in type, exists in migration 002 | Not the same as `checklist_items` column used by research/checklist route |

This means the `RelocationPlan` TypeScript interface contains 4 fields that are either unused or shadow the real storage columns (`visa_research`, `local_requirements_research`, `checklist_items`).

---

## 3. relocation_plans Table

### 3.1 Column Source: migrations 002 + 009

**From migration 002 (base table):**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `user_id` | uuid FK → auth.users | cascade delete |
| `profile_data` | jsonb | Full Profile object |
| `stage` | text | collecting / generating / complete |
| `visa_recommendations` | jsonb | `[]` default — not currently populated |
| `budget_plan` | jsonb | `{}` default — not currently populated |
| `checklist` | jsonb | `{}` default — shadow of `checklist_items` column |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**From migration 009 (add metadata):**

| Column | Type | Notes |
|---|---|---|
| `title` | text | Auto-generated or user-set |
| `status` | text | active / archived / completed |
| `is_current` | boolean | Partial unique index enforces one per user |

**Columns added outside migrations (undocumented):**

| Column | Used by | Status |
|---|---|---|
| `visa_research` | visa/route.ts, trigger/route.ts | Not in any migration |
| `research_status` | trigger/route.ts, visa/route.ts | Not in any migration |
| `research_completed_at` | trigger/route.ts, local-requirements/route.ts | Not in any migration |
| `local_requirements_research` | local-requirements/route.ts, trigger/route.ts | Not in any migration |
| `checklist_items` | checklist/route.ts | In migration 002 ✓ |
| `locked` | profile/route.ts, chat/route.ts | In migration 002 ✓ |

### 3.2 is_current Partial Unique Index

```sql
create unique index relocation_plans_current_per_user
  on public.relocation_plans (user_id) where (is_current = true);
```

This enforces the invariant that a user can have at most one plan where `is_current = true`. The active API path now switches plans through the `switch_current_plan` RPC, which performs the clear-and-set sequence server-side.

**Gap:** `app/api/plans/route.ts` uses the RPC and is atomic at the request boundary, but the unused helper in `plan-factory.ts` still performs a two-step non-atomic switch. If that helper is reintroduced without the RPC, it can leave all plans as `is_current = false`.

---

## 4. plan-factory.ts Functions

All functions are server-side (`"use server"`), creating a Supabase server client per call.

| Function | Signature | Behavior |
|---|---|---|
| `getCurrentPlan()` | `() → Promise<RelocationPlan \| null>` | Gets `is_current = true` plan; falls back to most recent if none found, auto-sets it as current |
| `createPlan(profile?, title?)` | `(Partial<Profile>?, string?) → Promise<RelocationPlan \| null>` | Clears all `is_current`, inserts new plan as current |
| `switchCurrentPlan(planId)` | `(string) → Promise<RelocationPlan \| null>` | Two-step non-atomic switch in dead helper code; active API path uses RPC instead |
| `listUserPlans()` | `() → Promise<RelocationPlan[]>` | Returns all plans ordered by is_current DESC, created_at DESC |
| `renamePlan(planId, title)` | `(string, string) → Promise<boolean>` | Updates title + updated_at |
| `archivePlan(planId)` | `(string) → Promise<boolean>` | Sets status=archived, is_current=false |
| `updatePlanProfile(planId, profileData)` | `(string, Partial<Profile>) → Promise<RelocationPlan \| null>` | Reads current profile, merges, writes back |
| `updatePlanStage(planId, stage)` | `(string, PlanStage) → Promise<RelocationPlan \| null>` | Sets stage + updated_at |
| `getOrCreatePlan()` | `() → Promise<RelocationPlan \| null>` | Returns current plan or creates a new one |

### 4.1 Title Generation

`generatePlanTitle(profile?)` (private):

```
if profile.destination AND profile.purpose → "{PurposeLabel} in {Destination}"
if profile.destination only              → "Move to {Destination}"
else                                     → "Plan {DD Mon YYYY}"
```

The same logic is duplicated in `app/api/plans/route.ts` as `generateTitleFromProfile()`. Two independent copies.

---

## 5. API Endpoints

### 5.1 GET /api/plans

Returns all plans for the authenticated user with tier information.

```typescript
Response: {
  plans: Array<{
    id, title, status, is_current, stage,
    destination,  // derived from profile_data.destination
    purpose,      // derived from profile_data.purpose
    created_at, updated_at
  }>
  tier: Tier
}
```

**Note:** `profile_data`, `visa_recommendations`, `timeline`, `budget_plan`, `checklist` are NOT included in the GET response. The API selects only: `id, title, status, is_current, stage, profile_data, created_at, updated_at` — then projects destination/purpose out of `profile_data`. The full profile is not exposed here.

### 5.2 POST /api/plans

Creates a new plan for the user, subject to tier plan limit.

```
POST /api/plans
{ title?: string }
│
├── Auth check
├── canCreatePlan() → checks plan count vs subscription.plan_limit
│   └── If at limit → 403 { error, tier, current, limit }
│
├── Clear all is_current
├── Insert new plan: stage="collecting", status="active", is_current=true
└── Return { plan: RelocationPlan }
```

**Plan limit enforcement:** Uses `canCreatePlan()` from `tier.ts`, which counts all `relocation_plans` for the user (regardless of status). Archived plans count against the limit.

**Gap:** Archived plans count toward the plan limit. A user on the free tier (limit=1) who archives their only plan cannot create a new one without upgrading — even though the archived plan is inactive.

### 5.3 PATCH /api/plans

Supports three `action` values:

| Action | Body | Effect |
|---|---|---|
| `switch` | `{ planId, action: "switch" }` | Two-step is_current flip |
| `rename` | `{ planId, action: "rename", title }` | Update title |
| `archive` | `{ planId, action: "archive" }` | status=archived, is_current=false |

All actions verify plan ownership before executing.

**Gap:** There is no plan `DELETE` endpoint. Once a plan is archived, it cannot be permanently deleted via the API.

---

## 6. Plan Lock Mechanics

Plan locking (`locked` column on `relocation_plans`) is managed via `PATCH /api/profile` (not `PATCH /api/plans`). When a plan is locked:

1. `profile/route.ts` sets `locked = true` and `stage = "generating"` on `relocation_plans`
2. Guide generation is triggered
3. Research trigger is fired
4. Subsequent chat turns check `locked` and refuse to update the profile

Unlocking (`locked = false`) resets the stage back to `"collecting"`. See Phase 2.1 for the full lock/unlock flow.

---

## 7. Plan JSONB Fields vs Research Columns

There is a semantic overlap between the TypeScript `RelocationPlan` interface and the undocumented research columns written by the research routes:

| RelocationPlan field | Research column | Status |
|---|---|---|
| `visa_recommendations` | `visa_research` | Both exist; visa_research is the one actually written |
| `checklist` | `checklist_items` | Both in migration 002; checklist_items is used |
| `timeline` | (no equivalent) | Not written by any route |
| `budget_plan` | (no equivalent) | Not written by any route |

The TypeScript type and the DB schema diverged at some point. The interface reflects an earlier design; the research routes write to different column names.

---

## 8. Gap Analysis — Critical Findings

### G-4.2-A: Dead helper still contains non-atomic is_current switch logic

`app/api/plans/route.ts` PATCH now delegates switching to the `switch_current_plan` RPC, so the active request path is atomic at the database boundary. The remaining non-atomic risk is confined to the unused `plan-factory.ts:switchCurrentPlan()` helper, which still performs two UPDATE statements without a transaction.

### G-4.2-B: RelocationPlan interface has 4 unused or shadow fields

`visa_recommendations`, `timeline`, `budget_plan`, and `checklist` (from migration 002 columns) are declared in the TypeScript interface but either not written by any current code, or shadowed by the actual columns used (`visa_research`, `checklist_items`).

### G-4.2-C: Plan status "completed" is unreachable

The DB constraint allows `status = 'completed'` but no function sets it. Plans go from `active` to `archived` only. The `completed` status was designed but not wired.

### G-4.2-D: Archived plans count against the plan limit

`canCreatePlan()` counts all plans including archived ones. Free-tier users who archive their plan cannot create a new one without upgrading.

### G-4.2-E: generatePlanTitle() duplicated

The title-generation logic exists in two places: `plan-factory.ts:generatePlanTitle()` (private) and `app/api/plans/route.ts:generateTitleFromProfile()` (local). The two implementations produce the same output today but could diverge.

### G-4.2-F: No plan DELETE endpoint

Plans can be archived but not permanently deleted via API. The DB has `on delete cascade` from `auth.users` to `relocation_plans`, so deletion only occurs when the user account is deleted.

---

## 9. Target State

| Item | Current | Target |
|---|---|---|
| is_current switch | RPC-backed in the active API path; two-step non-atomic in dead helper code | Explicit current_plan pointer or keep RPC as the only switch path |
| Plan status "completed" | Unreachable | Wire stage="complete" → status="completed" |
| Interface vs schema alignment | 4 shadow/unused fields | Align RelocationPlan interface with actual DB columns |
| Archived plans in limit count | Yes | Exclude archived plans from plan limit count |
| Plan DELETE | Not available | Add DELETE /api/plans/[id] |
| Title generation | Duplicated in two files | Centralize in plan-factory.ts, import in route |
