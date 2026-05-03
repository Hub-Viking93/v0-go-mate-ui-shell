import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { getUserTier, hasFeatureAccess } from "../lib/gomate/tier";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/checklist-progress", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "pre_move_timeline")) {
      res.status(403).json({ error: "Pre-move timeline requires a paid plan" });
      return;
    }
    const planId = req.query.plan_id as string;
    if (!planId) {
      res.status(400).json({ error: "plan_id required" });
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
    let q = ctx.supabase
      .from("checklist_progress")
      .select("item_id, completed, completed_at")
      .eq("plan_id", planId)
      .eq("user_id", ctx.user.id);
    const prefix = req.query.prefix as string | undefined;
    if (prefix) q = q.like("item_id", `${prefix}%`);
    const { data: items, error } = await q;
    if (error) {
      res.status(500).json({ error: "Failed to fetch progress" });
      return;
    }
    res.json({ items: items || [] });
  } catch (err) {
    logger.error({ err }, "checklist-progress error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
