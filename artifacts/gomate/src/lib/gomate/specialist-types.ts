/**
 * Mirror of @workspace/agents specialist output types, narrowed for the
 * gomate frontend. Cross-package imports from api-server / lib/agents are
 * not allowed from artifacts/gomate, so this file declares the shapes we
 * consume in dashboard cards. Keep in sync with:
 *   lib/agents/src/specialists/types.ts        (base SpecialistOutput)
 *   lib/agents/src/specialists/<name>.ts       (per-specialist key_facts)
 */

export type SpecialistQuality = "full" | "partial" | "fallback"
export type ConfidenceLevel = "high" | "medium" | "low"

export interface Citation {
  url: string
  label: string
  note?: string
  scraped: boolean
}

export interface BaseSpecialistOutput<TKeyFacts = Record<string, unknown>> {
  specialist: string
  contentParagraphs: string[]
  citations: Citation[]
  sourceUrlsUsed: string[]
  retrievedAt: string
  quality: SpecialistQuality
  confidence: ConfidenceLevel
  domainSpecificData: TKeyFacts
  wallClockMs: number
  tokensUsed: number
  modelUsed: string
  fallbackReason?: string
}

// ---------------------------------------------------------------------------
// schools_specialist
// ---------------------------------------------------------------------------
export interface SchoolRecommendation {
  name: string
  type: "international" | "bilingual" | "public" | "private"
  language: string
  approx_fee_eur_year: number | null
  application_lead_months: number | null
  waitlist_likely: boolean
  url: string | null
}

export interface SchoolsKeyFacts {
  system_overview?: string
  average_intl_school_fee_range_eur?: { low: number; high: number }
  children_recommendations?: Array<{
    child_label: string
    schools: SchoolRecommendation[]
  }>
  warnings?: string[]
}
export type SchoolsOutput = BaseSpecialistOutput<SchoolsKeyFacts>

// ---------------------------------------------------------------------------
// pet_specialist
// ---------------------------------------------------------------------------
export interface PetKeyFacts {
  import_requirements?: string[]
  vaccination_timeline?: Array<{ step: string; lead_days: number; notes: string }>
  breed_restrictions?: { applies_to_user_pet: boolean; restricted_breeds: string[] }
  import_permit?: {
    required: boolean
    authority: string
    url: string | null
    lead_days: number | null
  }
  quarantine_rules?: { required: boolean; duration_days: number | null; notes: string }
  warnings?: string[]
}
export type PetOutput = BaseSpecialistOutput<PetKeyFacts>

// ---------------------------------------------------------------------------
// digital_nomad_compliance_specialist  (income-compliance card)
// ---------------------------------------------------------------------------
export interface IncomeComplianceKeyFacts {
  visa_name?: string
  issuing_authority?: string
  income_threshold_eur_month?: number | null
  user_income_eur_month?: number | null
  income_qualifies?: boolean
  tax_residency_implications?: string
  visa_validity_months?: number | null
  renewal_possible?: boolean
  warnings?: string[]
}
export type IncomeComplianceOutput = BaseSpecialistOutput<IncomeComplianceKeyFacts>

// ---------------------------------------------------------------------------
// family_reunion_specialist
// ---------------------------------------------------------------------------
export interface FamilyReunionKeyFacts {
  route_name?: string
  sponsor_income_threshold_eur_month?: number | null
  accommodation_required?: boolean
  marriage_certificate_required?: boolean
  fiance_route_available?: boolean
  integration_test_required?: boolean
  processing_weeks?: number | null
  dependent_can_work?: boolean
  independence_after_years?: number | null
  warnings?: string[]
}
export type FamilyReunionOutput = BaseSpecialistOutput<FamilyReunionKeyFacts>

// ---------------------------------------------------------------------------
// departure_tax_specialist
// ---------------------------------------------------------------------------
export interface DepartureTaxKeyFacts {
  origin?: string
  exit_tax_applies?: boolean
  asset_threshold_eur?: number | null
  residency_years_threshold?: number | null
  capital_gains_trigger?: "deemed_disposal" | "defer_until_realised" | "none"
  pension_treatment?: string
  filing_form?: string
  filing_deadline_relative_to_departure?: string
  treaty_with_destination_exists?: boolean
  professional_advice_recommended?: boolean
  warnings?: string[]
}
export type DepartureTaxOutput = BaseSpecialistOutput<DepartureTaxKeyFacts>

