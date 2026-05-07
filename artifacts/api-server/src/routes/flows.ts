// =============================================================
// Phase 4B — banking + healthcare flows API
// =============================================================
//   GET /api/flows  — derived banking + healthcare setup flows
//
// Glue route. Pulls profile + vault categories + settling-in task
// statuses + stage, calls deriveFlows().
// =============================================================

import { Router, type IRouter } from "express";
import {
  deriveFlows,
  type DocumentCategory,
  type FlowInputs,
  type FlowSettlingTask,
} from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface SettlingTaskRow {
  task_key: string | null;
  status: string;
}

interface PlanRow {
  id: string;
  stage: string | null;
  profile_data: Record<string, unknown> | null;
}

router.get("/flows", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const { data: plan, error: planErr } = await ctx.supabase
      .from("relocation_plans")
      .select("id, stage, profile_data")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<PlanRow>();
    if (planErr) {
      logger.error({ err: planErr }, "flows GET: plan load failed");
      res.status(500).json({ error: "Failed to load plan" });
      return;
    }
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    const { data: settlingRows } = await ctx.supabase
      .from("settling_in_tasks")
      .select("task_key, status")
      .eq("plan_id", plan.id)
      .eq("user_id", ctx.user.id);
    const settlingTasks: FlowSettlingTask[] = ((settlingRows ?? []) as SettlingTaskRow[])
      .filter((r) => typeof r.task_key === "string" && r.task_key.length > 0)
      .map((r) => ({ taskKey: r.task_key as string, status: r.status }));

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

    const inputs: FlowInputs = {
      profile: {
        destination: typeof profile.destination === "string" ? profile.destination : null,
        citizenship: typeof profile.citizenship === "string" ? profile.citizenship : null,
        visa_role: typeof profile.visa_role === "string" ? profile.visa_role : null,
        children_count:
          (profile.children_count as number | string | null | undefined) ?? null,
        prescription_medications:
          typeof profile.prescription_medications === "string"
            ? profile.prescription_medications
            : null,
        chronic_condition_description:
          typeof profile.chronic_condition_description === "string"
            ? profile.chronic_condition_description
            : null,
      },
      vault: { coveredCategories: Array.from(vaultCatsSet) },
      settlingTasks,
      stage: plan.stage,
    };

    const flows = deriveFlows(inputs);
    res.json({ planId: plan.id, ...flows });
  } catch (err) {
    logger.error({ err }, "flows GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
