import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * GET /api/agent-audit
 *
 * Two query shapes:
 *   - ?profile_id=…&field_key=…
 *       → latest agent_audit row whose field_or_output_key matches.
 *   - ?guide_id=…&section_key=…&paragraph_idx=…
 *       → guide_section_citations row(s) for that paragraph
 *         (returns the *first* citation for popover display).
 *
 * Ownership: defensively re-checks via relocation_plans / user_guides
 * even though RLS should also enforce it.
 */
router.get("/agent-audit", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;

    const profileId = (req.query["profile_id"] as string | undefined) ?? undefined;
    const fieldKey = (req.query["field_key"] as string | undefined) ?? undefined;
    const guideId = (req.query["guide_id"] as string | undefined) ?? undefined;
    const sectionKey = (req.query["section_key"] as string | undefined) ?? undefined;
    const paragraphIdxRaw = (req.query["paragraph_idx"] as string | undefined) ?? undefined;

    // -------- Profile-field branch --------
    if (profileId && fieldKey) {
      const { data: plan, error: planErr } = await ctx.supabase
        .from("relocation_plans")
        .select("id, user_id")
        .eq("id", profileId)
        .eq("user_id", ctx.user.id)
        .maybeSingle();
      if (planErr || !plan) {
        res.status(404).json({ error: "Plan not found", audit: null });
        return;
      }

      const { data: row, error } = await ctx.supabase
        .from("agent_audit")
        .select(
          "agent_name, model_used, confidence, source_user_message, validation_rules_applied, retrieved_at, value, phase",
        )
        .eq("profile_id", profileId)
        .eq("field_or_output_key", fieldKey)
        .order("retrieved_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.error({ err: error, profileId, fieldKey }, "agent-audit profile-field query failed");
        res.status(500).json({ error: "Failed to load audit", audit: null });
        return;
      }
      if (!row) {
        res.json({ audit: null });
        return;
      }

      res.json({
        audit: {
          kind: "profile_field",
          fieldKey,
          agentName: row.agent_name,
          modelUsed: row.model_used,
          confidence: row.confidence ?? "medium",
          sourceUserMessage: row.source_user_message,
          validationRulesApplied: Array.isArray(row.validation_rules_applied)
            ? row.validation_rules_applied
            : null,
          retrievedAt: row.retrieved_at,
        },
      });
      return;
    }

    // -------- Research-output branch --------
    if (guideId && sectionKey && paragraphIdxRaw != null) {
      const paragraphIdx = Number.parseInt(paragraphIdxRaw, 10);
      if (!Number.isFinite(paragraphIdx)) {
        res.status(400).json({ error: "paragraph_idx must be an integer" });
        return;
      }

      const { data: guide, error: guideErr } = await ctx.supabase
        .from("guides")
        .select("id, user_id")
        .eq("id", guideId)
        .eq("user_id", ctx.user.id)
        .maybeSingle();
      if (guideErr || !guide) {
        res.status(404).json({ error: "Guide not found", audit: null });
        return;
      }

      const { data: row, error } = await ctx.supabase
        .from("guide_section_citations")
        .select(
          "source_url, source_name, retrieved_at, last_verified_at, agent_who_added_it, citation_number",
        )
        .eq("guide_id", guideId)
        .eq("section_key", sectionKey)
        .eq("paragraph_idx", paragraphIdx)
        .order("citation_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.error({ err: error, guideId, sectionKey, paragraphIdx }, "agent-audit research query failed");
        res.status(500).json({ error: "Failed to load audit", audit: null });
        return;
      }
      if (!row) {
        res.json({ audit: null });
        return;
      }

      res.json({
        audit: {
          kind: "research_output",
          outputKey: `${sectionKey}.${paragraphIdx}`,
          specialistName: row.agent_who_added_it ?? "Research specialist",
          sourceUrl: row.source_url,
          sourceName: row.source_name,
          retrievedAt: row.retrieved_at,
          quality: "full",
          confidence: "high",
          verifyOnOfficialSiteUrl: row.source_url,
        },
      });
      return;
    }

    res.status(400).json({
      error:
        "Provide either (profile_id + field_key) or (guide_id + section_key + paragraph_idx).",
    });
  } catch (err) {
    logger.error({ err }, "agent-audit unexpected error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
