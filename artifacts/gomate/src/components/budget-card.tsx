

import React from "react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  DollarSign,
  Home,
  Zap,
  ShoppingCart,
  Bus,
  Wifi,
  PiggyBank,
  Plane,
  Key,
  FileText
} from "lucide-react"
import { getCurrencySymbol } from "@/lib/gomate/currency"

interface BudgetData {
  minimum: number
  comfortable: number
  breakdown: Record<string, number>
}

interface SavingsData {
  emergencyFund: number
  movingCosts: number
  initialSetup: number
  visaFees: number
  total: number
  timeline: string
}

interface BudgetCardProps {
  budget: BudgetData
  savings: SavingsData
  destination: string
  /** ISO 4217 currency code for all displayed values (e.g. "EUR", "SEK") */
  currency: string
  currentSavings?: number
  onUpdateSavings?: (amount: number) => void
}

const breakdownIcons: Record<string, React.ReactNode> = {
  rent: <Home className="w-4 h-4" />,
  utilities: <Zap className="w-4 h-4" />,
  groceries: <ShoppingCart className="w-4 h-4" />,
  transportation: <Bus className="w-4 h-4" />,
  internet: <Wifi className="w-4 h-4" />,
  miscellaneous: <DollarSign className="w-4 h-4" />,
}

const savingsIcons: Record<string, React.ReactNode> = {
  emergencyFund: <PiggyBank className="w-4 h-4" />,
  movingCosts: <Plane className="w-4 h-4" />,
  initialSetup: <Key className="w-4 h-4" />,
  visaFees: <FileText className="w-4 h-4" />,
}

export function BudgetCard({ budget, savings, destination, currency, currentSavings = 0, onUpdateSavings }: BudgetCardProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(currentSavings.toString())

  const sym = getCurrencySymbol(currency)
  const savingsProgress = Math.min(Math.round((currentSavings / savings.total) * 100), 100)
  const remaining = Math.max(savings.total - currentSavings, 0)

  const handleSave = () => {
    const amount = parseFloat(inputValue) || 0
    onUpdateSavings?.(amount)
    setIsEditing(false)
  }

  return (
    <div className="space-y-4">
      {/* Monthly Budget */}
      <Card className="p-4 bg-card/80 border-border">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Monthly Budget for {destination}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-1">Minimum</p>
            <p className="text-lg font-semibold text-foreground font-mono tracking-tight">
              {sym}{budget.minimum.toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Comfortable</p>
            <p className="text-lg font-semibold text-primary font-mono tracking-tight">
              {sym}{budget.comfortable.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Breakdown</p>
          {Object.entries(budget.breakdown).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
            >
              <div className="flex items-center gap-2 text-sm text-foreground">
                <span className="text-muted-foreground">
                  {breakdownIcons[key] || <DollarSign className="w-4 h-4" />}
                </span>
                <span className="capitalize">{key}</span>
              </div>
              <span className="text-sm font-medium text-foreground font-mono">
                {sym}{value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Savings Target */}
      <Card className="p-4 bg-card/80 border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Savings Target</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {sym}{savings.total.toLocaleString()} total
          </Badge>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              {savingsIcons.emergencyFund}
              <span>Emergency fund (3 mo)</span>
            </div>
            <span className="font-medium text-foreground font-mono">
              {sym}{savings.emergencyFund.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              {savingsIcons.movingCosts}
              <span>Moving costs</span>
            </div>
            <span className="font-medium text-foreground font-mono">
              {sym}{savings.movingCosts.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              {savingsIcons.initialSetup}
              <span>Initial setup</span>
            </div>
            <span className="font-medium text-foreground font-mono">
              {sym}{savings.initialSetup.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              {savingsIcons.visaFees}
              <span>Visa fees</span>
            </div>
            <span className="font-medium text-foreground font-mono">
              {sym}{savings.visaFees.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Current savings input */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Your current savings</span>
              {!isEditing && onUpdateSavings && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">{sym}</span>
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 bg-background border border-border rounded px-2 py-1 text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0"
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setInputValue(currentSavings.toString())
                    setIsEditing(false)
                  }}
                  className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm font-medium hover:bg-secondary/80"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p className="text-lg font-bold text-foreground">
                {sym}{currentSavings.toLocaleString()}
              </p>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress to goal</span>
            <span className={`font-mono ${savingsProgress >= 100 ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
              {savingsProgress}%
            </span>
          </div>
          <Progress value={savingsProgress} className="h-2" />

          {/* Remaining amount */}
          {remaining > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{sym}{remaining.toLocaleString()}</span> left to save
              {savings.timeline && ` · ${savings.timeline}`}
            </p>
          ) : (
            <p className="text-xs text-green-600 font-medium">
              Goal reached! You're ready to make your move.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
