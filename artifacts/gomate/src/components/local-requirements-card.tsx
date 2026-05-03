

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

function CategorySection({
  category,
}: {
  category: RequirementCategory
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border rounded-xl overflow-hidden border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {getCategoryIcon(category.category)}
          <span className="font-medium text-foreground">{category.category || "Other"}</span>
          <Badge variant="outline" className="text-xs">
            {(category.items || []).length} item{(category.items || []).length !== 1 ? "s" : ""}
          </Badge>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {(category.items || []).map((item, index) => (
            <RequirementItemCard
              key={index}
              item={item}
              categoryName={category.category || "Other"}
            />
          ))}
        </div>
      )}
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
            className="mt-3 font-serif text-foreground"
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
  return (
    <div className="gm-card-static p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Local Requirements</h2>
          {city && (
            <Badge variant="outline" className="text-xs">
              {city}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Updated {formatResearchDate(research.researchedAt)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResearch}
            disabled={isResearching}
            className="h-8 w-8 p-0"
          >
            {isResearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Stale cache warning */}
      {isResearchStale(research.researchedAt) && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              This research is over 7 days old and may be outdated.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResearch}
            disabled={isResearching}
            className="border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 bg-transparent"
          >
            {isResearching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      )}

      {research.summary && (
        <p className="text-sm text-muted-foreground mb-4">{research.summary}</p>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {(research.categories || []).map((category, index) => (
          <CategorySection key={index} category={category} />
        ))}
      </div>

      {(!research.categories || research.categories.length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No requirements found. Try refreshing the research.</p>
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/30 rounded-lg border border-border/50">
        <p className="font-medium mb-1">Important</p>
        <p>
          {research.disclaimer ||
            "Requirements may vary based on your visa type and personal circumstances. Always verify with official sources."}
        </p>
      </div>
    </div>
  )
}
