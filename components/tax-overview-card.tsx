"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Receipt, ExternalLink, AlertTriangle, RefreshCw, Loader2 } from "lucide-react"
import { COUNTRY_DATA } from "@/lib/gomate/guide-generator"
import { getOfficialSourcesArray } from "@/lib/gomate/official-sources"
import { getCurrencySymbol } from "@/lib/gomate/currency"
import type { TaxResearchResult } from "@/lib/gomate/tax-research"

interface TaxOverviewCardProps {
  destination: string
  annualIncome: number | null
  currency?: string
  planId?: string
}

type TaxInfo = {
  incomeTaxBrackets: { upTo: number | null; rate: number }[]
  socialContributions: string
  specialRegimes?: { name: string; summary: string; eligibility: string }[]
  taxYear: string
  filingDeadline: string
  disclaimer: string
  officialLink: string
  lastVerified: string
}

/**
 * Progressive marginal tax calculation.
 * Walk the brackets: for each, tax the portion of income within that bracket at its rate.
 */
function calculateTax(
  annualIncome: number,
  brackets: { upTo: number | null; rate: number }[],
): { totalTax: number; effectiveRate: number; bracketIndex: number } {
  let totalTax = 0
  let prevCeiling = 0
  let bracketIndex = 0

  for (let i = 0; i < brackets.length; i++) {
    const { upTo, rate } = brackets[i]
    const ceiling = upTo ?? Infinity
    if (annualIncome <= prevCeiling) break
    const taxableInBracket = Math.min(annualIncome, ceiling) - prevCeiling
    totalTax += taxableInBracket * rate
    bracketIndex = i
    prevCeiling = ceiling
    if (annualIncome <= ceiling) break
  }

  const effectiveRate = annualIncome > 0 ? totalTax / annualIncome : 0
  return { totalTax, effectiveRate, bracketIndex }
}

function formatCurrency(amount: number, currency: string): string {
  const sym = getCurrencySymbol(currency)
  return `${sym}${Math.round(amount).toLocaleString()}`
}

function isStale(researchedAt: string, thresholdDays = 30): boolean {
  const diff = Date.now() - new Date(researchedAt).getTime()
  return diff > thresholdDays * 24 * 60 * 60 * 1000
}

