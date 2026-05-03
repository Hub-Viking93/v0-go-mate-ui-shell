import {
  EMPTY_PROFILE,
  getRequiredFields,
  type AllFieldKey,
  type Profile,
} from "./profile-schema"

export type PersistedFieldConfidence = "explicit" | "inferred" | "assumed"
export type CanonicalPlanStage =
  | "collecting"
  | "generating"
  | "complete"
  | "ready_for_pre_departure"
  | "pre_departure"
  | "arrived"
export type CanonicalPlanLifecycle =
  | "collecting"
  | "generating"
  | "ready_to_lock"
  | "locked"
  | "ready_for_pre_departure"
  | "pre_departure"
  | "arrived"
  | "archived"

export interface PlanStateInput {
  status?: string | null
  stage?: string | null
  locked?: boolean | null
  profile_data?: unknown
  /**
   * v2 Wave 1.3: research worker status. Must be `"completed"` or
   * `"partial"` for the lifecycle to consider research done. Other
   * values (null, "pending", "running", "failed") leave the plan in
   * `generating` once research has been triggered.
   */
  research_status?: string | null
  /**
   * v2 Wave 1.3: timestamp when the user clicked "Generate my plan".
   * Drives the `collecting -> generating` transition. Per the v2 spec,
   * profile completion does NOT auto-trigger research; this timestamp
   * is the SOLE source of authority for moving past `collecting`.
   */
  user_triggered_research_at?: string | null
  /**
   * v2 Wave 1.3: timestamp when the user clicked "Generate my
   * pre-departure checklist". Drives the
   * `ready_for_pre_departure -> pre_departure` transition. Per the v2
   * spec, research completion does NOT auto-trigger pre-departure; this
   * timestamp is the SOLE source of authority for moving past
   * `ready_for_pre_departure`.
   */
  user_triggered_pre_departure_at?: string | null
  /** v2 Wave 1.3: when the user clicks "I have arrived". */
  arrival_date?: string | null
  /** v2 Wave 1.3: post-arrival onboarding finalised flag. */
  onboarding_completed?: boolean | null
}

export interface ProfileReadiness {
  requiredCount: number
  filledCount: number
  confirmedCount: number
  filledRequiredFields: AllFieldKey[]
  confirmedRequiredFields: AllFieldKey[]
  missingConfirmationFields: AllFieldKey[]
  isStructurallyComplete: boolean
  isReadyForLock: boolean
}

export interface DerivedPlanAuthority {
  stage: CanonicalPlanStage
  lifecycle: CanonicalPlanLifecycle
  readiness: ProfileReadiness
  canEditProfile: boolean
  canLock: boolean
  /**
   * v2 Wave 1.3: true when the user is allowed to click "Generate my
   * pre-departure checklist". Currently only true at
   * `stage === "ready_for_pre_departure"`.
   */
  canLockPredeparture: boolean
  /**
   * v2 Wave 1.3: true when the user is allowed to click "I have
   * arrived". Currently true at either `stage === "ready_for_pre_departure"`
   * (skip-ahead) or `stage === "pre_departure"` (the normal path).
   */
  canLockArrival: boolean
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => any
    }
  }
}

function hasFilledValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return value !== null && value !== undefined && value !== ""
}

export function toProfile(profileData: unknown): Profile {
  if (!profileData || typeof profileData !== "object") {
    return { ...EMPTY_PROFILE }
  }

  return {
    ...EMPTY_PROFILE,
    ...(profileData as Partial<Profile>),
  }
}

export function getFieldConfidenceMap(
  profileData: unknown
): Partial<Record<AllFieldKey, PersistedFieldConfidence>> {
  if (!profileData || typeof profileData !== "object") {
    return {}
  }

  const raw = (profileData as Record<string, unknown>).__field_confidence
  if (!raw || typeof raw !== "object") {
    return {}
  }

  const confidenceMap: Partial<Record<AllFieldKey, PersistedFieldConfidence>> = {}

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "explicit" || value === "inferred" || value === "assumed") {
      confidenceMap[key as AllFieldKey] = value
    }
  }

  return confidenceMap
}

