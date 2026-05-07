

import React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  DollarSign,
  CheckCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  FileText,
  Building2,
  CreditCard,
  Heart,
  Car,
  Home,
  Zap,
  HelpCircle,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface RequirementItem {
  title: string
  description: string
  steps: string[]
  documents: string[]
  estimatedTime: string
  cost?: string
  officialLink?: string
  tips?: string[]
}

interface RequirementCategory {
  category: string
  icon: string
  items: RequirementItem[]
}

export interface LocalRequirementsData {
  destination: string
  city?: string
  researchedAt: string
  categories: RequirementCategory[]
  summary: string
  disclaimer: string
}

interface LocalRequirementsCardProps {
  planId?: string
  destination?: string
  city?: string
  cachedResearch?: LocalRequirementsData | null
  researchStatus?: string | null
  onResearchComplete?: (data: LocalRequirementsData) => void
}

const categoryIcons: Record<string, React.ReactNode> = {
  registration: <Building2 className="w-4 h-4" />,
  tax: <FileText className="w-4 h-4" />,
  healthcare: <Heart className="w-4 h-4" />,
  banking: <CreditCard className="w-4 h-4" />,
  "driver's license": <Car className="w-4 h-4" />,
  housing: <Home className="w-4 h-4" />,
  utilities: <Zap className="w-4 h-4" />,
  other: <HelpCircle className="w-4 h-4" />,
}

function getCategoryIcon(category?: string): React.ReactNode {
  if (!category) return <ClipboardList className="w-4 h-4" />
  const lowerCategory = category.toLowerCase()
  for (const [key, icon] of Object.entries(categoryIcons)) {
    if (lowerCategory.includes(key)) return icon
  }
  return <ClipboardList className="w-4 h-4" />
}

