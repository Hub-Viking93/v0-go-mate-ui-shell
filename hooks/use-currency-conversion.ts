"use client"

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
 * Shared hook for real-time currency conversion via frankfurter.app.
 * Extracted from the working pattern in cost-of-living-card.tsx.
 *
 * @param fromCurrency - Source currency code (e.g. "EUR")
 * @param toCurrency   - Target currency code (e.g. "SEK")
 * @returns conversion helpers: rate, convert(), formatDual(), formatConverted()
 */
export function useCurrencyConversion(
  fromCurrency: string | null,
  toCurrency: string | null
): CurrencyConversionResult {
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const needsConversion =
    !!fromCurrency &&
    !!toCurrency &&
    fromCurrency !== toCurrency

  useEffect(() => {
    if (!needsConversion || !fromCurrency || !toCurrency) {
      setRate(null)
      return
    }

    setLoading(true)
    const controller = new AbortController()

    fetch(
      `https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.rates?.[toCurrency]) {
          setRate(result.rates[toCurrency])
        }
      })
      .catch(() => {
        // Fetch failed or aborted — display source currency only
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [fromCurrency, toCurrency, needsConversion])

  const convert = useCallback(
    (amount: number): number | null => {
      if (!rate) return null
      return Math.round(amount * rate)
    },
    [rate]
  )

  const fromSymbol = fromCurrency ? getCurrencySymbol(fromCurrency) : ""
  const toSymbol = toCurrency ? getCurrencySymbol(toCurrency) : ""

  const formatDual = useCallback(
    (amount: number): string => {
      const local = `${fromSymbol}${amount.toLocaleString()}`
      if (!rate || !needsConversion) return local
      const converted = Math.round(amount * rate)
      return `${local} (~${toSymbol}${converted.toLocaleString()})`
    },
    [rate, needsConversion, fromSymbol, toSymbol]
  )

  const formatConverted = useCallback(
    (amount: number): string => {
      if (!rate || !needsConversion) {
        return `${fromSymbol}${amount.toLocaleString()}`
      }
      const converted = Math.round(amount * rate)
      return `${toSymbol}${converted.toLocaleString()}`
    },
    [rate, needsConversion, fromSymbol, toSymbol]
  )

  return { rate, loading, convert, formatDual, formatConverted }
}
