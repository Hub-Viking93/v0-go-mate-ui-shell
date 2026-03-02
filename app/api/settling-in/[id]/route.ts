import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"
import { getUserTier } from "@/lib/gomate/tier"
import { computeAvailableTasks } from "@/lib/gomate/settling-in-generator"

// PATCH: Update a settling-in task's status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params
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

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const newStatus = body.status
  const validStatuses = ["available", "in_progress", "completed", "skipped"]
  if (!newStatus || !validStatuses.includes(newStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    )
  }

  // Verify ownership and get the task
  const { data: task, error: taskError } = await supabase
    .from("settling_in_tasks")
    .select("id, status, plan_id, depends_on")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  // Verify plan is in arrived stage
  const { data: plan } = await supabase
    .from("relocation_plans")
    .select("stage")
    .eq("id", task.plan_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!plan || plan.stage !== 'arrived') {
    return NextResponse.json(
      { error: "Task completion requires arrival confirmation" },
      { status: 400 }
    )
  }

  // Can't complete a locked task
  if (task.status === "locked" && newStatus === "completed") {
    return NextResponse.json(
      { error: "Cannot complete a locked task. Complete its dependencies first." },
      { status: 400 }
    )
  }

  // Update the task
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (newStatus === "completed") {
    updateData.completed_at = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from("settling_in_tasks")
    .update(updateData)
    .eq("id", taskId)
    .eq("user_id", user.id)

  if (updateError) {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }

  // After completing a task, unlock any tasks that depended on it
  if (newStatus === "completed") {
    // Get all tasks in this plan to recompute availability
    const { data: allTasks } = await supabase
      .from("settling_in_tasks")
      .select("id, status, depends_on")
      .eq("plan_id", task.plan_id)

    if (allTasks) {
      // Update the current task's status in the list for computation
      const taskList = allTasks.map((t) => ({
        id: t.id,
        status: t.id === taskId ? "completed" : t.status,
        depends_on: (t.depends_on as string[]) || [],
      }))

      const nowAvailable = computeAvailableTasks(taskList)
      if (nowAvailable.length > 0) {
        await supabase
          .from("settling_in_tasks")
          .update({ status: "available", updated_at: new Date().toISOString() })
          .in("id", nowAvailable)
      }
    }
  }

  return NextResponse.json({
    success: true,
    taskId,
    status: newStatus,
  })
}
