import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { getUserTier, canCreatePlan } from "../lib/gomate/tier";
import { hasMinimalProfileForResearch } from "../lib/gomate/core-state";
import {
  kickoffResearch,
  isRunInFlight,
} from "../lib/agents/research-orchestrator";
import type { Profile } from "../lib/gomate/profile-schema-snapshot";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/plans", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const { data: plans, error } = await ctx.supabase
      .from("relocation_plans")
      .select("id, title, status, is_current, stage, locked, profile_data, created_at, updated_at")
      .eq("user_id", ctx.user.id)
      .order("is_current", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      logger.error({ err: error }, "plans list error");
      res.status(500).json({ error: "Failed to fetch plans" });
      return;
    }
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    res.json({
      plans: (plans || []).map((p: any) => ({
        id: p.id,
        title: p.title || (p.profile_data?.destination ? `Move to ${p.profile_data.destination}` : "New Plan"),
        status: p.status,
        is_current: p.is_current,
        stage: p.stage,
        destination: p.profile_data?.destination || null,
        purpose: p.profile_data?.purpose || null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })),
      tier,
    });
  } catch (err) {
    logger.error({ err }, "plans get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/plans", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const planCheck = await canCreatePlan(ctx.supabase, ctx.user.id);
    if (!planCheck.allowed) {
      res.status(403).json({
        error: "Plan limit reached",
        message: `Your ${planCheck.tier} plan allows ${planCheck.limit} plan(s).`,
        ...planCheck,
      });
      return;
    }
    await ctx.supabase
      .from("relocation_plans")
      .update({ is_current: false })
      .eq("user_id", ctx.user.id);
    const { data: newPlan, error } = await ctx.supabase
      .from("relocation_plans")
      .insert({
        user_id: ctx.user.id,
        profile_data: {},
        stage: "collecting",
        is_current: true,
      })
      .select()
      .single();
    if (error) {
      logger.error({ err: error }, "plans create error");
      res.status(500).json({ error: "Failed to create plan" });
      return;
    }
    res.json({ plan: newPlan });
  } catch (err) {
    logger.error({ err }, "plans post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/plans", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const body = req.body as { planId?: string; action?: "switch" };
    if (!body.planId) {
      res.status(400).json({ error: "planId required" });
      return;
    }
    if (body.action === "switch") {
      await ctx.supabase
        .from("relocation_plans")
        .update({ is_current: false })
        .eq("user_id", ctx.user.id);
      const { error } = await ctx.supabase
        .from("relocation_plans")
        .update({ is_current: true })
        .eq("id", body.planId)
        .eq("user_id", ctx.user.id);
      if (error) {
        res.status(500).json({ error: "Failed to switch plan" });
        return;
      }
      res.json({ success: true, currentPlanId: body.planId });
      return;
    }
    res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    logger.error({ err }, "plans patch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * v2 Wave 1.3: collecting -> generating
 *
 * The user clicked "Generate my plan". This is the SOLE way past
 * `collecting` — profile completion alone does NOT advance the stage.
 * Records the click timestamp on `user_triggered_research_at` and bumps
 * `stage` to `generating` (the actual research worker is wired in a
 * later wave; this endpoint just opens the gate for it).
 *
 * Requires the profile to be structurally complete; otherwise 400.
 * Idempotent if the plan is already past `collecting` — re-clicking
 * resets the trigger timestamp but does not regress the stage.
 */
router.post("/plans/trigger-research", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const { data: plan, error: fetchErr } = await ctx.supabase
      .from("relocation_plans")
      .select(
        "id, stage, profile_data, user_triggered_research_at, user_triggered_pre_departure_at, research_status"
      )
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (fetchErr || !plan) {
      res.status(404).json({ error: "No active plan found" });
      return;
    }
    if (plan.stage === "arrived") {
      res.status(400).json({
        error: "Cannot trigger research after arrival",
        currentStage: plan.stage,
      });
      return;
    }
    // v2 Wave 1.3 spec: "isProfileComplete returns true AND user has
    // clicked". Defensive server-side check — the frontend disables
    // the button until the full schema's readiness flips, but a direct
    // API hit on an empty profile must be rejected.
    if (!hasMinimalProfileForResearch(plan.profile_data)) {
      res.status(400).json({
        error:
          "Profile is missing required core fields (name, citizenship, current_location, destination, purpose). Complete the profile before triggering research.",
        currentStage: plan.stage,
      });
      return;
    }
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      user_triggered_research_at: now,
      // The Generate-my-plan click is the canonical lock moment.
      // Until this point, the chat route only flips
      // onboarding_completed=true; the plan stays unlocked so the
      // user can still amend earlier answers. Once they press
      // Generate, lock so the post-onboarding free-chat surface
      // takes over and answers are immutable for downstream
      // research.
      locked: true,
      updated_at: now,
    };
    if (plan.stage === "collecting" || !plan.stage) {
      updates.stage = "generating";
    }
    const alreadyRunning = isRunInFlight(plan.id);
    if (!alreadyRunning) {
      updates.research_status = "in_progress";
    }
    const { error: updErr } = await ctx.supabase
      .from("relocation_plans")
      .update(updates)
      .eq("id", plan.id)
      .eq("user_id", ctx.user.id);
    if (updErr) {
      logger.error({ err: updErr }, "trigger-research update failed");
      res.status(500).json({ error: "Failed to record research trigger" });
      return;
    }
    let kickoffResult: ReturnType<typeof kickoffResearch> | null = null;
    if (!alreadyRunning) {
      const profile = (plan.profile_data ?? {}) as Profile;
      kickoffResult = kickoffResearch({
        profileId: plan.id,
        planId: plan.id,
        profile,
        supabase: ctx.supabase,
      });
    }
    res.json({
      success: true,
      planId: plan.id,
      stage: updates.stage || plan.stage,
      user_triggered_research_at: now,
      researchStarted: !alreadyRunning,
      alreadyRunning,
      dispatch: kickoffResult
        ? {
            specialists: kickoffResult.snapshot.rationale.map((r) => ({
              name: r.specialist,
            })),
            rationale: kickoffResult.snapshot.rationale,
          }
        : null,
    });
  } catch (err) {
    logger.error({ err }, "trigger-research error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * v2 Wave 1.3: ready_for_pre_departure -> pre_departure
 *
 * The user clicked "Generate my pre-departure checklist". This is the
 * SOLE way past `ready_for_pre_departure` — research completion alone
 * does NOT advance the stage. Records the click timestamp and bumps
 * `stage` to `pre_departure`.
 *
 * Requires the plan to be at `ready_for_pre_departure` or the v1
 * backward-compat `complete` stage.
 */
router.post("/plans/trigger-pre-departure", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const { data: plan, error: fetchErr } = await ctx.supabase
      .from("relocation_plans")
      .select("id, stage, user_triggered_pre_departure_at, research_status")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (fetchErr || !plan) {
      res.status(404).json({ error: "No active plan found" });
      return;
    }
    const allowedSourceStages = new Set([
      "complete",
      "ready_for_pre_departure",
      "pre_departure",
    ]);
    if (!allowedSourceStages.has(plan.stage as string)) {
      res.status(400).json({
        error:
          "Pre-departure can only be triggered after the plan is generated and ready",
        currentStage: plan.stage,
      });
      return;
    }
    const now = new Date().toISOString();
    const { error: updErr } = await ctx.supabase
      .from("relocation_plans")
      .update({
        user_triggered_pre_departure_at: now,
        stage: "pre_departure",
        updated_at: now,
      })
      .eq("id", plan.id)
      .eq("user_id", ctx.user.id);
    if (updErr) {
      logger.error({ err: updErr }, "trigger-pre-departure update failed");
      res.status(500).json({ error: "Failed to record pre-departure trigger" });
      return;
    }
    res.json({
      success: true,
      planId: plan.id,
      stage: "pre_departure",
      user_triggered_pre_departure_at: now,
    });
  } catch (err) {
    logger.error({ err }, "trigger-pre-departure error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/plans", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const planId = req.query.planId as string;
    if (!planId) {
      res.status(400).json({ error: "planId required" });
      return;
    }
    const { error } = await ctx.supabase
      .from("relocation_plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", ctx.user.id);
    if (error) {
      res.status(500).json({ error: "Failed to delete plan" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "plans delete error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
