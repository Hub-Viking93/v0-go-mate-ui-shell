import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export interface DocumentStatus {
  completed: boolean
  completedAt?: string
}

// GET: Fetch document statuses for the current user's plan
export async function GET() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: plan, error } = await supabase
    .from("relocation_plans")
    .select("id, document_statuses, checklist_items")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
  }

  return NextResponse.json({
    planId: plan?.id || null,
    statuses: (plan?.document_statuses || {}) as Record<string, DocumentStatus>,
    checklistItems: plan?.checklist_items || [],
  })
}

// PATCH: Update a document's completion status
export async function PATCH(request: Request) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { documentId, completed } = body

  if (!documentId || typeof completed !== "boolean") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // Get current plan
  const { data: plan, error: fetchError } = await supabase
    .from("relocation_plans")
    .select("id, document_statuses")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (fetchError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  // Update the document status
  const currentStatuses = (plan.document_statuses || {}) as Record<string, DocumentStatus>
  const newStatuses = {
    ...currentStatuses,
    [documentId]: {
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    },
  }

  const { error: updateError } = await supabase
    .from("relocation_plans")
    .update({ 
      document_statuses: newStatuses,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id)
    .eq("user_id", user.id)

  if (updateError) {
    return NextResponse.json({ error: "Failed to update document status" }, { status: 500 })
  }

  return NextResponse.json({ 
    success: true, 
    statuses: newStatuses,
  })
}
