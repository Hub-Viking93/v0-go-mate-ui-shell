// =============================================================
// Phase 5.2 — pre-departure API + persistence
// =============================================================
//   GET    /api/pre-departure              → current timeline (404 when unset)
//   POST   /api/pre-departure/generate     → compute + persist (idempotent
//                                            via user_triggered_pre_departure_at)
//   PATCH  /api/pre-departure/:actionId    → update status (in_progress / done / skipped)
//
// PERSISTENCE NOTE — JSONB-on-plans, not pre_departure_actions:
//   The Wave 2 migration that adds the full pre_departure_actions schema
//   (plan_id, action_key, prefill, etc.) hasn't been applied in the live
//   Supabase project yet — the table exists but only carries id/title/
//   description/status/completed_at columns.
//
//   Until the migration is applied, we stash the whole timeline as a
//   JSONB blob inside `relocation_plans.research_meta.preDeparture`.
//   This keeps the API surface stable — the route's wire format matches
//   what the future SQL-backed implementation will return — while
//   sidestepping the missing columns. Migration to the proper table
//   happens in a follow-up wave by reading from research_meta and
//   inserting into pre_departure_actions.
// =============================================================

import { Router, type IRouter } from "express";
import {
  generatePreDepartureTimeline,
  type PreDepartureProfile,
  type VisaPathwayLite,
  type ActionStatus,
  type PreDepartureAction,
} from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const VALID_STATUSES: ReadonlySet<ActionStatus> = new Set([
  "not_started",
  "in_progress",
  "complete",
  "blocked",
  "skipped",
]);

interface StoredAction extends PreDepartureAction {
  /** ISO timestamp; set when status moves to "complete". */
  completedAt?: string | null;
  /** Free-form user note attached to the action. */
  userNotes?: string | null;
  /** Whether the action sits on the critical path (mirrored from timeline). */
  onCriticalPath?: boolean;
  /** Absolute deadline date (computed from moveDate + weeksBeforeMoveDeadline). */
  deadlineIso?: string;
}

interface StoredPreDeparture {
  generatedAt: string;
  moveDateIso: string;
  longestLeadTimeWeeks: number;
  criticalPath: string[];
  actions: StoredAction[];
}

interface PlanRowForRead {
  id: string;
  research_meta: { preDeparture?: StoredPreDeparture } | null;
}

interface PlanRowForGenerate extends PlanRowForRead {
  stage: string | null;
  locked: boolean | null;
  profile_data: Record<string, unknown> | null;
  visa_research: { visaOptions?: Array<Record<string, unknown>> } | null;
  arrival_date: string | null;
  user_triggered_pre_departure_at: string | null;
}

