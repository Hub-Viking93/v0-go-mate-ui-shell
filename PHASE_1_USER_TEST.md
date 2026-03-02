# Phase 1 — User Test Specification

**Phase:** Phase 1 — P0 Security Fixes
**Date:** 2026-03-01
**Time-to-reproduce:** Each test < 2 minutes

---

## 1. Purpose

Verify that 5 security and data-integrity fixes are working correctly:
1. Self-upgrade vulnerability is closed (POST /api/subscription removed)
2. GET /api/subscription still works (not broken)
3. Guide auto-generation on plan lock writes correct column data
4. Auth callback rejects malicious redirect URLs
5. Upgrade modal shows informational message instead of calling removed endpoint

---

## 2. Environment and Preconditions

- Deployed preview URL on Vercel, OR `localhost:3000` via `pnpm dev`
- Supabase database with migrations 001–013 applied (Phase 0 complete)
- A test user account (email + password login)
- Browser DevTools → Network tab open for API verification

---

## 3. Test Data and Deterministic Inputs

| Item | Value |
|---|---|
| Test user | Any registered account (create one at `/auth/signup` if needed) |
| Subscription upgrade payload | `{"action":"upgrade","tier":"pro_plus","billing_cycle":"monthly"}` |
| Malicious redirect URL | `//evil.com` |
| Valid redirect URL | `/dashboard` |

---

## 4. Happy Path Tests (End-to-End)

### Test 1: GET /api/subscription returns subscription data

**Steps:**
1. Log in as any user
2. Open browser DevTools → Network tab
3. Navigate to `/settings` (or any page that triggers `use-tier.ts`)
4. Find the `GET /api/subscription` request in the Network tab

**Expected result:**
- HTTP status: `200`
- Response body contains: `subscription` object with `tier` field, `features` object, `pricing` object, `plans` object with `canCreate` boolean

**Pass criteria:** Response has all 4 top-level keys. Tier is one of `"free"`, `"pro_single"`, `"pro_plus"`.

---

### Test 2: Guide auto-generation on plan lock

**Steps:**
1. Log in as a user with a plan in `collecting` or `generating` stage
2. Complete the chat interview until all required fields are filled (or use an existing completed profile)
3. Lock the plan (click "Lock Plan" in the dashboard, or via the chat completion flow)
4. Navigate to `/guides`
5. Click on the guide that was auto-generated
6. Check each section tab: Overview, Visa, Budget, Housing, Practical, Culture, Timeline, Checklist

**Expected result:**
- A guide exists for the locked plan
- Each section tab shows real generated content (destination-specific text)
- No section shows "undefined", blank/empty placeholders, or missing data
- "Download PDF" produces a PDF with all sections populated

**Pass criteria:** All section tabs have non-empty, destination-relevant content. PDF has no "undefined" text.

---

### Test 3: Upgrade modal shows notice message

**Steps:**
1. Log in as a free-tier user
2. Navigate to `/settings`
3. Click "Upgrade" or equivalent button to open the upgrade modal
4. Click "Get Pro Single"

**Expected result:**
- An amber notice banner appears below the plan cards
- Text reads: "Plan upgrades are not yet available. Payment integration is coming soon."
- No network request to `/api/subscription` is visible in Network tab
- The user's tier does NOT change

**Pass criteria:** Notice banner visible. No POST request made. Tier unchanged.

---

### Test 4: Upgrade modal — downgrade shows notice

**Precondition:** Must be logged in as a `pro_single` or `pro_plus` user.

**Steps:**
1. Open upgrade modal from `/settings`
2. Click "Downgrade" button on the Free tier card

**Expected result:**
- Amber notice banner: "Plan changes are not yet available. Please contact support for assistance."
- No POST request to `/api/subscription`
- Tier does NOT change

**Pass criteria:** Notice banner visible. No POST request. Tier unchanged.

---

## 5. Negative Tests (Failure / Safety)

### Negative Test 1: POST /api/subscription is blocked

**Steps:**
1. Open browser DevTools → Console
2. Run:
```javascript
fetch("/api/subscription", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "upgrade", tier: "pro_plus", billing_cycle: "monthly" })
}).then(r => console.log("Status:", r.status))
```

**Expected result:**
- Console logs: `Status: 405`

**Pass criteria:** HTTP 405 response. No tier change occurs.

---

### Negative Test 2: Auth callback rejects malicious redirect

**Steps:**
1. In browser, navigate to: `{BASE_URL}/auth/callback?next=//evil.com`

**Expected result:**
- Redirects to `/auth/error` page (no valid code → auth error)
- Does NOT redirect to `evil.com`
- Error page displays with authentication error message

**Pass criteria:** URL bar shows `/auth/error`, never `evil.com`.

---

### Negative Test 3: Auth callback rejects JavaScript URL

**Steps:**
1. Navigate to: `{BASE_URL}/auth/callback?next=javascript:alert(1)`

**Expected result:**
- Redirects to `/auth/error` page
- No JavaScript execution
- No redirect to external domain

**Pass criteria:** URL bar shows `/auth/error`.

---

### Negative Test 4: PATCH/PUT/DELETE subscription methods blocked

**Steps:**
1. In browser console, run:
```javascript
["PATCH", "PUT", "DELETE"].forEach(method => {
  fetch("/api/subscription", { method }).then(r => console.log(method, r.status))
})
```

**Expected result:**
- All three log `405`

**Pass criteria:** All non-GET methods return 405.

---

## 6. Time-to-Reproduce Rule

Every test above can be reproduced in under 2 minutes. The longest test (Test 2: guide generation) requires a locked plan, which can be prepared in advance.

If any test cannot be reproduced in 5 minutes following these exact steps, log as **TEST-SPEC-FAIL** in `user-bugs-phase-1.md`.

---

## 7. Pass/Fail Criteria

**Phase 1 User Acceptance PASSES when ALL of the following are true:**

- [ ] Test 1: GET /api/subscription returns 200 with correct shape
- [ ] Test 2: Guide sections render with real data (no undefined)
- [ ] Test 3: Upgrade modal shows notice, no POST request
- [ ] Test 4: Downgrade shows notice, no POST request
- [ ] Negative Test 1: POST /api/subscription returns 405
- [ ] Negative Test 2: Malicious redirect blocked
- [ ] Negative Test 3: JavaScript URL blocked
- [ ] Negative Test 4: All non-GET methods return 405

**Phase 1 User Acceptance FAILS if any test fails.**

---

## 8. Bug Reporting Template

If any test fails, log it in `user-bugs-phase-1.md` using this format:

```markdown
### Bug: [Short description]

**Test:** [Which test from this spec]
**Reproduction steps:** [Copied from spec, with any deviation noted]
**Expected result:** [From spec]
**Actual result:** [What happened]
**Severity:** Critical / High / Medium / Low
**Evidence:** [Screenshot, response snippet, or error message]
```
