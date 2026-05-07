import { Router, type IRouter } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticate } from "../lib/supabase-auth";
import { getUserTier, hasFeatureAccess } from "../lib/gomate/tier";
import { logger } from "../lib/logger";
import { applyResearchMetaPatchAt } from "../lib/research-meta-patch";
import {
  composeSettlingInTimeline,
  computeUrgency,
  daysUntil,
  compareByUrgency,
  registrationSpecialist,
  bankingSpecialistV2,
  healthcareSpecialistV2,
  createSupabaseLogWriter,
  isResearchStale,
  daysSinceRetrieved,
  bridgeCompletionsBySimilarTitle,
  type SettlingInProfile,
  type SettlingTask,
  type ResearchedSteps,
  type DeadlineType,
  type Urgency,
  type BridgeSnapshot,
} from "@workspace/agents";

const router: IRouter = Router();

// =============================================================
// Phase C1c — post-move researched-specialists cache
// =============================================================
// Mirrors the pre-departure cache (research_meta.researchedSpecialists.
// {documents,housing,banking}) but is OWNED by the post-move surface
// and includes the registration domain. Banking deliberately appears
// in both caches — the same bundle is acceptable for both surfaces;
// each surface filters to phase-relevant steps via its composer.
//
// Why a separate post-move helper rather than reusing the pre-departure
// one: registration has no pre-departure surface (the pre-departure
// timeline filters phase ∈ {before_move, move_day} only). Pre-warming
// it from the pre-departure side would be paying LLM cost for output
// the route never reads. This keeps each surface's specialist set
// scoped to what it actually consumes.
type PostMoveResearchedCache = Partial<Record<string, ResearchedSteps>>;

const POSTMOVE_BUDGET_MS = 90_000;

async function runResearchedSpecialistsForPostMove(args: {
  profile: SettlingInProfile;
  profileId: string;
  logWriter: ReturnType<typeof createSupabaseLogWriter>;
}): Promise<PostMoveResearchedCache> {
  const { profile, profileId, logWriter } = args;
  const specialistProfile: Record<string, string | number | null | undefined> = {};
  for (const [k, v] of Object.entries(profile as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number") specialistProfile[k] = v;
    else if (typeof v === "boolean") specialistProfile[k] = v ? "yes" : "no";
  }
  const sharedInput = {
    profile: specialistProfile,
    profileId,
    logWriter,
    budgetMs: POSTMOVE_BUDGET_MS,
  } as const;

  const [registration, banking, healthcare] = await Promise.all([
    registrationSpecialist(sharedInput).catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : err }, "registration_specialist threw");
      return null;
    }),
    bankingSpecialistV2(sharedInput).catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : err }, "banking_v2 threw");
      return null;
    }),
    healthcareSpecialistV2(sharedInput).catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : err }, "healthcare_v2 threw");
      return null;
    }),
  ]);

  const out: PostMoveResearchedCache = {};
  if (registration && registration.kind === "steps") out.registration = registration;
  if (banking && banking.kind === "steps") out.banking = banking;
  if (healthcare && healthcare.kind === "steps") out.healthcare = healthcare;
  return out;
}

/**
 * Phase 7.2 — settling-in DAG persistence.
 * Triggered automatically when /api/settling-in/arrive flips stage→arrived.
 * Idempotent: deletes prior tasks for the plan, regenerates from profile +
 * arrival_date + researched cache, persists. Returns the inserted rows.
 *
 * Phase C1c — composes via composeSettlingInTimeline so registration +
 * banking can come from researched specialists when the cache is warm.
 * Cache lives at relocation_plans.research_meta.researchedSpecialists;
 * the same JSON column the pre-departure path reads/writes.
 */
