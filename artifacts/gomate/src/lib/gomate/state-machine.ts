import {
  type Profile,
  type AllFieldKey,
  FIELD_CONFIG,
  EMPTY_PROFILE,
  getRequiredFields,
} from "./profile-schema"

export type InterviewState = "interview" | "review" | "confirmed" | "complete"

export interface GoMateState {
  profile: Profile
  interviewState: InterviewState
  pendingFieldKey: AllFieldKey | null
  filledFields: AllFieldKey[]
  requiredFields: AllFieldKey[]
  confirmationPending: boolean
}

// Preferred field order for natural conversation flow
// Following GoMate behavior: Core mandatory → Purpose-specific → Family → Financial → Background → Special
const FIELD_ORDER: AllFieldKey[] = [
  // CORE MANDATORY (always required, asked first)
  "name",
  "destination",        // Where are you going?
  "target_city",        // Which city/region?
  "purpose",            // Why are you moving? (branches from here)
  "visa_role",          // Primary applicant or dependent? (right after purpose per profile-schema)
  "timeline",           // When do you plan to move?
  "citizenship",        // Which passport do you hold?
  "moving_alone",       // How many people relocating?
  
  // PURPOSE-SPECIFIC BRANCHING (only asked if relevant to purpose)
  // Study branch
  "study_type",
  "study_field",
  "study_funding",
  
  // Work branch
  "job_offer",
  "job_field",
  "employer_sponsorship",
  "highly_skilled",
  "years_experience",
  
  // Digital nomad branch
  "remote_income",
  "income_source",
  "monthly_income",
  "income_consistency",
  "income_history_months",
  
  // Settlement branch
  "settlement_reason",
  "family_ties",

  // Dependent / family reunion fields (asked when visa_role=dependent or settle purpose)
  "partner_citizenship",
  "partner_visa_status",
  "partner_residency_duration",
  "relationship_type",
  "relationship_duration",

  // Additional profile fields
  "other_citizenships",
  "birth_year",

  // FAMILY (only if not moving alone)
  "spouse_joining",
  "children_count",
  "children_ages",
  
  // FINANCIAL (always required for valid plan)
  "savings_available",  // Budget expectations / savings
  "monthly_budget",
  "preferred_currency",
  "need_budget_help",
  
  // HOUSING & LOCATION CONTEXT
  "current_location",   // Where are you now?
  "duration",           // Short-term vs long-term
  
  // BACKGROUND (helps with visa assessment)
  "language_skill",
  "education_level",
  
  // LEGAL (important for visa eligibility)
  "prior_visa",
  "visa_rejections",
  
  // HEALTHCARE & SPECIAL (last, but mandatory)
  "healthcare_needs",   // Healthcare considerations
  "pets",
  "special_requirements",

  // === V2 AGENCY-GRADE FIELDS (Wave 1.2) — appended in conditional groups ===
  // Question Director should ask these only when their gating predicate fires.
  // The order here is the natural follow-up order *within* each group.

  // Posted-worker (after work branch)
  "posting_or_secondment",
  "home_country_employer",
  "posting_employer_address",
  "posting_duration_months",
  "a1_certificate_status",
  "coc_status",
  "pwd_filed",

  // Trailing spouse (after spouse_joining=yes)
  "spouse_career_field",
  "spouse_seeking_work",
  "spouse_language_skills",
  "spouse_visa_dependency",

  // Children specifics (after children_count > 0)
  "children_school_type_preference",
  "children_language_skills_destination",
  "children_birth_certificate_apostille_status",
  "children_special_needs",

  // Healthcare specifics (after healthcare_needs ≠ none)
  "chronic_condition_description",
  "prescription_medications",
  "prescription_medications_list",
  "english_speaking_doctor_required",
  "pre_existing_condition_disclosure_concern",

  // Pet specifics (after pets ≠ none)
  "pet_microchip_status",
  "pet_vaccination_status",
  "pet_breed",
  "pet_size_weight",
  "pet_age",

  // Prior immigration (after prior_visa=yes)
  "prior_visa_country",
  "prior_visa_type",
  "prior_residence_outside_origin",

  // Vehicle import (gating + dependents)
  "bringing_vehicle",
  "vehicle_make_model_year",
  "vehicle_origin_country",
  "vehicle_emission_standard",

  // Goods shipping (gating + dependents)
  "bringing_personal_effects",
  "estimated_goods_volume_cubic_meters",
  "goods_shipping_method",
  "need_storage",

  // Origin departure logistics
  "origin_lease_status",
  "origin_lease_termination_notice_days",

  // Driver's license / mobility
  "driver_license_origin",
  "driver_license_destination_intent",

  // Working remote during transition
  "working_remote_during_transition",

  // Document logistics (apostilles + clearances)
  "birth_certificate_apostille_status",
  "marriage_certificate_apostille_status",
  "diploma_apostille_status",
  "police_clearance_status",
  "medical_exam_required",

  // Departure-side tax/pension
  "departure_tax_filing_required",
  "exit_tax_obligations",
  "pension_continuity_required",

  // Insurance needs (always optional)
  "insurance_needs_household",
  "insurance_needs_vehicle",
  "insurance_needs_life",
  "gap_insurance_needed",

  // Property / housing intent (always optional)
  "home_purchase_intent",
  "rental_budget_max",
  "furnished_preference",
  "commute_tolerance_minutes",
  "accessibility_needs",

  // Family visa cascade awareness
  "family_visa_cascade_aware",

  // Lifestyle / NEVER required (asked only if user volunteers)
  "religious_practice_required",
  "register_with_origin_embassy_intent",
  "emergency_contact_origin_name",
  "emergency_contact_origin_phone",
  "pre_existing_investments_to_migrate",
  "existing_offshore_accounts",
]

