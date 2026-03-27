# GoMate — Task Graph & Dependency System

**Phase:** 9.4
**Status:** Reality-first
**Contract source:** `docs/gomate-settling-in-engine-layer.md` § 8.2
**Last audited:** 2026-02-25

---

## 1. Purpose

This document describes how task dependencies are modelled, stored, resolved, and computed at runtime. It covers the graph structure, the `computeAvailableTasks()` algorithm, when and how locked tasks become available, and what DAG invariants are and are not enforced.

---

## 2. Graph Model

### 2.1 Storage

Dependencies are stored as an array of UUID strings in `settling_in_tasks.depends_on text[]`.

Each UUID in `depends_on` refers to the `id` of another task in the same plan. This is an adjacency list: each node lists its predecessors (the tasks that must be completed before it becomes available).

```
task_A.depends_on = []             → A has no dependencies; starts "available"
task_B.depends_on = [task_A.id]    → B is locked until A is completed
task_C.depends_on = [task_A.id, task_B.id]  → C locked until both A and B complete
```

### 2.2 Generation-time resolution

The AI generator uses `tempId` strings (short snake_case identifiers like `register_residence`) as dependency references during generation. After UUIDs are assigned, `resolveDependencies()` translates them to real UUIDs before insertion.

Source: `lib/gomate/settling-in-generator.ts:resolveDependencies()`

```typescript
export function resolveDependencies(
  tasks: SettlingTask[],
  tempIdToUuid: Map<string, string>
): { taskUuid: string; dependsOn: string[] }[] {
  return tasks.map((t) => {
    const taskUuid = tempIdToUuid.get(t.tempId) || ""
    const dependsOn = t.dependsOnTempIds
      .map((dep) => tempIdToUuid.get(dep))
      .filter(Boolean) as string[]
    return { taskUuid, dependsOn }
  })
}
```

If a `tempId` in `dependsOnTempIds` does not exist in the map (because the AI invented a non-existent reference), `.filter(Boolean)` silently drops it. No error is raised. Tasks that reference non-existent dependencies become effectively dependency-free after resolution.

---

## 3. Lock Computation

### 3.1 Algorithm

Source: `lib/gomate/settling-in-generator.ts:computeAvailableTasks()`

```typescript
export function computeAvailableTasks(
  tasks: { id: string; status: string; depends_on: string[] }[]
): string[] {
  const completedIds = new Set(
    tasks.filter((t) => t.status === "completed").map((t) => t.id)
  )

  return tasks
    .filter((t) => {
      if (t.status !== "locked") return false
      const deps = t.depends_on || []
      return deps.length === 0 || deps.every((d) => completedIds.has(d))
    })
    .map((t) => t.id)
}
```

**Definition:** A task becomes `available` if and only if:
- Its current `status` is `locked`, AND
- Every UUID in `depends_on` belongs to the set of completed task IDs.

**Excluded statuses:** Tasks with `status = "available"`, `"in_progress"`, `"skipped"`, or `"completed"` are not reprocessed.

**Note on `skipped`:** A task that has been skipped is not treated as `completed`. If task B depends on task A, and A is skipped, B remains `locked` indefinitely. The contract does not address this edge case. This is an implementation-level behaviour with no equivalent in the contract.

### 3.2 When computation runs

The function is called in two contexts:

| Context | File | Trigger |
|---|---|---|
| On GET | `app/api/settling-in/route.ts:52–73` | Every time tasks are fetched |
| On PATCH completion | `app/api/settling-in/[id]/route.ts:86–108` | After a task is marked `completed` |

In both cases, the result is a list of task IDs that should transition from `locked` → `available`, and a batch UPDATE is executed immediately.

### 3.3 GET-time repair

Because `computeAvailableTasks()` runs on every GET, missed unlock operations (e.g. due to a PATCH failure between steps 3 and 6) are repaired automatically on the next page load. This provides eventual consistency for the lock state without requiring a transaction.

---

## 4. Initial Status at Generation

During generation (`app/api/settling-in/generate/route.ts:119–124`):

```typescript
for (const row of tasksToInsert) {
  if (row.depends_on.length === 0) {
    row.status = "available"
  }
}
```

Tasks with no dependencies start as `available`. All others start as `locked`. This initial classification is set before insertion, not computed by `computeAvailableTasks()`.

---

## 5. DAG Invariants

