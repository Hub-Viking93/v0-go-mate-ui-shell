import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier, canCreatePlan } from "@/lib/gomate/tier"

// GET - List all user plans
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: plans, error } = await supabase
      .from("relocation_plans")
      .select("id, title, status, is_current, stage, profile_data, created_at, updated_at")
      .eq("user_id", user.id)
      .order("is_current", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[GoMate] Error fetching plans:", error)
      return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 })
    }

    // Get user tier info
    const tier = await getUserTier(user.id)

    return NextResponse.json({
      plans: (plans || []).map((p) => ({
        id: p.id,
        title: p.title || generateTitleFromProfile(p.profile_data),
        status: p.status,
        is_current: p.is_current,
        stage: p.stage,
        destination: p.profile_data?.destination || null,
        purpose: p.profile_data?.purpose || null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })),
      tier,
    })
  } catch (error) {
    console.error("[GoMate] Error in GET /api/plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a new plan (with tier-based limit check)
export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check plan limit
    const planCheck = await canCreatePlan(user.id)
    if (!planCheck.allowed) {
      return NextResponse.json(
        {
          error: "Plan limit reached",
          message: `Your ${planCheck.tier} plan allows ${planCheck.limit} plan(s). Upgrade to create more.`,
          tier: planCheck.tier,
          current: planCheck.current,
          limit: planCheck.limit,
        },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { title } = body

    // Clear is_current from all existing plans
    await supabase
      .from("relocation_plans")
      .update({ is_current: false })
      .eq("user_id", user.id)

    // Create new plan
    const { data: newPlan, error } = await supabase
      .from("relocation_plans")
      .insert({
        user_id: user.id,
        profile_data: {},
        stage: "collecting",
        title: title || `Plan ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
        status: "active",
        is_current: true,
      })
      .select()
      .single()

    if (error) {
      console.error("[GoMate] Error creating plan:", error)
      return NextResponse.json({ error: "Failed to create plan" }, { status: 500 })
    }

    return NextResponse.json({ plan: newPlan })
  } catch (error) {
    console.error("[GoMate] Error in POST /api/plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Switch current plan, rename, or archive
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { planId, action, title } = await req.json()

    if (!planId) {
      return NextResponse.json({ error: "Plan ID required" }, { status: 400 })
    }

    // Verify plan belongs to user
    const { data: plan } = await supabase
      .from("relocation_plans")
      .select("id")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    if (action === "switch") {
      // Clear is_current from all plans
      await supabase
        .from("relocation_plans")
        .update({ is_current: false })
        .eq("user_id", user.id)

      // Set this plan as current
      const { data: switched, error } = await supabase
        .from("relocation_plans")
        .update({ is_current: true })
        .eq("id", planId)
        .eq("user_id", user.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: "Failed to switch plan" }, { status: 500 })
      }

      return NextResponse.json({ plan: switched })
    }

    if (action === "rename" && title) {
      const { data: renamed, error } = await supabase
        .from("relocation_plans")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", planId)
        .eq("user_id", user.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: "Failed to rename plan" }, { status: 500 })
      }

      return NextResponse.json({ plan: renamed })
    }

    if (action === "archive") {
      const { data: archived, error } = await supabase
        .from("relocation_plans")
        .update({
          status: "archived",
          is_current: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId)
        .eq("user_id", user.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: "Failed to archive plan" }, { status: 500 })
      }

      return NextResponse.json({ plan: archived })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("[GoMate] Error in PATCH /api/plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function generateTitleFromProfile(profile: any): string {
  if (!profile) return "Untitled Plan"
  const dest = profile.destination
  const purpose = profile.purpose
  if (dest && purpose) {
    const label = purpose.charAt(0).toUpperCase() + purpose.slice(1).replace(/_/g, " ")
    return `${label} in ${dest}`
  }
  if (dest) return `Move to ${dest}`
  return "Untitled Plan"
}
