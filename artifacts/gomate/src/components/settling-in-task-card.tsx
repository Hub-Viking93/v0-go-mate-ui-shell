

import { useState } from "react"
import {
  CheckCircle2,
  Circle,
  Lock,
  ChevronDown,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  TaskDetailSheet,
  type TaskDetailViewModel,
  type TaskWalkthroughView,
  type VaultDocRefView,
} from "@/components/task-detail-sheet"

export interface SettlingInTask {
  id: string
  task_key?: string | null
  title: string
  description: string
  category: string
  depends_on: string[]
  deadline_days: number | null
  is_legal_requirement: boolean
  why_it_matters: string | null
  steps: string[]
  walkthrough?: TaskWalkthroughView | null
  documents_needed: string[]
  official_link: string | null
  estimated_time: string | null
  cost: string | null
  deadline_at: string | null
  days_until_deadline: number | null
  urgency: "overdue" | "urgent" | "approaching" | "normal"
  deadline_type?: "legal" | "practical" | "recommended"
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
  /** Phase 2B — user's vault contents, surfaced inside the detail sheet. */
  vaultDocs?: VaultDocRefView[]
  /** Phase 2B — current plan id used for vault upload context. */
  planId?: string | null
  /** Phase 2B — refresh vault list after any link/upload/unlink. */
  onVaultChange?: () => void
}

export function SettlingInTaskCard({
  task,
  arrivalDate,
  onStatusChange,
  allTasks,
  vaultDocs,
  planId,
  onVaultChange,
}: SettlingInTaskCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isLocked = task.status === "locked"
  const isCompleted = task.status === "completed"
  const isOverdueStatus = task.status === "overdue"

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
              onClick={() => !isLocked && setSheetOpen(true)}
              disabled={isLocked}
              className="text-left w-full group"
            >
              <h4
                className={cn(
                  "text-sm font-medium leading-snug group-hover:text-primary transition-colors",
                  isCompleted && "line-through text-muted-foreground",
                  isLocked && "text-muted-foreground"
                )}
              >
                {task.title}
              </h4>
            </button>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {(task.deadline_type === "legal" || (task.is_legal_requirement && !task.deadline_type)) && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Legal
                </Badge>
              )}
              {task.deadline_type === "recommended" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-stone-400/50 text-stone-700 dark:text-stone-300">
                  Recommended
                </Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {task.days_until_deadline != null && task.days_until_deadline < 0
                    ? `Overdue by ${Math.abs(task.days_until_deadline)}d`
                    : "Overdue"}
                </Badge>
              )}
              {isUrgent && !isOverdue && (
                <Badge className="text-[10px] px-1.5 py-0 bg-red-500 text-white">
                  {task.days_until_deadline == null || task.days_until_deadline <= 0
                    ? "Due today"
                    : task.days_until_deadline === 1
                    ? "Due tomorrow"
                    : `Due in ${task.days_until_deadline}d`}
                </Badge>
              )}
              {isApproaching && !isOverdue && !isUrgent && (
                <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 text-white">
                  {task.days_until_deadline != null && task.days_until_deadline <= 7
                    ? "Due this week"
                    : task.days_until_deadline != null
                    ? `Due in ${task.days_until_deadline}d`
                    : "Due soon"}
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
              onClick={() => setSheetOpen(true)}
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Open task walkthrough"
            >
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          )}
        </div>

      </div>

      {/* Phase 1B detail sheet (+ Phase 2B doc section) */}
      <TaskDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        task={toViewModel(task, depNames, planId ?? null)}
        vaultDocs={vaultDocs}
        onVaultChange={onVaultChange}
        onStatusChange={async (next) => {
          await onStatusChange(task.id, next)
        }}
      />
    </div>
  )
}

function toViewModel(
  task: SettlingInTask,
  depNames: (string | undefined)[],
  planId: string | null,
): TaskDetailViewModel {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    urgency: task.urgency,
    deadlineType: task.deadline_type,
    deadlineAt: task.deadline_at,
    daysUntilDeadline: task.days_until_deadline,
    isLegalRequirement: task.is_legal_requirement,
    estimatedTime: task.estimated_time,
    cost: task.cost,
    officialLink: task.official_link,
    documentsNeeded: task.documents_needed,
    legacySteps: task.steps,
    walkthrough: task.walkthrough ?? null,
    status: task.status,
    blockedBy: depNames.filter((n): n is string => Boolean(n)),
    taskRefKey: task.task_key ? `settling-in:${task.task_key}` : undefined,
    planId,
  }
}
