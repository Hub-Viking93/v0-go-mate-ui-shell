import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { type Profile } from "@/lib/gomate/profile-schema"
import { computeProgress } from "@/lib/gomate/progress"
import { derivePlanAuthority } from "@/lib/gomate/core-state"
import { summarizeHiddenPostArrivalState } from "@/lib/gomate/post-arrival"

// GET /api/progress?plan_id=X
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const planId = request.nextUrl.searchParams.get("plan_id")

  let planQuery = supabase
    .from("relocation_plans")
    .select("id, profile_data, stage, status, locked, arrival_date, post_relocation_generated")
    .eq("user_id", user.id)

  if (planId) {
    planQuery = planQuery.eq("id", planId)
  } else {
    planQuery = planQuery.eq("is_current", true)
  }

  const { data: plan, error: planError } = await planQuery.maybeSingle()

  if (planError || !plan) {
    return NextResponse.json({ error: "No plan found" }, { status: 404 })
  }

  // Get settling-in tasks (if any)
  const { data: tasks } = await supabase
    .from("settling_in_tasks")
    .select("status, is_legal_requirement")
    .eq("plan_id", plan.id)

  const profile = (plan.profile_data as Profile) || null
  const authority = derivePlanAuthority(plan)
  const progress = computeProgress(profile, tasks || [], {
    stage: authority.stage,
  })
  const hiddenPostArrivalState = summarizeHiddenPostArrivalState({
    tasks: tasks || [],
    generatedFlag: Boolean(plan.post_relocation_generated),
    arrivalDate: plan.arrival_date,
  })

  return NextResponse.json({
    plan_id: plan.id,
    stage: authority.stage,
    lifecycle: authority.lifecycle,
    readiness: authority.readiness,
    ...progress,
    post_arrival_state: {
      enabled: authority.stage === "arrived",
      hidden: authority.stage === "arrived" ? null : hiddenPostArrivalState,
    },
  })
}
