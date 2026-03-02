# Phase 3 — Data Integrity

**Status:** Not started
**Prerequisite:** Phase 2 complete
**Specification authority:** `docs/build-protocol.md` § "Phase 3 — Data Integrity"
**Gate protocol:** `docs/phase-implementation-protocol.md`

---

## Rationale

Three data integrity gaps remain after Phase 2:

1. **Non-atomic plan switching** — switching the active plan involves two sequential database writes. A crash between them leaves the user with no active plan, which breaks every API route that fetches `is_current = true`.

2. **Plan creation race condition** — two simultaneous `GET /api/profile` calls on first login both find no existing plan, both attempt to insert one, the second insert fails the unique constraint and returns a 500 to the client. The user sees an error on first login.

3. **`task_key` never populated** — the `task_key` column has a unique constraint on `settling_in_tasks` but is never set during task generation. This means duplicate-prevention logic doesn't work and any future code that queries by `task_key` will always miss.

---

## Entry Criteria

Before starting Phase 3, verify ALL of the following are true:

```
[ ] docs/phase-status.md shows Phase 2 ✅ Complete
[ ] backend-acceptance-phase-2.md exists and is final
[ ] frontend-wiring-report-phase-2.md exists and is final
[ ] regression-report-phase-2.md exists and is final
[ ] POST /api/settling-in/generate with non-arrived plan returns 400 (Phase 2 confirmed)
[ ] PATCH /api/settling-in/{id} with non-arrived plan returns 400 (Phase 2 confirmed)
[ ] lib/gomate/dag-validator.ts exists and passes both test cases
```

---

## Files to Change

| File | Action | Gap(s) fixed |
|---|---|---|
| `scripts/014_add_plan_switch_rpc.sql` | Create new file — defines `switch_current_plan()` RPC | G-4.2-A |
| `app/api/plans/route.ts` (lines 144–165) | Replace two-write switch with `supabase.rpc("switch_current_plan")` | G-4.2-A |
| `app/api/profile/route.ts` (lines 29–48) | Handle constraint violation on race condition — re-fetch existing plan instead of returning 500 | G-6.2-E |
| `app/api/settling-in/generate/route.ts` | Populate `task_key` from deterministic title slug before batch insert | G-9.2-B |

## Files to NOT Touch

- Settling-in engine and task card UI
- Profile schema and Zod validation
- Auth flow
- All migration files 001–013

---

## Exact Changes Required

### 1. Create `scripts/014_add_plan_switch_rpc.sql`

```sql
create or replace function switch_current_plan(p_user_id uuid, p_plan_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update relocation_plans
  set is_current = (id = p_plan_id)
  where user_id = p_user_id
    and (is_current = true or id = p_plan_id);
end;
$$;
```

This single `UPDATE` atomically sets `is_current = true` for the target plan and `is_current = false` for all currently-active plans, in one transaction. No crash window.

**Apply this migration in Supabase SQL editor before testing the API changes.**

---

### 2. `app/api/plans/route.ts` — Replace switch action handler

**Location:** lines 144–165, the `action === "switch"` branch.

**Current broken code** (two sequential writes):
```typescript
// Write 1: clear all plans
await supabase.from("relocation_plans").update({ is_current: false }).eq("user_id", user.id)
// Write 2: set new plan as current
await supabase.from("relocation_plans").update({ is_current: true }).eq("id", planId)...
```

**Fix:**
```typescript
if (action === "switch") {
  const { error } = await supabase.rpc("switch_current_plan", {
    p_user_id: user.id,
    p_plan_id: planId,
  })

  if (error) {
    return NextResponse.json({ error: "Failed to switch plan" }, { status: 500 })
  }

  const { data: switched } = await supabase
    .from("relocation_plans")
    .select()
    .eq("id", planId)
    .eq("user_id", user.id)
    .single()

  return NextResponse.json({ plan: switched })
}
```

---

### 3. `app/api/profile/route.ts` — Handle race condition on plan creation

**Location:** lines 29–48, the `if (!plan)` branch inside the GET handler.