async function generateAndPersistSettlingInTasks(args: {
  supabase: SupabaseClient;
  userId: string;
  planId: string;
  profile: SettlingInProfile;
  arrivalDate: Date;
  researchMeta: { researchedSpecialists?: PostMoveResearchedCache } | null;
}): Promise<{ count: number; legalCount: number; urgentCount: number }> {
  // 1. Read cache; warm missing slots inline.
  const meta = args.researchMeta ?? {};
  let researchedCache: PostMoveResearchedCache = meta.researchedSpecialists ?? {};
  const cacheMissing =
    !researchedCache.registration ||
    !researchedCache.banking ||
    !researchedCache.healthcare;
  if (cacheMissing) {
    logger.info({ planId: args.planId }, "settling-in: post-move researched cache miss; running specialists");
    const fresh = await runResearchedSpecialistsForPostMove({
      profile: args.profile,
      profileId: args.planId,
      logWriter: createSupabaseLogWriter(args.supabase),
    });
    researchedCache = { ...researchedCache, ...fresh };
    // Phase F1 fix — per-domain path writes (jsonb_set) so a
    // concurrent refresh of a different domain doesn't race the
    // researchedSpecialists parent. Each fresh bundle is its own
    // atomic write; if more than one bundle was just produced
    // (registration + banking + healthcare in this surface), they
    // serialise via Promise resolution but never collide on each
    // other's slot.
    for (const [domain, bundle] of Object.entries(fresh)) {
      if (bundle === undefined) continue;
      await applyResearchMetaPatchAt(args.supabase, args.planId, [
        "researchedSpecialists",
        domain,
      ], bundle);
    }
  } else {
    logger.info({ planId: args.planId }, "settling-in: post-move researched cache hit");
  }

  // 2. Compose with researched precedence (C1b/C2).
  const dag = composeSettlingInTimeline({
    profile: args.profile,
    arrivalDate: args.arrivalDate,
    researchedByDomain: {
      ...(researchedCache.registration ? { registration: researchedCache.registration } : {}),
      ...(researchedCache.banking ? { banking: researchedCache.banking } : {}),
      ...(researchedCache.healthcare ? { healthcare: researchedCache.healthcare } : {}),
    },
  });

  // ----- C1.1 — snapshot prior rows before wipe so the bridge can
  // carry user state (status / completed_at / user_notes) onto
  // semantically-equivalent new tasks. The bridge itself runs after
  // the inserts complete; this just preserves the source data.
  // settling_in_tasks doesn't have a user_notes column today (only
  // pre-departure stored actions do). The BridgeSnapshot type carries
  // userNotes for surface symmetry; we just feed it null here so the
  // bridge ignores it. If a future migration adds notes to settling
  // tasks, swap this back to read the column.
  interface PriorTaskRow {
    id: string;
    task_key: string | null;
    title: string | null;
    category: string | null;
    status: string | null;
    completed_at: string | null;
    deadline_at: string | null;
    documents_needed: string[] | null;
    walkthrough: unknown;
    description: string | null;
    deadline_days: number | null;
    is_legal_requirement: boolean | null;
    deadline_type: string | null;
    steps: unknown;
    official_link: string | null;
    estimated_time: string | null;
    cost: string | null;
    sort_order: number | null;
  }
  const { data: priorRows } = await args.supabase
    .from("settling_in_tasks")
    .select(
      "id, task_key, title, category, status, completed_at, deadline_at, documents_needed, walkthrough, description, deadline_days, is_legal_requirement, deadline_type, steps, official_link, estimated_time, cost, sort_order",
    )
    .eq("plan_id", args.planId)
    .eq("user_id", args.userId)
    .returns<PriorTaskRow[]>();
  const snapshot: BridgeSnapshot[] = (priorRows ?? [])
    .filter((r) => typeof r.task_key === "string" && typeof r.title === "string" && typeof r.category === "string")
    .map((r) => ({
      taskKey: r.task_key as string,
      title: r.title as string,
      category: r.category as string,
      status: r.status ?? "available",
      completedAt: r.completed_at,
      userNotes: null,
    }));

  // Wipe any prior tasks for this plan (regen path).
  await args.supabase
    .from("settling_in_tasks")
    .delete()
    .eq("plan_id", args.planId)
    .eq("user_id", args.userId);

  if (dag.tasks.length === 0) {
    return { count: 0, legalCount: 0, urgentCount: 0 };
  }

  // ----- C1.1 — compute the bridge BEFORE building insertRows so
  // the bridged status/completed_at/user_notes can land on the
  // initial INSERT (no second update round-trip).
  const bridge = bridgeCompletionsBySimilarTitle(
    dag.tasks.map((t) => ({
      taskKey: t.taskKey,
      title: t.title,
      category: t.category,
    })),
    snapshot,
  );
  if (bridge.matches.size > 0 || bridge.orphans.length > 0) {
    logger.info(
      {
        planId: args.planId,
        bridged: bridge.matches.size,
        orphans: bridge.orphans.length,
        decisions: bridge.log.map((e) => ({ legacyKey: e.legacyKey, decision: e.decision })),
      },
      "settling-in: completion bridge ran",
    );
  }

  const arrivalMs = args.arrivalDate.getTime();

  // settling_in_tasks.depends_on is uuid[]. Our generator emits string
  // keys ("reg-population") so dependencies are author-friendly. We do a
  // 2-pass write: insert all tasks with empty depends_on (Postgres assigns
  // ids), then map taskKey → assigned uuid and PATCH dep arrays.
  // The taskKey is hidden in `documents_needed[0]` as a "__key:..." sentinel
  // because the table has no spare text column. We strip the sentinel
  // before sending data back to the UI.
  const insertRows = dag.tasks.map((t: SettlingTask) => {
    const deadlineDate = new Date(arrivalMs + t.deadlineDays * 24 * 60 * 60 * 1000);
    // C1.1 — apply bridged state if this new task inherited from a
    // legacy row. Where no bridge match exists, fall back to the
    // task's default ("available", no completion).
    const carried = bridge.matches.get(t.taskKey);
    return {
      user_id: args.userId,
      plan_id: args.planId,
      title: t.title,
      description: t.description,
      category: t.category,
      depends_on: [],
      deadline_days: t.deadlineDays,
      deadline_at: deadlineDate.toISOString(),
      is_legal_requirement: t.isLegalRequirement,
      deadline_type: t.deadlineType ?? (t.isLegalRequirement ? "legal" : "practical"),
      walkthrough: t.walkthrough ?? null,
      task_key: t.taskKey,
      steps: t.steps,
      documents_needed: [`__key:${t.taskKey}`, ...t.documentsNeeded],
      official_link: t.officialLink,
      estimated_time: t.estimatedTime,
      cost: t.cost,
      status: carried?.status ?? t.status,
      completed_at: carried?.completedAt ?? null,
      sort_order: t.sortOrder,
    };
  });
  const { data: inserted, error } = await args.supabase
    .from("settling_in_tasks")
    .insert(insertRows)
    .select("id, documents_needed");
  if (error || !inserted) {
    logger.error({ err: error, planId: args.planId }, "settling-in: persist failed");
    throw error ?? new Error("settling-in insert returned no rows");
  }

  // Build taskKey → UUID map from sentinel.
  const keyToUuid = new Map<string, string>();
  for (const row of inserted as Array<{ id: string; documents_needed: string[] }>) {
    const key = row.documents_needed.find((d) => d.startsWith("__key:"))?.slice("__key:".length);
    if (key) keyToUuid.set(key, row.id);
  }

  // Pass 2 — patch depends_on arrays + strip sentinel.
  const patches: Array<Promise<unknown>> = [];
  for (const t of dag.tasks) {
    const id = keyToUuid.get(t.taskKey);
    if (!id) continue;
    const depUuids = t.dependsOn.map((k) => keyToUuid.get(k)).filter((u): u is string => !!u);
    const cleanDocs = t.documentsNeeded;
    patches.push(
      Promise.resolve(
        args.supabase
          .from("settling_in_tasks")
          .update({ depends_on: depUuids, documents_needed: cleanDocs })
          .eq("id", id),
      ),
    );
  }
  await Promise.all(patches);

  // ----- C1.1 — re-insert orphans (legacy rows that didn't earn
  // a confident bridge match). These keep their old task_key + state
  // so the user doesn't lose their progress; UI work later will
  // surface a disambiguation prompt ("is this the same as <new
  // task>?"). For now, an orphan visually appears as an additional
  // task in its category. False-positive avoidance was the priority,
  // not zero duplicates.
  if (bridge.orphans.length > 0) {
    const orphanIdsToReinsert = bridge.orphans
      .map((o) =>
        (priorRows ?? []).find((r) => r.task_key === o.taskKey),
      )
      .filter((r): r is PriorTaskRow => r !== undefined);
    if (orphanIdsToReinsert.length > 0) {
      const orphanRows = orphanIdsToReinsert.map((r) => ({
        user_id: args.userId,
        plan_id: args.planId,
        title: r.title,
        description: r.description,
        category: r.category,
        depends_on: [],
        deadline_days: r.deadline_days,
        deadline_at: r.deadline_at,
        is_legal_requirement: r.is_legal_requirement,
        deadline_type: r.deadline_type,
        walkthrough: r.walkthrough,
        task_key: r.task_key,
        steps: r.steps,
        // Strip any sentinels from documents_needed; orphans were
        // already cleaned via the original pass-2 update before
        // they got snapshotted, but be defensive.
        documents_needed: Array.isArray(r.documents_needed)
          ? r.documents_needed.filter((d) => !d.startsWith("__key:"))
          : [],
        official_link: r.official_link,
        estimated_time: r.estimated_time,
        cost: r.cost,
        status: r.status,
        completed_at: r.completed_at,
        sort_order: r.sort_order,
      }));
      const { error: orphanErr } = await args.supabase
        .from("settling_in_tasks")
        .insert(orphanRows);
      if (orphanErr) {
        logger.error(
          { err: orphanErr, planId: args.planId, count: orphanRows.length },
          "settling-in: failed to re-insert bridge orphans (state may be lost)",
        );
      }
    }
  }

  // Mark plan as generated.
  await args.supabase
    .from("relocation_plans")
    .update({ post_relocation_generated: true, updated_at: new Date().toISOString() })
    .eq("id", args.planId);

  return {
    count: dag.tasks.length,
    legalCount: dag.legalRequirementsCount,
    urgentCount: dag.urgentDeadlines.length,
  };
}

