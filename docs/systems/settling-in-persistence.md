# GoMate — Settling-In Persistence

**Phase:** 9.2
**Status:** Reality-first
**Contract source:** `docs/gomate-arrival-foundation-layer.md` § 7.2
**Last audited:** 2026-02-25

---

## 1. Purpose

This document describes the `settling_in_tasks` database table: its schema, constraints, indexes, RLS policies, and how the persistence layer is used by the application. It also documents schema mismatches between the migration script and the runtime code.

---

## 2. Table: `settling_in_tasks`

Source: `scripts/010_settling_in_checklist.sql`

### 2.1 Complete column listing

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `plan_id` | `uuid` | No | — | FK → `relocation_plans(id)` ON DELETE CASCADE |
| `user_id` | `uuid` | No | — | FK → `auth.users(id)` ON DELETE CASCADE |
| `task_key` | `text` | No | — | Short snake_case identifier (e.g. `register_residence`) |
| `title` | `text` | No | — | Human-readable task name |
| `description` | `text` | Yes | — | 1–2 sentence explanation |
| `category` | `text` | No | — | One of 10 category values (see §2.2) |
| `depends_on` | `text[]` | Yes | `'{}'` | Array of dependency task UUIDs |
| `unlocked` | `boolean` | Yes | `false` | Present in schema; **not used by application code** |
| `status` | `text` | Yes | `'locked'` | Enum: `locked`, `available`, `in_progress`, `completed`, `skipped` |
| `completed_at` | `timestamptz` | Yes | — | Set when status transitions to `completed` |
| `deadline_days` | `integer` | Yes | — | Days after arrival by which task must be done; NULL if no deadline |
| `deadline_source` | `text` | Yes | — | Free-text source attribution for deadline; never populated |
| `is_legal_requirement` | `boolean` | Yes | `false` | True if task failure can result in fines or legal consequences |
| `why_it_matters` | `text` | Yes | — | AI-generated enrichment text; NULL until user requests it |
| `how_to` | `text` | Yes | — | Present in schema; **not populated by application code** |
| `official_link` | `text` | Yes | — | URL to official resource |
| `estimated_time` | `text` | Yes | — | Human-readable time estimate (e.g. "1–2 hours") |
| `cost_estimate` | `text` | Yes | — | Present in schema; **application code inserts into `cost` (wrong column name)** |
| `tips` | `text[]` | Yes | `'{}'` | Present in schema; **not populated by application code** |
| `sort_order` | `integer` | Yes | `0` | Ascending sort for display order |
| `created_at` | `timestamptz` | Yes | `now()` | Auto-set on insert |
| `updated_at` | `timestamptz` | Yes | `now()` | Auto-updated by trigger |

### 2.2 Category enum

No DB-level constraint enforces categories. The application validates against this list in `lib/gomate/settling-in-generator.ts`:

```
registration | banking | housing | healthcare | employment
transport | utilities | social | legal | other
```

### 2.3 Status enum

Enforced by check constraint:

```sql
check (status in ('locked', 'available', 'in_progress', 'completed', 'skipped'))
```

### 2.4 Unique constraint

```sql
unique(plan_id, task_key)
```

This constraint exists but is never triggered in practice because `task_key` is not populated during generation (see §3.1 below).

---

## 3. Schema Mismatch: Migration vs. Runtime

> **Phase 0 update (2026-02-28):** The three missing columns (`steps`, `documents_needed`, `cost`) were added via `scripts/011_add_settling_task_columns.sql` and applied to the live database. The `cost` column co-exists with `cost_estimate` — both are kept. The mismatch described below reflects the state before Phase 0. Only the `task_key`, `how_to`, `tips`, and `unlocked` gaps remain.

The generate route (`app/api/settling-in/generate/route.ts`) inserts rows with column names that do not match the migration schema. This is a critical discrepancy.

### 3.1 Columns inserted by the application but not in migration

