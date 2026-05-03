/**
 * Research routes — Wave 2.x Prompt 3.5 + per-card endpoints.
 *
 *   POST /api/research/trigger             — fire-and-forget kickoff (202).
 *   POST /api/research/visa                — kickoff + wait, returns plan.visa_research.
 *   POST /api/research/local-requirements  — kickoff + wait, returns plan.local_requirements_research.
 *
 * The two per-card endpoints are thin wrappers around the same
 * pipeline as /trigger — every specialist runs once and the cards
 * read different slices of the persisted result. This means clicking
 * "Research my visa options" on one card and "Research local
 * requirements" on the other does NOT run the pipeline twice (the
 * orchestrator is idempotent via in-flight check); the second call
 * joins the in-flight run.
 *
 * Pre-conditions enforced here:
 *   1. Caller is authenticated (Supabase JWT).
 *   2. Plan exists for caller (matched by id when provided, else current).
 *   3. `researchEligible(plan)` (any stage except `arrived`).
 *
 * The /visa and /local-requirements endpoints AUTO-SET
 * `user_triggered_research_at` if missing (the user clicking the card
 * button is a clear opt-in). /trigger keeps the strict gate it had.
 */

import { Router, type IRouter } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticate } from "../lib/supabase-auth";
import { researchEligible } from "../lib/gomate/core-state";
import {
  kickoffResearch,
  isRunInFlight,
  getRunState,
} from "../lib/agents/research-orchestrator";
import { decideDispatch } from "../lib/agents/coordinator";
import type { Profile } from "../lib/gomate/profile-schema-snapshot";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Shared plan lookup
// ---------------------------------------------------------------------------

interface PlanRow {
  id: string;
  stage: string | null;
  locked: boolean | null;
  profile_data: Record<string, unknown> | null;
  research_status: string | null;
  user_triggered_research_at: string | null;
  user_triggered_pre_departure_at: string | null;
  arrival_date: string | null;
  visa_research: unknown;
  local_requirements_research: unknown;
}

async function fetchPlan(
  supabase: SupabaseClient,
  userId: string,
  planId: string | undefined,
): Promise<PlanRow | null> {
  let q = supabase
    .from("relocation_plans")
    .select(
      "id, stage, locked, profile_data, research_status, user_triggered_research_at, user_triggered_pre_departure_at, arrival_date, visa_research, local_requirements_research",
    )
    .eq("user_id", userId);
  if (planId) q = q.eq("id", planId);
  else q = q.eq("is_current", true);
  const { data } = await q.maybeSingle();
  return (data as PlanRow | null) ?? null;
}

async function ensureTriggerTimestamp(
  supabase: SupabaseClient,
  plan: PlanRow,
): Promise<void> {
  if (plan.user_triggered_research_at) return;
  const now = new Date().toISOString();
  await supabase
    .from("relocation_plans")
    .update({ user_triggered_research_at: now, updated_at: now })
    .eq("id", plan.id);
  plan.user_triggered_research_at = now;
}

async function setStatusInProgress(
  supabase: SupabaseClient,
  planId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("relocation_plans")
    .update({ research_status: "in_progress", updated_at: now })
    .eq("id", planId);
  if (error) {
    logger.warn(
      { err: error, planId },
      "[research] failed to set research_status=in_progress",
    );
  }
}

// ---------------------------------------------------------------------------
// POST /research/trigger — original async endpoint (returns 202)
// ---------------------------------------------------------------------------

