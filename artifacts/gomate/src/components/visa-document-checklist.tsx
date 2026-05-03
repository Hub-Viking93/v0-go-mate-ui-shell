

import { useState, useCallback } from "react"
import { FileCheck, Loader2 } from "lucide-react"
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-primary" />
          Visa Documents
        </h3>
        <span className="text-xs text-muted-foreground">
          {readyCount} of {items.length} ready
        </span>
      </div>

      <div className="space-y-1">
        {items.map((item) => {
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
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                isDone
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
                  : "bg-card border-border hover:bg-muted/30"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30"
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
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 border-0", cfg.bg, cfg.color)}>
                {cfg.label}
              </Badge>
              {item.required && (
                <span className="text-[10px] text-muted-foreground">Required</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
