import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"
import { COUNTRY_DATA } from "@/lib/gomate/guide-generator"

const MOOD_MESSAGES: Record<string, string> = {
  great: "That's wonderful to hear! Keep the momentum going.",
  good: "Glad things are going well. You're making great progress.",
  okay: "Settling in takes time — you're doing better than you think.",
  struggling:
    "It's completely normal to have hard days. You're not alone in this.",
  overwhelmed:
    "Moving abroad is one of life's biggest changes. Please be kind to yourself.",
}

const VALID_MOODS = new Set(["great", "good", "okay", "struggling", "overwhelmed"])

export async function POST(request: Request) {
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
  if (!hasFeatureAccess(tier, "wellbeing_checkins")) {
    return NextResponse.json(
      { error: "Wellbeing check-ins require Pro+" },
      { status: 403 }
    )
  }

  // Parse body
  let body: { mood: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.mood || !VALID_MOODS.has(body.mood)) {
    return NextResponse.json(
      { error: "Invalid mood. Must be one of: great, good, okay, struggling, overwhelmed" },
      { status: 400 }
    )
  }

  // Get current plan — stage must be 'arrived'
  const { data: plan, error: planError } = await supabase
    .from("relocation_plans")
    .select("id, stage, wellbeing_checkins, profile_data")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (planError || !plan) {
    return NextResponse.json({ error: "No active plan found" }, { status: 404 })
  }

  if (plan.stage !== "arrived") {
    return NextResponse.json(
      { error: "Wellbeing check-in is only available after arrival" },
      { status: 400 }
    )
  }

  // Append new check-in entry
  const existingCheckins = Array.isArray(plan.wellbeing_checkins)
    ? plan.wellbeing_checkins
    : []

  const newEntry = {
    checkInAt: new Date().toISOString(),
    mood: body.mood,
    note: body.note?.trim() || null,
  }

  const updatedCheckins = [...existingCheckins, newEntry]

  const { error: updateError } = await supabase
    .from("relocation_plans")
    .update({ wellbeing_checkins: updatedCheckins })
    .eq("id", plan.id)

  if (updateError) {
    console.error("Failed to save wellbeing check-in:", updateError)
    return NextResponse.json(
      { error: "Failed to save check-in" },
      { status: 500 }
    )
  }

  // For struggling/overwhelmed, include expat community resources from COUNTRY_DATA
  let resources: { communities: { name: string; type: string; url?: string; description: string }[]; expatHubs: { area: string; description: string }[] } | null = null
  if (body.mood === "struggling" || body.mood === "overwhelmed") {
    const destination = (plan.profile_data as Record<string, unknown>)?.destination as string | undefined
    if (destination) {
      const countryData = COUNTRY_DATA[destination]
      if (countryData?.expatCommunity) {
        resources = {
          communities: countryData.expatCommunity.communities || [],
          expatHubs: countryData.expatCommunity.expatHubs || [],
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: MOOD_MESSAGES[body.mood] || MOOD_MESSAGES.okay,
    resources,
  })
}
