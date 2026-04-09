import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { type Profile } from "@/lib/gomate/profile-schema"
import { computeProgress } from "@/lib/gomate/progress"
import { derivePlanAuthority } from "@/lib/gomate/core-state"
import { summarizeHiddenPostArrivalState } from "@/lib/gomate/post-arrival"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"

// PATCH /api/progress — upsert a checklist_progress item
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "settling_in_tasks")) {
    return NextResponse.json({ error: "Settling-in progress requires Pro+" }, { status: 403 })
  }

  const body = await request.json()
  const { planId, itemId, completed } = body as {
    planId?: string
    itemId?: string
    completed?: boolean
  }

  if (!planId || !itemId || typeof completed !== "boolean") {
    return NextResponse.json({ error: "planId, itemId, and completed (boolean) are required" }, { status: 400 })
  }

  // Verify the plan belongs to this user
  const { data: plan } = await supabase
    .from("relocation_plans")
    .select("id")
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  const { error: upsertError } = await supabase
    .from("checklist_progress")
    .upsert(
      {
        user_id: user.id,
        plan_id: planId,
        item_id: itemId,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,plan_id,item_id" },
    )

  if (upsertError) {
    console.error("[GoMate] checklist_progress upsert failed:", upsertError)
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

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
