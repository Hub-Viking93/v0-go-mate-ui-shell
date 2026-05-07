// =============================================================
// Canonical "move date" model
// =============================================================
// `plan.arrival_date` (DATE) is the single source of truth used by
// readiness, the pre-departure DAG, deadlines, and every other reader.
// Pre-arrival it carries the TARGET date; post-arrival it's overwritten
// with the ACTUAL arrival.
//
// `profile_data.timeline` is the user-facing INPUT field. It may be:
//   • A YYYY-MM-DD ISO date — gets mirrored to `arrival_date`.
//   • The literal "flexible" — clears `arrival_date`.
//   • A vague string ("February", "June 2027", "ASAP", "not_sure") —
//     left only on profile.timeline; arrival_date is NOT touched.
//   • null — clears `arrival_date`.
//
// All write paths must run through `PATCH /api/profile`, which calls
// `deriveArrivalDateUpdate` to keep arrival_date in sync.
// All readers should call `resolveMoveDate(plan)` so legacy plans whose
// arrival_date is still null but whose profile.timeline holds an ISO
// date get the correct value during the migration window.
// =============================================================

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

/**
 * Decide what to write to `arrival_date` given an incoming `timeline`
 * value from a profile patch. Returns `{ touch: false }` when we should
 * leave whatever was there alone (vague values like "February").
 */
export function deriveArrivalDateUpdate(
  timeline: unknown,
): { touch: true; value: string | null } | { touch: false } {
  if (timeline === undefined) return { touch: false };
  if (timeline === null) return { touch: true, value: null };
  if (typeof timeline !== "string") return { touch: false };
  const t = timeline.trim();
  if (t === "") return { touch: true, value: null };
  if (t.toLowerCase() === "flexible") return { touch: true, value: null };
  if (isIsoDate(t)) return { touch: true, value: t };
  // Vague text ("February", "June 2027", "ASAP", "not_sure", …) — leave
  // arrival_date alone so we don't lose a previously-set real date or
  // synthesize a fake one.
  return { touch: false };
}

/**
 * Resolve the canonical move date for a plan. Prefers `plan.arrival_date`
 * (the synced canonical). Falls back to `profile.timeline` when it's a
 * real ISO date — covers legacy plans written before the sync existed.
 * Returns null if neither holds a real date.
 */
export function resolveMoveDate(plan: {
  arrival_date?: string | null;
  profile_data?: Record<string, unknown> | null;
}): string | null {
  if (plan.arrival_date) {
    // Supabase returns DATE as "YYYY-MM-DD"; TIMESTAMP-typed columns may
    // return ISO datetime. Strip to date portion for consistent compare.
    return String(plan.arrival_date).slice(0, 10);
  }
  const timeline = plan.profile_data?.timeline;
  if (isIsoDate(timeline)) return timeline;
  return null;
}
