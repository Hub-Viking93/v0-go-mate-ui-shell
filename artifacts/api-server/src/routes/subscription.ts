import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import {
  ensureSubscription,
  canCreatePlan,
  hasFeatureAccess,
  getEffectiveTier,
  PRICING,
  type Feature,
} from "../lib/gomate/tier";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/subscription", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const subscription = await ensureSubscription(ctx.supabase, ctx.user.id);
    if (!subscription) {
      res.status(500).json({ error: "Failed to load subscription" });
      return;
    }
    const planStatus = await canCreatePlan(ctx.supabase, ctx.user.id);
    const effectiveTier = getEffectiveTier(subscription);

    const featureList: Feature[] = [
      "chat", "visa_recommendation", "local_requirements", "cost_of_living",
      "budget_planner", "affordability_analysis", "guides", "documents",
      "pre_move_timeline", "plan_consistency", "tax_overview", "chat_history",
      "plan_switcher", "post_relocation", "settling_in_tasks", "compliance_alerts",
      "compliance_calendar", "post_arrival_assistant", "visa_tracker",
      "banking_wizard", "tax_registration", "wellbeing_checkins",
    ];
    const features: Record<string, boolean> = {};
    for (const f of featureList) features[f] = hasFeatureAccess(effectiveTier, f);

    res.json({
      subscription: { ...subscription, tier: effectiveTier },
      plans: { current: planStatus.current, limit: planStatus.limit, canCreate: planStatus.allowed },
      features,
      pricing: PRICING,
    });
  } catch (err) {
    logger.error({ err }, "subscription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
