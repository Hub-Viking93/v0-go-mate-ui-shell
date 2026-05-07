

import React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  Calendar,
  FileText,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface VisaOption {
  // sourceUrls — every URL the specialist scraped for this option.
  // Renders as a TrustBadge dropdown in /visa so the user can verify
  // against multiple authorities, not just officialLink.
  sourceUrls?: string[]

  name: string
  type: string
  eligibility: "high" | "medium" | "low" | "unknown"
  eligibilityReason: string
  requirements: string[]
  processingTime: string
  cost: string
  validity: string
  benefits: string[]
  limitations: string[]
  officialLink?: string
  applicationSteps?: string[]
}

export interface VisaResearchData {
  destination: string
  citizenship: string
  purpose: string
  researchedAt: string
  visaOptions: VisaOption[]
  summary: string
  disclaimer: string
}

interface VisaResearchCardProps {
  planId?: string
  destination?: string
  citizenship?: string
  purpose?: string
  cachedResearch?: VisaResearchData | null
  researchStatus?: string | null
  onResearchComplete?: (data: VisaResearchData) => void
}

function EligibilityBadge({ eligibility }: { eligibility: VisaOption["eligibility"] }) {
  const config: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    high: {
      color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30",
      label: "Good fit",
      icon: <CheckCircle className="w-3 h-3" />,
    },
    medium: {
      color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
      label: "Possible",
      icon: <AlertCircle className="w-3 h-3" />,
    },
    low: {
      color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
      label: "Challenging",
      icon: <AlertCircle className="w-3 h-3" />,
    },
    unknown: {
      color: "bg-muted text-muted-foreground border-border",
      label: "Check eligibility",
      icon: <AlertCircle className="w-3 h-3" />,
    },
  }
  const c = config[eligibility] || config.unknown

  return (
    <Badge variant="outline" className={cn("text-xs gap-1", c.color)}>
      {c.icon}
      {c.label}
    </Badge>
  )
}

function VisaOptionCard({
  option,
  index,
}: {
  option: VisaOption
  index: number
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-xl p-4 transition-all border-border bg-card/50 hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs text-muted-foreground">Option {index + 1}</span>
            <EligibilityBadge eligibility={option.eligibility} />
            <Badge variant="outline" className="text-xs capitalize">{option.type}</Badge>
          </div>
          <h4 className="font-medium text-foreground">{option.name}</h4>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {option.eligibilityReason}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
        {option.processingTime && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {option.processingTime}
          </span>
        )}
        {option.cost && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {option.cost}
          </span>
        )}
        {option.validity && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {option.validity}
          </span>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-primary mt-3 hover:text-primary/80"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Less details" : "More details"}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-4">
          {option.requirements && option.requirements.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Requirements
              </p>
              <ul className="space-y-1">
                {option.requirements.map((req, i) => (
                  <li
                    key={i}
                    className="text-xs text-muted-foreground flex items-start gap-2"
                  >
                    <CheckCircle className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {option.benefits && option.benefits.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle className="w-3 h-3" />
                Benefits
              </p>
              <ul className="space-y-1">
                {option.benefits.map((benefit, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    + {benefit}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {option.limitations && option.limitations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="w-3 h-3" />
                Limitations
              </p>
              <ul className="space-y-1">
                {option.limitations.map((limitation, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    - {limitation}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {option.applicationSteps && option.applicationSteps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2">How to apply:</p>
              <ol className="space-y-1 list-decimal list-inside">
                {option.applicationSteps.map((step, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {option.officialLink && (
            <a
              href={option.officialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 bg-primary/10 px-2 py-1 rounded"
            >
              <ExternalLink className="w-3 h-3" />
              Official visa page
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export function VisaResearchCard({
  planId,
  destination,
  citizenship,
  purpose,
  cachedResearch,
  researchStatus,
  onResearchComplete,
}: VisaResearchCardProps) {
  const [isResearching, setIsResearching] = useState(false)
  const [research, setResearch] = useState<VisaResearchData | null>(
    cachedResearch
      ? { ...cachedResearch, visaOptions: cachedResearch.visaOptions || [] }
      : null
  )
  const [error, setError] = useState<string | null>(null)

  const handleResearch = async () => {
    if (!planId) {
      setError("No relocation plan found. Please complete your profile first.")
      return
    }

    setIsResearching(true)
    setError(null)

    try {
      const response = await fetch("/api/research/visa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to research visa options")
      }

      const data = await response.json()
      setResearch(data.research)
      onResearchComplete?.(data.research)
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

  // Show research prompt if no cached research — editorial empty state,
  // no centered placeholder icon-circle.
  if (!research) {
    return (
      <div className="gm-editorial-card overflow-hidden">
        {/* Top accent stripe */}
        <div
          className="h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, #0F172A 0%, #334155 50%, #0D9488 100%)",
          }}
        />
        <div className="p-7 md:p-8">
          <span className="gm-eyebrow">Visa Research</span>
          <h3
            className="mt-3 font-sans text-foreground"
            style={{
              fontSize: "26px",
              fontWeight: 600,
              letterSpacing: "-0.012em",
              lineHeight: 1.15,
            }}
          >
            Find the right visa route
          </h3>
          <p className="mt-3 text-[15px] text-foreground/65 leading-[1.55] max-w-xl">
            We&apos;ll search official immigration sources for routes that fit
            a{" "}
            <span className="text-foreground font-medium">
              {citizenship || "your"}
            </span>{" "}
            citizen moving to{" "}
            <span className="text-foreground font-medium">
              {destination || "your destination"}
            </span>
            {purpose ? (
              <>
                {" "}
                for <span className="text-foreground font-medium">{purpose}</span>
              </>
            ) : null}
            . Eligibility, cost, processing time, and requirements — all in one
            place.
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
              className="gap-2 rounded-xl border-0 text-white font-semibold shadow-[0_4px_16px_rgba(27,58,45,0.25)]"
              style={{
                background:
                  "linear-gradient(180deg, #1E293B 0%, #0F172A 100%)",
              }}
            >
              {isResearching || researchStatus === "in_progress" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Researching…
                </>
              ) : (
                <>
                  Run visa research
                </>
              )}
            </Button>
            <span className="text-xs text-foreground/50">
              Takes ~30–60 seconds · uses official government sources
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
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">AI Visa Research</h2>
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

      <div className="space-y-3">
        {(research.visaOptions || []).map((option, index) => (
          <VisaOptionCard key={index} option={option} index={index} />
        ))}
      </div>

      {(!research.visaOptions || research.visaOptions.length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No visa options found. Try refreshing the research.</p>
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/30 rounded-lg border border-border/50">
        <p className="font-medium mb-1">Important</p>
        <p>
          {research.disclaimer || "Visa requirements change frequently. Always verify information on official government websites before applying."}
        </p>
      </div>
    </div>
  )
}
