

import { useState, useEffect, useCallback } from "react"
import { getCurrencySymbol } from "@/lib/gomate/currency"

interface CurrencyConversionResult {
  rate: number | null
  loading: boolean
  convert: (amount: number) => number | null
  formatDual: (amount: number) => string
  formatConverted: (amount: number) => string
}

/**
 * Currency conversion hook — DISABLED for the buildathon (2026-05-03).
 *
 * Why: the previous implementation called `api.frankfurter.app` directly
 * from the browser. That endpoint has no CORS headers, so every request
 * was blocked, the rate stayed null, and downstream cards displayed
 * inconsistent / partial values.
 *
 * Behavior now: we ALWAYS render the source currency as-is. `convert()`
 * is a no-op (returns the amount unchanged), `formatDual` and
 * `formatConverted` only emit the source currency string. No network
 * call. `loading` is always false.
 *
 * To re-enable: route conversions through the api-server (e.g.
 * `/api/exchange-rate?from=EUR&to=PHP`) which already has the
 * server-side `lib/gomate/exchange-rate.ts` utility and no CORS issue.
 */
export function useCurrencyConversion(
  fromCurrency: string | null,
  _toCurrency: string | null,
): CurrencyConversionResult {
  // Reference unused params so noUnusedParameters compiles cleanly.
  void _toCurrency

  const fromSymbol = fromCurrency ? getCurrencySymbol(fromCurrency) : ""

  const convert = useCallback(
    (amount: number): number | null => amount,
    [],
  )

  const formatDual = useCallback(
    (amount: number): string => `${fromSymbol}${amount.toLocaleString()}`,
    [fromSymbol],
  )

  const formatConverted = useCallback(
    (amount: number): string => `${fromSymbol}${amount.toLocaleString()}`,
    [fromSymbol],
  )

  return { rate: null, loading: false, convert, formatDual, formatConverted }
}
