// =============================================================
// Phase 6A — notifications API
// =============================================================
//   GET    /api/notifications          → sync + return list + counts
//   POST   /api/notifications/sync     → explicit sync (idempotent)
//   PATCH  /api/notifications/:id      → mark read / dismissed
//
// Notifications are persisted on `relocation_plans.research_meta.notifications`
// (JSONB array). Single-applicant — no separate table is needed in v1.
//
// Channel: in-app surface (the Notification Bell). The model carries a
// `channel` field that can later be set to `email` once a provider is
// wired; the dispatcher in this file currently delivers in-app only.
// =============================================================

import { Router, type IRouter, type Request, type Response } from "express";
import {
  computeNotifications,
  mergeNotifications,
  countNotifications,
  type NotificationInputs,
  type NotificationStored,
  type NotificationTaskInput,
  type NotificationDocumentInput,
  type NotificationRiskInput,
} from "@workspace/agents";
import { authenticate, type AuthedContext } from "../lib/supabase-auth";
import { logger } from "../lib/logger";
import {
  dispatchEmail,
  type DispatchAttempt,
} from "../lib/email-dispatcher";
import { runSchedulerTick } from "../lib/notifications-scheduler";

const router: IRouter = Router();

interface PlanRow {
  id: string;
  stage: string | null;
  arrival_date: string | null;
  profile_data: Record<string, unknown> | null;
  research_meta: Record<string, unknown> | null;
}

interface SettlingTaskRow {
  task_key: string;
  title: string;
  status: string | null;
  deadline_at: string | null;
  category: string | null;
  documents_needed: unknown;
}

interface PreDepartureRow {
  id: string;
  title: string;
  status: string | null;
  deadline_at: string | null;
  required_documents: unknown;
}

interface DocumentRow {
  category: string | null;
}

interface RiskRow {
  id: string;
  severity: string;
  title: string;
  blocked_task_ref?: string | null;
}

// ---- Helpers --------------------------------------------------------------

