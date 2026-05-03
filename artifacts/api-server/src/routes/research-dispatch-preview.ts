import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";
import { decideDispatch } from "../lib/agents/coordinator";
import type { Profile } from "../lib/gomate/profile-schema-snapshot";

const router: IRouter = Router();

/**
 * GET /api/research/dispatch-preview
 *
 * Returns the Coordinator's dispatch decision for the current user's
 * profile WITHOUT actually running any specialist. The dashboard's
 * agents-panel grid calls this first so it can render the panel
 * skeletons (one card per specialist) before the real research run
 * starts streaming results into them.
 *
 * Response shape:
 *   {
 *     specialists: [{ name, inputs }],
 *     rationale:   [{ specialist, reason }]
 *   }
 */
router.get("/research/dispatch-preview", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;

    const { data: plan, error } = await ctx.supabase
      .from("relocation_plans")
      .select("profile_data")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();

    if (error) {
      logger.error({ err: error }, "dispatch-preview fetch error");
      res.status(500).json({ error: "Failed to fetch plan" });
      return;
    }

    const profile = (plan?.profile_data ?? {}) as Profile;
    const decision = decideDispatch(profile);
    res.json(decision);
  } catch (err) {
    logger.error({ err }, "dispatch-preview error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
