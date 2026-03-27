import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { canonicalDocumentId } from "@/lib/gomate/checklist-generator"

export interface DocumentStatus {
  completed: boolean
  completedAt?: string
  /** B2-008: Reference to the canonical checklist item document name */
  documentName?: string
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
// B2-008: Validates documentId against checklist_items for shared identity
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

  // Get current plan with checklist for identity validation
  const { data: plan, error: fetchError } = await supabase
    .from("relocation_plans")
    .select("id, document_statuses, checklist_items")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (fetchError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  // B2-008: Normalize the documentId to canonical form
  const canonicalId = canonicalDocumentId(documentId)

  // B2-008: Validate that the documentId exists in checklist_items
  const checklist = plan.checklist_items as { items?: Array<{ id: string; document: string }> } | null
  const checklistIds = new Set(
    (checklist?.items || []).map(item => canonicalDocumentId(item.id))
  )

  if (checklistIds.size > 0 && !checklistIds.has(canonicalId)) {
    return NextResponse.json(
      { error: "Document ID does not match any checklist item" },
      { status: 400 }
    )
  }

  // Find the matching checklist item to store document name
  const matchingItem = (checklist?.items || []).find(
    item => canonicalDocumentId(item.id) === canonicalId
  )

  // Update the document status
  const currentStatuses = (plan.document_statuses || {}) as Record<string, DocumentStatus>
  const newStatuses = {
    ...currentStatuses,
    [canonicalId]: {
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
      documentName: matchingItem?.document,
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
