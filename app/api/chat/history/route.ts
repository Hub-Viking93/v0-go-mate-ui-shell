import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tier = await getUserTier(user.id)
    if (!hasFeatureAccess(tier, "chat_history")) {
      return NextResponse.json({ error: "Chat history requires a paid plan" }, { status: 403 })
    }

    // Get the user's current plan
    const { data: plan } = await supabase
      .from("relocation_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json({ messages: [], planId: null })
    }

    // Fetch last 50 messages ordered by created_at ASC
    const { data: messages, error: fetchError } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error("[GoMate] Error fetching chat history:", fetchError)
      return NextResponse.json({ error: "Failed to fetch chat history" }, { status: 500 })
    }

    return NextResponse.json({
      messages: (messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
      planId: plan.id,
    })
  } catch (error) {
    console.error("[GoMate] Chat history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
