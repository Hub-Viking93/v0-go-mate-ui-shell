"use client"

import { useState, useEffect } from "react"
import {
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

type ConsistencyWarning = {
  severity: "critical" | "warning" | "suggestion"
  code: string
  message: string
  fix: string
  relatedField: string
}

interface PlanConsistencyAlertsProps {
  planId: string | undefined
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    iconColor: "text-red-500",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    iconColor: "text-amber-500",
    label: "Warning",
  },
  suggestion: {
    icon: Lightbulb,
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    iconColor: "text-blue-500",
    label: "Suggestion",
  },
}

export function PlanConsistencyAlerts({ planId }: PlanConsistencyAlertsProps) {
  const [warnings, setWarnings] = useState<ConsistencyWarning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  useEffect(() => {
    // Load dismissed warnings from localStorage
    try {
      const stored = localStorage.getItem("gomate_dismissed_warnings")
      if (stored) setDismissed(new Set(JSON.parse(stored)))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!planId) return
    setLoading(true)
    fetch("/api/plan-checks")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch")
        return res.json()
      })
      .then((data) => {
        setWarnings(data.warnings || [])
        setError(false)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [planId])

  function dismiss(code: string) {
    const next = new Set(dismissed)
    next.add(code)
    setDismissed(next)
    try {
      localStorage.setItem("gomate_dismissed_warnings", JSON.stringify([...next]))
    } catch { /* ignore */ }
  }

  function toggleExpand(code: string) {
    const next = new Set(expanded)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setExpanded(next)
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    )
  }

  if (error) return null

  const visible = warnings.filter((w) => !dismissed.has(w.code))
  const critical = visible.filter((w) => w.severity === "critical")
  const warningLevel = visible.filter((w) => w.severity === "warning")
  const suggestions = visible.filter((w) => w.severity === "suggestion")

  if (visible.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>No issues detected with your plan</span>
      </div>
    )
  }

  function renderWarning(w: ConsistencyWarning) {
    const config = SEVERITY_CONFIG[w.severity]
    const Icon = config.icon
    const isExpanded = expanded.has(w.code)

    return (
      <div key={w.code} className={`rounded-lg border p-3 ${config.bg}`}>
        <div className="flex items-start gap-2">
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${config.text}`}>{w.message}</p>
            {isExpanded && (
              <p className={`text-xs mt-1.5 ${config.text} opacity-80`}>
                <strong>How to fix:</strong> {w.fix}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => toggleExpand(w.code)}
              className={`p-0.5 rounded hover:bg-black/5 ${config.iconColor}`}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {w.severity !== "critical" && (
              <button
                onClick={() => dismiss(w.code)}
                className={`p-0.5 rounded hover:bg-black/5 ${config.iconColor}`}
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {critical.map(renderWarning)}
      {warningLevel.map(renderWarning)}
      {suggestions.length > 0 && (
        <div>
          <button
            onClick={() => setSuggestionsOpen(!suggestionsOpen)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {suggestionsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
          </button>
          {suggestionsOpen && (
            <div className="mt-1.5 space-y-1.5">
              {suggestions.map(renderWarning)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
