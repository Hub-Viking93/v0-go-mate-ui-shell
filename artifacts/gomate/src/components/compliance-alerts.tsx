

import { useState, useEffect } from "react"
import { Link } from "wouter"
import { cn } from "@/lib/utils"
import { AlertTriangle, ArrowRight, Clock, Shield, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface ComplianceAlert {
  id: string
  title: string
  daysLeft: number
  deadlineDate: string
  type: "overdue" | "urgent"
}

interface ComplianceAlertsProps {
  planStage?: string
  className?: string
}

const DISMISS_KEY = 'gomate:compliance-alerts-dismissed'

export function ComplianceAlerts({ planStage, className }: ComplianceAlertsProps) {
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([])
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISS_KEY) === 'true'
  })
  const { toast } = useToast()

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  useEffect(() => {
    if (planStage !== "arrived") return

    async function checkCompliance() {
      try {
        const res = await fetch("/api/settling-in")
        if (!res.ok) return
        const data = await res.json()

        if (!data.tasks) return

        const foundAlerts: ComplianceAlert[] = []

        for (const task of data.tasks) {
          if (
            task.compliance_scope !== "required" ||
            task.status === "completed" ||
            task.status === "skipped"
          ) continue

          // Use server-computed compliance status from the settling-in read model.
          const urgency = task.compliance_status as string | undefined
          const daysLeft = task.days_until_deadline as number | null

          if (urgency === "overdue" || urgency === "urgent") {
            const deadlineDate = task.deadline_at
              ? new Date(task.deadline_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })
              : ""

            foundAlerts.push({
              id: task.id,
              title: task.title,
              daysLeft: daysLeft ?? 0,
              deadlineDate,
              type: urgency === "overdue" ? "overdue" : "urgent",
            })
          }
        }

        // Sort: overdue first, then by days left ascending
        foundAlerts.sort((a, b) => a.daysLeft - b.daysLeft)
        setAlerts(foundAlerts)

        // Show a toast for the most urgent item
        if (foundAlerts.length > 0) {
          const first = foundAlerts[0]
          toast({
            title: first.type === "overdue"
              ? `Overdue: ${first.title}`
              : `Due soon: ${first.title}`,
            description: first.type === "overdue"
              ? `This legal requirement is ${Math.abs(first.daysLeft)} day${Math.abs(first.daysLeft) !== 1 ? "s" : ""} overdue.`
              : `Due in ${first.daysLeft} day${first.daysLeft !== 1 ? "s" : ""} (${first.deadlineDate}).`,
            variant: first.type === "overdue" ? "destructive" : "default",
          })
        }
      } catch {
        // Silently fail
      }
    }

    checkCompliance()
  }, [planStage, toast])

  if (alerts.length === 0 || dismissed) return null

  const overdueAlerts = alerts.filter(a => a.type === "overdue")
  const urgentAlerts = alerts.filter(a => a.type === "urgent")

  return (
    <div className={cn("space-y-2", className)}>
      {/* Overdue banner */}
      {overdueAlerts.length > 0 && (
        <div
          className="gm-surface px-4 py-3.5"
          style={{ borderColor: "#E8B8BD", background: "#F5DDDF33" }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-8 h-8 rounded-md bg-[#F5DDDF] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#8B2F38]" strokeWidth={1.7} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-semibold text-[#8B2F38]">
                {overdueAlerts.length} overdue legal requirement{overdueAlerts.length > 1 ? "s" : ""}
              </h4>
              <ul className="mt-1.5 space-y-1">
                {overdueAlerts.map(a => (
                  <li key={a.id} className="text-[11.5px] flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#B5414C] shrink-0" />
                    <span className="font-medium text-[#1F2A24]">{a.title}</span>
                    <span className="text-[#B5414C] font-mono tabular-nums">
                      {Math.abs(a.daysLeft)}d overdue
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild className="text-xs h-7 rounded-md border-[#DCE7DF] hover:border-[#B5D2BC] hover:bg-[#F7FAF7]">
                <Link href="/checklist?tab=post-move">
                  View tasks
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
              <button
                onClick={handleDismiss}
                className="text-[#7E9088] hover:text-[#1F2A24] transition-colors"
                aria-label="Dismiss alerts"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Urgent (due within 7 days) banner */}
      {urgentAlerts.length > 0 && overdueAlerts.length === 0 && (
        <div
          className="gm-surface px-4 py-3.5"
          style={{ borderColor: "#E8C77B", background: "#F6ECD733" }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-8 h-8 rounded-md bg-[#F6ECD7] flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-[#8C6B2F]" strokeWidth={1.7} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-semibold text-[#8C6B2F]">
                {urgentAlerts.length} deadline{urgentAlerts.length > 1 ? "s" : ""} approaching
              </h4>
              <ul className="mt-1.5 space-y-1">
                {urgentAlerts.map(a => (
                  <li key={a.id} className="text-[11.5px] flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#C99746] shrink-0" />
                    <span className="font-medium text-[#1F2A24]">{a.title}</span>
                    <span className="text-[#C99746] font-mono tabular-nums">
                      {a.daysLeft === 0 ? "due today" : `${a.daysLeft}d left`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild className="text-xs h-7 rounded-md border-[#DCE7DF] hover:border-[#B5D2BC] hover:bg-[#F7FAF7]">
                <Link href="/checklist?tab=post-move">
                  View tasks
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
              <button
                onClick={handleDismiss}
                className="text-[#7E9088] hover:text-[#1F2A24] transition-colors"
                aria-label="Dismiss alerts"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
