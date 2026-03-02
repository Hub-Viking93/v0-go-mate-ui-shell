import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - Fetch a specific guide
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { data: guide, error } = await supabase
      .from("guides")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    
    if (error || !guide) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 })
    }
    
    return NextResponse.json({ guide })
  } catch (error) {
    console.error("[GoMate] Error fetching guide:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete a guide
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { error } = await supabase
      .from("guides")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
    
    if (error) {
      return NextResponse.json({ error: "Failed to delete guide" }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[GoMate] Error deleting guide:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
