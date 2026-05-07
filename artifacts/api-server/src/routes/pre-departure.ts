// =============================================================
// Phase 5.2 — pre-departure API + persistence
// =============================================================
//   GET    /api/pre-departure              → current timeline (404 when unset)
//   POST   /api/pre-departure/generate     → compute + persist (idempotent
//                                            via user_triggered_pre_departure_at)
//   PATCH  /api/pre-departure/:actionId    → update status (in_progress / done / skipped)
//
// PERSISTENCE NOTE — JSONB-on-plans, not pre_departure_actions:
//   The Wave 2 migration that adds the full pre_departure_actions schema
//   (plan_id, action_key, prefill, etc.) hasn't been applied in the live
//   Supabase project yet — the table exists but only carries id/title/
//   description/status/completed_at columns.
//
//   Until the migration is applied, we stash the whole timeline as a
//   JSONB blob inside `relocation_plans.research_meta.preDeparture`.
//   This keeps the API surface stable — the route's wire format matches
//   what the future SQL-backed implementation will return — while
//   sidestepping the missing columns. Migration to the proper table
//   happens in a follow-up wave by reading from research_meta and
//   inserting into pre_departure_actions.
// =============================================================

import { Router, type IRouter } from "express";
import {
  composePreDepartureTimeline,
  computeUrgency,
  daysUntil,
  compareByUrgency,
  adaptVisaResearchToSteps,
  adaptLocalRequirementsToSteps,
  documentsSpecialistV2,
  housingSpecialistV2,
  bankingSpecialistV2,
  createSupabaseLogWriter,
  isResearchStale,
  daysSinceRetrieved,
  type PreDepartureProfile,
  type VisaPathwayLite,
  type ActionStatus,
  type PreDepartureAction,
  type ResearchedStepsLite,
  type ResearchedSteps,
  type Urgency,
} from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";
import { applyResearchMetaPatch } from "../lib/research-meta-patch";

const router: IRouter = Router();

const VALID_STATUSES: ReadonlySet<ActionStatus> = new Set([
  "not_started",
  "in_progress",
  "complete",
  "blocked",
  "skipped",
]);

interface StoredAction extends PreDepartureAction {
  /** ISO timestamp; set when status moves to "complete". */
  completedAt?: string | null;
  /** Free-form user note attached to the action. */
  userNotes?: string | null;
  /** Whether the action sits on the critical path (mirrored from timeline). */
  onCriticalPath?: boolean;
  /** Absolute deadline date (computed from moveDate + weeksBeforeMoveDeadline). */
  deadlineIso?: string;
}

interface StoredPreDeparture {
  generatedAt: string;
  moveDateIso: string;
  longestLeadTimeWeeks: number;
  criticalPath: string[];
  actions: StoredAction[];
  /**
   * Phase D-B — per-domain provenance snapshot taken at generation
   * time. Persisted alongside the timeline so GET /api/pre-departure
   * doesn't have to re-scan visa_research / local_requirements_research
   * to answer "was this researched, legacy, or generic?". Older
   * persisted timelines (pre-D-B) won't have this field; the route
   * tolerates absence by treating it as "generic everywhere".
   */
  provenance?: Record<string, TimelineDomainProvenance>;
}

// =============================================================
// Phase D-B — pre-departure provenance map
// =============================================================
// Three honest kinds:
//   researched      — new ResearchedSpecialist contract (full
//                     enum/predicate/URL-ref validation). Surfaces
//                     quality + sources + retrievedAt.
//   legacy_research — older pipeline. Real research from a
//                     previous specialist persisted to the
//                     visa_research or local_requirements_research
//                     column; not run through the new validators.
//                     Visible on /pre-move's visa domain (and any
//                     domain that hasn't migrated yet) until the
//                     specialist is rewritten.
//   generic         — deterministic / template-based; no LLM
//                     research per destination.
//
// The label "Researched · legacy" is for honesty: hiding the
// architectural distinction would let users over-trust visa
// content that hasn't been through URL_GUARDRAIL et al.
type TimelineDomainProvenance =
  | {
      kind: "researched";
      quality: "full" | "partial" | "fallback";
      fallbackReason?: string;
      retrievedAt: string;
      // Phase E1b — stale flag + daysOld; same semantics as the
      // settling-in CategoryProvenance.
      stale: boolean;
      daysOld: number | null;
      sources: Array<{ url: string; domain: string; kind: "authority" | "institution" | "reference"; title?: string }>;
    }
  | {
      kind: "legacy_research";
      retrievedAt: string;
      stale: boolean;
      daysOld: number | null;
      sources: Array<{ url: string; domain: string; kind: "authority" | "institution" | "reference"; title?: string }>;
    }
  | { kind: "generic" };

