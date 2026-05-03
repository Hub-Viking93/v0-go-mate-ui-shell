import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { getUserTier, hasFeatureAccess } from "../lib/gomate/tier";
import { logger } from "../lib/logger";
import { composeAndPersistGuide } from "../lib/gomate/guide-pipeline";

const router: IRouter = Router();

function getCurrencyFromCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const map: Record<string, string> = {
    "United States": "USD", "USA": "USD", "US": "USD",
    "United Kingdom": "GBP", "UK": "GBP", "GB": "GBP",
    "Canada": "CAD", "Australia": "AUD",
    "Germany": "EUR", "France": "EUR", "Italy": "EUR", "Spain": "EUR",
    "Portugal": "EUR", "Netherlands": "EUR", "Ireland": "EUR",
    "Switzerland": "CHF", "Japan": "JPY", "Singapore": "SGD",
  };
  return map[country] || null;
}

router.get("/guides", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "guides")) {
      res.status(403).json({ error: "Guides require a paid plan" });
      return;
    }

    const includeArchived = req.query.include_archived === "true";
    let scopePlanId = (req.query.plan_id as string) || null;
    if (!scopePlanId && !includeArchived) {
      const { data: cur } = await ctx.supabase
        .from("relocation_plans")
        .select("id")
        .eq("user_id", ctx.user.id)
        .eq("is_current", true)
        .maybeSingle();
      scopePlanId = cur?.id || null;
    }

    let q = ctx.supabase
      .from("guides")
      .select("*")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false });
    if (!includeArchived) q = q.eq("is_current", true);
    if (scopePlanId) q = q.eq("plan_id", scopePlanId);
    const { data: guides, error } = await q;
    if (error) {
      logger.error({ err: error }, "guides list error");
      res.status(500).json({ error: "Failed to fetch guides" });
      return;
    }
    res.json({ guides: guides || [] });
  } catch (err) {
    logger.error({ err }, "guides error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/guides", async (req, res) => {
  // Manual guide-regen — composer-only path.
  //
  // We do NOT re-run the research pipeline (that's a 5-minute, ~$1,
  // 13-specialist job). Instead we re-read the specialist outputs that
  // research-orchestrator finalize already persisted to
  // `relocation_plans.research_meta.specialists` and run the composer
  // (~20-30s) against them. The resulting guide replaces the previous
  // is_current=true row.
  //
  // For a fresh research run, use /api/research/trigger directly.
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "guides")) {
      res.status(403).json({ error: "Guides require a paid plan" });
      return;
    }
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id, user_id, profile_data, research_meta")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<{
        id: string;
        user_id: string;
        profile_data: Record<string, unknown>;
        research_meta: { specialists?: Record<string, unknown> } | null;
      }>();
    if (!plan) {
      res.status(404).json({ error: "No active plan found." });
      return;
    }

    const specialists = plan.research_meta?.specialists ?? {};
    const specialistEntries = Object.entries(specialists);
    if (specialistEntries.length === 0) {
      res.status(409).json({
        error:
          "No research data yet. Trigger /api/research/trigger to run the research pipeline first.",
      });
      return;
    }

    const profile = plan.profile_data ?? {};
    const destination =
      typeof profile.destination === "string" ? profile.destination : "";
    const destinationCity =
      typeof profile.target_city === "string" ? profile.target_city : null;
    const purpose =
      typeof profile.purpose === "string" ? profile.purpose : "settle";
    const specialistOutputs = specialistEntries.map(([name, body]) => ({
      name,
      output: body as Parameters<typeof composeAndPersistGuide>[0]["specialistOutputs"][number]["output"],
    }));

    const guideId = await composeAndPersistGuide({
      supabase: ctx.supabase,
      userId: ctx.user.id,
      planId: plan.id,
      profile: profile as Record<string, unknown>,
      destination,
      destinationCity,
      purpose,
      specialistOutputs,
    });

    if (!guideId) {
      res.status(500).json({ error: "Failed to compose guide" });
      return;
    }
    res.status(200).json({ success: true, planId: plan.id, guideId });
  } catch (err) {
    logger.error({ err }, "guides POST error");
    res.status(500).json({ error: "Failed to regenerate guide" });
  }
});

router.get("/guides/:id", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const { data: guide, error } = await ctx.supabase
      .from("guides")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", ctx.user.id)
      .single();
    if (error || !guide) {
      res.status(404).json({ error: "Guide not found" });
      return;
    }
    let homeCurrency: string | null = null;
    if (guide.plan_id) {
      const { data: plan } = await ctx.supabase
        .from("relocation_plans")
        .select("profile_data")
        .eq("id", guide.plan_id)
        .maybeSingle();
      const pd = plan?.profile_data as { current_location?: string; citizenship?: string } | undefined;
      if (pd) {
        homeCurrency = getCurrencyFromCountry(pd.current_location) || getCurrencyFromCountry(pd.citizenship) || null;
      }
    }
    res.json({ guide, homeCurrency });
  } catch (err) {
    logger.error({ err }, "guide get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/guides/:id", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const { error } = await ctx.supabase
      .from("guides")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", ctx.user.id);
    if (error) {
      res.status(500).json({ error: "Failed to delete guide" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "guide delete error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