router.get("/pre-departure", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const planIdQ = req.query.planId;
    const planId = typeof planIdQ === "string" ? planIdQ : null;
    let resolvedPlanId = planId;
    if (!resolvedPlanId) {
      const { data: plan } = await ctx.supabase
        .from("relocation_plans")
        .select("id")
        .eq("user_id", ctx.user.id)
        .eq("is_current", true)
        .maybeSingle();
      resolvedPlanId = plan?.id ?? null;
    }
    if (!resolvedPlanId) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    const { data: plan, error } = await ctx.supabase
      .from("relocation_plans")
      .select("id, research_meta")
      .eq("user_id", ctx.user.id)
      .eq("id", resolvedPlanId)
      .maybeSingle<PlanRowForRead>();
    if (error) {
      logger.error({ err: error }, "pre-departure GET error");
      res.status(500).json({ error: "Failed to load pre-departure timeline" });
      return;
    }
    const stored = plan?.research_meta?.preDeparture;
    if (!stored || !stored.actions || stored.actions.length === 0) {
      res.status(404).json({ error: "Pre-departure timeline not generated yet" });
      return;
    }
    res.json({
      planId: resolvedPlanId,
      actions: stored.actions,
      totalActions: stored.actions.length,
      criticalPathActionKeys: stored.criticalPath,
      longestLeadTimeWeeks: stored.longestLeadTimeWeeks,
      moveDate: stored.moveDateIso.split("T")[0],
      generatedAt: stored.generatedAt,
    });
  } catch (err) {
    logger.error({ err }, "pre-departure GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/pre-departure/generate", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const { data: plan, error: planErr } = await ctx.supabase
      .from("relocation_plans")
      .select(
        "id, stage, locked, profile_data, visa_research, arrival_date, user_triggered_pre_departure_at, research_meta",
      )
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<PlanRowForGenerate>();
    if (planErr || !plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    if (
      plan.stage !== "ready_for_pre_departure" &&
      plan.stage !== "pre_departure" &&
      plan.stage !== "complete"
    ) {
      res.status(409).json({
        error: `Cannot generate pre-departure timeline from stage "${plan.stage}". Trigger research first.`,
      });
      return;
    }

    const profile = (plan.profile_data ?? {}) as PreDepartureProfile;
    const moveDate = plan.arrival_date
      ? new Date(plan.arrival_date)
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);

    let visa: VisaPathwayLite | null = null;
    if (plan.visa_research?.visaOptions && plan.visa_research.visaOptions.length > 0) {
      const v = plan.visa_research.visaOptions[0];
      visa = {
        name: typeof v.name === "string" ? v.name : undefined,
        type: typeof v.type === "string" ? v.type : undefined,
        estimatedProcessingWeeks:
          typeof v.processingTime === "string" ? parseProcessingWeeks(v.processingTime) : undefined,
        officialUrl: typeof v.officialLink === "string" ? v.officialLink : undefined,
      };
    }

    const timeline = generatePreDepartureTimeline(profile, visa, moveDate);

    const criticalKeySet = new Set(timeline.criticalPath.map((c) => c.id));
    const moveMs = moveDate.getTime();
    const storedActions: StoredAction[] = timeline.actions.map((a) => {
      const deadlineDate = new Date(moveMs - a.weeksBeforeMoveDeadline * 7 * 24 * 60 * 60 * 1000);
      return {
        ...a,
        completedAt: null,
        userNotes: null,
        onCriticalPath: criticalKeySet.has(a.id),
        deadlineIso: deadlineDate.toISOString().split("T")[0],
      };
    });

    const stored: StoredPreDeparture = {
      generatedAt: timeline.generatedAt,
      moveDateIso: timeline.moveDateIso,
      longestLeadTimeWeeks: timeline.longestLeadTimeWeeks,
      criticalPath: timeline.criticalPath.map((c) => c.id),
      actions: storedActions,
    };

    const newResearchMeta = {
      ...(plan.research_meta ?? {}),
      preDeparture: stored,
    };

    const now = new Date().toISOString();
    const { error: upErr } = await ctx.supabase
      .from("relocation_plans")
      .update({
        research_meta: newResearchMeta,
        stage: "pre_departure",
        user_triggered_pre_departure_at: plan.user_triggered_pre_departure_at ?? now,
        updated_at: now,
      })
      .eq("id", plan.id);
    if (upErr) {
      logger.error({ err: upErr }, "pre-departure: persist failed");
      res.status(500).json({ error: "Failed to persist pre-departure timeline", detail: upErr.message });
      return;
    }

    res.json({
      planId: plan.id,
      actions: stored.actions,
      totalActions: stored.actions.length,
      criticalPathActionKeys: stored.criticalPath,
      longestLeadTimeWeeks: stored.longestLeadTimeWeeks,
      moveDate: stored.moveDateIso.split("T")[0],
      generatedAt: stored.generatedAt,
    });
  } catch (err) {
    logger.error({ err }, "pre-departure generate threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/pre-departure/:actionId", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const actionId = req.params.actionId;
    const body = (req.body ?? {}) as { status?: string; notes?: string };
    const incoming = body.status;
    if (typeof incoming !== "string" || !VALID_STATUSES.has(incoming as ActionStatus)) {
      res.status(400).json({ error: `status must be one of ${[...VALID_STATUSES].join(", ")}` });
      return;
    }
    const newStatus = incoming as ActionStatus;
    const { data: plan, error: planErr } = await ctx.supabase
      .from("relocation_plans")
      .select("id, research_meta")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle<PlanRowForRead>();
    if (planErr || !plan?.research_meta?.preDeparture) {
      res.status(404).json({ error: "No active pre-departure timeline" });
      return;
    }
    const stored = plan.research_meta.preDeparture;
    const idx = stored.actions.findIndex((a) => a.id === actionId);
    if (idx < 0) {
      res.status(404).json({ error: "Action not found in current timeline" });
      return;
    }
    const updated: StoredAction = {
      ...stored.actions[idx],
      status: newStatus,
      ...(typeof body.notes === "string" ? { userNotes: body.notes } : {}),
      ...(newStatus === "complete" ? { completedAt: new Date().toISOString() } : { completedAt: null }),
    };
    const newActions = [...stored.actions];
    newActions[idx] = updated;
    const newMeta = {
      ...(plan.research_meta ?? {}),
      preDeparture: { ...stored, actions: newActions },
    };
    const { error: upErr } = await ctx.supabase
      .from("relocation_plans")
      .update({ research_meta: newMeta })
      .eq("id", plan.id);
    if (upErr) {
      logger.error({ err: upErr }, "pre-departure PATCH persist failed");
      res.status(500).json({ error: "Failed to update action" });
      return;
    }
    res.json({ action: updated });
  } catch (err) {
    logger.error({ err }, "pre-departure PATCH threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

function parseProcessingWeeks(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:to\s*(\d+))?\s*(week|day|month)/i);
  if (!m) return undefined;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  const avg = (lo + hi) / 2;
  const unit = m[3].toLowerCase();
  if (unit.startsWith("week")) return Math.round(avg);
  if (unit.startsWith("day")) return Math.max(1, Math.round(avg / 7));
  if (unit.startsWith("month")) return Math.round(avg * 4);
  return undefined;
}

export default router;
