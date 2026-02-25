"use client"

import { useState, useCallback } from "react"
import {
  FileCheck,
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  ExternalLink,
  Clock,
  DollarSign,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

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

export interface DocumentStatus {
  completed: boolean
  completedAt?: string
}

interface InteractiveDocumentChecklistProps {
  items: DocumentItem[]
  statuses: Record<string, DocumentStatus>
  onStatusChange?: (documentId: string, completed: boolean) => Promise<void>
  title?: string
  collapsible?: boolean
  defaultExpanded?: boolean
}

const priorityConfig = {
  critical: {
    label: "Critical",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
    icon: AlertCircle,
  },
  high: {
    label: "High",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    icon: AlertCircle,
  },
  medium: {
    label: "Medium",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    icon: Circle,
  },
  low: {
    label: "Low",
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    borderColor: "border-border",
    icon: Circle,
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

  // Calculate progress
  const completedCount = items.filter((item) => statuses[item.id]?.completed).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

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

  // Sort categories by priority (critical items first)
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const aPriority = groupedItems[a].some((i) => i.priority === "critical") ? 0 : 1
    const bPriority = groupedItems[b].some((i) => i.priority === "critical") ? 0 : 1
    return aPriority - bPriority
  })

  const handleToggle = useCallback(
    async (documentId: string, currentStatus: boolean) => {
      if (!onStatusChange) return

      setLoadingItems((prev) => new Set(prev).add(documentId))
      try {
        await onStatusChange(documentId, !currentStatus)
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
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
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
              {completedCount} of {totalCount} documents ready
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress Circle */}
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                className="text-muted/30"
              />
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
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

      {/* Progress Bar */}
      <div className="px-6">
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Checklist Content */}
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
            const categoryCompleted = categoryItems.filter((i) => statuses[i.id]?.completed).length
            const isExpanded = expandedCategories.has(category)
            const hasCritical = categoryItems.some((i) => i.priority === "critical" && !statuses[i.id]?.completed)

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
                      {categoryCompleted}/{categoryItems.length}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="relative">
                    {/* Vertical connector line */}
                    <div className="absolute left-[35px] top-0 bottom-0 w-0.5 bg-border" />
                    {categoryItems.map((item, itemIdx) => {
                      const isCompleted = statuses[item.id]?.completed || false
                      const isLoading = loadingItems.has(item.id)
                      const config = priorityConfig[item.priority]
                      const isLast = itemIdx === categoryItems.length - 1

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "relative p-4 flex items-start gap-4 transition-all duration-200 border-b border-border",
                            isCompleted && "bg-muted/10",
                            isLast && "border-b-0"
                          )}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggle(item.id, isCompleted)}
                            disabled={isLoading || !onStatusChange}
                            className={cn(
                              "relative z-10 mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                              isCompleted
                                ? "bg-primary border-primary text-primary-foreground gm-success-glow"
                                : "border-muted-foreground/30 hover:border-primary/50 bg-background",
                              isLoading && "opacity-50"
                            )}
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isCompleted ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : null}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p
                                  className={cn(
                                    "font-medium",
                                    isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                                  )}
                                >
                                  {item.document}
                                </p>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.required && (
                                  <span className="text-xs text-muted-foreground">Required</span>
                                )}
                                <span
                                  className={cn(
                                    "px-2 py-0.5 text-xs font-medium rounded-full",
                                    config.bgColor,
                                    config.color
                                  )}
                                >
                                  {config.label}
                                </span>
                              </div>
                            </div>

                            {/* Additional Info (whereToGet, estimatedTime, cost) */}
                            {!isCompleted && (item.whereToGet || item.estimatedTime || item.cost) && (
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                {item.whereToGet && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {item.whereToGet}
                                  </span>
                                )}
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
                            )}

                            {/* Official Link */}
                            {item.officialLink && !isCompleted && (
                              <a
                                href={item.officialLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3 h-3" />
                                Official source
                              </a>
                            )}

                            {/* Tips */}
                            {item.tips && item.tips.length > 0 && !isCompleted && (
                              <div className="mt-2 p-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                                <span className="font-medium">Tip: </span>
                                {item.tips[0]}
                              </div>
                            )}

                            {/* Completion date */}
                            {isCompleted && statuses[item.id]?.completedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Completed {new Date(statuses[item.id].completedAt!).toLocaleDateString()}
                              </p>
                            )}
                          </div>
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
              <p className="text-2xl font-semibold text-foreground font-mono">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-2xl font-semibold text-foreground font-mono">{totalCount - completedCount}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-2xl font-semibold text-foreground font-mono">
                {items.filter((i) => i.priority === "critical" && !statuses[i.id]?.completed).length}
              </p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