router.post("/research/trigger", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;

    const plan = await fetchPlan(ctx.supabase, ctx.user.id, undefined);
    if (!plan) {
      res.status(404).json({ error: "No active plan found" });
      return;
    }

    if (!plan.user_triggered_research_at) {
      res.status(400).json({
        error:
          "Click 'Generate my plan' first. Research is never auto-triggered — call POST /api/plans/trigger-research to set the user-trigger timestamp.",
      });
      return;
    }

    if (!researchEligible(plan)) {
      res.status(400).json({
        error: "Research cannot be re-run after arrival",
        currentStage: plan.stage,
      });
      return;
    }

    const profile = (plan.profile_data ?? {}) as Profile;
    const profileId = plan.id;

    if (isRunInFlight(profileId)) {
      const snap = getRunState(profileId);
      const dispatch = snap
        ? { specialists: Object.values(snap.agents).map((a) => ({ name: a.name })), rationale: snap.rationale }
        : decideDispatch(profile);
      res.status(202).json({
        profileId,
        alreadyRunning: true,
        dispatch,
      });
      return;
    }

    await setStatusInProgress(ctx.supabase, profileId);

    const result = kickoffResearch({
      profileId,
      planId: profileId,
      profile,
      supabase: ctx.supabase,
    });

    res.status(202).json({
      profileId,
      alreadyRunning: result.alreadyRunning,
      dispatch: {
        specialists: result.snapshot.rationale.map((r) => ({ name: r.specialist })),
        rationale: result.snapshot.rationale,
      },
    });
  } catch (err) {
    logger.error({ err }, "[research/trigger] unhandled error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Per-card synchronous endpoints — kickoff (or join) + await + return
// ---------------------------------------------------------------------------

const PER_CARD_TIMEOUT_MS = 300_000; // 5 min ceiling on the await.

async function runAndWait(
  supabase: SupabaseClient,
  plan: PlanRow,
): Promise<void> {
  const profile = (plan.profile_data ?? {}) as Profile;
  const profileId = plan.id;

  if (isRunInFlight(profileId)) {
    // Join the in-flight run by polling its terminal state.
    await waitForTerminal(profileId);
    return;
  }

  await setStatusInProgress(supabase, profileId);

  const result = kickoffResearch({
    profileId,
    planId: profileId,
    profile,
    supabase,
  });

  await Promise.race([
    result.runPromise,
    new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error("Research pipeline exceeded 5-minute timeout")),
        PER_CARD_TIMEOUT_MS,
      ),
    ),
  ]);
}

