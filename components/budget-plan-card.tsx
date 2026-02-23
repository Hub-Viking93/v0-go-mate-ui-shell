"use client"

import { useMemo, useState } from "react"
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
  currentSavings = 0,
  onUpdateSavings,
}: BudgetPlanCardProps) {
  const destination = targetCity || targetCountry || "your destination"
  const savings = currentSavings || 0
  const totalGoal = budget?.totalSavingsTarget || 0
  
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(savings.toString())
  
  const handleSave = () => {
    const amount = parseFloat(inputValue) || 0
    onUpdateSavings?.(amount)
    setIsEditing(false)
  }

  // Calculate progress
  const progressPercent = totalGoal > 0 ? Math.min((savings / totalGoal) * 100, 100) : 0
  const remaining = Math.max(totalGoal - savings, 0)

  // Calculate if timeline is realistic
  const monthsNeededAtCurrentRate =
    budget?.monthlySavingsTarget > 0
      ? Math.ceil(remaining / budget.monthlySavingsTarget)
      : 0
  const isOnTrack =
    savings > 0 && (progressPercent >= 100 || monthsNeededAtCurrentRate <= budget?.monthsUntilMove)
  const needsMoreTime = monthsNeededAtCurrentRate > budget?.monthsUntilMove && savings > 0

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
      <div className="gm-card-static p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-primary" />
          Budget Plan
        </h3>
        <p className="text-muted-foreground text-center py-6">
          Budget plan will be generated with your recommendations
        </p>
      </div>
    )
  }

  return (
    <div className="gm-card-static p-6">
      {/* Header with status badge */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-primary" />
          Budget Plan for {destination}
        </h3>
        {savings > 0 && (
          <Badge
            variant="outline"
            className={
              isOnTrack
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
            }
          >
            {isOnTrack ? "On Track" : "Needs Adjustment"}
          </Badge>
        )}
      </div>

      {/* Progress Section */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Savings Goal</p>
            <p className="text-2xl font-semibold text-foreground font-mono tracking-tight">
              {budget.currency} {totalGoal.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 mb-1">
              <p className="text-xs text-muted-foreground">Current Savings</p>
              {!isEditing && onUpdateSavings && (
                <button 
                  onClick={() => {
                    setInputValue(savings.toString())
                    setIsEditing(true)
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">{budget.currency}</span>
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-24 bg-background border border-border rounded px-2 py-1 text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0"
                  autoFocus
                />
                <button 
                  onClick={handleSave}
                  className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90"
                >
                  Save
                </button>
                <button 
                  onClick={() => {
                    setInputValue(savings.toString())
                    setIsEditing(false)
                  }}
                  className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs font-medium hover:bg-secondary/80"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p className="text-lg font-semibold text-primary">
                {budget.currency} {savings.toLocaleString()}
              </p>
            )}
          </div>
        </div>
        <Progress value={progressPercent} className="h-3 mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(progressPercent)}% saved</span>
          <span>
            {budget.currency} {remaining.toLocaleString()} to go
          </span>
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
                {budget.currency}{" "}
                {Math.ceil(remaining / budget.monthsUntilMove).toLocaleString()}/month to stay on
                track for your {budget.monthsUntilMove}-month timeline.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 rounded-xl bg-primary/10 text-center">
          <TrendingUp className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Total Target</p>
          <p className="text-lg font-bold text-primary">
            {budget.currency} {budget.totalSavingsTarget.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-500/10 text-center border border-emerald-500/20">
          <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Monthly Target</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {budget.currency} {budget.monthlySavingsTarget.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 text-center border border-blue-500/20">
          <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Months Left</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
            {budget.monthsUntilMove}
          </p>
        </div>
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
                    {budget.currency} {milestone.amount.toLocaleString()}
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
                {budget.currency} {totals.oneTime.toLocaleString()}
              </p>
            </div>
          )}
          {totals.monthly > 0 && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Monthly Expenses</p>
              <p className="text-sm font-semibold">
                {budget.currency} {totals.monthly.toLocaleString()}/mo
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
                      {budget.currency} {item.oneTime.toLocaleString()}
                      <span className="text-xs text-muted-foreground ml-1">(one-time)</span>
                    </p>
                  )}
                  {item.monthly && item.monthly > 0 && (
                    <p className="text-sm">
                      {budget.currency} {item.monthly.toLocaleString()}
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
  )
}
