/**
 * Plan Consistency Check Engine
 *
 * 8 heuristic rules that detect mismatches between profile data,
 * visa requirements, budget, timeline, and task state.
 * Each check silently skips when its required data is missing.
 */

import { parseAmountFromText, parseTimeRange } from "./text-parsers"

export type ConsistencyWarning = {
  severity: "critical" | "warning" | "suggestion"
  code: string
  message: string
  fix: string
  relatedField: string
}

interface VisaOption {
  requirements?: string[]
  processingTime?: string
}

interface PlanForConsistency {
  profile_data?: {
    monthly_income?: string | null
    monthly_budget?: string | null
    savings_available?: string | null
    target_date?: string | null
    destination?: string | null
    destination_city?: string | null
    visa_type?: string | null
    [key: string]: unknown
  } | null
  stage?: string
  visa_research?: {
    visaOptions?: Record<string, VisaOption>
    [key: string]: unknown
  } | null
  numbeo_data?: {
    estimatedMonthlyBudget?: {
      single?: { minimum?: number; comfortable?: number }
      couple?: { minimum?: number; comfortable?: number }
      family4?: { minimum?: number; comfortable?: number }
    }
    [key: string]: unknown
  } | null
  document_statuses?: Record<string, {
    status?: string
    expiryDate?: string
    [key: string]: unknown
  }> | null
  checklist_items?: {
    categories?: Array<{
      items?: Array<{
        id?: string
        priority?: string
        required?: boolean
        [key: string]: unknown
      }>
      [key: string]: unknown
    }>
    [key: string]: unknown
  } | null
  settling_in_tasks?: Array<{
    id: string
    status: string
    blocked_by?: string[] | null
    title?: string
    [key: string]: unknown
  }>
}

export function validatePlanConsistency(plan: PlanForConsistency): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = []
  const profile = plan.profile_data
  if (!profile) return warnings

  // Rule 1: INCOME_BELOW_VISA_MINIMUM
  checkIncomeVsVisa(profile, plan.visa_research, warnings)

  // Rule 2: BUDGET_BELOW_COL_MINIMUM
  checkBudgetVsCol(profile, plan.numbeo_data, warnings)

  // Rule 3: SAVINGS_INSUFFICIENT
  checkSavings(profile, warnings)

  // Rule 4: ARRIVAL_BEFORE_VISA_READY
  checkArrivalVsVisa(profile, plan.visa_research, warnings)

  // Rule 6: TASK_DEPENDENCY_VIOLATION
  checkTaskDependencies(plan.settling_in_tasks, warnings)

  // Rule 7: DOCUMENT_EXPIRED
  checkDocumentExpiry(plan.document_statuses, warnings)

  // Rule 9: TARGET_DATE_PASSED
  checkTargetDatePassed(profile, plan.stage, warnings)

  // Rule 10: MISSING_CRITICAL_DOCUMENTS
  checkMissingCriticalDocuments(profile, plan.checklist_items, plan.document_statuses, warnings)

  return warnings
}

function checkIncomeVsVisa(
  profile: NonNullable<PlanForConsistency["profile_data"]>,
  visaResearch: PlanForConsistency["visa_research"],
  warnings: ConsistencyWarning[],
) {
  const income = parseFloat(profile.monthly_income || "")
  if (!income || isNaN(income)) return
  if (!visaResearch?.visaOptions) return

  const selectedVisa = profile.visa_type
  if (!selectedVisa) return

  const visa = visaResearch.visaOptions[selectedVisa]
  if (!visa?.requirements) return

  for (const req of visa.requirements) {
    const amount = parseAmountFromText(req)
    if (amount && income < amount) {
      warnings.push({
        severity: "critical",
        code: "INCOME_BELOW_VISA_MINIMUM",
        message: `Your monthly income (${income.toLocaleString()}) is below the visa requirement of ${amount.toLocaleString()} found in "${req}".`,
        fix: "Check if you have additional income sources that count, or consider a different visa type with lower requirements.",
        relatedField: "monthly_income",
      })
      break
    }
  }
}

function checkBudgetVsCol(
  profile: NonNullable<PlanForConsistency["profile_data"]>,
  numbeoData: PlanForConsistency["numbeo_data"],
  warnings: ConsistencyWarning[],
) {
  const budget = parseFloat(profile.monthly_budget || "")
  if (!budget || isNaN(budget)) return
  if (!numbeoData?.estimatedMonthlyBudget) return

  const budgetData = numbeoData.estimatedMonthlyBudget
  const minimum = budgetData.single?.minimum
  if (!minimum) return

  if (budget < minimum) {
    warnings.push({
      severity: "warning",
      code: "BUDGET_BELOW_COL_MINIMUM",
      message: `Your monthly budget (${budget.toLocaleString()}) is below the estimated minimum cost of living (${minimum.toLocaleString()}) for your destination.`,
      fix: "Consider increasing your budget, choosing a cheaper area, or adjusting your expectations for the first few months.",
      relatedField: "monthly_budget",
    })
  }
}

