

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, TrendingUp, Wallet, Info } from "lucide-react"
import {
  computeAffordability,
  TIER_LABELS,
  TIER_COLORS,
  type AffordabilityAssessment,
} from "@/lib/gomate/affordability"
import { getCurrencySymbol } from "@/lib/gomate/currency"
import { useCurrencyConversion } from "@/hooks/use-currency-conversion"
import type { NumbeoData } from "@/lib/gomate/numbeo-scraper"
import { AuditIcon } from "@/components/audit-icon"

interface AffordabilityCardProps {
  monthlyBudget: number | null
  monthlyIncome: number | null
  savingsAvailable: number | null
  destination: string
  city?: string
  householdSize: "single" | "couple" | "family4"
  numbeoData?: NumbeoData | null
  /** Resolved user currency (from resolveUserCurrency) */
  userCurrency: string
}

export function AffordabilityCard({
  monthlyBudget,
  monthlyIncome,
  savingsAvailable,
  destination,
  city,
  householdSize,
  numbeoData,
  userCurrency,
}: AffordabilityCardProps) {
  const [data, setData] = useState<NumbeoData | null>(numbeoData || null)
  const [loading, setLoading] = useState(!numbeoData)
  const [error, setError] = useState(false)

  const dataCurrency = data?.currency || "USD"
  const { rate, loading: rateLoading, convert } = useCurrencyConversion(dataCurrency, userCurrency)

  // Symbol now follows the source currency since we no longer convert.
  const symbol = getCurrencySymbol(data?.currency || userCurrency)

  useEffect(() => {
    if (numbeoData) {
      setData(numbeoData)
      setLoading(false)
      return
    }
    async function fetchCost() {
      try {
        const params = new URLSearchParams({ country: destination })
        if (city) params.set("city", city)
        const res = await fetch(`/api/cost-of-living?${params}`)
        if (res.ok) {
          const json = await res.json()
          if (json.numbeoData) setData(json.numbeoData)
          else if (json.estimatedMonthlyBudget) setData(json as NumbeoData)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchCost()
  }, [destination, city, numbeoData])

  const budget = monthlyBudget || monthlyIncome
  if (!budget) {
    return (
      <Card className="relative overflow-hidden p-0 border-stone-200/80 dark:border-stone-800">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500" />
        <div className="p-6 md:p-7">
          <p className="gm-eyebrow mb-2 text-emerald-700 dark:text-emerald-400">Affordability</p>
          <h3 className="font-serif text-2xl md:text-[26px] leading-tight tracking-tight text-foreground mb-2">
            See if {destination} fits your budget
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-md">
            Add your monthly budget or income — we'll compare it to real cost-of-living data for {destination} so you know exactly where you'd land.
          </p>
          <a
            href="/profile"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium shadow-[0_4px_14px_-2px_rgba(16,185,129,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(16,185,129,0.55)] transition-shadow"
          >
            <Wallet className="w-4 h-4" />
            Add your budget
          </a>
        </div>
      </Card>
    )
  }

  if (loading || rateLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="relative overflow-hidden p-0 border-stone-200/80 dark:border-stone-800">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-stone-300 via-amber-300 to-stone-300 dark:from-stone-700 dark:via-amber-800 dark:to-stone-700" />
        <div className="p-6 md:p-7">
          <p className="gm-eyebrow mb-2 text-stone-600 dark:text-stone-400">Affordability</p>
          <h3 className="font-serif text-xl tracking-tight text-foreground mb-2">
            Cost data not available yet
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We don't have living-cost data for {city || destination} just yet. Check back soon.
          </p>
        </div>
      </Card>
    )
  }

  const costBucket = data.estimatedMonthlyBudget?.[householdSize] ?? { minimum: 0, comfortable: 0 }

  // Currency conversion DISABLED — see
  // hooks/use-currency-conversion.ts for the rationale. We render
  // every amount in the source (data) currency. The visible "symbol"
  // therefore tracks dataCurrency, not the user's preferred currency,
  // until we land a server-side exchange-rate proxy.
  void convert
  void rate
  void userCurrency
  const convertedMinimum = costBucket.minimum
  const convertedComfortable = costBucket.comfortable
  const convertedSavings = savingsAvailable

  const assessment: AffordabilityAssessment = computeAffordability(
    budget,
    convertedMinimum,
    convertedComfortable,
    savingsAvailable,
  )

  const conversionFailed = false

  // Tier color mapping for top stripe
  const TIER_STRIPE: Record<string, string> = {
    comfortable: "bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500",
    tight: "bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500",
    insufficient: "bg-gradient-to-r from-rose-400 via-red-500 to-rose-500",
  }
  const stripeClass = TIER_STRIPE[assessment.tier] || TIER_STRIPE.comfortable

  return (
    <Card className="relative overflow-hidden p-0 border-stone-200/80 dark:border-stone-800">
      <div className={`absolute inset-x-0 top-0 h-[3px] ${stripeClass}`} />
      <div className="p-6 md:p-7">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="gm-eyebrow mb-1.5 text-emerald-700 dark:text-emerald-400">Affordability</p>
            <h3 className="font-serif text-2xl md:text-[26px] leading-tight tracking-tight text-foreground inline-flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600/70 dark:text-emerald-500/70" />
              How {destination} fits your budget
            </h3>
          </div>
          <Badge className={`${TIER_COLORS[assessment.tier]} shrink-0`}>
            {TIER_LABELS[assessment.tier]}
          </Badge>
        </div>

      <div className="space-y-4">
        {/* Currency conversion warning */}
        {conversionFailed && (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-3">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Could not fetch exchange rate ({dataCurrency}→{userCurrency}).
              Values shown in original {dataCurrency}.
            </span>
          </div>
        )}

        {/* Budget vs range tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="relative overflow-hidden rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-900/30 p-3.5">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-emerald-400/60" />
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-emerald-700 dark:text-emerald-400">Your Budget</p>
            <p className="font-serif text-lg md:text-xl text-foreground mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>
              {symbol}{budget.toLocaleString()}
              <span className="text-xs font-sans text-muted-foreground font-normal">/mo</span>
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 p-3.5">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-stone-400/60" />
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-600 dark:text-stone-400">Minimum</p>
            <p className="font-serif text-lg md:text-xl text-foreground mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>
              {symbol}{convertedMinimum.toLocaleString()}
              <span className="text-xs font-sans text-muted-foreground font-normal">/mo</span>
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/30 p-3.5">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-amber-400/60" />
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
              Comfortable
              <AuditIcon size="xs" outputKey={`cost_of_living.0`} label="Audit trail for comfortable cost estimate" />
            </p>
            <p className="font-serif text-lg md:text-xl text-foreground mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>
              {symbol}{convertedComfortable.toLocaleString()}
              <span className="text-xs font-sans text-muted-foreground font-normal">/mo</span>
            </p>
          </div>
        </div>

        {/* Savings runway */}
        {assessment.savingsRunwayMonths != null && (
          <p className="text-sm text-muted-foreground">
            Your savings cover approximately <span className="font-medium text-foreground">{assessment.savingsRunwayMonths} months</span> of expenses.
          </p>
        )}

        {/* Warnings */}
        {assessment.warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{w}</span>
          </div>
        ))}

        {/* Disclaimer */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2 border-t border-dashed border-stone-200 dark:border-stone-800">
          <Info className="w-3.5 h-3.5 mt-2.5 flex-shrink-0" />
          <span className="pt-2 leading-relaxed">
            Estimated — based on Numbeo averages for {data.city || destination} in {dataCurrency}.
            Your costs may vary.
          </span>
        </div>
      </div>
      </div>
    </Card>
  )
}
