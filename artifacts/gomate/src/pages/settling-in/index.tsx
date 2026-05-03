

import { useState, useEffect, useCallback } from "react"
import { Link } from "wouter"
import { ContentDisclaimer } from "@/components/legal-disclaimer"
import {
  ArrowLeft,
  ListChecks,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Lock,
  CheckCircle2,
  Shield,
  Sparkles,
  ClipboardList,
  Landmark,
  Home,
  HeartPulse,
  Briefcase,
  Car,
  Wifi,
  Users,
  Scale,
  MoreHorizontal,
  Calendar,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { FullPageGate } from "@/components/tier-gate"
import { useTier } from "@/hooks/use-tier"
import {
  SettlingInTaskCard,
  type SettlingInTask,
} from "@/components/settling-in-task-card"
import { SETTLING_CATEGORIES } from "@/lib/gomate/settling-in-generator"
import { ComplianceTimeline } from "@/components/compliance-timeline"
import { ComplianceCalendar } from "@/components/compliance-calendar"
import { WellbeingCheckin } from "@/components/wellbeing-checkin"
import { cn } from "@/lib/utils"
import { CommonlyForgottenSection } from "@/components/commonly-forgotten-section"

// Map category keys to icons and colors
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  registration: ClipboardList,
  banking: Landmark,
  housing: Home,
  healthcare: HeartPulse,
  employment: Briefcase,
  transport: Car,
  utilities: Wifi,
  social: Users,
  legal: Scale,
  other: MoreHorizontal,
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  registration: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/20" },
  banking: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20" },
  housing: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20" },
  healthcare: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/20" },
  employment: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", ring: "ring-purple-500/20" },
  transport: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", ring: "ring-cyan-500/20" },
  utilities: { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", ring: "ring-indigo-500/20" },
  social: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", ring: "ring-pink-500/20" },
  legal: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", ring: "ring-red-500/20" },
  other: { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", ring: "ring-slate-500/20" },
}

interface SettlingStats {
  total: number
  completed: number
  overdue?: number
  available: number
  locked: number
  legalTotal: number
  legalCompleted: number
  progressPercent: number
  compliancePercent?: number
}

export default function SettlingInPage() {
  const { tier, loading: tierLoading } = useTier()
  const [tasks, setTasks] = useState<SettlingInTask[]>([])
  const [stats, setStats] = useState<SettlingStats | null>(null)
  const [arrivalDate, setArrivalDate] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [planStage, setPlanStage] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<"all" | "first30">("all")
  const [activeTab, setActiveTab] = useState<"tasks" | "calendar">("tasks")

  // Compute days since arrival
  const daysSinceArrival = arrivalDate
    ? Math.floor((Date.now() - new Date(arrivalDate).getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Auto-activate first 30 days mode for first 7 days after arrival
  useEffect(() => {
    if (daysSinceArrival !== null && daysSinceArrival >= 0 && daysSinceArrival < 7) {
      const saved = localStorage.getItem("gomate:settling-view")
      if (!saved) setViewMode("first30")
    } else if (daysSinceArrival !== null && daysSinceArrival > 30) {
      setViewMode("all")
    } else {
      const saved = localStorage.getItem("gomate:settling-view")
      if (saved === "first30" || saved === "all") setViewMode(saved)
    }
  }, [daysSinceArrival])

  function handleViewToggle(mode: "all" | "first30") {
    setViewMode(mode)
    localStorage.setItem("gomate:settling-view", mode)
  }

  // Filter tasks for first 30 days mode
  const filteredTasks = viewMode === "first30"
    ? tasks.filter((t) =>
        t.status !== "completed" && (
          t.is_legal_requirement ||
          (t.deadline_days !== null && t.deadline_days <= 30)
        )
      ).sort((a, b) => {
        // Legal requirements first
        if (a.is_legal_requirement !== b.is_legal_requirement) return a.is_legal_requirement ? -1 : 1
        // Then by deadline_days ASC
        const aDeadline = a.deadline_days ?? 999
        const bDeadline = b.deadline_days ?? 999
        if (aDeadline !== bDeadline) return aDeadline - bDeadline
        // Then by sort_order
        return a.sort_order - b.sort_order
      })
    : tasks

  const fetchTasks = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch("/api/settling-in")
      if (res.status === 403) {
        setLoading(false)
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to fetch tasks")
      }
      const data = await res.json()
      setPlanStage(data.stage || null)
      setPlanId(data.planId || null)
      setTasks(data.tasks || [])
      setStats(data.stats || null)
      setArrivalDate(data.arrivalDate || null)
      setGenerated(data.generated || false)

      // Auto-expand categories that have available tasks
      if (data.tasks?.length) {
        const catWithAvailable = new Set<string>()
        for (const t of data.tasks) {
          if (t.status === "available" || t.status === "in_progress" || t.status === "overdue") {
            catWithAvailable.add(t.category)
          }
        }
        setExpandedCategories(catWithAvailable)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch tasks")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!tierLoading && tier === "pro") {
      fetchTasks()
    } else if (!tierLoading) {
      setLoading(false)
    }
  }, [tierLoading, tier, fetchTasks])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/settling-in/generate", { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to generate tasks")
      }
      // Re-fetch to get proper stats and availability
      await fetchTasks()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate tasks")
    } finally {
      setGenerating(false)
    }
  }

  async function handleStatusChange(taskId: string, status: string) {
    try {
      const res = await fetch(`/api/settling-in/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update task")
      }
      // Re-fetch to get updated dependency states
      await fetchTasks()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update task")
    }
  }

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // Group tasks by category (uses filteredTasks for first30 mode)
  const tasksForGrouping = viewMode === "first30" ? filteredTasks : tasks
  const grouped = SETTLING_CATEGORIES.map((cat) => ({
    ...cat,
    tasks: tasksForGrouping.filter((t) => t.category === cat.key),
  })).filter((g) => g.tasks.length > 0)

  // Tier gate
  if (!tierLoading && tier !== "pro") {
    return (
      <FullPageGate
        tier={(tier || "free")}
        feature="post_relocation"
      >
        <div />
      </FullPageGate>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1B3A2D] via-[#234D3A] to-[#2D6A4F] p-6 md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(94,232,156,0.15),transparent_60%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <ListChecks className="w-7 h-7 text-[#5EE89C]" />
              Settling-In Checklist
            </h1>
            <p className="text-white/60 mt-1.5 text-sm md:text-base">
              Your personalized post-arrival tasks with smart dependency tracking
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white shrink-0">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Dashboard
            </Link>
          </Button>
        </div>

        {/* View mode toggle + Day counter */}
        {generated && tasks.length > 0 && arrivalDate && (
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
            {/* Day counter */}
            {daysSinceArrival !== null && daysSinceArrival >= 0 && daysSinceArrival <= 30 && viewMode === "first30" && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#5EE89C]" />
                  <span className="text-white font-bold text-lg">Day {daysSinceArrival + 1}</span>
                  <span className="text-white/50 text-sm">of 30</span>
                </div>
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5EE89C] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(((daysSinceArrival + 1) / 30) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {viewMode === "first30" && (
              <span className="text-white/60 text-sm">
                {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""} remaining
              </span>
            )}
            <div className="flex items-center rounded-lg bg-white/10 p-0.5">
              <button
                onClick={() => handleViewToggle("first30")}
                className={cn(
                  "px-3 py-1 text-xs rounded-md transition-colors",
                  viewMode === "first30" ? "bg-white/20 text-white font-medium" : "text-white/60 hover:text-white"
                )}
              >
                First 30 Days
              </button>
              <button
                onClick={() => handleViewToggle("all")}
                className={cn(
                  "px-3 py-1 text-xs rounded-md transition-colors",
                  viewMode === "all" ? "bg-white/20 text-white font-medium" : "text-white/60 hover:text-white"
                )}
              >
                All Tasks
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tab toggle: Tasks / Calendar */}
      {!loading && generated && tasks.length > 0 && (
        <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1 w-fit">
          <button
            onClick={() => setActiveTab("tasks")}
            className={cn(
              "px-4 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5",
              activeTab === "tasks" ? "bg-background text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ListChecks className="w-4 h-4" />
            Tasks
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={cn(
              "px-4 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5",
              activeTab === "calendar" ? "bg-background text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="gm-card-static p-4 flex items-start gap-3 !border-destructive/20 bg-destructive/5">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Something went wrong</p>
            <p className="text-sm text-muted-foreground mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Pre-arrival locked state */}
      {!loading && planStage && planStage !== 'arrived' && !generated && (
        <div className="gm-card-static p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Confirm your arrival first
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Your settling-in checklist will be available after you confirm arrival at your destination.
              Head to the dashboard to confirm you have arrived.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Go to Dashboard
            </Link>
          </Button>
        </div>
      )}

      {/* Not yet generated (arrived but no checklist yet) */}
      {!loading && (!planStage || planStage === 'arrived') && !generated && !generating && (
        <div className="gm-card-static p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ListChecks className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Generate your settling-in checklist
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Based on your relocation profile, we will create a personalized task list
              of common steps to consider after arriving at your destination.
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            <Sparkles className="w-4 h-4 mr-1.5" />
            Generate checklist
          </Button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="gm-card-static p-8 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Researching your destination...
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              This may take a moment while we gather official requirements.
            </p>
          </div>
        </div>
      )}

      {/* Stats bar */}
      {!loading && generated && stats && (
        <div className="gm-card-static p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground">Progress</h3>
              <span className="text-lg font-mono font-bold text-foreground">
                {stats.completed}<span className="text-muted-foreground font-normal text-sm">/{stats.total}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {stats.legalTotal > 0 && (
                <Badge variant="outline" className="text-xs gap-1 border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5">
                  <Shield className="w-3 h-3" />
                  {stats.legalCompleted}/{stats.legalTotal} legal ({stats.compliancePercent ?? 0}%)
                </Badge>
              )}
              {(stats.overdue ?? 0) > 0 && (
                <Badge variant="destructive" className="text-xs gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {stats.overdue} overdue
                </Badge>
              )}
              <Badge variant="outline" className="text-xs gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                <CheckCircle2 className="w-3 h-3" />
                {stats.available} available
              </Badge>
              {stats.locked > 0 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Lock className="w-3 h-3" />
                  {stats.locked} locked
                </Badge>
              )}
            </div>
          </div>
          {/* Chunky progress bar */}
          <div className="relative">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>
            <span className="absolute right-0 -top-5 text-xs font-mono font-medium text-muted-foreground">
              {stats.progressPercent}%
            </span>
          </div>
        </div>
      )}

      {/* Content Disclaimer */}
      {!loading && generated && tasks.length > 0 && <ContentDisclaimer />}

      {/* Wellbeing Check-In */}
      {!loading && generated && arrivalDate && planStage === "arrived" && (
        <WellbeingCheckin arrivalDate={arrivalDate} />
      )}

      {/* Calendar tab */}
      {!loading && generated && activeTab === "calendar" && tasks.length > 0 && (
        <ComplianceCalendar
          tasks={tasks}
          onMarkDone={(taskId) => handleStatusChange(taskId, "completed")}
          className="gm-animate-in"
        />
      )}

      {/* Compliance Timeline (tasks tab only) */}
      {!loading && generated && activeTab === "tasks" && arrivalDate && tasks.length > 0 && (
        <ComplianceTimeline
          tasks={tasks}
          arrivalDate={arrivalDate}
          className="gm-animate-in gm-delay-2"
        />
      )}

      {/* First 30 Days: flat priority list */}
      {!loading && generated && activeTab === "tasks" && viewMode === "first30" && filteredTasks.length > 0 && (
        <div className="gm-card-static overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Focus: Get Settled
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Priority tasks for your first 30 days
            </p>
          </div>
          <div className="border-t border-border">
            {filteredTasks.map((task) => (
              <SettlingInTaskCard
                key={task.id}
                task={task}
                arrivalDate={arrivalDate}
                onStatusChange={handleStatusChange}
                allTasks={tasks}
              />
            ))}
          </div>
          <div className="p-3 border-t border-border">
            <button
              onClick={() => handleViewToggle("all")}
              className="text-xs text-primary hover:underline"
            >
              See all {tasks.length} tasks →
            </button>
          </div>
        </div>
      )}

      {/* First 30 days empty state */}
      {!loading && generated && activeTab === "tasks" && viewMode === "first30" && filteredTasks.length === 0 && tasks.length > 0 && (
        <div className="gm-card-static p-6 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="text-foreground font-medium">All first 30 days tasks completed!</p>
          <button
            onClick={() => handleViewToggle("all")}
            className="text-sm text-primary hover:underline"
          >
            View all tasks →
          </button>
        </div>
      )}

      {/* Task categories (all tasks mode) */}
      {!loading && generated && activeTab === "tasks" && viewMode === "all" && grouped.length > 0 && (
        <div className="space-y-3">
          {grouped.map((group, groupIdx) => {
            const isExpanded = expandedCategories.has(group.key)
            const completedInGroup = group.tasks.filter(
              (t) => t.status === "completed"
            ).length
            const availableInGroup = group.tasks.filter(
              (t) => t.status === "available" || t.status === "in_progress"
            ).length
            const hasLegal = group.tasks.some((t) => t.is_legal_requirement)

            const catColors = CATEGORY_COLORS[group.key] || CATEGORY_COLORS.other
            const CatIcon = CATEGORY_ICONS[group.key] || MoreHorizontal
            const isComplete = completedInGroup === group.tasks.length
            const catProgress = group.tasks.length > 0 ? Math.round((completedInGroup / group.tasks.length) * 100) : 0

            return (
              <div
                key={group.key}
                className={cn(
                  "gm-card-static overflow-hidden gm-animate-in",
                  `gm-delay-${Math.min(groupIdx + 1, 8)}`
                )}
              >
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(group.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        isComplete ? "bg-emerald-500/15" : catColors.bg
                      )}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <CatIcon className={cn("w-5 h-5", catColors.text)} />
                      )}
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-foreground">
                        {group.label}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">
                          {completedInGroup}/{group.tasks.length}
                        </span>
                        {/* Mini progress bar */}
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              isComplete ? "bg-emerald-500" : "bg-primary"
                            )}
                            style={{ width: `${catProgress}%` }}
                          />
                        </div>
                        {availableInGroup > 0 && (
                          <span className="text-[11px] text-primary font-medium">
                            {availableInGroup} ready
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasLegal && (
                      <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5 gap-0.5 px-1.5">
                        <Shield className="w-3 h-3" />
                        Legal
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Tasks */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {group.tasks.map((task) => (
                      <SettlingInTaskCard
                        key={task.id}
                        task={task}
                        arrivalDate={arrivalDate}
                        onStatusChange={handleStatusChange}
                        allTasks={tasks}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Commonly Forgotten Items */}
      {!loading && planId && planStage === "arrived" && (
        <CommonlyForgottenSection
          planId={planId}
          destination={undefined}
          stage="arrived"
        />
      )}

      {/* Empty state after generation */}
      {!loading && generated && activeTab === "tasks" && tasks.length === 0 && (
        <div className="gm-card-static p-8 text-center space-y-3">
          <p className="text-muted-foreground">No tasks found.</p>
          <Button variant="outline" onClick={handleGenerate} disabled={generating}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Regenerate
          </Button>
        </div>
      )}
    </div>
  )
}
