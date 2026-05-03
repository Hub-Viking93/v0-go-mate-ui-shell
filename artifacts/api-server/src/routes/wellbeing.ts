import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { getUserTier, hasFeatureAccess } from "../lib/gomate/tier";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const VALID_MOODS = new Set(["great", "good", "okay", "struggling", "overwhelmed"]);
const MOOD_MESSAGES: Record<string, string> = {
  great: "That's wonderful to hear! Keep the momentum going.",
  good: "Glad things are going well. You're making great progress.",
  okay: "Settling in takes time — you're doing better than you think.",
  struggling: "It's completely normal to have hard days. You're not alone in this.",
  overwhelmed: "Moving abroad is one of life's biggest changes. Please be kind to yourself.",
};

router.get("/wellbeing", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id, wellbeing_checkins, stage")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    res.json({
      checkins: plan?.wellbeing_checkins || [],
      stage: plan?.stage || null,
      planId: plan?.id || null,
    });
  } catch (err) {
    logger.error({ err }, "wellbeing get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/wellbeing", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "wellbeing_checkins")) {
      res.status(403).json({ error: "Wellbeing check-ins require Pro" });
      return;
    }
    const body = req.body as { mood?: string; note?: string };
    if (!body.mood || !VALID_MOODS.has(body.mood)) {
      res.status(400).json({ error: "Invalid mood" });
      return;
    }
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id, wellbeing_checkins, stage")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    const checkins = Array.isArray(plan.wellbeing_checkins) ? plan.wellbeing_checkins : [];
    const newCheckin = {
      mood: body.mood,
      note: body.note ?? null,
      created_at: new Date().toISOString(),
    };
    const { error: updErr } = await ctx.supabase
      .from("relocation_plans")
      .update({
        wellbeing_checkins: [...checkins, newCheckin],
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id)
      .eq("user_id", ctx.user.id);
    if (updErr) {
      res.status(500).json({ error: "Failed to save check-in" });
      return;
    }
    res.json({ success: true, message: MOOD_MESSAGES[body.mood], checkin: newCheckin });
  } catch (err) {
    logger.error({ err }, "wellbeing post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
