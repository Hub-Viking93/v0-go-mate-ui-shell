

import { useState, useMemo } from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar as CalendarIcon,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CalendarTask {
  id: string
  title: string
  status: string
  deadline_at: string | null
  is_legal_requirement: boolean
  days_until_deadline: number | null
  compliance_status?: string
}

interface ComplianceCalendarProps {
  tasks: CalendarTask[]
  onMarkDone: (taskId: string) => void
  className?: string
}

type DotColor = "red" | "amber" | "blue" | "green"

function getDotColor(task: CalendarTask): DotColor {
  if (task.status === "completed") return "green"
  if (task.status === "overdue" || task.compliance_status === "overdue") return "red"
  if (task.compliance_status === "urgent" || (task.days_until_deadline !== null && task.days_until_deadline <= 7 && task.days_until_deadline >= 0)) return "amber"
  return "blue"
}

const DOT_CLASSES: Record<DotColor, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
}

function formatDaysLeft(days: number | null): string {
  if (days === null) return ""
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return "Due today"
  return `${days} days left`
}

export function ComplianceCalendar({ tasks, onMarkDone, className }: ComplianceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Build map: date string -> tasks for that date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>()
    for (const task of tasks) {
      if (!task.deadline_at || !task.is_legal_requirement) continue
      const dateKey = new Date(task.deadline_at).toISOString().split("T")[0]
      const existing = map.get(dateKey) || []
      existing.push(task)
      map.set(dateKey, existing)
    }
    return map
  }, [tasks])

  // Build modifiers for react-day-picker
  const modifiers = useMemo(() => {
    const overdue: Date[] = []
    const urgent: Date[] = []
    const upcoming: Date[] = []
    const completed: Date[] = []

    for (const [dateStr, dateTasks] of tasksByDate) {
      const date = new Date(dateStr + "T00:00:00")
      // Use the highest-priority color among tasks on this date
      let hasRed = false, hasAmber = false, hasBlue = false, hasGreen = false
      for (const t of dateTasks) {
        const color = getDotColor(t)
        if (color === "red") hasRed = true
        else if (color === "amber") hasAmber = true
        else if (color === "blue") hasBlue = true
        else if (color === "green") hasGreen = true
      }
      if (hasRed) overdue.push(date)
      else if (hasAmber) urgent.push(date)
      else if (hasBlue) upcoming.push(date)
      else if (hasGreen) completed.push(date)
    }

    return { overdue, urgent, upcoming, completed }
  }, [tasksByDate])

  // Tasks for the selected date popover
  const selectedDateKey = selectedDate?.toISOString().split("T")[0] ?? null
  const selectedTasks = selectedDateKey ? (tasksByDate.get(selectedDateKey) || []) : []

  function handleDayClick(date: Date) {
    const dateKey = date.toISOString().split("T")[0]
    if (tasksByDate.has(dateKey)) {
      setSelectedDate(date)
    } else {
      setSelectedDate(null)
    }
  }

  async function handleDownloadIcal() {
    const res = await fetch("/api/settling-in/export-ical")
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "gomate-compliance-calendar.ics"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const hasDeadlineTasks = tasksByDate.size > 0

  if (!hasDeadlineTasks) {
    return (
      <div className={cn("gm-card-static p-6 text-center space-y-3", className)}>
        <CalendarIcon className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          No legal deadlines to display. Generate your settling-in checklist to see your compliance calendar.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("gm-card-static overflow-hidden", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Compliance Calendar</h3>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadIcal} className="gap-1.5 text-xs">
          <Download className="w-3.5 h-3.5" />
          Download .ics
        </Button>
      </div>

      {/* Legend */}
      <div className="px-4 pt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Overdue</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Due soon</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Upcoming</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Completed</span>
      </div>

      {/* Calendar */}
      <div className="p-4 flex justify-center">
        <DayPicker
          mode="single"
          selected={selectedDate ?? undefined}
          onSelect={(date) => {
            if (date) handleDayClick(date)
            else setSelectedDate(null)
          }}
          modifiers={modifiers}
          modifiersClassNames={{
            overdue: "rdp-day--overdue",
            urgent: "rdp-day--urgent",
            upcoming: "rdp-day--upcoming",
            completed: "rdp-day--completed",
          }}
          showOutsideDays
          className="[&_.rdp-day--overdue]:relative [&_.rdp-day--overdue]:after:absolute [&_.rdp-day--overdue]:after:bottom-1 [&_.rdp-day--overdue]:after:left-1/2 [&_.rdp-day--overdue]:after:-translate-x-1/2 [&_.rdp-day--overdue]:after:w-1.5 [&_.rdp-day--overdue]:after:h-1.5 [&_.rdp-day--overdue]:after:rounded-full [&_.rdp-day--overdue]:after:bg-red-500 [&_.rdp-day--urgent]:relative [&_.rdp-day--urgent]:after:absolute [&_.rdp-day--urgent]:after:bottom-1 [&_.rdp-day--urgent]:after:left-1/2 [&_.rdp-day--urgent]:after:-translate-x-1/2 [&_.rdp-day--urgent]:after:w-1.5 [&_.rdp-day--urgent]:after:h-1.5 [&_.rdp-day--urgent]:after:rounded-full [&_.rdp-day--urgent]:after:bg-amber-500 [&_.rdp-day--upcoming]:relative [&_.rdp-day--upcoming]:after:absolute [&_.rdp-day--upcoming]:after:bottom-1 [&_.rdp-day--upcoming]:after:left-1/2 [&_.rdp-day--upcoming]:after:-translate-x-1/2 [&_.rdp-day--upcoming]:after:w-1.5 [&_.rdp-day--upcoming]:after:h-1.5 [&_.rdp-day--upcoming]:after:rounded-full [&_.rdp-day--upcoming]:after:bg-blue-500 [&_.rdp-day--completed]:relative [&_.rdp-day--completed]:after:absolute [&_.rdp-day--completed]:after:bottom-1 [&_.rdp-day--completed]:after:left-1/2 [&_.rdp-day--completed]:after:-translate-x-1/2 [&_.rdp-day--completed]:after:w-1.5 [&_.rdp-day--completed]:after:h-1.5 [&_.rdp-day--completed]:after:rounded-full [&_.rdp-day--completed]:after:bg-emerald-500"
        />
      </div>

      {/* Day popover */}
      {selectedDate && selectedTasks.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              {selectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </h4>
            <button onClick={() => setSelectedDate(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {selectedTasks.map((task) => {
              const color = getDotColor(task)
              const StatusIcon = color === "green" ? CheckCircle2 : color === "red" ? AlertTriangle : Clock
              return (
                <div key={task.id} className="flex items-start gap-3 p-2 rounded-lg bg-background border border-border">
                  <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", DOT_CLASSES[color])} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      task.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"
                    )}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusIcon className={cn("w-3 h-3", color === "red" ? "text-red-500" : color === "amber" ? "text-amber-500" : color === "green" ? "text-emerald-500" : "text-blue-500")} />
                      <span className="text-xs text-muted-foreground">
                        {task.status === "completed" ? "Completed" : formatDaysLeft(task.days_until_deadline)}
                      </span>
                    </div>
                  </div>
                  {task.status !== "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs shrink-0"
                      onClick={() => onMarkDone(task.id)}
                    >
                      Mark done
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
