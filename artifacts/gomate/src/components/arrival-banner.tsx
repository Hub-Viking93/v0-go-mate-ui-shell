

import { useState } from "react"
import { useRouter } from "@/lib/router-compat"
import {
  Plane,
  ListChecks,
  ArrowRight,
  Loader2,
  CalendarDays,
  PartyPopper,
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ArrivalBannerProps {
  stage: string
  tier: string
  destination: string
  onArrived?: () => void
}

export function ArrivalBanner({ stage, tier, destination, onArrived }: ArrivalBannerProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [arrivalDate, setArrivalDate] = useState(
    new Date().toISOString().split("T")[0]
  )

  // Only show for Pro users with a completed plan that hasn't transitioned yet
  if (tier !== "pro" || stage !== "complete") return null

  async function handleArrival() {
    setLoading(true)
    try {
      const res = await fetch("/api/settling-in/arrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arrivalDate }),
      })
      if (!res.ok) {
        const data = await res.json()
        console.error("[ArrivalBanner] Error:", data.error)
        return
      }
      onArrived?.()
      router.push("/checklist?tab=post-move")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="gm-card-static overflow-hidden gm-animate-in gm-delay-2 mb-6">
      <div className="relative p-4">
        {/* Background accent */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Plane className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              {"Have you arrived in " + destination + "?"}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Unlock your personalized settling-in checklist with smart task
              dependency tracking and compliance deadlines.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {!showDatePicker ? (
              <Button
                onClick={() => setShowDatePicker(true)}
                className="w-full sm:w-auto"
              >
                <PartyPopper className="w-4 h-4 mr-1.5" />
                {"I've arrived!"}
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className="pl-9 pr-3 py-2 rounded-[10px] border border-border bg-background text-sm font-mono w-full sm:w-auto"
                  />
                </div>
                <Button onClick={handleArrival} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-1" />
                  )}
                  Confirm
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Shown on the dashboard after the user has transitioned to 'arrived'
 */
interface SettlingInDashboardCardProps {
  summary?: {
    headline: string
    detail: string
    actionLabel: string
    progressPercent: number
    completed: number
    total: number
    overdue: number
    available: number
  }
}

export function SettlingInDashboardCard({ summary }: SettlingInDashboardCardProps) {
  const headline = summary?.headline || "Settling-In Checklist"
  const detail = summary?.detail || "Track your post-arrival tasks and deadlines"
  const actionLabel = summary?.actionLabel || "Open"
  const progressPercent = summary?.progressPercent ?? 0
  const completed = summary?.completed ?? 0
  const total = summary?.total ?? 0
  const overdue = summary?.overdue ?? 0
  const available = summary?.available ?? 0

  return (
    <div className="gm-card p-4 gm-animate-in gm-delay-2 mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ListChecks className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-1.5">
            <div>
              <h3 className="text-sm font-medium text-foreground">{headline}</h3>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {completed}/{total} complete
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock3 className="w-3.5 h-3.5" />
                {available} active
              </Badge>
              {overdue > 0 && (
                <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {overdue} overdue
                </Badge>
              )}
              <Badge variant="secondary">{progressPercent}% progress</Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/checklist?tab=post-move">
            <ArrowRight className="w-4 h-4 mr-1" />
            {actionLabel}
          </a>
        </Button>
      </div>
    </div>
  )
}
