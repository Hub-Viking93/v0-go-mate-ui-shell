import type { AllFieldKey } from "@/lib/gomate/profile-schema"
import type { ExpectedAnswerType } from "@/components/onboarding-input"

const COUNTRY_FIELDS = new Set<string>([
  "destination",
  "current_location",
  "citizenship",
  "other_citizenships",
  "partner_citizenship",
  "prior_visa_country",
  "vehicle_origin_country",
  "home_country_employer",
])

const CURRENCY_FIELDS = new Set<string>([
  "savings_available",
  "monthly_budget",
  "monthly_income",
])

const NUMBER_FIELDS = new Set<string>([
  "birth_year",
  "children_count",
  "income_history_months",
  "years_experience",
  "partner_residency_duration",
  "relationship_duration",
])

const YES_NO_FIELDS = new Set<string>([
  "moving_alone",
  "spouse_joining",
  "job_offer",
  "employer_sponsorship",
  "highly_skilled",
  "remote_income",
  "family_ties",
  "visa_rejections",
  "need_budget_help",
])

export function getInputTypeForField(
  field: AllFieldKey | null,
): ExpectedAnswerType {
  if (!field) return "text"
  if (COUNTRY_FIELDS.has(field)) return "country"
  if (CURRENCY_FIELDS.has(field)) return "currency"
  if (NUMBER_FIELDS.has(field)) return "number"
  if (YES_NO_FIELDS.has(field)) return "yes_no"
  return "text"
}
