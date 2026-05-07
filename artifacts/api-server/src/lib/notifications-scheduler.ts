// =============================================================
// Phase 6A — notifications scheduler
// =============================================================
// Background tick that runs OUTSIDE the request cycle. Iterates over
// active relocation plans, computes notifications, and dispatches any
// net-new email-channel ones via the email dispatcher.
//
// This makes the system proactive — the user gets pinged even when
// they aren't in the dashboard. Without this, "notifications" is just
// an in-app inbox.
//
// Cadence: by default ticks every 30 minutes. Configurable via
// NOTIFICATIONS_SCHEDULER_INTERVAL_MS. Set to 0 (or negative) to disable
// — useful in tests where we want to drive ticks manually.
// =============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  computeNotifications,
  countNotifications,
  mergeNotifications,
  type NotificationDocumentInput,
  type NotificationInputs,
  type NotificationRiskInput,
  type NotificationStored,
  type NotificationTaskInput,
} from "@workspace/agents";
import {
  dispatchEmail,
  type DispatchAttempt,
} from "./email-dispatcher";
import { logger } from "./logger";
import { applyResearchMetaPatch } from "./research-meta-patch";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface PlanRow {
  id: string;
  user_id: string;
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
  plan_id: string;
}

interface PreDepartureRow {
  id: string;
  title: string;
  status: string | null;
  deadline_at: string | null;
  required_documents: unknown;
  plan_id: string;
}

interface DocumentRow {
  category: string | null;
  plan_id: string;
}

let timer: NodeJS.Timeout | null = null;
let inFlight = false;
let admin: SupabaseClient | null = null;

function adminClient(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error(
      "Notifications scheduler requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to be set.",
    );
  }
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
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