// Initialize state
export function createInitialState(): GoMateState {
  const profile = { ...EMPTY_PROFILE }
  const requiredFields = getRequiredFields(profile)
  
  return {
    profile,
    interviewState: "interview",
    pendingFieldKey: "name",
    filledFields: [],
    requiredFields,
    confirmationPending: false,
  }
}

// Determine which fields are filled (only counts required fields)
export function getFilledFields(profile: Profile): AllFieldKey[] {
  const requiredFields = getRequiredFields(profile)
  
  return requiredFields.filter((key) => {
    const value = profile[key as keyof Profile]
    return value !== null && value !== undefined && value !== ""
  })
}

// Get the next required field that needs to be filled (in order)
export function getNextPendingField(profile: Profile): AllFieldKey | null {
  const requiredFields = getRequiredFields(profile)
  
  // Follow the preferred order for better conversation flow
  for (const field of FIELD_ORDER) {
    if (!requiredFields.includes(field)) continue
    
    const value = profile[field as keyof Profile]
    if (value === null || value === undefined || value === "") {
      return field
    }
  }
  
  return null
}

// Check if all required fields are filled
export function isProfileComplete(profile: Profile): boolean {
  return getNextPendingField(profile) === null
}

// Get completion percentage (based on dynamic required fields)
export function getCompletionPercentage(profile: Profile): number {
  const requiredFields = getRequiredFields(profile)
  const filledFields = getFilledFields(profile)
  
  if (requiredFields.length === 0) return 0
  return Math.round((filledFields.length / requiredFields.length) * 100)
}

// Update profile with extracted data
export function updateProfile(
  currentProfile: Profile,
  extraction: Partial<Profile>
): Profile {
  const updated = { ...currentProfile }

  for (const [key, value] of Object.entries(extraction)) {
    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      key in currentProfile
    ) {
      ;(updated as Record<string, unknown>)[key] = value
    }
  }

  return updated
}

