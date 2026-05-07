// =============================================================
// Phase 5C — pet-relocation API
// =============================================================
//   GET /api/pet-relocation
//
// Glue: pulls profile + arrival_date + stage and hands them to
// derivePetRelocation().
// =============================================================

import { Router, type IRouter } from "express";
import {
  derivePetRelocation,
  type PetRelocationInputs,
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

router.get("/pet-relocation", async (req, res) => {
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
      logger.error({ err: planErr }, "pet-relocation GET: plan load failed");
      res.status(500).json({ error: "Failed to load plan" });
      return;
    }
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    const profile = (plan.profile_data ?? {}) as Record<string, unknown>;
    const inputs: PetRelocationInputs = {
      profile: {
        destination: typeof profile.destination === "string" ? profile.destination : null,
        pets: typeof profile.pets === "string" ? profile.pets : null,
        pet_microchip_status:
          typeof profile.pet_microchip_status === "string" ? profile.pet_microchip_status : null,
        pet_vaccination_status:
          typeof profile.pet_vaccination_status === "string"
            ? profile.pet_vaccination_status
            : null,
        pet_breed: typeof profile.pet_breed === "string" ? profile.pet_breed : null,
        pet_size_weight:
          typeof profile.pet_size_weight === "string" ? profile.pet_size_weight : null,
        pet_age: typeof profile.pet_age === "string" ? profile.pet_age : null,
      },
      arrivalDate: plan.arrival_date,
      stage: plan.stage,
    };

    const report = derivePetRelocation(inputs);
    res.json({ planId: plan.id, ...report });
  } catch (err) {
    logger.error({ err }, "pet-relocation GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
