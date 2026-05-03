import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { getUserTier, hasFeatureAccess } from "../lib/gomate/tier";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/visa-tracker", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "visa_tracker")) {
      res.status(403).json({ error: "Upgrade required" });
      return;
    }
    const { data: plan, error } = await ctx.supabase
      .from("relocation_plans")
      .select("id, visa_application, visa_research, profile_data, local_requirements_research, document_statuses")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (error) {
      logger.error({ err: error, userId: ctx.user.id }, "visa-tracker fetch query failed");
      res.status(500).json({ error: "Failed to fetch visa tracker", detail: error.message });
      return;
    }
    const emptyApplication = {
      selectedVisaType: null,
      applicationStatus: null,
      submittedAt: null,
      expectedDecisionAt: null,
      approvedAt: null,
      visaStartDate: null,
      visaExpiryDate: null,
      notes: null,
    };
    if (!plan) {
      res.json({
        planId: null,
        visaApplication: emptyApplication,
        visaResearch: null,
        visaDocuments: [],
        documentStatuses: {},
        estimatedDeadline: null,
        targetDate: null,
        renewalMilestones: null,
      });
      return;
    }
    const profile = (plan.profile_data ?? {}) as Record<string, unknown>;
    const targetDate =
      typeof profile["target_arrival_date"] === "string"
        ? (profile["target_arrival_date"] as string)
        : null;
    const postingOrSecondment =
      typeof profile["posting_or_secondment"] === "string"
        ? (profile["posting_or_secondment"] as string)
        : null;
    const purpose =
      typeof profile["purpose"] === "string" ? (profile["purpose"] as string) : null;

    // Derive visa-relevant documents from the persisted documents specialist
    // output. Visa appointments need: personal IDs, family papers (if sambo /
    // dependent), school records (if children), work papers (if work visa),
    // and posted-worker compliance. Pet/vehicle/departure_side are excluded
    // — they belong on the Checklist Documents tab, not the visa workspace.
    const VISA_RELEVANT_DOMAINS = new Set([
      "personal", "family", "school", "work", "posted_worker",
    ]);
    const lrr = (plan.local_requirements_research ?? null) as
      | { documentsDetailed?: Array<Record<string, unknown>> }
      | null;
    const detailed = Array.isArray(lrr?.documentsDetailed) ? lrr!.documentsDetailed! : [];
    const visaDocuments = detailed
      .filter((d) => VISA_RELEVANT_DOMAINS.has(String(d["domain"] ?? "")))
      .map((d) => {
        const phase = String(d["phase"] ?? "before_move");
        return {
          id: String(d["id"] ?? ""),
          document: String(d["name"] ?? ""),
          priority: phase === "before_move" || phase === "visa_appointment" ? "high" : "medium",
          required: true,
          category: String(d["domain"] ?? "personal"),
        };
      })
      .filter((d) => d.id && d.document);

    res.json({
      planId: plan.id,
      visaApplication: { ...emptyApplication, ...(plan.visa_application as object | null ?? {}) },
      visaResearch: (plan.visa_research as object | null) ?? null,
      visaDocuments,
      documentStatuses: (plan.document_statuses as Record<string, unknown> | null) ?? {},
      estimatedDeadline: null,
      targetDate,
      renewalMilestones: null,
      postingOrSecondment,
      purpose,
    });
  } catch (err) {
    logger.error({ err }, "visa-tracker get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/visa-tracker", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "visa_tracker")) {
      res.status(403).json({ error: "Upgrade required" });
      return;
    }
    const body = req.body as { planId?: string; application?: Record<string, unknown> };
    if (!body.planId || !body.application) {
      res.status(400).json({ error: "planId and application required" });
      return;
    }
    const { error: updErr } = await ctx.supabase
      .from("relocation_plans")
      .update({ visa_application: body.application, updated_at: new Date().toISOString() })
      .eq("id", body.planId)
      .eq("user_id", ctx.user.id);
    if (updErr) {
      res.status(500).json({ error: "Failed to update visa tracker" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "visa-tracker patch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
