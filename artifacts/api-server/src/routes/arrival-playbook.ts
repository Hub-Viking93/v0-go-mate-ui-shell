// =============================================================
// Phase 4A — arrival playbook API
// =============================================================
//   GET /api/arrival-playbook   — derived 72h + 30d playbooks
//
// Glue route: pulls profile + settling-tasks + arrival_date + stage
// + vault, hands them to deriveArrivalPlaybook().
// =============================================================

import { Router, type IRouter } from "express";
import {
  deriveArrivalPlaybook,
  type DocumentCategory,
  type PlaybookInputs,
  type PlaybookSettlingTask,
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
  arrival_date: string | null;
  profile_data: Record<string, unknown> | null;
}

router.get("/arrival-playbook", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const { data: plan, error: planErr } = await ctx.supabase
      .from("relocation_plans")
      .select("id, stage, arrival_date, profile_data")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<PlanRow>();
    if (planErr) {
      logger.error({ err: planErr }, "arrival-playbook GET: plan load failed");
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
    const settlingTasks: PlaybookSettlingTask[] = ((settlingRows ?? []) as SettlingTaskRow[])
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

    const inputs: PlaybookInputs = {
      profile: {
        destination: typeof profile.destination === "string" ? profile.destination : null,
        citizenship: typeof profile.citizenship === "string" ? profile.citizenship : null,
        visa_role: typeof profile.visa_role === "string" ? profile.visa_role : null,
        posting_or_secondment:
          typeof profile.posting_or_secondment === "string" ? profile.posting_or_secondment : null,
        pets: typeof profile.pets === "string" ? profile.pets : null,
        children_count:
          (profile.children_count as number | string | null | undefined) ?? null,
        bringing_vehicle:
          typeof profile.bringing_vehicle === "string" ? profile.bringing_vehicle : null,
        driver_license_origin:
          typeof profile.driver_license_origin === "string" ? profile.driver_license_origin : null,
        prescription_medications:
          typeof profile.prescription_medications === "string"
            ? profile.prescription_medications
            : null,
      },
      arrivalDate: plan.arrival_date,
      stage: plan.stage,
      vault: { coveredCategories: Array.from(vaultCatsSet) },
      settlingTasks,
    };

    const playbook = deriveArrivalPlaybook(inputs);
    res.json({ planId: plan.id, ...playbook });
  } catch (err) {
    logger.error({ err }, "arrival-playbook GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
