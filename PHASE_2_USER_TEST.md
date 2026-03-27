# Phase 2 User Test Specification — Research And Checklist Integrity

## 1. Purpose

Verify Phase 2 implementation for master-audit gaps B2-002, B2-004, B2-005, B2-007, B2-008, B2-010, B2-011, B2-012. These changes improve research status honesty, checklist quality tracking, and document identity coupling.

---

## 2. Environment and Preconditions

- App deployed to Vercel preview OR running locally at `localhost:3000`
- Supabase migration 021 (`research_meta` column) has been applied
- Test user has a locked plan with existing research data
- Browser with DevTools open (Network tab) for response inspection

---

## 3. Test Data and Deterministic Inputs

- **Test user:** Your existing account with a completed/locked plan
- **Plan state:** Must have `locked = true` and `stage = "complete"` or `"arrived"`
- **Existing data:** Plan should have `visa_research` and `checklist_items` from previous research runs

---

## 4. Happy Path Tests (End-to-End)

### TEST-HP-1: Research Trigger Returns Per-Artifact Quality

**Steps:**
1. Open DevTools → Network tab
2. Navigate to the chat page
3. If plan is already locked, trigger research by calling `POST /api/research/trigger` with `{ "planId": "<your-plan-id>" }` via DevTools console:
   ```javascript
   fetch("/api/research/trigger", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ planId: "<your-plan-id>" })
   }).then(r => r.json()).then(console.log)
   ```
4. Wait for response (up to 60 seconds)

**Expected:**
- Response contains `status` field: one of `"completed"`, `"partial"`, or `"failed"`
- Response contains `meta` object with structure:
  ```json
  {
    "meta": {
      "visa": { "status": "completed"|"failed", "quality": "full"|"partial"|"fallback", "optionCount": <number> },
      "localRequirements": { "status": "completed"|"failed" },
      "checklist": { "status": "completed"|"failed", "isFallback": <boolean>, "itemCount": <number>, "hadVisaResearch": <boolean> }
    }
  }
  ```
- If `meta.visa.optionCount === 0`, aggregate `status` should be `"partial"` (not `"completed"`)
- If `meta.checklist.isFallback === true`, aggregate `status` should be `"partial"` (not `"completed"`)

### TEST-HP-2: Dashboard Shows Partial Research Banner

**Steps:**
1. After TEST-HP-1, if the research status is `"partial"`, navigate to the dashboard
2. Observe the research status banner area

**Expected:**
- If `research_status === "partial"`: amber banner says "Research completed with limited results"
- If `research_status === "completed"`: no partial banner (staleness banner may appear after 7 days)
- If `research_status === "failed"`: red banner says "Research couldn't be completed"

### TEST-HP-3: Checklist Shows Fallback Warning

**Steps:**
1. Navigate to the Documents page
2. Observe the AI checklist info section (above the checklist items)

**Expected:**
- If the checklist was generated with fallback data: amber text "This is a general checklist. Refresh to get personalized requirements..."
- If the checklist was AI-researched: no fallback warning
- The checklist info section shows "Personalized for: <visa type>"

### TEST-HP-4: Checklist Research Regeneration

**Steps:**
1. On the Documents page, click the "Refresh" button in the stale checklist banner (or use DevTools):
   ```javascript
   fetch("/api/research/checklist", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ planId: "<your-plan-id>" })
   }).then(r => r.json()).then(console.log)
   ```

**Expected:**
- Response contains `checklist.isFallback` field (boolean)
- Response contains `checklist.generatorInputs` with `{ hadVisaResearch, hadFirecrawlResearch, visaName }`
- All checklist item IDs are snake_case (no spaces, no special characters)

### TEST-HP-5: Document Status With Identity Validation

**Steps:**
1. Open DevTools console
2. Mark a valid document as completed:
   ```javascript
   fetch("/api/documents", {
     method: "PATCH",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ documentId: "passport", completed: true })
   }).then(r => r.json()).then(console.log)
   ```

**Expected:**
- Response: `{ "success": true, "statuses": { "passport": { "completed": true, "completedAt": "<ISO timestamp>", "documentName": "Valid Passport" } } }`
- The status entry includes `documentName` for traceability

### TEST-HP-6: GET Research Trigger Returns Meta

**Steps:**
1. Call GET /api/research/trigger from DevTools:
   ```javascript
   fetch("/api/research/trigger").then(r => r.json()).then(console.log)
   ```

**Expected:**
- Response contains `meta` field (may be `null` for pre-Phase-2 data, or an object after fresh trigger)
- Response contains `status`, `completedAt`, `hasVisaResearch`, `hasLocalRequirements`

---

## 5. Negative Tests (Failure / Safety)

### TEST-NEG-1: Invalid Document ID Rejected

**Steps:**
1. Call PATCH /api/documents with a non-existent document ID:
   ```javascript
   fetch("/api/documents", {
     method: "PATCH",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ documentId: "nonexistent_xyz_123", completed: true })
   }).then(r => r.json()).then(console.log)
   ```

**Expected:**
- HTTP 400 with `{ "error": "Document ID does not match any checklist item" }`
- No orphaned entry created in document_statuses

### TEST-NEG-2: Missing DocumentId in PATCH

**Steps:**
1. Call PATCH /api/documents with missing documentId:
   ```javascript
   fetch("/api/documents", {
     method: "PATCH",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ completed: true })
   }).then(r => r.json()).then(console.log)
   ```

**Expected:**
- HTTP 400 with `{ "error": "Invalid request body" }`

### TEST-NEG-3: Unauthenticated Access

**Steps:**
1. Open an incognito window (not logged in)
2. Navigate to `/api/research/trigger`

**Expected:**
- HTTP 401 with `{ "error": "Unauthorized" }`

### TEST-NEG-4: Research Trigger on Unlocked Plan

**Steps:**
1. If you have an unlocked plan, call POST /api/research/trigger with its planId

**Expected:**
- HTTP 409 with `{ "error": "Plan must be locked before research can run" }`

---

## 6. Time-to-Reproduce Rule

Every test above should be reproducible within 5 minutes using DevTools console calls. No external tools required beyond the browser.

---

## 7. Pass/Fail Criteria

**PASS** requires ALL of the following:
- TEST-HP-1: Research trigger returns `meta` with per-artifact quality
- TEST-HP-2: Dashboard shows correct banner for research status
- TEST-HP-3: Documents page shows fallback warning when applicable
- TEST-HP-5: Document PATCH returns `documentName` in status
- TEST-HP-6: GET trigger returns `meta` field
- TEST-NEG-1: Invalid document ID rejected with 400
- TEST-NEG-2: Missing documentId returns 400
- TEST-NEG-3: Unauthenticated access returns 401

**ACCEPTABLE DEGRADATION:**
- TEST-HP-4: Checklist may return `isFallback: true` if Firecrawl/LLM is unavailable (this is the correct behavior — the system honestly reports fallback)
- TEST-HP-1: Research may return `"partial"` status — this is the correct behavior for degraded quality

**FAIL** if any of:
- Research trigger does not return `meta` object
- Document PATCH accepts invalid documentId without validation
- Dashboard does not distinguish `"partial"` from `"completed"` status

---

## 8. Bug Reporting Template

```
### BUG-PHASE2-XXX
- **Test:** TEST-XX-N
- **Steps:** (exact reproduction steps)
- **Expected:** (from spec above)
- **Actual:** (what happened)
- **Severity:** Critical / High / Medium / Low
- **Evidence:** (screenshot, console output, or response snippet)
```
