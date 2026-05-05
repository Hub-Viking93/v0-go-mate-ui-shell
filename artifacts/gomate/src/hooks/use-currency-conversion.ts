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
 * Currency conversion hook — re-enabled 2026-05.
 *
 * Calls our `/api/exchange-rate` proxy (which wraps Frankfurter with a
 * 1h server-side cache). Browser CORS is no longer an issue since we
 * go through our own server. When `from === to` or either is missing,
 * the hook becomes a passthrough (rate = 1, no network call).
 *
 * Convention:
 * - `convert(amount)` returns the amount in `toCurrency` (or null if rate
 *   isn't loaded yet)
 * - `formatDual(amount)` shows source value with converted in parens
 *   when `toCurrency` differs and rate is available
 * - `formatConverted(amount)` shows just the converted value (or source
 *   if conversion isn't possible)
 */
export function useCurrencyConversion(
  fromCurrency: string | null,
  toCurrency: string | null,
): CurrencyConversionResult {
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const fromSymbol = fromCurrency ? getCurrencySymbol(fromCurrency) : ""
  const toSymbol = toCurrency ? getCurrencySymbol(toCurrency) : ""

  const samePair =
    !fromCurrency ||
    !toCurrency ||
    fromCurrency.toUpperCase() === toCurrency.toUpperCase()

  useEffect(() => {
    let cancelled = false
    if (samePair) {
      setRate(samePair && fromCurrency && toCurrency ? 1 : null)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(
      `/api/exchange-rate?from=${encodeURIComponent(fromCurrency!)}&to=${encodeURIComponent(toCurrency!)}`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const r = typeof data?.rate === "number" ? data.rate : null
        setRate(r)
      })
      .catch(() => {
        if (!cancelled) setRate(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fromCurrency, toCurrency, samePair])

  const convert = useCallback(
    (amount: number): number | null => {
      if (samePair) return amount
      if (rate === null) return null
      return Math.round(amount * rate)
    },
    [rate, samePair],
  )

  const formatDual = useCallback(
    (amount: number): string => {
      const source = `${fromSymbol}${amount.toLocaleString()}`
      if (samePair || rate === null) return source
      const converted = Math.round(amount * rate)
      return `${source} (~${toSymbol}${converted.toLocaleString()})`
    },
    [fromSymbol, toSymbol, rate, samePair],
  )

  const formatConverted = useCallback(
    (amount: number): string => {
      if (samePair) return `${fromSymbol}${amount.toLocaleString()}`
      if (rate === null) return `${fromSymbol}${amount.toLocaleString()}`
      const converted = Math.round(amount * rate)
      return `${toSymbol}${converted.toLocaleString()}`
    },
    [fromSymbol, toSymbol, rate, samePair],
  )

  return { rate, loading, convert, formatDual, formatConverted }
}