export function getProfileReadiness(profileData: unknown): ProfileReadiness {
  const profile = toProfile(profileData)
  const confidenceMap = getFieldConfidenceMap(profileData)
  const requiredFields = getRequiredFields(profile)

  const filledRequiredFields = requiredFields.filter((field) =>
    hasFilledValue(profile[field as keyof Profile])
  )

  // Phase 0 narrows canonical confirmation semantics by excluding "assumed"
  // values from lock/readiness authority while preserving compatibility for
  // manually-entered values that have no stored confidence metadata yet.
  const confirmedRequiredFields = filledRequiredFields.filter(
    (field) => confidenceMap[field] !== "assumed"
  )

  const missingConfirmationFields = filledRequiredFields.filter(
    (field) => !confirmedRequiredFields.includes(field)
  )

  return {
    requiredCount: requiredFields.length,
    filledCount: filledRequiredFields.length,
    confirmedCount: confirmedRequiredFields.length,
    filledRequiredFields,
    confirmedRequiredFields,
    missingConfirmationFields,
    isStructurallyComplete: filledRequiredFields.length === requiredFields.length,
    isReadyForLock: confirmedRequiredFields.length === requiredFields.length,
  }
}

// v2 stages that may be persisted directly on the plan row. When the DB has one
// of these, it's authoritative and overrides any inference. `complete` is kept
// out of this list because it's a v1 alias that maps to `ready_for_pre_departure`
// in the v2 lifecycle (see `deriveCanonicalStage` below).
const V2_PERSISTED_STAGES: ReadonlyArray<CanonicalPlanStage> = [
  "generating",
  "ready_for_pre_departure",
  "pre_departure",
]

function isV2PersistedStage(value: unknown): value is CanonicalPlanStage {
  return typeof value === "string" && (V2_PERSISTED_STAGES as readonly string[]).includes(value)
}

function isResearchDone(researchStatus: string | null | undefined): boolean {
  return researchStatus === "completed" || researchStatus === "partial"
}

/**
 * v2 lifecycle: collecting -> generating -> ready_for_pre_departure -> pre_departure -> arrived
 *
 * Authority order (highest first):
 *   1. `arrived` is terminal — once persisted, nothing else matters.
 *   2. Explicitly-persisted v2 stages (`generating`, `ready_for_pre_departure`,
 *      `pre_departure`) take precedence — they're written by the trigger
 *      endpoints and are the source of truth.
 *   3. v1 `complete` is a backward-compat alias that maps to
 *      `ready_for_pre_departure`.
 *   4. Manual-trigger timestamps: a populated `user_triggered_pre_departure_at`
 *      pulls a stale row up to `pre_departure`; research_status `completed` /
 *      `partial` pulls a `generating`-equivalent row up to
 *      `ready_for_pre_departure`; `user_triggered_research_at` pulls a
 *      structurally-complete profile up to `generating`.
 *   5. Default: `collecting`. Profile completion alone NEVER advances stage —
 *      the user must click "Generate my plan" first.
 */
export function deriveCanonicalStage(plan: PlanStateInput): CanonicalPlanStage {
  // 1. Terminal stage
  if (plan.stage === "arrived") return "arrived"

  // 2. Explicitly-persisted v2 stages
  if (isV2PersistedStage(plan.stage)) {
    return plan.stage as CanonicalPlanStage
  }

  // 3. v1 `complete` -> v2 `ready_for_pre_departure`
  if (plan.stage === "complete") return "ready_for_pre_departure"

  // 4. Manual-trigger inference (when no v2 stage is persisted yet, e.g.
  //    older rows or rows being written by partial flows). Highest signal
  //    wins:
  //      pre-departure trigger > research done > research trigger > nothing
  if (plan.user_triggered_pre_departure_at) return "pre_departure"
  if (isResearchDone(plan.research_status)) return "ready_for_pre_departure"

  const readiness = getProfileReadiness(plan.profile_data)
  if (plan.user_triggered_research_at && readiness.isStructurallyComplete) {
    return "generating"
  }

  // 5. Default. NOTE: a structurally-complete profile WITHOUT a research
  //    trigger stays in `collecting` — `derivePlanAuthority` surfaces the
  //    "ready_to_lock" lifecycle for that case so the UI can prompt the
  //    user to click "Generate my plan".
  return "collecting"
}

