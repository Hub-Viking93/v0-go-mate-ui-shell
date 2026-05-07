// =============================================================
// @workspace/agents — Phase 6A notifications layer
// =============================================================
// Proactive nudging. Pure code: given user state + already-stored
// notifications, return the merged set of notifications the user
// should see right now.
//
// Five trigger types in v1:
//   1. deadline_overdue   — settling-in / pre-departure task is overdue
//   2. deadline_now       — task is due today / tomorrow
//   3. document_missing   — a required document for a current-stage task
//                            isn't on file yet, AND the task is open
//   4. risk_blocker       — high-severity risk currently flagged
//   5. arrival_imminent   — arrival within 7 days and unfinished prep
//
// Phase 6A explicit non-goals:
//   • No family / dependents triggers (Phase 6B).
//   • No tax-overview triggers (Phase 6C).
//   • No rule-change watchers (Phase 6D).
//   • No marketing / engagement automation.
//   • No multi-channel push stack — model carries a channel field but the
//     v1 dispatcher only delivers `in_app`.
//   • No spam: every trigger has a stable dedupe_key so re-syncing the
//     same state never creates duplicate notifications.
// =============================================================

// ---- Public types ---------------------------------------------------------

export type NotificationType =
  | "deadline_overdue"
  | "deadline_now"
  | "document_missing"
  | "risk_blocker"
  | "arrival_imminent";

export type NotificationSeverity = "info" | "nudge" | "urgent";

export type NotificationChannel = "in_app" | "email";

export type NotificationStatus = "pending" | "delivered" | "read" | "dismissed";

export interface NotificationDeliveryRecord {
  channel: NotificationChannel;
  status: NotificationStatus;
  /** ISO-8601 timestamp when the notification first hit the channel. */
  deliveredAt: string | null;
}

export interface NotificationTargetRef {
  /** A reference to the entity the notification is about — e.g. the
   *  task_key for a settling-in task, the document_id for a vault item,
   *  the risk_id, etc. */
  kind: "task" | "document" | "risk" | "plan";
  ref: string;
}

export interface Notification {
  /** Stable id — `notif:<sha-stub>:<dedupe_key>`. */
  id: string;
  /** Used to deduplicate across syncs — same dedupe_key = same logical
   *  notification, irrespective of payload changes. */
  dedupeKey: string;
  type: NotificationType;
  severity: NotificationSeverity;
  /** Single-line headline. */
  title: string;
  /** 1-2 sentences explaining WHY now + WHAT to do. */
  body: string;
  /** SPA route the user should open to act on this. */
  targetRoute: string;
  /** Optional reference to the entity. */
  targetRef: NotificationTargetRef | null;
  /** What channel the user expects this on. v1 = always `in_app` for
   *  surfacing inside the app; the model is forward-compatible with
   *  `email` when a provider is wired up. */
  channel: NotificationChannel;
  /** ISO-8601 — used for sorting + auto-archival. */
  createdAt: string;
  /** Latest known delivery state. */
  delivery: NotificationDeliveryRecord;
}

export interface NotificationStored extends Notification {
  /** ISO-8601 — when the user last marked it read / dismissed. */
  lastUserActionAt?: string | null;
}

// ---- Inputs ---------------------------------------------------------------

export interface NotificationProfileInputs {
  destination?: string | null;
  visa_role?: string | null;
}

export interface NotificationTaskInput {
  taskKey: string;
  title: string;
  status: "available" | "in_progress" | "completed" | "blocked" | "deferred";
  /** Hard deadline, ISO date or null. */
  deadlineAt: string | null;
  /** Pre-computed urgency from Phase 1A. */
  urgency: "overdue" | "now" | "soon" | "later" | "no_deadline";
  /** Document categories required for completion. */
  requiredDocumentCategories?: string[];
  /** When set, navigation lands the user on the right list/tab. */
  category?: "pre_move" | "post_move" | "settling_in" | "registration" | string;
}

export interface NotificationDocumentInput {
  /** Categories the user has a doc for. */
  categories: string[];
}

export interface NotificationRiskInput {
  id: string;
  severity: "info" | "warning" | "blocker";
  title: string;
  /** Optional ref into the dashboard the user should follow. */
  blockedTaskRef?: string | null;
}

