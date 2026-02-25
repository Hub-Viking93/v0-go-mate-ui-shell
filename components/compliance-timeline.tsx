"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle2, Clock, Shield } from "lucide-react"

interface ComplianceTask {
  id: string
  title: string
  category: string
  deadline_days: number | null
  is_legal_requirement: boolean
  status: string
  completed_at: string | null
}

interface ComplianceTimelineProps {
  tasks: ComplianceTask[]
  arrivalDate: string // ISO date string
  className?: string
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

type TimelineStatus = "overdue" | "urgent" | "upcoming" | "completed"

function getDeadlineStatus(
  deadlineDate: Date,
  today: Date,
  completed: boolean
): TimelineStatus {
  if (completed) return "completed"
  const daysLeft = daysBetween(today, deadlineDate)
  if (daysLeft < 0) return "overdue"
  if (daysLeft <= 7) return "urgent"
  return "upcoming"
}

const statusConfig: Record<TimelineStatus, {
  color: string
  bgColor: string
  borderColor: string
  icon: typeof AlertTriangle
  label: string
}> = {
  overdue: {
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    icon: AlertTriangle,
    label: "Overdue",
  },
  urgent: {
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    borderColor: "border-amber-500/30",
    icon: Clock,
    label: "Due soon",
  },
  upcoming: {
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
    icon: Clock,
    label: "Upcoming",
  },
  completed: {
    color: "text-primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/20",
    icon: CheckCircle2,
    label: "Done",
  },
}

export function ComplianceTimeline({ tasks, arrivalDate, className }: ComplianceTimelineProps) {
  const arrival = new Date(arrivalDate)
  const today = new Date()

  const complianceTasks = useMemo(() => {
    return tasks
      .filter(t => t.is_legal_requirement && t.deadline_days != null)
      .map(t => {
        const deadlineDate = addDays(arrival, t.deadline_days!)
        const isCompleted = t.status === "completed"
        const status = getDeadlineStatus(deadlineDate, today, isCompleted)
        const daysLeft = daysBetween(today, deadlineDate)
        return {
          ...t,
          deadlineDate,
          status,
          daysLeft,
        }
      })
      .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime())
  }, [tasks, arrivalDate])

  if (complianceTasks.length === 0) return null

  const overdueCount = complianceTasks.filter(t => t.status === "overdue").length
  const urgentCount = complianceTasks.filter(t => t.status === "urgent").length
  const completedCount = complianceTasks.filter(t => t.status === "completed").length

  return (
    <div className={cn("gm-card-static p-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Legal Compliance Timeline
          </h3>
          <p className="text-xs text-muted-foreground">
            {completedCount}/{complianceTasks.length} requirements met
            {overdueCount > 0 && (
              <span className="text-destructive font-medium ml-1">
                ({overdueCount} overdue)
              </span>
            )}
            {urgentCount > 0 && overdueCount === 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">
                ({urgentCount} due soon)
              </span>
            )}
          </p>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          Day {daysBetween(arrival, today)}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-border" />

        <div className="flex flex-col gap-3">
          {complianceTasks.map((task) => {
            const config = statusConfig[task.status]
            const Icon = config.icon
            const formattedDate = task.deadlineDate.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })

            return (
              <div key={task.id} className="relative flex items-start gap-3 pl-1">
                {/* Node */}
                <div
                  className={cn(
                    "relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 border",
                    config.bgColor,
                    config.borderColor,
                    task.status === "overdue" && "animate-pulse"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", config.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        task.status === "completed"
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      )}
                    >
                      {task.title}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        config.bgColor,
                        config.color
                      )}
                    >
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      {formattedDate}
                    </span>
                    {task.status !== "completed" && (
                      <span
                        className={cn(
                          "text-xs",
                          task.daysLeft < 0
                            ? "text-destructive font-medium"
                            : task.daysLeft <= 7
                              ? "text-amber-600 dark:text-amber-400 font-medium"
                              : "text-muted-foreground"
                        )}
                      >
                        {task.daysLeft < 0
                          ? `${Math.abs(task.daysLeft)} days overdue`
                          : task.daysLeft === 0
                            ? "Due today"
                            : `${task.daysLeft} days left`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
