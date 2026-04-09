/**
 * Plan Change Summary Engine
 *
 * Computes downstream effects when a user changes key profile fields
 * after a guide has already been generated. Uses the guide's
 * profile_snapshot as the "old" state for comparison.
 */

import { computeAffordability, type AffordabilityTier, TIER_LABELS } from "./affordability"

export type PlanChangeEffect = {
  area: "timeline" | "budget" | "visa" | "tasks" | "documents" | "guide"
  description: string
  severity: "info" | "attention" | "action_required"
}

export type PlanChangeSummary = {
  changedFields: string[]
  effects: PlanChangeEffect[]
  guideNeedsRegeneration: boolean
  previousSnapshot: Record<string, unknown> | null
}

const TRACKED_FIELDS = new Set([
  "destination",
  "destination_city",
  "citizenship",
  "arrival_date",
  "target_date",
  "monthly_budget",
  "monthly_income",
  "savings_available",
  "moving_alone",
  "children_count",
  "employment_type",
  "visa_type",
])

interface NumbeoMinMax {
  minimum?: number
  comfortable?: number
}

export function computePlanChangeSummary(
  oldProfile: Record<string, unknown> | null,
  newProfile: Record<string, unknown>,
  numbeoData?: { estimatedMonthlyBudget?: { single?: NumbeoMinMax } } | null,
): PlanChangeSummary | null {
  if (!oldProfile) return null

  const changedFields: string[] = []
  for (const field of TRACKED_FIELDS) {
    const oldVal = oldProfile[field]
    const newVal = newProfile[field]
    if (stringify(oldVal) !== stringify(newVal)) {
      changedFields.push(field)
    }
  }

  if (changedFields.length === 0) return null

  const effects: PlanChangeEffect[] = []
  let guideNeedsRegeneration = false

  // Destination changed — everything is stale
  if (changedFields.includes("destination")) {
    guideNeedsRegeneration = true
    effects.push({
      area: "guide",
      description: "Your destination changed — your guide, visa research, and local requirements are no longer valid.",
      severity: "action_required",
    })
    effects.push({
      area: "visa",
      description: "Visa requirements differ by country. Your previous visa research no longer applies.",
      severity: "action_required",
    })
    effects.push({
      area: "tasks",
      description: "Post-arrival tasks may differ for your new destination.",
      severity: "attention",
    })
  }

  // Destination city changed
  if (changedFields.includes("destination_city") && !changedFields.includes("destination")) {
    guideNeedsRegeneration = true
    effects.push({
      area: "guide",
      description: "Your destination city changed. Cost of living data and local recommendations will be updated.",
      severity: "attention",
    })
  }

  // Citizenship changed
  if (changedFields.includes("citizenship")) {
    guideNeedsRegeneration = true
    effects.push({
      area: "visa",
      description: "Your citizenship changed — visa eligibility and requirements may be completely different.",
      severity: "action_required",
    })
  }

  // Arrival date changed
  if (changedFields.includes("arrival_date")) {
    const oldDate = oldProfile.arrival_date as string | undefined
    const newDate = newProfile.arrival_date as string | undefined
    if (oldDate && newDate) {
      const delta = daysBetween(oldDate, newDate)
      if (delta !== 0) {
        effects.push({
          area: "timeline",
          description: `Your arrival date shifted by ${Math.abs(delta)} days ${delta > 0 ? "later" : "earlier"}. All post-arrival deadlines will adjust accordingly.`,
          severity: "attention",
        })
      }
    }
  }

  // Target date changed
  if (changedFields.includes("target_date")) {
    const oldDate = oldProfile.target_date as string | undefined
    const newDate = newProfile.target_date as string | undefined
    if (oldDate && newDate) {
      const delta = daysBetween(oldDate, newDate)
      if (delta !== 0) {
        effects.push({
          area: "timeline",
          description: `Your move date shifted by ${Math.abs(delta)} days ${delta > 0 ? "later" : "earlier"}. Pre-move timeline milestones will shift.`,
          severity: "attention",
        })
      }
    }
  }

  // Budget changed
  if (changedFields.includes("monthly_budget")) {
    const oldBudget = parseFloat(String(oldProfile.monthly_budget || ""))
    const newBudget = parseFloat(String(newProfile.monthly_budget || ""))

    if (!isNaN(oldBudget) && !isNaN(newBudget) && numbeoData?.estimatedMonthlyBudget?.single) {
      const { minimum = 0, comfortable = 0 } = numbeoData.estimatedMonthlyBudget.single
      if (minimum > 0) {
        const oldAssessment = computeAffordability(oldBudget, minimum, comfortable, null)
        const newAssessment = computeAffordability(newBudget, minimum, comfortable, null)
        if (oldAssessment.tier !== newAssessment.tier) {
          effects.push({
            area: "budget",
            description: `Your affordability changed from "${TIER_LABELS[oldAssessment.tier]}" to "${TIER_LABELS[newAssessment.tier]}".`,
            severity: newAssessment.tier === "below_minimum" ? "action_required" : "info",
          })
        } else {
          effects.push({
            area: "budget",
            description: `Your monthly budget changed from ${oldBudget.toLocaleString()} to ${newBudget.toLocaleString()}.`,
            severity: "info",
          })
        }
      }
    }
    guideNeedsRegeneration = true
  }

  // Income changed
  if (changedFields.includes("monthly_income")) {
    effects.push({
      area: "budget",
      description: "Your income changed. This may affect visa eligibility checks.",
      severity: "info",
    })
    guideNeedsRegeneration = true
  }

  // Family size changed
  if (changedFields.includes("moving_alone") || changedFields.includes("children_count")) {
    effects.push({
      area: "budget",
      description: "Your household size changed. Budget calculations and housing recommendations will update.",
      severity: "info",
    })
    guideNeedsRegeneration = true
  }

  // Employment type changed
  if (changedFields.includes("employment_type")) {
    effects.push({
      area: "visa",
      description: "Your employment type changed. Visa eligibility and tax obligations may differ.",
      severity: "attention",
    })
    guideNeedsRegeneration = true
  }

  // Visa type changed
  if (changedFields.includes("visa_type")) {
    effects.push({
      area: "visa",
      description: "Your selected visa type changed. Requirements and processing times will update.",
      severity: "attention",
    })
    guideNeedsRegeneration = true
  }

  // Savings changed
  if (changedFields.includes("savings_available")) {
    effects.push({
      area: "budget",
      description: "Your savings amount changed. Your financial runway calculation will update.",
      severity: "info",
    })
  }

  return {
    changedFields,
    effects,
    guideNeedsRegeneration,
    previousSnapshot: oldProfile,
  }
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function stringify(val: unknown): string {
  if (val === null || val === undefined) return ""
  return String(val)
}