function isPostArrivalStage(stage: string | null | undefined): boolean {
  return stage === "arrived";
}

// =============================================================
// Phase D-A — provenance map for the UI
// =============================================================
// The /api/settling-in response now ships a `provenance` block keyed
// by SettlingDomain. The UI uses this to render a per-category badge
// indicating whether the section's content came from a researched
// specialist (and what quality) vs the deterministic DAG.
//
// Honesty rules:
//   - kind="researched" only when a usable bundle exists in
//     research_meta.researchedSpecialists (quality !== "fallback" or
//     ≥1 step). Same definition as the composer's isUsableResearched.
//   - kind="generic" everywhere else — including domains that
//     could be researched in principle (housing, employment, etc.)
//     but aren't wired yet.
//   - retrievedAt + sources are surfaced verbatim from the bundle so
//     the UI doesn't second-guess freshness.

interface CategoryProvenanceResearched {
  kind: "researched";
  quality: "full" | "partial" | "fallback";
  fallbackReason?: string;
  retrievedAt: string;
  /** Phase E1b — true when retrievedAt is older than the 14-day
   *  staleness threshold. UI uses this to flag "consider refreshing". */
  stale: boolean;
  /** Whole-days-old, floored. Helps UI render copy without a
   *  second pass through the timestamp. Null only if retrievedAt
   *  is unparseable (which is treated as not-stale per the
   *  isResearchStale conservative rule). */
  daysOld: number | null;
  sources: Array<{ url: string; domain: string; kind: "authority" | "institution" | "reference"; title?: string }>;
}
interface CategoryProvenanceGeneric {
  kind: "generic";
}
type CategoryProvenance = CategoryProvenanceResearched | CategoryProvenanceGeneric;

