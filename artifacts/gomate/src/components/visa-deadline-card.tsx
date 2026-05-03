

import { CalendarClock, AlertTriangle, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface VisaDeadlineCardProps {
  estimatedDeadline: {
    applyByDate: string
    daysUntilDeadline: number
    processingDays: number
  } | null
  targetDate: string | null
  processingTime?: string
  officialLink?: string
}

export function VisaDeadlineCard({ estimatedDeadline, targetDate, processingTime, officialLink }: VisaDeadlineCardProps) {
  if (!estimatedDeadline) {
    return (
      <div className="p-4 rounded-xl bg-muted/30 border border-border">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Estimated Deadline</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {!targetDate
            ? "Set a target arrival date in your profile to see deadline estimates."
            : "Check processing times on the official website."}
        </p>
        {officialLink && (
          <a
            href={officialLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> Official website
          </a>
        )}
      </div>
    )
  }

  const { applyByDate, daysUntilDeadline, processingDays } = estimatedDeadline
  const isUrgent = daysUntilDeadline <= 14
  const isPast = daysUntilDeadline < 0

  return (
    <div className={cn(
      "p-4 rounded-xl border",
      isPast
        ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
        : isUrgent
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
          : "bg-card border-border"
    )}>
      <div className="flex items-center gap-2 mb-3">
        {(isPast || isUrgent) && <AlertTriangle className={cn("w-4 h-4", isPast ? "text-red-500" : "text-amber-500")} />}
        <CalendarClock className={cn("w-4 h-4", isPast ? "text-red-500" : isUrgent ? "text-amber-500" : "text-primary")} />
        <h3 className="text-sm font-semibold text-foreground">Estimated Apply-By Date</h3>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className={cn(
          "text-2xl font-bold",
          isPast ? "text-red-600 dark:text-red-400" : isUrgent ? "text-amber-600 dark:text-amber-400" : "text-foreground"
        )}>
          {new Date(applyByDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      <p className={cn(
        "text-sm",
        isPast ? "text-red-600 dark:text-red-400" : isUrgent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
      )}>
        {isPast
          ? `${Math.abs(daysUntilDeadline)} days past recommended application date`
          : `${daysUntilDeadline} days until recommended application date`}
      </p>

      <p className="text-xs text-muted-foreground mt-2">
        Based on {processingTime || `~${processingDays} days`} processing time
        {targetDate && ` and your target date of ${new Date(targetDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}.
        This is an estimate — actual times may vary.
      </p>

      {officialLink && (
        <a
          href={officialLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> Check official processing times
        </a>
      )}
    </div>
  )
}
