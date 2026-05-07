// =============================================================
// Phase 5A — housing support API
// =============================================================
//   GET /api/housing-support
//
// Glue: pulls profile + arrival_date + stage and hands them to
// deriveHousingSupport().
// =============================================================

import { Router, type IRouter } from "express";
import {
  deriveHousingSupport,
  type HousingSupportInputs,
} from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface PlanRow {
  id: string;
  stage: string | null;
  arrival_date: string | null;
  profile_data: Record<string, unknown> | null;
}

router.get("/housing-support", async (req, res) => {
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
      logger.error({ err: planErr }, "housing-support GET: plan load failed");
      res.status(500).json({ error: "Failed to load plan" });
      return;
    }
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    const profile = (plan.profile_data ?? {}) as Record<string, unknown>;
    const inputs: HousingSupportInputs = {
      profile: {
        destination: typeof profile.destination === "string" ? profile.destination : null,
        target_city: typeof profile.target_city === "string" ? profile.target_city : null,
        citizenship: typeof profile.citizenship === "string" ? profile.citizenship : null,
        monthly_budget:
          typeof profile.monthly_budget === "string" ? profile.monthly_budget : null,
        rental_budget_max:
          typeof profile.rental_budget_max === "string" ? profile.rental_budget_max : null,
        furnished_preference:
          typeof profile.furnished_preference === "string" ? profile.furnished_preference : null,
        children_count:
          (profile.children_count as number | string | null | undefined) ?? null,
        pets: typeof profile.pets === "string" ? profile.pets : null,
        home_purchase_intent:
          typeof profile.home_purchase_intent === "string" ? profile.home_purchase_intent : null,
      },
      arrivalDate: plan.arrival_date,
      stage: plan.stage,
    };

    const report = deriveHousingSupport(inputs);
    res.json({ planId: plan.id, ...report });
  } catch (err) {
    logger.error({ err }, "housing-support GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
