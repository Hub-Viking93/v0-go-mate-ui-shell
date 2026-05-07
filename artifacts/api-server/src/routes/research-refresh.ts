// =============================================================
// POST /api/research/refresh — Phase E1a
// =============================================================
// Selective re-research orchestration.
//
// Contract:
//   Request body:  { domains: SpecialistDomain[] }
//   Response:      {
//     refreshed: Array<{ domain, quality, retrievedAt, sourcesCount }>,
//     skipped:   Array<{ domain, reason }>,
//     persistedAt: ISO,
//   }
//
// What it does:
//   1. Auth + load current plan + research_meta cache.
//   2. Filter requested domains against IMPLEMENTED_RESEARCHED_DOMAINS;
//      domains we don't have a v2 specialist for go in `skipped` with
//      reason "no_v2_specialist".
//   3. Run the runnable specialists in parallel (Promise.all + each
//      enforces its own withBudget). Specialist throws → that
//      domain joins `skipped` with reason "threw".
//   4. Merge fresh bundles into research_meta.researchedSpecialists
//      KEY-BY-KEY — other domains' cache entries are NOT touched.
//      This is the "partial refresh" semantic the user asked for.
//   5. Persist back to relocation_plans.research_meta.
//   6. Return summary; do NOT recompose pre-move/post-move surfaces.
//      That stays explicit and user-triggered (avoids the C1.1
//      task-progress wipe regression in a new form).
//
// What it does NOT do:
//   - No surface recomposition (pre-move timeline, settling_in_tasks).
//     Caller / UI runs /pre-departure/generate or /settling-in/generate
//     to re-apply the cache to the visible timeline.
//   - No staleness check. E1b adds a ">14 days" stale flag to the
//     GET routes; refresh itself is unconditional — manual trigger
//     wins.
//   - No automatic profile-diff. Callers (UI button "Refresh banking",
//     future automation) decide which domains to refresh and pass
//     them in. The diff helper lives in lib/agents/research-triggers
//     for callers that need it.
// =============================================================

import { Router, type IRouter } from "express";
import {
  registrationSpecialist,
  bankingSpecialistV2,
  documentsSpecialistV2,
  housingSpecialistV2,
  healthcareSpecialistV2,
  createSupabaseLogWriter,
  IMPLEMENTED_RESEARCHED_DOMAINS,
  PROFILE_FIELD_TO_DOMAINS,
  diffProfileForDomains,
  type ResearchedOutput,
  type ResearchedSpecialistFn,
  type ResearchedSteps,
  type SpecialistDomain,
} from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";
import { applyResearchMetaPatchAt, captureProfileSnapshot } from "../lib/research-meta-patch";

const router: IRouter = Router();

const REFRESH_BUDGET_MS = 90_000;

// Map SpecialistDomain → the specific v2 fn. Centralised so adding a
// new researched specialist is a 2-line edit (here + its export).
const SPECIALIST_BY_DOMAIN: Partial<Record<SpecialistDomain, ResearchedSpecialistFn>> = {
  registration: registrationSpecialist,
  banking: bankingSpecialistV2,
  documents: documentsSpecialistV2,
  housing: housingSpecialistV2,
  healthcare: healthcareSpecialistV2,
};

type ResearchedSpecialistsCache = Partial<Record<string, ResearchedSteps>>;

interface PlanRow {
  id: string;
  profile_data: Record<string, unknown> | null;
  research_meta: { researchedSpecialists?: ResearchedSpecialistsCache } | null;
}

