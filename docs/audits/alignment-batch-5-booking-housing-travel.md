# Batch 5 Alignment Audit — Travel, Booking, Housing, and Cost-of-Living

> Batch: 5
> Scope: Flights / Booking / Housing / Cost-of-Living Commercial Surfaces
> Authority: `docs/audits/document-authority.md`
> Method: definitions -> code/database/runtime/frontend, with system docs used as supporting evidence
> Closure Rule: audit -> patch stale docs/code -> re-audit -> PASS
> Final Result: PASS

---

## 1. Systems Audited

This batch audited the commercial/planning surfaces across:

- flight system
- booking system
- housing system
- cost-of-living as a planning artifact rather than only a raw data fetch

Primary inputs used:

- `docs/definitions/flight-system.md`
- `docs/definitions/booking-system.md`
- `docs/definitions/housing-system.md`
- `docs/definitions/cost-of-living.md`
- `docs/systems/flight-search.md`
- `docs/systems/cost-of-living.md`
- `docs/systems/frontend-ui-layer.md`
- `docs/systems/master-index.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `app/api/flights/route.ts`
- `lib/gomate/flight-search.ts`
- `lib/gomate/airports.ts`
- `app/api/cost-of-living/route.ts`
- `app/(app)/booking/page.tsx`
- `components/booking/*`
- `components/cost-of-living-card.tsx`

Housing code scan result:

- no housing routes, UI pages, components, or persistence layer were found outside guide prose references

---

## 2. Audit Loop Performed

### Pass 1

Mapped canonical travel/booking/cost expectations against actual runtime behavior.

Main result:

- the flight system is more implemented than the old definitions claimed
- the booking system is still mostly absent as a registry, despite a real booking/search UI
- housing remains genuinely unimplemented
- cost-of-living is a mixed model: partially structured API output plus separate helper calculations, but no canonical cost artifact

### Patch Pass

Corrected stale Batch 5 docs that were still describing pre-search behavior.

Patched docs:

- `docs/definitions/flight-system.md`
- `docs/definitions/booking-system.md`
- `docs/definitions/cost-of-living.md`
- `docs/systems/flight-search.md`
- `docs/systems/frontend-ui-layer.md`
- `docs/systems/master-index.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`

Patch themes:

- corrected stale claims that flight functionality is only a Google Flights redirect
- corrected stale claims that the booking page always forces mock mode
- corrected stale claims that cost-of-living has no comparison surface or structured range data at all
- corrected stale `Math.random()` references that no longer matched `flight-search.ts`
- corrected stale fallback-city wording in the audit layer

### Runtime Verification Pass

Authenticated and unauthenticated localhost runtime verification was executed against `http://localhost:3000` on 2026-03-14 using the configured test account from `.env.local`.

Verified cases:

1. Public flight discovery surface
- unauthenticated `GET /api/flights` returned `200`
- unauthenticated `POST /api/flights` with `useMock: true` returned `200` with deterministic mock results
- unauthenticated `POST /api/flights` with `from=MAN` returned `400 "Invalid airport codes"`

2. Booking page gating
- unauthenticated `GET /booking` returned `307` redirect to `/auth/login`
- this means the page is protected by middleware/UI gating, but the flight APIs remain public

3. Real flight search path
- `POST /api/flights` without `useMock` returned `200` with `isMock=false`
- live multi-source results came back from Skyscanner, Google, Momondo, Kayak, and Kiwi
- the result quality is weak:
  - Google results still use a hardcoded URL
  - “fastest” selected a `0h 45m` result for JFK -> BER, which is obviously not trustworthy
  - airport resolution is still limited to the preloaded airport list

4. Cost-of-living read surface
- unauthenticated `GET /api/cost-of-living?country=Germany&city=Berlin` returned `200`
- returned structured city-level data including `estimatedMonthlyBudget`
- unauthenticated comparison mode also returned `200` with `{ from, to, comparison }`

5. Cost preferences write surface
- unauthenticated `POST /api/cost-of-living` returned `401`
- authenticated `POST /api/cost-of-living` returned `200 { success: true }`
- follow-up authenticated `GET /api/profile` confirmed `profile_data.cost_preferences` persisted on the current plan

### Re-Audit Pass

Re-scanned the Batch 5 docs after patching and compared them against code and live runtime behavior.

No remaining unclassified in-scope Batch 5 mismatch remained after the second pass.

The remaining travel/booking/cost gaps are now explicitly classified below rather than left as doc drift or vague “future work”.

That satisfies the Batch 5 closure rule.

---

## 3. Canonical Target Summary

Canonical Batch 5 target, condensed:

- flights are plan-scoped, persistent artifacts with booking materialization
- booking is the unified registry for relocation bookings across domains
- housing is an independent recommendation/planning/tracking system
- cost-of-living is a personalized, immutable planning artifact tied to profile state
- commercial surfaces should distinguish clearly between discovery, tracking, and canonical persisted artifacts

---

## 4. Current Reality Summary

Actual Batch 5 runtime, condensed:

- flight search is a real multi-source discovery surface, but not a persistent flight system
- booking page is a protected flight-search UI, not a booking registry
- housing does not exist as a system
- cost-of-living has:
  - a public city-level API with comparison mode
  - separate helper calculations for chat/guide usage
  - authenticated preference writes into `profile_data.cost_preferences`
- no flight, booking, housing, or cost artifacts are persisted as canonical versioned domain records

---

## 5. Audit Questions Answered

### Which travel/booking systems are truly implemented versus only represented by search output?

Implemented:

- flight discovery/search UI
- `/api/flights` search API
- airport autocomplete against the local airport dataset
- external provider redirects from booking results

Not implemented as canonical systems:

- persistent flight artifacts
- booking registry
- housing system
- booking-linked timeline/reminders/status mirroring

### Which definition requirements are essential for v1 versus clearly v2?

Essential for v1:

- honest distinction between discovery-only flight search and real booking tracking
- accurate docs for public/private surface boundaries
- accurate classification of cost-of-living as mixed/transient rather than canonical

Clearly v2:

- bookings table and booking lifecycle
- flight persistence and booking materialization
- housing recommendation/tracking/search system
- canonical personalized cost snapshots with versioning

### Is cost-of-living a canonical artifact, transient helper, or mixed model?

Mixed model.

It is not a canonical persisted artifact, but it is more than a pure helper:

- API output is structured and directly consumable
- comparison exists
- preferences are stored on the current plan
- guide/chat still use separate helper logic instead of one shared canonical artifact

### Which persistence expectations are missing but non-blocking?

Missing but non-blocking for current v1:

- `flights` table
- `bookings` table
- housing persistence
- `cost_of_living` artifact table

These are important target-state systems, but the current discovery-first surfaces can still function without them as long as the docs do not overstate what exists.

---

## 6. Gap Table

| ID | Gap | Classification | Status |
|---|---|---|---|
| B5-001 | Flight system is discovery/search only, not a persistent plan-scoped flight artifact system | `intentional_v1_minimal` | accepted |
| B5-002 | Booking registry does not exist; booking page is not a booking system in canonical terms | `defer_v2` | classified |
| B5-003 | Housing system does not exist beyond guide prose | `defer_v2` | classified |
| B5-004 | Flight API remains public while booking page is gated, leaving the commercial backend surface unprotected | `phase_candidate` | classified |
| B5-005 | Flight result quality is weak: hardcoded Google URL, heuristic stop parsing, implausible durations, 30-airport scope | `phase_candidate` | classified |
| B5-006 | Cost-of-living is split across API and helper layers with no canonical persisted artifact | `phase_candidate` | classified |
| B5-007 | Cost preferences persist only as unvalidated JSON inside `profile_data` | `intentional_v1_minimal` | accepted |

---

## 7. Classified Batch 5 Gaps

### B5-001 Flight Discovery Exists, But Canonical Flight Artifacts Do Not

- Classification: `intentional_v1_minimal`
- Evidence: live `POST /api/flights` returns search/discovery results, but no DB table or saved/booked lifecycle exists
- Meaning: current v1 flight support is real, but it is discovery-only

### B5-002 Booking Registry Is Still Missing

- Classification: `defer_v2`
- Evidence: no `bookings` table, no booking timeline events, no booking status tracking
- Meaning: booking remains a future registry system, not current functionality

### B5-003 Housing System Is Fully Absent

- Classification: `defer_v2`
- Evidence: no housing routes/UI/components/persistence found; only guide prose mentions housing
- Meaning: housing is correctly treated as missing rather than partially implemented

### B5-004 Flight API Commercial Surface Is Public

- Classification: `phase_candidate`
- Evidence: unauthenticated `GET /api/flights` returned `200`; unauthenticated `POST /api/flights` also returned `200`
- Meaning: the protected booking page does not protect the underlying Firecrawl-consuming API surface

### B5-005 Flight Search Quality Is Not Trustworthy Enough To Be Canonical

- Classification: `phase_candidate`
- Evidence:
  - Google result URLs are still hardcoded
  - airport code resolution rejects valid non-preloaded airports like `MAN`
  - live search returned impossible-looking durations such as `0h 45m` for JFK -> BER
  - stop parsing remains heuristic
- Meaning: search works, but the output quality is too weak for canonical artifact treatment

### B5-006 Cost-of-Living Is A Mixed Surface, Not A Canonical Artifact

- Classification: `phase_candidate`
- Evidence:
  - public API returns structured city-level cost data and comparison results
  - guide/chat use separate helper calculations
  - no immutable cost snapshot is stored
- Meaning: cost-of-living should be documented and planned as a mixed/transient layer until unified

### B5-007 Cost Preferences Are Stored, But Only As A Blob

- Classification: `intentional_v1_minimal`
- Evidence: authenticated `POST /api/cost-of-living` persisted `profile_data.cost_preferences`, confirmed via `GET /api/profile`
- Meaning: preference storage exists, but it is not yet a validated or canonical cost-configuration model

---

## 8. V1-Minimal Versus V2 Boundary

Acceptable v1-minimal behavior:

- flight discovery/search without persistence
- external redirect-only booking model
- no housing system
- cost comparison as transient API output
- cost preferences stored in `profile_data`

Still needed for strong v1 alignment:

- no stale doc claims about “redirect only” when real search exists
- explicit classification that search results are not canonical flight artifacts
- explicit classification that public flight APIs are a deliberate/open gap, not an invisible one

Reasonable v2 work:

- persistent flight/booked states
- unified booking registry
- housing system
- canonical cost artifact with personalization and versioning

---

## 9. Patch Outcome

What changed in docs/governance accuracy:

- Batch 5 definitions now describe the actual flight search and booking UI correctly
- cost-of-living definitions now reflect the real API/comparison/helper split
- stale `Math.random()` and forced-mock claims were removed from the Batch 5 doc layer

What changed in code:

- no code changes were required for Batch 5 closure

Why no code patch was required:

- the in-scope runtime issues are real, but they are target-state/policy gaps rather than hidden contradictions that prevented the batch from being audited honestly

---

## 10. Batch 5 PASS Rationale

Batch 5 can honestly be marked `PASS` because:

- the scoped audit was completed against definitions, code, frontend, and live runtime
- stale Batch 5 docs were patched until they matched current behavior
- every major persistence/lifecycle gap was classified into an allowed outcome
- housing is no longer left in a vague “future maybe” state; it is explicitly marked absent/deferred
- the re-audit did not find additional unclassified in-scope contradictions

Final Result: PASS
