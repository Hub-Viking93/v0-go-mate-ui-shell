"use client"

import { useState } from "react"
import {
  CheckCircle2,
  Circle,
  Lock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  DollarSign,
  AlertTriangle,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface SettlingInTask {
  id: string
  title: string
  description: string
  category: string
  depends_on: string[]
  deadline_days: number | null
  is_legal_requirement: boolean
  why_it_matters: string | null
  steps: string[]
  documents_needed: string[]
  official_link: string | null
  estimated_time: string | null
  cost: string | null
  deadline_at: string | null
  days_until_deadline: number | null
  urgency: "overdue" | "urgent" | "approaching" | "normal"
  compliance_scope?: "required" | "recommended"
  compliance_status?: "none" | "completed" | "overdue" | "urgent" | "upcoming"
  block_reason?: string
  blocked_by?: Array<{ id: string; title: string }>
  status: "locked" | "available" | "in_progress" | "completed" | "skipped" | "overdue"
  completed_at: string | null
  sort_order: number
}

interface SettlingInTaskCardProps {
  task: SettlingInTask
  arrivalDate: string | null
  onStatusChange: (taskId: string, status: string) => Promise<void>
  allTasks: SettlingInTask[]
}

export function SettlingInTaskCard({
  task,
  arrivalDate,
  onStatusChange,
  allTasks,
}: SettlingInTaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [whyText, setWhyText] = useState<string | null>(task.why_it_matters)
  const [whyLoading, setWhyLoading] = useState(false)

  const isLocked = task.status === "locked"
  const isCompleted = task.status === "completed"
  const isSkipped = task.status === "skipped"
  const isOverdueStatus = task.status === "overdue"
  const isActionable = task.status === "available" || task.status === "in_progress" || isOverdueStatus

  // Use server-computed urgency
  const isOverdue = task.urgency === "overdue" || isOverdueStatus
  const isUrgent = task.urgency === "urgent"
  const isApproaching = task.urgency === "approaching"
  const deadlineDate = task.deadline_at ? new Date(task.deadline_at) : null

  // Get dependency names
  const depNames = task.depends_on
    .map((depId) => allTasks.find((t) => t.id === depId)?.title)
    .filter(Boolean)

  async function handleToggle() {
    if (isLocked || loading) return
    setLoading(true)
    try {
      const newStatus = isCompleted ? "available" : "completed"
      await onStatusChange(task.id, newStatus)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={cn(
        "relative p-4 flex items-start gap-4 transition-all duration-200 border-b border-border last:border-b-0",
        isCompleted && "bg-muted/10",
        isOverdue && "bg-destructive/5",
        isLocked && "opacity-60"
      )}
    >
      {/* Status indicator */}
      <button
        onClick={handleToggle}
        disabled={isLocked || loading}
        className={cn(
          "relative z-10 mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
          isCompleted
            ? "bg-primary border-primary text-primary-foreground gm-success-glow"
            : isLocked
              ? "border-muted-foreground/20 bg-muted cursor-not-allowed"
              : "border-muted-foreground/30 hover:border-primary/50 bg-background",
          loading && "opacity-50"
        )}
        aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isCompleted ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : isLocked ? (
          <Lock className="w-3 h-3" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <button
              onClick={() => !isLocked && setExpanded(!expanded)}
              disabled={isLocked}
              className="text-left w-full"
            >
              <h4
                className={cn(
                  "text-sm font-medium leading-snug",
                  isCompleted && "line-through text-muted-foreground",
                  isLocked && "text-muted-foreground"
                )}
              >
                {task.title}
              </h4>
            </button>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {task.is_legal_requirement && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Legal
                </Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Overdue
                </Badge>
              )}
              {isUrgent && !isOverdue && (
                <Badge className="text-[10px] px-1.5 py-0 bg-red-500 text-white">
                  Due tomorrow
                </Badge>
              )}
              {isApproaching && !isOverdue && !isUrgent && (
                <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 text-white">
                  {task.days_until_deadline != null ? `${task.days_until_deadline}d left` : "Due soon"}
                </Badge>
              )}
              {deadlineDate && !isCompleted && !isOverdue && !isUrgent && !isApproaching && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  by {deadlineDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              )}
              {isLocked && task.blocked_by && task.blocked_by.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Blocked by: {task.blocked_by.map((b) => b.title).join(", ")}
                </span>
              )}
              {isLocked && (!task.blocked_by || task.blocked_by.length === 0) && depNames.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Needs: {depNames.join(", ")}
                </span>
              )}
            </div>
          </div>
          {!isLocked && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Expanded details */}
        {expanded && !isLocked && (
          <div className="mt-3 space-y-3 text-sm">
            {task.description && (
              <p className="text-muted-foreground leading-relaxed">
                {task.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap gap-3">
              {task.estimated_time && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {task.estimated_time}
                </span>
              )}
              {task.cost && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="w-3.5 h-3.5" />
                  {task.cost}
                </span>
              )}
              {task.official_link && (
                <a
                  href={task.official_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Official link
                </a>
              )}
            </div>

            {/* Steps */}
            {task.steps && task.steps.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Steps:</p>
                <ol className="space-y-1 ml-4 list-decimal text-xs text-muted-foreground">
                  {task.steps.map((step, i) => (
                    <li key={i} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Documents needed */}
            {task.documents_needed && task.documents_needed.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Documents needed:</p>
                <ul className="space-y-0.5 ml-4 list-disc text-xs text-muted-foreground">
                  {task.documents_needed.map((doc, i) => (
                    <li key={i}>{doc}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Why it matters - lazy loaded AI enrichment */}
            {whyText ? (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                <p className="text-xs font-medium text-primary mb-1">Why it matters</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {whyText}
                </p>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-primary h-7 px-2"
                disabled={whyLoading}
                onClick={async (e) => {
                  e.stopPropagation()
                  setWhyLoading(true)
                  try {
                    const res = await fetch(`/api/settling-in/${task.id}/why-it-matters`, {
                      method: "POST",
                    })
                    if (res.ok) {
                      const data = await res.json()
                      setWhyText(data.whyItMatters)
                    }
                  } finally {
                    setWhyLoading(false)
                  }
                }}
              >
                {whyLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="w-3 h-3 mr-1" />
                )}
                Why does this matter?
              </Button>
            )}

            {/* Action buttons */}
            {isActionable && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleToggle} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  )}
                  Mark complete
                </Button>
                {task.status === "available" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setLoading(true)
                      try {
                        await onStatusChange(task.id, "skipped")
                      } finally {
                        setLoading(false)
                      }
                    }}
                    disabled={loading}
                  >
                    Skip
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
