# Phase 2 — Settling-In Stage Integrity

**Status:** Not started
**Prerequisite:** Phase 1 complete
**Specification authority:** `docs/build-protocol.md` § "Phase 2 — Settling-In Stage Integrity"
**Gate protocol:** `docs/phase-implementation-protocol.md`

---

## Rationale

All settling-in endpoints are accessible to pre-arrival users (`plan.stage !== 'arrived'`), violating INV-D2 and INV-D3. A user in `collecting` or `complete` stage can currently:
- Trigger settling-in task generation (`POST /api/settling-in/generate`)
- Complete a settling-in task (`PATCH /api/settling-in/[id]`)
- Retrieve a settling-in task list (`GET /api/settling-in`)

Additionally, the settling-in task generator has no DAG cycle detection. If the AI produces a cyclical dependency graph, the affected tasks become permanently deadlocked with no recovery path (INV-D4 violated).

---

## Entry Criteria

Before starting Phase 2, verify ALL of the following are true:

```
[ ] docs/phase-status.md shows Phase 1 ✅ Complete
[ ] backend-acceptance-phase-1.md exists and is final
[ ] frontend-wiring-report-phase-1.md exists and is final
[ ] regression-report-phase-1.md exists and is final
[ ] POST /api/subscription returns 405 (Phase 1 fix confirmed live)
[ ] Guide PDF renders complete sections (Phase 1 fix confirmed live)
[ ] /auth/callback validates the `next` parameter (Phase 1 fix confirmed live)
```

---

## Files to Change

| File | Action | Gap(s) fixed |
|---|---|---|
| `app/api/settling-in/generate/route.ts` | Add `plan.stage === 'arrived'` check before generation | G-9.3-A |
| `app/api/settling-in/generate/route.ts` | Import and call `isValidDAG()` after dependency resolution | G-9.4-A |
| `app/api/settling-in/[id]/route.ts` | Add `plan.stage === 'arrived'` check in PATCH handler | G-10.2-C |
| `app/api/settling-in/route.ts` | Add `plan.stage === 'arrived'` check in GET handler | G-9.1-F |
| `lib/gomate/dag-validator.ts` | Create new file — exports `isValidDAG()` | G-9.4-A |

## Files to NOT Touch

- `lib/gomate/settling-in-generator.ts` beyond the `isValidDAG()` call site
- `computeAvailableTasks()` — working correctly; do not touch
- Settling-in task card UI components
- Compliance timeline components
- The arrival endpoint (`app/api/settling-in/arrive/route.ts`) — arrival itself is not stage-gated

---

## Exact Changes Required

### 1. Create `lib/gomate/dag-validator.ts`

New file. Exports a single function:

```typescript
/**
 * Validates that the task dependency graph is a DAG (no cycles).
 * Returns true if valid (safe to insert), false if a cycle is detected.
 * Uses DFS with three-color marking: white (unvisited), grey (in-progress), black (done).
 */
export function isValidDAG(tasks: { id: string; depends_on: string[] }[]): boolean {
  const state = new Map<string, 'white' | 'grey' | 'black'>()
  for (const t of tasks) state.set(t.id, 'white')

  const adjacency = new Map<string, string[]>()
  for (const t of tasks) adjacency.set(t.id, t.depends_on ?? [])

  function dfs(id: string): boolean {
    const s = state.get(id)
    if (s === 'black') return true   // already fully visited — safe
    if (s === 'grey') return false   // back edge — cycle detected

    state.set(id, 'grey')
    for (const dep of adjacency.get(id) ?? []) {
      if (!dfs(dep)) return false
    }
    state.set(id, 'black')
    return true
  }

  for (const t of tasks) {
    if (state.get(t.id) === 'white') {
      if (!dfs(t.id)) return false
    }
  }
  return true
}
```

---

### 2. `app/api/settling-in/generate/route.ts` — Add stage check + DAG validation

**Add stage check** immediately after fetching the current plan and before calling the generator:

```typescript
if (plan.stage !== 'arrived') {
  return NextResponse.json(
    { error: "Settling-in features require arrival confirmation" },
    { status: 400 }
  )
}
```