**Current broken code:**
```typescript
if (!plan) {
  const { data: newPlan, error: createError } = await supabase
    .from("relocation_plans")
    .insert({ user_id: user.id, profile_data: {}, stage: "collecting", is_current: true })
    .select()
    .single()

  if (createError) {
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 })
  }
  return NextResponse.json({ plan: newPlan })
}
```

**Fix — re-fetch on constraint violation instead of returning 500:**
```typescript
if (!plan) {
  const { data: newPlan, error: createError } = await supabase
    .from("relocation_plans")
    .insert({ user_id: user.id, profile_data: {}, stage: "collecting", is_current: true })
    .select()
    .single()

  if (createError) {
    // Constraint violation: a concurrent request already created the plan.
    // Re-fetch and return the existing plan.
    const { data: existingPlan } = await supabase
      .from("relocation_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle()

    if (!existingPlan) {
      console.error("[GoMate] Error creating plan:", createError)
      return NextResponse.json({ error: "Failed to create plan" }, { status: 500 })
    }
    return NextResponse.json({ plan: existingPlan })
  }

  return NextResponse.json({ plan: newPlan })
}
```

---

### 4. `app/api/settling-in/generate/route.ts` — Populate `task_key`

Before the batch insert into `settling_in_tasks`, derive a `task_key` for each task:

```typescript
const tasksWithKeys = tasks.map(task => ({
  ...task,
  task_key: task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64)
}))
```

Then insert `tasksWithKeys` instead of `tasks`.

This slug is deterministic — the same task title always produces the same `task_key` — and URL-safe. It does not need to be globally unique across plans (the unique constraint on `settling_in_tasks` is scoped by `plan_id` if one exists; verify the migration before assuming global uniqueness).

---

## Gap Codes Fixed in This Phase

| Code | System | Severity | Description |
|---|---|---|---|
| G-4.2-A | Plans | P1 | Non-atomic plan switch — two sequential writes with crash window |
| G-6.2-E | End-to-End | P1 | Plan creation race condition on concurrent first login returns 500 |
| G-9.2-B | Settling-In | P2 | `task_key` unique constraint exists but never populated |

---

## V1 Invariants This Phase Strengthens

| Invariant | Description | Improvement |
|---|---|---|
| INV-D1 | Every DB column in application code has a migration | `switch_current_plan()` function is now in a migration file |

---

## Exit Criteria (Success Criteria from `docs/build-protocol.md`)

All of the following must be true before Phase 3 can be declared complete:

```
[ ] scripts/014_add_plan_switch_rpc.sql exists and defines switch_current_plan() correctly
[ ] PATCH /api/plans with action "switch" calls supabase.rpc("switch_current_plan", ...)
[ ] Two simultaneous plan-switch requests do not leave the user with no active plan
[ ] SELECT * FROM relocation_plans WHERE user_id = X AND is_current = true returns exactly one row after any plan switch
[ ] Two simultaneous GET /api/profile requests on first login: both return 200 (not 500)
[ ] Both concurrent requests return the same plan (no duplicate plans created)
[ ] Generated settling-in tasks have non-null task_key values after generation
[ ] task_key values are URL-safe slugs (only a-z, 0-9, hyphens; max 64 chars)
[ ] tsc --noEmit passes with zero errors
```

---

## Required Gate Artifacts

| Artifact | Owner | Gate |
|---|---|---|
| `backend-acceptance-phase-3.md` | Claude Code | Backend Acceptance Gate (gate 2) |
| `frontend-wiring-report-phase-3.md` | Claude Code | Frontend Wiring Gate (gate 3) |
| `regression-report-phase-3.md` | Claude Code + User | Regression Gate (gate 6) |

Plus: `PHASE_3_USER_TEST.md` (User Test Spec Gate, gate 4).

---

## Migration Required

Phase 3 requires one migration:

| File | Action | Content |
|---|---|---|
| `scripts/014_add_plan_switch_rpc.sql` | Create + apply | `switch_current_plan(p_user_id, p_plan_id)` PL/pgSQL function |

**Apply in Supabase SQL editor before Backend Acceptance Gate testing begins.**

After applying 014, the next migration number becomes **015**.
