import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { generateChecklistFromPlan, type GeneratedChecklist } from "@/lib/gomate/checklist-generator"

// GET: Retrieve cached checklist
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get user's current plan with checklist
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

  return NextResponse.json({
    planId: plan.id,
    checklist: plan.checklist_items as GeneratedChecklist | null,
    hasVisaResearch: !!plan.visa_research,
  })
}

// POST: Generate new personalized checklist
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get request body (optional planId)
  let planId: string | undefined
  try {
    const body = await request.json()
    planId = body.planId
  } catch {
    // No body provided, will use latest plan
  }

  // Get user's plan
  let query = supabase
    .from("relocation_plans")
    .select("id, profile_data, visa_research")
    .eq("user_id", user.id)

  if (planId) {
    query = query.eq("id", planId)
  } else {
    query = query.eq("is_current", true)
  }

  const { data: plan, error: planError } = await query.maybeSingle()

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  // Check if we have profile data
  const profileData = plan.profile_data as Record<string, unknown> | null
  if (!profileData || !profileData.destination) {
    return NextResponse.json(
      { error: "Please complete your profile first" },
      { status: 400 }
    )
  }

  try {
    // Generate personalized checklist
    console.log("[ChecklistAPI] Generating checklist for plan:", plan.id)

    const checklist = await generateChecklistFromPlan({
      profile_data: profileData,
      visa_research: plan.visa_research as {
        visaOptions?: Array<{ name: string; type: string; selected?: boolean }>
      } | undefined,
    })

    // Save to database
    const { error: updateError } = await supabase
      .from("relocation_plans")
      .update({
        checklist_items: checklist,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id)
      .eq("user_id", user.id)

    if (updateError) {
      console.error("[ChecklistAPI] Failed to save checklist:", updateError)
      return NextResponse.json(
        { error: "Failed to save checklist" },
        { status: 500 }
      )
    }

    console.log("[ChecklistAPI] Checklist generated with", checklist.items.length, "items")

    return NextResponse.json({
      success: true,
      checklist,
      planId: plan.id,
    })
  } catch (error) {
    console.error("[ChecklistAPI] Error generating checklist:", error)
    return NextResponse.json(
      { error: "Failed to generate checklist" },
      { status: 500 }
    )
  }
}
