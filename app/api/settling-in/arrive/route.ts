import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier } from "@/lib/gomate/tier"

// POST: Mark user as arrived, set arrival_date, transition stage
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (tier !== "pro_plus") {
    return NextResponse.json(
      { error: "Post-relocation features require Pro+" },
      { status: 403 }
    )
  }

  let body: { arrivalDate?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  // Use provided date or today
  const arrivalDate = body.arrivalDate || new Date().toISOString().split("T")[0]

  // Get current plan
  const { data: plan, error: planError } = await supabase
    .from("relocation_plans")
    .select("id, stage")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (planError || !plan) {
    return NextResponse.json({ error: "No active plan found" }, { status: 404 })
  }

  // Only transition from 'complete' stage
  if (plan.stage !== "complete" && plan.stage !== "arrived") {
    return NextResponse.json(
      { error: "Your plan must be complete before marking arrival" },
      { status: 400 }
    )
  }

  // Update plan
  const { error: updateError } = await supabase
    .from("relocation_plans")
    .update({
      stage: "arrived",
      arrival_date: arrivalDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id)
    .eq("user_id", user.id)

  if (updateError) {
    console.error("[ArrivalAPI] Update error:", updateError)
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 })
  }

  // Recompute deadline_at for all tasks anchored to arrival_date
  const { data: tasks } = await supabase
    .from("settling_in_tasks")
    .select("id, deadline_days, deadline_anchor")
    .eq("plan_id", plan.id)
    .not("deadline_days", "is", null)

  if (tasks && tasks.length > 0) {
    const arrival = new Date(arrivalDate)
    for (const t of tasks) {
      if (t.deadline_anchor === "arrival_date" || !t.deadline_anchor) {
        const dl = new Date(arrival)
        dl.setDate(dl.getDate() + t.deadline_days)
        await supabase
          .from("settling_in_tasks")
          .update({ deadline_at: dl.toISOString(), updated_at: new Date().toISOString() })
          .eq("id", t.id)
      }
    }
  }

  return NextResponse.json({
    success: true,
    arrivalDate,
    stage: "arrived",
    planId: plan.id,
  })
}
