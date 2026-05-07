// =============================================================
// Phase 3B — risks + blockers API
// =============================================================
//   GET /api/risks    — derived risks for the active plan
//
// Same shape pattern as /api/readiness: this route is the glue that
// gathers state from `relocation_plans`, `settling_in_tasks`,
// `research_meta.preDeparture` and `relocation_documents`, builds a
// `RiskInputs` snapshot, and calls `deriveRisks()`.
//
// All real logic lives in @workspace/agents/src/risks.ts.
// =============================================================

import { Router, type IRouter } from "express";
import {
  deriveRisks,
  detectFreeMovement,
  computeUrgency,
  type DocumentCategory,
  type RiskInputs,
  type RiskOpenTask,
} from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface SettlingTaskRow {
  id: string;
  task_key: string | null;
  title: string;
  status: string;
  deadline_at: string | null;
  walkthrough: { requiredDocumentCategories?: DocumentCategory[] } | null;
}

interface PreDepartureActionStored {
  id: string;
  title: string;
  status: string;
  deadlineIso?: string;
  walkthrough?: { requiredDocumentCategories?: DocumentCategory[] };
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

router.get("/risks", async (req, res) => {
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
      logger.error({ err: planErr }, "risks GET: plan load failed");
      res.status(500).json({ error: "Failed to load plan" });
      return;
    }
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    // Settling-in rows for this plan.
    const { data: settlingRows } = await ctx.supabase
      .from("settling_in_tasks")
      .select("id, task_key, title, status, deadline_at, walkthrough")
      .eq("plan_id", plan.id)
      .eq("user_id", ctx.user.id);

    // Vault — distinct categories + total count.
    const { data: vaultRows } = await ctx.supabase
      .from("relocation_documents")
      .select("category, linked_task_keys")
      .eq("user_id", ctx.user.id);

    const profile = (plan.profile_data ?? {}) as Record<string, unknown>;
    const visaResearch = plan.visa_research ?? null;
    const visaApplication = plan.visa_application ?? null;
    const preDepartureActions = (plan.research_meta?.preDeparture?.actions ?? []) as PreDepartureActionStored[];

    const now = new Date();

    // ---- Vault aggregates ------------------------------------------------
    const vaultCatsSet = new Set<DocumentCategory>();
    for (const r of vaultRows ?? []) {
      const c = (r as { category?: string }).category;
      if (typeof c === "string") vaultCatsSet.add(c as DocumentCategory);
    }
    const coveredCategories = Array.from(vaultCatsSet);
    const totalDocs = (vaultRows ?? []).length;

    // ---- Build per-task coverage maps -----------------------------------
    // For risks we need to know, per task, which required cats are covered
    // (explicit link OR same-category match in the vault).
    const settling = (settlingRows ?? []) as SettlingTaskRow[];

    function categoriesCoveredForTask(
      taskRef: string,
      required: DocumentCategory[],
    ): DocumentCategory[] {
      const result: DocumentCategory[] = [];
      for (const cat of required) {
        const explicit = (vaultRows ?? []).some((d) => {
          const dc = (d as { category?: string }).category;
          const refs = (d as { linked_task_keys?: string[] }).linked_task_keys ?? [];
          return dc === cat && refs.includes(taskRef);
        });
        const byCat = (vaultRows ?? []).some((d) => {
          const dc = (d as { category?: string }).category;
          return dc === cat;
        });
        if (explicit || byCat) result.push(cat);
      }
      return result;
    }

    const openTasks: RiskOpenTask[] = [];
    for (const t of settling) {
      if (t.status === "completed" || t.status === "skipped") continue;
      const taskKey = t.task_key;
      if (!taskKey) continue;
      const required = (t.walkthrough?.requiredDocumentCategories ?? []) as DocumentCategory[];
      const taskRef = `settling-in:${taskKey}`;
      const due = t.deadline_at ? new Date(t.deadline_at) : null;
      const urgency = due ? computeUrgency(due, now) : "normal";
      const days = due ? Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;
      openTasks.push({
        taskRef,
        title: t.title,
        origin: "settling-in",
        deadlineIso: t.deadline_at,
        daysUntilDeadline: days,
        urgency,
        requiredCategories: required,
        coveredCategories: categoriesCoveredForTask(taskRef, required),
      });
    }
    for (const a of preDepartureActions) {
      if (a.status === "complete" || a.status === "skipped") continue;
      const required = (a.walkthrough?.requiredDocumentCategories ?? []) as DocumentCategory[];
      const taskRef = `pre-departure:${a.id}`;
      const due = a.deadlineIso ? new Date(a.deadlineIso) : null;
      const urgency = due ? computeUrgency(due, now) : "normal";
      const days = due ? Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;
      openTasks.push({
        taskRef,
        title: a.title,
        origin: "pre-departure",
        deadlineIso: a.deadlineIso ?? null,
        daysUntilDeadline: days,
        urgency,
        requiredCategories: required,
        coveredCategories: categoriesCoveredForTask(taskRef, required),
      });
    }

    // ---- Compose RiskInputs + run derivers --------------------------------
    const inputs: RiskInputs = {
      profile: {
        destination: typeof profile.destination === "string" ? profile.destination : null,
        citizenship: typeof profile.citizenship === "string" ? profile.citizenship : null,
        purpose: typeof profile.purpose === "string" ? profile.purpose : null,
        visa_role: typeof profile.visa_role === "string" ? profile.visa_role : null,
        posting_or_secondment:
          typeof profile.posting_or_secondment === "string" ? profile.posting_or_secondment : null,
        pets: typeof profile.pets === "string" ? profile.pets : null,
        prescription_medications:
          typeof profile.prescription_medications === "string" ? profile.prescription_medications : null,
        bringing_vehicle:
          typeof profile.bringing_vehicle === "string" ? profile.bringing_vehicle : null,
        prior_visa_rejection: (profile.prior_visa_rejection as string | boolean | null | undefined) ?? null,
        prior_visa_refusal: (profile.prior_visa_refusal as string | boolean | null | undefined) ?? null,
        savings_available: (profile.savings_available as number | string | null | undefined) ?? null,
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
        hasResearch: Boolean(
          visaResearch && Array.isArray(visaResearch.visaOptions) && visaResearch.visaOptions.length > 0,
        ),
        pathwaySelected: Boolean(visaApplication?.selectedVisaType),
        isFreeMovement: detectFreeMovement(
          typeof profile.citizenship === "string" ? profile.citizenship : null,
          typeof profile.destination === "string" ? profile.destination : null,
        ),
        applicationStatus: visaApplication?.applicationStatus ?? null,
      },
      vault: {
        coveredCategories,
        totalDocs,
      },
      openTasks,
      stage: plan.stage,
    };

    const report = deriveRisks(inputs);
    res.json({ planId: plan.id, ...report });
  } catch (err) {
    logger.error({ err }, "risks GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
