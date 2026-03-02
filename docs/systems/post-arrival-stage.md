# GoMate — Post-Arrival Stage & Arrival System

**Phase:** 9.1
**Status:** Reality-first
**Contract source:** `docs/gomate-arrival-foundation-layer.md` § 7.1
**Last audited:** 2026-02-25

---

## 1. Purpose

This document describes the plan stage lifecycle for the post-relocation phase: how the `arrived` stage is defined in the database, how the arrival transition works, what the transition endpoint does, and how the `arrived` stage gates downstream systems.

---

## 2. Stage Enum — Reality vs. Contract

### 2.1 Contract definition (§ 7.1.2)

The contract specifies three stages:

```
planning → arrived → archived
```

### 2.2 Actual implementation

The `relocation_plans.stage` column has a different set of values.

**Original schema** (`scripts/002_create_relocation_plans.sql`):

```sql
stage text default 'collecting'
check (stage in ('collecting', 'generating', 'complete'))
```

**Migration 010** (`scripts/010_settling_in_checklist.sql`) adds `arrived`:

```sql
alter table public.relocation_plans
  add constraint relocation_plans_stage_check
  check (stage in ('collecting', 'generating', 'complete', 'arrived'));
```

**Final canonical stage enum (as deployed):**

| Stage | Contract equivalent | Meaning |
|---|---|---|
| `collecting` | `planning` | User is answering the profile interview |
| `generating` | `planning` | Plan generation in progress (locked, awaiting research) |
| `complete` | `planning` | Pre-arrival plan complete; user has not yet arrived |
| `arrived` | `arrived` | User has marked arrival; post-relocation mode active |

**`archived` does not exist as a stage value.** The contract's `archived` stage maps to the `plan.status` column, which has its own enum (`active`, `archived`, `completed`) added in `scripts/009_add_plan_metadata.sql`. The two enums are separate and do not interact in the current codebase.

### 2.3 Gap: `stage_updated_at` field does not exist

The contract specifies a `stage_updated_at timestamptz` field on the plan. No migration adds this column. The timestamp of the arrival transition is captured only in the general-purpose `updated_at` column (auto-updated by trigger).

---

## 3. Plan Fields Related to Arrival

| Field | Type | Nullable | Source | Notes |
|---|---|---|---|---|
| `stage` | `text` | No | `002` + `010` | Default `collecting`; `arrived` added in `010` |
| `arrival_date` | `date` | Yes | `010` | NULL until arrival is confirmed; DATE not DATETIME |
| `post_relocation_generated` | `boolean` | No | `010` | Default `false`; set `true` after checklist generation |
| `is_current` | `boolean` | No | `009` | Enforced unique per user via partial index |
| `status` | `text` | No | `009` | `active` / `archived` / `completed` — separate from `stage` |

`stage_updated_at` does not exist.

---

## 4. Arrival Transition Endpoint

### 4.1 Route

```
POST /api/settling-in/arrive
```

The contract specifies `POST /api/plan/arrive`. The implementation uses a different path.

Source: `app/api/settling-in/arrive/route.ts`

### 4.2 Authentication and tier check

1. `supabase.auth.getUser()` — returns 401 if not authenticated.
2. `getUserTier(user.id)` — returns 403 if tier is not `pro_plus`.

### 4.3 Request body

```typescript
body?: { arrivalDate?: string }  // ISO date string, e.g. "2026-03-15"
```

