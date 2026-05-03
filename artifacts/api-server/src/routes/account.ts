import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/account/export", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const [plans, guides, tasks, subscription, chatMessages] = await Promise.all([
      ctx.supabase
        .from("relocation_plans")
        .select("id, profile_data, stage, status, document_statuses, created_at, updated_at")
        .eq("user_id", ctx.user.id),
      ctx.supabase
        .from("guides")
        .select("id, plan_id, title, sections, created_at, updated_at")
        .eq("user_id", ctx.user.id),
      ctx.supabase
        .from("settling_in_tasks")
        .select("id, plan_id, title, status, category, deadline_at, created_at, updated_at")
        .eq("user_id", ctx.user.id),
      ctx.supabase
        .from("user_subscriptions")
        .select("tier, billing_cycle, status, started_at, expires_at")
        .eq("user_id", ctx.user.id)
        .maybeSingle(),
      ctx.supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("user_id", ctx.user.id)
        .order("created_at", { ascending: true }),
    ]);
    const exportData = {
      exported_at: new Date().toISOString(),
      account: { id: ctx.user.id, email: ctx.user.email },
      subscription: subscription.data ?? null,
      relocation_plans: plans.data ?? [],
      guides: guides.data ?? [],
      settling_in_tasks: tasks.data ?? [],
      chat_messages: chatMessages.data ?? [],
    };
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="gomate-export-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    logger.error({ err }, "account export error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/account/delete", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tables = [
      "chat_messages",
      "settling_in_tasks",
      "checklist_progress",
      "guides",
      "relocation_plans",
      "user_subscriptions",
    ];
    for (const t of tables) {
      const { error } = await ctx.supabase.from(t).delete().eq("user_id", ctx.user.id);
      if (error) {
        logger.error({ err: error, table: t }, "account delete table error");
      }
    }
    res.json({
      success: true,
      message:
        "Personal data removed. Auth account removal requires a service-role token; please contact support to fully delete the auth user.",
    });
  } catch (err) {
    logger.error({ err }, "account delete error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
