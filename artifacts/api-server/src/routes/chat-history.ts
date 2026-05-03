import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { getUserTier, hasFeatureAccess } from "../lib/gomate/tier";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/chat/history", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "chat_history")) {
      res.status(403).json({ error: "Chat history requires a paid plan" });
      return;
    }
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (!plan) {
      res.json({ messages: [], planId: null });
      return;
    }
    const { data: messages, error } = await ctx.supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) {
      logger.error({ err: error }, "chat history fetch error");
      res.status(500).json({ error: "Failed to fetch chat history" });
      return;
    }
    res.json({
      messages: (messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
      planId: plan.id,
    });
  } catch (err) {
    logger.error({ err }, "chat history error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
