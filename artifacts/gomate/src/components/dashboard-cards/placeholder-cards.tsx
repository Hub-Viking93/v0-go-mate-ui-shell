import { useEffect, useState, type ReactElement } from "react"
import {
  Banknote,
  Globe,
  CalendarClock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Circle,
  type LucideIcon,
} from "lucide-react"
import { SchoolsCard } from "./schools-card"
import { PetRelocationCard } from "./pet-relocation-card"
import { IncomeComplianceCard } from "./income-compliance-card"
import { FamilyReunionCard } from "./family-reunion-card"
import { DepartureTaxCard } from "./departure-tax-card"
import { VehicleImportCard } from "./vehicle-import-card"
import { PropertyPurchaseCard } from "./property-purchase-card"
import { PostedWorkerCard } from "./posted-worker-card"
import { TrailingSpouseCard } from "./trailing-spouse-card"
import { ChronicHealthCard } from "./chronic-health-card"
import { PriorVisaHistoryCard } from "./prior-visa-history-card"

interface PlaceholderCardProps {
  title: string
  description: string
  reason: string
  Icon: LucideIcon
  accent?: "emerald" | "amber" | "stone"
  /** Optional live specialist output. When present we render the actual
   * paragraphs + sources panel instead of the "Coming soon" stub. */
  specialistOutput?: SpecialistContentLite | null
}

/** Slim shape — matches what dashboard reads from
 *  relocation_plans.research_meta.specialists[<name>]. */
export interface SpecialistContentLite {
  paragraphs: string[]
  sources: { url: string; label: string }[]
  quality: "full" | "partial" | "fallback"
}

const ACCENT_MAP = {
  emerald: {
    stripe: "bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500",
    eyebrow: "text-emerald-700 dark:text-emerald-400",
    icon: "text-emerald-600/70 dark:text-emerald-500/70",
  },
  amber: {
    stripe: "bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500",
    eyebrow: "text-amber-700 dark:text-amber-400",
    icon: "text-amber-600/70 dark:text-amber-500/70",
  },
  stone: {
    stripe: "bg-gradient-to-r from-stone-300 via-stone-400 to-stone-300 dark:from-stone-700 dark:via-stone-600 dark:to-stone-700",
    eyebrow: "text-stone-600 dark:text-stone-400",
    icon: "text-stone-500 dark:text-stone-400",
  },
}