### 5.1 What is enforced

- **No null dependencies:** `filter(Boolean)` in `resolveDependencies()` drops non-existent references.
- **Generation-time DAG validation:** `app/api/settling-in/generate/route.ts` calls `isValidDAG()` after UUID resolution. If the generated graph contains a cycle, all dependencies are stripped before insert.
- **Self-references in the generation path:** A self-reference becomes a 1-node cycle and is neutralized by the same DAG validation step.

### 5.2 What is NOT enforced

**Edit-time cycle detection is not implemented.** The current generation path validates cycles, but there is still no broader dependency integrity layer for manual writes, legacy rows, or any future task-editing UI.

**Cross-plan references:** Not validated. If a `depends_on` UUID happens to belong to a task in a different plan, `computeAvailableTasks()` will never find it in `completedIds` and the task will remain locked. The JOIN between `depends_on` UUIDs and task IDs is computed in-memory over the current plan's tasks only.

**Edit-time validation:** There is no UI for editing dependencies, so edit-time cycle checking is not relevant to the current implementation.

---

## 6. `task_key` — Stable Identifier

The contract specifies using `task_key` (not title) as the stable identifier for dependency references. In the migration schema, `task_key` has a `unique(plan_id, task_key)` constraint.

**Reality:** `task_key` is populated during generation and protected by `UNIQUE(plan_id, task_key)`, but dependency resolution uses UUIDs and chat completion still uses task titles rather than `task_key`.

The chat completion protocol (Phase 10.2) uses task **title** as the identifier in `[TASK_DONE:title]` markers, not `task_key`. This is a documented divergence (see doc 10.2).

---

## 7. `unlocked` Column

The `settling_in_tasks` migration defines `unlocked boolean default false`. This column is not read or written by any application code. The application uses `task.status` as the sole availability signal. The `unlocked` boolean is orphaned schema with no runtime meaning.

---

## 8. Gap Analysis

| Gap | Contract specification | Current implementation | Severity |
|---|---|---|---|
| G-9.4-A | DAG invariant enforcement: cycle detection (DFS or topological sort) | Generation path validates DAGs and strips dependencies on cycle, but there is no wider dependency integrity layer beyond generation | P2 — New writes are safer, but the contract is still only partially met |
| G-9.4-B | `task_key` (not title) used as stable dependency identifier | `task_key` now exists and is persisted, but dependencies use UUIDs and chat protocol still uses title strings | P2 — Stable identity exists, but not across the full execution path |
| G-9.4-C | Cross-plan reference prevention | Not validated; cross-plan UUID silently causes permanent lock | P2 — Behaviour is undetectable |
| G-9.4-D | Self-reference prevention | Generation-time self-references are neutralized by DAG validation, but there is no broader guard for manual/legacy writes | P2 — Safety exists in the main path, not as a universal invariant |
| G-9.4-E | `skipped` tasks treated as completed for dependency purposes | Skipped tasks do not unblock dependents | P2 — User cannot "skip through" a dependency chain |
| G-9.4-F | Edit-time cycle checking | Not applicable — no dependency editing UI exists | N/A |
| G-9.4-G | `unlocked` boolean meaningful and maintained | Dead schema — never read or written | P3 — Misleading column |

---

## 9. Target State (from contract § 8.2)

The target architecture defines:

- Cycle detection at generation time using DFS or topological sort
- Cycle detection at update time when dependencies are edited
- `task_key` used throughout as the stable identifier, including in the `[TASK_DONE:]` chat protocol
- Cross-plan and self-reference prevention in the generator
- `skipped` tasks optionally unblocking dependents (configurable per task)
- Dependency editing UI with real-time cycle validation

---

## 10. Primary Source Files

| File | Role |
|---|---|
| `lib/gomate/settling-in-generator.ts:resolveDependencies()` | TempId → UUID resolution |
| `lib/gomate/settling-in-generator.ts:computeAvailableTasks()` | Availability computation |
| `app/api/settling-in/generate/route.ts:88–124` | Initial status assignment and dependency insertion |
| `app/api/settling-in/route.ts:52–73` | GET-time availability recomputation |
| `app/api/settling-in/[id]/route.ts:86–108` | PATCH-time dependency unlock |
| `scripts/010_settling_in_checklist.sql` | `depends_on text[]`, `unlocked boolean`, unique constraint |