interface PlanRowForRead {
  id: string;
  research_meta: { preDeparture?: StoredPreDeparture } | null;
}

interface PlanRowForGenerate extends PlanRowForRead {
  stage: string | null;
  locked: boolean | null;
  profile_data: Record<string, unknown> | null;
  visa_research: Record<string, unknown> | null;
  local_requirements_research: Record<string, unknown> | null;
  arrival_date: string | null;
  user_triggered_pre_departure_at: string | null;
}

// ResearchedSpecialists cache shape — Phase A2.
//
// Each entry is the full ResearchedSteps payload for a domain we run
// through one of the new researched-contract specialists (B1/B2).
// Cached under research_meta.researchedSpecialists so re-running
// /generate doesn't re-pay the LLM + Firecrawl bill on every click;
// the cache is re-populated when stale-marked (TODO: A3 will set the
// staleness rule explicitly — today the only invalidation hook is the
// research-orchestrator overwriting research_meta wholesale).
//
// PRECEDENCE (the contract A2 establishes):
//   1. researchedSpecialists[domain]  — produced by the new pipe.
//                                        Fully validated, source-
//                                        attributed, contract-
//                                        conforming.
//   2. legacy adapter output          — derived from
//                                        local_requirements_research /
//                                        visa_research columns.
//   When (1) is present and quality !== "fallback", it WINS for
//   that domain — the legacy adapter is not consulted.
type ResearchedSpecialistsCache = Partial<Record<string, ResearchedSteps>>;

interface ResearchMetaWithSpecialists {
  preDeparture?: StoredPreDeparture;
  researchedSpecialists?: ResearchedSpecialistsCache;
}

const RESEARCHED_BUDGET_MS = 90_000;

/**
 * Run the B2 (and future) researched specialists for the given
 * profile. Specialists run in parallel; each enforces its own
 * budget via withBudget(). The returned map is keyed by SpecialistDomain
 * string and only contains entries that came back with a usable shape
 * — fallback-quality outputs are still included so the caller can
 * decide whether to use them or drop back to legacy.
 */
async function runResearchedSpecialistsForPreDeparture(args: {
  profile: PreDepartureProfile;
  profileId: string;
  logWriter: ReturnType<typeof createSupabaseLogWriter>;
}): Promise<ResearchedSpecialistsCache> {
  const { profile, profileId, logWriter } = args;
  // SpecialistProfile = Record<string, string|number|null|undefined>.
  // PreDepartureProfile is a richer shape; the specialist only reads
  // a subset of fields it knows how to serialise. Coerce through the
  // SpecialistProfile shape (string|number|null|undefined values only).
  const specialistProfile: Record<string, string | number | null | undefined> = {};
  for (const [k, v] of Object.entries(profile as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number") specialistProfile[k] = v;
    else if (typeof v === "boolean") specialistProfile[k] = v ? "yes" : "no";
    // Skip arrays / objects — specialists don't read them.
  }
  const sharedInput = {
    profile: specialistProfile,
    profileId,
    logWriter,
    budgetMs: RESEARCHED_BUDGET_MS,
  } as const;

  const [docs, housing, banking] = await Promise.all([
    documentsSpecialistV2(sharedInput).catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : err }, "documents_v2 threw");
      return null;
    }),
    housingSpecialistV2(sharedInput).catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : err }, "housing_v2 threw");
      return null;
    }),
    bankingSpecialistV2(sharedInput).catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : err }, "banking_v2 threw");
      return null;
    }),
  ]);

  const out: ResearchedSpecialistsCache = {};
  if (docs && docs.kind === "steps") out.documents = docs;
  if (housing && housing.kind === "steps") out.housing = housing;
  if (banking && banking.kind === "steps") out.banking = banking;
  return out;
}

