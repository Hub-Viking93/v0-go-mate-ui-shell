# Phase 5 User Test Specification — Travel And Cost Surface Hardening

**Phase:** Master-Audit Phase 5
**Date:** 2026-03-15
**Gaps:** B5-004, B5-005, B5-006

---

## 1. Purpose

Verify that:
1. The flight API rejects unauthenticated and unprivileged requests
2. Flight search results no longer contain obviously implausible data
3. Cost-of-living API rejects unauthenticated requests
4. The booking page and dashboard cost card still work for authenticated users

---

## 2. Environment and Preconditions

- Vercel preview deployment (or `localhost:3000` with `pnpm dev`)
- A user account with `pro_single` or `pro_plus` tier (for flight search tests)
- A user account with `free` tier (for tier rejection test)
- Browser developer tools open (Network tab) for inspecting API calls
- No new SQL migrations are required for this phase

---

## 3. Test Data and Deterministic Inputs

### Flight search test data:
- From: `JFK` (New York)
- To: `BER` (Berlin)
- Depart date: any future date (e.g., 2026-04-15)
- Travelers: 1
- Cabin class: Economy

### Airport resolution test:
- Type `MAN` in the airport search → should resolve to Manchester Airport
- Type `IST` → should resolve to Istanbul Airport
- Type `BKK` → should resolve to Bangkok Suvarnabhumi Airport

### Cost-of-living test data:
- Country: Germany
- City: Berlin (optional)

---

## 4. Happy Path Tests (End-to-End)

### Test 4.1 — Flight Search (Authenticated Pro+ User)

1. Log in with a `pro_single` or `pro_plus` user
2. Navigate to `/booking`
3. The booking page should load (not blocked by tier gate)
4. Enter: From = `JFK`, To = `BER`, Depart = any future date
5. Click "Search"
6. **Expected:** Search results appear (may be mock data if no FIRECRAWL_API_KEY). Verify in the Network tab that `POST /api/flights` returns HTTP 200 with a JSON response containing `allFlights` array.

### Test 4.2 — Airport Autocomplete Expanded

1. On the booking page, click the "From" airport field
2. Type `MAN`
3. **Expected:** "Manchester Airport (MAN)" appears in the autocomplete dropdown
4. Type `IST`
5. **Expected:** "Istanbul Airport (IST)" appears
6. Type `BKK`
7. **Expected:** "Bangkok Suvarnabhumi Airport (BKK)" appears

### Test 4.3 — Cost-of-Living Card (Authenticated User)

1. Log in with any tier user
2. Navigate to `/dashboard`
3. **Expected:** The cost-of-living card loads with data for your destination (if profile has a destination set)
4. Open Network tab and verify `GET /api/cost-of-living?country=...` returns HTTP 200
5. **Expected:** The response contains `rent`, `utilities`, `food`, `transportation`, `estimatedMonthlyBudget` fields

### Test 4.4 — Flight Result Quality (if live Firecrawl data is returned)

1. Perform a flight search from `JFK` to `BER`
2. **Expected:** No flight result shows a duration under 5 hours (minimum plausible for transatlantic)
3. **Expected:** No flight result shows a price under $30 or over $25,000
4. If results are mock data (indicated by "(Demo data)" label), this test is informational only

---

## 5. Negative Tests (Failure / Safety)

### Test 5.1 — Unauthenticated Flight API Access

1. Open a private/incognito browser window (not logged in)
2. Navigate directly to: `https://<your-deployment>/api/flights`
3. **Expected:** HTTP 401 response with `{"error":"Unauthorized"}`
4. Using curl or browser console, send POST to `/api/flights`:
   ```
   fetch("/api/flights", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({from:"JFK",to:"BER",departDate:"2026-04-15"})}).then(r=>r.json()).then(console.log)
   ```
5. **Expected:** Response is `{"error":"Unauthorized"}` with status 401

### Test 5.2 — Free Tier Flight API Access

1. Log in with a `free` tier user
2. Navigate to `/booking`
3. **Expected:** The page shows a tier gate / upgrade prompt (cannot access the search form)
4. If you bypass the UI and call the API directly via browser console:
   ```
   fetch("/api/flights", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({from:"JFK",to:"BER",departDate:"2026-04-15"})}).then(r=>r.json()).then(console.log)
   ```
5. **Expected:** HTTP 403 response with `{"error":"Flight search requires Pro or Pro+ plan"}`

### Test 5.3 — Unauthenticated Cost-of-Living API Access

1. In the private/incognito window (not logged in), navigate to:
   `https://<your-deployment>/api/cost-of-living?country=Germany`
2. **Expected:** HTTP 401 response with `{"error":"Unauthorized"}`

### Test 5.4 — Invalid Airport Code

1. On the booking page, manually try to search with an invalid airport code
2. Type `XYZ` in the airport search field
3. **Expected:** No airport match is found (autocomplete shows no results or shows popular airports)

---

## 6. Time-to-Reproduce Rule

Every test above is reproducible in under 5 minutes. Tests 5.1 and 5.3 take under 1 minute each (open incognito, paste URL).

---

## 7. Pass/Fail Criteria

| Test | Pass Condition |
|---|---|
| 4.1 | Flight search works for authenticated pro_single+ user, returns 200 |
| 4.2 | MAN, IST, BKK all resolve correctly in autocomplete |
| 4.3 | Cost-of-living card loads on dashboard for authenticated user |
| 4.4 | No implausible durations (<5h for JFK→BER) in live results |
| 5.1 | Unauthenticated GET and POST to /api/flights both return 401 |
| 5.2 | Free tier POST to /api/flights returns 403 |
| 5.3 | Unauthenticated GET to /api/cost-of-living returns 401 |
| 5.4 | Invalid airport code `XYZ` produces no match |

**Phase 5 passes if:** All tests 4.1–4.3 and 5.1–5.4 pass. Test 4.4 is conditional on live Firecrawl data availability.

---

## 8. Bug Reporting Template

```
### Bug: [short description]

**Test:** [test number, e.g., 5.1]
**Steps to reproduce:**
1. ...
2. ...

**Expected result:** ...
**Actual result:** ...
**Severity:** Critical / High / Medium / Low
**Evidence:** [screenshot, HTTP response, or error message]
```
