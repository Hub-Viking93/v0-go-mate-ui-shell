

import { useState, useCallback } from "react"
import { FileCheck, Loader2, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DocumentStatusEntry } from "@/lib/gomate/types/document-status"

interface VisaDocItem {
  id: string
  document: string
  priority: string
  required: boolean
  category?: string
}

interface VisaDocumentChecklistProps {
  items: VisaDocItem[]
  statuses: Record<string, DocumentStatusEntry>
  onStatusToggle?: (documentId: string, newStatus: "ready" | "not_started") => Promise<void>
}

const STATUS_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Started", color: "text-muted-foreground", bg: "bg-muted" },
  gathering: { label: "Gathering", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40" },
  ready: { label: "Ready", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  submitted: { label: "Submitted", color: "text-primary", bg: "bg-primary/10" },
}

export function VisaDocumentChecklist({ items, statuses, onStatusToggle }: VisaDocumentChecklistProps) {
  const [loading, setLoading] = useState<Set<string>>(new Set())

  const handleToggle = useCallback(async (id: string) => {
    if (!onStatusToggle) return
    const current = statuses[id]?.status || "not_started"
    const next = current === "ready" || current === "submitted" ? "not_started" : "ready"
    setLoading((prev) => new Set(prev).add(id))
    try {
      await onStatusToggle(id, next)
    } finally {
      setLoading((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    }
  }, [onStatusToggle, statuses])

  if (items.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
        <FileCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No visa-specific documents found in your checklist.</p>
        <p className="text-xs text-muted-foreground mt-1">Run document research to get a personalized list.</p>
      </div>
    )
  }

  const readyCount = items.filter((i) => {
    const s = statuses[i.id]?.status
    return s === "ready" || s === "submitted"
  }).length

  const requiredCount = items.filter((i) => i.required).length
  const requiredReadyCount = items.filter((i) => {
    if (!i.required) return false
    const s = statuses[i.id]?.status
    return s === "ready" || s === "submitted"
  }).length

  const progressPct = items.length > 0 ? Math.round((readyCount / items.length) * 100) : 0

  // Group required first, then optional — required-but-not-ready is the
  // critical-path subset the user actually needs to chase.
  const required = items.filter((i) => i.required)
  const optional = items.filter((i) => !i.required)

  const renderRow = (item: VisaDocItem) => {
    const entry = statuses[item.id] || { status: "not_started" }
    const status = entry.status || "not_started"
    const isDone = status === "ready" || status === "submitted"
    const isLoading = loading.has(item.id)
    const cfg = STATUS_COLORS[status] || STATUS_COLORS.not_started

    return (
      <button
        key={item.id}
        onClick={() => handleToggle(item.id)}
        disabled={isLoading || !onStatusToggle}
        className={cn(
          "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all text-left group",
          isDone
            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
            : "bg-card border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-sm"
        )}
      >
        <div className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          isDone
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "border-stone-300 dark:border-stone-600 group-hover:border-emerald-500/60"
        )}>
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isDone ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </div>
        <span className={cn(
          "flex-1 text-sm",
          isDone ? "text-muted-foreground line-through" : "text-foreground"
        )}>
          {item.document}
        </span>
        <Badge variant="outline" className={cn("text-[10px] px-2 py-0 h-5 border-0 font-semibold uppercase tracking-wide", cfg.bg, cfg.color)}>
          {cfg.label}
        </Badge>
        {item.required && !isDone && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-3 h-3" /> Req
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
      <div className="p-5 md:p-6 space-y-4">
        {/* Editorial header */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <FileCheck className="w-5 h-5 mt-1 shrink-0 text-amber-600/80 dark:text-amber-500/80" />
            <div className="min-w-0">
              <p className="gm-eyebrow text-amber-700 dark:text-amber-400">Document checklist</p>
              <h2 className="font-sans text-lg md:text-xl leading-tight tracking-tight text-foreground">
                Visa Documents
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {requiredReadyCount}/{requiredCount} required ready · {readyCount}/{items.length} total
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-sans font-bold tabular-nums text-foreground leading-none">
              {progressPct}%
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mt-1">
              Complete
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {required.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-600 dark:text-stone-400">
              Required ({required.length})
            </p>
            <div className="space-y-1.5">{required.map(renderRow)}</div>
          </div>
        )}

        {optional.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-600 dark:text-stone-400">
              Optional ({optional.length})
            </p>
            <div className="space-y-1.5">{optional.map(renderRow)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
