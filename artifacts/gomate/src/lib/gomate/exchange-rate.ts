/**
 * Server-side currency exchange rate utility.
 * Uses frankfurter.app (same API as the frontend useCurrencyConversion hook).
 */

import { fetchWithRetry } from "./fetch-with-retry"

// In-request cache to avoid duplicate API calls within a single guide generation
// This is acceptable in serverless — it only lives for the duration of one request
const requestCache = new Map<string, number>()

/**
 * Get exchange rate from one currency to another.
 * Returns the multiplier (e.g., EUR→PHP = ~62) or null on failure.
 */
export async function getExchangeRate(
  from: string,
  to: string
): Promise<number | null> {
  if (!from || !to || from === to) return 1

  const cacheKey = `${from}:${to}`
  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey)!
  }

  try {
    const response = await fetchWithRetry(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      {},
      10_000,
      2
    )

    if (!response.ok) {
      console.error(`[GoMate][ExchangeRate] Failed to fetch ${from}→${to}: HTTP ${response.status}`)
      return null
    }

    const data = await response.json()
    const rate = data?.rates?.[to]
    if (typeof rate !== "number") {
      console.error(`[GoMate][ExchangeRate] No rate found for ${from}→${to}`)
      return null
    }

    requestCache.set(cacheKey, rate)
    return rate
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[GoMate][ExchangeRate] Error fetching ${from}→${to}:`, msg)
    return null
  }
}

/**
 * Convert a numeric value from one currency to another.
 * Returns the original value if conversion fails (graceful degradation).
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  const rate = await getExchangeRate(from, to)
  if (rate === null) return amount
  return Math.round(amount * rate)
}
