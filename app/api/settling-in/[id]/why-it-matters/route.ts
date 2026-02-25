import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"
import { getUserTier } from "@/lib/gomate/tier"
import { generateText } from "ai"

// POST: Generate a personalized "Why it matters" explanation for a settling task
export async function POST(
  _request: NextRequest,
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
    return NextResponse.json({ error: "Pro+ required" }, { status: 403 })
  }

  // Get the task
  const { data: task, error: taskError } = await supabase
    .from("settling_in_tasks")
    .select("id, title, description, category, is_legal_requirement, deadline_days, why_it_matters, plan_id")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  // If already enriched, return cached
  if (task.why_it_matters) {
    return NextResponse.json({ whyItMatters: task.why_it_matters, cached: true })
  }

  // Get plan profile for context
  const { data: plan } = await supabase
    .from("relocation_plans")
    .select("profile_data, visa_research")
    .eq("id", task.plan_id)
    .eq("user_id", user.id)
    .maybeSingle()

  const profile = (plan?.profile_data as Record<string, unknown>) || {}

  try {
    const result = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      maxTokens: 300,
      prompt: `You are a relocation expert. A person is moving from ${profile.citizenship || "their home country"} to ${profile.destination || "a new country"} for ${profile.purpose || "relocation"}.

They need to complete this post-arrival task:
- Task: ${task.title}
- Description: ${task.description}
- Category: ${task.category}
${task.is_legal_requirement ? "- This is a LEGAL REQUIREMENT." : ""}
${task.deadline_days ? `- Deadline: ${task.deadline_days} days after arrival.` : ""}

Write a brief, personalized explanation (2-3 sentences) of why this task matters for THEM specifically. Focus on:
1. Practical consequences of not doing it (fines, losing access to services, etc.)
2. How it connects to their specific situation (${profile.purpose}, ${profile.citizenship} citizen)
3. Any hidden benefits they might not know about

Be direct, conversational, not generic. Do NOT use bullet points or headers. Just write a short paragraph.`,
    })

    const whyItMatters = result.text.trim()

    // Save to DB
    await supabase
      .from("settling_in_tasks")
      .update({ why_it_matters: whyItMatters, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", user.id)

    return NextResponse.json({ whyItMatters, cached: false })
  } catch (error) {
    console.error("[WhyItMatters] Error:", error)
    return NextResponse.json({ error: "Failed to generate explanation" }, { status: 500 })
  }
}
