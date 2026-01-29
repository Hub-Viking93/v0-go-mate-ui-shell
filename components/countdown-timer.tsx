"use client"

import { CalendarDays, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { differenceInDays, differenceInWeeks, differenceInMonths, format, parseISO } from "date-fns"

interface CountdownTimerProps {
  targetDate: string | null
  targetCountry?: string | null
}

export function CountdownTimer({ targetDate, targetCountry }: CountdownTimerProps) {
  if (!targetDate) {
    return null
  }

  // Validate the date string before parsing
  const target = parseISO(targetDate)
  if (isNaN(target.getTime())) {
    return null
  }
  const today = new Date()
  const daysUntil = differenceInDays(target, today)
  const weeksUntil = differenceInWeeks(target, today)
  const monthsUntil = differenceInMonths(target, today)

  // Determine urgency level
  const getUrgencyLevel = () => {
    if (daysUntil < 0) return "past"
    if (daysUntil <= 14) return "critical"
    if (daysUntil <= 30) return "urgent"
    if (daysUntil <= 90) return "moderate"
    return "comfortable"
  }

  const urgency = getUrgencyLevel()

  const urgencyConfig = {
    past: {
      bgClass: "bg-muted",
      textClass: "text-muted-foreground",
      icon: CheckCircle2,
      label: "Move date passed",
    },
    critical: {
      bgClass: "bg-destructive/10 border-destructive/30",
      textClass: "text-destructive",
      icon: AlertTriangle,
      label: "Very soon!",
    },
    urgent: {
      bgClass: "bg-amber-500/10 border-amber-500/30",
      textClass: "text-amber-600 dark:text-amber-400",
      icon: Clock,
      label: "Coming up",
    },
    moderate: {
      bgClass: "bg-primary/10 border-primary/30",
      textClass: "text-primary",
      icon: CalendarDays,
      label: "On track",
    },
    comfortable: {
      bgClass: "bg-emerald-500/10 border-emerald-500/30",
      textClass: "text-emerald-600 dark:text-emerald-400",
      icon: CalendarDays,
      label: "Plenty of time",
    },
  }

  const config = urgencyConfig[urgency]
  const Icon = config.icon

  // Format the countdown display
  const getCountdownDisplay = () => {
    if (daysUntil < 0) {
      const daysPast = Math.abs(daysUntil)
      return daysPast === 1 ? "1 day ago" : `${daysPast} days ago`
    }
    if (daysUntil === 0) return "Today!"
    if (daysUntil === 1) return "1 day"
    if (daysUntil < 7) return `${daysUntil} days`
    if (weeksUntil < 4) return `${weeksUntil} week${weeksUntil > 1 ? "s" : ""}`
    if (monthsUntil < 12) return `${monthsUntil} month${monthsUntil > 1 ? "s" : ""}`
    return `${Math.floor(monthsUntil / 12)}+ year${monthsUntil >= 24 ? "s" : ""}`
  }

  const getSubtext = () => {
    if (daysUntil < 0) return "Your move date has passed"
    if (daysUntil === 0) return "Your move is today!"
    return `${daysUntil} day${daysUntil !== 1 ? "s" : ""} until your move`
  }

  return (
    <div className={`rounded-xl border p-4 ${config.bgClass}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-full ${config.bgClass}`}>
          <Icon className={`w-5 h-5 ${config.textClass}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${config.textClass}`}>
              {getCountdownDisplay()}
            </span>
            <span className={`text-xs font-medium ${config.textClass} opacity-75`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {getSubtext()}
            {targetCountry && daysUntil >= 0 && <span> to {targetCountry}</span>}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Target: {format(target, "MMMM d, yyyy")}
          </p>
        </div>
      </div>
    </div>
  )
}