| Application field | Migration column | Status |
|---|---|---|
| `steps` (string array) | Does not exist | **No migration column** |
| `documents_needed` (string array) | Does not exist | **No migration column** |
| `cost` (string) | `cost_estimate` (not `cost`) | **Name mismatch** |
| — | `task_key` | **Application does not insert `task_key`** |
| — | `how_to` | **Application does not insert `how_to`** |
| — | `tips` | **Application does not insert `tips`** |
| — | `unlocked` | **Application does not write this field** |

**Interpretation:** The deployed database schema likely includes `steps text[]`, `documents_needed text[]`, and `cost text` columns that were added after migration 010 was written. The migration script in the repository does not reflect the full deployed schema. The `SettlingInTask` TypeScript interface (used in `components/settling-in-task-card.tsx`) confirms that `steps`, `documents_needed`, and `cost` are expected as actual database columns.

This means there is at least one undocumented migration that exists in the deployed environment but not in the `scripts/` directory.

---

## 4. Row-Level Security

RLS is enabled on `settling_in_tasks`.

Four policies, all keyed on `auth.uid() = user_id`:

| Policy | Operation | Condition |
|---|---|---|
| `settling_tasks_select_own` | SELECT | `auth.uid() = user_id` |
| `settling_tasks_insert_own` | INSERT | `auth.uid() = user_id` |
| `settling_tasks_update_own` | UPDATE | `auth.uid() = user_id` |
| `settling_tasks_delete_own` | DELETE | `auth.uid() = user_id` |

All operations are permitted only for the row owner. There is no server-bypass policy — the API routes use `createClient()` (service role not used), so RLS applies to all application reads and writes.

---

## 5. Indexes

| Index | Column(s) | Purpose |
|---|---|---|
| `settling_tasks_plan_id_idx` | `plan_id` | Efficient task listing by plan (primary fetch pattern) |
| `settling_tasks_user_id_idx` | `user_id` | Cross-plan queries; RLS enforcement aid |
| `settling_tasks_status_idx` | `status` | Filter by status (available tasks, completed tasks) |
| `settling_tasks_category_idx` | `category` | Category grouping on settling-in page |

The primary fetch in `GET /api/settling-in` queries by `plan_id` and orders by `sort_order`. There is no index on `sort_order`, meaning sort is performed in memory after the `plan_id` index lookup.

---

## 6. `updated_at` Trigger

```sql
create trigger update_settling_in_tasks_updated_at
  before update on public.settling_in_tasks
  for each row
  execute function public.update_updated_at_column();
```

The `update_updated_at_column()` function is defined in `scripts/002_create_relocation_plans.sql` and sets `new.updated_at = timezone('utc'::text, now())`.

---

## 7. Task Status Lifecycle

```
locked → available → in_progress → completed
              ↓
           skipped
```

- Tasks with no dependencies start as `available` (set during generation).
- Tasks with unmet dependencies start as `locked`.
- `locked` → `available`: computed by `computeAvailableTasks()` and written in batch on GET and PATCH operations.
- `available` → `in_progress`: user-settable via PATCH (no automated trigger).
- `available` or `in_progress` → `completed`: via PATCH; triggers dependency unlock computation.
- `available` → `skipped`: via PATCH.
- Reversal: `completed` → `available` is allowed by the PATCH handler (user can un-complete a task).

Source: `app/api/settling-in/[id]/route.ts`, `lib/gomate/settling-in-generator.ts:computeAvailableTasks()`

---

## 8. Task Completion — Atomic Behavior

When `PATCH /api/settling-in/[id]` is called with `{ status: "completed" }`:

1. Fetch task by ID with ownership check (`user_id` match).
2. Guard: reject if task is currently `locked` (cannot complete a locked task).
3. UPDATE `status = "completed"`, `completed_at = now()`.
4. Fetch ALL tasks for the same `plan_id`.
5. Run `computeAvailableTasks()` over the full list (with the just-completed task reflected as `completed`).
6. Batch UPDATE newly available tasks to `status = "available"`.

