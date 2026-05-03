

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, CheckCircle2, Circle, Clock, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseTimeRange } from "@/lib/gomate/text-parsers"

interface TimelinePhase {
  name: string
  duration: string
  tasks: string[]
  tips: string[]
}

interface PreMoveTimelineProps {
  timelineSection: {
    totalMonths: number
    overview?: string
    phases: TimelinePhase[]
  } | null
  planId: string
  targetDate: string | null
}

type ProgressMap = Record<string, boolean>

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Determine which phase is "current" based on target_date and totalMonths.
 * Divide totalMonths proportionally across phases using their duration midpoints.
 */
function computeCurrentPhase(
  phases: TimelinePhase[],
  totalMonths: number,
  targetDate: string,
): number {
  const now = new Date()
  const target = new Date(targetDate)
  const startDate = new Date(target)
  startDate.setMonth(startDate.getMonth() - totalMonths)

  const totalDays = (target.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  const elapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)

  if (elapsed < 0) return 0
  if (elapsed >= totalDays) return phases.length - 1

  // Parse durations or fall back to equal division
  const durations = phases.map((p) => {
    const parsed = parseTimeRange(p.duration)
    return parsed ? (parsed.min + parsed.max) / 2 : null
  })

  const allParsed = durations.every((d) => d != null)
  if (allParsed) {
    const totalParsedDays = durations.reduce((s, d) => s + (d ?? 0), 0)
    let accum = 0
    for (let i = 0; i < phases.length; i++) {
      const phaseDays = ((durations[i] ?? 0) / totalParsedDays) * totalDays
      accum += phaseDays
      if (elapsed < accum) return i
    }
    return phases.length - 1
  }

  // Equal division fallback
  const phaseLength = totalDays / phases.length
  return Math.min(Math.floor(elapsed / phaseLength), phases.length - 1)
}

export function PreMoveTimeline({ timelineSection, planId, targetDate }: PreMoveTimelineProps) {
  const [progress, setProgress] = useState<ProgressMap>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  // Fetch existing progress
  useEffect(() => {
    async function fetchProgress() {
      try {
        const res = await fetch(`/api/checklist-progress?plan_id=${planId}&prefix=timeline_`)
        if (res.ok) {
          const data = await res.json()
          const map: ProgressMap = {}
          for (const item of data.items || []) {
            map[item.item_id] = item.completed
          }
          setProgress(map)
        }
      } catch {
        // Proceed without progress
      } finally {
        setLoading(false)
      }
    }
    fetchProgress()
  }, [planId])

  const toggleTask = useCallback(
    async (itemId: string, completed: boolean) => {
      setProgress((prev) => ({ ...prev, [itemId]: completed }))
      try {
        await fetch("/api/progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, itemId, completed }),
        })
      } catch {
        // Revert on failure
        setProgress((prev) => ({ ...prev, [itemId]: !completed }))
      }
    },
    [planId],
  )

  if (!timelineSection || !timelineSection.phases?.length) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-muted">
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Pre-Move Timeline</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Your full week-by-week pre-departure plan — apostilles, A1 certificates, banking bridge, lease termination — lives on the dedicated Pre-departure page.
        </p>
        <a
          href="/pre-departure"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          Open Pre-departure timeline →
        </a>
      </Card>
    )
  }

  if (!targetDate) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-muted">
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Pre-Move Timeline</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Set your target move date to activate the interactive timeline.
        </p>
      </Card>
    )
  }

  const days = daysUntil(targetDate)
  const currentPhaseIndex = computeCurrentPhase(
    timelineSection.phases,
    timelineSection.totalMonths,
    targetDate,
  )

  // Auto-expand current phase
  const isExpanded = (i: number) => expanded[i] ?? i === currentPhaseIndex

  if (loading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Countdown header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold">Pre-Move Timeline</h3>
          </div>
          <Badge variant={days > 0 ? "default" : "destructive"} className="text-sm">
            <Clock className="w-3.5 h-3.5 mr-1" />
            {days > 0 ? `${days} days until your move` : "Move date has passed"}
          </Badge>
        </div>
        {days <= 0 && (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Your move date has passed. Consider activating post-arrival mode.</span>
          </div>
        )}
        {timelineSection.overview && (
          <p className="text-sm text-muted-foreground mt-2">
            Estimated total: {timelineSection.totalMonths} months
          </p>
        )}
      </Card>

      {/* Phase cards */}
      {timelineSection.phases.map((phase, phaseIndex) => {
        const phaseState =
          phaseIndex < currentPhaseIndex ? "past" :
          phaseIndex === currentPhaseIndex ? "current" : "future"

        const taskIds = phase.tasks.map((_, taskIndex) => `timeline_${phaseIndex}_${taskIndex}`)
        const completedCount = taskIds.filter((id) => progress[id]).length
        const totalTasks = phase.tasks.length
        const open = isExpanded(phaseIndex)

        return (
          <Card
            key={phaseIndex}
            className={cn(
              "overflow-hidden transition-colors",
              phaseState === "current" && "border-primary/50 shadow-sm",
              phaseState === "past" && "opacity-75",
            )}
          >
            {/* Phase header */}
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [phaseIndex]: !open }))}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-3 h-3 rounded-full",
                    phaseState === "current" && "bg-primary",
                    phaseState === "past" && "bg-muted-foreground/40",
                    phaseState === "future" && "bg-muted-foreground/20 border border-muted-foreground/30",
                  )}
                />
                <div>
                  <h4 className="font-medium text-sm">{phase.name}</h4>
                  <p className="text-xs text-muted-foreground">{phase.duration}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {completedCount} of {totalTasks} done
                </span>
                {phaseState === "current" && (
                  <Badge variant="default" className="text-[10px]">Current</Badge>
                )}
                {open ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Tasks */}
            {open && (
              <div className="px-4 pb-4 space-y-2">
                {phase.tasks.map((task, taskIndex) => {
                  const itemId = `timeline_${phaseIndex}_${taskIndex}`
                  const checked = !!progress[itemId]

                  return (
                    <label
                      key={taskIndex}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          toggleTask(itemId, !checked)
                        }}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {checked ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground/40" />
                        )}
                      </button>
                      <span
                        className={cn(
                          "text-sm",
                          checked && "line-through text-muted-foreground",
                        )}
                      >
                        {task}
                      </span>
                    </label>
                  )
                })}

                {/* Tips */}
                {phase.tips?.[0] && (
                  <p className="text-sm text-primary italic pl-8 mt-2">{phase.tips[0]}</p>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
