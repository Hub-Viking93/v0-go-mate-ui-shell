# Phase 2 — User Test Specification

**Phase:** Phase 2 — Settling-In Stage Integrity
**Date:** 2026-03-01
**Time-to-reproduce:** Each test < 3 minutes

---

## 1. Purpose

Verify that settling-in endpoints enforce `plan.stage === 'arrived'` and that the DAG validator prevents cyclical task dependencies:

1. Pre-arrival users cannot generate settling-in tasks (400)
2. Pre-arrival users cannot complete settling-in tasks (400)
3. Pre-arrival users see empty task list with stage metadata (200, not 400)
4. The settling-in page shows a "confirm arrival first" locked state
5. Arrived users can still generate and complete tasks normally

---

## 2. Environment and Preconditions

- Deployed preview URL on Vercel, OR `localhost:3000` via `pnpm dev`
- A **Pro+ tier** test user account
- Browser DevTools open (Network + Console tabs)

### How to check your plan stage

Run in browser console (while logged in):
```javascript
fetch("/api/profile").then(r => r.json()).then(d => console.log("Stage:", d.plan?.stage))
```

Expected: `"complete"` (pre-arrival) or `"arrived"` (post-arrival)

---

## 3. Test Data and Deterministic Inputs

| Item | Value |
|---|---|
| Test user | Pro+ tier account |
| Pre-arrival state | `plan.stage` is `"collecting"`, `"generating"`, or `"complete"` |
| Post-arrival state | `plan.stage` is `"arrived"` (use dashboard "I've arrived" button) |

---

## 4. Happy Path Tests (End-to-End)

### Test 1: Pre-arrival — Settling-in page shows locked state

**Precondition:** Logged in as Pro+ user. `plan.stage !== 'arrived'` (check via console command above).

**Steps:**
1. Navigate to `/settling-in`

**Expected result:**
- A card with a lock icon and heading "Confirm your arrival first"
- Text: "Your settling-in checklist will be available after you confirm arrival..."
- "Go to Dashboard" button visible
- **No** "Generate checklist" button visible

**Pass criteria:** Lock card visible. No generate button.

---

### Test 2: Pre-arrival — GET /api/settling-in returns empty tasks with stage

**Precondition:** Same as Test 1.

**Steps:**
1. Run in browser console:
```javascript
fetch("/api/settling-in").then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)))
```

**Expected result:**
```json
{
  "tasks": [],
  "stage": "complete",
  "arrivalDate": null
}
```
(The `stage` value will match your current plan stage)

**Pass criteria:** HTTP 200. `tasks` is `[]`. `stage` is present and matches plan stage. `arrivalDate` is `null`.

---

### Test 3: Post-arrival — Generate settling-in tasks

**Precondition:** Pro+ user. Confirm arrival first (dashboard → "I've arrived" button). Then navigate to `/settling-in`.

**Steps:**
1. Navigate to `/settling-in` after arrival confirmation
2. Click "Generate checklist"
3. Wait for generation (30–60 seconds)

**Expected result:**
- Tasks appear grouped by category (Legal, Housing, Banking, etc.)
- Progress bar shows `0/{N}` completed
- Tasks have statuses: "available" (no dependencies) or "locked" (has dependencies)

**Pass criteria:** Tasks generated. No errors. Categories visible.

---

### Test 4: Post-arrival — Complete a task

**Precondition:** Test 3 completed. Tasks visible.

**Steps:**
1. Find a task with status "available"
2. Click it / expand it
3. Mark as "in progress", then "completed"

**Expected result:**
- Task status changes to "completed"
- Progress bar updates
- Dependent tasks may unlock

**Pass criteria:** Status transitions work. No errors.

---

## 5. Negative Tests (Failure / Safety)

### Negative Test 1: POST /api/settling-in/generate blocked for pre-arrival

**Precondition:** Pro+ user. `plan.stage !== 'arrived'`.

**Steps:**
1. Run in browser console:
```javascript
fetch("/api/settling-in/generate", { method: "POST" })
  .then(r => Promise.all([r.status, r.json()]))
  .then(([status, body]) => console.log({ status, body }))
```

**Expected result:**
```
{ status: 400, body: { error: "Settling-in features require arrival confirmation" } }
```

**Pass criteria:** HTTP 400. Exact error message. No tasks created.

---

### Negative Test 2: PATCH /api/settling-in/{id} blocked for pre-arrival

**Precondition:** You need a real task ID. If you previously generated tasks while arrived and then somehow are pre-arrival again, use that ID. Otherwise: **skip this test** and mark "N/A — no pre-arrival tasks exist to test against" (this is expected; pre-arrival users cannot generate tasks, so there's nothing to PATCH).

**Steps (if applicable):**
```javascript
fetch("/api/settling-in/TASK_ID", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: "completed" })
}).then(r => Promise.all([r.status, r.json()]))
  .then(([status, body]) => console.log({ status, body }))
```

**Expected result:**
```
{ status: 400, body: { error: "Task completion requires arrival confirmation" } }
```

**Pass criteria:** HTTP 400 with correct error message.

---

### Negative Test 3: Unauthorized access

**Steps:**
1. Open incognito window
2. Run in console: `fetch("/api/settling-in").then(r => console.log(r.status))`

**Expected result:** `401`

**Pass criteria:** HTTP 401.

---

### Negative Test 4: Non-Pro+ user

**Precondition:** Logged in as free-tier user (or use a separate free account).

**Steps:**
1. Navigate to `/settling-in`

**Expected result:**
- Tier gate appears — "Post-relocation features require Pro+"

**Pass criteria:** Gate page visible. No task data.

---

## 6. Time-to-Reproduce Rule

Every test is reproducible in under 3 minutes. Test 3 (generation) takes 30–60 seconds for AI processing. If any critical flow cannot be reproduced in 5 minutes, log **TEST-SPEC-FAIL**.

---

## 7. Pass/Fail Criteria

**Phase 2 User Acceptance PASSES when ALL are true:**

- [ ] Test 1: Pre-arrival page shows locked state (no generate button)
- [ ] Test 2: GET returns `{tasks:[], stage, arrivalDate:null}` for pre-arrival
- [ ] Test 3: Post-arrival generation works
- [ ] Test 4: Post-arrival task completion works
- [ ] Negative Test 1: POST generate returns 400 for pre-arrival
- [ ] Negative Test 2: PATCH returns 400 for pre-arrival (or N/A)
- [ ] Negative Test 3: Unauthorized → 401
- [ ] Negative Test 4: Non-Pro+ sees tier gate

---

## 8. Bug Reporting Template

```markdown
### Bug: [Short description]

**Test:** [Which test]
**Steps:** [Copied from spec, with deviations]
**Expected:** [From spec]
**Actual:** [What happened]
**Severity:** Critical / High / Medium / Low
**Evidence:** [Screenshot, console output, or response]
```
