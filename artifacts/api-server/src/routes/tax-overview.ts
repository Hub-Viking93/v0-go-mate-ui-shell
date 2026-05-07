// =============================================================
// Phase 6C — tax overview API
// =============================================================
//   GET /api/tax-overview
//
// Glue: pulls profile + arrival_date + stage and hands them to
// deriveTaxOverview().
// =============================================================

import { Router, type IRouter } from "express";
import {
  deriveTaxOverview,
  type TaxOverviewInputs,
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

router.get("/tax-overview", async (req, res) => {
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
      logger.error({ err: planErr }, "tax-overview GET: plan load failed");
      res.status(500).json({ error: "Failed to load plan" });
      return;
    }
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    const profile = (plan.profile_data ?? {}) as Record<string, unknown>;
    const inputs: TaxOverviewInputs = {
      profile: {
        destination: typeof profile.destination === "string" ? profile.destination : null,
        current_location:
          typeof profile.current_location === "string" ? profile.current_location : null,
        citizenship: typeof profile.citizenship === "string" ? profile.citizenship : null,
        purpose: typeof profile.purpose === "string" ? profile.purpose : null,
        posting_or_secondment:
          typeof profile.posting_or_secondment === "string" ? profile.posting_or_secondment : null,
        departure_tax_filing_required:
          typeof profile.departure_tax_filing_required === "string"
            ? profile.departure_tax_filing_required
            : null,
      },
      arrivalDate: plan.arrival_date,
      stage: plan.stage,
    };

    const report = deriveTaxOverview(inputs);
    res.json({ planId: plan.id, ...report });
  } catch (err) {
    logger.error({ err }, "tax-overview GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
