"use client"

import { useState, useCallback } from "react"
import {
  FileCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  ExternalLink,
  Clock,
  DollarSign,
  MapPin,
  Link as LinkIcon,
  StickyNote,
  CalendarClock,
  AlertTriangle,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DocumentStatus, DocumentStatusEntry } from "@/lib/gomate/types/document-status"

export type { DocumentStatus, DocumentStatusEntry }

export interface DocumentItem {
  id: string
  document: string
  description?: string
  priority: "critical" | "high" | "medium" | "low"
  required: boolean
  category?: string
  tips?: string[]
  whereToGet?: string
  officialLink?: string
  estimatedTime?: string
  cost?: string
  visaSpecific?: boolean
}

interface InteractiveDocumentChecklistProps {
  items: DocumentItem[]
  statuses: Record<string, DocumentStatusEntry>
  onStatusChange?: (documentId: string, update: Partial<DocumentStatusEntry>) => Promise<void>
  title?: string
  collapsible?: boolean
  defaultExpanded?: boolean
}

const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Started", color: "text-muted-foreground", bg: "bg-muted" },
  gathering: { label: "Gathering", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40" },
  ready: { label: "Ready", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  submitted: { label: "Submitted", color: "text-primary", bg: "bg-primary/10" },
  expiring: { label: "Expiring", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40" },
  expired: { label: "Expired", color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40" },
}

const STATUS_ORDER: DocumentStatus[] = ["not_started", "gathering", "ready", "submitted", "expiring", "expired"]

const priorityConfig = {
  critical: {
    label: "Critical",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
  },
  high: {
    label: "High",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  medium: {
    label: "Medium",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  low: {
    label: "Low",
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    borderColor: "border-border",
  },
}

const categoryLabels: Record<string, string> = {
  identity: "Identity Documents",
  visa: "Visa & Immigration",
  financial: "Financial Documents",
  medical: "Medical Records",
  education: "Education & Employment",
  housing: "Housing",
  travel: "Travel",
  other: "Other Documents",
}

function getExpiryState(expiryDate?: string): "expired" | "expiring_soon" | null {
  if (!expiryDate) return null
  const expiry = new Date(expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (expiry < today) return "expired"
  const soonThreshold = new Date(today)
  soonThreshold.setDate(soonThreshold.getDate() + 30)
  if (expiry <= soonThreshold) return "expiring_soon"
  return null
}

export function InteractiveDocumentChecklist({
  items,
  statuses,
  onStatusChange,
  title = "Document Checklist",
  collapsible = true,
  defaultExpanded = true,
}: InteractiveDocumentChecklistProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["critical", "high"]))
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set())

  // Calculate progress — "ready" or "submitted" count as done
  const readyCount = items.filter((item) => {
    const s = statuses[item.id]?.status
    return s === "ready" || s === "submitted"
  }).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0

  // Group items by category
  const groupedItems = items.reduce(
    (acc, item) => {
      const category = item.category || "other"
      if (!acc[category]) acc[category] = []
      acc[category].push(item)
      return acc
    },
    {} as Record<string, DocumentItem[]>
  )

  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const aPriority = groupedItems[a].some((i) => i.priority === "critical") ? 0 : 1
    const bPriority = groupedItems[b].some((i) => i.priority === "critical") ? 0 : 1
    return aPriority - bPriority
  })

  const handleStatusSelect = useCallback(
    async (documentId: string, newStatus: DocumentStatus) => {
      if (!onStatusChange) return
      setLoadingItems((prev) => new Set(prev).add(documentId))
      try {
        await onStatusChange(documentId, { status: newStatus })
      } finally {
        setLoadingItems((prev) => {
          const next = new Set(prev)
          next.delete(documentId)
          return next
        })
      }
    },
    [onStatusChange]
  )

  const handleDetailSave = useCallback(
    async (documentId: string, fields: Partial<DocumentStatusEntry>) => {
      if (!onStatusChange) return
      setLoadingItems((prev) => new Set(prev).add(documentId))
      try {
        await onStatusChange(documentId, fields)
      } finally {
        setLoadingItems((prev) => {
          const next = new Set(prev)
          next.delete(documentId)
          return next
        })
      }
    },
    [onStatusChange]
  )

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const toggleDetail = (id: string) => {
    setExpandedDetails((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getProgressColor = () => {
    if (progress === 100) return "text-emerald-600 dark:text-emerald-400"
    if (progress >= 75) return "text-primary"
    if (progress >= 50) return "text-amber-600 dark:text-amber-400"
    return "text-muted-foreground"
  }

  return (
    <div className="gm-card-static overflow-hidden">
      {/* Header */}
      <button
        onClick={() => collapsible && setExpanded(!expanded)}
        className={cn(
          "w-full p-6 flex items-center justify-between",
          collapsible && "cursor-pointer hover:bg-muted/30 transition-colors"
        )}
        disabled={!collapsible}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <FileCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">
              {readyCount} of {totalCount} documents ready
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="3" fill="none" className="text-muted/30" />
              <circle
                cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={2 * Math.PI * 18 * (1 - progress / 100)}
                className={cn("transition-all duration-500", getProgressColor())}
              />
            </svg>
            <span className={cn("absolute inset-0 flex items-center justify-center text-xs font-bold font-mono", getProgressColor())}>
              {progress}%
            </span>
          </div>
          {collapsible && (
            <div className="text-muted-foreground">
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          )}
        </div>
      </button>

      <div className="px-6">
        <Progress value={progress} className="h-1.5" />
      </div>

      {expanded && (
        <div className="p-6 pt-4 space-y-4">
          {progress === 100 && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-medium text-emerald-700 dark:text-emerald-300">All documents ready!</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  You&apos;re fully prepared for your relocation.
                </p>
              </div>
            </div>
          )}

          {sortedCategories.map((category) => {
            const categoryItems = groupedItems[category]
            const categoryReady = categoryItems.filter((i) => {
              const s = statuses[i.id]?.status
              return s === "ready" || s === "submitted"
            }).length
            const isExpanded = expandedCategories.has(category)
            const hasCritical = categoryItems.some((i) => i.priority === "critical" && statuses[i.id]?.status !== "ready" && statuses[i.id]?.status !== "submitted")

            return (
              <div key={category} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full p-4 flex items-center justify-between bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">
                      {categoryLabels[category] || category}
                    </span>
                    {hasCritical && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        Action needed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {categoryReady}/{categoryItems.length}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="relative">
                    <div className="absolute left-[35px] top-0 bottom-0 w-0.5 bg-border" />
                    {categoryItems.map((item, itemIdx) => {
                      const entry = statuses[item.id] || { status: "not_started" as DocumentStatus }
                      const currentStatus = entry.status || "not_started"
                      const isLoading = loadingItems.has(item.id)
                      const config = priorityConfig[item.priority]
                      const isLast = itemIdx === categoryItems.length - 1
                      const isDone = currentStatus === "ready" || currentStatus === "submitted"
                      const statusCfg = STATUS_CONFIG[currentStatus]
                      const expiryState = getExpiryState(entry.expiryDate)
                      const isDetailOpen = expandedDetails.has(item.id)

                      return (
                        <div key={item.id} className={cn("relative border-b border-border", isLast && "border-b-0")}>
                          <div className={cn("p-4 flex items-start gap-4 transition-all duration-200", isDone && "bg-muted/10")}>
                            {/* Status badge (clickable to cycle) */}
                            <div className="relative z-10 mt-0.5 shrink-0">
                              {isLoading ? (
                                <div className="w-6 h-6 flex items-center justify-center">
                                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </div>
                              ) : (
                                <StatusDropdown
                                  current={currentStatus}
                                  onSelect={(s) => handleStatusSelect(item.id, s)}
                                  disabled={!onStatusChange}
                                />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={cn("font-medium", isDone ? "text-muted-foreground line-through" : "text-foreground")}>
                                      {item.document}
                                    </p>
                                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 border-0", statusCfg.bg, statusCfg.color)}>
                                      {statusCfg.label}
                                    </Badge>
                                    {expiryState === "expired" && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-1">
                                        <XCircle className="w-3 h-3" /> Expired
                                      </Badge>
                                    )}
                                    {expiryState === "expiring_soon" && (
                                      <Badge className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-amber-500 hover:bg-amber-600 text-white">
                                        <AlertTriangle className="w-3 h-3" /> Expiring soon
                                      </Badge>
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {item.required && <span className="text-xs text-muted-foreground">Required</span>}
                                  <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", config.bgColor, config.color)}>
                                    {config.label}
                                  </span>
                                </div>
                              </div>

                              {/* Metadata row */}
                              {!isDone && (item.whereToGet || item.estimatedTime || item.cost) && (
                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  {item.whereToGet && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.whereToGet}</span>}
                                  {item.estimatedTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.estimatedTime}</span>}
                                  {item.cost && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{item.cost}</span>}
                                </div>
                              )}

                              {/* Inline indicators for saved details */}
                              {(entry.externalLink || entry.notes) && !isDetailOpen && (
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {entry.externalLink && (
                                    <a href={entry.externalLink} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-primary hover:underline"
                                      onClick={(e) => e.stopPropagation()}>
                                      <LinkIcon className="w-3 h-3" /> Link
                                    </a>
                                  )}
                                  {entry.notes && <span className="flex items-center gap-1"><StickyNote className="w-3 h-3" /> Has notes</span>}
                                </div>
                              )}

                              {/* Official Link */}
                              {item.officialLink && !isDone && (
                                <a href={item.officialLink} target="_blank" rel="noopener noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}>
                                  <ExternalLink className="w-3 h-3" /> Official source
                                </a>
                              )}

                              {/* Tips */}
                              {item.tips && item.tips.length > 0 && !isDone && (
                                <div className="mt-2 p-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                                  <span className="font-medium">Tip: </span>{item.tips[0]}
                                </div>
                              )}

                              {/* Completion date */}
                              {isDone && entry.completedAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Completed {new Date(entry.completedAt).toLocaleDateString()}
                                </p>
                              )}

                              {/* Expand/collapse detail button */}
                              {onStatusChange && (
                                <button
                                  onClick={() => toggleDetail(item.id)}
                                  className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                >
                                  {isDetailOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  {isDetailOpen ? "Hide details" : "Add details"}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expandable detail drawer */}
                          {isDetailOpen && onStatusChange && (
                            <DocumentDetailDrawer
                              entry={entry}
                              onSave={(fields) => handleDetailSave(item.id, fields)}
                              isLoading={isLoading}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-2xl font-semibold text-foreground font-mono">{readyCount}</p>
              <p className="text-xs text-muted-foreground">Ready</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-2xl font-semibold text-foreground font-mono">{totalCount - readyCount}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-2xl font-semibold text-foreground font-mono">
                {items.filter((i) => {
                  const s = statuses[i.id]?.status
                  return i.priority === "critical" && s !== "ready" && s !== "submitted"
                }).length}
              </p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Status dropdown ──────────────────────────────────────────
function StatusDropdown({ current, onSelect, disabled }: {
  current: DocumentStatus
  onSelect: (s: DocumentStatus) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[current]

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all text-[8px] font-bold leading-none",
          current === "not_started" && "border-muted-foreground/30 bg-background hover:border-primary/50",
          current === "gathering" && "border-blue-400 bg-blue-100 dark:bg-blue-900/40 text-blue-600",
          current === "ready" && "border-emerald-500 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600",
          current === "submitted" && "border-primary bg-primary/20 text-primary",
          current === "expiring" && "border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-600",
          current === "expired" && "border-red-500 bg-red-100 dark:bg-red-900/40 text-red-600",
        )}
        title={cfg.label}
      >
        {current === "not_started" ? "" : current[0].toUpperCase()}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 w-36">
            {STATUS_ORDER.map((s) => {
              const sc = STATUS_CONFIG[s]
              return (
                <button
                  key={s}
                  onClick={() => { onSelect(s); setOpen(false) }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2",
                    s === current && "bg-muted/30 font-medium"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", sc.bg)} />
                  <span className={sc.color}>{sc.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Detail drawer (external link, notes, expiry date) ────────
function DocumentDetailDrawer({ entry, onSave, isLoading }: {
  entry: DocumentStatusEntry
  onSave: (fields: Partial<DocumentStatusEntry>) => Promise<void>
  isLoading: boolean
}) {
  const [link, setLink] = useState(entry.externalLink || "")
  const [notes, setNotes] = useState(entry.notes || "")
  const [expiryDate, setExpiryDate] = useState(entry.expiryDate?.split("T")[0] || "")
  const [linkError, setLinkError] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    // Validate link
    if (link && !link.startsWith("https://")) {
      setLinkError("Link must start with https://")
      return
    }
    setLinkError("")
    setSaving(true)
    try {
      await onSave({
        externalLink: link || undefined,
        notes: notes || undefined,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pb-4 pl-14 space-y-3 border-t border-border bg-muted/5">
      {/* External link */}
      <div>
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
          <LinkIcon className="w-3 h-3" /> External link (Google Drive, Dropbox, etc.)
        </label>
        <input
          type="url"
          value={link}
          onChange={(e) => { setLink(e.target.value); setLinkError("") }}
          placeholder="https://drive.google.com/..."
          className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {linkError && <p className="text-xs text-destructive mt-1">{linkError}</p>}
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
          <StickyNote className="w-3 h-3" /> Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this document..."
          rows={2}
          className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      {/* Expiry date */}
      <div>
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
          <CalendarClock className="w-3 h-3" /> Expiry date (user-set, e.g. bank statements valid 3 months)
        </label>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving || isLoading}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          Save details
        </Button>
      </div>
    </div>
  )
}
