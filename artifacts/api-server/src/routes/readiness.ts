// =============================================================
// Phase 3A — readiness API
// =============================================================
//   GET /api/readiness     — derived readiness report for the active plan
//
// All derivation lives in @workspace/agents/src/readiness.ts. This route
// is the glue that gathers state from:
//
//   • relocation_plans            — profile_data, visa_research, stage,
//                                   arrival_date
//   • settling_in_tasks           — count, status, walkthrough.required
//   • research_meta.preDeparture  — pre-move actions + their walkthrough
//   • relocation_documents        — distinct categories in the vault
//
// It then bundles those into a ReadinessInputs and calls deriveReadiness().
// =============================================================

import { Router, type IRouter } from "express";
import {
  deriveReadiness,
  detectFreeMovement,
  computeUrgency,
  type DocumentCategory,
  type ReadinessInputs,
  type ReadinessVaultInputs,
  type ReadinessTaskInputs,
} from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface SettlingTaskRow {
  id: string;
  status: string;
  deadline_at: string | null;
  walkthrough: {
    requiredDocumentCategories?: DocumentCategory[];
  } | null;
}

interface PreDepartureActionStored {
  id: string;
  status: string;
  deadlineIso?: string;
  walkthrough?: {
    requiredDocumentCategories?: DocumentCategory[];
  };
}

interface ResearchMeta {
  preDeparture?: {
    actions?: PreDepartureActionStored[];
  };
}

interface PlanRow {
  id: string;
  stage: string | null;
  arrival_date: string | null;
  profile_data: Record<string, unknown> | null;
  visa_research: {
    visaOptions?: unknown[];
  } | null;
  /**
   * Selected pathway + application status live on visa_application,
   * NOT visa_research. /api/visa-tracker writes here via PUT.
   */
  visa_application: {
    selectedVisaType?: string | null;
    applicationStatus?: string | null;
  } | null;
  research_meta: ResearchMeta | null;
}

router.get("/readiness", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const { data: plan, error: planErr } = await ctx.supabase
      .from("relocation_plans")
      .select(
        "id, stage, arrival_date, profile_data, visa_research, visa_application, research_meta",
      )
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<PlanRow>();
    if (planErr) {
      logger.error({ err: planErr }, "readiness GET: plan load failed");
      res.status(500).json({ error: "Failed to load plan" });
      return;
    }
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    // Settling-in rows for this plan
    const { data: settlingRows } = await ctx.supabase
      .from("settling_in_tasks")
      .select("id, status, deadline_at, walkthrough")
      .eq("plan_id", plan.id)
      .eq("user_id", ctx.user.id);

    // Vault — distinct categories + total count
    const { data: vaultRows } = await ctx.supabase
      .from("relocation_documents")
      .select("category")
      .eq("user_id", ctx.user.id);

    const profile = (plan.profile_data ?? {}) as Record<string, unknown>;
    const visaResearch = plan.visa_research ?? null;
    const visaApplication = plan.visa_application ?? null;
    const preDepartureActions = plan.research_meta?.preDeparture?.actions ?? [];

    // ---- Derive task aggregates ------------------------------------------

    const now = new Date();
    const settling = (settlingRows ?? []) as SettlingTaskRow[];
    const settlingTotal = settling.length;
    const settlingCompleted = settling.filter((t) => t.status === "completed").length;
    const settlingOverdue = settling.filter((t) => {
      if (t.status === "completed" || t.status === "skipped") return false;
      if (!t.deadline_at) return false;
      return computeUrgency(new Date(t.deadline_at), now) === "overdue";
    }).length;

    const preMoveActions = (preDepartureActions ?? []) as PreDepartureActionStored[];
    const preMoveTotal = preMoveActions.length;
    const preMoveCompleted = preMoveActions.filter((a) => a.status === "complete").length;
    const preMoveOverdue = preMoveActions.filter((a) => {
      if (a.status === "complete" || a.status === "skipped") return false;
      if (!a.deadlineIso) return false;
      return computeUrgency(new Date(a.deadlineIso), now) === "overdue";
    }).length;

    // Required categories across OPEN tasks (settling + pre-move)
    const openSettling = settling.filter(
      (t) => t.status !== "completed" && t.status !== "skipped",
    );
    const openPreMove = preMoveActions.filter(
      (a) => a.status !== "complete" && a.status !== "skipped",
    );
    const requiredSet = new Set<DocumentCategory>();
    for (const t of openSettling) {
      const cats = t.walkthrough?.requiredDocumentCategories ?? [];
      for (const c of cats) requiredSet.add(c);
    }
    for (const a of openPreMove) {
      const cats = a.walkthrough?.requiredDocumentCategories ?? [];
      for (const c of cats) requiredSet.add(c);
    }

    const tasks: ReadinessTaskInputs = {
      settlingTotal,
      settlingCompleted,
      settlingOverdue,
      preMoveTotal,
      preMoveCompleted,
      preMoveOverdue,
      requiredCategoriesAcrossOpenTasks: Array.from(requiredSet),
    };

    // ---- Vault aggregates ------------------------------------------------

    const vaultCategoriesSet = new Set<DocumentCategory>();
    for (const row of vaultRows ?? []) {
      const c = (row as { category?: string }).category;
      if (typeof c === "string") vaultCategoriesSet.add(c as DocumentCategory);
    }
    const vault: ReadinessVaultInputs = {
      coveredCategories: Array.from(vaultCategoriesSet),
      totalDocs: (vaultRows ?? []).length,
    };

    // ---- Visa state ------------------------------------------------------

    const hasResearch = Boolean(
      visaResearch && Array.isArray(visaResearch.visaOptions) && visaResearch.visaOptions.length > 0,
    );
    const pathwaySelected = Boolean(visaApplication?.selectedVisaType);
    const isFreeMovement = detectFreeMovement(
      typeof profile.citizenship === "string" ? profile.citizenship : null,
      typeof profile.destination === "string" ? profile.destination : null,
    );

    const inputs: ReadinessInputs = {
      profile: {
        destination: typeof profile.destination === "string" ? profile.destination : null,
        citizenship: typeof profile.citizenship === "string" ? profile.citizenship : null,
        purpose: typeof profile.purpose === "string" ? profile.purpose : null,
        visa_role: typeof profile.visa_role === "string" ? profile.visa_role : null,
        savings_available: (profile.savings_available as number | string | null) ?? null,
        // Canonical field name is `monthly_budget`; aliases checked for legacy rows.
        monthly_budget:
          (profile.monthly_budget as number | string | null | undefined) ??
          (profile.target_monthly_budget as number | string | null | undefined) ??
          null,
        preferred_currency:
          typeof profile.preferred_currency === "string" ? profile.preferred_currency : null,
        arrival_date: plan.arrival_date,
        timeline: typeof profile.timeline === "string" ? profile.timeline : null,
      },
      visa: {
        hasResearch,
        pathwaySelected,
        isFreeMovement,
        applicationStatus: visaApplication?.applicationStatus ?? null,
      },
      vault,
      tasks,
      stage: plan.stage,
    };

    const report = deriveReadiness(inputs);
    res.json({ planId: plan.id, ...report });
  } catch (err) {
    logger.error({ err }, "readiness GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
