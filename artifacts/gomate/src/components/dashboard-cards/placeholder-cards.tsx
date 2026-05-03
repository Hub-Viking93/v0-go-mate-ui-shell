import type { ReactElement } from "react"
import {
  Banknote,
  Globe,
  CalendarClock,
  Sparkles,
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
          <h3 className="font-serif text-lg md:text-xl leading-tight tracking-tight text-foreground">{title}</h3>
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
            <h3 className="font-serif text-lg md:text-xl leading-tight tracking-tight text-foreground">Cultural Brief</h3>
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

export function PreDepartureTimelineCard({ reason }: { reason: string }) {
  return (
    <PlaceholderCard
      title="Pre-Departure Timeline"
      description="Your week-by-week countdown of what to do before flight day — packing, paperwork, farewells, all in order."
      reason={reason}
      Icon={CalendarClock}
      accent="stone"
    />
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
