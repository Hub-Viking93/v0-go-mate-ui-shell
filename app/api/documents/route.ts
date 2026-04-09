import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { canonicalDocumentId } from "@/lib/gomate/checklist-generator"
import {
  type DocumentStatus,
  type DocumentStatusEntry,
  normalizeDocumentStatus,
  isValidExternalLink,
} from "@/lib/gomate/types/document-status"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"

// GET: Fetch document statuses for the current user's plan
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "documents")) {
    return NextResponse.json({ error: "Document checklist requires a paid plan" }, { status: 403 })
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

  // Normalize all entries to the new shape (handles legacy { completed: boolean })
  const rawStatuses = (plan?.document_statuses || {}) as Record<string, unknown>
  const normalized: Record<string, DocumentStatusEntry> = {}
  for (const [key, value] of Object.entries(rawStatuses)) {
    normalized[key] = normalizeDocumentStatus(value)
  }

  return NextResponse.json({
    planId: plan?.id || null,
    statuses: normalized,
    checklistItems: plan?.checklist_items || [],
  })
}

// PATCH: Update a document's status and optional fields
// B2-008: Validates documentId against checklist_items for shared identity
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "documents")) {
    return NextResponse.json({ error: "Document checklist requires a paid plan" }, { status: 403 })
  }

  const body = await request.json()
  const { documentId, status, completed, externalLink, notes, expiryDate } = body as {
    documentId?: string
    status?: DocumentStatus
    completed?: boolean // backward compat
    externalLink?: string
    notes?: string
    expiryDate?: string
  }

  if (!documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 })
  }

  // Validate status enum if provided
  const validStatuses: DocumentStatus[] = ["not_started", "gathering", "ready", "submitted", "expiring", "expired"]
  if (status !== undefined && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
  }

  // Validate externalLink — must be https://
  if (externalLink !== undefined && externalLink !== "" && !isValidExternalLink(externalLink)) {
    return NextResponse.json({ error: "External link must use https://" }, { status: 400 })
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

  // Build the updated entry from existing + new fields
  const currentStatuses = (plan.document_statuses || {}) as Record<string, unknown>
  const existing = normalizeDocumentStatus(currentStatuses[canonicalId])

  // Resolve the new status — support both new `status` field and legacy `completed` boolean
  let resolvedStatus: DocumentStatus = existing.status
  if (status !== undefined) {
    resolvedStatus = status
  } else if (typeof completed === "boolean") {
    resolvedStatus = completed ? "ready" : "not_started"
  }

  const updatedEntry: DocumentStatusEntry = {
    status: resolvedStatus,
    completedAt: resolvedStatus === "submitted"
      ? (existing.completedAt || new Date().toISOString())
      : existing.completedAt,
    documentName: matchingItem?.document ?? existing.documentName,
    externalLink: externalLink !== undefined ? (externalLink || undefined) : existing.externalLink,
    notes: notes !== undefined ? (notes || undefined) : existing.notes,
    expiryDate: expiryDate !== undefined ? (expiryDate || undefined) : existing.expiryDate,
  }

  const newStatuses = {
    ...currentStatuses,
    [canonicalId]: updatedEntry,
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

  // Normalize all entries before returning
  const normalizedStatuses: Record<string, DocumentStatusEntry> = {}
  for (const [key, value] of Object.entries(newStatuses)) {
    normalizedStatuses[key] = normalizeDocumentStatus(value)
  }

  return NextResponse.json({
    success: true,
    statuses: normalizedStatuses,
  })
}
