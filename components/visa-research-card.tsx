"use client"

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
  const [research, setResearch] = useState<VisaResearchData | null>(cachedResearch || null)
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

  // Show research prompt if no cached research
  if (!research) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">AI Visa Research</h2>
        </div>

        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          
          <h3 className="font-medium text-foreground mb-2">
            Get personalized visa recommendations
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Our AI will research official immigration websites to find the best visa options 
            for someone from {citizenship || "your country"} moving to {destination || "your destination"} 
            {purpose ? ` for ${purpose}` : ""}.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleResearch}
            disabled={isResearching || researchStatus === "in_progress"}
            className="gap-2"
          >
            {isResearching || researchStatus === "in_progress" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Research my visa options
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground mt-4">
            This may take 30-60 seconds as we analyze official sources
          </p>
        </div>
      </div>
    )
  }

  // Show research results
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
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
        {research.visaOptions.map((option, index) => (
          <VisaOptionCard key={index} option={option} index={index} />
        ))}
      </div>

      {research.visaOptions.length === 0 && (
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