function checkSavings(
  profile: NonNullable<PlanForConsistency["profile_data"]>,
  warnings: ConsistencyWarning[],
) {
  const savings = parseFloat(profile.savings_available || "")
  const budget = parseFloat(profile.monthly_budget || "")
  if (!savings || isNaN(savings) || !budget || isNaN(budget)) return

  const runwayMonths = savings / budget
  if (runwayMonths < 3) {
    warnings.push({
      severity: "warning",
      code: "SAVINGS_INSUFFICIENT",
      message: `Your savings (${savings.toLocaleString()}) cover only ${runwayMonths.toFixed(1)} months at your planned budget. A 3-month buffer is recommended.`,
      fix: "Try to save more before moving, or reduce your monthly budget to extend your runway.",
      relatedField: "savings_available",
    })
  }
}

function checkArrivalVsVisa(
  profile: NonNullable<PlanForConsistency["profile_data"]>,
  visaResearch: PlanForConsistency["visa_research"],
  warnings: ConsistencyWarning[],
) {
  const targetDate = profile.target_date
  if (!targetDate) return
  if (!visaResearch?.visaOptions) return

  const selectedVisa = profile.visa_type
  if (!selectedVisa) return

  const visa = visaResearch.visaOptions[selectedVisa]
  if (!visa?.processingTime) return

  const timeRange = parseTimeRange(visa.processingTime)
  if (!timeRange) return

  const today = new Date()
  const target = new Date(targetDate)
  const daysUntilTarget = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilTarget < timeRange.max) {
    warnings.push({
      severity: "warning",
      code: "ARRIVAL_BEFORE_VISA_READY",
      message: `Your target date is ${daysUntilTarget} days away, but visa processing can take up to ${timeRange.max} days (${visa.processingTime}).`,
      fix: "Apply for your visa as soon as possible, or consider pushing back your target date to allow for processing time.",
      relatedField: "target_date",
    })
  }
}

function checkTaskDependencies(
  tasks: PlanForConsistency["settling_in_tasks"],
  warnings: ConsistencyWarning[],
) {
  if (!tasks || tasks.length === 0) return

  const taskById = new Map(tasks.map((t) => [t.id, t]))

  for (const task of tasks) {
    if (task.status !== "done") continue
    if (!task.blocked_by || task.blocked_by.length === 0) continue

    for (const depId of task.blocked_by) {
      const dep = taskById.get(depId)
      if (dep && dep.status !== "done") {
        warnings.push({
          severity: "suggestion",
          code: "TASK_DEPENDENCY_VIOLATION",
          message: `"${task.title || task.id}" is marked complete but depends on "${dep.title || dep.id}" which is not yet done.`,
          fix: "Check if the prerequisite task was completed in a different way, or mark it as done too.",
          relatedField: "settling_in_tasks",
        })
      }
    }
  }
}

function checkDocumentExpiry(
  documentStatuses: PlanForConsistency["document_statuses"],
  warnings: ConsistencyWarning[],
) {
  if (!documentStatuses) return

  const today = new Date()

  for (const [docId, doc] of Object.entries(documentStatuses)) {
    if (doc.status !== "ready" && doc.status !== "submitted") continue
    if (!doc.expiryDate) continue

    const expiry = new Date(doc.expiryDate)
    if (isNaN(expiry.getTime())) continue

    if (expiry < today) {
      warnings.push({
        severity: "critical",
        code: "DOCUMENT_EXPIRED",
        message: `Document "${docId}" is marked as "${doc.status}" but expired on ${expiry.toLocaleDateString()}.`,
        fix: "Renew this document before proceeding with your application.",
        relatedField: "document_statuses",
      })
    }
  }
}

function checkTargetDatePassed(
  profile: NonNullable<PlanForConsistency["profile_data"]>,
  stage: string | undefined,
  warnings: ConsistencyWarning[],
) {
  const targetDate = profile.target_date
  if (!targetDate) return
  if (stage !== "generating" && stage !== "complete" && stage !== "collecting") return

  const target = new Date(targetDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (target < today) {
    warnings.push({
      severity: "warning",
      code: "TARGET_DATE_PASSED",
      message: `Your target move date (${target.toLocaleDateString()}) has already passed but you haven't confirmed arrival.`,
      fix: "Update your target date to a future date, or confirm your arrival if you have already moved.",
      relatedField: "target_date",
    })
  }
}

function checkMissingCriticalDocuments(
  profile: NonNullable<PlanForConsistency["profile_data"]>,
  checklistItems: PlanForConsistency["checklist_items"],
  documentStatuses: PlanForConsistency["document_statuses"],
  warnings: ConsistencyWarning[],
) {
  if (!checklistItems?.categories) return
  if (!profile.target_date) return

  const target = new Date(profile.target_date)
  const today = new Date()
  const daysUntil = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil > 30) return

  const statuses = documentStatuses || {}

  for (const category of checklistItems.categories) {
    if (!category.items) continue
    for (const item of category.items) {
      if (item.priority !== "critical" || !item.required) continue
      const docId = item.id
      if (!docId) continue

      const docStatus = statuses[docId]
      if (!docStatus || docStatus.status === "not_started") {
        warnings.push({
          severity: "critical",
          code: "MISSING_CRITICAL_DOCUMENTS",
          message: `Critical document "${docId}" is not started and your target date is ${daysUntil <= 0 ? "past" : `in ${daysUntil} days`}.`,
          fix: "Start gathering this document immediately — it is listed as critical and required for your relocation.",
          relatedField: "document_statuses",
        })
      }
    }
  }
}
