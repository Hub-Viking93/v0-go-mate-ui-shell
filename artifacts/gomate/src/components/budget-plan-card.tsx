

import { useMemo, useState, useCallback } from "react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  PiggyBank,
  TrendingUp,
  Calendar,
  Lightbulb,
  AlertTriangle,
  Info,
  Target,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { useCurrencyConversion } from "@/hooks/use-currency-conversion"

export interface BudgetBreakdownItem {
  category: string
  oneTime?: number
  monthly?: number
  notes?: string
}

export interface BudgetPlanData {
  currency: string
  totalSavingsTarget: number
  monthlySavingsTarget: number
  monthsUntilMove: number
  breakdown?: BudgetBreakdownItem[]
  recommendations?: string[]
}

interface BudgetPlanCardProps {
  budget: BudgetPlanData | null
  targetCity?: string | null
  targetCountry?: string | null
  homeCurrency?: string | null
  currentSavings?: number | null
  onUpdateSavings?: (amount: number) => void
}

interface Milestone {
  label: string
  amount: number
  percentage: number
}

export function BudgetPlanCard({
  budget,
  targetCity,
  targetCountry,
  homeCurrency,
  currentSavings = 0,
  onUpdateSavings,
}: BudgetPlanCardProps) {
  const destination = targetCity || targetCountry || "your destination"
  const savings = currentSavings || 0
  const totalGoal = budget?.totalSavingsTarget || 0

  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(savings.toString())

  // Currency conversion: show destination currency with home currency equivalent
  const budgetCurrency = budget?.currency || "USD"
  const { formatDual } = useCurrencyConversion(
    budgetCurrency,
    homeCurrency && homeCurrency !== budgetCurrency ? homeCurrency : null
  )
  const fmt = useCallback((amount: number) => formatDual(amount), [formatDual])
  
  const handleSave = () => {
    const amount = parseFloat(inputValue) || 0
    onUpdateSavings?.(amount)
    setIsEditing(false)
  }

  // Calculate progress
  const progressPercent = totalGoal > 0 ? Math.min((savings / totalGoal) * 100, 100) : 0
  const remaining = Math.max(totalGoal - savings, 0)

  // Calculate if timeline is realistic
  const monthlySavingsTarget = budget?.monthlySavingsTarget ?? 0
  const monthsUntilMove = budget?.monthsUntilMove ?? 0
  const monthsNeededAtCurrentRate =
    monthlySavingsTarget > 0
      ? Math.ceil(remaining / monthlySavingsTarget)
      : 0
  const isOnTrack =
    savings > 0 && (progressPercent >= 100 || monthsNeededAtCurrentRate <= monthsUntilMove)
  const needsMoreTime = monthsNeededAtCurrentRate > monthsUntilMove && savings > 0

  // Generate milestones (25%, 50%, 75%, 100%)
  const milestones: Milestone[] = useMemo(() => {
    if (totalGoal <= 0) return []
    return [
      { label: "Emergency fund covered", amount: Math.round(totalGoal * 0.25), percentage: 25 },
      { label: "Halfway there!", amount: Math.round(totalGoal * 0.5), percentage: 50 },
      { label: "Almost ready", amount: Math.round(totalGoal * 0.75), percentage: 75 },
      { label: "Fully funded!", amount: totalGoal, percentage: 100 },
    ]
  }, [totalGoal])

  // Calculate one-time vs monthly totals
  const totals = useMemo(() => {
    if (!budget?.breakdown) return { oneTime: 0, monthly: 0 }
    return budget.breakdown.reduce(
      (acc, item) => ({
        oneTime: acc.oneTime + (item.oneTime || 0),
        monthly: acc.monthly + (item.monthly || 0),
      }),
      { oneTime: 0, monthly: 0 }
    )
  }, [budget?.breakdown])

  if (!budget) {
    return (
      <div className="gm-editorial-card overflow-hidden">
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #0F172A, #334155)" }} />
        <div className="p-7">
          <span className="gm-eyebrow">Budget Plan</span>
          <h3 className="mt-3 font-sans text-foreground" style={{ fontSize: "22px", fontWeight: 600 }}>
            Budget will appear with your recommendations
          </h3>
          <p className="mt-2 text-sm text-foreground/60">
            Confirm your destination and timeline in chat to generate a tailored
            savings plan for {destination}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="gm-editorial-card overflow-hidden">
      {/* Top accent stripe */}
      <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #0F172A 0%, #334155 60%, #0D9488 100%)" }} />

      <div className="p-6 md:p-7">
        {/* Header with status badge */}
        <div className="flex items-start justify-between mb-5 gap-3">
          <div>
            <span className="gm-eyebrow">Budget Plan</span>
            <h3
              className="mt-2 font-sans text-foreground"
              style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.012em" }}
            >
              {destination}
            </h3>
          </div>
          {savings > 0 && (
            <Badge
              variant="outline"
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={
                isOnTrack
                  ? { color: "#16A34A", background: "rgba(22,163,74,0.10)", borderColor: "rgba(22,163,74,0.28)" }
                  : { color: "#D97706", background: "rgba(217,119,6,0.10)", borderColor: "rgba(217,119,6,0.28)" }
              }
            >
              {isOnTrack ? "On track" : "Needs adjustment"}
            </Badge>
          )}
        </div>

        {/* Progress Section — editorial: large serif goal + savings, gradient bar */}
        <div
          className="mb-6 p-5 rounded-2xl border"
          style={{
            background: "linear-gradient(180deg, #EEF3EC 0%, rgba(255,252,246,0.6) 100%)",
            borderColor: "rgba(35,77,58,0.16)",
          }}
        >
          <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
            <div>
              <span className="gm-label" style={{ color: "#1E293B", opacity: 0.85 }}>Savings goal</span>
              <p
                className="mt-1.5 font-sans text-foreground"
                style={{ fontSize: "32px", lineHeight: 1.05, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                {fmt(totalGoal)}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="gm-label" style={{ color: "#1E293B", opacity: 0.85 }}>Current savings</span>
                {!isEditing && onUpdateSavings && (
                  <button
                    onClick={() => {
                      setInputValue(savings.toString())
                      setIsEditing(true)
                    }}
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F172A] hover:text-[#334155] underline-offset-2 hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground/60">{budgetCurrency}</span>
                  <input
                    type="number"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-28 bg-white/80 border border-[#1E293B]/30 rounded-md px-2 py-1 text-sm font-sans font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/40"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                    placeholder="0"
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 rounded-md text-white text-xs font-semibold"
                    style={{ background: "linear-gradient(180deg, #1E293B, #0F172A)" }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setInputValue(savings.toString())
                      setIsEditing(false)
                    }}
                    className="px-3 py-1 rounded-md bg-foreground/[0.06] text-foreground/70 text-xs font-medium hover:bg-foreground/[0.10]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p
                  className="font-sans text-[#0F172A]"
                  style={{ fontSize: "26px", lineHeight: 1.05, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
                >
                  {fmt(savings)}
                </p>
              )}
            </div>
          </div>

          {/* Custom progress bar with gradient + animated fill */}
          <div className="relative h-2.5 rounded-full overflow-hidden bg-[#1E293B]/12">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, #1E293B 0%, #334155 50%, #0D9488 100%)",
                boxShadow: "0 0 12px rgba(94,232,156,0.45)",
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-foreground/60 mt-2" style={{ fontVariantNumeric: "tabular-nums" }}>
            <span>{Math.round(progressPercent)}% saved</span>
            <span>{fmt(remaining)} to go</span>
          </div>
        </div>

      {/* Timeline Warning */}
      {needsMoreTime && (
        <div className="mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Timeline Adjustment Needed
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                At your current savings rate, you&apos;ll need approximately{" "}
                {monthsNeededAtCurrentRate} months to reach your goal. Consider saving{" "}
                {fmt(Math.ceil(remaining / budget.monthsUntilMove))}/month to stay on
                track for your {budget.monthsUntilMove}-month timeline.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary tiles — warm domain tints, serif tabular numbers, top stripe */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total target", value: fmt(budget.totalSavingsTarget), accent: "#1E293B", tint: "#EEF3EC", icon: TrendingUp },
          { label: "Monthly", value: fmt(budget.monthlySavingsTarget), accent: "#16A34A", tint: "#EEF6EF", icon: Target },
          { label: "Months left", value: String(budget.monthsUntilMove), accent: "#D97706", tint: "#FBF3E5", icon: Calendar },
        ].map((tile) => {
          const Icon = tile.icon
          return (
            <div
              key={tile.label}
              className="relative overflow-hidden rounded-xl border p-4"
              style={{
                background: `linear-gradient(180deg, ${tile.tint} 0%, rgba(255,252,246,0.7) 100%)`,
                borderColor: "rgba(120,90,60,0.16)",
              }}
            >
              <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: tile.accent }} />
              <div className="flex items-center justify-between mb-2">
                <span className="gm-label" style={{ color: tile.accent, opacity: 0.85, fontSize: "10px" }}>
                  {tile.label}
                </span>
                <Icon className="w-4 h-4" style={{ color: tile.accent, opacity: 0.7 }} strokeWidth={1.6} />
              </div>
              <p
                className="font-sans text-foreground"
                style={{ fontSize: "20px", lineHeight: 1.1, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                {tile.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* Savings Milestones */}
      {milestones.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Savings Milestones</h4>
          <div className="space-y-2">
            {milestones.map((milestone, i) => {
              const achieved = savings >= milestone.amount
              return (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                      achieved ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {achieved ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm ${achieved ? "text-muted-foreground line-through" : "text-foreground"}`}
                    >
                      {milestone.label}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {fmt(milestone.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Summary */}
      {(totals.oneTime > 0 || totals.monthly > 0) && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          {totals.oneTime > 0 && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">One-time Costs</p>
              <p className="text-sm font-semibold">
                {fmt(totals.oneTime)}
              </p>
            </div>
          )}
          {totals.monthly > 0 && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Monthly Expenses</p>
              <p className="text-sm font-semibold">
                {fmt(totals.monthly)}/mo
              </p>
            </div>
          )}
        </div>
      )}

      {/* Breakdown */}
      {budget.breakdown && budget.breakdown.length > 0 && (
        <div className="space-y-2 mb-6">
          <h4 className="text-sm font-medium text-muted-foreground">Detailed Cost Breakdown</h4>
          <div className="space-y-2">
            {budget.breakdown.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.category}</p>
                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                </div>
                <div className="text-right">
                  {item.oneTime && item.oneTime > 0 && (
                    <p className="text-sm font-medium">
                      {fmt(item.oneTime)}
                      <span className="text-xs text-muted-foreground ml-1">(one-time)</span>
                    </p>
                  )}
                  {item.monthly && item.monthly > 0 && (
                    <p className="text-sm">
                      {fmt(item.monthly)}
                      <span className="text-xs text-muted-foreground ml-1">/month</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {budget.recommendations && budget.recommendations.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Savings Tips
          </h4>
          <ul className="space-y-2">
            {budget.recommendations.map((tip, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Info note */}
      <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex gap-2 items-start">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            This budget is based on average cost of living data for {destination}. Actual costs
            may vary. Research current prices before finalizing your savings plan.
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Estimates based on average costs. Research current rent, visa fees, and living expenses
          in {destination} before making financial decisions.
        </p>
      </div>
      </div>
    </div>
  )
}