export function derivePlanAuthority(plan: PlanStateInput): DerivedPlanAuthority {
  const readiness = getProfileReadiness(plan.profile_data)
  const stage = deriveCanonicalStage(plan)

  let lifecycle: CanonicalPlanLifecycle = "collecting"
  if (plan.status === "archived") {
    lifecycle = "archived"
  } else if (stage === "arrived") {
    lifecycle = "arrived"
  } else if (stage === "pre_departure") {
    lifecycle = "pre_departure"
  } else if (stage === "ready_for_pre_departure") {
    lifecycle = "ready_for_pre_departure"
  } else if (stage === "generating") {
    lifecycle = "generating"
  } else if (plan.locked) {
    lifecycle = "locked"
  } else if (readiness.isReadyForLock) {
    lifecycle = "ready_to_lock"
  }

  return {
    stage,
    lifecycle,
    readiness,
    canEditProfile: lifecycle === "collecting" || lifecycle === "ready_to_lock",
    canLock: !plan.locked && lifecycle === "ready_to_lock",
    // Pre-departure trigger button is shown only when the plan is at
    // `ready_for_pre_departure`. After the user clicks it, stage advances to
    // `pre_departure` and this becomes false so the button disappears.
    canLockPredeparture: stage === "ready_for_pre_departure",
    // The "I have arrived" button is offered both at `pre_departure` (the
    // normal path) and at `ready_for_pre_departure` (a user who is already
    // at destination and wants to skip pre-departure prep).
    canLockArrival: stage === "pre_departure" || stage === "ready_for_pre_departure",
  }
}

export function attachDerivedPlanState<T extends PlanStateInput>(
  plan: T
): T & DerivedPlanAuthority {
  return {
    ...plan,
    ...derivePlanAuthority(plan),
  }
}

export async function getOwnedPlan(
  supabase: SupabaseLike,
  userId: string,
  options?: {
    planId?: string
    select?: string
  }
) {
  const select = options?.select || "*"
  let query = supabase.from("relocation_plans").select(select).eq("user_id", userId)

  if (options?.planId) {
    query = query.eq("id", options.planId)
  } else {
    query = query.eq("is_current", true)
  }

  return query.maybeSingle()
}

export async function switchCurrentPlan(
  supabase: any,
  userId: string,
  planId: string
): Promise<{
  ok: boolean
  mode: "rpc" | "fallback"
  error?: unknown
}> {
  const rpcResult = await supabase.rpc("switch_current_plan", {
    p_user_id: userId,
    p_plan_id: planId,
  })

  if (!rpcResult.error) {
    return { ok: true, mode: "rpc" }
  }

  const { error: clearError } = await supabase
    .from("relocation_plans")
    .update({ is_current: false })
    .eq("user_id", userId)
    .eq("is_current", true)

  if (clearError) {
    return { ok: false, mode: "fallback", error: rpcResult.error }
  }

  const { data: switchedPlan, error: setError } = await supabase
    .from("relocation_plans")
    .update({ is_current: true })
    .eq("id", planId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle()

  if (setError || !switchedPlan) {
    return {
      ok: false,
      mode: "fallback",
      error: setError || rpcResult.error,
    }
  }

  return { ok: true, mode: "fallback", error: rpcResult.error }
}
