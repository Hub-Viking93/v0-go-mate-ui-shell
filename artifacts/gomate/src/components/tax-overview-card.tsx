

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
  const taxInfo: TaxInfo | null = (researched as TaxInfo | null) || (hardcodedTax as TaxInfo | undefined) || null
  const isResearched = !!researched
  const stale = isResearched && researched?.researchedAt ? isStale(researched.researchedAt) : false

  // Find official tax link from OFFICIAL_SOURCES as fallback
  const officialSources = getOfficialSourcesArray(destination)
  const taxSource = officialSources.find(
    (s) => s.category === "tax" || s.name.toLowerCase().includes("tax"),
  )

  if (loading) {
    return (
      <Card className="relative overflow-hidden p-0 border-stone-200/80 dark:border-stone-800">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-stone-200 via-stone-300 to-stone-200 dark:from-stone-800 dark:via-stone-700 dark:to-stone-800 animate-pulse" />
        <div className="p-6 md:p-7 flex items-center gap-3">
          <p className="gm-eyebrow text-stone-600 dark:text-stone-400">Tax</p>
          <h3 className="font-serif text-xl text-foreground">Loading…</h3>
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />
        </div>
      </Card>
    )
  }

  if (!taxInfo) {
    return (
      <Card className="relative overflow-hidden p-0 border-stone-200/80 dark:border-stone-800">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-300 via-orange-400 to-amber-400 dark:from-amber-800 dark:via-orange-700 dark:to-amber-800" />
        <div className="p-6 md:p-7">
          <p className="gm-eyebrow mb-2 text-amber-700 dark:text-amber-400">Tax</p>
          <h3 className="font-serif text-2xl md:text-[26px] leading-tight tracking-tight text-foreground mb-2 inline-flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-600/70 dark:text-amber-500/70" />
            Tax overview for {destination}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-md">
            We don't have verified tax data for {destination} yet.
            {taxSource && (
              <>
                {" "}You can review the{" "}
                <a
                  href={taxSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  official tax authority <ExternalLink className="w-3 h-3" />
                </a>{" "}while we gather details.
              </>
            )}
          </p>
          {planId && fetchedOnce && (
            <button
              onClick={triggerResearch}
              disabled={researching}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-medium shadow-[0_4px_14px_-2px_rgba(217,119,6,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(217,119,6,0.55)] transition-shadow disabled:opacity-60"
            >
              {researching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {researching ? "Researching…" : "Research tax data"}
            </button>
          )}
        </div>
      </Card>
    )
  }

  const cur = currency || countryData?.currency || "EUR"

  if (!annualIncome) {
    return (
      <Card className="relative overflow-hidden p-0 border-stone-200/80 dark:border-stone-800">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500" />
        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="gm-eyebrow mb-1.5 text-amber-700 dark:text-amber-400">Tax</p>
              <h3 className="font-serif text-2xl md:text-[26px] leading-tight tracking-tight text-foreground inline-flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600/70 dark:text-amber-500/70" />
                Tax overview — {destination}
              </h3>
            </div>
            {isResearched && (
              <Badge variant="outline" className="text-xs shrink-0">AI-researched</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-md">
            Add your annual income to see an estimated take-home calculation for {destination}.
          </p>
          {taxInfo.specialRegimes && taxInfo.specialRegimes.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-600 dark:text-stone-400 mb-2">Special tax regimes</p>
              <div className="space-y-2">
                {taxInfo.specialRegimes.map((regime, i) => (
                  <div key={i} className="relative overflow-hidden rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/30 p-3.5">
                    <div className="absolute inset-y-0 left-0 w-[3px] bg-amber-500/70" />
                    <p className="font-serif text-base text-foreground">{regime.name}</p>
                    <p className="text-xs text-stone-700 dark:text-stone-300 mt-1 leading-relaxed">{regime.summary}</p>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1.5"><span className="font-semibold">Eligibility:</span> {regime.eligibility}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    )
  }

  const { totalTax, effectiveRate, bracketIndex } = calculateTax(annualIncome, taxInfo.incomeTaxBrackets)
  const monthlyTakeHome = (annualIncome - totalTax) / 12
  const currentBracket = taxInfo.incomeTaxBrackets[bracketIndex]

  return (
    <Card className="relative overflow-hidden p-0 border-stone-200/80 dark:border-stone-800">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500" />
      <div className="p-6 md:p-7">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <p className="gm-eyebrow mb-1.5 text-amber-700 dark:text-amber-400">Tax</p>
          <h3 className="font-serif text-2xl md:text-[26px] leading-tight tracking-tight text-foreground inline-flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-600/70 dark:text-amber-500/70" />
            Tax overview — {destination}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isResearched && (
            <Badge variant="outline" className="text-xs">AI-researched</Badge>
          )}
          <Badge variant="outline" className="text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
            Tax year {taxInfo.taxYear}
          </Badge>
        </div>
      </div>

      {/* Staleness warning */}
      {stale && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-3 mb-4">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>This tax data was researched over 30 days ago and may be outdated.</span>
          {planId && (
            <button
              onClick={triggerResearch}
              disabled={researching}
              className="ml-auto inline-flex items-center gap-1 text-amber-800 dark:text-amber-300 font-semibold hover:underline disabled:opacity-50"
            >
              {researching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {/* Take-home estimate */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="relative overflow-hidden rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 p-3.5">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-stone-400/60" />
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-600 dark:text-stone-400">Annual income</p>
            <p className="font-serif text-lg md:text-xl text-foreground mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(annualIncome, cur)}
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 p-3.5">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-emerald-500/70" />
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-emerald-700 dark:text-emerald-400">Est. monthly take-home</p>
            <p className="font-serif text-lg md:text-xl text-emerald-800 dark:text-emerald-300 mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(monthlyTakeHome, cur)}
            </p>
          </div>
        </div>

        {/* Tax details */}
        <div className="rounded-xl bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/30 dark:border-amber-900/20 p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-stone-600 dark:text-stone-400">Estimated annual tax</span>
            <span className="font-medium text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(totalTax, cur)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600 dark:text-stone-400">Effective tax rate</span>
            <span className="font-medium text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{(effectiveRate * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600 dark:text-stone-400">Marginal rate (your bracket)</span>
            <span className="font-medium text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{(currentBracket.rate * 100).toFixed(1)}%</span>
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
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-600 dark:text-stone-400 mb-2">Special tax regimes</p>
            <div className="space-y-2">
              {taxInfo.specialRegimes.map((regime, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/30 p-3.5">
                  <div className="absolute inset-y-0 left-0 w-[3px] bg-amber-500/70" />
                  <p className="font-serif text-base text-foreground">{regime.name}</p>
                  <p className="text-xs text-stone-700 dark:text-stone-300 mt-1 leading-relaxed">{regime.summary}</p>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1.5"><span className="font-semibold">Eligibility:</span> {regime.eligibility}</p>
                </div>
              ))}
            </div>
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
            {isResearched && researched?.quality === "partial" && (
              <p className="text-amber-600 mt-1">Data quality: partial (limited web sources available)</p>
            )}
            {isResearched && researched?.quality === "fallback" && (
              <p className="text-amber-600 mt-1">Data based on AI knowledge only — no web sources were available</p>
            )}
          </div>
        </div>
      </div>
      </div>
    </Card>
  )
}
