"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Shield,
  Loader2,
  CalendarDays,
  StickyNote,
  CheckCircle2,
  Info,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { FullPageGate } from "@/components/tier-gate"
import { useTier } from "@/hooks/use-tier"
import { VisaStatusStepper, type VisaApplicationStatus } from "@/components/visa-status-stepper"
import { VisaDocumentChecklist } from "@/components/visa-document-checklist"
import { VisaDeadlineCard } from "@/components/visa-deadline-card"
import type { DocumentStatusEntry } from "@/lib/gomate/types/document-status"
import { cn } from "@/lib/utils"

interface VisaOption {
  name: string
  type: string
  eligibility: string
  eligibilityReason: string
  requirements: string[]
  processingTime: string
  cost: string
  validity: string
  benefits: string[]
  officialLink?: string
}

interface VisaApplication {
  selectedVisaType: string | null
  applicationStatus: VisaApplicationStatus | null
  submittedAt: string | null
  expectedDecisionAt: string | null
  approvedAt: string | null
  visaStartDate: string | null
  visaExpiryDate: string | null
  notes: string | null
}

interface RenewalMilestone {
  label: string
  daysBeforeExpiry: number
  date: string
  status: "past" | "current" | "future"
}

interface VisaTrackerData {
  planId: string
  visaApplication: VisaApplication
  visaResearch: {
    visaOptions: VisaOption[]
    summary?: string
    disclaimer?: string
    officialSources?: { name: string; url: string }[]
  } | null
  visaDocuments: Array<{
    id: string
    document: string
    priority: string
    required: boolean
    category?: string
  }>
  documentStatuses: Record<string, DocumentStatusEntry>
  estimatedDeadline: {
    applyByDate: string
    daysUntilDeadline: number
    processingDays: number
  } | null
  targetDate: string | null
  renewalMilestones: RenewalMilestone[] | null
}

const ELIGIBILITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  medium: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  low: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300" },
  unknown: { bg: "bg-muted", text: "text-muted-foreground" },
}

