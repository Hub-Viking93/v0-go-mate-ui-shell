/**
 * Shared freetext parsing utilities.
 * Used by: Visa Tracker (deadline estimation), Visa Renewal (milestones),
 * Plan Consistency Checks (rules 1, 4).
 */

/**
 * Parse a time range string like "4–8 weeks", "2-3 months", "6 weeks"
 * Returns { min, max } in days, or null if unparseable
 */
export function parseTimeRange(text: string): { min: number; max: number } | null {
  const rangeMatch = text.match(/(\d+)\s*[–\-–to]+\s*(\d+)\s*(week|month|day)/i)
  if (rangeMatch) {
    const unit = rangeMatch[3].toLowerCase()
    const multiplier = unit.startsWith("month") ? 30 : unit.startsWith("week") ? 7 : 1
    return { min: Number(rangeMatch[1]) * multiplier, max: Number(rangeMatch[2]) * multiplier }
  }

  const singleMatch = text.match(/(\d+)\s*(week|month|day)/i)
  if (singleMatch) {
    const unit = singleMatch[2].toLowerCase()
    const multiplier = unit.startsWith("month") ? 30 : unit.startsWith("week") ? 7 : 1
    const val = Number(singleMatch[1]) * multiplier
    return { min: val, max: val }
  }

  return null
}

/**
 * Parse a monetary amount from freetext like "€2,000/month", "$1400", "2000 EUR"
 * Returns the numeric value in the stated currency, or null if unparseable
 */
export function parseAmountFromText(text: string): number | null {
  const match = text.match(/[$€£]?\s?([\d,]+(?:\.\d{2})?)\s*(?:EUR|USD|GBP|JPY|SEK|\/month)?/i)
  if (!match) return null
  const val = Number(match[1].replace(/,/g, ""))
  return isNaN(val) ? null : val
}