function PlaceholderCard({ title, description, reason, Icon, accent = "stone", specialistOutput }: PlaceholderCardProps) {
  const a = ACCENT_MAP[accent]
  const hasContent = !!(specialistOutput && specialistOutput.paragraphs.length > 0)
  const qualityLabel =
    specialistOutput?.quality === "fallback"
      ? "AI knowledge"
      : specialistOutput?.quality === "partial"
        ? "Partial sources"
        : hasContent
          ? "Live research"
          : null
  const qualityClass =
    specialistOutput?.quality === "fallback"
      ? "bg-stone-100 text-stone-700 border-stone-200"
      : specialistOutput?.quality === "partial"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-emerald-100 text-emerald-800 border-emerald-200"
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card p-5 md:p-6 flex flex-col gap-3 group hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-md transition-all duration-300"
      data-card-state={hasContent ? "live" : "placeholder"}
    >
      <div className={`absolute inset-x-0 top-0 h-[3px] ${a.stripe}`} />
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${a.icon}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`gm-eyebrow mb-1 ${a.eyebrow}`}>{reason}</p>
            {qualityLabel && (
              <span className={`text-[10px] uppercase tracking-[0.12em] font-semibold border rounded-full px-2 py-0.5 ${qualityClass}`}>
                {qualityLabel}
              </span>
            )}
          </div>
          <h3 className="font-sans text-lg md:text-xl leading-tight tracking-tight text-foreground">{title}</h3>
        </div>
      </div>
      {hasContent ? (
        (() => {
          // Trim long specialist prose to 2-sentence preview; full text
          // behind a disclosure to keep the dashboard scannable.
          const first = specialistOutput!.paragraphs[0] ?? ""
          const sentences = first.split(/(?<=[.!?])\s+/)
          const preview = sentences.slice(0, 2).join(" ")
          const shortened = preview.length > 320 ? preview.slice(0, 317) + "…" : preview
          const hasMore = specialistOutput!.paragraphs.length > 1 || preview.length < first.length
          return (
            <div className="space-y-2.5">
              <p className="text-sm text-muted-foreground leading-relaxed">{shortened}</p>
              {hasMore && (
                <details className="group">
                  <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
                    Read full briefing
                    <span className="transition-transform group-open:rotate-180">▾</span>
                  </summary>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground leading-relaxed border-l-2 border-emerald-500/30 pl-3">
                    {specialistOutput!.paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </details>
              )}
              {specialistOutput!.sources.length > 0 && (
                <div className="pt-2 border-t border-dashed border-stone-200 dark:border-stone-800">
                  <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
                    Sources ({specialistOutput!.sources.length})
                  </p>
                  <ul className="space-y-1">
                    {specialistOutput!.sources.slice(0, 4).map((s, i) => (
                      <li key={i} className="text-[11px]">
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-400 hover:underline">
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })()
      ) : (
        <>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          <div className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-500 dark:text-stone-400 pt-1">
            <Sparkles className={`h-3 w-3 ${a.icon}`} />
            Coming soon
          </div>
        </>
      )}
    </div>
  )
}

export function BankingWizardCard({ reason, specialistOutput }: { reason: string; specialistOutput?: SpecialistContentLite | null }) {
  return (
    <PlaceholderCard
      title="Banking Wizard"
      description="Step-by-step help opening a destination bank account, setting up your IBAN, and transferring funds before you arrive."
      reason={reason}
      Icon={Banknote}
      accent="emerald"
      specialistOutput={specialistOutput}
    />
  )
}

export function CulturalCard({ reason, specialistOutput, destination }: { reason: string; specialistOutput?: SpecialistContentLite | null; destination?: string }) {
  // When the cultural specialist returned content, render it normally.
  // Otherwise show a CTA linking to the public country-guide on
  // gomaterelocate.com — better UX than "Coming soon" since the
  // marketing site has rich destination guides already.
  if (!specialistOutput || specialistOutput.paragraphs.length === 0) {
    const slug = (destination ?? "").toLowerCase().replace(/[^a-z]+/g, "-")
    return (
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card p-5 md:p-6 flex flex-col gap-3 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-md transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 mt-0.5 shrink-0 text-amber-600/70 dark:text-amber-500/70" />
          <div className="min-w-0 flex-1">
            <p className="gm-eyebrow mb-1 text-amber-700 dark:text-amber-400">{reason}</p>
            <h3 className="font-sans text-lg md:text-xl leading-tight tracking-tight text-foreground">Cultural Brief</h3>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Day-to-day cultural norms, communication style, working culture, and integration gotchas for {destination || "your destination"}.
        </p>
        <a
          href={destination ? `https://www.gomaterelocate.com/country-guides/${slug}` : "https://www.gomaterelocate.com/country-guides"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline pt-1"
        >
          Read the full {destination || "country"} guide →
        </a>
      </div>
    )
  }
  return (
    <PlaceholderCard
      title="Cultural Brief"
      description="Day-to-day cultural norms, communication style, and integration tips for settling in confidently."
      reason={reason}
      Icon={Globe}
      accent="amber"
      specialistOutput={specialistOutput}
    />
  )
}

interface PreDepActionLite {
  id: string
  title: string
  category: string
  weeksBeforeMoveStart: number
  status: "not_started" | "in_progress" | "complete" | "blocked" | "skipped"
  onCriticalPath?: boolean
  deadlineIso?: string
}

interface PreDepTimelineLite {
  actions: PreDepActionLite[]
  totalActions: number
  moveDate: string
  longestLeadTimeWeeks: number
}

function formatDaysToMove(moveDateIso: string): string {
  const days = Math.ceil((new Date(moveDateIso).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return "Past your move date"
  if (days === 0) return "Move day"
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} to move`
  const weeks = Math.round(days / 7)
  return `${weeks} weeks to move`
}

export function PreDepartureTimelineCard({ reason }: { reason: string }) {
  const [data, setData] = useState<PreDepTimelineLite | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/pre-departure")
        if (!active) return
        if (res.status === 404) {
          setData(null)
          return
        }
        if (!res.ok) return
        const json = await res.json() as Partial<PreDepTimelineLite> & { generated?: boolean }
        // Empty 200 payload (generated:false, actions:[]) is the
        // "not generated yet" signal — render placeholder, not a
        // half-populated card.
        if (json.generated === false || !json.actions || json.actions.length === 0) {
          setData(null)
          return
        }
        setData(json as PreDepTimelineLite)
      } catch {
        /* swallow — placeholder fallback covers it */
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  // Skeleton while we fetch — same outer chrome as the placeholder card
  // so the layout doesn't shift when data arrives.
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card p-5 md:p-6 flex flex-col gap-3 animate-pulse">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-stone-300 via-stone-400 to-stone-300 dark:from-stone-700 dark:via-stone-600 dark:to-stone-700" />
        <div className="flex items-start gap-3">
          <CalendarClock className="w-5 h-5 mt-0.5 text-stone-400" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-24 bg-stone-200 dark:bg-stone-800 rounded mb-2" />
            <div className="h-5 w-40 bg-stone-200 dark:bg-stone-800 rounded" />
          </div>
        </div>
        <div className="h-4 w-full bg-stone-200 dark:bg-stone-800 rounded" />
        <div className="h-4 w-2/3 bg-stone-200 dark:bg-stone-800 rounded" />
      </div>
    )
  }

  // Generate-CTA when no timeline exists yet.
  if (!data) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card p-5 md:p-6 flex flex-col gap-3 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-md transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-stone-300 via-stone-400 to-stone-300 dark:from-stone-700 dark:via-stone-600 dark:to-stone-700" />
        <div className="flex items-start gap-3">
          <CalendarClock className="w-5 h-5 mt-0.5 shrink-0 text-stone-500 dark:text-stone-400" />
          <div className="min-w-0 flex-1">
            <p className="gm-eyebrow mb-1 text-stone-600 dark:text-stone-400">{reason}</p>
            <h3 className="font-sans text-lg md:text-xl leading-tight tracking-tight text-foreground">
              Pre-Departure Timeline
            </h3>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your week-by-week countdown of what to do before flight day — apostilles, visa pickup,
          banking bridge, lease termination — sequenced from your profile.
        </p>
        <a
          href="/checklist?tab=pre-move"
          className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline pt-1"
        >
          Generate timeline
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    )
  }

  const total = data.actions.length
  const done = data.actions.filter((a) => a.status === "complete").length
  const inProgress = data.actions.filter((a) => a.status === "in_progress").length
  const upcoming = data.actions
    .filter((a) => a.status !== "complete" && a.status !== "skipped")
    .sort((a, b) => b.weeksBeforeMoveStart - a.weeksBeforeMoveStart)
    .slice(0, 3)
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card p-5 md:p-6 flex flex-col gap-3 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-md transition-all duration-300" data-card-state="live">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500" />
      <div className="flex items-start gap-3">
        <CalendarClock className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600/70 dark:text-emerald-500/70" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="gm-eyebrow mb-1 text-emerald-700 dark:text-emerald-400">{reason}</p>
            <span className="text-[10px] uppercase tracking-[0.12em] font-semibold border rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800 border-emerald-200">
              {formatDaysToMove(data.moveDate)}
            </span>
          </div>
          <h3 className="font-sans text-lg md:text-xl leading-tight tracking-tight text-foreground">
            Pre-Departure Timeline
          </h3>
        </div>
      </div>

      {/* Progress bar + counts */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{done}</span> done · {inProgress} in progress · {total - done - inProgress} not started
          </span>
          <span className="font-semibold text-foreground">{progressPct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Up next — 3 most-imminent open actions */}
      {upcoming.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-600 dark:text-stone-400">
            Up next
          </p>
          <ul className="space-y-1">
            {upcoming.map((a) => {
              const Icon =
                a.status === "in_progress" ? Clock :
                a.status === "complete" ? CheckCircle2 : Circle
              const iconColor =
                a.status === "in_progress" ? "text-amber-600" :
                a.status === "complete" ? "text-emerald-600" : "text-stone-400"
              return (
                <li key={a.id} className="flex items-start gap-2 text-xs">
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${iconColor}`} />
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground">{a.title}</span>
                    <span className="text-muted-foreground ml-1.5">
                      · {a.weeksBeforeMoveStart}w before
                    </span>
                    {a.onCriticalPath && (
                      <span className="ml-1.5 text-[9px] uppercase tracking-wide font-semibold text-rose-600 dark:text-rose-400">
                        Critical
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <a
        href="/checklist?tab=pre-move"
        className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline pt-1"
      >
        Open full checklist
        <ArrowRight className="w-3.5 h-3.5" />
      </a>
    </div>
  )
}

import type { CardId } from "@/lib/gomate/dashboard-state"

export const PLACEHOLDER_CARD_REGISTRY: Partial<
  Record<CardId, (props: { reason: string }) => ReactElement>
> = {
  "banking-wizard-card": BankingWizardCard,
  "cultural-card": CulturalCard,
  "pre-departure-timeline": PreDepartureTimelineCard,
  "schools-card": SchoolsCard,
  "pet-relocation-card": PetRelocationCard,
  "income-compliance-card": IncomeComplianceCard,
  "family-reunion-card": FamilyReunionCard,
  "departure-tax-card": DepartureTaxCard,
  "vehicle-import-card": VehicleImportCard,
  "property-purchase-card": PropertyPurchaseCard,
  "posted-worker-card": PostedWorkerCard,
  "trailing-spouse-card": TrailingSpouseCard,
  "chronic-health-card": ChronicHealthCard,
  "prior-visa-history-card": PriorVisaHistoryCard,
}
