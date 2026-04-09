import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { type GeneratedChecklist } from "@/lib/gomate/checklist-generator"
import { performChecklistResearch } from "@/lib/gomate/research-checklist"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"

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
  if (!hasFeatureAccess(tier, "documents")) {
    return NextResponse.json({ error: "Document checklist requires a paid plan" }, { status: 403 })
  }

  const { data: plan, error } = await supabase
    .from("relocation_plans")
    .select("id, checklist_items, profile_data, visa_research")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Failed to fetch checklist" }, { status: 500 })
  }

  if (!plan) {
    return NextResponse.json({ error: "No plan found" }, { status: 404 })
  }

  const checklist = plan.checklist_items as GeneratedChecklist | null
  return NextResponse.json({
    planId: plan.id,
    checklist,
    hasVisaResearch: !!plan.visa_research,
    isFallback: checklist?.isFallback ?? null,
  })
}

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
  if (!hasFeatureAccess(tier, "documents")) {
    return NextResponse.json({ error: "Checklist research requires a paid plan" }, { status: 403 })
  }

  let planId: string | undefined
  try {
    const body = await request.json()
    planId = body.planId
  } catch {
    // Use current plan when no body is provided.
  }

  const result = await performChecklistResearch(supabase, user.id, planId)
  return NextResponse.json(result.body, { status: result.status })
}
