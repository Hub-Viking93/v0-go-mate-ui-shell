// =============================================================
// @workspace/agents — unified deadline + urgency model
// =============================================================
// Pure code, no LLM. One source of truth for how task deadlines
// are described, computed, and ranked across both phases of the
// journey:
//
//   pre-departure  → weeks-relative-to-move-date
//   settling-in    → days-relative-to-arrival-date
//
// Both reduce to the same shape: a `DeadlineRule` { relativeTo,
// daysOffset, deadlineType }. Helpers below convert a rule + the
// relevant reference date to an absolute `due_at`, and bucket the
// gap to "now" into a four-level urgency.
//
// Deadlines are RULE-DRIVEN, never AI-guessed. Contributors in
// pre-departure.ts / settling-in.ts hand-author the rules; the
// API layer materialises them against the user's profile dates.
// =============================================================

/**
 * The legal weight of a deadline.
 *   legal       — required by law / regulation. Missing it triggers a fine,
 *                 visa rejection, work stoppage, or similar concrete penalty.
 *   practical   — strongly recommended in practice. Missing it cascades into
 *                 blocked downstream tasks (no bank account, no salary, etc.)
 *                 but isn't itself unlawful.
 *   recommended — best-practice; user can defer or skip without consequence.
 */
export type DeadlineType = "legal" | "practical" | "recommended";

/**
 * Four-level urgency bucket relative to "now".
 *   overdue     — due_at strictly in the past
 *   urgent      — due within 3 days from now (inclusive)
 *   approaching — due within 14 days from now
 *   normal      — everything else, including no deadline at all
 */
export type Urgency = "overdue" | "urgent" | "approaching" | "normal";

/**
 * Reference dates a deadline can hang off.
 *   arrival     — settling-in default (= arrival_date in the plan)
 *   move_date   — pre-departure default (= chosen move/arrival date)
 *   visa_issue  — once the visa decision lands; offset is days FROM that date
 *   lease_start — start date of the destination lease
 */
export type DeadlineRelativeTo =
  | "arrival"
  | "move_date"
  | "visa_issue"
  | "lease_start";

/**
 * A self-contained, hand-authored deadline rule.
 *
 * For pre-departure actions the offset is NEGATIVE (deadline N days BEFORE
 * the move). For post-arrival tasks it is POSITIVE (deadline N days AFTER
 * arrival).
 */
export interface DeadlineRule {
  relativeTo: DeadlineRelativeTo;
  daysOffset: number;
  deadlineType: DeadlineType;
}

/** Reference dates supplied by the API layer at materialisation time. */
export interface DeadlineRefDates {
  arrivalDate?: Date | null;
  moveDate?: Date | null;
  visaIssueDate?: Date | null;
  leaseStartDate?: Date | null;
}

/**
 * Resolve a `DeadlineRule` against the user's profile reference dates.
 * Returns null when the rule cannot be materialised (the corresponding
 * reference date is unknown).
 */
export function computeDueAt(
  rule: DeadlineRule,
  refs: DeadlineRefDates,
): Date | null {
  const ref = pickRef(rule.relativeTo, refs);
  if (!ref) return null;
  const ms = ref.getTime() + rule.daysOffset * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

function pickRef(
  relativeTo: DeadlineRelativeTo,
  refs: DeadlineRefDates,
): Date | null {
  switch (relativeTo) {
    case "arrival":
      return refs.arrivalDate ?? null;
    case "move_date":
      return refs.moveDate ?? null;
    case "visa_issue":
      return refs.visaIssueDate ?? null;
    case "lease_start":
      return refs.leaseStartDate ?? null;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bucket the gap between `dueAt` and `now` into one of four urgency
 * levels. Tasks without a deadline always return "normal". The buckets
 * are intentionally coarse — fine-grained countdowns belong to the UI.
 */
export function computeUrgency(
  dueAt: Date | null | undefined,
  now: Date = new Date(),
): Urgency {
  if (!dueAt) return "normal";
  const diffMs = dueAt.getTime() - now.getTime();
  if (diffMs < 0) return "overdue";
  const diffDays = Math.ceil(diffMs / DAY_MS);
  if (diffDays <= 3) return "urgent";
  if (diffDays <= 14) return "approaching";
  return "normal";
}

/**
 * Days between `dueAt` and `now`. Negative when overdue. Returns null
 * when `dueAt` is null. Result is rounded to whole days using ceiling
 * so "due in <24h" reads as "1 day" rather than "0 days".
 */
export function daysUntil(
  dueAt: Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!dueAt) return null;
  const diffMs = dueAt.getTime() - now.getTime();
  if (diffMs < 0) return -Math.ceil(-diffMs / DAY_MS);
  return Math.ceil(diffMs / DAY_MS);
}

/**
 * Sort comparator: most-urgent-first, ties broken by earliest deadline.
 * Stable callers should append a final tie-breaker (e.g. sortOrder).
 */
export const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0,
  urgent: 1,
  approaching: 2,
  normal: 3,
};

export function compareByUrgency<T extends { urgency: Urgency; due_at?: string | null }>(
  a: T,
  b: T,
): number {
  const r = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  if (r !== 0) return r;
  const aMs = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
  const bMs = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
  return aMs - bMs;
}

/**
 * Best-effort heuristic to map a free-form "legal consequence if missed"
 * string into a DeadlineType. Used by pre-departure where the existing
 * data model carries a sentence rather than an enum.
 *
 * Returns "legal" for visa / fine / detention / refusal language, "recommended"
 * for explicit "optional" / "nice-to-have" language, otherwise "practical".
 */
export function inferDeadlineTypeFromConsequence(
  consequence: string | null | undefined,
): DeadlineType {
  if (!consequence) return "practical";
  const c = consequence.toLowerCase();
  if (
    c.includes("visa") ||
    c.includes("permit") ||
    c.includes("rejected") ||
    c.includes("refused") ||
    c.includes("denied") ||
    c.includes("fine") ||
    c.includes("detention") ||
    c.includes("detained") ||
    c.includes("ban") ||
    c.includes("possession charge") ||
    c.includes("entry refused") ||
    c.includes("work stoppage") ||
    c.includes("double tax") ||
    c.includes("double social") ||
    c.includes("€")
  ) {
    return "legal";
  }
  if (
    c.includes("optional") ||
    c.includes("nice-to-have") ||
    c.includes("nice to have") ||
    c.includes("recommended")
  ) {
    return "recommended";
  }
  return "practical";
}

/** Human-friendly badge label for the urgency bucket. */
export function urgencyBadgeLabel(
  urgency: Urgency,
  daysLeft: number | null,
): string {
  if (urgency === "overdue") {
    if (daysLeft !== null) return `Overdue by ${Math.abs(daysLeft)}d`;
    return "Overdue";
  }
  if (urgency === "urgent") {
    if (daysLeft === null || daysLeft <= 0) return "Due today";
    if (daysLeft === 1) return "Due tomorrow";
    return `Due in ${daysLeft}d`;
  }
  if (urgency === "approaching") {
    if (daysLeft !== null && daysLeft <= 7) return "Due this week";
    return daysLeft !== null ? `Due in ${daysLeft}d` : "Due soon";
  }
  return "Upcoming";
}
