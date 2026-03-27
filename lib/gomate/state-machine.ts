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
    settlement_reason: "Purpose Details",
    family_ties: "Purpose Details",
    
    moving_alone: "Family & Dependents",
    spouse_joining: "Family & Dependents",
    children_count: "Family & Dependents",
    children_ages: "Family & Dependents",
    partner_citizenship: "Family & Dependents",
    partner_visa_status: "Family & Dependents",
    partner_residency_duration: "Family & Dependents",
    relationship_type: "Family & Dependents",
    relationship_duration: "Family & Dependents",
    
    savings_available: "Financial",
    monthly_budget: "Financial",
    need_budget_help: "Financial",
    
    language_skill: "Background",
    education_level: "Background",
    years_experience: "Background",
    
    prior_visa: "Legal & Health",
    visa_rejections: "Legal & Health",
    healthcare_needs: "Legal & Health",
    pets: "Legal & Health",
    special_requirements: "Legal & Health",
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
