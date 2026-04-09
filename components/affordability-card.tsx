"use client"

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

  const symbol = getCurrencySymbol(userCurrency)

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
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-muted">
            <Wallet className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Affordability Check</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Add your monthly budget or income to see how it compares to living costs in {destination}.
        </p>
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
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-muted">
            <Wallet className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Affordability Check</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Cost data not available for {city || destination} yet. Check back later.
        </p>
      </Card>
    )
  }

  const costBucket = data.estimatedMonthlyBudget[householdSize]

  // Convert Numbeo values from data currency → user currency
  // If currencies match or rate unavailable, convert() returns the original value
  const needsConversion = dataCurrency !== userCurrency
  const convertedMinimum = needsConversion ? (convert(costBucket.minimum) ?? costBucket.minimum) : costBucket.minimum
  const convertedComfortable = needsConversion ? (convert(costBucket.comfortable) ?? costBucket.comfortable) : costBucket.comfortable
  const convertedSavings = savingsAvailable != null && needsConversion
    ? (convert(savingsAvailable) ?? savingsAvailable) // savings already in user currency — don't convert
    : savingsAvailable

  // Compare: budget (user currency) vs converted Numbeo values (user currency)
  const assessment: AffordabilityAssessment = computeAffordability(
    budget,
    convertedMinimum,
    convertedComfortable,
    savingsAvailable, // savings are already in user currency
  )

  const conversionFailed = needsConversion && rate === null

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold">Affordability Check</h3>
        </div>
        <Badge className={TIER_COLORS[assessment.tier]}>
          {TIER_LABELS[assessment.tier]}
        </Badge>
      </div>

      <div className="space-y-3">
        {/* Currency conversion warning */}
        {conversionFailed && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Could not fetch exchange rate ({dataCurrency}→{userCurrency}).
              Values shown in original {dataCurrency}.
            </span>
          </div>
        )}

        {/* Budget vs range — all in user currency */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-muted-foreground text-xs">Your Budget</p>
            <p className="font-semibold">
              {symbol}{budget.toLocaleString()}/mo
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-muted-foreground text-xs">Minimum Cost</p>
            <p className="font-semibold">
              {symbol}{convertedMinimum.toLocaleString()}/mo
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-muted-foreground text-xs">Comfortable</p>
            <p className="font-semibold">
              {symbol}{convertedComfortable.toLocaleString()}/mo
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
        <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Estimated — based on Numbeo averages for {data.city || destination}
            {needsConversion && rate ? `, converted at 1 ${dataCurrency} = ${rate.toFixed(2)} ${userCurrency}` : ""}.
            Your costs may vary.
          </span>
        </div>
      </div>
    </Card>
  )
}
