import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier } from "@/lib/gomate/tier"
import {
  buildSettlingView,
  isPostArrivalStage,
  summarizeHiddenPostArrivalState,
  zeroSettlingStats,
} from "@/lib/gomate/post-arrival"

// GET: List all settling-in tasks for the current plan
export async function GET() {
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

  // Get current plan
  const { data: plan } = await supabase
    .from("relocation_plans")
    .select("id, arrival_date, stage, post_relocation_generated")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (!plan) {
    return NextResponse.json({ error: "No active plan found" }, { status: 404 })
  }

  if (!isPostArrivalStage(plan.stage)) {
    const { data: hiddenTasks } = await supabase
      .from("settling_in_tasks")
      .select("status, is_legal_requirement")
      .eq("plan_id", plan.id)

    return NextResponse.json({
      tasks: [],
      stage: plan.stage,
      arrivalDate: null,
      generated: false,
      executionEnabled: false,
      stats: zeroSettlingStats(),
      legacyTaskState: summarizeHiddenPostArrivalState({
        tasks: hiddenTasks || [],
        generatedFlag: Boolean(plan.post_relocation_generated),
        arrivalDate: plan.arrival_date,
      }),
    })
  }

  // Fetch tasks
  const { data: tasks, error } = await supabase
    .from("settling_in_tasks")
    .select("*")
    .eq("plan_id", plan.id)
    .order("sort_order")

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }

  const now = new Date()
  const view = buildSettlingView({
    tasks: tasks || [],
    arrivalDate: plan.arrival_date,
    now,
  })

  // Persist OVERDUE status changes
  if (view.overdueIds.length > 0) {
    await supabase
      .from("settling_in_tasks")
      .update({ status: "overdue", updated_at: now.toISOString() })
      .in("id", view.overdueIds)
  }

  // Auto-unlock tasks whose dependencies are all completed
  // Batch update newly available tasks
  if (view.nowAvailableIds.length > 0) {
    await supabase
      .from("settling_in_tasks")
      .update({ status: "available", updated_at: now.toISOString() })
      .in("id", view.nowAvailableIds)
  }

  return NextResponse.json({
    tasks: view.tasks,
    planId: plan.id,
    arrivalDate: plan.arrival_date,
    stage: plan.stage,
    generated: plan.post_relocation_generated || false,
    executionEnabled: true,
    stats: view.stats,
  })
}
