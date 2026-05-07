// =============================================================
// Phase 4C — driver's licence + insurance guidance API
// =============================================================
//   GET /api/license-insurance
//
// Glue: pulls profile + vault categories + settling-tasks + stage,
// resolves free-movement, calls deriveLicenseAndInsuranceGuidance.
// =============================================================

import { Router, type IRouter } from "express";
import {
  deriveLicenseAndInsuranceGuidance,
  detectFreeMovement,
  type DocumentCategory,
  type Phase4cInputs,
  type Phase4cSettlingTask,
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

router.get("/license-insurance", async (req, res) => {
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
      logger.error({ err: planErr }, "license-insurance GET: plan load failed");
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
    const settlingTasks: Phase4cSettlingTask[] = ((settlingRows ?? []) as SettlingTaskRow[])
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

    const inputs: Phase4cInputs = {
      profile: {
        destination: typeof profile.destination === "string" ? profile.destination : null,
        citizenship: typeof profile.citizenship === "string" ? profile.citizenship : null,
        driver_license_origin:
          typeof profile.driver_license_origin === "string"
            ? profile.driver_license_origin
            : null,
        bringing_vehicle:
          typeof profile.bringing_vehicle === "string" ? profile.bringing_vehicle : null,
        pets: typeof profile.pets === "string" ? profile.pets : null,
        prescription_medications:
          typeof profile.prescription_medications === "string"
            ? profile.prescription_medications
            : null,
        chronic_condition_description:
          typeof profile.chronic_condition_description === "string"
            ? profile.chronic_condition_description
            : null,
        origin_lease_status:
          typeof profile.origin_lease_status === "string"
            ? profile.origin_lease_status
            : null,
        arrival_date: plan.arrival_date,
      },
      vault: { coveredCategories: Array.from(vaultCatsSet) },
      settlingTasks,
      stage: plan.stage,
      isFreeMovement: detectFreeMovement(
        typeof profile.citizenship === "string" ? profile.citizenship : null,
        typeof profile.destination === "string" ? profile.destination : null,
      ),
    };

    const report = deriveLicenseAndInsuranceGuidance(inputs);
    res.json({ planId: plan.id, ...report });
  } catch (err) {
    logger.error({ err }, "license-insurance GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