// Domains the pre-departure composer renders. Order is the order they
// appear in the summary card on /pre-move.
const PRE_DEPARTURE_DOMAINS: ReadonlyArray<string> = [
  "visa",
  "documents",
  "housing",
  "banking",
  "healthcare",
];

/**
 * Decide the provenance kind for one pre-departure domain. Honest
 * three-way:
 *   - cache present + usable    →  researched (new pipe)
 *   - legacy adapter produced  →  legacy_research
 *   - neither                  →  generic
 *
 * "usable" mirrors mergeResearchedByDomain's gate: quality !==
 * "fallback" OR ≥1 step. A pure-fallback bundle that the merge
 * skipped also doesn't count as "researched" here.
 *
 * For legacy_research, the retrievedAt comes from the producing
 * column's `researchedAt` field (visa_research.researchedAt or
 * local_requirements_research.researchedAt). Earlier commits set
 * this to "now()" at provenance build time, which made the legacy
 * research never look stale — wrong; the actual research can be
 * months old. Phase E1b fixes that.
 */
function provenanceForDomain(args: {
  domain: string;
  cache: ResearchedSpecialistsCache;
  legacyByDomain: Record<string, ResearchedStepsLite>;
  legacyRetrievedAt: { visa: string | null; localRequirements: string | null };
}): TimelineDomainProvenance {
  const cached = args.cache[args.domain];
  if (
    cached &&
    cached.kind === "steps" &&
    (cached.quality !== "fallback" || cached.steps.length > 0)
  ) {
    return {
      kind: "researched",
      quality: cached.quality,
      ...(cached.fallbackReason ? { fallbackReason: cached.fallbackReason } : {}),
      retrievedAt: cached.retrievedAt,
      stale: isResearchStale(cached.retrievedAt),
      daysOld: daysSinceRetrieved(cached.retrievedAt),
      sources: cached.sources.map((s) => ({
        url: s.url,
        domain: s.domain,
        kind: s.kind,
        ...(s.title ? { title: s.title } : {}),
      })),
    };
  }
  const legacy = args.legacyByDomain[args.domain];
  if (legacy && Array.isArray(legacy.steps) && legacy.steps.length > 0) {
    // Pull the source column's actual researchedAt rather than
    // pretending the bundle was just produced. Visa flows through
    // visa_research; everything else (documents/housing/banking/
    // healthcare on legacy) flows through local_requirements_research.
    const retrievedAt =
      args.domain === "visa"
        ? args.legacyRetrievedAt.visa ?? new Date().toISOString()
        : args.legacyRetrievedAt.localRequirements ?? new Date().toISOString();
    return {
      kind: "legacy_research",
      retrievedAt,
      stale: isResearchStale(retrievedAt),
      daysOld: daysSinceRetrieved(retrievedAt),
      sources: (legacy.sources ?? []).map((s) => ({
        url: s.url,
        domain: s.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, ""),
        // Legacy adapter doesn't tag source kind; default to authority.
        kind: "authority" as const,
      })),
    };
  }
  return { kind: "generic" };
}

function buildPreDepartureProvenance(args: {
  cache: ResearchedSpecialistsCache;
  legacyByDomain: Record<string, ResearchedStepsLite>;
  legacyRetrievedAt: { visa: string | null; localRequirements: string | null };
}): Record<string, TimelineDomainProvenance> {
  const out: Record<string, TimelineDomainProvenance> = {};
  for (const domain of PRE_DEPARTURE_DOMAINS) {
    out[domain] = provenanceForDomain({
      domain,
      cache: args.cache,
      legacyByDomain: args.legacyByDomain,
      legacyRetrievedAt: args.legacyRetrievedAt,
    });
  }
  return out;
}