- If `arrivalDate` is omitted or the body cannot be parsed, the server uses `new Date().toISOString().split("T")[0]` (today's UTC date).
- No future-date or past-limit validation is performed.

### 4.4 Plan lookup

```typescript
supabase
  .from("relocation_plans")
  .select("id, stage")
  .eq("user_id", user.id)
  .eq("is_current", true)
  .maybeSingle()
```

Returns 404 if no current plan exists.

### 4.5 Transition guard

```typescript
if (plan.stage !== "complete" && plan.stage !== "arrived") {
  return NextResponse.json({ error: "..." }, { status: 400 })
}
```

Only plans in `complete` or `arrived` stage can be transitioned. If the plan is already `arrived`, the transition proceeds identically (no early return for idempotency — it re-runs the UPDATE).

### 4.6 State update

```typescript
await supabase
  .from("relocation_plans")
  .update({
    stage: "arrived",
    arrival_date: arrivalDate,
    updated_at: new Date().toISOString(),
  })
  .eq("id", plan.id)
  .eq("user_id", user.id)
```

This is a single UPDATE call. It is not wrapped in a database transaction. No additional operations are performed atomically alongside this write.

### 4.7 Successful response

```json
{
  "success": true,
  "arrivalDate": "2026-03-15",
  "stage": "arrived",
  "planId": "uuid"
}
```

### 4.8 What is NOT done at arrival time

| Contract expectation | Implementation reality |
|---|---|
| Idempotency-Key header required | No idempotency header. Duplicate POSTs re-run the UPDATE silently. |
| `stage_updated_at` written | Not written — field does not exist |
| Emit observability event | Not emitted |
| Enqueue checklist generation job | Not enqueued — generation is a separate explicit user action |
| Atomic transaction | Single UPDATE only |

---

## 5. Client-Side Arrival Flow

Source: `components/arrival-banner.tsx`

`ArrivalBanner` renders only when `tier === "pro_plus" && stage === "complete"`.

The user clicks "I've arrived!", optionally selects a date via a date picker (defaults to today), and confirms. On success, the component calls `router.push("/settling-in")`.

There is no optimistic UI reconciliation against the server response — the component simply redirects.

---

## 6. How `arrived` Gates Downstream Systems

| System | Gate mechanism |
|---|---|
| Settling-in page | `app/(app)/settling-in/page.tsx` checks `tier === "pro_plus"` via `useTier()`; no explicit `stage` check on the page itself — the page is always accessible to Pro+ users |
| Post-arrival chat mode | `app/api/chat/route.ts` reads `plan.stage` from DB; selects `buildPostArrivalSystemPrompt` when `planStage === "arrived"` |
| Compliance alerts | `components/compliance-alerts.tsx` renders only when `planStage === "arrived"` (prop passed from parent) |
| `GET /api/settling-in` | No stage check — returns tasks for the current plan regardless of stage |
| `POST /api/settling-in/generate` | No stage check — generates tasks regardless of stage |
| `PATCH /api/settling-in/[id]` | No stage check — allows task completion regardless of stage |
| `POST /api/settling-in/[id]/why-it-matters` | No stage check |

**Divergence from contract:** The contract specifies that settling-in APIs must verify `plan.stage === 'arrived'` before operating. None of the settling-in API routes perform this check. A user whose plan is in `complete` stage (not yet arrived) could call the generate and task-completion endpoints directly.

There is no shared `isPostArrivalEnabled(plan)` helper function. Each system performs its own check, and the checks are inconsistent.

---

## 7. Concurrency and Idempotency

The arrival endpoint does not implement explicit concurrency protection:

- Duplicate clicks from the same user will both succeed (both re-set `stage: "arrived"` and overwrite `arrival_date`).
- There is no cross-tab protection.
- There is no multi-plan check — users with multiple plans can only have one `is_current = true` at a time (enforced by unique partial index in migration 009).

---

## 8. Gap Analysis

| Gap | Contract specification | Current implementation | Severity |
|---|---|---|---|
| G-9.1-A | Stage enum: `planning`, `arrived`, `archived` | Stage enum: `collecting`, `generating`, `complete`, `arrived`. No `archived` stage. | P2 — Terminology divergence; behaviour is equivalent |
| G-9.1-B | `stage_updated_at` field on plan | Field does not exist; `updated_at` is the closest proxy | P2 — Audit capability reduced |
| G-9.1-C | Endpoint at `POST /api/plan/arrive` | Implemented at `POST /api/settling-in/arrive` | P3 — API path divergence |
| G-9.1-D | Idempotency-Key header required | No idempotency header; duplicate POSTs silently overwrite `arrival_date` | P2 — Race condition risk on double-click |
| G-9.1-E | Atomic transition (set fields + emit event + enqueue job) | Single UPDATE only; no events, no job enqueue | P2 — Observability absent; no auto-trigger of generation |
| G-9.1-F | Settling-in APIs must verify `plan.stage === 'arrived'` | No such check in generate, GET, PATCH, or why-it-matters routes | P1 — Pre-arrival users can interact with settling-in endpoints |
| G-9.1-G | `isPostArrivalEnabled(plan)` shared helper | Does not exist; each system checks independently and inconsistently | P2 — Maintenance risk |
| G-9.1-H | Client validates arrival date (not future, not too old) | No client or server validation of provided date | P3 — Bad data possible |
| G-9.1-I | Checklist generation auto-triggered after arrival | Not triggered — user must manually navigate to /settling-in and click "Generate" | P2 — UX friction; user may not know to generate |

---

## 9. Target State (from contract § 7.1)

**V1 note:** The stage enum `collecting → generating → complete → arrived` is the **locked v1 implementation**. CLAUDE.md declares `lib/gomate/state-machine.ts` a protected file that must not be changed without explicit instruction. Renaming `collecting/generating/complete` to `planning` is a V2+ refactor only. Do not change the stage enum in v1.

`archived` remains a **`plan.status`** value (column `status` in `relocation_plans`), NOT a `plan.stage` value, for the entirety of v1.

The contract's target architecture (V2+ considerations only):

- V2: Three clean stages: `planning` → `arrived` → `archived` (aligned with contract naming)
- `stage_updated_at` field persisted on every stage transition
- `POST /api/plan/arrive` with mandatory `Idempotency-Key` header
- Fully atomic transition: all field writes + event emission + optional job enqueue in one database transaction
- Arrival date validated (not future, not older than 12 months without confirmation)
- Shared `isPostArrivalEnabled(plan)` helper used consistently across all settling-in routes and components

V1 target (Phase 2): All settling-in API routes verify `plan.stage === 'arrived'` before proceeding — using the existing `arrived` stage value.

---

## 10. Primary Source Files

| File | Role |
|---|---|
| `app/api/settling-in/arrive/route.ts` | Arrival transition endpoint |
| `components/arrival-banner.tsx` | Client-side arrival trigger UI |
| `scripts/002_create_relocation_plans.sql` | Original plan schema |
| `scripts/009_add_plan_metadata.sql` | Adds `is_current`, `status`, `title` |
| `scripts/010_settling_in_checklist.sql` | Adds `arrival_date`, `post_relocation_generated`, extends stage enum |
| `app/api/chat/route.ts:152` | Stage check for post-arrival chat mode |
| `components/compliance-alerts.tsx:39` | Stage check for compliance alerts |
