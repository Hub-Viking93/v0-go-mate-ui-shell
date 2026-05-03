import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { getUserTier, hasFeatureAccess } from "../lib/gomate/tier";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/progress", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const planId = req.query.plan_id as string;
    let pid = planId;
    if (!pid) {
      const { data: plan } = await ctx.supabase
        .from("relocation_plans")
        .select("id")
        .eq("user_id", ctx.user.id)
        .eq("is_current", true)
        .maybeSingle();
      pid = plan?.id;
    }
    if (!pid) {
      res.json({ items: [] });
      return;
    }
    const { data: items, error } = await ctx.supabase
      .from("checklist_progress")
      .select("item_id, completed, completed_at")
      .eq("plan_id", pid)
      .eq("user_id", ctx.user.id);
    if (error) {
      res.status(500).json({ error: "Failed to fetch progress" });
      return;
    }
    res.json({ items: items || [] });
  } catch (err) {
    logger.error({ err }, "progress get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/progress", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "settling_in_tasks") && !hasFeatureAccess(tier, "pre_move_timeline")) {
      res.status(403).json({ error: "Upgrade required" });
      return;
    }
    const { planId, itemId, completed } = req.body as {
      planId?: string;
      itemId?: string;
      completed?: boolean;
    };
    if (!planId || !itemId || typeof completed !== "boolean") {
      res.status(400).json({ error: "planId, itemId, completed required" });
      return;
    }
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id")
      .eq("id", planId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    const { error: upsertErr } = await ctx.supabase
      .from("checklist_progress")
      .upsert(
        {
          user_id: ctx.user.id,
          plan_id: planId,
          item_id: itemId,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,plan_id,item_id" },
      );
    if (upsertErr) {
      logger.error({ err: upsertErr }, "progress upsert error");
      res.status(500).json({ error: "Failed to update progress" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "progress patch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
