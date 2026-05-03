import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { getUserTier, hasFeatureAccess } from "../lib/gomate/tier";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/documents", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "documents")) {
      res.status(403).json({ error: "Document checklist requires a paid plan" });
      return;
    }
    const { data: plan, error } = await ctx.supabase
      .from("relocation_plans")
      .select("id, document_statuses, checklist_items, local_requirements_research, profile_data")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
      return;
    }
    const lrr = (plan?.local_requirements_research ?? null) as
      | { documentsDetailed?: unknown; documentWarnings?: unknown }
      | null;
    res.json({
      planId: plan?.id || null,
      statuses: plan?.document_statuses || {},
      checklistItems: plan?.checklist_items || [],
      documentsDetailed: Array.isArray(lrr?.documentsDetailed) ? lrr!.documentsDetailed : [],
      documentWarnings: Array.isArray(lrr?.documentWarnings) ? lrr!.documentWarnings : [],
      profile: plan?.profile_data ?? {},
    });
  } catch (err) {
    logger.error({ err }, "documents get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/documents", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const body = req.body as {
      planId?: string;
      documentId?: string;
      status?: string;
      notes?: string;
      externalLink?: string;
      // Legacy alias accepted for backwards compatibility — older clients
      // sent `externalUrl`. Persisted shape is always `externalLink` to
      // match the canonical DocumentStatusEntry on the frontend.
      externalUrl?: string;
    };
    if (!body.planId || !body.documentId) {
      res.status(400).json({ error: "planId and documentId required" });
      return;
    }
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id, document_statuses")
      .eq("id", body.planId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    const statuses: Record<string, unknown> = { ...((plan.document_statuses as object) || {}) };
    const previous = (statuses[body.documentId] as Record<string, unknown> | undefined) ?? {};
    const externalLink = body.externalLink ?? body.externalUrl ?? (previous.externalLink as string | undefined) ?? null;
    statuses[body.documentId] = {
      ...previous,
      status: body.status,
      notes: body.notes ?? (previous.notes as string | null | undefined) ?? null,
      externalLink,
      updatedAt: new Date().toISOString(),
    };
    const { error: updateErr } = await ctx.supabase
      .from("relocation_plans")
      .update({ document_statuses: statuses, updated_at: new Date().toISOString() })
      .eq("id", body.planId)
      .eq("user_id", ctx.user.id);
    if (updateErr) {
      res.status(500).json({ error: "Failed to update" });
      return;
    }
    res.json({ success: true, statuses });
  } catch (err) {
    logger.error({ err }, "documents patch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