// Compute next state based on profile
export function computeNextState(profile: Profile, confirmationReceived: boolean): GoMateState {
  const requiredFields = getRequiredFields(profile)
  const filledFields = getFilledFields(profile)
  const pendingFieldKey = getNextPendingField(profile)
  const isComplete = pendingFieldKey === null

  let interviewState: InterviewState = "interview"
  let confirmationPending = false

  if (isComplete && !confirmationReceived) {
    interviewState = "review"
    confirmationPending = true
  } else if (isComplete && confirmationReceived) {
    interviewState = "complete"
  }

  return {
    profile,
    interviewState,
    pendingFieldKey: isComplete ? null : pendingFieldKey,
    filledFields,
    requiredFields,
    confirmationPending,
  }
}

// Get field metadata for the pending field
export function getPendingFieldMetadata(pendingFieldKey: AllFieldKey | null) {
  if (!pendingFieldKey) return null
  return FIELD_CONFIG[pendingFieldKey]
}

// Format profile summary for review (organized by category)
export function formatProfileSummary(profile: Profile): string {
  const requiredFields = getRequiredFields(profile)
  const sections: Record<string, string[]> = {
    "Basic Information": [],
    "Purpose Details": [],
    "Family & Dependents": [],
    "Financial": [],
    "Background": [],
    "Legal & Health": [],
    "Documents": [],
    "Logistics & Mobility": [],
    "Lifestyle & Optional": [],
  }

  // Map fields to sections
  const fieldToSection: Record<string, string> = {
    name: "Basic Information",
    citizenship: "Basic Information",
    other_citizenships: "Basic Information",
    birth_year: "Basic Information",
    current_location: "Basic Information",
    destination: "Basic Information",
    target_city: "Basic Information",
    purpose: "Basic Information",
    duration: "Basic Information",
    timeline: "Basic Information",
    
    study_type: "Purpose Details",
    study_field: "Purpose Details",
    study_funding: "Purpose Details",
    job_offer: "Purpose Details",
    job_field: "Purpose Details",
    employer_sponsorship: "Purpose Details",
    highly_skilled: "Purpose Details",
    remote_income: "Purpose Details",
    income_source: "Purpose Details",
    monthly_income: "Purpose Details",
    income_consistency: "Purpose Details",
    income_history_months: "Purpose Details",
    settlement_reason: "Purpose Details",
    family_ties: "Purpose Details",
    visa_role: "Purpose Details",
    posting_or_secondment: "Purpose Details",
    home_country_employer: "Purpose Details",
    posting_employer_address: "Purpose Details",
    posting_duration_months: "Purpose Details",
    a1_certificate_status: "Purpose Details",
    coc_status: "Purpose Details",
    pwd_filed: "Purpose Details",
    
    moving_alone: "Family & Dependents",
    spouse_joining: "Family & Dependents",
    children_count: "Family & Dependents",
    children_ages: "Family & Dependents",
    partner_citizenship: "Family & Dependents",
    partner_visa_status: "Family & Dependents",
    partner_residency_duration: "Family & Dependents",
    relationship_type: "Family & Dependents",
    relationship_duration: "Family & Dependents",
    spouse_career_field: "Family & Dependents",
    spouse_seeking_work: "Family & Dependents",
    spouse_language_skills: "Family & Dependents",
    spouse_visa_dependency: "Family & Dependents",
    children_school_type_preference: "Family & Dependents",
    children_language_skills_destination: "Family & Dependents",
    children_special_needs: "Family & Dependents",
    family_visa_cascade_aware: "Family & Dependents",

    savings_available: "Financial",
    monthly_budget: "Financial",
    preferred_currency: "Financial",
    need_budget_help: "Financial",
    
    language_skill: "Background",
    education_level: "Background",
    years_experience: "Background",
    
    prior_visa: "Legal & Health",
    visa_rejections: "Legal & Health",
    healthcare_needs: "Legal & Health",
    pets: "Legal & Health",
    special_requirements: "Legal & Health",
    prior_visa_country: "Legal & Health",
    prior_visa_type: "Legal & Health",
    prior_residence_outside_origin: "Legal & Health",
    chronic_condition_description: "Legal & Health",
    prescription_medications: "Legal & Health",
    prescription_medications_list: "Legal & Health",
    english_speaking_doctor_required: "Legal & Health",
    pre_existing_condition_disclosure_concern: "Legal & Health",
    pet_microchip_status: "Legal & Health",
    pet_vaccination_status: "Legal & Health",
    pet_size_weight: "Legal & Health",
    pet_breed: "Legal & Health",
    pet_age: "Legal & Health",

    birth_certificate_apostille_status: "Documents",
    marriage_certificate_apostille_status: "Documents",
    diploma_apostille_status: "Documents",
    police_clearance_status: "Documents",
    medical_exam_required: "Documents",
    children_birth_certificate_apostille_status: "Documents",

    bringing_vehicle: "Logistics & Mobility",
    vehicle_make_model_year: "Logistics & Mobility",
    vehicle_origin_country: "Logistics & Mobility",
    vehicle_emission_standard: "Logistics & Mobility",
    bringing_personal_effects: "Logistics & Mobility",
    estimated_goods_volume_cubic_meters: "Logistics & Mobility",
    goods_shipping_method: "Logistics & Mobility",
    need_storage: "Logistics & Mobility",
    origin_lease_status: "Logistics & Mobility",
    origin_lease_termination_notice_days: "Logistics & Mobility",
    driver_license_origin: "Logistics & Mobility",
    driver_license_destination_intent: "Logistics & Mobility",
    working_remote_during_transition: "Logistics & Mobility",
    home_purchase_intent: "Logistics & Mobility",
    rental_budget_max: "Logistics & Mobility",
    furnished_preference: "Logistics & Mobility",
    commute_tolerance_minutes: "Logistics & Mobility",
    accessibility_needs: "Logistics & Mobility",
    departure_tax_filing_required: "Logistics & Mobility",
    exit_tax_obligations: "Logistics & Mobility",
    pension_continuity_required: "Logistics & Mobility",

    religious_practice_required: "Lifestyle & Optional",
    register_with_origin_embassy_intent: "Lifestyle & Optional",
    emergency_contact_origin_name: "Lifestyle & Optional",
    emergency_contact_origin_phone: "Lifestyle & Optional",
    pre_existing_investments_to_migrate: "Lifestyle & Optional",
    existing_offshore_accounts: "Lifestyle & Optional",
    insurance_needs_household: "Lifestyle & Optional",
    insurance_needs_vehicle: "Lifestyle & Optional",
    insurance_needs_life: "Lifestyle & Optional",
    gap_insurance_needed: "Lifestyle & Optional",
  }

  // Populate sections with filled fields
  for (const field of requiredFields) {
    const value = profile[field as keyof Profile]
    if (value) {
      const section = fieldToSection[field] || "Other"
      const config = FIELD_CONFIG[field]
      const label = config?.label || field
      
      if (!sections[section]) sections[section] = []
      sections[section].push(`${label}: ${value}`)
    }
  }

  // Build output
  const lines: string[] = []
  for (const [section, items] of Object.entries(sections)) {
    if (items.length > 0) {
      lines.push(`\n**${section}**`)
      items.forEach(item => lines.push(`- ${item}`))
    }
  }

  return lines.join("\n")
}

// Get progress info for UI
export function getProgressInfo(profile: Profile): {
  filled: number
  total: number
  percentage: number
  currentField: AllFieldKey | null
  currentFieldLabel: string | null
} {
  const requiredFields = getRequiredFields(profile)
  const filledFields = getFilledFields(profile)
  const currentField = getNextPendingField(profile)
  
  return {
    filled: filledFields.length,
    total: requiredFields.length,
    percentage: requiredFields.length > 0 
      ? Math.round((filledFields.length / requiredFields.length) * 100) 
      : 0,
    currentField,
    currentFieldLabel: currentField ? FIELD_CONFIG[currentField]?.label || null : null,
  }
}
