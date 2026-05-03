import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function getOwnedPlan(supabase: any, userId: string, planId?: string) {
  let q = supabase.from("relocation_plans").select("*").eq("user_id", userId);
  if (planId) {
    q = q.eq("id", planId);
  } else {
    q = q.eq("is_current", true);
  }
  const { data, error } = await q.maybeSingle();
  return { data, error };
}

router.get("/profile", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const { data: plan, error } = await getOwnedPlan(ctx.supabase, ctx.user.id);
    if (error) {
      logger.error({ err: error }, "profile fetch error");
      res.status(500).json({ error: "Failed to fetch plan" });
      return;
    }
    if (!plan) {
      const { data: newPlan, error: createError } = await ctx.supabase
        .from("relocation_plans")
        .insert({
          user_id: ctx.user.id,
          profile_data: {},
          stage: "collecting",
          is_current: true,
        })
        .select()
        .single();
      if (createError) {
        const { data: existingPlan } = await getOwnedPlan(ctx.supabase, ctx.user.id);
        if (!existingPlan) {
          logger.error({ err: createError }, "profile create error");
          res.status(500).json({ error: "Failed to create plan" });
          return;
        }
        res.json({ plan: existingPlan });
        return;
      }
      res.json({ plan: newPlan });
      return;
    }
    res.json({ plan });
  } catch (err) {
    logger.error({ err }, "profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/profile", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const body = req.body as {
      profileData?: Record<string, unknown>;
      planId?: string;
      action?: "lock" | "unlock";
      expectedVersion?: number;
    };

    const { data: currentPlan, error: fetchError } = await getOwnedPlan(
      ctx.supabase,
      ctx.user.id,
      body.planId,
    );
    if (fetchError || !currentPlan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const currentVersion = (currentPlan.plan_version as number) || 1;
    if (typeof body.expectedVersion === "number" && body.expectedVersion !== currentVersion) {
      res.status(409).json({ error: "Version conflict", currentVersion });
      return;
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      plan_version: currentVersion + 1,
    };
    if (body.profileData) {
      updates.profile_data = { ...(currentPlan.profile_data || {}), ...body.profileData };
    }
    if (body.action === "lock") updates.locked = true;
    if (body.action === "unlock") updates.locked = false;

    const { data: updated, error: updateError } = await ctx.supabase
      .from("relocation_plans")
      .update(updates)
      .eq("id", currentPlan.id)
      .eq("user_id", ctx.user.id)
      .select()
      .single();

    if (updateError) {
      logger.error({ err: updateError }, "profile update error");
      res.status(500).json({ error: "Failed to update plan" });
      return;
    }
    res.json({ plan: updated });
  } catch (err) {
    logger.error({ err }, "profile patch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
