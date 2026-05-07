// =============================================================
// Phase 5B — departure / repatriation flow API
// =============================================================
//   GET /api/departure-flow
//
// Glue: pulls profile + arrival_date + stage and hands them to
// deriveDepartureFlow().
// =============================================================

import { Router, type IRouter } from "express";
import {
  deriveDepartureFlow,
  type DepartureFlowInputs,
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

router.get("/departure-flow", async (req, res) => {
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
      logger.error({ err: planErr }, "departure-flow GET: plan load failed");
      res.status(500).json({ error: "Failed to load plan" });
      return;
    }
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    const profile = (plan.profile_data ?? {}) as Record<string, unknown>;
    const inputs: DepartureFlowInputs = {
      profile: {
        current_location:
          typeof profile.current_location === "string" ? profile.current_location : null,
        destination: typeof profile.destination === "string" ? profile.destination : null,
        origin_lease_status:
          typeof profile.origin_lease_status === "string" ? profile.origin_lease_status : null,
        origin_lease_termination_notice_days:
          (profile.origin_lease_termination_notice_days as number | string | null | undefined) ??
          null,
        bringing_vehicle:
          typeof profile.bringing_vehicle === "string" ? profile.bringing_vehicle : null,
        pets: typeof profile.pets === "string" ? profile.pets : null,
        departure_tax_filing_required:
          typeof profile.departure_tax_filing_required === "string"
            ? profile.departure_tax_filing_required
            : null,
        posting_or_secondment:
          typeof profile.posting_or_secondment === "string" ? profile.posting_or_secondment : null,
      },
      // Departure date for the forward move = arrival date in our schema.
      departureDate: plan.arrival_date,
      stage: plan.stage,
    };

    const report = deriveDepartureFlow(inputs);
    res.json({ planId: plan.id, ...report });
  } catch (err) {
    logger.error({ err }, "departure-flow GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
