"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plane,
  ListChecks,
  ArrowRight,
  Loader2,
  CalendarDays,
  PartyPopper,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

  // Only show for Pro+ users with a completed plan that hasn't transitioned yet
  if (tier !== "pro_plus" || stage !== "complete") return null

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
      router.push("/settling-in")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="gm-card-static overflow-hidden gm-animate-in gm-delay-2 mb-8">
      <div className="relative p-6">
        {/* Background accent */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Plane className="w-6 h-6 text-primary" />
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
export function SettlingInDashboardCard() {
  return (
    <div className="gm-card p-6 gm-animate-in gm-delay-2 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">
              Settling-In Checklist
            </h3>
            <p className="text-xs text-muted-foreground">
              Track your post-arrival tasks and deadlines
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/settling-in">
            <ArrowRight className="w-4 h-4 mr-1" />
            Open
          </a>
        </Button>
      </div>
    </div>
  )
}