function RequirementItemCard({
  item,
  categoryName,
}: {
  item: RequirementItem
  categoryName: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [completed, setCompleted] = useState(false)

  return (
    <div
      className={cn(
        "border rounded-xl p-4 transition-all",
        completed
          ? "border-green-500/30 bg-green-500/5"
          : "border-border bg-card/50 hover:border-primary/30"
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={completed}
          onCheckedChange={(checked) => setCompleted(checked as boolean)}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4
              className={cn(
                "font-medium",
                completed ? "text-muted-foreground line-through" : "text-foreground"
              )}
            >
              {item.title}
            </h4>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>

          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            {item.estimatedTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.estimatedTime}
              </span>
            )}
            {item.cost && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {item.cost}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-primary mt-3 hover:text-primary/80 ml-7"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Less details" : "More details"}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-4 ml-7">
          {item.steps && item.steps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Steps:</p>
              <ol className="space-y-1 list-decimal list-inside">
                {item.steps.map((step, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {item.documents && item.documents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Documents needed:
              </p>
              <ul className="space-y-1">
                {item.documents.map((doc, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <CheckCircle className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.tips && item.tips.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2 text-primary">Tips:</p>
              <ul className="space-y-1">
                {item.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.officialLink && (
            <a
              href={item.officialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 bg-primary/10 px-2 py-1 rounded"
            >
              <ExternalLink className="w-3 h-3" />
              Official website
            </a>
          )}
        </div>
      )}
    </div>
  )
}

const CATEGORY_TINTS = [
  { stripe: "from-emerald-400 via-teal-500 to-emerald-500", icon: "text-emerald-700 dark:text-emerald-400", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/40" },
  { stripe: "from-amber-400 via-orange-400 to-amber-500", icon: "text-amber-700 dark:text-amber-400", chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/40" },
  { stripe: "from-sky-400 via-blue-500 to-sky-500", icon: "text-sky-700 dark:text-sky-400", chip: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200/60 dark:border-sky-900/40" },
  { stripe: "from-rose-400 via-pink-500 to-rose-500", icon: "text-rose-700 dark:text-rose-400", chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/60 dark:border-rose-900/40" },
  { stripe: "from-purple-400 via-violet-500 to-purple-500", icon: "text-purple-700 dark:text-purple-400", chip: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/60 dark:border-purple-900/40" },
  { stripe: "from-stone-400 via-stone-500 to-stone-400", icon: "text-stone-700 dark:text-stone-400", chip: "bg-stone-50 text-stone-700 dark:bg-stone-950/40 dark:text-stone-300 border-stone-200/60 dark:border-stone-900/40" },
]

function CategoryCard({
  category,
  tintIndex,
}: {
  category: RequirementCategory
  tintIndex: number
}) {
  const [expanded, setExpanded] = useState(false)
  const items = category.items || []
  const tint = CATEGORY_TINTS[tintIndex % CATEGORY_TINTS.length]
  const previewCount = expanded ? items.length : Math.min(2, items.length)
  const previewItems = items.slice(0, previewCount)
  const remaining = items.length - previewCount

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card flex flex-col group hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-md transition-all duration-300">
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${tint.stripe}`} />
      <div className="p-5 md:p-6 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`shrink-0 ${tint.icon}`}>
              {getCategoryIcon(category.category)}
            </div>
            <h3 className="font-sans text-lg leading-tight tracking-tight text-foreground truncate">
              {category.category || "Other"}
            </h3>
          </div>
          <span className={`shrink-0 text-[10px] uppercase tracking-[0.12em] font-semibold border rounded-full px-2 py-0.5 ${tint.chip}`}>
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>

        {previewItems.length > 0 ? (
          <ul className="space-y-2.5">
            {previewItems.map((item, i) => (
              <li key={i} className="border-t border-dashed border-stone-200 dark:border-stone-800 pt-2.5 first:border-t-0 first:pt-0">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
                  {item.estimatedTime && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                      <Clock className="w-3 h-3" /> {item.estimatedTime}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
                {(item.cost || item.officialLink) && (
                  <div className="flex items-center gap-3 mt-1.5">
                    {item.cost && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <DollarSign className="w-3 h-3" />
                        {item.cost}
                      </span>
                    )}
                    {item.officialLink && (
                      <a
                        href={item.officialLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        Official source <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic">No items in this category.</p>
        )}

        {items.length > 2 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline self-start pt-1"
          >
            {expanded ? (
              <>Show less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Show all {items.length} items <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export function LocalRequirementsCard({
  planId,
  destination,
  city,
  cachedResearch,
  researchStatus,
  onResearchComplete,
}: LocalRequirementsCardProps) {
  const [isResearching, setIsResearching] = useState(false)
  const [research, setResearch] = useState<LocalRequirementsData | null>(() => {
    if (!cachedResearch) return null
    // Normalize categories to always be an array
    const cats = cachedResearch.categories
    return {
      ...cachedResearch,
      categories: Array.isArray(cats)
        ? cats
        : cats && typeof cats === "object"
        ? Object.values(cats)
        : [],
    }
  })
  const [error, setError] = useState<string | null>(null)

  const handleResearch = async () => {
    if (!planId) {
      setError("No relocation plan found. Please complete your profile first.")
      return
    }

    setIsResearching(true)
    setError(null)

    try {
      const response = await fetch("/api/research/local-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, forceRefresh: Boolean(research) }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to research local requirements")
      }

      const data = await response.json()
      const r = data.research
      const cats = r?.categories
      const normalized = {
        ...r,
        categories: Array.isArray(cats)
          ? cats
          : cats && typeof cats === "object"
          ? Object.values(cats)
          : [],
      }
      setResearch(normalized)
      onResearchComplete?.(normalized)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed. Please try again.")
    } finally {
      setIsResearching(false)
    }
  }

  const CACHE_EXPIRY_DAYS = 7

  const getResearchAge = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  const formatResearchDate = (dateStr: string) => {
    const diffDays = getResearchAge(dateStr)

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return new Date(dateStr).toLocaleDateString()
  }

  const isResearchStale = (dateStr: string) => {
    return getResearchAge(dateStr) >= CACHE_EXPIRY_DAYS
  }

  // Editorial empty state — no centered placeholder icon-circle.
  if (!research) {
    return (
      <div className="gm-editorial-card overflow-hidden">
        <div
          className="h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, #7C5A2E 0%, #D97706 60%, #F26D4C 100%)",
          }}
        />
        <div className="p-7 md:p-8">
          <span className="gm-eyebrow">Local Requirements</span>
          <h3
            className="mt-3 font-sans text-foreground"
            style={{
              fontSize: "26px",
              fontWeight: 600,
              letterSpacing: "-0.012em",
              lineHeight: 1.15,
            }}
          >
            What you&apos;ll handle after you land
          </h3>
          <p className="mt-3 text-[15px] text-foreground/65 leading-[1.55] max-w-xl">
            Registration, tax ID, healthcare, banking, driver&apos;s licence — the
            local steps that often surprise newcomers to{" "}
            <span className="text-foreground font-medium">
              {city ? `${city}, ${destination}` : destination || "your destination"}
            </span>
            . We&apos;ll pull the official sources and timelines for you.
          </p>

          {error && (
            <div className="mt-5 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button
              onClick={handleResearch}
              disabled={isResearching || researchStatus === "in_progress"}
              className="gap-2 rounded-xl border-0 text-white font-semibold shadow-[0_4px_16px_rgba(217,119,6,0.30)]"
              style={{
                background:
                  "linear-gradient(180deg, #E08A2C 0%, #D97706 100%)",
              }}
            >
              {isResearching || researchStatus === "in_progress" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Researching…
                </>
              ) : (
                <>Research local steps</>
              )}
            </Button>
            <span className="text-xs text-foreground/50">
              Takes ~30–60 seconds · uses official local sources
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Show research results
  const totalItems = (research.categories ?? []).reduce(
    (acc, c) => acc + (c.items?.length ?? 0),
    0,
  )

  return (
    <div className="space-y-6">
      {/* Editorial hero — matches the "Suggested guide" / Tailored cards
          on the Overview tab so Settling reads as part of the same surface. */}
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card">
        <div
          className="h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, #7C5A2E 0%, #D97706 60%, #F26D4C 100%)",
          }}
        />
        <div className="p-6 md:p-7 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="min-w-0">
            <span className="gm-eyebrow">Local Requirements</span>
            <h2
              className="mt-2 font-sans text-foreground"
              style={{
                fontSize: "26px",
                fontWeight: 600,
                letterSpacing: "-0.012em",
                lineHeight: 1.15,
              }}
            >
              Settling-in playbook for{" "}
              <span className="text-foreground/90">
                {city ? `${city}, ${destination}` : destination || "your destination"}
              </span>
            </h2>
            {research.summary ? (
              <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed max-w-2xl">
                {research.summary}
              </p>
            ) : (
              <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed max-w-2xl">
                {totalItems} local requirement{totalItems === 1 ? "" : "s"} across {(research.categories ?? []).length} categor{(research.categories ?? []).length === 1 ? "y" : "ies"}, sourced from official authorities.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Updated {formatResearchDate(research.researchedAt)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResearch}
              disabled={isResearching}
              className="gap-1.5 rounded-full"
            >
              {isResearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Stale cache warning */}
      {isResearchStale(research.researchedAt) && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400 flex-1">
            This research is over 7 days old and may be outdated.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResearch}
            disabled={isResearching}
            className="border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 bg-transparent"
          >
            {isResearching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh now"}
          </Button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Category grid — 1 column on phones, 2 on lg, matching the Overview
          insights grid below the hero. Each card previews top items + lets
          the user expand for the full set. */}
      {(research.categories ?? []).length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {(research.categories ?? []).map((category, index) => (
            <CategoryCard key={index} category={category} tintIndex={index} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground rounded-xl border border-dashed border-border">
          <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No requirements found. Try refreshing the research.</p>
        </div>
      )}

      <div className="text-xs text-muted-foreground p-4 bg-muted/30 rounded-xl border border-border/50">
        <p className="font-semibold mb-1 text-foreground/80">Important</p>
        <p className="leading-relaxed">
          {research.disclaimer ||
            "Requirements may vary based on your visa type and personal circumstances. Always verify with official sources."}
        </p>
      </div>
    </div>
  )
}
