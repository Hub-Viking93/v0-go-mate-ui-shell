# Backend Acceptance — Phase 5 (Travel And Cost Surface Hardening)

**Date:** 2026-03-15
**Phase:** Master-Audit Phase 5
**Gaps addressed:** B5-004, B5-005, B5-006

---

## Contract Verification — PASSED

### B5-004: Flight API Commercial Surface Is Public
- **Before:** `GET /api/flights` and `POST /api/flights` returned 200 for unauthenticated requests
- **After:** Both endpoints now require authentication (`supabase.auth.getUser()`) and return 401 for unauthenticated requests
- **Tier gating:** `POST /api/flights` additionally requires `pro_single` or `pro_plus` tier (matching the `FullPageGate` on the booking page), returns 403 otherwise
- **Verified:** curl to both endpoints without auth token returns `{"error":"Unauthorized"}` with HTTP 401

### B5-005: Flight Search Quality Hardening
- **Hardcoded Google Flights URL fixed:** Replaced static base64-encoded URL string with dynamically built query URL using from/to airport codes and dates
- **Airport resolution expanded:** Added 20 additional airports to `POPULAR_AIRPORTS` including MAN (Manchester), LGW, STN, EDI, DUB, BRU, DUS, HAM, PRG, BUD, WAW, ICN, BKK, KUL, MEL, AKL, DOH, IST, YVR, YUL — total now 50 airports
- **Duration sanity check added:** New `haversineDistance()` + `minimumPlausibleDuration()` functions compute minimum plausible flight time based on great-circle distance between airports. `isPlausibleFlight()` rejects flights with duration < 60% of minimum or price outside $30-$25,000 range
- **Stop parsing improved:** Changed from modulo-based heuristic (`i % 2`) to explicit detection: `hasNonstop`/`hasOneStop` markers from content, with "unknown" (-1) defaulting to 1 stop instead of random assignment

### B5-006: Cost-of-Living Authority Unification
- **GET /api/cost-of-living now requires auth:** Returns 401 for unauthenticated requests (POST already required auth)
- **Single authority model:** Removed `COST_OF_LIVING_ESTIMATES` (130-line hardcoded map) from `web-research.ts`. The `getCostOfLivingData()` function now delegates to `getGenericFallbackData()` from `numbeo-scraper.ts` via a thin adapter (`numbeoToCostOfLiving()`)
- **Result:** Both the API route (`/api/cost-of-living` → `numbeo-scraper.ts`) and the chat/guide helper path (`web-research.ts` → `numbeo-scraper.ts`) now use the same underlying data source

---

## Functional Verification — PASSED

- Unauthenticated `GET /api/flights` → 401
- Unauthenticated `POST /api/flights` → 401
- Unauthenticated `GET /api/cost-of-living?country=Germany` → 401
- Unauthenticated `POST /api/cost-of-living` → 401
- Invalid JSON to `POST /api/flights` → 401 (auth gate catches before parsing)
- `GET /api/cost-of-living` with no params → 401 (auth gate catches before validation)
- TypeScript compilation: no new errors introduced (pre-existing errors unchanged)
- `getAirportByCode("MAN")` now resolves to Manchester Airport

---

## Failure Verification — PASSED

- Auth rejection is the first check on all modified routes — no business logic executes without valid session
- Invalid inputs cannot reach flight search or cost-of-living logic without authentication
- The sanity check functions (`isPlausibleFlight`, `minimumPlausibleDuration`) handle edge cases:
  - Zero-duration flights are rejected
  - Extremely cheap/expensive flights are filtered
  - Unknown durations ("Unknown") parse to 0 minutes and trigger sanity rejection for long routes

---

## Bugs Discovered and Resolved

Three bugs were discovered during User Acceptance testing and fixed immediately:

1. **Unparseable durations bypassed sanity filter** (High) — Flights with "Unknown" duration parsed to 0 minutes and skipped the `durationMinutes > 0` guard. Fixed by rejecting flights where `durationMinutes === 0`.
2. **Scrape artifact durations >36h passed through** (Medium) — 47h/58h durations from garbled scrape data. Fixed by adding upper bound of 36 hours.
3. **Newlines in scraped duration strings** (Low) — Firecrawl captured `\n` from HTML. Fixed by trimming whitespace/newlines in `parseFlightData()`.

All bugs documented in `bug-phase-5.md`. All resolved.

---

## Declaration

**Backend Accepted** — All three verification stages passed. Three bugs found during acceptance testing, all resolved and re-verified.
