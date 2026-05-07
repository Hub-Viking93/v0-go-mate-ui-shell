// =============================================================
// @workspace/agents — research triggers (Phase E1a)
// =============================================================
// Pure data + helpers for selective re-research orchestration. Maps
// profile fields to the SpecialistDomain[] that depends on them, plus
// a diff helper that takes (before, after) profile snapshots and
// returns the set of domains whose research should be considered
// stale.
//
// What this module is NOT:
//   - Not an LLM-driven analyser. The mapping is hand-curated; the
//     diff is a pure key-by-key comparison.
//   - Not opinionated about WHEN to refresh. Callers (UI, future
//     automation, rule-change handlers) decide when to call
//     diffProfileForDomains(); this module just answers "which
//     domains are affected by these field changes?".
//   - Not an exhaustive ontology. Fields not in the table are
//     treated as "no effect" (returns []). When the product adds
//     a profile field that should affect a specialist's research,
//     extend PROFILE_FIELD_TO_DOMAINS here.
//
// Why hand-curated and not LLM-derived:
//   The mapping is small (≈ 30 fields × 5-7 domains) and stable.
//   An LLM-derived map would drift, fabricate, and require
//   validation infrastructure that defeats the point. The cost of
//   a missed mapping here is "user has to manually refresh" — not
//   catastrophic.
// =============================================================

import type { SpecialistDomain } from "./specialists/_contracts.js";

// ---- The mapping ---------------------------------------------------
//
// Each profile-field key → array of SpecialistDomain values whose
// research should be considered invalidated when that field changes.
//
// Conventions:
//   - "destination" is the universal blast radius (every domain re-
//     researches).
//   - "target_city" is narrower — only city-sensitive domains
//     (housing markets, sometimes registration office choice).
//   - History fields (prior_visa, visa_rejections, criminal_record)
//     affect visa eligibility analysis primarily.
//   - Money fields affect banking + sometimes visa (sufficient-funds
//     gates) and housing (deposit affordability).
//
// Includes domains for specialists that don't exist yet (visa, tax,
// pet, transport_id, family). The runner filters to actually-
// implemented v2 specialists; this table is forward-looking so we
// don't have to revisit it as more migrations land.

export const PROFILE_FIELD_TO_DOMAINS: Record<string, ReadonlyArray<SpecialistDomain>> = {
  // ---- Universal ----------------------------------------------------
  destination: [
    "visa",
    "documents",
    "registration",
    "banking",
    "housing",
    "healthcare",
    "tax",
    "departure_tax",
    "transport_id",
    "cultural",
    "cost",
    "pet",
  ],
  target_city: ["housing", "registration"],

  // ---- Identity / origin -------------------------------------------
  citizenship: ["visa", "documents", "registration", "banking"],
  current_location: ["documents", "departure_tax"],

  // ---- Purpose / structure -----------------------------------------
  purpose: ["visa", "banking", "tax"],
  visa_role: ["visa", "documents"],
  duration: ["visa", "tax", "departure_tax"],
  // Move-date / arrival-date: every timeline-anchored domain's
  // deadlines need re-anchoring; researched specialists themselves
  // also vary recommendations slightly (e.g. "apply at least 12
  // weeks before move").
  timeline: ["visa", "documents", "housing", "banking"],

  // ---- Family ------------------------------------------------------
  moving_alone: ["visa", "housing"],
  partner_citizenship: ["visa"],
  partner_visa_status: ["visa"],
  relationship_type: ["visa"],
  relationship_duration: ["visa"],
  settlement_reason: ["visa"],
  children_count: ["visa", "documents"],
  spouse_joining: ["visa", "documents"],

  // ---- Visa history ------------------------------------------------
  prior_visa: ["visa"],
  prior_visa_type: ["visa"],
  visa_rejections: ["visa"],
  criminal_record: ["visa", "documents"],

  // ---- Money -------------------------------------------------------
  monthly_budget: ["banking", "housing", "cost"],
  savings_available: ["banking", "visa"],
  preferred_currency: ["banking"],
  settlement_support_source: ["banking", "visa"],
  remote_income: ["banking", "tax"],
  income_consistency: ["banking"],

  // ---- Health ------------------------------------------------------
  healthcare_needs: ["healthcare"],
  prescription_medications: ["healthcare"],
  chronic_condition_description: ["healthcare"],

  // ---- Pets, vehicles, posting -------------------------------------
  pets: ["pet"],
  bringing_vehicle: ["transport_id"],
  driver_license_origin: ["transport_id"],
  posting_or_secondment: ["visa", "tax"],
  highly_skilled: ["visa"],
};

// ---- Diff helper ---------------------------------------------------

