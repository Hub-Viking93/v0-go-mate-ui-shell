// =============================================================
// Phase 6D — rule-change monitoring API
// =============================================================
//   GET   /api/rule-changes        → relevant rule-changes for current user
//   PATCH /api/rule-changes/:id    → mark reviewed / dismissed / request_research
//
// Acks persist on `relocation_plans.research_meta.rule_change_acks`
// (Record<id, RuleChangeAck>). Single-applicant.
// =============================================================

import { Router, type IRouter, type Request, type Response } from "express";
import {
  deriveRuleChanges,
  type RuleChangeAck,
  type RuleChangeAckStatus,
  type RuleChangeInputs,
  type RuleChangeReport,
} from "@workspace/agents";
import { authenticate, type AuthedContext } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface PlanRow {
  id: string;
  stage: string | null;
  arrival_date: string | null;
  profile_data: Record<string, unknown> | null;
  research_meta: Record<string, unknown> | null;
}

async function loadPlan(ctx: AuthedContext): Promise<PlanRow | null> {
  const { data: plan, error } = await ctx.supabase
    .from("relocation_plans")
    .select("id, stage, arrival_date, profile_data, research_meta")
    .eq("user_id", ctx.user.id)
    .eq("is_current", true)
    .maybeSingle<PlanRow>();
  if (error) throw error;
  return plan ?? null;
}

function readAcks(plan: PlanRow): Record<string, RuleChangeAck> {
  const meta = (plan.research_meta ?? {}) as Record<string, unknown>;
  const raw = meta.rule_change_acks;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, RuleChangeAck> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === "object" && typeof (v as { status?: unknown }).status === "string") {
      const s = (v as { status: string }).status;
      const at = (v as { at?: unknown }).at;
      if (
        s === "new" ||
        s === "reviewed" ||
        s === "dismissed" ||
        s === "research_requested"
      ) {
        out[k] = {
          status: s as RuleChangeAckStatus,
          at: typeof at === "string" ? at : new Date().toISOString(),
        };
      }
    }
  }
  return out;
}

async function persistAcks(
  ctx: AuthedContext,
  plan: PlanRow,
  acks: Record<string, RuleChangeAck>,
): Promise<void> {
  const meta = (plan.research_meta ?? {}) as Record<string, unknown>;
  const next = { ...meta, rule_change_acks: acks };
  const { error } = await ctx.supabase
    .from("relocation_plans")
    .update({ research_meta: next })
    .eq("id", plan.id);
  if (error) throw error;
}

interface VisaApplicationRow {
  selectedVisaType: string | null;
}

async function loadVisaInputs(ctx: AuthedContext, planId: string) {
  const { data } = await ctx.supabase
    .from("visa_application")
    .select("selectedVisaType:selected_visa_type")
    .eq("plan_id", planId)
    .maybeSingle<VisaApplicationRow>();
  return { selectedVisaType: data?.selectedVisaType ?? null };
}

async function buildReport(ctx: AuthedContext, plan: PlanRow): Promise<RuleChangeReport> {
  const profile = (plan.profile_data ?? {}) as Record<string, unknown>;
  const visa = await loadVisaInputs(ctx, plan.id).catch(() => ({ selectedVisaType: null }));
  const acks = readAcks(plan);
  const inputs: RuleChangeInputs = {
    profile: {
      destination: typeof profile.destination === "string" ? profile.destination : null,
      current_location:
        typeof profile.current_location === "string" ? profile.current_location : null,
      citizenship: typeof profile.citizenship === "string" ? profile.citizenship : null,
      purpose: typeof profile.purpose === "string" ? profile.purpose : null,
      pets: typeof profile.pets === "string" ? profile.pets : null,
      origin_lease_status:
        typeof profile.origin_lease_status === "string" ? profile.origin_lease_status : null,
      bringing_vehicle:
        typeof profile.bringing_vehicle === "string" ? profile.bringing_vehicle : null,
      posting_or_secondment:
        typeof profile.posting_or_secondment === "string" ? profile.posting_or_secondment : null,
    },
    visa: { selectedVisaType: visa.selectedVisaType },
    arrivalDate: plan.arrival_date,
    stage: plan.stage,
    acks,
  };
  return deriveRuleChanges(inputs);
}

router.get("/rule-changes", async (req: Request, res: Response) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const plan = await loadPlan(ctx);
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    const report = await buildReport(ctx, plan);
    res.json({ planId: plan.id, ...report });
  } catch (err) {
    logger.error({ err }, "rule-changes GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/rule-changes/:id", async (req: Request, res: Response) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) {
      res.status(400).json({ error: "Missing rule-change id" });
      return;
    }
    const action = (req.body as { action?: unknown }).action;
    let nextStatus: RuleChangeAckStatus | null = null;
    if (action === "review" || action === "reviewed") nextStatus = "reviewed";
    else if (action === "dismiss" || action === "dismissed") nextStatus = "dismissed";
    else if (
      action === "request_research" ||
      action === "research_requested" ||
      action === "rerun_research"
    ) {
      nextStatus = "research_requested";
    } else if (action === "reset" || action === "new") nextStatus = "new";
    if (!nextStatus) {
      res.status(400).json({
        error:
          "Invalid action; expected 'review' | 'dismiss' | 'request_research' | 'reset'",
      });
      return;
    }
    const plan = await loadPlan(ctx);
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    const acks = readAcks(plan);
    acks[id] = { status: nextStatus, at: new Date().toISOString() };
    await persistAcks(ctx, plan, acks);
    // Refresh the in-memory plan so buildReport sees the updated acks.
    const refreshed: PlanRow = {
      ...plan,
      research_meta: {
        ...((plan.research_meta ?? {}) as Record<string, unknown>),
        rule_change_acks: acks,
      },
    };
    const report = await buildReport(ctx, refreshed);
    res.json({ ok: true, planId: plan.id, ...report });
  } catch (err) {
    logger.error({ err }, "rule-changes PATCH threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
