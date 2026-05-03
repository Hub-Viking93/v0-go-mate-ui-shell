/**
 * Shared isomorphic affordability computation.
 * Used by AffordabilityCard (frontend) and Plan Change Summary (Phase H backend).
 */

export type AffordabilityTier = "below_minimum" | "tight" | "comfortable" | "well_above"

export interface AffordabilityAssessment {
  tier: AffordabilityTier
  monthlyBudget: number
  minimum: number
  comfortable: number
  savingsRunwayMonths: number | null
  warnings: string[]
}

/**
 * Compute affordability assessment from user budget vs destination cost data.
 *
 * @param monthlyBudget - User's monthly budget (or income for digital nomads)
 * @param minimum - Numbeo minimum monthly cost for household size
 * @param comfortable - Numbeo comfortable monthly cost for household size
 * @param savingsAvailable - User's total savings (null if not provided or unparseable)
 */
export function computeAffordability(
  monthlyBudget: number,
  minimum: number,
  comfortable: number,
  savingsAvailable: number | null,
): AffordabilityAssessment {
  let tier: AffordabilityTier
  if (monthlyBudget < minimum) {
    tier = "below_minimum"
  } else if (monthlyBudget < comfortable) {
    tier = "tight"
  } else if (monthlyBudget < comfortable * 1.5) {
    tier = "comfortable"
  } else {
    tier = "well_above"
  }

  const savingsRunwayMonths =
    savingsAvailable != null && monthlyBudget > 0
      ? Math.floor(savingsAvailable / monthlyBudget)
      : null

  const warnings: string[] = []
  if (monthlyBudget < minimum * 1.1) {
    warnings.push("This may be tight — consider raising your budget or choosing a cheaper area")
  }
  if (savingsRunwayMonths != null && savingsRunwayMonths < 3) {
    warnings.push("Your savings cover less than 3 months — consider building a larger buffer before moving")
  }

  return { tier, monthlyBudget, minimum, comfortable, savingsRunwayMonths, warnings }
}

export const TIER_LABELS: Record<AffordabilityTier, string> = {
  below_minimum: "Below Minimum",
  tight: "Tight",
  comfortable: "Comfortable",
  well_above: "Well Above",
}

export const TIER_COLORS: Record<AffordabilityTier, string> = {
  below_minimum: "text-red-600 bg-red-50 border-red-200",
  tight: "text-amber-600 bg-amber-50 border-amber-200",
  comfortable: "text-emerald-600 bg-emerald-50 border-emerald-200",
  well_above: "text-blue-600 bg-blue-50 border-blue-200",
}