/**
 * Compare two profile snapshots and return the union of
 * SpecialistDomain values whose research should be invalidated.
 *
 * Semantics:
 *   - A field counts as "changed" when its before/after values
 *     differ by strict inequality (with `null` and `undefined`
 *     treated as equivalent — both meaning "absent").
 *   - Fields not in PROFILE_FIELD_TO_DOMAINS contribute nothing.
 *   - Adding a field counts (was undefined → now "Sweden" should
 *     trigger destination's full blast radius).
 *   - Removing a field counts (was set, now cleared — likely a
 *     user mistake, but research should re-run with the new state).
 *
 * The result is deduplicated and stable-ordered (alphabetical) so
 * callers get a deterministic list.
 */
export function diffProfileForDomains(
  before: Readonly<Record<string, unknown>> | null | undefined,
  after: Readonly<Record<string, unknown>> | null | undefined,
): SpecialistDomain[] {
  const b = before ?? {};
  const a = after ?? {};
  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const affected = new Set<SpecialistDomain>();
  for (const key of allKeys) {
    const bv = b[key];
    const av = a[key];
    if (isEquivalent(bv, av)) continue;
    const domains = PROFILE_FIELD_TO_DOMAINS[key];
    if (!domains) continue;
    for (const d of domains) affected.add(d);
  }
  return Array.from(affected).sort();
}

function isEquivalent(x: unknown, y: unknown): boolean {
  // null / undefined treated as the same (both = "absent").
  if (x == null && y == null) return true;
  if (x == null || y == null) return false;
  if (typeof x !== typeof y) return false;
  if (typeof x === "object") {
    // Conservative: treat objects as never-equal so nested changes
    // (e.g. partner_address fields) trigger a refresh. Profile
    // values are usually scalars; this branch is only hit for the
    // rare structured field.
    return false;
  }
  return x === y;
}

// ---- Domain-set helpers --------------------------------------------

/**
 * Filter a candidate domain list to those that actually have a v2
 * specialist implemented. Used by the refresh endpoint to skip
 * unsupported domains gracefully — the diff might say "visa is
 * affected" but we can't refresh visa via the new pipe yet.
 */
export function filterToImplementedDomains(
  domains: ReadonlyArray<SpecialistDomain>,
  implemented: ReadonlySet<SpecialistDomain>,
): { runnable: SpecialistDomain[]; skipped: SpecialistDomain[] } {
  const runnable: SpecialistDomain[] = [];
  const skipped: SpecialistDomain[] = [];
  for (const d of domains) {
    if (implemented.has(d)) runnable.push(d);
    else skipped.push(d);
  }
  return { runnable, skipped };
}

/**
 * The set of domains the refresh endpoint can actually re-run
 * today. Update this whenever a new researched specialist lands.
 */
export const IMPLEMENTED_RESEARCHED_DOMAINS: ReadonlySet<SpecialistDomain> =
  new Set<SpecialistDomain>([
    "registration",
    "banking",
    "documents",
    "housing",
    "healthcare",
  ]);

// ---- Staleness — Phase E1b -----------------------------------------
//
// First heuristic: a researched bundle is considered stale when its
// retrievedAt is older than 14 days. The threshold is a single
// constant; raising it is safe (older data flagged less often), and
// the value will be revisited once we have real refresh-pattern data.
// E1 explicitly does NOT include profile-change-driven invalidation
// here — that's separately resolved via diffProfileForDomains() at
// the caller level.

export const RESEARCH_STALE_AFTER_DAYS = 14;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const RESEARCH_STALE_AFTER_MS = RESEARCH_STALE_AFTER_DAYS * ONE_DAY_MS;

/**
 * True when a bundle's retrievedAt is older than the staleness
 * threshold relative to `now`. Bad / unparseable timestamps return
 * `false` (conservative — we don't want to drown the UI in
 * staleness alerts because a malformed ISO slipped in).
 *
 * `now` is injectable so tests can pin time; callers normally
 * omit it and pick up the wall clock.
 */
export function isResearchStale(
  retrievedAtIso: string,
  now: Date = new Date(),
): boolean {
  const retrievedMs = new Date(retrievedAtIso).getTime();
  if (!Number.isFinite(retrievedMs)) return false;
  return now.getTime() - retrievedMs > RESEARCH_STALE_AFTER_MS;
}

/**
 * Whole-days delta between retrievedAt and `now`, floored. Returns
 * null for unparseable timestamps. Used by the UI to render
 * "Last refreshed N days ago" copy without re-implementing the
 * arithmetic per surface.
 */
export function daysSinceRetrieved(
  retrievedAtIso: string,
  now: Date = new Date(),
): number | null {
  const retrievedMs = new Date(retrievedAtIso).getTime();
  if (!Number.isFinite(retrievedMs)) return null;
  const diff = now.getTime() - retrievedMs;
  if (diff < 0) return 0;
  return Math.floor(diff / ONE_DAY_MS);
}
