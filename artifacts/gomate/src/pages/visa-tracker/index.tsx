

import { useState, useEffect, useCallback } from "react"
import { Link } from "wouter"
import { useRouter } from "@/lib/router-compat"
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
import { PageHero } from "@/components/page-hero"
import { TrustBadge, type TrustSource } from "@/components/trust-badge"
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
  postingOrSecondment?: string | null
  purpose?: string | null
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
    const previous = data.visaApplication
    const merged = { ...previous, ...fields } as VisaApplication
    // Optimistic update
    setData((prev) => prev ? { ...prev, visaApplication: merged } : prev)

    try {
      const res = await fetch("/api/visa-tracker", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: data.planId, application: merged }),
      })
      if (!res.ok) {
        // Revert
        setData((prev) => prev ? { ...prev, visaApplication: previous } : prev)
      }
    } catch {
      const res = await fetch("/api/visa-tracker")
      if (res.ok) setData(await res.json())
    } finally {
      setSaving(false)
    }
  }, [data])

  const handleDocStatusToggle = useCallback(async (documentId: string, newStatus: "ready" | "not_started") => {
    if (!data?.planId) return
    const res = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: data.planId, documentId, status: newStatus }),
    })
    if (res.ok) {
      // Refetch tracker to get updated statuses
      const trackerRes = await fetch("/api/visa-tracker")
      if (trackerRes.ok) setData(await trackerRes.json())
    }
  }, [data?.planId])

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
          <h2 className="text-xl font-semibold">Cannot Load Visa</h2>
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
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          <PageHero
            eyebrow="Visa workspace"
            title={hasSelectedVisa ? `${selectedVisa?.name ?? "Your visa"}` : "Pick your visa pathway"}
            subtitle={
              hasSelectedVisa
                ? `Track your application progress, deadlines and documents in one place.`
                : `Compare the visa options our specialists found for you and lock in the right pathway. You can switch later.`
            }
            actions={
              <Button variant="outline" size="sm" asChild className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
                <Link href="/dashboard"><ArrowLeft className="w-3.5 h-3.5 mr-1" />Dashboard</Link>
              </Button>
            }
            meta={saving ? <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Saving…</span> : null}
          />

          {/* Visa Type Selection */}
          {!hasSelectedVisa ? (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-700 dark:text-emerald-400">Step 1</p>
                <h2 className="text-xl font-sans font-semibold text-foreground mt-0.5">Select your visa pathway</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Our specialists ranked these options against your profile. Pick the one you want to pursue — you can switch later.
                </p>
              </div>
              <div className="grid gap-4">
                {visaResearch.visaOptions.map((visa) => {
                  const elig = ELIGIBILITY_COLORS[visa.eligibility] || ELIGIBILITY_COLORS.unknown
                  const eligLabel =
                    visa.eligibility === "high" ? "Likely eligible" :
                    visa.eligibility === "medium" ? "Possibly eligible" :
                    visa.eligibility === "low" ? "Unlikely eligible" : "Eligibility unclear"
                  const stripeColor =
                    visa.eligibility === "high" ? "from-emerald-400 via-teal-400 to-emerald-500" :
                    visa.eligibility === "medium" ? "from-amber-400 via-orange-400 to-amber-500" :
                    visa.eligibility === "low" ? "from-rose-400 via-red-400 to-rose-500" :
                    "from-stone-300 via-stone-400 to-stone-300"
                  return (
                    <button
                      key={visa.name}
                      onClick={() => patchApplication({
                        selectedVisaType: visa.name,
                        applicationStatus: "not_started",
                      })}
                      className="group relative w-full text-left rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card overflow-hidden transition-all hover:shadow-md hover:border-emerald-500/40"
                    >
                      <div className={cn("absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r", stripeColor)} />
                      <div className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-sans text-lg font-semibold text-foreground leading-tight">
                              {visa.name}
                            </h3>
                            {(() => {
                              // The LLM occasionally returns a long
                              // analytical reasoning chain instead of a
                              // single user-facing summary. Trim to the
                              // first sentence (or 200 chars), expose the
                              // full text behind a "Why?" disclosure so
                              // the card stays scannable.
                              const reason = (visa.eligibilityReason ?? "").trim()
                              const firstSentence = reason.split(/(?<=[.!?])\s+/)[0] ?? reason
                              const summary = firstSentence.length > 200 ? firstSentence.slice(0, 197) + "…" : firstSentence
                              const hasMore = reason.length > summary.length
                              return (
                                <>
                                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                    {summary}
                                  </p>
                                  {hasMore && (
                                    <details className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                                      <summary className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 cursor-pointer hover:underline list-none">
                                        Why this assessment? →
                                      </summary>
                                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed pl-3 border-l-2 border-stone-200 dark:border-stone-700">
                                        {reason}
                                      </p>
                                    </details>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                          <Badge className={cn("text-[11px] font-semibold border-0 shrink-0 px-2.5 py-1", elig.bg, elig.text)}>
                            {eligLabel}
                          </Badge>
                        </div>
                        {(() => {
                          const sources: TrustSource[] = []
                          for (const u of (visa as { sourceUrls?: string[] }).sourceUrls ?? []) {
                            sources.push({ name: visaUrlDomain(u), url: u, authority: "official" })
                          }
                          if (visa.officialLink) sources.push({ name: `${visa.name} — official portal`, url: visa.officialLink, authority: "official" })
                          if (sources.length === 0) return null
                          return (
                            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                              <TrustBadge sources={sources} />
                            </div>
                          )
                        })()}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-stone-200 dark:border-stone-800">
                          <InfoChip label="Processing" value={visa.processingTime} />
                          <InfoChip label="Cost" value={visa.cost} />
                          <InfoChip label="Validity" value={visa.validity} />
                        </div>
                        <div className="pt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Choose this pathway →
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Selected visa info bar.
                  When the LLM returns placeholder phrasing like "See
                  official source for current fees" for cost/validity,
                  the field is effectively empty — show an em-dash and
                  surface a real, clickable link to the official source
                  next to the row instead. That's what the user actually
                  needs (a destination they can read), not a sentence
                  that says "go look elsewhere". */}
              {(() => {
                const isPlaceholder = (v: string | undefined) =>
                  !v || /see\s+official\s+source/i.test(v)
                const placeholderDash = (v: string | undefined) =>
                  isPlaceholder(v) ? "—" : v
                const sources: TrustSource[] = []
                for (const u of (selectedVisa as { sourceUrls?: string[] }).sourceUrls ?? []) {
                  sources.push({ name: visaUrlDomain(u), url: u, authority: "official" })
                }
                if (selectedVisa.officialLink) {
                  sources.push({
                    name: `${selectedVisa.name} — official portal`,
                    url: selectedVisa.officialLink,
                    authority: "official",
                  })
                }
                return (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-medium text-foreground">{selectedVisa.name}</span>
                      </div>
                      <div className="flex gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>Processing: <span className="text-foreground">{placeholderDash(selectedVisa.processingTime)}</span></span>
                        <span>Cost: <span className="text-foreground">{placeholderDash(selectedVisa.cost)}</span></span>
                        <span>Validity: <span className="text-foreground">{placeholderDash(selectedVisa.validity)}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {sources.length > 0 && (
                        <TrustBadge sources={sources} />
                      )}
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
                  </div>
                )
              })()}

              {/* Posted Worker Compliance (only for corporate postings) */}
              {data.postingOrSecondment === "yes" && data.purpose === "work" && (
                <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                        Posted-Worker Compliance Required
                      </h2>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Because this is a corporate posting / secondment, your employer must handle additional obligations
                        before you arrive: A1 / Certificate of Coverage, posted-worker notification (PWD/Utstationering),
                        and continued home-country social security.
                      </p>
                      <ul className="text-sm text-amber-800 dark:text-amber-200 list-disc pl-5 space-y-0.5">
                        <li>EU/EEA: Apply for an A1 certificate via your home social-security agency.</li>
                        <li>Non-EU: Verify a bilateral Certificate of Coverage exists (otherwise dual contributions).</li>
                        <li>Notify the host country&apos;s posted-worker register before the assignment starts.</li>
                      </ul>
                      <Button asChild size="sm" variant="outline" className="mt-2">
                        <Link href="/chat">Ask GoMate about your A1 / CoC →</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Stepper */}
              <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card">
                <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 via-blue-500 to-sky-500" />
                <div className="p-5 md:p-6">
                  <p className="gm-eyebrow text-sky-700 dark:text-sky-400">Where you are</p>
                  <h2 className="font-sans text-lg md:text-xl leading-tight tracking-tight text-foreground mt-0.5 mb-5">
                    Application Status
                  </h2>
                  <VisaStatusStepper
                    currentStatus={visaApplication.applicationStatus}
                    onStatusChange={(status) => patchApplication({ applicationStatus: status })}
                  />
                </div>
              </div>

              {/* Deadline Card */}
              <VisaDeadlineCard
                estimatedDeadline={estimatedDeadline}
                targetDate={targetDate}
                processingTime={selectedVisa.processingTime}
                officialLink={selectedVisa.officialLink}
              />

              {/* Date Inputs & Notes */}
              <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card">
                <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500" />
                <div className="p-5 md:p-6 space-y-5">
                  <div>
                    <p className="gm-eyebrow text-emerald-700 dark:text-emerald-400">Track key dates</p>
                    <h2 className="font-sans text-lg md:text-xl leading-tight tracking-tight text-foreground mt-0.5">
                      Application Details
                    </h2>
                  </div>

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
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 dark:text-stone-400 flex items-center gap-1 mb-1.5">
                      <StickyNote className="w-3 h-3" /> Notes
                    </label>
                    <textarea
                      value={visaApplication.notes || ""}
                      onChange={(e) => patchApplication({ notes: e.target.value || null })}
                      placeholder="Application reference number, embassy contact, reminders..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Visa-specific document checklist — already wraps itself in
                  an editorial card (3px stripe + serif header + progress). */}
              <VisaDocumentChecklist
                items={visaDocuments}
                statuses={documentStatuses}
                onStatusToggle={handleDocStatusToggle}
              />

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

function InfoChip({ label, value }: { label: string; value: string }) {
  const isPlaceholder = !value || /see official|n\/?a/i.test(value)
  return (
    <div className="rounded-lg bg-stone-50 dark:bg-stone-900/40 px-2.5 py-2 border border-stone-200/60 dark:border-stone-800">
      <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-stone-500 dark:text-stone-500">
        {label}
      </p>
      <p className={cn("text-xs font-medium mt-0.5 leading-tight", isPlaceholder ? "text-muted-foreground italic" : "text-foreground")}>
        {value || "—"}
      </p>
    </div>
  )
}

function visaUrlDomain(u: string): string {
  try { return new URL(u).host.replace(/^www\./, "") } catch { return u }
}
