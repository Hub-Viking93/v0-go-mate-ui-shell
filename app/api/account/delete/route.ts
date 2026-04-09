import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const userId = user.id

  // Delete user data from all tables (order matters for foreign keys)
  // Use service client to bypass RLS for complete cleanup
  const admin = createServiceClient()

  const tables = [
    "chat_messages",
    "settling_in_tasks",
    "guides",
    "relocation_plans",
    "user_subscriptions",
  ]

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId)
    if (error) {
      console.error(`Failed to delete from ${table}:`, error)
      return NextResponse.json({ error: `Failed to delete ${table} data` }, { status: 500 })
    }
  }

  // Delete the auth user
  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError) {
    console.error("Failed to delete auth user:", authError)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