const ALL_SETTLING_DOMAINS: ReadonlyArray<string> = [
  "registration",
  "banking",
  "healthcare",
  "housing",
  "employment",
  "transport",
  "family",
  "tax",
];

// Domains the post-move composer actually consumes from the
// researched cache. Other domains' entries in research_meta.
// researchedSpecialists may exist (banking + housing also live there
// for the pre-departure pipe) but they don't drive any /post-move
// content — surfacing "researched" for them would mislead the user
// since the section content they see is still deterministic.
const POSTMOVE_RESEARCHED_DOMAINS: ReadonlySet<string> = new Set([
  "registration",
  "banking",
  "healthcare",
]);

function buildProvenanceMap(
  researchedCache: PostMoveResearchedCache | null | undefined,
): Record<string, CategoryProvenance> {
  const out: Record<string, CategoryProvenance> = {};
  for (const domain of ALL_SETTLING_DOMAINS) {
    if (!POSTMOVE_RESEARCHED_DOMAINS.has(domain)) {
      out[domain] = { kind: "generic" };
      continue;
    }
    const bundle = researchedCache?.[domain];
    if (
      bundle &&
      bundle.kind === "steps" &&
      // Same usable-bundle rule as the composer; bundles that never
      // produced a single post-arrival step shouldn't be surfaced as
      // "researched" — UI would show a badge with no story behind it.
      (bundle.quality !== "fallback" || bundle.steps.length > 0)
    ) {
      out[domain] = {
        kind: "researched",
        quality: bundle.quality,
        ...(bundle.fallbackReason ? { fallbackReason: bundle.fallbackReason } : {}),
        retrievedAt: bundle.retrievedAt,
        stale: isResearchStale(bundle.retrievedAt),
        daysOld: daysSinceRetrieved(bundle.retrievedAt),
        sources: bundle.sources.map((s) => ({
          url: s.url,
          domain: s.domain,
          kind: s.kind,
          ...(s.title ? { title: s.title } : {}),
        })),
      };
    } else {
      out[domain] = { kind: "generic" };
    }
  }
  return out;
}

