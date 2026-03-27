# Purpose

Verify that Phase 3 enforces one coherent post-arrival execution model:

- non-arrived plans do not show visible post-arrival progress
- hidden historical settling-in state is surfaced only as metadata
- arrived plans expose one canonical task/compliance read model
- enrichment and task mutation surfaces obey the same arrived gate

# Environment and Preconditions

- Environment: local app running at `http://127.0.0.1:3000`
- Auth: sign in with the `.env.local` test account
- Required fixtures in the current database:
  - non-arrived current plan: `04e28c30-dd79-4067-be41-7ea0059e0f94`
  - arrived plan with generated tasks: `3e47c5d5-3c27-435e-b1f0-b7888882d270`
- Expected baseline for the non-arrived plan:
  - `stage = "collecting"`
  - hidden historical settling-in rows may exist
- Expected baseline for the arrived plan:
  - `stage = "arrived"`
  - generated settling-in tasks already exist

# Test Data and Deterministic Inputs

- Auth method:
  - sign in with the configured local test account
  - reuse the authenticated browser session cookie for API checks if testing manually with curl
- Deterministic identifiers:
  - non-arrived plan id: `04e28c30-dd79-4067-be41-7ea0059e0f94`
  - arrived plan id: `3e47c5d5-3c27-435e-b1f0-b7888882d270`
- Deterministic task lookup procedure:
  - active arrived task: switch to the arrived plan, then call `GET /api/settling-in` and choose the first task where `status === "available"`
  - hidden non-arrived task: switch back to the non-arrived plan and query one row from `settling_in_tasks` for `plan_id = "04e28c30-dd79-4067-be41-7ea0059e0f94"`
- Exact mutation payload used in the negative status test:

```json
{ "status": "overdue" }
```

# Happy Path Tests (End-to-End)

## HP-1 Non-arrived progress remains pre-arrival only

1. Make plan `04e28c30-dd79-4067-be41-7ea0059e0f94` current.
2. Call `GET /api/progress`.

Expected response:

- `status = 200`
- `stage = "collecting"`
- `post_arrival_progress = { "percentage": 0, "completed": 0, "total": 0 }`
- `compliance_progress = { "percentage": 0, "completed": 0, "total": 0 }`
- `post_arrival_state.enabled = false`
- `post_arrival_state.hidden` may be non-null if hidden historical tasks exist

## HP-2 Non-arrived settling-in surface stays locked

1. With the same non-arrived plan current, call `GET /api/settling-in`.

Expected response:

- `status = 200`
- `tasks = []`
- `executionEnabled = false`
- `generated = false`
- `stats.total = 0`
- `legacyTaskState` present if hidden historical tasks exist

## HP-3 Arrived plan exposes canonical execution state

1. Switch current plan to `3e47c5d5-3c27-435e-b1f0-b7888882d270`.
2. Call `GET /api/settling-in`.

Expected response:

- `status = 200`
- `executionEnabled = true`
- `tasks.length >= 1`
- `stats.total >= 1`
- every task includes:
  - `urgency`
  - `days_until_deadline`
  - `compliance_scope`
  - `compliance_status`
- at least one legal task includes `compliance_scope = "required"`

## HP-4 Arrived enrichment works for an active task

1. From `GET /api/settling-in`, choose the first task with `status = "available"`.
2. POST `/api/settling-in/{taskId}/why-it-matters`.

Expected response:

- `status = 200`
- body contains `whyItMatters` as a non-empty string
- body contains `cached` boolean

## HP-5 Cached generation does not duplicate work

1. While the arrived plan is current, POST `/api/settling-in/generate`.

Expected response:

- `status = 200`
- `cached = true`
- `stats.total` matches the current `GET /api/settling-in` total

# Negative Tests (Failure / Safety)

## NG-1 Invalid input: derived overdue state cannot be patched

1. While the arrived plan is current, choose an active task id from `GET /api/settling-in`.
2. PATCH `/api/settling-in/{taskId}` with:

```json
{ "status": "overdue" }
```

Expected response:

- `status = 400`
- body contains `error`
- task state remains unchanged on the next `GET /api/settling-in`

## NG-2 Unauthorized access attempt

1. Call `GET /api/progress` without an authenticated session.

Expected response:

- `status = 401`
- body equals or contains `{ "error": "Unauthorized" }`

## NG-3 Invalid state transition attempt: hidden task enrichment before arrival

1. Make non-arrived plan `04e28c30-dd79-4067-be41-7ea0059e0f94` current.
2. Resolve one hidden task id for that plan.
3. POST `/api/settling-in/{hiddenTaskId}/why-it-matters`.

Expected response:

- `status = 400`
- body contains `error = "Task enrichment requires arrival confirmation"`

## NG-4 Missing resource / unknown identifier

1. POST `/api/settling-in/00000000-0000-0000-0000-000000000000/why-it-matters`

Expected response:

- `status = 404`
- body contains `error = "Task not found"`

## NG-5 Interruption / partial execution safety: hidden state remains metadata only

1. With the non-arrived plan current, call `GET /api/progress`.
2. Immediately call `GET /api/settling-in`.

Expected response:

- `GET /api/progress` still reports zero visible post-arrival progress
- `GET /api/settling-in` still returns zero visible tasks
- any hidden historical state appears only in `post_arrival_state.hidden` or `legacyTaskState`

# Time-to-Reproduce Rule

All critical flows in this spec are reproducible in under 5 minutes using the pre-existing plan fixtures and the authenticated localhost session.

If any critical flow takes more than 5 minutes, log:

`TEST-SPEC-FAIL`

# Pass/Fail Criteria

Pass only if all of the following are true:

- every Happy Path test returns the expected response shape and state
- every Negative Test returns the expected safe error outcome
- no non-arrived plan shows visible post-arrival progress
- no hidden/pre-arrival task can be enriched
- no client can mutate `overdue` directly

Fail if any expected status code, response field, or state condition differs.

# Bug Reporting Template

Use this exact structure in `user-bugs-phase-3.md` for any failure:

```md
## BUG-ID
- Reproduction steps:
- Expected result:
- Actual result:
- Severity: Critical | High | Medium | Low
- Evidence:
```

If a critical flow cannot be reproduced in 5 minutes, record:

```md
## TEST-SPEC-FAIL
- Reproduction steps:
- Expected result:
- Actual result:
- Severity: High
- Evidence:
```
