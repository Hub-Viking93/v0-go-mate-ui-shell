// =============================================================
// Phase 4D — cultural orientation API
// =============================================================
//   GET /api/orientation  — derived orientation topics
//
// Glue: pulls profile + arrival_date + stage + free-movement flag,
// hands them to deriveOrientation().
// =============================================================

import { Router, type IRouter } from "express";
import {
  deriveOrientation,
  detectFreeMovement,
  type OrientationInputs,
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

router.get("/orientation", async (req, res) => {
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
      logger.error({ err: planErr }, "orientation GET: plan load failed");
      res.status(500).json({ error: "Failed to load plan" });
      return;
    }
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    const profile = (plan.profile_data ?? {}) as Record<string, unknown>;
    const inputs: OrientationInputs = {
      profile: {
        destination: typeof profile.destination === "string" ? profile.destination : null,
        citizenship: typeof profile.citizenship === "string" ? profile.citizenship : null,
        visa_role: typeof profile.visa_role === "string" ? profile.visa_role : null,
        origin_lease_status:
          typeof profile.origin_lease_status === "string" ? profile.origin_lease_status : null,
        children_count:
          (profile.children_count as number | string | null | undefined) ?? null,
        pets: typeof profile.pets === "string" ? profile.pets : null,
        prescription_medications:
          typeof profile.prescription_medications === "string"
            ? profile.prescription_medications
            : null,
      },
      arrivalDate: plan.arrival_date,
      stage: plan.stage,
      isFreeMovement: detectFreeMovement(
        typeof profile.citizenship === "string" ? profile.citizenship : null,
        typeof profile.destination === "string" ? profile.destination : null,
      ),
    };

    const report = deriveOrientation(inputs);
    res.json({ planId: plan.id, ...report });
  } catch (err) {
    logger.error({ err }, "orientation GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