This is not a database transaction. Steps 3 and 4–6 are separate round-trips. A failure between steps 3 and 6 leaves the task `completed` but its dependents still `locked`. On the next `GET /api/settling-in` call the same `computeAvailableTasks()` logic runs and repairs the state.

Source: `app/api/settling-in/[id]/route.ts:86–108`

---

## 9. `locked` vs. `unlocked` Column

The migration defines `unlocked boolean default false`. No application code reads or writes this column. The application uses `task.status === "locked"` / `task.status === "available"` as the lock signal. The `unlocked` boolean is dead schema.

---

## 10. Optional Tables — Not Implemented

| Table | Contract purpose | Implementation status |
|---|---|---|
| `settling_in_generation_runs` | Idempotency key tracking, debugging, replay | **Does not exist** |
| `settling_in_task_events` | Append-only audit log of task status changes | **Does not exist** |

---

## 11. Related Plan Columns

The following columns on `relocation_plans` are part of the settling-in persistence layer:

| Column | Migration | Purpose |
|---|---|---|
| `arrival_date` | `010` | The anchor date for all deadline calculations |
| `post_relocation_generated` | `010` | Idempotency flag for checklist generation |

---

## 12. Gap Analysis

| Gap | Contract specification | Current implementation | Severity |
|---|---|---|---|
| G-9.2-A | Schema clearly defined with `steps`, `documents_needed`, `cost` | ~~Migration does not include these columns~~ — **RESOLVED by Phase 0 (2026-02-28):** `scripts/011_add_settling_task_columns.sql` adds `steps text[]`, `documents_needed text[]`, and `cost text` with `ADD COLUMN IF NOT EXISTS`. Applied to live database. Note: `cost` and `cost_estimate` remain separate columns — do not drop `cost_estimate`. | Resolved |
| G-9.2-B | `task_key` uniquely identifies tasks across plans | `task_key` is defined and has a unique constraint but is never populated during generation | P2 — Unique constraint is inert; task_key always NULL |
| G-9.2-C | `unlocked` boolean: computed, meaningful field | `unlocked` boolean defined but never read or written by application code | P2 — Dead schema |
| G-9.2-D | `settling_in_generation_runs` table for idempotency/debugging | Not implemented | P2 — No generation audit trail |
| G-9.2-E | `settling_in_task_events` append-only audit log | Not implemented | P2 — No task history |
| G-9.2-F | Atomic completion transaction (verify → update → recompute → emit) | Two separate DB round-trips; no transaction; no event emission | P2 — Partial failure can leave locked dependents until next GET |
| G-9.2-G | `deadline_source` documents legal source for deadline | Column exists; never populated | P3 — Data quality |

---

## 13. Target State (from contract § 7.2)

The target architecture adds:

- A `settling_in_generation_runs` table recording each generation attempt with `job_key`, `status`, `plan_id`, `created_at`, and result metadata
- A `settling_in_task_events` table: append-only audit log of all status changes with actor, timestamp, and method (manual / chat)
- Atomic completion transaction in a database function or Supabase RPC
- Event emission on task completion (`task.completed` event with trace_id)
- `deadline_source` and `how_to` fields properly populated

---

## 14. Primary Source Files

| File | Role |
|---|---|
| `scripts/010_settling_in_checklist.sql` | Migration — table definition, RLS, indexes |
| `app/api/settling-in/route.ts` | `GET` — list tasks, run availability computation |
| `app/api/settling-in/[id]/route.ts` | `PATCH` — update status, trigger unlock computation |
| `app/api/settling-in/generate/route.ts` | `POST` — generate and insert tasks |
| `lib/gomate/settling-in-generator.ts:computeAvailableTasks()` | Lock computation function |
| `components/settling-in-task-card.tsx` | `SettlingInTask` TypeScript interface (source of truth for runtime field names) |