async function waitForTerminal(profileId: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < PER_CARD_TIMEOUT_MS) {
    const snap = getRunState(profileId);
    if (
      snap &&
      (snap.runStatus === "completed" ||
        snap.runStatus === "partial" ||
        snap.runStatus === "failed")
    ) {
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Joined-run wait exceeded 5-minute timeout");
}

async function reloadColumn(
  supabase: SupabaseClient,
  planId: string,
  column: "visa_research" | "local_requirements_research",
): Promise<unknown> {
  const { data } = await supabase
    .from("relocation_plans")
    .select(`${column}, research_status, research_completed_at`)
    .eq("id", planId)
    .maybeSingle();
  return data ?? null;
}

router.post("/research/visa", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const planIdInput =
      typeof req.body?.planId === "string" ? req.body.planId : undefined;

    const plan = await fetchPlan(ctx.supabase, ctx.user.id, planIdInput);
    if (!plan) {
      res.status(404).json({ error: "No relocation plan found" });
      return;
    }
    if (!researchEligible(plan)) {
      res.status(400).json({
        error: "Research cannot be re-run after arrival",
        currentStage: plan.stage,
      });
      return;
    }

    await ensureTriggerTimestamp(ctx.supabase, plan);

    try {
      await runAndWait(ctx.supabase, plan);
    } catch (err) {
      logger.error({ err, planId: plan.id }, "[research/visa] pipeline failed");
      res.status(504).json({
        error: err instanceof Error ? err.message : "Research pipeline failed",
      });
      return;
    }

    const reloaded = await reloadColumn(ctx.supabase, plan.id, "visa_research") as
      | (PlanRow & { visa_research: unknown })
      | null;
    const research = reloaded?.visa_research ?? null;
    if (!research) {
      res.status(502).json({
        error:
          "Research pipeline completed but no visa research was produced. Check that the visa specialist ran for this profile.",
      });
      return;
    }
    res.json({ research });
  } catch (err) {
    logger.error({ err }, "[research/visa] unhandled error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/research/local-requirements", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const planIdInput =
      typeof req.body?.planId === "string" ? req.body.planId : undefined;

    const plan = await fetchPlan(ctx.supabase, ctx.user.id, planIdInput);
    if (!plan) {
      res.status(404).json({ error: "No relocation plan found" });
      return;
    }
    if (!researchEligible(plan)) {
      res.status(400).json({
        error: "Research cannot be re-run after arrival",
        currentStage: plan.stage,
      });
      return;
    }

    await ensureTriggerTimestamp(ctx.supabase, plan);

    try {
      await runAndWait(ctx.supabase, plan);
    } catch (err) {
      logger.error(
        { err, planId: plan.id },
        "[research/local-requirements] pipeline failed",
      );
      res.status(504).json({
        error: err instanceof Error ? err.message : "Research pipeline failed",
      });
      return;
    }

    const reloaded = (await reloadColumn(
      ctx.supabase,
      plan.id,
      "local_requirements_research",
    )) as (PlanRow & { local_requirements_research: unknown }) | null;
    const research = reloaded?.local_requirements_research ?? null;
    if (!research) {
      res.status(502).json({
        error:
          "Research pipeline completed but no local-requirements data was produced.",
      });
      return;
    }
    res.json({ research });
  } catch (err) {
    logger.error({ err }, "[research/local-requirements] unhandled error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET / POST /api/research/tax — adapter endpoint.
 *
 * The frontend Tax-Overview-Card was written before the multi-agent
 * research pipeline existed and expects a dedicated `tax_research`
 * payload. We don't have a separate tax endpoint anymore — the tax
 * data is produced by the Tax Strategist + Departure Tax specialists
 * during the main research run and persisted to
 * `relocation_plans.research_meta.specialists.{tax_strategist|departure_tax_specialist}`.
 *
 * Both GET and POST resolve to the same logic: read the latest
 * specialist outputs and shape them into the legacy TaxResearchResult
 * the card expects. POST does NOT re-run research (that's a 5-min,
 * 13-specialist job — wrong button to expose); it just returns the
 * already-cached output. The button label "Research tax data" is
 * effectively a "show me" trigger.
 */
async function handleTaxRequest(req: import("express").Request, res: import("express").Response): Promise<void> {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const planIdInput = (typeof req.query?.planId === "string" ? req.query.planId : undefined)
      ?? (typeof req.body?.planId === "string" ? req.body.planId : undefined);
    const plan = await fetchPlan(ctx.supabase, ctx.user.id, planIdInput);
    if (!plan) {
      res.status(404).json({ error: "No relocation plan found" });
      return;
    }
    const meta = (plan as PlanRow & { research_meta?: { specialists?: Record<string, { contentParagraphs?: string[]; citations?: Array<{ url: string; label?: string }>; domainSpecificData?: Record<string, unknown> }> } }).research_meta;
    const tax = meta?.specialists?.tax_strategist;
    const dep = meta?.specialists?.departure_tax_specialist;
    if (!tax && !dep) {
      res.json({ research: null, message: "No tax research yet — run the full research pipeline first." });
      return;
    }
    const research = {
      summary: (tax?.contentParagraphs ?? []).slice(0, 2).join("\n\n") || (dep?.contentParagraphs ?? []).slice(0, 2).join("\n\n"),
      paragraphs: [...(tax?.contentParagraphs ?? []), ...(dep?.contentParagraphs ?? [])],
      taxStrategist: tax?.domainSpecificData ?? null,
      departureTax: dep?.domainSpecificData ?? null,
      citations: [...(tax?.citations ?? []), ...(dep?.citations ?? [])],
    };
    res.json({ research });
  } catch (err) {
    logger.error({ err }, "[research/tax] unhandled error");
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/research/tax", handleTaxRequest);
router.post("/research/tax", handleTaxRequest);

export default router;