router.get("/settling-in", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "settling_in_tasks")) {
      res.status(403).json({ error: "Post-relocation features require Pro" });
      return;
    }
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id, arrival_date, stage, post_relocation_generated, research_meta")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<{
        id: string;
        arrival_date: string | null;
        stage: string | null;
        post_relocation_generated: boolean | null;
        research_meta: { researchedSpecialists?: PostMoveResearchedCache } | null;
      }>();
    if (!plan) {
      res.status(404).json({ error: "No active plan found" });
      return;
    }
    if (!isPostArrivalStage(plan.stage)) {
      res.json({
        tasks: [], stage: plan.stage, arrivalDate: null,
        generated: false, executionEnabled: false,
        provenance: buildProvenanceMap(null),
        stats: { total: 0, completed: 0, overdue: 0, available: 0, locked: 0, legalTotal: 0, legalCompleted: 0, progressPercent: 0, compliancePercent: 0 },
      });
      return;
    }
    const { data: tasks } = await ctx.supabase
      .from("settling_in_tasks")
      .select("*")
      .eq("plan_id", plan.id)
      .order("sort_order");
    const rawList = tasks || [];

    // Phase 1A — compute server-side urgency from deadline_at vs now and
    // re-sort so that overdue/urgent items rise to the top within each
    // category. Completed/skipped tasks are forced to "normal" so they
    // don't dominate the urgent slots.
    const now = new Date();
    const decorated = rawList.map((t: any) => {
      const due = t.deadline_at ? new Date(t.deadline_at) : null;
      const isClosed = t.status === "completed" || t.status === "skipped";
      const urgency: Urgency = isClosed ? "normal" : computeUrgency(due, now);
      const deadlineType: DeadlineType =
        (t.deadline_type as DeadlineType | undefined) ??
        (t.is_legal_requirement ? "legal" : "practical");
      return {
        ...t,
        deadline_type: deadlineType,
        urgency,
        days_until_deadline: daysUntil(due, now),
      };
    });
    const list = decorated.slice().sort((a, b) => {
      const r = compareByUrgency(
        { urgency: a.urgency, due_at: a.deadline_at },
        { urgency: b.urgency, due_at: b.deadline_at },
      );
      if (r !== 0) return r;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    const completed = list.filter((t: any) => t.status === "completed").length;
    const legalTotal = list.filter((t: any) => t.is_legal_requirement).length;
    const legalCompleted = list.filter((t: any) => t.is_legal_requirement && t.status === "completed").length;
    res.json({
      tasks: list,
      stage: plan.stage,
      arrivalDate: plan.arrival_date,
      generated: Boolean(plan.post_relocation_generated),
      executionEnabled: true,
      provenance: buildProvenanceMap(plan.research_meta?.researchedSpecialists ?? null),
      stats: {
        total: list.length,
        completed,
        overdue: list.filter((t: any) => t.urgency === "overdue").length,
        urgent: list.filter((t: any) => t.urgency === "urgent").length,
        approaching: list.filter((t: any) => t.urgency === "approaching").length,
        available: list.filter((t: any) => t.status === "available").length,
        locked: list.filter((t: any) => t.status === "locked").length,
        legalTotal,
        legalCompleted,
        progressPercent: list.length > 0 ? Math.round((completed / list.length) * 100) : 0,
        compliancePercent: legalTotal > 0 ? Math.round((legalCompleted / legalTotal) * 100) : 0,
      },
    });
  } catch (err) {
    logger.error({ err }, "settling-in get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/settling-in/:id", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "settling_in_tasks")) {
      res.status(403).json({ error: "Pro required" });
      return;
    }
    const newStatus = (req.body as { status?: string })?.status;
    const valid = ["available", "in_progress", "completed", "skipped"];
    if (!newStatus || !valid.includes(newStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    const { data: task } = await ctx.supabase
      .from("settling_in_tasks")
      .select("id, status, plan_id, depends_on")
      .eq("id", req.params.id)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    };
    const { error: updErr } = await ctx.supabase
      .from("settling_in_tasks")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", ctx.user.id);
    if (updErr) {
      res.status(500).json({ error: "Failed to update task" });
      return;
    }
    res.json({ success: true, taskId: req.params.id, status: newStatus });
  } catch (err) {
    logger.error({ err }, "settling-in patch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/settling-in/arrive", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "settling_in_tasks")) {
      res.status(403).json({ error: "Pro required" });
      return;
    }
    const arrivalDate = (req.body as { arrivalDate?: string })?.arrivalDate || new Date().toISOString().split("T")[0];
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id, stage, profile_data, research_meta")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<{ id: string; stage: string | null; profile_data: Record<string, unknown> | null; research_meta: { researchedSpecialists?: PostMoveResearchedCache } | null }>();
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    // v2 Wave 1.3: arrival can be confirmed from any of the post-collection
    // stages. `complete` stays in the allow-list as a v1 backward-compat
    // alias for `ready_for_pre_departure`.
    const allowedSourceStages = new Set([
      "complete",
      "ready_for_pre_departure",
      "pre_departure",
      "arrived",
    ]);
    if (!allowedSourceStages.has(plan.stage as string)) {
      res.status(400).json({
        error:
          "Plan must be at least at the ready-for-pre-departure stage before marking arrival",
        currentStage: plan.stage,
      });
      return;
    }
    const { error: updErr } = await ctx.supabase
      .from("relocation_plans")
      .update({ stage: "arrived", arrival_date: arrivalDate, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .eq("user_id", ctx.user.id);
    if (updErr) {
      res.status(500).json({ error: "Failed to update" });
      return;
    }

    // Phase 7.2 — auto-generate settling-in DAG immediately after arrival.
    // Phase C1c — generation now reads research_meta.researchedSpecialists
    // and prefers researched output for registration + banking.
    let generation: { count: number; legalCount: number; urgentCount: number } | null = null;
    try {
      generation = await generateAndPersistSettlingInTasks({
        supabase: ctx.supabase,
        userId: ctx.user.id,
        planId: plan.id,
        profile: (plan.profile_data ?? {}) as SettlingInProfile,
        arrivalDate: new Date(arrivalDate),
        researchMeta: plan.research_meta ?? null,
      });
    } catch (genErr) {
      // Non-fatal: stage flip succeeded; user can manually re-trigger.
      logger.error({ err: genErr, planId: plan.id }, "settling-in: auto-generation failed (non-fatal)");
    }

    res.json({
      success: true,
      arrivalDate,
      stage: "arrived",
      planId: plan.id,
      ...(generation
        ? { tasksGenerated: generation.count, legalRequirements: generation.legalCount, urgentDeadlines: generation.urgentCount }
        : {}),
    });
  } catch (err) {
    logger.error({ err }, "settling-in arrive error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase C1c — manual regenerate endpoint. Reads the current plan,
// re-runs generateAndPersistSettlingInTasks (which reads/warms the
// researched cache + composes), responds with summary stats. Used
// from the /post-move checklist's "Regenerate" affordance + the C1d
// Playwright proof.
router.post("/settling-in/generate", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "settling_in_tasks")) {
      res.status(403).json({ error: "Pro required" });
      return;
    }
    const { data: plan, error: planErr } = await ctx.supabase
      .from("relocation_plans")
      .select("id, stage, arrival_date, profile_data, research_meta")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<{
        id: string;
        stage: string | null;
        arrival_date: string | null;
        profile_data: Record<string, unknown> | null;
        research_meta: { researchedSpecialists?: PostMoveResearchedCache } | null;
      }>();
    if (planErr || !plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    if (!isPostArrivalStage(plan.stage)) {
      res.status(409).json({
        error: `Settling-in tasks can only be generated after arrival (current stage: ${plan.stage}).`,
      });
      return;
    }
    const arrivalDate = plan.arrival_date
      ? new Date(plan.arrival_date)
      : new Date();
    const generation = await generateAndPersistSettlingInTasks({
      supabase: ctx.supabase,
      userId: ctx.user.id,
      planId: plan.id,
      profile: (plan.profile_data ?? {}) as SettlingInProfile,
      arrivalDate,
      researchMeta: plan.research_meta ?? null,
    });
    res.json({
      success: true,
      planId: plan.id,
      tasksGenerated: generation.count,
      legalRequirements: generation.legalCount,
      urgentDeadlines: generation.urgentCount,
    });
  } catch (err) {
    logger.error({ err }, "settling-in generate error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.all("/settling-in/:id/why-it-matters", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  res.status(503).json({
    error: "AI explanation requires the OpenAI worker. Part of follow-up task.",
  });
});

router.get("/settling-in/export-ical", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "compliance_calendar")) {
      res.status(403).json({ error: "Pro required" });
      return;
    }
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (!plan) {
      res.status(404).json({ error: "No plan found" });
      return;
    }
    const { data: tasks } = await ctx.supabase
      .from("settling_in_tasks")
      .select("id, title, description, deadline_at")
      .eq("plan_id", plan.id)
      .not("deadline_at", "is", null);

    const escape = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const toICalDate = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
    };
    const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GoMate//Compliance Calendar//EN"];
    for (const t of tasks || []) {
      if (!t.deadline_at) continue;
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${t.id}@gomate`);
      lines.push(`DTSTAMP:${toICalDate(new Date().toISOString())}`);
      lines.push(`DTSTART:${toICalDate(t.deadline_at)}`);
      lines.push(`DTEND:${toICalDate(new Date(new Date(t.deadline_at).getTime() + 60 * 60 * 1000).toISOString())}`);
      lines.push(`SUMMARY:${escape(t.title)}`);
      if (t.description) lines.push(`DESCRIPTION:${escape(t.description)}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="gomate-deadlines.ics"`);
    res.send(lines.join("\r\n"));
  } catch (err) {
    logger.error({ err }, "ical export error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