function mapUrgencyFromAt(deadlineAt: string | null, status: string | null, now: Date): NotificationTaskInput["urgency"] {
  if (status === "completed" || status === "skipped") return "no_deadline";
  if (!deadlineAt) return "no_deadline";
  const ms = Date.parse(deadlineAt);
  if (!Number.isFinite(ms)) return "no_deadline";
  const days = Math.round((ms - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "overdue";
  if (days <= 7) return "now";
  if (days <= 30) return "soon";
  return "later";
}

interface TickStats {
  plansScanned: number;
  notificationsCreated: number;
  emailsSent: number;
  emailsLogged: number;
  emailsErrored: number;
}

/**
 * Run a single scheduler tick. Exported so callers can drive it manually
 * (tests, admin endpoints, cron-style external triggers).
 */
export async function runSchedulerTick(now: Date = new Date()): Promise<TickStats> {
  const stats: TickStats = {
    plansScanned: 0,
    notificationsCreated: 0,
    emailsSent: 0,
    emailsLogged: 0,
    emailsErrored: 0,
  };
  if (inFlight) {
    logger.warn("[notifications-scheduler] previous tick still in flight — skipping");
    return stats;
  }
  inFlight = true;
  try {
    const a = adminClient();
    const { data: plans, error } = await a
      .from("relocation_plans")
      .select("id, user_id, stage, arrival_date, profile_data, research_meta")
      .eq("is_current", true)
      .returns<PlanRow[]>();
    if (error) {
      logger.error({ err: error }, "[notifications-scheduler] failed to load plans");
      return stats;
    }
    if (!plans || plans.length === 0) return stats;

    const planIds = plans.map((p) => p.id);

    const [settlingResp, preResp, docsResp] = await Promise.all([
      a
        .from("settling_in_tasks")
        .select("task_key, title, status, deadline_at, category, documents_needed, plan_id")
        .in("plan_id", planIds)
        .returns<SettlingTaskRow[]>(),
      a
        .from("pre_departure_actions")
        .select("id, title, status, deadline_at, required_documents, plan_id")
        .in("plan_id", planIds)
        .returns<PreDepartureRow[]>(),
      a
        .from("relocation_documents")
        .select("category, plan_id")
        .in("plan_id", planIds)
        .returns<DocumentRow[]>(),
    ]);

    const settlingByPlan = groupBy(settlingResp.data ?? [], (r) => r.plan_id);
    const preByPlan = groupBy(preResp.data ?? [], (r) => r.plan_id);
    const docsByPlan = groupBy(docsResp.data ?? [], (r) => r.plan_id);

    for (const plan of plans) {
      stats.plansScanned += 1;
      const profile = (plan.profile_data ?? {}) as Record<string, unknown>;
      const settling = settlingByPlan.get(plan.id) ?? [];
      const pre = preByPlan.get(plan.id) ?? [];
      const docs = docsByPlan.get(plan.id) ?? [];

      const tasks: NotificationTaskInput[] = [
        ...settling.map((r) => ({
          taskKey: r.task_key,
          title: r.title,
          status: mapTaskStatus(r.status),
          deadlineAt: r.deadline_at,
          urgency: mapUrgencyFromAt(r.deadline_at, r.status, now),
          requiredDocumentCategories: asStringArray(r.documents_needed),
          category: r.category ?? "settling_in",
        })),
        ...pre.map((r) => ({
          taskKey: `pre-departure:${r.id}`,
          title: r.title,
          status: mapTaskStatus(r.status),
          deadlineAt: r.deadline_at,
          urgency: mapUrgencyFromAt(r.deadline_at, r.status, now),
          requiredDocumentCategories: asStringArray(r.required_documents),
          category: "pre_move",
        })),
      ];

      const documents: NotificationDocumentInput = {
        categories: docs
          .map((d) => d.category)
          .filter((c): c is string => typeof c === "string"),
      };

      const meta = (plan.research_meta ?? {}) as Record<string, unknown>;
      const cachedRisks = Array.isArray(meta.risks) ? (meta.risks as Array<{ id: string; severity: string; title: string; blocked_task_ref?: string | null }>) : [];
      const risks: NotificationRiskInput[] = cachedRisks.map((r) => ({
        id: r.id,
        severity:
          r.severity === "critical" ? "blocker" : r.severity === "warning" ? "warning" : "info",
        title: r.title,
        blockedTaskRef: r.blocked_task_ref ?? null,
      }));

      const stored = Array.isArray(meta.notifications)
        ? (meta.notifications as NotificationStored[])
        : [];

      const inputs: NotificationInputs = {
        profile: {
          destination: typeof profile.destination === "string" ? profile.destination : null,
          visa_role: typeof profile.visa_role === "string" ? profile.visa_role : null,
        },
        arrivalDate: plan.arrival_date,
        stage: plan.stage,
        tasks,
        documents,
        risks,
        stored,
        now,
      };

      const computed = computeNotifications(inputs);
      const merged = mergeNotifications(stored, computed, now);
      stats.notificationsCreated += merged.newlyCreated.length;

      // Mark in-app deliveries.
      for (const n of merged.newlyCreated) {
        if (n.channel === "in_app" && n.delivery.status === "pending") {
          n.delivery.status = "delivered";
          n.delivery.deliveredAt = new Date().toISOString();
        }
      }

      // Resolve user email via service role auth admin.
      let userEmail: string | null = null;
      try {
        const { data: userRes } = await a.auth.admin.getUserById(plan.user_id);
        userEmail = userRes?.user?.email ?? null;
      } catch (err) {
        logger.warn(
          { planId: plan.id, err },
          "[notifications-scheduler] failed to resolve user email",
        );
      }

      const dispatchAttempts: DispatchAttempt[] = [];
      for (const n of merged.newlyCreated) {
        if (n.channel !== "email") continue;
        if (n.delivery.status !== "pending") continue;
        if (!userEmail) {
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
        if (attempt.outcome === "sent") stats.emailsSent += 1;
        else if (attempt.outcome === "logged") stats.emailsLogged += 1;
        else if (attempt.outcome === "error") stats.emailsErrored += 1;
        if (attempt.outcome === "sent" || attempt.outcome === "logged") {
          n.delivery.status = "delivered";
          n.delivery.deliveredAt = attempt.attemptedAt;
        }
      }

      // Persist back. Append to delivery audit (cap to last 200).
      const priorDeliveries = Array.isArray(meta.notification_deliveries)
        ? (meta.notification_deliveries as DispatchAttempt[])
        : [];
      const deliveries = [...priorDeliveries, ...dispatchAttempts].slice(-200);

      const byId = new Map(merged.newlyCreated.map((n) => [n.id, n]));
      for (const m of merged.merged) {
        const updated = byId.get(m.id);
        if (updated) {
          m.delivery = updated.delivery;
          m.channel = updated.channel;
        }
      }

      const counts = countNotifications(merged.merged);
      // Phase F1 — atomic JSONB-merge so the scheduler tick only
      // touches the three sub-keys it actually owns. The previous
      // {...meta, notifications, ...} pattern was the primary cause
      // of the lost-update race observed during E1b: when a
      // concurrent writer (e.g. POST /api/research/refresh) mutated
      // research_meta.researchedSpecialists between this tick's read
      // and write, the mutation got clobbered by the stale `meta`
      // snapshot. Patching only our keys lets concurrent writes to
      // other sub-keys survive.
      try {
        await applyResearchMetaPatch(a, plan.id, {
          notifications: merged.merged,
          notification_deliveries: deliveries,
          notification_last_tick: {
            at: new Date().toISOString(),
            counts,
            newlyCreated: merged.newlyCreated.length,
            dispatchAttempts: dispatchAttempts.length,
          },
        });
      } catch (err) {
        logger.error(
          { planId: plan.id, err },
          "[notifications-scheduler] failed to persist tick result",
        );
      }
    }

    return stats;
  } finally {
    inFlight = false;
  }
}

export function startNotificationsScheduler(): void {
  const raw = process.env.NOTIFICATIONS_SCHEDULER_INTERVAL_MS;
  const intervalMs = raw === undefined ? DEFAULT_INTERVAL_MS : Number.parseInt(raw, 10);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    logger.info(
      { configured: raw ?? "unset" },
      "[notifications-scheduler] disabled (interval ≤ 0)",
    );
    return;
  }
  if (timer) {
    logger.warn("[notifications-scheduler] already started");
    return;
  }
  // Fire one tick on startup so the system is proactive immediately.
  void runSchedulerTick().then((s) =>
    logger.info({ ...s }, "[notifications-scheduler] startup tick complete"),
  ).catch((err) =>
    logger.error({ err }, "[notifications-scheduler] startup tick failed"),
  );
  timer = setInterval(() => {
    void runSchedulerTick().then((s) =>
      logger.info({ ...s }, "[notifications-scheduler] tick complete"),
    ).catch((err) =>
      logger.error({ err }, "[notifications-scheduler] tick failed"),
    );
  }, intervalMs);
  // Don't keep the process alive solely for ticks.
  timer.unref?.();
  logger.info(
    { intervalMs },
    "[notifications-scheduler] started",
  );
}

export function stopNotificationsScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function groupBy<T>(arr: T[], keyOf: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = keyOf(x);
    const cur = m.get(k);
    if (cur) cur.push(x);
    else m.set(k, [x]);
  }
  return m;
}
