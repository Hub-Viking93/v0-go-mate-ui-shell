

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
  ResearchProvenanceBadge,
  type ResearchProvenance,
} from "@/components/research-provenance-badge"
import {
  SettlingInTaskCard,
  type SettlingInTask,
} from "@/components/settling-in-task-card"
import type { VaultDocRefView } from "@/components/task-detail-sheet"
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
  const [vaultDocs, setVaultDocs] = useState<VaultDocRefView[]>([])
  // Phase D-A — per-category provenance map. Keys are SettlingDomain
  // values; absent keys render as "Generic".
  const [provenance, setProvenance] = useState<Record<string, ResearchProvenance>>({})

  const refreshVault = useCallback(async () => {
    try {
      const res = await fetch("/api/vault")
      if (!res.ok) return
      const data = (await res.json()) as { documents: Array<{
        id: string
        fileName: string
        category: VaultDocRefView["category"]
        uploadedAt: string
        linkedTaskKeys: string[]
      }> }
      setVaultDocs(
        (data.documents ?? []).map((d) => ({
          id: d.id,
          fileName: d.fileName,
          category: d.category,
          uploadedAt: d.uploadedAt,
          linkedTaskKeys: d.linkedTaskKeys ?? [],
        })),
      )
    } catch {
      /* swallow — vault fetch failure isn't fatal */
    }
  }, [])

  useEffect(() => {
    void refreshVault()
  }, [refreshVault])

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
      setProvenance((data.provenance as Record<string, ResearchProvenance> | undefined) ?? {})

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
    <div className="space-y-4">
      {/* Compact toolbar: day counter + view-mode toggle. The page-level
          title lives in PostMovePage's PageShell — no hero needed. */}
      {generated && tasks.length > 0 && arrivalDate && (
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2.5 bg-card"
          style={{ border: "1px solid #DCE7DF", borderRadius: "6px" }}
        >
          {daysSinceArrival !== null && daysSinceArrival >= 0 && daysSinceArrival <= 30 && viewMode === "first30" ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#7BB091]" strokeWidth={1.7} />
                <span className="text-[13px] font-semibold text-[#1F2A24]">Day {daysSinceArrival + 1}</span>
                <span className="text-[11px] text-[#7E9088]">of 30</span>
              </div>
              <div className="w-24 h-1.5 bg-[#ECF1EC] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#7BB091] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(((daysSinceArrival + 1) / 30) * 100, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-[12px] text-[#7E9088]">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""} {viewMode === "first30" ? "in your first 30 days" : "in your settling-in plan"}
            </span>
          )}
          <div
            className="flex items-center rounded-md bg-[#F4F8F4] p-0.5"
            style={{ border: "1px solid #DCE7DF" }}
          >
            <button
              onClick={() => handleViewToggle("first30")}
              className={cn(
                "px-2.5 py-1 text-[12px] rounded transition-colors",
                viewMode === "first30"
                  ? "bg-white text-[#1F2A24] font-medium shadow-sm"
                  : "text-[#7E9088] hover:text-[#1F2A24]",
              )}
            >
              First 30 days
            </button>
            <button
              onClick={() => handleViewToggle("all")}
              className={cn(
                "px-2.5 py-1 text-[12px] rounded transition-colors",
                viewMode === "all"
                  ? "bg-white text-[#1F2A24] font-medium shadow-sm"
                  : "text-[#7E9088] hover:text-[#1F2A24]",
              )}
            >
              All tasks
            </button>
          </div>
        </div>
      )}

      {/* Tab toggle: Tasks / Calendar */}
      {!loading && generated && tasks.length > 0 && (
        <div className="flex items-center rounded-lg border border-border bg-[#F0FAF5] p-0.5 w-fit">
          <button
            onClick={() => setActiveTab("tasks")}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1",
              activeTab === "tasks" ? "bg-white text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ListChecks className="w-3.5 h-3.5 text-[#16A34A]" />
            Tasks
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1",
              activeTab === "calendar" ? "bg-white text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Calendar className="w-3.5 h-3.5 text-[#D97706]" />
            Calendar
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
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

      {/* Pre-arrival locked state — calm sage card, no big lock-bubble. */}
      {!loading && planStage && planStage !== 'arrived' && !generated && (
        <div
          className="bg-card px-4 py-4"
          style={{ border: "1px solid #DCE7DF", borderRadius: "6px" }}
        >
          <div className="flex items-start gap-2.5">
            <Lock className="w-3.5 h-3.5 text-[#7E9088] shrink-0 mt-0.5" strokeWidth={1.7} />
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-semibold text-[#1F2A24]">
                Confirm your arrival first
              </h3>
              <p className="text-[12px] text-[#4E5F57] mt-0.5">
                Your settling-in checklist will be available after you confirm arrival on the dashboard.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0 h-7 text-[11px]">
              <Link href="/dashboard">
                <ArrowLeft className="w-3 h-3 mr-1" />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Not yet generated (arrived but no checklist yet) */}
      {!loading && (!planStage || planStage === 'arrived') && !generated && !generating && (
        <div className="gm-card-static p-5 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#E4F5EB] flex items-center justify-center mx-auto">
            <ListChecks className="w-5 h-5 text-[#14532D]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Generate your settling-in checklist
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Create a personalized task list for after arriving.
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={generating} size="sm" className="bg-[#0D9488] text-white hover:bg-[#0F766E]">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Generate
          </Button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="gm-card-static p-5 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#0D9488] animate-spin mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Researching your destination...
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Gathering official requirements.
            </p>
          </div>
        </div>
      )}

      {/* Stats bar */}
      {!loading && generated && stats && (
        <div className="gm-card-static p-3 space-y-3">
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
                vaultDocs={vaultDocs}
                planId={planId}
                onVaultChange={refreshVault}
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
        <div className="gm-card-static p-4 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="text-foreground font-medium text-sm">All first 30 days tasks completed!</p>
          <button
            onClick={() => handleViewToggle("all")}
            className="text-xs text-primary hover:underline"
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
                    <ResearchProvenanceBadge
                      provenance={provenance[group.key] ?? { kind: "generic" }}
                      compact
                    />
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
                        vaultDocs={vaultDocs}
                        planId={planId}
                        onVaultChange={refreshVault}
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
        <div className="gm-card-static p-5 text-center space-y-3">
          <p className="text-muted-foreground text-sm">No tasks found.</p>
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Regenerate
          </Button>
        </div>
      )}
    </div>
  )
}