**Add DAG validation** after `resolveDependencies()` resolves tempId references and before the batch insert:

```typescript
import { isValidDAG } from '@/lib/gomate/dag-validator'

// After dependency resolution:
if (!isValidDAG(tasks)) {
  console.error('[settling-in/generate] Cycle detected in generated task graph — using fallback tasks')
  tasks = getDefaultSettlingInTasks(/* destination */)
}
```

The fallback must be a hardcoded list of tasks with no dependencies (a flat list is always a valid DAG).

---

### 3. `app/api/settling-in/[id]/route.ts` — Add stage check to PATCH

After fetching the task and its parent plan, before applying any status update:

```typescript
if (plan.stage !== 'arrived') {
  return NextResponse.json(
    { error: "Task completion requires arrival confirmation" },
    { status: 400 }
  )
}
```

---

### 4. `app/api/settling-in/route.ts` — Add stage check to GET

The GET endpoint must not 400 on pre-arrival (the UI uses this endpoint to know whether to show the settling-in tab). Instead, return an empty list with stage metadata:

```typescript
if (plan.stage !== 'arrived') {
  return NextResponse.json({
    tasks: [],
    stage: plan.stage,
    arrivalDate: null
  })
}
```

This allows the frontend to display a "confirm arrival first" empty state instead of a generic error.

---

## Gap Codes Fixed in This Phase

| Code | System | Severity | Description |
|---|---|---|---|
| G-9.3-A | Settling-In Engine | P1 | Generate endpoint does not verify plan is in `arrived` stage |
| G-9.1-F | Post-Arrival Stage | P1 | Settling-in GET route does not verify `plan.stage === 'arrived'` |
| G-10.2-C | Task Completion | P1 | PATCH endpoint does not verify `plan.stage === 'arrived'` |
| G-9.4-A | Task Graph | P1 | No DAG cycle detection — cycles cause permanent task deadlock |

---

## V1 Invariants This Phase Satisfies

| Invariant | Description | How verified |
|---|---|---|
| INV-D2 | settling_in_tasks rows only created for `arrived` plans | POST /api/settling-in/generate with stage=complete → 400 |
| INV-D3 | settling_in_tasks completion only for `arrived` plans | PATCH /api/settling-in/{id} with stage=complete → 400 |
| INV-D4 | Task graph is a valid DAG | isValidDAG([{id:'a', depends_on:['b']},{id:'b', depends_on:['a']}]) → false; cyclical AI output falls back to defaults |

---

## Exit Criteria (Success Criteria from `docs/build-protocol.md`)

All of the following must be true before Phase 2 can be declared complete:

```
[ ] POST /api/settling-in/generate with plan.stage = 'complete' returns 400
[ ] PATCH /api/settling-in/{id} with plan.stage = 'complete' returns 400
[ ] GET /api/settling-in with plan.stage = 'complete' returns { tasks: [], stage: 'complete', arrivalDate: null }
[ ] lib/gomate/dag-validator.ts exists and exports isValidDAG()
[ ] isValidDAG([{ id: 'a', depends_on: ['b'] }, { id: 'b', depends_on: ['a'] }]) returns false
[ ] isValidDAG([{ id: 'a', depends_on: [] }, { id: 'b', depends_on: ['a'] }]) returns true
[ ] Generation with a cyclical AI response falls back to default tasks without throwing
[ ] All existing settling-in functionality (task generation, task completion, enrichment) still works for arrived users
[ ] tsc --noEmit passes with zero errors
```

---

## Required Gate Artifacts

| Artifact | Owner | Gate |
|---|---|---|
| `backend-acceptance-phase-2.md` | Claude Code | Backend Acceptance Gate (gate 2) |
| `frontend-wiring-report-phase-2.md` | Claude Code | Frontend Wiring Gate (gate 3) |
| `regression-report-phase-2.md` | Claude Code + User | Regression Gate (gate 6) |

Plus: `PHASE_2_USER_TEST.md` (User Test Spec Gate, gate 4).

---

## No Migration Required

Phase 2 makes no database schema changes. No SQL migration file needs to be created or applied. The next migration number remains **015**.