export interface NotificationInputs {
  profile: NotificationProfileInputs;
  arrivalDate: string | null;
  stage: string | null;
  tasks: NotificationTaskInput[];
  documents: NotificationDocumentInput;
  risks: NotificationRiskInput[];
  /** Notifications already on file for this user (for merge / dedupe). */
  stored: NotificationStored[];
  /** Override clock for tests. */
  now?: Date;
}

// ---- Helpers --------------------------------------------------------------

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function daysBetween(aIso: string | null | undefined, b: Date): number | null {
  if (!aIso) return null;
  const ms = Date.parse(aIso);
  if (!Number.isFinite(ms)) return null;
  return Math.round((ms - b.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Stable id from a dedupe_key. We don't pull in a hashing dep — a tiny
 * deterministic mixer is enough for ordering + identity within a single
 * user's notifications.
 */
function notificationId(dedupeKey: string): string {
  let h = 0;
  for (let i = 0; i < dedupeKey.length; i++) {
    h = ((h << 5) - h + dedupeKey.charCodeAt(i)) | 0;
  }
  const stub = (h >>> 0).toString(36).padStart(7, "0").slice(0, 7);
  return `notif:${stub}:${dedupeKey}`;
}

/**
 * Channel selection rule:
 *   • Urgent triggers (overdue, blocker, arrival imminent) → email so the
 *     user is reached even if they aren't in the app.
 *   • Nudge / info triggers (due-soon, document missing) → in-app only —
 *     these aren't worth interrupting on email.
 *
 * The email channel still requires the dispatcher to actually deliver;
 * the field is the *intended* channel.
 */
function pickChannelForType(
  type: NotificationType,
  severity: NotificationSeverity,
): NotificationChannel {
  if (severity === "urgent") return "email";
  if (type === "arrival_imminent") return "email";
  return "in_app";
}

function pickRouteForTask(task: NotificationTaskInput): string {
  if (task.category === "pre_move") return "/checklist?tab=pre-move";
  if (
    task.category === "post_move" ||
    task.category === "settling_in" ||
    task.category === "registration"
  ) {
    return "/checklist?tab=post-move";
  }
  return "/checklist";
}

// ---- Builders -------------------------------------------------------------

function buildDeadlineNotification(task: NotificationTaskInput, now: Date): Notification | null {
  if (task.status === "completed") return null;
  const days = daysBetween(task.deadlineAt, now);
  let type: NotificationType;
  let severity: NotificationSeverity;
  let title: string;
  let body: string;

  if (task.urgency === "overdue") {
    type = "deadline_overdue";
    severity = "urgent";
    title = `Overdue: ${task.title}`;
    body =
      days !== null && days < 0
        ? `This task was due ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago. Complete it as soon as possible — it's blocking other steps from moving forward.`
        : `This task is overdue. Complete it as soon as possible — it's blocking other steps from moving forward.`;
  } else if (task.urgency === "now") {
    type = "deadline_now";
    severity = "nudge";
    title = `Due ${days === 0 ? "today" : days === 1 ? "tomorrow" : "soon"}: ${task.title}`;
    body = `This task is due ${days === 0 ? "today" : days === 1 ? "tomorrow" : "this week"}. Knock it out before it slips into the overdue bucket.`;
  } else {
    return null;
  }

  const dedupeKey = `${type}:${task.taskKey}`;
  const channel = pickChannelForType(type, severity);
  return {
    id: notificationId(dedupeKey),
    dedupeKey,
    type,
    severity,
    title,
    body,
    targetRoute: pickRouteForTask(task),
    targetRef: { kind: "task", ref: task.taskKey },
    channel,
    createdAt: nowIso(now),
    delivery: {
      channel,
      status: "pending",
      deliveredAt: null,
    },
  };
}

function buildDocumentMissingNotification(
  task: NotificationTaskInput,
  documents: NotificationDocumentInput,
  now: Date,
): Notification | null {
  const required = task.requiredDocumentCategories ?? [];
  if (required.length === 0) return null;
  if (task.status === "completed") return null;
  // Only nudge for tasks that are within their actionable window.
  if (task.urgency === "later" || task.urgency === "no_deadline") return null;
  const have = new Set(documents.categories);
  const missing = required.filter((c) => !have.has(c));
  if (missing.length === 0) return null;

  const dedupeKey = `document_missing:${task.taskKey}:${missing.sort().join(",")}`;
  const title = `Missing document for: ${task.title}`;
  const body = `${missing.length === 1 ? "A document" : `${missing.length} documents`} required for this task ${missing.length === 1 ? "isn't" : "aren't"} in the vault yet (${missing.join(", ")}). Upload to keep the task on track.`;
  const severity: NotificationSeverity = task.urgency === "overdue" ? "urgent" : "nudge";
  const channel = pickChannelForType("document_missing", severity);
  return {
    id: notificationId(dedupeKey),
    dedupeKey,
    type: "document_missing",
    severity,
    title,
    body,
    targetRoute: "/vault",
    targetRef: { kind: "task", ref: task.taskKey },
    channel,
    createdAt: nowIso(now),
    delivery: {
      channel,
      status: "pending",
      deliveredAt: null,
    },
  };
}

function buildRiskNotification(risk: NotificationRiskInput, now: Date): Notification | null {
  // Only blocker-severity risks become notifications. Warnings stay
  // surfaced on the dashboard — we don't want to over-trigger.
  if (risk.severity !== "blocker") return null;
  const dedupeKey = `risk_blocker:${risk.id}`;
  const targetRoute = risk.blockedTaskRef
    ? risk.blockedTaskRef.startsWith("settling-in")
      ? "/checklist?tab=post-move"
      : "/checklist?tab=pre-move"
    : "/dashboard";
  const channel = pickChannelForType("risk_blocker", "urgent");
  return {
    id: notificationId(dedupeKey),
    dedupeKey,
    type: "risk_blocker",
    severity: "urgent",
    title: `Blocker: ${risk.title}`,
    body: `This is currently blocking your move forward. Open the dashboard to see what to do next.`,
    targetRoute,
    targetRef: { kind: "risk", ref: risk.id },
    channel,
    createdAt: nowIso(now),
    delivery: {
      channel,
      status: "pending",
      deliveredAt: null,
    },
  };
}

function buildArrivalImminentNotification(
  inputs: NotificationInputs,
  now: Date,
): Notification | null {
  const days = daysBetween(inputs.arrivalDate, now);
  if (days === null) return null;
  if (days < 0 || days > 7) return null;

  // Only fire if there are still open pre-move / pre-departure tasks.
  const stillOpenPre = inputs.tasks.filter(
    (t) =>
      (t.category === "pre_move" || t.category === "pre_departure") &&
      t.status !== "completed",
  );
  if (stillOpenPre.length === 0) return null;

  const dedupeKey = `arrival_imminent:${inputs.arrivalDate}`;
  const title =
    days === 0
      ? "Arrival is today — final pre-move sweep"
      : days === 1
      ? "Arrival is tomorrow — final pre-move sweep"
      : `Arrival in ${days} days — final pre-move sweep`;
  const body = `${stillOpenPre.length} pre-move task${stillOpenPre.length === 1 ? "" : "s"} still open. Triage what must finish before you fly.`;
  const channel = pickChannelForType("arrival_imminent", "urgent");
  return {
    id: notificationId(dedupeKey),
    dedupeKey,
    type: "arrival_imminent",
    severity: "urgent",
    title,
    body,
    targetRoute: "/checklist?tab=pre-move",
    targetRef: { kind: "plan", ref: "arrival-imminent" },
    channel,
    createdAt: nowIso(now),
    delivery: {
      channel,
      status: "pending",
      deliveredAt: null,
    },
  };
}

// ---- Compose --------------------------------------------------------------

export function computeNotifications(inputs: NotificationInputs): Notification[] {
  const now = inputs.now ?? new Date();
  const out: Notification[] = [];

  for (const t of inputs.tasks) {
    const dl = buildDeadlineNotification(t, now);
    if (dl) out.push(dl);
    const doc = buildDocumentMissingNotification(t, inputs.documents, now);
    if (doc) out.push(doc);
  }
  for (const r of inputs.risks) {
    const n = buildRiskNotification(r, now);
    if (n) out.push(n);
  }
  const arr = buildArrivalImminentNotification(inputs, now);
  if (arr) out.push(arr);

  // Stable sort: severity desc, then createdAt desc, then dedupeKey alpha.
  const SEV_RANK: Record<NotificationSeverity, number> = { urgent: 0, nudge: 1, info: 2 };
  out.sort((a, b) => {
    const r = SEV_RANK[a.severity] - SEV_RANK[b.severity];
    if (r !== 0) return r;
    if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt);
    return a.dedupeKey.localeCompare(b.dedupeKey);
  });
  return out;
}

// ---- Merge: idempotent persistence ----------------------------------------

const ARCHIVE_AFTER_DAYS = 30;

export interface MergeResult {
  /** The full notification set after merge. */
  merged: NotificationStored[];
  /** Net-new notifications that didn't exist before (for dispatcher hand-off). */
  newlyCreated: NotificationStored[];
  /** Notifications removed because they're stale + auto-archived. */
  removed: NotificationStored[];
}

/**
 * Merge freshly-computed notifications with the stored set:
 *   • Preserves user-action state (read / dismissed).
 *   • Updates body / title / severity from latest computation.
 *   • Net-new notifications keep delivery.status='pending' so the
 *     dispatcher can pick them up on the next tick.
 *   • Old notifications whose dedupe_key no longer fires AND were not
 *     touched recently (>30 days) get auto-removed.
 */
export function mergeNotifications(
  stored: NotificationStored[],
  computed: Notification[],
  now?: Date,
): MergeResult {
  const at = now ?? new Date();
  const storedByKey = new Map<string, NotificationStored>();
  for (const s of stored) storedByKey.set(s.dedupeKey, s);

  const computedKeys = new Set<string>();
  const merged: NotificationStored[] = [];
  const newlyCreated: NotificationStored[] = [];

  for (const c of computed) {
    computedKeys.add(c.dedupeKey);
    const prior = storedByKey.get(c.dedupeKey);
    if (prior) {
      // Update copy + severity from latest compute, but preserve
      // user-action state + delivery state.
      const next: NotificationStored = {
        ...prior,
        title: c.title,
        body: c.body,
        severity: c.severity,
        targetRoute: c.targetRoute,
        targetRef: c.targetRef,
      };
      merged.push(next);
    } else {
      const stored: NotificationStored = { ...c, lastUserActionAt: null };
      merged.push(stored);
      newlyCreated.push(stored);
    }
  }

  // Carry forward notifications that the user has acted on (read /
  // dismissed) even if they no longer fire — for a small window so the
  // user can scroll back. After 30 days, archive.
  const removed: NotificationStored[] = [];
  for (const s of stored) {
    if (computedKeys.has(s.dedupeKey)) continue;
    const ageDays =
      s.lastUserActionAt
        ? Math.round((at.getTime() - Date.parse(s.lastUserActionAt)) / (24 * 60 * 60 * 1000))
        : Math.round((at.getTime() - Date.parse(s.createdAt)) / (24 * 60 * 60 * 1000));
    if (ageDays > ARCHIVE_AFTER_DAYS) {
      removed.push(s);
      continue;
    }
    if (s.delivery.status === "read" || s.delivery.status === "dismissed") {
      // Keep the historical record.
      merged.push(s);
    } else {
      // The trigger no longer fires AND the user hasn't acted on it.
      // Drop it — we only want to surface things still alive in state.
      removed.push(s);
    }
  }

  // Stable sort across the final set: undismissed urgent first, then
  // created desc.
  const SEV_RANK: Record<NotificationSeverity, number> = { urgent: 0, nudge: 1, info: 2 };
  merged.sort((a, b) => {
    const aDismissed = a.delivery.status === "dismissed" ? 1 : 0;
    const bDismissed = b.delivery.status === "dismissed" ? 1 : 0;
    if (aDismissed !== bDismissed) return aDismissed - bDismissed;
    const aRead = a.delivery.status === "read" ? 1 : 0;
    const bRead = b.delivery.status === "read" ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead;
    const sr = SEV_RANK[a.severity] - SEV_RANK[b.severity];
    if (sr !== 0) return sr;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return { merged, newlyCreated, removed };
}

// ---- Counts ---------------------------------------------------------------

export interface NotificationCounts {
  total: number;
  unread: number;
  urgentUnread: number;
}

export function countNotifications(stored: NotificationStored[]): NotificationCounts {
  let unread = 0;
  let urgentUnread = 0;
  for (const n of stored) {
    if (n.delivery.status === "read" || n.delivery.status === "dismissed") continue;
    unread += 1;
    if (n.severity === "urgent") urgentUnread += 1;
  }
  return {
    total: stored.length,
    unread,
    urgentUnread,
  };
}