router.post("/research/refresh", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;

  // ---- Validate body --------------------------------------------
  const body = (req.body ?? {}) as { domains?: unknown };
  if (!Array.isArray(body.domains)) {
    res.status(400).json({
      error: "Body must include `domains: SpecialistDomain[]`.",
    });
    return;
  }
  const requested = body.domains
    .filter((d): d is string => typeof d === "string")
    .map((d) => d as SpecialistDomain);
  if (requested.length === 0) {
    res.status(400).json({
      error: "`domains` must be a non-empty array of SpecialistDomain values.",
    });
    return;
  }

  // ---- Partition into runnable + skipped ------------------------
  // Use the canonical IMPLEMENTED_RESEARCHED_DOMAINS set as the
  // source of truth; SPECIALIST_BY_DOMAIN should match it but we
  // double-check below in case of misconfiguration.
  const runnable: SpecialistDomain[] = [];
  const skipped: Array<{ domain: SpecialistDomain; reason: string }> = [];
  for (const d of requested) {
    if (!IMPLEMENTED_RESEARCHED_DOMAINS.has(d)) {
      skipped.push({ domain: d, reason: "no_v2_specialist" });
      continue;
    }
    const fn = SPECIALIST_BY_DOMAIN[d];
    if (!fn) {
      skipped.push({ domain: d, reason: "no_v2_specialist" });
      continue;
    }
    runnable.push(d);
  }

  if (runnable.length === 0) {
    res.json({
      refreshed: [],
      skipped,
      persistedAt: new Date().toISOString(),
    });
    return;
  }

  // ---- Load plan ------------------------------------------------
  const { data: plan, error: planErr } = await ctx.supabase
    .from("relocation_plans")
    .select("id, profile_data, research_meta")
    .eq("user_id", ctx.user.id)
    .eq("is_current", true)
    .maybeSingle<PlanRow>();
  if (planErr || !plan) {
    res.status(404).json({ error: "No active plan" });
    return;
  }

  // ---- Build SpecialistProfile ----------------------------------
  const profileRaw = (plan.profile_data ?? {}) as Record<string, unknown>;
  const specialistProfile: Record<string, string | number | null | undefined> = {};
  for (const [k, v] of Object.entries(profileRaw)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number") specialistProfile[k] = v;
    else if (typeof v === "boolean") specialistProfile[k] = v ? "yes" : "no";
  }
  const sharedInput = {
    profile: specialistProfile,
    profileId: plan.id,
    logWriter: createSupabaseLogWriter(ctx.supabase),
    budgetMs: REFRESH_BUDGET_MS,
  } as const;

  // ---- Run specialists in parallel ------------------------------
  // Each fn enforces its own budget via withBudget(). Errors get
  // caught and joined into `skipped`.
  logger.info(
    { planId: plan.id, domains: runnable },
    "research-refresh: running specialists",
  );
  const results = await Promise.all(
    runnable.map(async (domain) => {
      const fn = SPECIALIST_BY_DOMAIN[domain]!;
      try {
        const out = await fn(sharedInput);
        return { domain, out, err: null as null };
      } catch (err) {
        return {
          domain,
          out: null as ResearchedOutput | null,
          err: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  // ---- Merge into cache key-by-key -------------------------------
  // Other domains in the cache (from previous refreshes / pre-warms)
  // are kept untouched — that's the partial-refresh contract.
  const existingCache: ResearchedSpecialistsCache =
    plan.research_meta?.researchedSpecialists ?? {};
  const newCache: ResearchedSpecialistsCache = { ...existingCache };
  const refreshed: Array<{
    domain: SpecialistDomain;
    quality: string;
    retrievedAt: string;
    sourcesCount: number;
    stepsCount: number;
  }> = [];
  for (const r of results) {
    if (r.err) {
      skipped.push({ domain: r.domain, reason: `threw: ${r.err.slice(0, 120)}` });
      continue;
    }
    if (!r.out || r.out.kind !== "steps") {
      // Advisory shape isn't expected here — the implemented
      // specialists all emit "steps". Treat as skipped to keep
      // the cache shape consistent.
      skipped.push({ domain: r.domain, reason: "not_steps_kind" });
      continue;
    }
    newCache[r.domain] = r.out;
    refreshed.push({
      domain: r.domain,
      quality: r.out.quality,
      retrievedAt: r.out.retrievedAt,
      sourcesCount: r.out.sources.length,
      stepsCount: r.out.steps.length,
    });
  }

  // ---- Persist via path-aware atomic write (Phase F1 fix) -------
  // One jsonb_set call per refreshed domain so concurrent refreshes
  // of different domains don't race on the researchedSpecialists
  // parent object (which they would under top-level-merge semantics
  // — see dry-run-f1-nested-race for the demonstration).
  // Phase E3-A — alongside each bundle, persist a profileSnapshot
  // so /api/research/suggestions can later diff current profile vs
  // the state at research-time, per domain.
  const persistedAt = new Date().toISOString();
  const profileSnapshot = captureProfileSnapshot(plan.profile_data);
  try {
    for (const r of refreshed) {
      await applyResearchMetaPatchAt(
        ctx.supabase,
        plan.id,
        ["researchedSpecialists", r.domain],
        newCache[r.domain],
      );
      await applyResearchMetaPatchAt(
        ctx.supabase,
        plan.id,
        ["profileSnapshots", r.domain],
        profileSnapshot,
      );
    }
  } catch (err) {
    logger.error({ err, planId: plan.id }, "research-refresh: persist failed");
    res.status(500).json({
      error: "Failed to persist refreshed cache",
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  res.json({ refreshed, skipped, persistedAt });
});

// =============================================================
// GET /api/research/suggestions — Phase E3-A
// =============================================================
// Detect which domains' research is now stale relative to the
// user's CURRENT profile by diffing against the per-domain
// profileSnapshot captured at research-time.
//
// Response shape (UI-friendly):
//   {
//     suggestions: Array<{
//       domain: SpecialistDomain,
//       changedFields: string[],        // fields that affect THIS domain
//       reason: string,                 // human-readable summary
//       lastResearchedAt: string,       // bundle's retrievedAt
//     }>,
//     lastResearchedAt: string | null,  // most recent across cache
//   }
//
// Honesty rules:
//   - Domains without a profileSnapshot (never researched, or
//     researched before E3-A landed) are SKIPPED — we can't
//     compute a diff without a baseline, and inventing one would
//     either over-suggest ("everything changed!") or under-suggest.
//   - Snapshot.kind isn't checked; the bundle being researched
//     vs fallback is orthogonal — if user changed destination,
//     even a fallback bundle should be re-attempted.
// =============================================================

interface PlanSuggestionsRow {
  id: string;
  profile_data: Record<string, unknown> | null;
  research_meta: {
    researchedSpecialists?: Record<string, ResearchedSteps>;
    profileSnapshots?: Record<string, Record<string, unknown>>;
  } | null;
}

router.get("/research/suggestions", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;

  const { data: plan, error: planErr } = await ctx.supabase
    .from("relocation_plans")
    .select("id, profile_data, research_meta")
    .eq("user_id", ctx.user.id)
    .eq("is_current", true)
    .maybeSingle<PlanSuggestionsRow>();
  if (planErr || !plan) {
    res.status(404).json({ error: "No active plan" });
    return;
  }

  const currentProfile = (plan.profile_data ?? {}) as Record<string, unknown>;
  const cache = plan.research_meta?.researchedSpecialists ?? {};
  const snapshots = plan.research_meta?.profileSnapshots ?? {};

  type Suggestion = {
    domain: SpecialistDomain;
    changedFields: string[];
    reason: string;
    lastResearchedAt: string;
  };
  const suggestions: Suggestion[] = [];

  // Build the reverse-map field → SpecialistDomain[] for fast
  // lookup when we narrow changedFields per domain.
  const fieldToDomains: Record<string, ReadonlyArray<SpecialistDomain>> = PROFILE_FIELD_TO_DOMAINS;

  let mostRecentRetrievedAt: string | null = null;

  for (const [domain, bundle] of Object.entries(cache)) {
    if (!bundle || bundle.kind !== "steps") continue;
    if (typeof bundle.retrievedAt !== "string") continue;
    if (!mostRecentRetrievedAt || bundle.retrievedAt > mostRecentRetrievedAt) {
      mostRecentRetrievedAt = bundle.retrievedAt;
    }
    const snapshot = snapshots[domain];
    if (!snapshot) continue; // never captured — can't compute diff

    const affectedDomains = diffProfileForDomains(snapshot, currentProfile);
    if (!affectedDomains.includes(domain as SpecialistDomain)) continue;

    // Narrow the diff to fields that specifically affect THIS domain.
    // Loop over snapshot ∪ current keys, find the ones that (a) differ,
    // (b) appear in PROFILE_FIELD_TO_DOMAINS, and (c) the mapping
    // includes the current domain.
    const allKeys = new Set([
      ...Object.keys(snapshot),
      ...Object.keys(currentProfile),
    ]);
    const changedFields: string[] = [];
    for (const key of allKeys) {
      const before = snapshot[key];
      const after = currentProfile[key];
      const isEquivalent = isFieldEquivalent(before, after);
      if (isEquivalent) continue;
      const mapping = fieldToDomains[key];
      if (!mapping) continue;
      if (!mapping.includes(domain as SpecialistDomain)) continue;
      changedFields.push(key);
    }
    if (changedFields.length === 0) continue; // shouldn't happen given affectedDomains check, but defensive

    changedFields.sort();
    const reason = renderSuggestionReason(changedFields);
    suggestions.push({
      domain: domain as SpecialistDomain,
      changedFields,
      reason,
      lastResearchedAt: bundle.retrievedAt,
    });
  }

  // Stable order: by domain name.
  suggestions.sort((a, b) => a.domain.localeCompare(b.domain));

  res.json({ suggestions, lastResearchedAt: mostRecentRetrievedAt });
});

// Mirrors lib/agents/research-triggers.ts's isEquivalent — kept
// inline here so the route doesn't import a private module of the
// agents package. Both definitions agree on the null≡undefined rule
// and the conservative "objects are never equal" rule.
function isFieldEquivalent(x: unknown, y: unknown): boolean {
  if (x == null && y == null) return true;
  if (x == null || y == null) return false;
  if (typeof x !== typeof y) return false;
  if (typeof x === "object") return false;
  return x === y;
}

function renderSuggestionReason(changedFields: ReadonlyArray<string>): string {
  if (changedFields.length === 0) return "Profile changed since research";
  if (changedFields.length === 1) return `${changedFields[0]} changed since research`;
  if (changedFields.length === 2) return `${changedFields[0]} + ${changedFields[1]} changed since research`;
  return `${changedFields[0]}, ${changedFields[1]} +${changedFields.length - 2} more changed since research`;
}

export default router;
