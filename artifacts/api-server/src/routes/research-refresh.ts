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
  type ResearchedOutput,
  type ResearchedSpecialistFn,
  type ResearchedSteps,
  type SpecialistDomain,
} from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

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

  // ---- Persist --------------------------------------------------
  const newMeta = {
    ...(plan.research_meta ?? {}),
    researchedSpecialists: newCache,
  };
  const persistedAt = new Date().toISOString();
  const { error: upErr } = await ctx.supabase
    .from("relocation_plans")
    .update({
      research_meta: newMeta,
      updated_at: persistedAt,
    })
    .eq("id", plan.id);
  if (upErr) {
    logger.error({ err: upErr, planId: plan.id }, "research-refresh: persist failed");
    res.status(500).json({
      error: "Failed to persist refreshed cache",
      detail: upErr.message,
    });
    return;
  }

  res.json({ refreshed, skipped, persistedAt });
});

export default router;
