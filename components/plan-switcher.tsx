"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  ChevronDown,
  Plus,
  Pencil,
  Check,
  X,
  Lock,
  MapPin,
} from "lucide-react"
import { CountryFlag } from "@/components/country-flag"

interface PlanSummary {
  id: string
  title: string
  status: string
  is_current: boolean
  stage: string
  destination: string | null
  purpose: string | null
  created_at: string
  updated_at: string
}

interface PlanSwitcherProps {
  /** If true, shows inline rename UI for the current plan title */
  showRename?: boolean
  /** Callback when the plan changes */
  onPlanChange?: () => void
  /** Additional className for the container */
  className?: string
}

export function PlanSwitcher({
  showRename = false,
  onPlanChange,
  className,
}: PlanSwitcherProps) {
  const router = useRouter()
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [tier, setTier] = useState<string>("free")
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [creating, setCreating] = useState(false)

  const currentPlan = plans.find((p) => p.is_current)
  const canSwitch = tier === "pro_plus"

  useEffect(() => {
    fetchPlans()
  }, [])

  async function fetchPlans() {
    try {
      const res = await fetch("/api/plans")
      if (!res.ok) return
      const data = await res.json()
      setPlans(data.plans || [])
      setTier(data.tier || "free")
    } catch {
      // Silently fail - plans will be empty
    } finally {
      setLoading(false)
    }
  }

  async function handleSwitch(planId: string) {
    if (planId === currentPlan?.id || switching) return
    setSwitching(true)
    try {
      const res = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, action: "switch" }),
      })
      if (res.ok) {
        await fetchPlans()
        onPlanChange?.()
        router.refresh()
      }
    } finally {
      setSwitching(false)
    }
  }

  async function handleRename() {
    if (!currentPlan || !renameValue.trim()) return
    try {
      const res = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: currentPlan.id, action: "rename", title: renameValue.trim() }),
      })
      if (res.ok) {
        await fetchPlans()
        setIsRenaming(false)
      }
    } catch {
      // Silently fail
    }
  }

  async function handleCreatePlan() {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        await fetchPlans()
        onPlanChange?.()
        router.refresh()
      } else {
        const data = await res.json()
        if (res.status === 403) {
          // Plan limit reached
        }
      }
    } finally {
      setCreating(false)
    }
  }

  function startRename() {
    setRenameValue(currentPlan?.title || "")
    setIsRenaming(true)
  }

  if (loading) {
    return (
      <div className={cn("h-9 w-48 animate-pulse rounded-lg bg-muted", className)} />
    )
  }

  if (!currentPlan) return null

  const activePlans = plans.filter((p) => p.status !== "archived")

  // Free / Pro Single users: just show the title with optional rename
  // Pro+ users always get the dropdown (even with 1 plan, they can create new ones)
  if (!canSwitch) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {isRenaming && showRename ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename()
                if (e.key === "Escape") setIsRenaming(false)
              }}
              className="h-8 w-52 text-sm"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRename}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsRenaming(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {currentPlan.destination && (
                <CountryFlag country={currentPlan.destination} size={18} />
              )}
              <span className="text-sm font-medium text-foreground">
                {currentPlan.title}
              </span>
            </div>
            {showRename && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={startRename}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="sr-only">Rename plan</span>
              </Button>
            )}
          </>
        )}
      </div>
    )
  }

  // Pro+ with multiple plans - show dropdown switcher
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isRenaming && showRename ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename()
              if (e.key === "Escape") setIsRenaming(false)
            }}
            className="h-8 w-52 text-sm"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRename}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsRenaming(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <Select
            value={currentPlan.id}
            onValueChange={(value) => {
              if (value === "__new__") {
                handleCreatePlan()
              } else {
                handleSwitch(value)
              }
            }}
            disabled={switching}
          >
            <SelectTrigger className="h-9 w-auto min-w-[200px] max-w-[300px] gap-2 text-sm">
              <div className="flex items-center gap-2 truncate">
                {currentPlan.destination && (
                  <CountryFlag country={currentPlan.destination} size={16} />
                )}
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {activePlans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  <div className="flex items-center gap-2">
                    {plan.destination && (
                      <CountryFlag country={plan.destination} size={16} />
                    )}
                    <span className="truncate">{plan.title}</span>
                    {plan.is_current && (
                      <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                        Current
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="__new__">
                <div className="flex items-center gap-2 text-primary">
                  <Plus className="h-4 w-4" />
                  <span>New Plan</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {showRename && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={startRename}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="sr-only">Rename plan</span>
            </Button>
          )}
        </>
      )}
    </div>
  )
}
