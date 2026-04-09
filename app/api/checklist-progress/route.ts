import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"

// GET /api/checklist-progress?plan_id=X&prefix=timeline_
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "pre_move_timeline")) {
    return NextResponse.json({ error: "Pre-move timeline requires a paid plan" }, { status: 403 })
  }

  const planId = request.nextUrl.searchParams.get("plan_id")
  if (!planId) {
    return NextResponse.json({ error: "plan_id is required" }, { status: 400 })
  }

  // Verify plan ownership
  const { data: plan } = await supabase
    .from("relocation_plans")
    .select("id")
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  let query = supabase
    .from("checklist_progress")
    .select("item_id, completed, completed_at")
    .eq("plan_id", planId)
    .eq("user_id", user.id)

  const prefix = request.nextUrl.searchParams.get("prefix")
  if (prefix) {
    query = query.like("item_id", `${prefix}%`)
  }

  const { data: items, error: fetchError } = await query

  if (fetchError) {
    console.error("[GoMate] checklist_progress fetch error:", fetchError)
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 })
  }

  return NextResponse.json({ items: items || [] })
}
