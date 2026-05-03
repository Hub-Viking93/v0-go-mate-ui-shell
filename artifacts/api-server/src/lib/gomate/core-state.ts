export type PersistedFieldConfidence = "explicit" | "inferred" | "assumed";

export type CanonicalPlanStage =
  | "collecting"
  | "generating"
  | "complete"
  | "ready_for_pre_departure"
  | "pre_departure"
  | "arrived";

export type CanonicalPlanLifecycle =
  | "collecting"
  | "generating"
  | "ready_to_lock"
  | "locked"
  | "ready_for_pre_departure"
  | "pre_departure"
  | "arrived"
  | "archived";

export interface PlanStateInput {
  status?: string | null;
  stage?: string | null;
  locked?: boolean | null;
  profile_data?: unknown;
  /** v2 Wave 1.3: research worker terminal status. */
  research_status?: string | null;
  /** v2 Wave 1.3: when the user clicked "Generate my plan". */
  user_triggered_research_at?: string | null;
  /** v2 Wave 1.3: when the user clicked "Generate my pre-departure checklist". */
  user_triggered_pre_departure_at?: string | null;
  arrival_date?: string | null;
  /** v2 Wave 1.3: post-arrival onboarding finalised flag. */
  onboarding_completed?: boolean | null;
}

const V2_PERSISTED_STAGES: ReadonlyArray<CanonicalPlanStage> = [
  "generating",
  "ready_for_pre_departure",
  "pre_departure",
];

function isV2PersistedStage(value: unknown): value is CanonicalPlanStage {
  return typeof value === "string" && (V2_PERSISTED_STAGES as readonly string[]).includes(value);
}

function isResearchDone(researchStatus: string | null | undefined): boolean {
  return researchStatus === "completed" || researchStatus === "partial";
}

/**
 * v2 Wave 1.3: minimal universal-profile sanity check used by the
 * `/plans/trigger-research` endpoint to enforce the spec rule
 *   "isProfileComplete returns true AND user has clicked".
 *
 * Authoritative completeness lives in the frontend's
 * `getProfileReadiness` (it understands predicate-based requirements),
 * but the server file is intentionally decoupled from
 * `profile-schema.ts`. This helper is a defensive subset: it requires
 * the five always-required core identity fields. The frontend disables
 * the trigger button until the full schema's `isReadyForLock` flips, so
 * this check only catches malformed clients / direct API hits.
 */
const UNIVERSAL_REQUIRED_FIELDS = [
  "name",
  "citizenship",
  "current_location",
  "destination",
  "purpose",
] as const;

export function hasMinimalProfileForResearch(profileData: unknown): boolean {
  if (!profileData || typeof profileData !== "object") return false;
  const data = profileData as Record<string, unknown>;
  return UNIVERSAL_REQUIRED_FIELDS.every((key) => {
    const value = data[key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== "";
  });
}

/**
 * Server-side mirror of `deriveCanonicalStage` from
 * artifacts/gomate/src/lib/gomate/core-state.ts. Keep these two in sync.
 *
 * Authority order: arrived > persisted v2 stage > v1 `complete` (alias for
 * `ready_for_pre_departure`) > manual-trigger inference > collecting.
 *
 * Critical: profile completion alone does NOT advance the stage. The user
 * must click "Generate my plan" (which sets `user_triggered_research_at`)
 * to move from `collecting` to `generating`.
 *
 * Trust boundary: the manual-trigger inference branch trusts that
 * `user_triggered_*` timestamps were written by their corresponding POST
 * endpoints (which guard with `hasMinimalProfileForResearch` and stage
 * checks). For half-written or backfilled rows that never went through
 * those endpoints, this helper still produces a sensible canonical view.
 */
export function deriveCanonicalStageServer(plan: PlanStateInput): CanonicalPlanStage {
  if (plan.stage === "arrived") return "arrived";
  if (isV2PersistedStage(plan.stage)) return plan.stage as CanonicalPlanStage;
  if (plan.stage === "complete") return "ready_for_pre_departure";

  if (plan.user_triggered_pre_departure_at) return "pre_departure";
  if (isResearchDone(plan.research_status)) return "ready_for_pre_departure";
  if (plan.user_triggered_research_at && hasMinimalProfileForResearch(plan.profile_data)) {
    return "generating";
  }

  return "collecting";
}

/**
 * Coordinator (v2 chat) is allowed to run during every stage except
 * `arrived` — after arrival, the post-arrival worker takes over.
 */
export function canCoordinatorRun(plan: PlanStateInput): boolean {
  return deriveCanonicalStageServer(plan) !== "arrived";
}

/**
 * Pre-departure coordinator is allowed to run only at the two pre-arrival
 * stages where pre-departure work is meaningful.
 */
export function canPreDepartureCoordinatorRun(plan: PlanStateInput): boolean {
  const stage = deriveCanonicalStageServer(plan);
  return stage === "ready_for_pre_departure" || stage === "pre_departure";
}

/**
 * v2 Wave 1.3: research/trigger eligibility.
 *
 * - `collecting`: ALLOWED — first run kicks off research.
 * - `generating`: ALLOWED — re-run / restart while research is in flight.
 * - `ready_for_pre_departure`: ALLOWED — user can re-run research even after
 *   it has completed (e.g. profile changes invalidated the guide).
 * - `pre_departure`: ALLOWED — same rationale; researching deeper while
 *   working through the pre-departure checklist is a legitimate use case.
 * - `arrived`: BLOCKED — settling-in is the right surface, not research.
 */
export function researchEligible(plan: PlanStateInput): boolean {
  return deriveCanonicalStageServer(plan) !== "arrived";
}

/**
 * v2 Wave 1.3: settling-in routes require the user to have actually arrived.
 */
export function settlingInEligible(plan: PlanStateInput): boolean {
  return deriveCanonicalStageServer(plan) === "arrived";
}

/**
 * v2 Wave 1.3: any of complete / ready_for_pre_departure / pre_departure /
 * arrived is fine for guide read access (but not collecting / generating —
 * the guide doesn't exist yet at those stages).
 */
export function guideReadEligible(plan: PlanStateInput): boolean {
  const stage = deriveCanonicalStageServer(plan);
  return (
    stage === "complete" ||
    stage === "ready_for_pre_departure" ||
    stage === "pre_departure" ||
    stage === "arrived"
  );
}