export default function VisaTrackerPage() {
  const router = useRouter()
  const { tier } = useTier()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<VisaTrackerData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/visa-tracker")
        if (!res.ok) {
          const body = await res.json()
          setError(body.error || "Failed to load")
          return
        }
        setData(await res.json())
      } catch {
        setError("Failed to load visa tracker")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const patchApplication = useCallback(async (fields: Partial<VisaApplication>) => {
    if (!data) return
    setSaving(true)
    // Optimistic update
    setData((prev) => prev ? {
      ...prev,
      visaApplication: { ...prev.visaApplication, ...fields } as VisaApplication,
    } : prev)

    try {
      const res = await fetch("/api/visa-tracker", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
      if (res.ok) {
        const result = await res.json()
        setData((prev) => prev ? { ...prev, visaApplication: result.visaApplication } : prev)
      }
    } catch {
      // Revert by refetching
      const res = await fetch("/api/visa-tracker")
      if (res.ok) setData(await res.json())
    } finally {
      setSaving(false)
    }
  }, [data])

  const handleDocStatusToggle = useCallback(async (documentId: string, newStatus: "ready" | "not_started") => {
    const res = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, status: newStatus }),
    })
    if (res.ok) {
      // Refetch tracker to get updated statuses
      const trackerRes = await fetch("/api/visa-tracker")
      if (trackerRes.ok) setData(await trackerRes.json())
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[200px] w-full rounded-2xl" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Cannot Load Visa Tracker</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
        </div>
      </div>
    )
  }

  if (!data?.visaResearch || !data.visaResearch.visaOptions?.length) {
    return (
      <FullPageGate tier={tier} feature="visa_tracker" onUpgrade={() => router.push("/settings")}>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">No Visa Research Yet</h2>
            <p className="text-muted-foreground">
              Complete your profile and run research first. Your visa options will appear here once research is done.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" asChild><Link href="/dashboard">Dashboard</Link></Button>
              <Button asChild><Link href="/chat">Complete Profile</Link></Button>
            </div>
          </div>
        </div>
      </FullPageGate>
    )
  }

  const { visaApplication, visaResearch, visaDocuments, documentStatuses, estimatedDeadline, targetDate, renewalMilestones } = data
  const selectedVisa = visaResearch.visaOptions.find((v) => v.name === visaApplication.selectedVisaType)
  const hasSelectedVisa = !!selectedVisa

  return (
    <FullPageGate tier={tier} feature="visa_tracker" onUpgrade={() => router.push("/settings")}>
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Visa Application Tracker</h1>
                <p className="text-muted-foreground">Track your visa application progress</p>
              </div>
            </div>
            {saving && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </span>
            )}
          </div>

          {/* Visa Type Selection */}
          {!hasSelectedVisa ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Select Your Visa Type</h2>
              <p className="text-sm text-muted-foreground">
                Choose the visa you plan to apply for. You can change this later.
              </p>
              <div className="grid gap-3">
                {visaResearch.visaOptions.map((visa) => {
                  const elig = ELIGIBILITY_COLORS[visa.eligibility] || ELIGIBILITY_COLORS.unknown
                  return (
                    <button
                      key={visa.name}
                      onClick={() => patchApplication({
                        selectedVisaType: visa.name,
                        applicationStatus: "not_started",
                      })}
                      className="w-full p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors text-left space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-foreground">{visa.name}</h3>
                        <Badge className={cn("text-xs border-0", elig.bg, elig.text)}>
                          {visa.eligibility === "high" ? "Likely Eligible" :
                            visa.eligibility === "medium" ? "Possibly Eligible" :
                              visa.eligibility === "low" ? "Unlikely Eligible" : "Unknown"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{visa.eligibilityReason}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Processing: {visa.processingTime}</span>
                        <span>Cost: {visa.cost}</span>
                        <span>Validity: {visa.validity}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Selected visa info bar */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">{selectedVisa.name}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>Processing: {selectedVisa.processingTime}</span>
                    <span>Cost: {selectedVisa.cost}</span>
                    <span>Validity: {selectedVisa.validity}</span>
                  </div>
                </div>
                <button
                  onClick={() => patchApplication({
                    selectedVisaType: null,
                    applicationStatus: null,
                  })}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Change
                </button>
              </div>

              {/* Status Stepper */}
              <div className="p-6 rounded-2xl bg-card border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">Application Status</h2>
                <VisaStatusStepper
                  currentStatus={visaApplication.applicationStatus}
                  onStatusChange={(status) => patchApplication({ applicationStatus: status })}
                />
              </div>

              {/* Deadline Card */}
              <VisaDeadlineCard
                estimatedDeadline={estimatedDeadline}
                targetDate={targetDate}
                processingTime={selectedVisa.processingTime}
                officialLink={selectedVisa.officialLink}
              />

              {/* Date Inputs & Notes */}
              <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Application Details</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DateField
                    label="Submitted On"
                    icon={<CalendarDays className="w-3 h-3" />}
                    value={visaApplication.submittedAt}
                    onChange={(v) => patchApplication({ submittedAt: v })}
                  />
                  <DateField
                    label="Expected Decision"
                    icon={<CalendarDays className="w-3 h-3" />}
                    value={visaApplication.expectedDecisionAt}
                    onChange={(v) => patchApplication({ expectedDecisionAt: v })}
                  />
                  <DateField
                    label="Approved On"
                    icon={<CheckCircle2 className="w-3 h-3" />}
                    value={visaApplication.approvedAt}
                    onChange={(v) => patchApplication({ approvedAt: v })}
                  />
                  <DateField
                    label="Visa Start Date"
                    icon={<CalendarDays className="w-3 h-3" />}
                    value={visaApplication.visaStartDate}
                    onChange={(v) => patchApplication({ visaStartDate: v })}
                  />
                  <DateField
                    label="Visa Expiry Date"
                    icon={<CalendarDays className="w-3 h-3" />}
                    value={visaApplication.visaExpiryDate}
                    onChange={(v) => patchApplication({ visaExpiryDate: v })}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                    <StickyNote className="w-3 h-3" /> Notes
                  </label>
                  <textarea
                    value={visaApplication.notes || ""}
                    onChange={(e) => patchApplication({ notes: e.target.value || null })}
                    placeholder="Application reference number, embassy contact, reminders..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              {/* Visa-specific document checklist */}
              <div className="p-6 rounded-2xl bg-card border border-border">
                <VisaDocumentChecklist
                  items={visaDocuments}
                  statuses={documentStatuses}
                  onStatusToggle={handleDocStatusToggle}
                />
              </div>

              {/* Visa Renewal Timeline */}
              {renewalMilestones && visaApplication.applicationStatus === "approved" && visaApplication.visaExpiryDate && (
                <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Visa Renewal Timeline</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your visa expires on{" "}
                    <span className="font-medium text-foreground">
                      {new Date(visaApplication.visaExpiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </p>

                  {/* Expiry urgency bar */}
                  {(() => {
                    const now = new Date()
                    now.setHours(0, 0, 0, 0)
                    const expiry = new Date(visaApplication.visaExpiryDate)
                    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    const urgencyColor = daysLeft < 30 ? "text-red-600 dark:text-red-400" : daysLeft < 90 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                    const urgencyBg = daysLeft < 30 ? "bg-red-500" : daysLeft < 90 ? "bg-amber-500" : "bg-emerald-500"
                    const UrgencyIcon = daysLeft < 30 ? AlertTriangle : daysLeft < 90 ? Clock : CheckCircle2
                    return (
                      <div className="flex items-center gap-3">
                        <UrgencyIcon className={cn("w-5 h-5", urgencyColor)} />
                        <div className="flex-1">
                          <span className={cn("text-sm font-semibold", urgencyColor)}>
                            {daysLeft < 0 ? "Visa expired" : `${daysLeft} days remaining`}
                          </span>
                          <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", urgencyBg)} style={{ width: `${Math.max(0, Math.min(100, ((365 - daysLeft) / 365) * 100))}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Milestones */}
                  <div className="relative pl-6">
                    <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />
                    <div className="space-y-4">
                      {renewalMilestones.map((m, i) => {
                        const isExpiry = m.daysBeforeExpiry === 0
                        const dotColor = m.status === "past" ? "bg-muted-foreground" : m.status === "current" ? "bg-amber-500" : isExpiry ? "bg-red-500" : "bg-primary"
                        return (
                          <div key={i} className="relative flex items-start gap-3">
                            <div className={cn("absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border-2 border-background z-10 flex items-center justify-center", dotColor)}>
                              {m.status === "past" && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <div className="flex-1">
                              <p className={cn("text-sm font-medium", m.status === "past" ? "text-muted-foreground line-through" : "text-foreground")}>
                                {m.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                {m.daysBeforeExpiry > 0 && ` (${m.daysBeforeExpiry} days before expiry)`}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* CTA when in renewal window */}
                  {(() => {
                    const now = new Date()
                    now.setHours(0, 0, 0, 0)
                    const expiry = new Date(visaApplication.visaExpiryDate)
                    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    if (daysLeft <= 90 && daysLeft > 0) {
                      return (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            It&apos;s time to prepare for renewal — start gathering your documents and check the latest requirements.
                          </p>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}

              {/* Disclaimer */}
              {visaResearch.disclaimer && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-start gap-2">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">{visaResearch.disclaimer}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </FullPageGate>
  )
}

// ── Date field helper ────────────────────────────────
function DateField({ label, icon, value, onChange }: {
  label: string
  icon: React.ReactNode
  value: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
        {icon} {label}
      </label>
      <input
        type="date"
        value={value?.split("T")[0] || ""}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
