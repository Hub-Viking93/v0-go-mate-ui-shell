# Bug Report — Phase 5

## Bug 1: Flights with unparseable durations pass through sanity filter

**Discovered during:** User Acceptance Gate (Test 4.1)
**Severity:** High
**Root cause:** `isPlausibleFlight()` had `durationMinutes > 0` guard that let flights with "Unknown" duration (parsing to 0 minutes) bypass the sanity check. These included $97 and $124 flights for JFK→BER that were clearly implausible.
**Fix:** Changed guard to reject flights where `durationMinutes === 0` (unparseable duration). These are untrustworthy results.
**Status:** RESOLVED

## Bug 2: Scrape artifact durations >36h pass through sanity filter

**Discovered during:** User Acceptance Gate (Test 4.1)
**Severity:** Medium
**Root cause:** Initial upper bound was 48h. A "47h 10m" scrape artifact ($443 for JFK→BER) and "58h 20m" passed through. No real connection takes 47+ hours.
**Fix:** Lowered upper bound to 36 hours. This filters out obvious scrape artifacts while still allowing realistic long-haul connections with layovers (~24-30h max).
**Status:** RESOLVED

## Bug 3: Newlines in scraped duration strings

**Discovered during:** User Acceptance Gate (Test 4.1)
**Severity:** Low
**Root cause:** Firecrawl scraping captures newlines from HTML. Duration string "15h\n" had a trailing newline.
**Fix:** Added `.replace(/[\n\r]/g, "").trim()` to duration extraction in `parseFlightData()`.
**Status:** RESOLVED
