import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier } from "@/lib/gomate/tier"
import { computeAvailableTasks } from "@/lib/gomate/settling-in-generator"

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

  // Fetch tasks
  const { data: tasks, error } = await supabase
    .from("settling_in_tasks")
    .select("*")
    .eq("plan_id", plan.id)
    .order("sort_order")

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }

  const allTasks = tasks || []

  // Auto-unlock tasks whose dependencies are all completed
  const nowAvailable = computeAvailableTasks(
    allTasks.map((t) => ({
      id: t.id,
      status: t.status,
      depends_on: (t.depends_on as string[]) || [],
    }))
  )

  // Batch update newly available tasks
  if (nowAvailable.length > 0) {
    await supabase
      .from("settling_in_tasks")
      .update({ status: "available", updated_at: new Date().toISOString() })
      .in("id", nowAvailable)

    // Reflect in response
    for (const t of allTasks) {
      if (nowAvailable.includes(t.id)) {
        t.status = "available"
      }
    }
  }

  // Compute stats
  const total = allTasks.length
  const completed = allTasks.filter((t) => t.status === "completed").length
  const available = allTasks.filter((t) => t.status === "available" || t.status === "in_progress").length
  const legalTasks = allTasks.filter((t) => t.is_legal_requirement)
  const legalCompleted = legalTasks.filter((t) => t.status === "completed").length

  return NextResponse.json({
    tasks: allTasks,
    planId: plan.id,
    arrivalDate: plan.arrival_date,
    stage: plan.stage,
    generated: plan.post_relocation_generated || false,
    stats: {
      total,
      completed,
      available,
      locked: total - completed - available,
      legalTotal: legalTasks.length,
      legalCompleted,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
  })
}
