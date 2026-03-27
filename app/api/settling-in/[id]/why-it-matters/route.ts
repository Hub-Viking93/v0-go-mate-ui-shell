import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"
import { getUserTier } from "@/lib/gomate/tier"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { isPostArrivalStage } from "@/lib/gomate/post-arrival"

const openrouter = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
})

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
    .select("id, title, description, category, is_legal_requirement, deadline_days, why_it_matters, plan_id, status, official_link")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  if (task.status === "locked") {
    return NextResponse.json(
      { error: "This explanation is only available for active settling-in tasks" },
      { status: 400 }
    )
  }

  // Get plan profile for context
  const { data: plan } = await supabase
    .from("relocation_plans")
    .select("profile_data, visa_research, stage")
    .eq("id", task.plan_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!plan || !isPostArrivalStage(plan.stage)) {
    return NextResponse.json(
      { error: "Task enrichment requires arrival confirmation" },
      { status: 400 }
    )
  }

  // Rate limit: max 20 enrichments per plan
  const ENRICHMENT_LIMIT = 20
  const { count } = await supabase
    .from("settling_in_tasks")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", task.plan_id)
    .not("why_it_matters", "is", null)

  if ((count ?? 0) >= ENRICHMENT_LIMIT) {
    return NextResponse.json(
      { error: "Enrichment limit reached for this plan" },
      { status: 429 }
    )
  }

  // If already enriched (under limit), return cached
  if (task.why_it_matters) {
    return NextResponse.json({ whyItMatters: task.why_it_matters, cached: true })
  }

  const profile = (plan?.profile_data as Record<string, unknown>) || {}

  try {
    const result = await generateText({
      model: openrouter("anthropic/claude-sonnet-4"),
      maxOutputTokens: 300,
      prompt: `You are a relocation expert. A person is moving from ${profile.citizenship || "their home country"} to ${profile.destination || "a new country"} for ${profile.purpose || "relocation"}.

They need to complete this post-arrival task:
- Task: ${task.title}
- Description: ${task.description}
- Category: ${task.category}
${task.is_legal_requirement ? "- This is a LEGAL REQUIREMENT." : ""}
${task.deadline_days ? `- Deadline: ${task.deadline_days} days after arrival.` : ""}
${task.official_link ? `- Official source: ${task.official_link}` : ""}

Write a brief, personalized explanation (2-3 sentences) of why this task matters for THEM specifically. Focus on:
1. Practical consequences of not doing it (fines, losing access to services, etc.)
2. How it connects to their specific situation (${profile.purpose}, ${profile.citizenship} citizen)
3. Any hidden benefits they might not know about

Be direct, conversational, and grounded. Do NOT promise legal outcomes or quote specific penalties unless they are stated above. If the consequences depend on the local authority, say so plainly and point them back to the official source. Do NOT use bullet points or headers. Just write a short paragraph.`,
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
