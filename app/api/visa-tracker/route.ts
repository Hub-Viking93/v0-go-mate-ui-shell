import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"
import { parseTimeRange } from "@/lib/gomate/text-parsers"
import type { NormalizedVisaOption, VisaResearchResult } from "@/lib/gomate/research-visa"
import { normalizeDocumentStatus, type DocumentStatusEntry } from "@/lib/gomate/types/document-status"

type ApplicationStatus =
  | "not_started"
  | "preparing"
  | "submitted"
  | "awaiting_decision"
  | "approved"
  | "rejected"

interface VisaApplication {
  selectedVisaType: string | null
  applicationStatus: ApplicationStatus | null
  submittedAt: string | null
  expectedDecisionAt: string | null
  approvedAt: string | null
  visaStartDate: string | null
  visaExpiryDate: string | null
  notes: string | null
}

const VALID_STATUSES: ApplicationStatus[] = [
  "not_started", "preparing", "submitted", "awaiting_decision", "approved", "rejected",
]

function normalizeVisaApplication(raw: unknown): VisaApplication {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<VisaApplication>
  return {
    selectedVisaType: obj.selectedVisaType ?? null,
    applicationStatus: obj.applicationStatus ?? null,
    submittedAt: obj.submittedAt ?? null,
    expectedDecisionAt: obj.expectedDecisionAt ?? null,
    approvedAt: obj.approvedAt ?? null,
    visaStartDate: obj.visaStartDate ?? null,
    visaExpiryDate: obj.visaExpiryDate ?? null,
    notes: obj.notes ?? null,
  }
}

interface RenewalMilestone {
  label: string
  daysBeforeExpiry: number
  date: string
  status: "past" | "current" | "future"
}

function computeRenewalMilestones(visaExpiryDate: string | null): RenewalMilestone[] | null {
  if (!visaExpiryDate) return null

  const expiry = new Date(visaExpiryDate)
  if (Number.isNaN(expiry.getTime())) return null

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const milestones: { label: string; daysBeforeExpiry: number }[] = [
    { label: "Start renewal prep", daysBeforeExpiry: 90 },
    { label: "Submit renewal application", daysBeforeExpiry: 60 },
    { label: "Visa expires", daysBeforeExpiry: 0 },
  ]

  return milestones.map((m) => {
    const date = new Date(expiry)
    date.setDate(date.getDate() - m.daysBeforeExpiry)
    const isPast = date.getTime() < now.getTime()
    const isCurrent = !isPast && date.getTime() <= now.getTime() + 30 * 24 * 60 * 60 * 1000
    return {
      label: m.label,
      daysBeforeExpiry: m.daysBeforeExpiry,
      date: date.toISOString().split("T")[0],
      status: isPast ? "past" as const : isCurrent ? "current" as const : "future" as const,
    }
  })
}

function computeEstimatedDeadline(
  targetDate: string | null | undefined,
  selectedVisa: NormalizedVisaOption | undefined
): { applyByDate: string; daysUntilDeadline: number; processingDays: number } | null {
  if (!targetDate || !selectedVisa?.processingTime) return null

  const parsed = parseTimeRange(selectedVisa.processingTime)
  if (!parsed) return null

  // Use upper bound for safety
  const processingDays = parsed.max
  const target = new Date(targetDate)
  const applyBy = new Date(target)
  applyBy.setDate(applyBy.getDate() - processingDays)

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const daysUntil = Math.ceil((applyBy.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return {
    applyByDate: applyBy.toISOString().split("T")[0],
    daysUntilDeadline: daysUntil,
    processingDays,
  }
}

// GET: Fetch visa tracker data
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "visa_tracker")) {
    return NextResponse.json({ error: "Upgrade required" }, { status: 403 })
  }

  const { data: plan, error } = await supabase
    .from("relocation_plans")
    .select("id, visa_application, visa_research, checklist_items, document_statuses, profile_data")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 })
  }

  if (!plan) {
    return NextResponse.json({ error: "No active plan found" }, { status: 404 })
  }

  const visaApplication = normalizeVisaApplication(plan.visa_application)
  const visaResearch = (plan.visa_research || null) as VisaResearchResult | null

  // Filter checklist items to visa-specific documents
  const checklist = plan.checklist_items as { items?: Array<{ id: string; document: string; visaSpecific?: boolean; priority: string; required: boolean; category?: string }> } | null
  const visaDocuments = (checklist?.items || []).filter((item) => item.visaSpecific === true)

  // Normalize document statuses for visa-specific docs
  const rawStatuses = (plan.document_statuses || {}) as Record<string, unknown>
  const documentStatuses: Record<string, DocumentStatusEntry> = {}
  for (const doc of visaDocuments) {
    documentStatuses[doc.id] = normalizeDocumentStatus(rawStatuses[doc.id])
  }

  // Find selected visa option for deadline computation
  const selectedVisa = visaApplication.selectedVisaType
    ? visaResearch?.visaOptions?.find((v) => v.name === visaApplication.selectedVisaType)
    : undefined

  const profileData = plan.profile_data as { target_date?: string } | null
  const estimatedDeadline = computeEstimatedDeadline(profileData?.target_date, selectedVisa)
  const renewalMilestones = computeRenewalMilestones(visaApplication.visaExpiryDate)

  return NextResponse.json({
    planId: plan.id,
    visaApplication,
    visaResearch,
    visaDocuments,
    documentStatuses,
    estimatedDeadline,
    targetDate: profileData?.target_date || null,
    renewalMilestones,
  })
}

// PATCH: Update visa application fields
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "visa_tracker")) {
    return NextResponse.json({ error: "Upgrade required" }, { status: 403 })
  }

  const body = await request.json()

  // Validate applicationStatus if provided
  if (body.applicationStatus !== undefined && body.applicationStatus !== null) {
    if (!VALID_STATUSES.includes(body.applicationStatus)) {
      return NextResponse.json({ error: "Invalid application status" }, { status: 400 })
    }
  }

  const { data: plan, error: fetchError } = await supabase
    .from("relocation_plans")
    .select("id, visa_application")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (fetchError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  const existing = normalizeVisaApplication(plan.visa_application)

  // Merge provided fields
  const updated: VisaApplication = {
    selectedVisaType: body.selectedVisaType !== undefined ? body.selectedVisaType : existing.selectedVisaType,
    applicationStatus: body.applicationStatus !== undefined ? body.applicationStatus : existing.applicationStatus,
    submittedAt: body.submittedAt !== undefined ? body.submittedAt : existing.submittedAt,
    expectedDecisionAt: body.expectedDecisionAt !== undefined ? body.expectedDecisionAt : existing.expectedDecisionAt,
    approvedAt: body.approvedAt !== undefined ? body.approvedAt : existing.approvedAt,
    visaStartDate: body.visaStartDate !== undefined ? body.visaStartDate : existing.visaStartDate,
    visaExpiryDate: body.visaExpiryDate !== undefined ? body.visaExpiryDate : existing.visaExpiryDate,
    notes: body.notes !== undefined ? body.notes : existing.notes,
  }

  const { error: updateError } = await supabase
    .from("relocation_plans")
    .update({
      visa_application: updated,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id)
    .eq("user_id", user.id)

  if (updateError) {
    return NextResponse.json({ error: "Failed to update visa application" }, { status: 500 })
  }

  return NextResponse.json({ success: true, visaApplication: updated })
}
