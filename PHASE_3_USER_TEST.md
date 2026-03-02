# Phase 3 — User Test Specification

**Phase:** Phase 3 — Data Integrity
**Date:** 2026-03-02
**Time-to-reproduce:** Each test < 3 minutes

---

## 1. Purpose

Verify three data integrity fixes:

1. Plan switching is atomic (single RPC call, no crash window)
2. Concurrent plan creation on first login doesn't return 500
3. Generated settling-in tasks have populated `task_key` values

---

## 2. Environment and Preconditions

- Deployed preview URL on Vercel, OR `localhost:3000` via `pnpm dev`
- A **Pro+ tier** test user account
- Browser DevTools open (Network + Console tabs)

### Migration Required

**Before testing**, run `scripts/014_add_plan_switch_rpc.sql` in the Supabase SQL editor. This creates the `switch_current_plan()` database function.

---

## 3. Test Data and Deterministic Inputs

| Item | Value |
|---|---|
| Test user | Pro+ tier account |
| Plans | User should have at least 2 relocation plans |
| Pre-arrival state | `plan.stage` is NOT `arrived` (for task_key test, need to switch to arrived plan) |

### How to check your plans

Run in browser console (while logged in):
```javascript
fetch("/api/plans").then(r => r.json()).then(d => {
  console.log("Plans:", d.plans?.length)
  d.plans?.forEach(p => console.log(`  ${p.id.substring(0,8)} | current: ${p.is_current} | stage: ${p.stage}`))
})
```

---

## 4. Happy Path Tests (End-to-End)

### Test 1: Atomic plan switch

**Precondition:** Logged in as Pro+ user with at least 2 plans.

**Steps:**
1. Open browser console
2. Get the ID of a non-current plan:
```javascript
const plans = await fetch("/api/plans").then(r => r.json())
const other = plans.plans.find(p => !p.is_current)
console.log("Switching to:", other.id)
```
3. Execute the switch:
```javascript
const res = await fetch("/api/plans", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ planId: other.id, action: "switch" })
})
const data = await res.json()
console.log("Status:", res.status, "Switched plan:", data.plan?.id?.substring(0,8))
```
4. Verify exactly one plan is current:
```javascript
const after = await fetch("/api/plans").then(r => r.json())
const current = after.plans.filter(p => p.is_current)
console.log("Current plans:", current.length, "(should be 1)")
current.forEach(p => console.log("  Current:", p.id.substring(0,8)))
```

**Expected result:**
- HTTP 200
- Switched plan returned
- Exactly 1 plan with `is_current: true`

**Pass criteria:** Switch succeeds. Exactly one current plan after switch.

---

### Test 2: Profile endpoint returns plan (normal path)

**Steps:**
```javascript
fetch("/api/profile").then(r => r.json()).then(d => console.log("Plan:", d.plan?.id?.substring(0,8), "Stage:", d.plan?.stage))
```

**Expected result:** HTTP 200, plan data returned.

**Pass criteria:** HTTP 200. Plan object present.

---

### Test 3: task_key populated on settling-in task generation

**Precondition:** Pro+ user with `plan.stage === 'arrived'`. If not already arrived, switch to an arrived plan (Test 1), or use the dashboard "I've arrived" button.

**Steps:**
1. Navigate to `/settling-in` (should show generate button if arrived and no tasks)
2. Click "Generate checklist" and wait for generation
3. Verify task_keys in console:
```javascript
const data = await fetch("/api/settling-in").then(r => r.json())
data.tasks.forEach(t => console.log(`task_key: "${t.task_key}" | title: "${t.title}"`))
const allHaveKeys = data.tasks.every(t => t.task_key && t.task_key.length > 0)
const allUrlSafe = data.tasks.every(t => /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(t.task_key))
console.log("All have task_key:", allHaveKeys, "| All URL-safe:", allUrlSafe)
```

**Expected result:**
- Every task has a non-null, non-empty `task_key`
- All `task_key` values are URL-safe slugs (a-z, 0-9, hyphens only)
- No leading or trailing hyphens

**Pass criteria:** `allHaveKeys` is `true`. `allUrlSafe` is `true`.

---

## 5. Negative Tests (Failure / Safety)

### Negative Test 1: Plan switch with invalid plan ID

**Steps:**
```javascript
fetch("/api/plans", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ planId: "00000000-0000-0000-0000-000000000000", action: "switch" })
}).then(r => console.log("Status:", r.status))
```

**Expected result:** HTTP 404 (plan not found)

**Pass criteria:** HTTP 404. No crash.

---

### Negative Test 2: Unauthorized access

**Steps (incognito window):**
```javascript
fetch("/api/plans").then(r => console.log("Status:", r.status))
fetch("/api/profile").then(r => console.log("Status:", r.status))
```

**Expected result:** Both return 401

**Pass criteria:** HTTP 401 on both.

---

## 6. Time-to-Reproduce Rule

Every test is reproducible in under 3 minutes. Test 3 (task generation) takes 30–60 seconds for AI processing. If any critical flow cannot be reproduced in 5 minutes, log **TEST-SPEC-FAIL**.

---

## 7. Pass/Fail Criteria

**Phase 3 User Acceptance PASSES when ALL are true:**

- [ ] Test 1: Atomic plan switch works, exactly 1 current plan after switch
- [ ] Test 2: GET /api/profile returns plan (200)
- [ ] Test 3: Generated tasks have populated, URL-safe task_key values
- [ ] Negative Test 1: Invalid plan ID returns 404
- [ ] Negative Test 2: Unauthorized returns 401

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
