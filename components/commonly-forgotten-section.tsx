"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

type ForgottenItem = {
  item: string
  why: string
  when: "before_move" | "first_week" | "first_month" | "ongoing"
  applies_to?: string[] | null
  lastVerified: string
}

interface CommonlyForgottenSectionProps {
  planId: string | undefined
  destination: string | undefined
  stage: string
}

const TIMING_LABELS: Record<string, string> = {
  before_move: "Before You Move",
  first_week: "First Week",
  first_month: "First Month",
  ongoing: "Ongoing",
}

const TIMING_ORDER = ["before_move", "first_week", "first_month", "ongoing"]

export function CommonlyForgottenSection({
  planId,
  destination,
  stage,
}: CommonlyForgottenSectionProps) {
  const [items, setItems] = useState<ForgottenItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [sectionOpen, setSectionOpen] = useState(true)

  // Determine which timing groups to show based on stage
  const isPostArrival = stage === "arrived"
  const visibleTimings = isPostArrival
    ? new Set(["first_week", "first_month", "ongoing"])
    : new Set(["before_move"])

  // Load checked state from existing progress
  const loadProgress = useCallback(async () => {
    if (!planId || !destination) return
    try {
      const res = await fetch(`/api/checklist-progress?plan_id=${planId}`)
      if (!res.ok) return
      const data = await res.json()
      const progressItems = data.items || []
      const countryCode = destination.substring(0, 3).toUpperCase()
      const checkedSet = new Set<string>()
      for (const p of progressItems) {
        if (typeof p.item_id === "string" && p.item_id.startsWith(`forgotten_${countryCode}_`) && p.completed) {
          checkedSet.add(p.item_id)
        }
      }
      setChecked(checkedSet)
    } catch { /* ignore */ }
  }, [planId, destination])

  useEffect(() => {
    if (!planId) return
    setLoading(true)
    fetch("/api/plan-checks")
      .then((res) => {
        if (!res.ok) throw new Error("Failed")
        return res.json()
      })
      .then((data) => {
        setItems(data.forgottenItems || [])
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [planId])

  useEffect(() => {
    loadProgress()
  }, [loadProgress])

  function getItemId(index: number) {
    const countryCode = (destination || "GEN").substring(0, 3).toUpperCase()
    return `forgotten_${countryCode}_${index}`
  }

  async function toggleCheck(index: number) {
    if (!planId) return
    const itemId = getItemId(index)
    const nowChecked = !checked.has(itemId)

    const next = new Set(checked)
    if (nowChecked) next.add(itemId)
    else next.delete(itemId)
    setChecked(next)

    try {
      await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, itemId, completed: nowChecked }),
      })
    } catch { /* ignore — optimistic update */ }
  }

  function toggleExpand(index: number) {
    const next = new Set(expanded)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setExpanded(next)
  }

  if (loading) {
    return <Skeleton className="h-24 w-full rounded-lg" />
  }

  const filteredItems = items.filter((item) => visibleTimings.has(item.when))
  if (filteredItems.length === 0) return null

  // Group by timing
  const groups = new Map<string, { item: ForgottenItem; originalIndex: number }[]>()
  items.forEach((item, index) => {
    if (!visibleTimings.has(item.when)) return
    const existing = groups.get(item.when) || []
    existing.push({ item, originalIndex: index })
    groups.set(item.when, existing)
  })

  const checkedCount = filteredItems.filter((_, i) => {
    const idx = items.indexOf(filteredItems[i])
    return checked.has(getItemId(idx))
  }).length

  return (
    <div className="rounded-lg border bg-card p-4">
      <button
        onClick={() => setSectionOpen(!sectionOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-sm">Things people often forget</span>
          {checkedCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {checkedCount}/{filteredItems.length} done
            </span>
          )}
        </div>
        {sectionOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {sectionOpen && (
        <div className="mt-3 space-y-4">
          {TIMING_ORDER.filter((t) => groups.has(t)).map((timing) => (
            <div key={timing}>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                {TIMING_LABELS[timing]}
              </h4>
              <div className="space-y-1">
                {groups.get(timing)!.map(({ item, originalIndex }) => {
                  const itemId = getItemId(originalIndex)
                  const isChecked = checked.has(itemId)
                  const isExpanded = expanded.has(originalIndex)

                  return (
                    <div key={originalIndex} className="group">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => toggleCheck(originalIndex)}
                          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-colors ${
                            isChecked
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-muted-foreground/30 hover:border-muted-foreground/60"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 mx-auto" />}
                        </button>
                        <button
                          onClick={() => toggleExpand(originalIndex)}
                          className={`flex-1 text-left text-sm ${
                            isChecked ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {item.item}
                        </button>
                      </div>
                      {isExpanded && (
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          {item.why}
                          {item.lastVerified && (
                            <span className="block mt-0.5 opacity-60">
                              Last verified: {item.lastVerified}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
