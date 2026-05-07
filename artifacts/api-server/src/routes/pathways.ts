// =============================================================
// Phase 3C — pathway plan + Plan B + scenario guidance API
// =============================================================
//   GET /api/pathways  — derived pathway plan for the active plan
//
// Glue route: gathers state from `relocation_plans` + `relocation_documents`
// + `settling_in_tasks` + `research_meta.preDeparture`, builds a
// PathwayInputs snapshot, calls `derivePathwayPlan()` and returns the
// structured plan.
// =============================================================

import { Router, type IRouter } from "express";
import {
  derivePathwayPlan,
  detectFreeMovement,
  computeUrgency,
  type DocumentCategory,
  type PathwayInputs,
} from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface PreDepartureActionStored {
  id: string;
  status: string;
  deadlineIso?: string;
}

interface ResearchMeta {
  preDeparture?: { actions?: PreDepartureActionStored[] };
}

interface PlanRow {
  id: string;
  stage: string | null;
  arrival_date: string | null;
  profile_data: Record<string, unknown> | null;
  visa_research: { visaOptions?: unknown[] } | null;
  visa_application: {
    selectedVisaType?: string | null;
    applicationStatus?: string | null;
  } | null;
  research_meta: ResearchMeta | null;
}

router.get("/pathways", async (req, res) => {
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
      logger.error({ err: planErr }, "pathways GET: plan load failed");
      res.status(500).json({ error: "Failed to load plan" });
      return;
    }
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    // Settling-in counts (open + overdue).
    const { data: settlingRows } = await ctx.supabase
      .from("settling_in_tasks")
      .select("status, deadline_at")
      .eq("plan_id", plan.id)
      .eq("user_id", ctx.user.id);
    const now = new Date();
    const openSettling = (settlingRows ?? []).filter(
      (t) => t.status !== "completed" && t.status !== "skipped",
    );
    const overdueSettling = openSettling.filter((t) => {
      if (!t.deadline_at) return false;
      return computeUrgency(new Date(t.deadline_at), now) === "overdue";
    });

    const preMoveActions = (plan.research_meta?.preDeparture?.actions ?? []) as PreDepartureActionStored[];
    const overduePreMove = preMoveActions.filter((a) => {
      if (a.status === "complete" || a.status === "skipped") return false;
      if (!a.deadlineIso) return false;
      return computeUrgency(new Date(a.deadlineIso), now) === "overdue";
    });

    // Vault — distinct categories + total count.
    const { data: vaultRows } = await ctx.supabase
      .from("relocation_documents")
      .select("category")
      .eq("user_id", ctx.user.id);
    const vaultCatsSet = new Set<DocumentCategory>();
    for (const r of vaultRows ?? []) {
      const c = (r as { category?: string }).category;
      if (typeof c === "string") vaultCatsSet.add(c as DocumentCategory);
    }

    const profile = (plan.profile_data ?? {}) as Record<string, unknown>;

    const inputs: PathwayInputs = {
      profile: {
        destination: typeof profile.destination === "string" ? profile.destination : null,
        citizenship: typeof profile.citizenship === "string" ? profile.citizenship : null,
        purpose: typeof profile.purpose === "string" ? profile.purpose : null,
        visa_role: typeof profile.visa_role === "string" ? profile.visa_role : null,
        posting_or_secondment:
          typeof profile.posting_or_secondment === "string" ? profile.posting_or_secondment : null,
        admission_status:
          typeof profile.admission_status === "string" ? profile.admission_status : null,
        employer_sponsorship:
          typeof profile.employer_sponsorship === "string" ? profile.employer_sponsorship : null,
        has_employer_sponsor:
          typeof profile.has_employer_sponsor === "string" ? profile.has_employer_sponsor : null,
        savings_available: (profile.savings_available as number | string | null | undefined) ?? null,
        monthly_budget:
          (profile.monthly_budget as number | string | null | undefined) ??
          (profile.target_monthly_budget as number | string | null | undefined) ??
          null,
        monthly_income: (profile.monthly_income as number | string | null | undefined) ?? null,
        preferred_currency:
          typeof profile.preferred_currency === "string" ? profile.preferred_currency : null,
        arrival_date: plan.arrival_date,
      },
      visa: {
        hasResearch: Boolean(
          plan.visa_research && Array.isArray(plan.visa_research.visaOptions) &&
            plan.visa_research.visaOptions.length > 0,
        ),
        pathwaySelected: Boolean(plan.visa_application?.selectedVisaType),
        isFreeMovement: detectFreeMovement(
          typeof profile.citizenship === "string" ? profile.citizenship : null,
          typeof profile.destination === "string" ? profile.destination : null,
        ),
        applicationStatus: plan.visa_application?.applicationStatus ?? null,
      },
      vault: {
        coveredCategories: Array.from(vaultCatsSet),
        totalDocs: (vaultRows ?? []).length,
      },
      openSettlingCount: openSettling.length,
      overdueCount: overdueSettling.length + overduePreMove.length,
      stage: plan.stage,
    };

    const planOut = derivePathwayPlan(inputs);
    res.json({ planId: plan.id, ...planOut });
  } catch (err) {
    logger.error({ err }, "pathways GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
