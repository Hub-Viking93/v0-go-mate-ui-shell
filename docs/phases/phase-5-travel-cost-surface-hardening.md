# Phase 5 — Travel And Cost Surface Hardening

**Master gaps:** `B5-004`, `B5-005`, `B5-006`
**Classification mix:** `phase_candidate`
**Depends on:** `Phase 0 — Core State Authority`

---

## Purpose

This phase hardens the travel and cost-of-living surfaces that currently exist in a half-commercial, half-helper state.

The master audit showed three remaining issues:

- the flight API surface is still public while the booking UI is gated
- flight result quality is too weak for canonical treatment
- cost-of-living still is split across helper/API paths without one coherent authority model

This phase fixes the current integrity problems without trying to build the full booking/housing platform.

---

## Scope

This phase covers:

- flight API access policy
- flight result quality/sanity hardening
- cost-of-living authority unification for current v1 surfaces

This phase does not cover:

- booking registry
- housing system
- full persistent cost artifact platform

Those remain out of scope for this pack.

---

## Target Outcome

After this phase:

1. The flight backend surface has an explicit and intentional access policy aligned with the UI.
2. Flight search results are no longer obviously too weak to trust operationally.
3. Cost-of-living has one coherent v1 authority model across API/helper usage instead of split behavior.

---

## Primary Files / Areas

- `app/api/flights/route.ts`
- `lib/gomate/flight-search.ts`
- `app/(app)/booking/page.tsx`
- `app/api/cost-of-living/route.ts`
- `lib/gomate/web-research.ts`
- related cost/booking UI components

---

## Required Work

### 1. Commercial Surface Policy

- decide and implement whether the flight API is public or authenticated
- align route behavior with the product/UI contract

### 2. Flight Search Quality Hardening

- reduce obviously untrustworthy result behavior
- improve resolution/sanity checks enough for current use

### 3. Cost Authority Unification

- reduce the split between helper-path cost logic and API-path cost logic
- define one authoritative v1 model for current cost surfaces

---

## Acceptance Criteria

1. Flight API access policy is explicit and aligned with the product surface.
2. Live flight search no longer returns obviously implausible canonical-looking output without safeguards.
3. Cost-of-living behavior is materially more coherent across API and helper usage.
4. The master-audit gaps `B5-004`, `B5-005`, and `B5-006` are resolved or materially narrowed.

---

## Notes

- This phase is about hardening the current surfaces, not implementing bookings or housing.
