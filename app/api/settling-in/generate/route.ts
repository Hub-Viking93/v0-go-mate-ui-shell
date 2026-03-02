import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier } from "@/lib/gomate/tier"
import {
  generateSettlingInPlan,
  resolveDependencies,
  type SettlingTask,
} from "@/lib/gomate/settling-in-generator"
import { isValidDAG } from "@/lib/gomate/dag-validator"

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Tier gate
  const tier = await getUserTier(user.id)
  if (tier !== "pro_plus") {
    return NextResponse.json(
      { error: "Post-relocation features require Pro+" },
      { status: 403 }
    )
  }

  // Get current plan
  const { data: plan, error: planError } = await supabase
    .from("relocation_plans")
    .select("id, profile_data, visa_research, post_relocation_generated, stage")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (planError || !plan) {
    return NextResponse.json({ error: "No active plan found" }, { status: 404 })
  }

  if (plan.stage !== 'arrived') {
    return NextResponse.json(
      { error: "Settling-in features require arrival confirmation" },
      { status: 400 }
    )
  }

  // Don't regenerate if already done (unless forced)
  if (plan.post_relocation_generated) {
    const { data: existingTasks } = await supabase
      .from("settling_in_tasks")
      .select("id, title, category, status, depends_on, sort_order")
      .eq("plan_id", plan.id)
      .order("sort_order")

    return NextResponse.json({
      tasks: existingTasks || [],
      cached: true,
      planId: plan.id,
    })
  }

  const profileData = plan.profile_data as Record<string, unknown> | null
  if (!profileData || !profileData.destination) {
    return NextResponse.json(
      { error: "Please complete your profile first" },
      { status: 400 }
    )
  }

  try {
    console.log("[SettlingAPI] Generating settling-in plan for:", plan.id)

    // Extract visa info
    const visaResearch = plan.visa_research as {
      visaOptions?: Array<{ name: string; type: string; selected?: boolean }>
    } | null
    const selectedVisa = visaResearch?.visaOptions?.find((v) => v.selected)

    const result = await generateSettlingInPlan({
      citizenship: (profileData.citizenship as string) || "",
      destination: (profileData.destination as string) || "",
      destinationCity: (profileData.destinationCity as string) || "",
      purpose: (profileData.purpose as string) || "general",
      visaType: selectedVisa?.type,
      visaName: selectedVisa?.name,
      hasJobOffer: (profileData.hasJobOffer as boolean) || false,
      hasFamilyInDestination: (profileData.hasFamilyInDestination as boolean) || false,
      movingWithFamily: (profileData.movingWithFamily as boolean) || false,
      budget: (profileData.budget as string) || "",
    })

    // Insert tasks into DB
    const tempIdToUuid = new Map<string, string>()
    const tasksToInsert = result.tasks.map((task: SettlingTask) => {
      const id = crypto.randomUUID()
      tempIdToUuid.set(task.tempId, id)
      return {
        id,
        user_id: user.id,
        plan_id: plan.id,
        title: task.title,
        description: task.description,
        category: task.category,
        depends_on: [] as string[], // will be resolved after all IDs are known
        deadline_days: task.deadlineDays,
        is_legal_requirement: task.isLegalRequirement,
        steps: task.steps,
        documents_needed: task.documentsNeeded,
        official_link: task.officialLink,
        estimated_time: task.estimatedTime,
        cost: task.cost,
        task_key: task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64),
        status: "locked" as string,
        sort_order: task.sortOrder,
      }
    })

    // Resolve dependency tempIds -> real UUIDs
    const resolved = resolveDependencies(result.tasks, tempIdToUuid)
    for (const r of resolved) {
      const row = tasksToInsert.find((t) => t.id === r.taskUuid)
      if (row) row.depends_on = r.dependsOn
    }

    // Validate the dependency graph is acyclic
    if (!isValidDAG(tasksToInsert.map(t => ({ id: t.id, depends_on: t.depends_on })))) {
      console.error('[settling-in/generate] Cycle detected in generated task graph — stripping all dependencies')
      for (const row of tasksToInsert) {
        row.depends_on = []
      }
    }

    // Mark tasks with no dependencies as 'available'
    for (const row of tasksToInsert) {
      if (row.depends_on.length === 0) {
        row.status = "available"
      }
    }

    // Batch insert
    const { error: insertError } = await supabase
      .from("settling_in_tasks")
      .insert(tasksToInsert)

    if (insertError) {
      console.error("[SettlingAPI] Insert error:", insertError)
      return NextResponse.json(
        { error: "Failed to save settling-in tasks" },
        { status: 500 }
      )
    }

    // Mark plan as generated
    await supabase
      .from("relocation_plans")
      .update({ post_relocation_generated: true, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .eq("user_id", user.id)

    console.log("[SettlingAPI] Generated", tasksToInsert.length, "settling-in tasks")

    return NextResponse.json({
      tasks: tasksToInsert,
      cached: false,
      planId: plan.id,
      researchSources: result.researchSources,
    })
  } catch (error) {
    console.error("[SettlingAPI] Generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate settling-in tasks" },
      { status: 500 }
    )
  }
}
