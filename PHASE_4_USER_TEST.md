# Phase 4 — User Acceptance Test Specification

## 1. Purpose

Verify that guide artifact integrity works correctly: snapshot-bound regeneration prevents silent identity rewriting, and logical guide identity uniqueness is enforced.

---

## 2. Environment and Preconditions

- App deployed on Vercel preview or running at localhost:3000
- Logged in as a user with an existing plan that has a destination and purpose set
- At least one guide already exists for the current plan (auto-generated at plan lock or manually generated)

---

## 3. Test Data and Deterministic Inputs

- **Existing guide:** The guide for your current plan visible on `/guides`
- **Profile destination:** Whatever your current plan's destination is (e.g., Japan, Germany)
- **Profile purpose:** Whatever your current plan's purpose is (e.g., study, work)

---

## 4. Happy Path Tests (End-to-End)

### HP-1: Guide list shows only current guides

1. Navigate to `/guides`
2. **Expected:** Only guides with distinct (destination, purpose) combinations appear. No duplicate entries for the same destination/purpose pair.

### HP-2: Regenerate a guide (same identity)

1. Navigate to `/guides`
2. Click on any guide to view it
3. Note the guide's destination and purpose in the header
4. Click **Regenerate**
5. **Expected:**
   - Guide regenerates successfully
   - The destination and purpose remain the same
   - The version number increments (visible if shown, or verify via response)
   - No new duplicate guide appears in the guide list

### HP-3: View a guide's details after regeneration

1. After HP-2, the guide detail page should show the updated guide content
2. **Expected:** All sections (Visa, Budget, Housing, etc.) render with content, no "undefined" or empty sections

### HP-4: Guide list does not show archived guides

1. Navigate to `/guides`
2. **Expected:** Only current guides are shown. If you had previously generated guides for a different destination that are no longer current, they should NOT appear in the list.

---

## 5. Negative Tests (Failure / Safety)

### NEG-1: Unauthenticated access

1. Open a private/incognito browser window (not logged in)
2. Navigate to `/api/guides`
3. **Expected:** JSON response `{"error":"Unauthorized"}` with HTTP 401

### NEG-2: Non-existent guide ID

1. While logged in, navigate to `/api/guides/00000000-0000-0000-0000-000000000000`
2. **Expected:** JSON response `{"error":"Guide not found"}` with HTTP 404
3. The page should redirect to `/guides` (the frontend handles 404 by redirecting)

### NEG-3: Generate guide without profile

1. If you have a fresh plan with no destination set, try: `POST /api/guides` with `{}`
2. **Expected:** JSON response `{"error":"Complete your profile first to generate a guide"}` with HTTP 400

---

## 6. Time-to-Reproduce Rule

Every test above can be reproduced in under 5 minutes by navigating to the specified URL and performing the described action.

---

## 7. Pass/Fail Criteria

| Criterion | Required |
|---|---|
| HP-1: No duplicate guides in list | PASS |
| HP-2: Regeneration succeeds with same identity | PASS |
| HP-3: All sections render after regeneration | PASS |
| HP-4: Archived guides not shown in list | PASS |
| NEG-1: Unauthenticated → 401 | PASS |
| NEG-2: Non-existent guide → 404/redirect | PASS |
| NEG-3: No profile → 400 | PASS |

All criteria must pass for User Acceptance to pass.

---

## 8. Bug Reporting Template

```
### Bug Title
**Test:** [HP-N or NEG-N]
**Reproduction steps:** [Copy from test spec, note any deviation]
**Expected result:** [From test spec]
**Actual result:** [What happened]
**Severity:** Critical / High / Medium / Low
**Evidence:** [Screenshot, response snippet, or error message]
```