function mapUrgencyFromAt(deadlineAt: string | null, status: string | null): NotificationTaskInput["urgency"] {
  if (status === "completed" || status === "skipped") return "no_deadline";
  if (!deadlineAt) return "no_deadline";
  const ms = Date.parse(deadlineAt);
  if (!Number.isFinite(ms)) return "no_deadline";
  const days = Math.round((ms - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "overdue";
  if (days <= 1) return "now";
  if (days <= 7) return "now"; // matches Phase 1A "urgent" → triggers a notification
  if (days <= 30) return "soon";
  return "later";
}

function mapTaskStatus(status: string | null): NotificationTaskInput["status"] {
  switch (status) {
    case "completed":
      return "completed";
    case "in_progress":
      return "in_progress";
    case "blocked":
      return "blocked";
    case "deferred":
      return "deferred";
    default:
      return "available";
  }
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

async function loadStoredNotifications(planRow: PlanRow): Promise<NotificationStored[]> {
  const meta = (planRow.research_meta ?? {}) as Record<string, unknown>;
  const stored = meta.notifications;
  if (!Array.isArray(stored)) return [];
  // Defensive: filter out anything that doesn't look like a NotificationStored.
  return stored.filter(
    (n): n is NotificationStored =>
      n &&
      typeof n === "object" &&
      typeof (n as { id?: unknown }).id === "string" &&
      typeof (n as { dedupeKey?: unknown }).dedupeKey === "string",
  );
}

async function persistNotifications(
  ctx: AuthedContext,
  planRow: PlanRow,
  notifications: NotificationStored[],
  newDeliveries: DispatchAttempt[] = [],
): Promise<void> {
  const meta = (planRow.research_meta ?? {}) as Record<string, unknown>;
  const priorDeliveries = Array.isArray(meta.notification_deliveries)
    ? (meta.notification_deliveries as DispatchAttempt[])
    : [];
  // Cap the audit ledger at 200 entries so it doesn't grow unbounded.
  const deliveries = [...priorDeliveries, ...newDeliveries].slice(-200);
  const nextMeta = { ...meta, notifications, notification_deliveries: deliveries };
  const { error } = await ctx.supabase
    .from("relocation_plans")
    .update({ research_meta: nextMeta })
    .eq("id", planRow.id);
  if (error) throw error;
}

async function loadInputs(ctx: AuthedContext, planRow: PlanRow): Promise<NotificationInputs> {
  const profile = (planRow.profile_data ?? {}) as Record<string, unknown>;
  // ---- Settling-in tasks --------------------------------------------------
  const { data: settlingRows } = await ctx.supabase
    .from("settling_in_tasks")
    .select("task_key, title, status, deadline_at, category, documents_needed")
    .eq("plan_id", planRow.id);
  const settlingTasks: NotificationTaskInput[] = (settlingRows ?? []).map((r: SettlingTaskRow) => ({
    taskKey: r.task_key,
    title: r.title,
    status: mapTaskStatus(r.status),
    deadlineAt: r.deadline_at,
    urgency: mapUrgencyFromAt(r.deadline_at, r.status),
    requiredDocumentCategories: asStringArray(r.documents_needed),
    category: r.category ?? "settling_in",
  }));

  // ---- Pre-departure tasks ------------------------------------------------
  const { data: preRows } = await ctx.supabase
    .from("pre_departure_actions")
    .select("id, title, status, deadline_at, required_documents")
    .eq("plan_id", planRow.id);
  const preTasks: NotificationTaskInput[] = (preRows ?? []).map((r: PreDepartureRow) => ({
    taskKey: `pre-departure:${r.id}`,
    title: r.title,
    status: mapTaskStatus(r.status),
    deadlineAt: r.deadline_at,
    urgency: mapUrgencyFromAt(r.deadline_at, r.status),
    requiredDocumentCategories: asStringArray(r.required_documents),
    category: "pre_move",
  }));

  // ---- Documents ----------------------------------------------------------
  const { data: docRows } = await ctx.supabase
    .from("relocation_documents")
    .select("category")
    .eq("user_id", ctx.user.id)
    .eq("plan_id", planRow.id);
  const documents: NotificationDocumentInput = {
    categories: (docRows ?? [])
      .map((d: DocumentRow) => d.category)
      .filter((c): c is string => typeof c === "string"),
  };

  // ---- Risks --------------------------------------------------------------
  // Risks live on research_meta.risks if pre-computed; otherwise we leave
  // an empty array. We don't recompute the full risks tree here — the
  // dashboard's risks-section already does that. We only consume the
  // already-derived list when present.
  const meta = (planRow.research_meta ?? {}) as Record<string, unknown>;
  const cachedRisks = Array.isArray(meta.risks) ? (meta.risks as RiskRow[]) : [];
  const risks: NotificationRiskInput[] = cachedRisks.map((r) => ({
    id: r.id,
    severity:
      r.severity === "critical" ? "blocker" : r.severity === "warning" ? "warning" : "info",
    title: r.title,
    blockedTaskRef: r.blocked_task_ref ?? null,
  }));

  return {
    profile: {
      destination: typeof profile.destination === "string" ? profile.destination : null,
      visa_role: typeof profile.visa_role === "string" ? profile.visa_role : null,
    },
    arrivalDate: planRow.arrival_date,
    stage: planRow.stage,
    tasks: [...settlingTasks, ...preTasks],
    documents,
    risks,
    stored: [],
  };
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

interface NotificationsPayload {
  planId: string;
  generatedAt: string;
  notifications: NotificationStored[];
  counts: ReturnType<typeof countNotifications>;
}

async function syncOnce(ctx: AuthedContext, planRow: PlanRow): Promise<NotificationsPayload> {
  const inputs = await loadInputs(ctx, planRow);
  const stored = await loadStoredNotifications(planRow);
  inputs.stored = stored;
  const computed = computeNotifications(inputs);
  const merged = mergeNotifications(stored, computed);

  // ---- In-app surface: mark new in_app deliveries as delivered immediately
  for (const n of merged.newlyCreated) {
    if (n.channel === "in_app" && n.delivery.status === "pending") {
      n.delivery.status = "delivered";
      n.delivery.deliveredAt = new Date().toISOString();
    }
  }

  // ---- Email channel: dispatch any net-new urgent notifications --------
  const dispatchAttempts: DispatchAttempt[] = [];
  const userEmail = ctx.user.email ?? null;
  for (const n of merged.newlyCreated) {
    if (n.channel !== "email") continue;
    if (n.delivery.status !== "pending") continue;
    if (!userEmail) {
      // No address on file — the dispatcher would error. Record the skip.
      dispatchAttempts.push({
        notificationId: n.id,
        dedupeKey: n.dedupeKey,
        channel: "email",
        mode: "audit_only",
        attemptedAt: new Date().toISOString(),
        outcome: "skipped",
        errorMessage: "No email on file for the user",
      });
      continue;
    }
    const attempt = await dispatchEmail({
      notificationId: n.id,
      dedupeKey: n.dedupeKey,
      message: {
        to: userEmail,
        subject: n.title,
        bodyText: `${n.body}\n\nOpen GoMate: ${process.env.PUBLIC_APP_BASE_URL ?? "http://localhost:5174"}${n.targetRoute}`,
      },
    });
    dispatchAttempts.push(attempt);
    if (attempt.outcome === "sent" || attempt.outcome === "logged") {
      n.delivery.status = "delivered";
      n.delivery.deliveredAt = attempt.attemptedAt;
    }
  }

  // Mirror delivery state onto the merged copy so the response payload
  // reflects what was just persisted.
  const byId = new Map(merged.newlyCreated.map((n) => [n.id, n]));
  for (const m of merged.merged) {
    const updated = byId.get(m.id);
    if (updated) {
      m.delivery = updated.delivery;
      m.channel = updated.channel;
    }
  }

  await persistNotifications(ctx, planRow, merged.merged, dispatchAttempts);

  return {
    planId: planRow.id,
    generatedAt: new Date().toISOString(),
    notifications: merged.merged,
    counts: countNotifications(merged.merged),
  };
}

// ---- Routes ---------------------------------------------------------------

router.get("/notifications", async (req: Request, res: Response) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const plan = await loadPlan(ctx);
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    const payload = await syncOnce(ctx, plan);
    res.json(payload);
  } catch (err) {
    logger.error({ err }, "notifications GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications/sync", async (req: Request, res: Response) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const plan = await loadPlan(ctx);
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    const payload = await syncOnce(ctx, plan);
    res.json(payload);
  } catch (err) {
    logger.error({ err }, "notifications/sync POST threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/notifications/scheduler-tick — manually fire a scheduler tick.
 * Used by tests + admin tooling to drive a proactive sweep on demand
 * without waiting for the interval. Auth-gated like everything else;
 * the tick scope is system-wide but we only let an authenticated user
 * trigger it.
 */
router.post("/notifications/scheduler-tick", async (req: Request, res: Response) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const stats = await runSchedulerTick();
    res.json({ ok: true, stats });
  } catch (err) {
    logger.error({ err }, "scheduler-tick POST threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/notifications/:id", async (req: Request, res: Response) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const idParam = req.params.id;
    const action = (req.body as { action?: unknown }).action;
    if (action !== "read" && action !== "dismiss" && action !== "unread") {
      res.status(400).json({ error: "Invalid action; expected 'read' | 'dismiss' | 'unread'" });
      return;
    }
    const plan = await loadPlan(ctx);
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    const stored = await loadStoredNotifications(plan);
    const idx = stored.findIndex((n) => n.id === idParam);
    if (idx < 0) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    const next = { ...stored[idx] };
    const nowIso = new Date().toISOString();
    if (action === "read") {
      next.delivery = { ...next.delivery, status: "read" };
      next.lastUserActionAt = nowIso;
    } else if (action === "dismiss") {
      next.delivery = { ...next.delivery, status: "dismissed" };
      next.lastUserActionAt = nowIso;
    } else if (action === "unread") {
      next.delivery = { ...next.delivery, status: "delivered" };
      next.lastUserActionAt = nowIso;
    }
    const updated = stored.slice();
    updated[idx] = next;
    await persistNotifications(ctx, plan, updated);
    res.json({ ok: true, notification: next });
  } catch (err) {
    logger.error({ err }, "notifications PATCH threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
