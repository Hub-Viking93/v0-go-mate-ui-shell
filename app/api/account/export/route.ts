import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  // Fetch all user data in parallel
  const [plans, guides, tasks, subscription, chatMessages] = await Promise.all([
    supabase
      .from("relocation_plans")
      .select("id, destination, stage, status, profile_data, research_data, document_statuses, created_at, updated_at")
      .eq("user_id", user.id),
    supabase
      .from("guides")
      .select("id, plan_id, title, sections, created_at, updated_at")
      .eq("user_id", user.id),
    supabase
      .from("settling_in_tasks")
      .select("id, plan_id, title, status, category, phase, priority, deadline_at, created_at, updated_at")
      .eq("user_id", user.id),
    supabase
      .from("user_subscriptions")
      .select("tier, billing_cycle, status, started_at, expires_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    account: {
      email: user.email,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      created_at: user.created_at,
    },
    subscription: subscription.data ?? null,
    relocation_plans: plans.data ?? [],
    guides: guides.data ?? [],
    settling_in_tasks: tasks.data ?? [],
    chat_messages: chatMessages.data ?? [],
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="gomate-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
