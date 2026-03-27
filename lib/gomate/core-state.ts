import {
  EMPTY_PROFILE,
  getRequiredFields,
  type AllFieldKey,
  type Profile,
} from "./profile-schema"

export type PersistedFieldConfidence = "explicit" | "inferred" | "assumed"
export type CanonicalPlanStage = "collecting" | "complete" | "arrived"
export type CanonicalPlanLifecycle =
  | "collecting"
  | "ready_to_lock"
  | "locked"
  | "arrived"
  | "archived"

export interface PlanStateInput {
  status?: string | null
  stage?: string | null
  locked?: boolean | null
  profile_data?: unknown
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

export function deriveCanonicalStage(plan: PlanStateInput): CanonicalPlanStage {
  if (plan.stage === "arrived") return "arrived"

  const readiness = getProfileReadiness(plan.profile_data)
  if (plan.locked || readiness.isStructurallyComplete) {
    return "complete"
  }

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