/**
 * Apply the precedence rule: researched cache wins over legacy adapter
 * output for any domain it covers with usable quality. Domains absent
 * from the cache (or whose cached entry is fallback-only) fall back to
 * whatever the legacy adapter produced.
 */
function mergeResearchedByDomain(args: {
  legacyByDomain: Record<string, ResearchedStepsLite>;
  cache: ResearchedSpecialistsCache;
}): Record<string, ResearchedStepsLite> {
  const merged: Record<string, ResearchedStepsLite> = { ...args.legacyByDomain };
  for (const [domain, bundle] of Object.entries(args.cache)) {
    if (!bundle) continue;
    // Skip fallback-only output — legacy adapter (if it has anything)
    // is at least anchored to a real persisted research run. Don't
    // make /pre-move worse to honour cache presence.
    if (bundle.quality === "fallback" && bundle.steps.length === 0) continue;
    merged[domain] = bundle as unknown as ResearchedStepsLite;
  }
  return merged;
}

router.get("/pre-departure", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const planIdQ = req.query.planId;
    const planId = typeof planIdQ === "string" ? planIdQ : null;
    let resolvedPlanId = planId;
    if (!resolvedPlanId) {
      const { data: plan } = await ctx.supabase
        .from("relocation_plans")
        .select("id")
        .eq("user_id", ctx.user.id)
        .eq("is_current", true)
        .maybeSingle();
      resolvedPlanId = plan?.id ?? null;
    }
    if (!resolvedPlanId) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    const { data: plan, error } = await ctx.supabase
      .from("relocation_plans")
      .select("id, research_meta")
      .eq("user_id", ctx.user.id)
      .eq("id", resolvedPlanId)
      .maybeSingle<PlanRowForRead>();
    if (error) {
      logger.error({ err: error }, "pre-departure GET error");
      res.status(500).json({ error: "Failed to load pre-departure timeline" });
      return;
    }
    const stored = plan?.research_meta?.preDeparture;
    if (!stored || !stored.actions || stored.actions.length === 0) {
      res.status(404).json({ error: "Pre-departure timeline not generated yet" });
      return;
    }

    // Phase 1A — compute server-side urgency + days-until from each action's
    // persisted deadlineIso. Completed/skipped actions are forced to "normal"
    // so they don't squat the urgent slots. Sort so overdue → urgent →
    // approaching → normal, ties broken by earliest deadline.
    const now = new Date();
    const decorated = stored.actions.map((a) => {
      const due = a.deadlineIso ? new Date(a.deadlineIso) : null;
      const isClosed = a.status === "complete" || a.status === "skipped";
      const urgency: Urgency = isClosed ? "normal" : computeUrgency(due, now);
      return {
        ...a,
        urgency,
        daysUntilDeadline: daysUntil(due, now),
      };
    });
    const sorted = decorated.slice().sort((a, b) => {
      const r = compareByUrgency(
        { urgency: a.urgency, due_at: a.deadlineIso ?? null },
        { urgency: b.urgency, due_at: b.deadlineIso ?? null },
      );
      if (r !== 0) return r;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

    res.json({
      planId: resolvedPlanId,
      actions: sorted,
      totalActions: sorted.length,
      criticalPathActionKeys: stored.criticalPath,
      longestLeadTimeWeeks: stored.longestLeadTimeWeeks,
      moveDate: stored.moveDateIso.split("T")[0],
      generatedAt: stored.generatedAt,
      // Phase D-B — provenance comes from the persisted snapshot;
      // older timelines (pre-D-B) lack the field, so default to an
      // all-generic map the UI can render without breaking.
      provenance: stored.provenance ?? defaultGenericProvenance(),
      stats: {
        total: sorted.length,
        overdue: sorted.filter((a) => a.urgency === "overdue").length,
        urgent: sorted.filter((a) => a.urgency === "urgent").length,
        approaching: sorted.filter((a) => a.urgency === "approaching").length,
      },
    });
  } catch (err) {
    logger.error({ err }, "pre-departure GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

function defaultGenericProvenance(): Record<string, TimelineDomainProvenance> {
  const out: Record<string, TimelineDomainProvenance> = {};
  for (const d of PRE_DEPARTURE_DOMAINS) out[d] = { kind: "generic" };
  return out;
}

router.post("/pre-departure/generate", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const { data: plan, error: planErr } = await ctx.supabase
      .from("relocation_plans")
      .select(
        "id, stage, locked, profile_data, visa_research, local_requirements_research, arrival_date, user_triggered_pre_departure_at, research_meta",
      )
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<PlanRowForGenerate>();
    if (planErr || !plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    if (
      plan.stage !== "ready_for_pre_departure" &&
      plan.stage !== "pre_departure" &&
      plan.stage !== "complete"
    ) {
      res.status(409).json({
        error: `Cannot generate pre-departure timeline from stage "${plan.stage}". Trigger research first.`,
      });
      return;
    }

    const profile = (plan.profile_data ?? {}) as PreDepartureProfile;
    const moveDate = plan.arrival_date
      ? new Date(plan.arrival_date)
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);

    // Build the legacy VisaPathwayLite (still used by the hardcoded
    // visaContributions fallback) — same logic as before.
    let visa: VisaPathwayLite | null = null;
    const visaOptions = (plan.visa_research as { visaOptions?: Array<Record<string, unknown>> } | null)
      ?.visaOptions;
    if (Array.isArray(visaOptions) && visaOptions.length > 0) {
      const v = visaOptions[0];
      visa = {
        name: typeof v.name === "string" ? v.name : undefined,
        type: typeof v.type === "string" ? v.type : undefined,
        estimatedProcessingWeeks:
          typeof v.processingTime === "string" ? parseProcessingWeeks(v.processingTime) : undefined,
        officialUrl: typeof v.officialLink === "string" ? v.officialLink : undefined,
      };
    }

    // Phase A1 — legacy adapter produces the baseline researchedByDomain
    // map. Visa stays on the legacy shape (visa_research column is the
    // current source of truth). Banking / healthcare keep flowing through
    // adaptLocalRequirementsToSteps until a future B-wave migrates them.
    const legacyByDomain: Record<string, ResearchedStepsLite> = {};
    const visaResearched = adaptVisaResearchToSteps(plan.visa_research as Parameters<typeof adaptVisaResearchToSteps>[0]);
    if (visaResearched.steps.length > 0) {
      legacyByDomain.visa = visaResearched;
    }
    const localRequirementsAdapted = adaptLocalRequirementsToSteps(
      plan.local_requirements_research as Parameters<typeof adaptLocalRequirementsToSteps>[0],
    );
    for (const [domain, bundle] of Object.entries(localRequirementsAdapted)) {
      if (bundle && bundle.steps.length > 0) {
        legacyByDomain[domain] = bundle;
      }
    }

    // Phase A2 — read-or-warm the researched-specialists cache for
    // domains that have a B-wave specialist on the new contract
    // (today: documents, housing). Cache lives under
    // research_meta.researchedSpecialists; when missing we run the
    // specialists inline (parallel, ~60-90s each, 90s budget).
    //
    // Subsequent /pre-departure/generate calls are instant because
    // the cache is reused — only stage transitions / new research
    // runs invalidate it (the research-orchestrator overwrites
    // research_meta wholesale, dropping the cache).
    const meta = (plan.research_meta ?? {}) as ResearchMetaWithSpecialists;
    let researchedSpecialistsCache: ResearchedSpecialistsCache = meta.researchedSpecialists ?? {};
    const cacheMissing =
      !researchedSpecialistsCache.documents ||
      !researchedSpecialistsCache.housing ||
      !researchedSpecialistsCache.banking;
    if (cacheMissing) {
      logger.info({ planId: plan.id }, "pre-departure: researched-specialists cache miss; running B2 specialists");
      const fresh = await runResearchedSpecialistsForPreDeparture({
        profile,
        profileId: plan.id,
        logWriter: createSupabaseLogWriter(ctx.supabase),
      });
      researchedSpecialistsCache = { ...researchedSpecialistsCache, ...fresh };
    } else {
      logger.info({ planId: plan.id }, "pre-departure: researched-specialists cache hit");
    }

    // Merge — researched cache wins over legacy adapter for the
    // domains it covers, legacy stays for everything else.
    const researchedByDomain = mergeResearchedByDomain({
      legacyByDomain,
      cache: researchedSpecialistsCache,
    });

    const timeline = composePreDepartureTimeline({
      profile,
      visa,
      moveDate,
      researchedByDomain,
    });

    const criticalKeySet = new Set(timeline.criticalPath.map((c) => c.id));
    const moveMs = moveDate.getTime();
    const storedActions: StoredAction[] = timeline.actions.map((a) => {
      const deadlineDate = new Date(moveMs - a.weeksBeforeMoveDeadline * 7 * 24 * 60 * 60 * 1000);
      return {
        ...a,
        completedAt: null,
        userNotes: null,
        onCriticalPath: criticalKeySet.has(a.id),
        deadlineIso: deadlineDate.toISOString().split("T")[0],
      };
    });

    // Phase D-B — snapshot per-domain provenance at generation time so
    // GET /api/pre-departure can answer "where did each section come
    // from?" without re-scanning visa_research / local_requirements.
    // Phase E1b — pull legacy `researchedAt` from the source columns
    // so legacy_research provenance carries the actual research age
    // (used for the stale flag).
    const visaResearchedAt =
      typeof (plan.visa_research as { researchedAt?: unknown } | null)?.researchedAt === "string"
        ? ((plan.visa_research as { researchedAt: string }).researchedAt)
        : null;
    const localRequirementsResearchedAt =
      typeof (plan.local_requirements_research as { researchedAt?: unknown } | null)?.researchedAt === "string"
        ? ((plan.local_requirements_research as { researchedAt: string }).researchedAt)
        : null;
    const provenance = buildPreDepartureProvenance({
      cache: researchedSpecialistsCache,
      legacyByDomain,
      legacyRetrievedAt: {
        visa: visaResearchedAt,
        localRequirements: localRequirementsResearchedAt,
      },
    });

    const stored: StoredPreDeparture = {
      generatedAt: timeline.generatedAt,
      moveDateIso: timeline.moveDateIso,
      longestLeadTimeWeeks: timeline.longestLeadTimeWeeks,
      criticalPath: timeline.criticalPath.map((c) => c.id),
      actions: storedActions,
      provenance,
    };

    // Phase F1 — split the persist into two atomic statements:
    //   (1) atomic JSONB-merge for the research_meta sub-keys this
    //       writer owns (preDeparture + researchedSpecialists).
    //       Other sub-keys (notifications.*, …) belong to other
    //       writers and stay untouched.
    //   (2) a direct UPDATE for the non-jsonb columns this route
    //       does need to touch (stage flip, user_triggered_pre_departure_at).
    //
    // The RPC bumps updated_at on its own; the (2) UPDATE bumps it
    // again to keep the existing freshness signal consistent.
    const nowIso = new Date().toISOString();
    try {
      await applyResearchMetaPatch(ctx.supabase, plan.id, {
        preDeparture: stored,
        researchedSpecialists: researchedSpecialistsCache,
      });
    } catch (err) {
      logger.error({ err }, "pre-departure: research_meta patch failed");
      res.status(500).json({
        error: "Failed to persist pre-departure timeline",
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    const { error: upErr } = await ctx.supabase
      .from("relocation_plans")
      .update({
        stage: "pre_departure",
        user_triggered_pre_departure_at: plan.user_triggered_pre_departure_at ?? nowIso,
        updated_at: nowIso,
      })
      .eq("id", plan.id);
    if (upErr) {
      logger.error({ err: upErr }, "pre-departure: stage flip failed");
      res.status(500).json({ error: "Failed to persist pre-departure timeline", detail: upErr.message });
      return;
    }

    const now = new Date();
    const decorated = stored.actions.map((a) => {
      const due = a.deadlineIso ? new Date(a.deadlineIso) : null;
      const isClosed = a.status === "complete" || a.status === "skipped";
      const urgency: Urgency = isClosed ? "normal" : computeUrgency(due, now);
      return { ...a, urgency, daysUntilDeadline: daysUntil(due, now) };
    });
    const sorted = decorated.slice().sort((a, b) => {
      const r = compareByUrgency(
        { urgency: a.urgency, due_at: a.deadlineIso ?? null },
        { urgency: b.urgency, due_at: b.deadlineIso ?? null },
      );
      if (r !== 0) return r;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

    res.json({
      planId: plan.id,
      actions: sorted,
      totalActions: sorted.length,
      criticalPathActionKeys: stored.criticalPath,
      longestLeadTimeWeeks: stored.longestLeadTimeWeeks,
      moveDate: stored.moveDateIso.split("T")[0],
      generatedAt: stored.generatedAt,
      provenance,
      stats: {
        total: sorted.length,
        overdue: sorted.filter((a) => a.urgency === "overdue").length,
        urgent: sorted.filter((a) => a.urgency === "urgent").length,
        approaching: sorted.filter((a) => a.urgency === "approaching").length,
      },
    });
  } catch (err) {
    logger.error({ err }, "pre-departure generate threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/pre-departure/:actionId", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const actionId = req.params.actionId;
    const body = (req.body ?? {}) as { status?: string; notes?: string };
    const incoming = body.status;
    if (typeof incoming !== "string" || !VALID_STATUSES.has(incoming as ActionStatus)) {
      res.status(400).json({ error: `status must be one of ${[...VALID_STATUSES].join(", ")}` });
      return;
    }
    const newStatus = incoming as ActionStatus;
    const { data: plan, error: planErr } = await ctx.supabase
      .from("relocation_plans")
      .select("id, research_meta")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<PlanRowForRead>();
    if (planErr || !plan?.research_meta?.preDeparture) {
      res.status(404).json({ error: "No active pre-departure timeline" });
      return;
    }
    const stored = plan.research_meta.preDeparture;
    const idx = stored.actions.findIndex((a) => a.id === actionId);
    if (idx < 0) {
      res.status(404).json({ error: "Action not found in current timeline" });
      return;
    }
    const updated: StoredAction = {
      ...stored.actions[idx],
      status: newStatus,
      ...(typeof body.notes === "string" ? { userNotes: body.notes } : {}),
      ...(newStatus === "complete" ? { completedAt: new Date().toISOString() } : { completedAt: null }),
    };
    const newActions = [...stored.actions];
    newActions[idx] = updated;
    // Phase F1 — atomic JSONB merge so concurrent edits to other
    // research_meta sub-keys (notifications, researchedSpecialists,
    // …) survive this PATCH.
    try {
      await applyResearchMetaPatch(ctx.supabase, plan.id, {
        preDeparture: { ...stored, actions: newActions },
      });
    } catch (err) {
      logger.error({ err }, "pre-departure PATCH persist failed");
      res.status(500).json({ error: "Failed to update action" });
      return;
    }
    res.json({ action: updated });
  } catch (err) {
    logger.error({ err }, "pre-departure PATCH threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

function parseProcessingWeeks(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:to\s*(\d+))?\s*(week|day|month)/i);
  if (!m) return undefined;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  const avg = (lo + hi) / 2;
  const unit = m[3].toLowerCase();
  if (unit.startsWith("week")) return Math.round(avg);
  if (unit.startsWith("day")) return Math.max(1, Math.round(avg / 7));
  if (unit.startsWith("month")) return Math.round(avg * 4);
  return undefined;
}

export default router;