// ---------------------------------------------------------------------------
// vehicle_import_specialist
// ---------------------------------------------------------------------------
export interface VehicleImportKeyFacts {
  import_duty_estimate_pct?: number | null
  vat_applies?: boolean
  vat_rate_pct?: number | null
  emissions_compliant?: boolean
  emissions_notes?: string
  customs_form?: string
  registration_authority?: string
  technical_inspection_required?: boolean
  conformity_certificate_required?: boolean
  deadline_after_arrival_days?: number | null
  warnings?: string[]
}
export type VehicleImportOutput = BaseSpecialistOutput<VehicleImportKeyFacts>

// ---------------------------------------------------------------------------
// property_purchase_specialist
// ---------------------------------------------------------------------------
export interface PropertyPurchaseKeyFacts {
  foreigner_purchase_rules?: "free" | "restricted" | "permit_required"
  permit_authority?: string | null
  mortgage_available_to_non_residents?: boolean
  max_ltv_pct_non_resident?: number | null
  transaction_tax_pct_total?: number | null
  stamp_duty_pct?: number | null
  transfer_tax_pct?: number | null
  typical_process_weeks?: number | null
  warnings?: string[]
}
export type PropertyPurchaseOutput = BaseSpecialistOutput<PropertyPurchaseKeyFacts>

// ---------------------------------------------------------------------------
// posted_worker_specialist
// ---------------------------------------------------------------------------
export interface PostedWorkerKeyFacts {
  framework?: "EU_A1" | "bilateral_CoC" | "unclear"
  a1_or_coc_path?: {
    issued_by: string
    applied_by: "worker" | "employer"
    lead_weeks: number | null
    max_validity_months: number | null
    url: string | null
  }
  pwd_filing?: {
    destination_authority: string
    deadline_relative_to_start: string
    url: string | null
  }
  employer_registration_required?: boolean
  contact_person_requirement?: { required: boolean; must_be_resident: boolean }
  social_security_rules?: { duration_cap_months: number | null; extension_possible: boolean }
  warnings?: string[]
}
export type PostedWorkerOutput = BaseSpecialistOutput<PostedWorkerKeyFacts>

// ---------------------------------------------------------------------------
// trailing_spouse_career_specialist
// ---------------------------------------------------------------------------
export interface TrailingSpouseKeyFacts {
  field_demand_assessment?: "high" | "moderate" | "low"
  dependent_can_work?: boolean
  separate_work_permit_required?: boolean
  language_requirement_for_field?: string
  credential_recognition_needed?: boolean
  credential_recognition_authority?: string | null
  top_job_platforms?: Array<{ name: string; url: string | null }>
  professional_associations?: Array<{ name: string; url: string | null }>
  warnings?: string[]
}
export type TrailingSpouseOutput = BaseSpecialistOutput<TrailingSpouseKeyFacts>

// ---------------------------------------------------------------------------
// healthcare_specialist  (chronic-health card consumes condition-specific bits)
// ---------------------------------------------------------------------------
export interface HealthcareKeyFacts {
  registration_steps?: string[]
  insurance_options?: Array<{
    name: string
    type: "public" | "private" | "hybrid"
    approx_monthly_eur: number | null
  }>
  recommended_providers?: Array<{
    name: string
    city: string
    english_speaking: boolean
    url: string | null
  }>
  prescription_continuity?: { applicable: boolean; notes: string }
  warnings?: string[]
}
export type HealthcareOutput = BaseSpecialistOutput<HealthcareKeyFacts>

// ---------------------------------------------------------------------------
// prior visa history — derived from profile (no specialist).
// ---------------------------------------------------------------------------
export interface PriorVisaHistoryData {
  visa_rejections?: "yes" | "no" | string
  prior_visa_countries?: string
  prior_visa_types?: string
  rejection_details?: string
}