export function TaxOverviewCard({ destination, annualIncome, currency, planId }: TaxOverviewCardProps) {
  const [researched, setResearched] = useState<TaxResearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [researching, setResearching] = useState(false)
  const [fetchedOnce, setFetchedOnce] = useState(false)

  // Fetch existing tax research from DB
  useEffect(() => {
    if (!planId) return
    setLoading(true)
    fetch(`/api/research/tax?planId=${planId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.research) setResearched(data.research)
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setFetchedOnce(true) })
  }, [planId])

  const triggerResearch = useCallback(async () => {
    if (!planId || researching) return
    setResearching(true)
    try {
      const res = await fetch("/api/research/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.research) setResearched(data.research)
      }
    } catch {
      // silent — user sees no change
    } finally {
      setResearching(false)
    }
  }, [planId, researching])

  // Use researched data if available, otherwise fall back to COUNTRY_DATA
  const countryData = COUNTRY_DATA[destination]
  const hardcodedTax = countryData?.taxInfo
  const taxInfo: TaxInfo | null = researched || hardcodedTax || null
  const isResearched = !!researched
  const stale = isResearched && researched.researchedAt ? isStale(researched.researchedAt) : false

  // Find official tax link from OFFICIAL_SOURCES as fallback
  const officialSources = getOfficialSourcesArray(destination)
  const taxSource = officialSources.find(
    (s) => s.category === "tax" || s.name.toLowerCase().includes("tax"),
  )

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Receipt className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Tax Overview</h3>
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />
        </div>
      </Card>
    )
  }

  if (!taxInfo) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-muted">
            <Receipt className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Tax Overview</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Tax data not yet available for {destination}.
          {taxSource && (
            <>
              {" "}Check the{" "}
              <a
                href={taxSource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                official tax authority <ExternalLink className="w-3 h-3" />
              </a>.
            </>
          )}
        </p>
        {planId && fetchedOnce && (
          <button
            onClick={triggerResearch}
            disabled={researching}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50"
          >
            {researching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {researching ? "Researching..." : "Research tax data"}
          </button>
        )}
      </Card>
    )
  }

  const cur = currency || countryData?.currency || "EUR"

  if (!annualIncome) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold">Tax Overview — {destination}</h3>
          {isResearched && (
            <Badge variant="outline" className="text-xs ml-auto">AI-researched</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Add your monthly income to see an estimated take-home calculation for {destination}.
        </p>
        {taxInfo.specialRegimes && taxInfo.specialRegimes.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Special Tax Regimes</h4>
            {taxInfo.specialRegimes.map((regime, i) => (
              <div key={i} className="p-3 rounded-lg bg-blue-50 border border-blue-200 mb-2">
                <p className="font-medium text-sm text-blue-800">{regime.name}</p>
                <p className="text-xs text-blue-700 mt-1">{regime.summary}</p>
                <p className="text-xs text-blue-600 mt-1"><strong>Eligibility:</strong> {regime.eligibility}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    )
  }

  const { totalTax, effectiveRate, bracketIndex } = calculateTax(annualIncome, taxInfo.incomeTaxBrackets)
  const monthlyTakeHome = (annualIncome - totalTax) / 12
  const currentBracket = taxInfo.incomeTaxBrackets[bracketIndex]

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold">Tax Overview — {destination}</h3>
        </div>
        <div className="flex items-center gap-2">
          {isResearched && (
            <Badge variant="outline" className="text-xs">AI-researched</Badge>
          )}
          <Badge variant="outline" className="text-xs">
            Tax year: {taxInfo.taxYear}
          </Badge>
        </div>
      </div>

      {/* Staleness warning */}
      {stale && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-4">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>This tax data was researched over 30 days ago and may be outdated.</span>
          {planId && (
            <button
              onClick={triggerResearch}
              disabled={researching}
              className="ml-auto inline-flex items-center gap-1 text-amber-800 font-medium hover:underline disabled:opacity-50"
            >
              {researching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {/* Take-home estimate */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-muted-foreground text-xs">Annual Income</p>
            <p className="font-semibold">{formatCurrency(annualIncome, cur)}</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <p className="text-emerald-600 text-xs">Est. Monthly Take-Home</p>
            <p className="font-semibold text-emerald-700">{formatCurrency(monthlyTakeHome, cur)}</p>
          </div>
        </div>

        {/* Tax details */}
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated annual tax</span>
            <span className="font-medium">{formatCurrency(totalTax, cur)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Effective tax rate</span>
            <span className="font-medium">{(effectiveRate * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Marginal rate (your bracket)</span>
            <span className="font-medium">{(currentBracket.rate * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Tax brackets */}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            View all tax brackets
          </summary>
          <div className="mt-2 space-y-1">
            {taxInfo.incomeTaxBrackets.map((bracket, i) => (
              <div
                key={i}
                className={`flex justify-between p-2 rounded text-xs ${i === bracketIndex ? "bg-primary/10 font-medium" : "bg-muted/30"}`}
              >
                <span>
                  {i === 0 ? "Up to" : "From"}{" "}
                  {i > 0 ? formatCurrency(taxInfo.incomeTaxBrackets[i - 1].upTo!, cur) : "0"}
                  {bracket.upTo ? ` to ${formatCurrency(bracket.upTo, cur)}` : "+"}
                </span>
                <span>{(bracket.rate * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </details>

        {/* Social contributions */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <strong>Social contributions:</strong> {taxInfo.socialContributions}
        </div>

        {/* Special regimes */}
        {taxInfo.specialRegimes && taxInfo.specialRegimes.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Special Tax Regimes</h4>
            {taxInfo.specialRegimes.map((regime, i) => (
              <div key={i} className="p-3 rounded-lg bg-blue-50 border border-blue-200 mb-2">
                <p className="font-medium text-sm text-blue-800">{regime.name}</p>
                <p className="text-xs text-blue-700 mt-1">{regime.summary}</p>
                <p className="text-xs text-blue-600 mt-1"><strong>Eligibility:</strong> {regime.eligibility}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filing info */}
        <div className="text-xs text-muted-foreground">
          <strong>Filing deadline:</strong> {taxInfo.filingDeadline}
        </div>

        {/* Disclaimer + official link + research controls */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
          <div className="flex-1">
            <p>{taxInfo.disclaimer}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {(taxInfo.officialLink || taxSource?.url) && (
                <a
                  href={taxInfo.officialLink || taxSource?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Official tax authority <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <span className="text-muted-foreground/60">
                {isResearched ? "Researched" : "Rates verified"}:{" "}
                {new Date(taxInfo.lastVerified).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              {planId && !stale && (
                <button
                  onClick={triggerResearch}
                  disabled={researching}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {researching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {researching ? "Researching..." : "Refresh"}
                </button>
              )}
            </div>
            {isResearched && researched.quality === "partial" && (
              <p className="text-amber-600 mt-1">Data quality: partial (limited web sources available)</p>
            )}
            {isResearched && researched.quality === "fallback" && (
              <p className="text-amber-600 mt-1">Data based on AI knowledge only — no web sources were available</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
