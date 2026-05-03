import { z } from "zod"

// All possible profile fields organized by category
export const ALL_FIELDS = [
  // Core identity (always required)
  "name",
  "citizenship",
  "other_citizenships", // dual/multiple passports - unlocks additional visa pathways
  "birth_year", // for age-restricted visas (Working Holiday, retirement)
  "current_location",
  
  // Destination & purpose (always required)
  "destination",
  "target_city",
  "purpose",
  
  // Visa role - MUST come right after purpose to enable proper branching
  "visa_role", // primary, dependent - clarifies who the visa is for
  
  // Partner/sponsor info - ONLY for dependents and family reunion
  // Asked early so we understand the visa pathway before asking irrelevant fields
  "partner_citizenship", // citizenship of the partner/sponsor
  "partner_visa_status", // citizen, permanent_resident, work_visa, student_visa, other
  "relationship_type", // spouse, fiancé, registered_partner, cohabitant, parent, child
  "partner_residency_duration", // how long partner has lived there
  "relationship_duration", // how long in relationship (some visas require proof)
  
  // Timeline & duration (always required)
  "duration",
  "timeline",
  
  // Study-specific fields (ONLY if purpose=study AND visa_role=primary)
  "study_type", // university, language_school, vocational, exchange
  "study_field", // engineering, medicine, arts, etc.
  "study_funding", // self-funded, scholarship, loan
  
  // Work-specific fields (ONLY if purpose=work AND visa_role=primary)
  "job_offer", // yes, no, in_progress
  "job_field", // tech, healthcare, finance, etc.
  "employer_sponsorship", // yes, no, unknown
  "highly_skilled", // yes, no - for skilled worker visas
  
  // Digital nomad / freelance specific (ONLY if purpose=digital_nomad)
  "remote_income", // yes, no
  "income_source", // freelance, employed_remote, business_owner
  "monthly_income", // for digital nomad visa requirements
  "income_consistency", // stable, variable, new - how consistent is income
  "income_history_months", // how many months of income history (e.g., "12 months")
  
  // Settlement specific (ONLY if purpose=settle)
  "settlement_reason", // retirement, family_reunion, investment, ancestry
  "family_ties", // yes, no - existing family in destination
  
  // Family & dependents
  "moving_alone", // yes, no
  "spouse_joining", // yes, no, later
  "children_count", // 0, 1, 2, etc.
  "children_ages", // for school planning
  
  // Financial (always required for planning)
  "savings_available",
  "monthly_budget",
  "preferred_currency", // ISO 4217 code (e.g. "SEK", "EUR") — explicit user preference
  "need_budget_help", // yes, no
  
  // Background
  "language_skill",
  "education_level", // high_school, bachelors, masters, phd
  "years_experience", // work experience
  
  // Legal/visa history
  "prior_visa",
  "visa_rejections", // yes, no
  
  // Healthcare & special needs
  "healthcare_needs", // none, chronic_condition, disability
  "pets", // none, dog, cat, other
  "special_requirements", // any other special needs

  // === V2 AGENCY-GRADE FIELDS (added in Wave 1.2) ===
  // Every field below is CONDITIONAL — required only if its upstream trigger
  // fires. The Question Director must not surface these fields unless the
  // gating predicate evaluates to true (see soft-enforcement rules in
  // FIELD_CONFIG entries below). Religious / offshore / embassy / emergency
  // / insurance / investments fields are NEVER required — surfaced only if
  // user volunteers them.

  // Posted-worker / corporate-posting (gates on purpose=work + posting_or_secondment=yes)
  "posting_or_secondment",
  "home_country_employer",
  "posting_employer_address",
  "posting_duration_months",
  "a1_certificate_status",
  "coc_status",
  "pwd_filed",

  // Prior immigration history (gates on prior_visa=yes)
  "prior_visa_country",
  "prior_visa_type",
  "prior_residence_outside_origin",

  // Document logistics (apostilles + clearances)
  "birth_certificate_apostille_status",
  "marriage_certificate_apostille_status",
  "diploma_apostille_status",
  "police_clearance_status",
  "medical_exam_required",

  // Trailing spouse / dependent (gates on spouse_joining=yes)
  "spouse_career_field",
  "spouse_seeking_work",
  "spouse_language_skills",
  "spouse_visa_dependency",

  // Children specifics (gates on children_count > 0)
  "children_school_type_preference",
  "children_language_skills_destination",
  "children_special_needs",
  "children_birth_certificate_apostille_status",

  // Healthcare specifics (gates on healthcare_needs ≠ none)
  "chronic_condition_description",
  "prescription_medications",
  "english_speaking_doctor_required",

  // Healthcare continuity
  "prescription_medications_list",
  "pre_existing_condition_disclosure_concern",

  // Pet specifics (gates on pets ≠ none)
  "pet_microchip_status",
  "pet_vaccination_status",
  "pet_size_weight",
  "pet_breed",
  "pet_age",

  // Vehicle import (gates on bringing_vehicle=yes)
  "bringing_vehicle",
  "vehicle_make_model_year",
  "vehicle_origin_country",
  "vehicle_emission_standard",

  // Property / housing intent
  "home_purchase_intent",
  "rental_budget_max",
  "furnished_preference",
  "commute_tolerance_minutes",
  "accessibility_needs",

  // Departure-side (origin exit tax)
  "departure_tax_filing_required",
  "exit_tax_obligations",
  "pension_continuity_required",

  // Goods shipping (gates on bringing_personal_effects=yes)
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

  // Working remote during transition (always optional)
  "working_remote_during_transition",

  // Religious / lifestyle continuity (NEVER required)
  "religious_practice_required",

  // Embassy registration (NEVER required)
  "register_with_origin_embassy_intent",

  // Emergency contacts (always optional)
  "emergency_contact_origin_name",
  "emergency_contact_origin_phone",

  // Financial planning beyond core budget (NEVER required)
  "pre_existing_investments_to_migrate",
  "existing_offshore_accounts",

  // Insurance needs beyond healthcare (always optional)
  "insurance_needs_household",
  "insurance_needs_vehicle",
  "insurance_needs_life",
  "gap_insurance_needed",

  // Family visa cascade awareness (gates on family present + primary applicant)
  "family_visa_cascade_aware",
] as const

export type AllFieldKey = (typeof ALL_FIELDS)[number]

// Purpose types
export type Purpose = "study" | "work" | "settle" | "digital_nomad" | "other"

// Field categories with conditions
export interface FieldConfig {
  key: AllFieldKey
  label: string
  intent: string
  examples: string[]
  extractionHints: string[]
  required: boolean | ((profile: Profile) => boolean)
  category:
    | "core"
    | "purpose_specific"
    | "family"
    | "financial"
    | "background"
    | "legal"
    | "special"
    | "documents"
    | "logistics"
    | "lifestyle"
  dependsOn?: {
    field: AllFieldKey
    values: string[]
  }
}

// Comprehensive field configuration
export const FIELD_CONFIG: Record<AllFieldKey, FieldConfig> = {
  // CORE IDENTITY - Always required
  name: {
    key: "name",
    label: "Name",
    intent: "User's name for personalization",
    examples: ["What's your name?", "What should I call you?"],
    extractionHints: ["first name", "full name", "nickname", "I'm", "my name is"],
    required: true,
    category: "core",
  },
  citizenship: {
    key: "citizenship",
    label: "Citizenship",
    intent: "Passport/nationality for visa eligibility",
    examples: ["What's your citizenship?", "Which passport do you hold?"],
    extractionHints: ["nationality", "passport", "citizen of", "I'm from", "I hold"],
    required: true,
    category: "core",
  },
  other_citizenships: {
    key: "other_citizenships",
    label: "Other Citizenships",
    intent: "Dual/multiple passports that may unlock additional visa pathways",
    examples: ["Do you hold any other passports or citizenships?", "Any dual citizenship?"],
    extractionHints: ["also have", "dual", "another passport", "second citizenship", "both", "and"],
    required: false, // Only ask if user mentions or context suggests multiple citizenships
    category: "core",
  },
  birth_year: {
    key: "birth_year",
    label: "Birth Year",
    intent: "Age for age-restricted visas (Working Holiday 18-30/35, retirement 50+)",
    examples: ["What year were you born?", "How old are you?"],
    extractionHints: ["born in", "I'm", "years old", "age", "born", "birthday"],
    required: false, // Only ask if destination has age-restricted visas or user mentions age
    category: "core",
  },
  current_location: {
    key: "current_location",
    label: "Current Location",
    intent: "Where user currently lives for consulate routing",
    examples: ["Where are you currently based?", "Which country do you live in now?"],
    extractionHints: ["living in", "based in", "currently in", "residing", "located"],
    required: true,
    category: "core",
  },

  // DESTINATION - Always required
  destination: {
    key: "destination",
    label: "Destination Country",
    intent: "Target country for relocation",
    examples: ["Which country are you planning to move to?", "Where do you want to relocate?"],
    extractionHints: ["move to", "relocate to", "going to", "destination", "moving to"],
    required: true,
    category: "core",
  },
  target_city: {
    key: "target_city",
    label: "Target City",
    intent: "Specific city for housing and cost of living info",
    examples: ["Do you have a specific city in mind?", "Which city are you planning to live in?"],
    extractionHints: ["city", "live in", "moving to", "area", "region"],
    required: true,
    category: "core",
  },
  purpose: {
    key: "purpose",
    label: "Purpose",
    intent: "Primary reason: study, work, settle, digital nomad",
    examples: ["What's the main purpose of your move?", "Are you moving for work, study, or something else?"],
    extractionHints: ["study", "work", "settle", "retire", "nomad", "freelance", "job", "university"],
    required: true,
    category: "core",
  },

  // STUDY-SPECIFIC
  study_type: {
    key: "study_type",
    label: "Type of Study",
    intent: "University, language school, vocational, or exchange program",
    examples: ["What type of study program are you looking at?", "Are you planning to attend university, a language school, or something else?"],
    extractionHints: ["university", "language school", "vocational", "exchange", "degree", "course", "masters", "bachelors"],
    required: (p) => p.purpose === "study",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["study"] },
  },
  study_field: {
    key: "study_field",
    label: "Field of Study",
    intent: "Academic field or subject area",
    examples: ["What will you be studying?", "What's your field of study?"],
    extractionHints: ["engineering", "medicine", "business", "arts", "science", "computer", "law"],
    required: (p) => p.purpose === "study" && p.study_type !== "language_school",
    category: "purpose_specific",
    dependsOn: { field: "study_type", values: ["university", "vocational", "exchange"] },
  },
  study_funding: {
    key: "study_funding",
    label: "Study Funding",
    intent: "How studies will be funded",
    examples: ["How are you planning to fund your studies?", "Do you have a scholarship, or will you self-fund?"],
    extractionHints: ["scholarship", "self-funded", "loan", "savings", "parents", "sponsor"],
    required: (p) => p.purpose === "study",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["study"] },
  },

  // WORK-SPECIFIC
  job_offer: {
    key: "job_offer",
    label: "Job Offer Status",
    intent: "Whether user has a job offer",
    examples: ["Do you have a job offer already?", "Have you secured employment, or are you still looking?"],
    extractionHints: ["job offer", "offer letter", "contract", "hired", "looking", "searching", "no offer"],
    required: (p) => p.purpose === "work",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["work"] },
  },
  job_field: {
    key: "job_field",
    label: "Job Field",
    intent: "Industry or profession",
    examples: ["What field or industry do you work in?", "What's your profession?"],
    extractionHints: ["tech", "IT", "healthcare", "finance", "engineering", "marketing", "teacher"],
    required: (p) => p.purpose === "work",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["work"] },
  },
  employer_sponsorship: {
    key: "employer_sponsorship",
    label: "Employer Sponsorship",
    intent: "Whether employer will sponsor visa",
    examples: ["Will your employer sponsor your visa?", "Is the company handling visa sponsorship?"],
    extractionHints: ["sponsor", "sponsorship", "company", "employer", "handle visa"],
    required: (p) => p.purpose === "work" && p.job_offer === "yes",
    category: "purpose_specific",
    dependsOn: { field: "job_offer", values: ["yes", "in_progress"] },
  },
  highly_skilled: {
    key: "highly_skilled",
    label: "Highly Skilled Professional",
    intent: "Eligibility for skilled worker visa programs",
    examples: ["Do you qualify as a highly skilled professional?", "Do you have specialized skills or advanced degrees in your field?"],
    extractionHints: ["skilled", "specialist", "expert", "senior", "advanced degree", "masters", "phd"],
    required: (p) => p.purpose === "work",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["work"] },
  },

  // DIGITAL NOMAD SPECIFIC
  remote_income: {
    key: "remote_income",
    label: "Remote Income",
    intent: "Whether user has remote income",
    examples: ["Do you earn income remotely?", "Do you work online or have remote clients?"],
    extractionHints: ["remote", "online", "freelance", "clients", "work from anywhere"],
    required: (p) => p.purpose === "digital_nomad",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["digital_nomad"] },
  },
  income_source: {
    key: "income_source",
    label: "Income Source",
    intent: "Type of remote work",
    examples: ["What's your source of income?", "Are you a freelancer, remote employee, or business owner?"],
    extractionHints: ["freelance", "employed", "business", "contractor", "self-employed"],
    required: (p) => p.purpose === "digital_nomad",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["digital_nomad"] },
  },
  monthly_income: {
    key: "monthly_income",
    label: "Monthly Income",
    intent: "Income level for digital nomad visa requirements",
    examples: ["What's your approximate monthly income?", "How much do you earn per month?"],
    extractionHints: ["per month", "monthly", "income", "earn", "make", "salary"],
    required: (p) => p.purpose === "digital_nomad",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["digital_nomad"] },
  },
  income_consistency: {
    key: "income_consistency",
    label: "Income Consistency",
    intent: "How stable/consistent the income is - important for DN visa proof",
    examples: ["Is your income fairly consistent month-to-month?", "Would you say your income is stable, or does it vary a lot?"],
    extractionHints: ["stable", "consistent", "regular", "variable", "fluctuates", "varies", "new", "just started"],
    required: (p) => p.purpose === "digital_nomad",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["digital_nomad"] },
  },
  income_history_months: {
    key: "income_history_months",
    label: "Income History",
    intent: "How long user has had this income - many DN visas require 6-12 months proof",
    examples: ["How long have you been earning this income?", "How many months of income history can you show?"],
    extractionHints: ["months", "years", "been freelancing", "started", "working for", "since"],
    required: (p) => p.purpose === "digital_nomad",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["digital_nomad"] },
  },

  // SETTLEMENT SPECIFIC
  settlement_reason: {
    key: "settlement_reason",
    label: "Settlement Reason",
    intent: "Specific reason for permanent settlement",
    examples: ["What's bringing you to settle there permanently?", "Is this for retirement, family, investment, or another reason?"],
    extractionHints: [
      "retire", "retirement", // retirement
      "family", "family reunion", "join family", // family_reunion
      "investment", "investor", "business", // investment
      "ancestry", "heritage", "grandparents", "roots", // ancestry
      "spouse", "husband", "wife", "partner", "spouse_work", // spouse_work
      "fiancé", "fiancee", "engaged", "getting married", "marriage", // fiancé
      "cohabitant", "sambo", "living together", "move in", // cohabitation
    ],
    required: (p) => p.purpose === "settle" || p.visa_role === "dependent",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["settle"] },
  },
  family_ties: {
    key: "family_ties",
    label: "Family Ties",
    intent: "Existing family connections in destination",
    examples: ["Do you have any family already living there?", "Are there relatives who can support your application?"],
    extractionHints: ["family", "relatives", "spouse", "parent", "sibling", "citizen"],
    required: (p) => p.purpose === "settle",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["settle"] },
  },

  // VISA ROLE - Determines if user is primary applicant or joining someone
  visa_role: {
    key: "visa_role",
    label: "Visa Role",
    intent: "Whether user is the primary visa applicant or joining someone else (dependent)",
    examples: ["Are you applying for the visa yourself, or joining someone who already has one?", "Will you be the main visa holder, or are you accompanying someone?"],
    extractionHints: ["joining", "accompanying", "my partner has", "my spouse works", "following", "dependent", "main applicant", "primary", "myself"],
    required: true,
    category: "core",
  },

  // PARTNER/SPONSOR INFO - Only for dependents and family reunion
  partner_citizenship: {
    key: "partner_citizenship",
    label: "Partner's Citizenship",
    intent: "Citizenship/nationality of the partner or sponsor",
    examples: ["What's your partner's citizenship?", "Is your spouse a citizen there, or do they hold a different nationality?"],
    extractionHints: ["citizen", "citizenship", "nationality", "passport", "Swedish", "German", "American", "local"],
    required: (p) => p.visa_role === "dependent" || p.settlement_reason === "family_reunion",
    category: "family",
    // No dependsOn: the required() predicate already encodes both
    // dependent-cascade and family_reunion-cascade. A dependsOn gate
    // on visa_role==="dependent" used to nullify the family_reunion
    // branch entirely (primary applicants joining a partner never got
    // asked partner_*), producing visa research with no relationship
    // basis to reason on. Bug fixed 2026-05.
  },
  partner_visa_status: {
    key: "partner_visa_status",
    label: "Partner's Visa/Residency Status",
    intent: "What visa or residency status the partner holds",
    examples: ["What's your partner's residency status there?", "Does your partner have citizenship, permanent residency, or a work visa?"],
    extractionHints: ["citizen", "permanent resident", "work visa", "student visa", "residency", "PR", "green card", "settled"],
    required: (p) => p.visa_role === "dependent" || p.settlement_reason === "family_reunion",
    category: "family",
  },
  partner_residency_duration: {
    key: "partner_residency_duration",
    label: "Partner's Time in Country",
    intent: "How long partner has been living in destination",
    examples: ["How long has your partner been living there?", "When did your partner move there?"],
    extractionHints: ["years", "months", "since", "moved", "living there", "been there"],
    required: false, // Only ask if relevant for visa type
    category: "family",
  },
  relationship_type: {
    key: "relationship_type",
    label: "Relationship Type",
    intent: "Type of relationship with partner/sponsor (incl. Swedish sambo / cohabitant)",
    examples: ["What's your relationship?", "Are you married, in a registered partnership, or sambo (cohabiting)?"],
    extractionHints: ["married", "spouse", "wife", "husband", "fiancé", "engaged", "partner", "cohabitant", "sambo", "boyfriend", "girlfriend", "live together", "living together"],
    required: (p) => p.visa_role === "dependent" || p.settlement_reason === "family_reunion",
    category: "family",
  },
  relationship_duration: {
    key: "relationship_duration",
    label: "Relationship Duration",
    intent: "How long in the relationship (some visas require proof)",
    examples: ["How long have you been together?", "When did you get married or start your relationship?"],
    extractionHints: ["years", "months", "since", "married in", "together for", "met", "dating"],
    required: false, // Only ask if relevant for specific visa types
    category: "family",
  },

  // TIMELINE & DURATION - Always required
  duration: {
    key: "duration",
    label: "Duration",
    intent: "Intended length of stay",
    examples: ["How long are you planning to stay?", "Is this temporary or permanent?"],
    extractionHints: ["months", "years", "permanent", "temporary", "indefinitely", "1 year", "2 years"],
    required: true,
    category: "core",
  },
  timeline: {
    key: "timeline",
    label: "Timeline",
    intent: "When user plans to move",
    examples: ["When are you planning to move?", "What's your target move date?"],
    extractionHints: ["next month", "this year", "6 months", "ASAP", "spring", "fall", "January"],
    required: true,
    category: "core",
  },

  // FAMILY & DEPENDENTS
  moving_alone: {
    key: "moving_alone",
    label: "Moving Alone",
    intent: "Whether relocating solo or with others",
    examples: ["Will you be moving alone or with others?", "Is anyone joining you on this move?"],
    extractionHints: ["alone", "by myself", "solo", "with", "family", "partner", "spouse"],
    required: true,
    category: "family",
  },
  spouse_joining: {
    key: "spouse_joining",
    label: "Spouse Joining",
    intent: "Whether partner/spouse is relocating too",
    examples: ["Will your spouse or partner be joining you?", "Is your partner moving with you or later?"],
    extractionHints: ["spouse", "partner", "husband", "wife", "girlfriend", "boyfriend", "together"],
    required: (p) => p.moving_alone === "no",
    category: "family",
    dependsOn: { field: "moving_alone", values: ["no"] },
  },
  children_count: {
    key: "children_count",
    label: "Number of Children",
    intent: "How many children are relocating",
    examples: ["How many children will be joining you?", "Do you have kids moving with you?"],
    extractionHints: ["children", "kids", "child", "son", "daughter", "1", "2", "3"],
    required: (p) => p.moving_alone === "no",
    category: "family",
    dependsOn: { field: "moving_alone", values: ["no"] },
  },
  children_ages: {
    key: "children_ages",
    label: "Children's Ages",
    intent: "Ages for school planning",
    examples: ["How old are your children?", "What are your kids' ages?"],
    extractionHints: ["years old", "age", "teenager", "toddler", "infant", "school-age"],
    required: (p) => Boolean(p.moving_alone === "no" && p.children_count && p.children_count !== "0"),
    category: "family",
    dependsOn: { field: "children_count", values: ["1", "2", "3", "4", "5"] },
  },

  // FINANCIAL
  savings_available: {
    key: "savings_available",
    label: "Available Savings",
    intent: "Total savings for relocation",
    examples: ["How much have you saved for this move?", "What's your relocation budget?"],
    extractionHints: ["saved", "savings", "budget", "have", "set aside", "USD", "EUR", "GBP"],
    required: true,
    category: "financial",
  },
  monthly_budget: {
    key: "monthly_budget",
    label: "Monthly Budget",
    intent: "Expected monthly spending",
    examples: ["What's your expected monthly budget once there?", "How much can you spend per month?"],
    extractionHints: ["per month", "monthly", "rent", "expenses", "cost", "afford"],
    required: true,
    category: "financial",
  },
  preferred_currency: {
    key: "preferred_currency",
    label: "Preferred Currency",
    intent: "Currency the user wants all amounts displayed in",
    examples: ["What currency do you prefer?", "Would you like amounts shown in SEK, EUR, or another currency?"],
    extractionHints: ["currency", "SEK", "EUR", "USD", "GBP", "kr", "dollars", "euros", "pounds"],
    required: false,
    category: "financial",
  },
  need_budget_help: {
    key: "need_budget_help",
    label: "Budget Help Needed",
    intent: "Whether user needs help with budgeting",
    examples: ["Would you like help planning your budget?", "Should I help you estimate costs?"],
    extractionHints: ["help", "estimate", "plan", "figure out", "not sure", "yes", "no"],
    required: false, // Offer only if user seems uncertain about finances
    category: "financial",
  },

  // BACKGROUND
  language_skill: {
    key: "language_skill",
    label: "Language Skills",
    intent: "Proficiency in destination language",
    examples: ["How's your proficiency in the local language?", "Do you speak the language?"],
    extractionHints: ["fluent", "beginner", "intermediate", "native", "none", "basic", "A1", "B2"],
    required: false, // Optional - ask only if relevant to visa type or user mentions language
    category: "background",
  },
  education_level: {
    key: "education_level",
    label: "Education Level",
    intent: "Highest qualification achieved",
    examples: ["What's your highest level of education?", "Do you have a degree?"],
    extractionHints: ["degree", "masters", "bachelors", "PhD", "high school", "vocational", "diploma"],
    required: (p) => p.purpose === "work" || p.purpose === "study", // Only required for work/study visas
    category: "background",
  },
  years_experience: {
    key: "years_experience",
    label: "Work Experience",
    intent: "Years of professional experience",
    examples: ["How many years of work experience do you have?", "How long have you been working in your field?"],
    extractionHints: ["years", "experience", "worked", "career", "professional"],
    required: (p) => p.purpose === "work",
    category: "background",
    dependsOn: { field: "purpose", values: ["work"] },
  },

  // LEGAL/VISA HISTORY - Only ask if relevant or user mentions visa concerns
  prior_visa: {
    key: "prior_visa",
    label: "Prior Visa History",
    intent: "Previous visas for destination country",
    examples: ["Have you held any visas for this country before?", "Have you visited or lived there previously?"],
    extractionHints: ["visited", "lived", "previous visa", "been there", "traveled", "tourist"],
    required: false, // Only ask if user mentions visa history or concerns
    category: "legal",
  },
  visa_rejections: {
    key: "visa_rejections",
    label: "Visa Rejections",
    intent: "Any previous visa rejections",
    examples: ["Have you ever had a visa rejected?", "Any previous visa issues we should know about?"],
    extractionHints: ["rejected", "denied", "refused", "overstay", "issues", "problems", "no"],
    required: false, // Only ask if user mentions visa issues or has prior_visa
    category: "legal",
  },

  // HEALTHCARE & SPECIAL NEEDS — always asked so important facts aren't lost.
  // Users can answer "none" to skip; we don't want to silently drop a stated
  // medical condition or a pet because the chat never surfaced the question.
  healthcare_needs: {
    key: "healthcare_needs",
    label: "Healthcare Needs",
    intent: "Medical requirements and conditions",
    examples: ["Do you have any ongoing healthcare needs?", "Any medical conditions we should consider for your move?"],
    extractionHints: ["medical", "health", "condition", "medication", "doctor", "treatment", "none"],
    required: true,
    category: "special",
  },
  pets: {
    key: "pets",
    label: "Pets",
    intent: "Animals relocating with user",
    examples: ["Will you be bringing any pets?", "Do you have animals that need to travel with you?"],
    extractionHints: ["pet", "dog", "cat", "animal", "bird", "none", "no pets"],
    required: true,
    category: "special",
  },
  special_requirements: {
    key: "special_requirements",
    label: "Special Requirements",
    intent: "Any other special considerations",
    examples: ["Anything else I should know about your situation?", "Any other special requirements?"],
    extractionHints: ["special", "specific", "requirement", "need", "consideration", "none", "no"],
    required: false,
    category: "special",
  },

  // ====================================================================
  // V2 AGENCY-GRADE FIELDS (Wave 1.2)
  // Every entry below uses a predicate-based `required` (never bare `true`).
  // Religious / offshore / embassy / emergency / insurance / investments
  // fields are NEVER required — Question Director must not surface them
  // unless the user explicitly volunteers them.
  // ====================================================================

  // -------- Posted-worker / corporate-posting --------
  posting_or_secondment: {
    key: "posting_or_secondment",
    label: "Corporate Posting / Secondment",
    intent: "Whether the move is a corporate posting from the user's current employer (triggers A1/CoC/PWD obligations)",
    examples: [
      "Is this a corporate posting from your current employer?",
      "Are you being seconded by your company?",
    ],
    extractionHints: ["posting", "posted", "secondment", "seconded", "company sending", "transfer", "intra-company", "ICT", "expat assignment"],
    required: (p) => p.purpose === "work" && p.visa_role === "primary",
    category: "purpose_specific",
    dependsOn: { field: "purpose", values: ["work"] },
  },
  home_country_employer: {
    key: "home_country_employer",
    label: "Home Country Employer",
    intent: "Employer name in origin country (required for posted worker declarations)",
    examples: ["What's the name of your employer in your home country?", "Which company is sending you on this posting?"],
    extractionHints: ["employer", "company", "work for", "employed by", "Inc", "AB", "GmbH", "Ltd"],
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    category: "purpose_specific",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  posting_employer_address: {
    key: "posting_employer_address",
    label: "Posting Employer Address",
    intent: "Home country employer's registered address (for posted worker declarations and A1 certificate)",
    examples: ["What's the registered address of your home country employer?", "Do you have the legal/registered address for the sending company?"],
    extractionHints: ["address", "headquarters", "registered office", "street", "based in"],
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    category: "purpose_specific",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  posting_duration_months: {
    key: "posting_duration_months",
    label: "Posting Duration (Months)",
    intent: "Length of the posting in months (max 24 months for EU A1 certificate)",
    examples: ["How many months will the posting last?", "What's the planned duration of your assignment in months?"],
    extractionHints: ["months", "year", "weeks", "duration", "assignment length", "posting until"],
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    category: "purpose_specific",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  a1_certificate_status: {
    key: "a1_certificate_status",
    label: "A1 Certificate Status",
    intent: "EU social security continuity certificate (proves home country social security continues during posting; values: not_started | in_progress | obtained | not_applicable)",
    examples: ["Have you obtained your A1 certificate yet?", "Is the A1 certificate process started, in progress, or done?"],
    extractionHints: ["A1", "social security certificate", "form A1", "posted worker certificate", "Försäkringskassan", "DRV", "applied", "received", "obtained", "not started", "in progress"],
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    category: "purpose_specific",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  coc_status: {
    key: "coc_status",
    label: "Certificate of Coverage Status",
    intent: "Bilateral social security treaty Certificate of Coverage for non-EU postings (US-Sweden, India-Sweden, etc.; values: not_started | in_progress | obtained | not_applicable)",
    examples: ["Have you applied for a Certificate of Coverage?", "Is the bilateral CoC for your posting started, in progress, or done?"],
    extractionHints: ["certificate of coverage", "CoC", "totalization", "bilateral treaty", "SSA-2470", "social security agreement"],
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    category: "purpose_specific",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  pwd_filed: {
    key: "pwd_filed",
    label: "Posted Worker Declaration Filed",
    intent: "Posted Worker Declaration filed with destination labor authority (Arbetsmiljöverket in Sweden, ZOLL in Germany) — must be filed before work starts",
    examples: ["Has the Posted Worker Declaration been filed with the destination authority?", "Is the PWD filing complete?"],
    extractionHints: ["PWD", "posted worker declaration", "Arbetsmiljöverket", "ZOLL", "labor authority", "filed", "submitted"],
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    category: "purpose_specific",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },

  // -------- Prior immigration history --------
  prior_visa_country: {
    key: "prior_visa_country",
    label: "Prior Visa Country",
    intent: "Country that issued the prior visa",
    examples: ["Which country issued your prior visa?", "Where was your previous visa from?"],
    extractionHints: ["country", "issued by", "visa from", "Schengen", "US visa", "UK visa"],
    required: (p) => p.prior_visa === "yes",
    category: "legal",
    dependsOn: { field: "prior_visa", values: ["yes"] },
  },
  prior_visa_type: {
    key: "prior_visa_type",
    label: "Prior Visa Type",
    intent: "Type/category of the prior visa",
    examples: ["What type of visa did you previously hold?", "Was it a tourist, student, work, or other category?"],
    extractionHints: ["tourist", "student", "work", "Schengen", "B1/B2", "F-1", "H-1B", "Tier 2", "type", "category"],
    required: (p) => p.prior_visa === "yes",
    category: "legal",
    dependsOn: { field: "prior_visa", values: ["yes"] },
  },
  prior_residence_outside_origin: {
    key: "prior_residence_outside_origin",
    label: "Prior Residence Outside Origin",
    intent: "Countries the user has lived in for 6+ months outside origin (police clearance and immigration history)",
    examples: ["Which countries have you lived in for 6 or more months?", "Any countries outside your home country where you've lived long-term?"],
    extractionHints: ["lived in", "resided", "6 months", "year", "stayed", "based in", "expat in"],
    required: false,
    category: "legal",
  },

  // -------- Document logistics (apostilles + clearances) --------
  birth_certificate_apostille_status: {
    key: "birth_certificate_apostille_status",
    label: "Birth Certificate Apostille",
    intent: "Apostille status for the user's birth certificate (values: not_needed | in_progress | obtained)",
    examples: ["What's the status of your birth certificate apostille?", "Have you legalized your birth certificate?"],
    extractionHints: ["birth certificate", "apostille", "legalized", "Hague", "consularized", "not needed", "in progress", "obtained"],
    required: (p) =>
      p.visa_role === "dependent" ||
      p.settlement_reason === "family_reunion" ||
      p.purpose === "settle",
    category: "documents",
  },
  marriage_certificate_apostille_status: {
    key: "marriage_certificate_apostille_status",
    label: "Marriage Certificate Apostille",
    intent: "Apostille status for the user's marriage certificate (values: not_needed | in_progress | obtained) — only when married",
    examples: ["Have you apostilled your marriage certificate?", "What's the status of legalizing your marriage certificate?"],
    extractionHints: ["marriage certificate", "marriage cert", "apostille", "legalized", "Hague"],
    required: (p) =>
      p.relationship_type === "spouse" || p.relationship_type === "registered_partner",
    category: "documents",
    dependsOn: { field: "relationship_type", values: ["spouse", "registered_partner"] },
  },
  diploma_apostille_status: {
    key: "diploma_apostille_status",
    label: "Diploma Apostille",
    intent: "Apostille status for academic diplomas (required for skilled visa categories; values: not_needed | in_progress | obtained)",
    examples: ["Have you apostilled your diploma?", "What's the status of legalizing your degree certificate?"],
    extractionHints: ["diploma", "degree certificate", "apostille", "legalized", "transcript", "academic"],
    required: (p) =>
      (p.purpose === "work" && p.highly_skilled === "yes") ||
      (p.purpose === "study" && (p.study_type === "university" || p.study_type === "vocational")),
    category: "documents",
  },
  police_clearance_status: {
    key: "police_clearance_status",
    label: "Police Clearance Status",
    intent: "Police clearance / criminal background certificate from origin (values: not_needed | applied | obtained)",
    examples: ["Have you applied for a police clearance certificate?", "What's the status of your background check?"],
    extractionHints: ["police clearance", "criminal background", "background check", "FBI check", "DBS", "good conduct", "applied", "obtained"],
    required: (p) =>
      p.visa_role === "primary" &&
      (p.purpose === "work" || p.purpose === "study" || p.purpose === "settle"),
    category: "documents",
  },
  medical_exam_required: {
    key: "medical_exam_required",
    label: "Medical Exam Required",
    intent: "Whether destination + visa type requires a medical exam (DERIVED — not asked directly)",
    examples: ["(derived from destination and visa type)"],
    extractionHints: ["medical exam", "TB test", "panel physician", "health check"],
    required: false,
    category: "documents",
  },

  // -------- Trailing spouse / dependent --------
  spouse_career_field: {
    key: "spouse_career_field",
    label: "Spouse's Career Field",
    intent: "Spouse/partner's career field (for trailing-spouse work permit and labor market matching)",
    examples: ["What field does your spouse work in?", "What's your partner's profession?"],
    extractionHints: ["spouse works", "partner is a", "career", "profession", "field", "industry"],
    required: (p) => p.spouse_joining === "yes",
    category: "family",
    dependsOn: { field: "spouse_joining", values: ["yes"] },
  },
  spouse_seeking_work: {
    key: "spouse_seeking_work",
    label: "Spouse Seeking Work",
    intent: "Whether spouse intends to seek work in destination (affects dependent work-permit pathway)",
    examples: ["Does your spouse plan to look for work in the destination?", "Will your partner seek employment after the move?"],
    extractionHints: ["spouse work", "partner job", "looking for work", "seek employment", "career break", "stay-at-home"],
    required: (p) => p.spouse_joining === "yes",
    category: "family",
    dependsOn: { field: "spouse_joining", values: ["yes"] },
  },
  spouse_language_skills: {
    key: "spouse_language_skills",
    label: "Spouse Language Skills",
    intent: "Spouse's destination-language proficiency (low / medium / high)",
    examples: ["How would you rate your spouse's destination-language skills?", "Does your partner speak the local language?"],
    extractionHints: ["spouse speaks", "partner speaks", "fluent", "beginner", "intermediate", "low", "medium", "high"],
    required: (p) => p.spouse_joining === "yes",
    category: "family",
    dependsOn: { field: "spouse_joining", values: ["yes"] },
  },
  spouse_visa_dependency: {
    key: "spouse_visa_dependency",
    label: "Spouse Visa Dependency",
    intent: "How spouse's visa derives from primary applicant's (e.g., dependent permit, joining family member)",
    examples: ["How will your spouse's visa be tied to yours?", "Is your spouse coming on a dependent permit derived from yours?"],
    extractionHints: ["dependent visa", "joining family", "derived", "tied to my visa", "follower", "secondary"],
    required: (p) => p.spouse_joining === "yes",
    category: "family",
    dependsOn: { field: "spouse_joining", values: ["yes"] },
  },

  // -------- Children specifics --------
  children_school_type_preference: {
    key: "children_school_type_preference",
    label: "Children's School Type Preference",
    intent: "Preferred school type (public / private / international / no_preference)",
    examples: ["What kind of school are you considering for the kids?", "Public, private, or international school for your children?"],
    extractionHints: ["public school", "private school", "international school", "IB", "British school", "American school", "no preference"],
    required: (p) => Boolean(p.children_count && p.children_count !== "0"),
    category: "family",
    dependsOn: { field: "children_count", values: ["1", "2", "3", "4", "5"] },
  },
  children_language_skills_destination: {
    key: "children_language_skills_destination",
    label: "Children's Destination Language Skills",
    intent: "Children's destination-language proficiency (low / medium / high)",
    examples: ["Do your children speak the destination language?", "How comfortable are the kids with the local language?"],
    extractionHints: ["children speak", "kids language", "fluent", "beginner", "low", "medium", "high"],
    required: (p) => Boolean(p.children_count && p.children_count !== "0"),
    category: "family",
    dependsOn: { field: "children_count", values: ["1", "2", "3", "4", "5"] },
  },
  children_special_needs: {
    key: "children_special_needs",
    label: "Children's Special Needs",
    intent: "Free-text disclosure of children's special needs (always optional)",
    examples: ["Do any of your children have special educational or healthcare needs?"],
    extractionHints: ["special needs", "IEP", "autism", "ADHD", "disability", "accommodations"],
    required: false,
    category: "family",
  },
  children_birth_certificate_apostille_status: {
    key: "children_birth_certificate_apostille_status",
    label: "Children's Birth Certificate Apostille",
    intent: "Apostille status for children's birth certificates (required for dependent visa applications; values: not_needed | in_progress | obtained)",
    examples: ["Have you apostilled your children's birth certificates?"],
    extractionHints: ["children birth certificate", "kids birth cert", "apostille", "legalized", "Hague"],
    required: (p) => Boolean(p.children_count && p.children_count !== "0"),
    category: "documents",
    dependsOn: { field: "children_count", values: ["1", "2", "3", "4", "5"] },
  },

  // -------- Healthcare specifics --------
  chronic_condition_description: {
    key: "chronic_condition_description",
    label: "Chronic Condition Description",
    intent: "Free-text description of chronic medical condition (for healthcare continuity planning)",
    examples: ["Could you describe the chronic condition?", "Tell me a bit about the medical condition we should plan for"],
    extractionHints: ["diabetes", "asthma", "chronic", "ongoing condition", "diagnosis"],
    required: (p) => Boolean(p.healthcare_needs && p.healthcare_needs !== "none"),
    category: "special",
    dependsOn: { field: "healthcare_needs", values: ["chronic_condition", "disability", "yes"] },
  },
  prescription_medications: {
    key: "prescription_medications",
    label: "Takes Prescription Medications",
    intent: "Whether user takes prescription medications (some are restricted in destination — Adderall in Japan, codeine in many countries)",
    examples: ["Do you take any prescription medications?", "Any regular prescriptions we should plan for?"],
    extractionHints: ["medication", "prescription", "pills", "drugs", "take daily", "Adderall", "Vyvanse", "codeine"],
    required: (p) => Boolean(p.healthcare_needs && p.healthcare_needs !== "none"),
    category: "special",
    dependsOn: { field: "healthcare_needs", values: ["chronic_condition", "disability", "yes"] },
  },
  english_speaking_doctor_required: {
    key: "english_speaking_doctor_required",
    label: "English-Speaking Doctor Required",
    intent: "Whether the user requires an English-speaking doctor in destination",
    examples: ["Will you need an English-speaking doctor?", "Do you need a clinic that operates in English?"],
    extractionHints: ["English-speaking", "English doctor", "language barrier", "translator"],
    required: (p) => Boolean(p.healthcare_needs && p.healthcare_needs !== "none"),
    category: "special",
    dependsOn: { field: "healthcare_needs", values: ["chronic_condition", "disability", "yes"] },
  },

  // -------- Healthcare continuity --------
  prescription_medications_list: {
    key: "prescription_medications_list",
    label: "Prescription Medications List",
    intent: "Free-text list of medications (for restriction checking; e.g. Adderall illegal in Japan, certain CBD in UAE)",
    examples: ["Could you list the prescription medications by name?", "What medications are you taking?"],
    extractionHints: ["mg", "tablets", "prescribed", "medication name", "brand"],
    required: (p) => p.prescription_medications === "yes",
    category: "special",
    dependsOn: { field: "prescription_medications", values: ["yes"] },
  },
  pre_existing_condition_disclosure_concern: {
    key: "pre_existing_condition_disclosure_concern",
    label: "Pre-Existing Condition Disclosure Concern",
    intent: "Whether user has concerns about disclosing pre-existing conditions for visa/insurance",
    examples: ["Any concerns about disclosing your medical history for visa or insurance?"],
    extractionHints: ["disclosure", "privacy", "pre-existing", "insurance denial", "concern"],
    required: false,
    category: "special",
  },

  // -------- Pet specifics --------
  pet_microchip_status: {
    key: "pet_microchip_status",
    label: "Pet Microchip Status",
    intent: "Whether pet has an ISO 11784/11785 compliant microchip (required for most international pet imports)",
    examples: ["Is your pet microchipped?", "Does your pet have an ISO-compliant microchip?"],
    extractionHints: ["microchip", "chipped", "ISO", "11784", "implant"],
    required: (p) => Boolean(p.pets && p.pets !== "none"),
    category: "special",
    dependsOn: { field: "pets", values: ["dog", "cat", "other", "yes"] },
  },
  pet_vaccination_status: {
    key: "pet_vaccination_status",
    label: "Pet Vaccination Status",
    intent: "Pet vaccination currency (current / outdated / starting) — rabies and core vaccines",
    examples: ["Are your pet's vaccinations up to date?", "Has your pet had its rabies shots?"],
    extractionHints: ["vaccinated", "rabies", "shots", "up to date", "outdated", "current"],
    required: (p) => Boolean(p.pets && p.pets !== "none"),
    category: "special",
    dependsOn: { field: "pets", values: ["dog", "cat", "other", "yes"] },
  },
  pet_size_weight: {
    key: "pet_size_weight",
    label: "Pet Size / Weight",
    intent: "Pet size and weight (cabin vs cargo decisions; size-based housing restrictions)",
    examples: ["How big is your pet, roughly?", "What's your pet's weight?"],
    extractionHints: ["kg", "lbs", "small", "medium", "large", "weight", "pounds", "kilograms"],
    required: (p) => Boolean(p.pets && p.pets !== "none"),
    category: "special",
    dependsOn: { field: "pets", values: ["dog", "cat", "other", "yes"] },
  },
  pet_breed: {
    key: "pet_breed",
    label: "Pet Breed",
    intent: "Pet breed (some destinations restrict specific breeds — banned-breed lists)",
    examples: ["What breed is your pet?"],
    extractionHints: ["breed", "Labrador", "Pit Bull", "Rottweiler", "mixed", "mutt", "Persian", "Siamese"],
    required: (p) => Boolean(p.pets && p.pets !== "none"),
    category: "special",
    dependsOn: { field: "pets", values: ["dog", "cat", "other", "yes"] },
  },
  pet_age: {
    key: "pet_age",
    label: "Pet Age",
    intent: "Pet age (travel risk; some carriers restrict by age)",
    examples: ["How old is your pet?"],
    extractionHints: ["years old", "puppy", "kitten", "senior", "age"],
    required: (p) => Boolean(p.pets && p.pets !== "none"),
    category: "special",
    dependsOn: { field: "pets", values: ["dog", "cat", "other", "yes"] },
  },

  // -------- Vehicle import --------
  bringing_vehicle: {
    key: "bringing_vehicle",
    label: "Bringing Vehicle",
    intent: "Whether the user plans to import a vehicle to the destination (gating question; surfaced contextually by Coordinator)",
    examples: ["Are you planning to bring a vehicle with you?", "Will you import a car?"],
    extractionHints: ["bring car", "import vehicle", "shipping car", "drive over", "selling car"],
    required: false,
    category: "logistics",
  },
  vehicle_make_model_year: {
    key: "vehicle_make_model_year",
    label: "Vehicle Make/Model/Year",
    intent: "Vehicle identification (for import compliance and registration)",
    examples: ["What's the make, model, and year of the vehicle?"],
    extractionHints: ["make", "model", "year", "Toyota", "Tesla", "BMW", "Honda"],
    required: (p) => p.bringing_vehicle === "yes",
    category: "logistics",
    dependsOn: { field: "bringing_vehicle", values: ["yes"] },
  },
  vehicle_origin_country: {
    key: "vehicle_origin_country",
    label: "Vehicle Origin Country",
    intent: "Where the vehicle is being shipped from (for export/import paperwork)",
    examples: ["Which country are you shipping the vehicle from?"],
    extractionHints: ["from", "shipping from", "origin", "exporting from"],
    required: (p) => p.bringing_vehicle === "yes",
    category: "logistics",
    dependsOn: { field: "bringing_vehicle", values: ["yes"] },
  },
  vehicle_emission_standard: {
    key: "vehicle_emission_standard",
    label: "Vehicle Emission Standard",
    intent: "Emission standard (Euro 5/6, EPA Tier, etc.) — for EU import compliance",
    examples: ["Do you know the vehicle's emission standard?", "Is the car Euro 5, Euro 6, or another standard?"],
    extractionHints: ["Euro 5", "Euro 6", "EPA", "Tier", "emissions", "exhaust standard"],
    required: (p) => p.bringing_vehicle === "yes",
    category: "logistics",
    dependsOn: { field: "bringing_vehicle", values: ["yes"] },
  },

  // -------- Property / housing intent (always optional) --------
  home_purchase_intent: {
    key: "home_purchase_intent",
    label: "Home Purchase Intent",
    intent: "Whether user intends to purchase a home (vs renting) — for mortgage / property tax planning",
    examples: ["Are you planning to buy a home, or rent?"],
    extractionHints: ["buy home", "purchase property", "renting", "mortgage", "buy a place"],
    required: false,
    category: "logistics",
  },
  rental_budget_max: {
    key: "rental_budget_max",
    label: "Maximum Rental Budget",
    intent: "Maximum monthly rental budget (separate from monthly_budget — used by Housing Specialist)",
    examples: ["What's the most you'd pay in rent monthly?"],
    extractionHints: ["max rent", "rental budget", "per month", "rent ceiling", "afford"],
    required: false,
    category: "logistics",
  },
  furnished_preference: {
    key: "furnished_preference",
    label: "Furnished Preference",
    intent: "Preference for furnished, unfurnished, or either (for housing search)",
    examples: ["Furnished, unfurnished, or no preference?"],
    extractionHints: ["furnished", "unfurnished", "either", "no preference"],
    required: false,
    category: "logistics",
  },
  commute_tolerance_minutes: {
    key: "commute_tolerance_minutes",
    label: "Commute Tolerance (Minutes)",
    intent: "Maximum acceptable one-way commute in minutes (for housing-vs-workplace location matching)",
    examples: ["How long a commute would you tolerate, one way?"],
    extractionHints: ["commute", "minutes", "travel time", "distance to work"],
    required: false,
    category: "logistics",
  },
  accessibility_needs: {
    key: "accessibility_needs",
    label: "Accessibility Needs",
    intent: "Free-text disclosure of accessibility needs (mobility, sensory, cognitive)",
    examples: ["Any accessibility needs we should keep in mind?"],
    extractionHints: ["accessibility", "wheelchair", "elevator", "ground floor", "ramp", "mobility"],
    required: false,
    category: "logistics",
  },

  // -------- Departure-side (origin exit tax) --------
  departure_tax_filing_required: {
    key: "departure_tax_filing_required",
    label: "Departure Tax Filing Required",
    intent: "Whether origin requires a departure-tax filing (Sweden, US, Norway, Eritrea, etc.) — DERIVED from origin",
    examples: ["(derived from origin country)"],
    extractionHints: ["exit tax", "departure tax", "expatriation tax"],
    required: false,
    category: "logistics",
  },
  exit_tax_obligations: {
    key: "exit_tax_obligations",
    label: "Exit Tax Obligations",
    intent: "Free-text summary of exit-tax obligations (populated by Tax Strategist agent in later wave)",
    examples: ["(populated by Tax Strategist agent)"],
    extractionHints: ["exit tax", "deemed disposition", "expatriation tax", "section 877A"],
    required: false,
    category: "logistics",
  },
  pension_continuity_required: {
    key: "pension_continuity_required",
    label: "Pension Continuity Required",
    intent: "Whether user has pension contributions that need continuity planning (totalization treaties, etc.)",
    examples: ["Do you have a pension that needs to keep accruing during the move?"],
    extractionHints: ["pension", "401k", "IRA", "retirement", "social security", "totalization"],
    required: false,
    category: "logistics",
  },

  // -------- Goods shipping --------
  bringing_personal_effects: {
    key: "bringing_personal_effects",
    label: "Bringing Personal Effects",
    intent: "Whether the user is shipping personal belongings to the destination (gating; surfaced contextually)",
    examples: ["Are you shipping personal belongings?", "Do you have things to ship over?"],
    extractionHints: ["shipping", "moving truck", "container", "belongings", "household goods"],
    required: false,
    category: "logistics",
  },
  estimated_goods_volume_cubic_meters: {
    key: "estimated_goods_volume_cubic_meters",
    label: "Estimated Goods Volume (m³)",
    intent: "Approximate volume of personal effects in cubic meters (for shipping quotes)",
    examples: ["Roughly how many cubic meters of belongings?"],
    extractionHints: ["cubic meters", "m3", "container", "cbm", "volume"],
    required: (p) => p.bringing_personal_effects === "yes",
    category: "logistics",
    dependsOn: { field: "bringing_personal_effects", values: ["yes"] },
  },
  goods_shipping_method: {
    key: "goods_shipping_method",
    label: "Goods Shipping Method",
    intent: "Preferred shipping method (air_freight | sea_freight | land | self_carry)",
    examples: ["How are you planning to ship — air, sea, land, or self?"],
    extractionHints: ["air freight", "sea freight", "container ship", "truck", "drive over", "self carry", "luggage"],
    required: (p) => p.bringing_personal_effects === "yes",
    category: "logistics",
    dependsOn: { field: "bringing_personal_effects", values: ["yes"] },
  },
  need_storage: {
    key: "need_storage",
    label: "Need Storage",
    intent: "Whether short-term storage is needed during the transition (between origin lease end and destination move-in)",
    examples: ["Do you need short-term storage during the move?"],
    extractionHints: ["storage unit", "warehouse", "stash", "in-between"],
    required: false,
    category: "logistics",
  },

  // -------- Origin departure logistics --------
  origin_lease_status: {
    key: "origin_lease_status",
    label: "Origin Lease Status",
    intent: "Origin housing status (owning | renting | neither) — for departure timeline",
    examples: ["Are you currently renting, owning, or neither?"],
    extractionHints: ["renting", "rent", "own", "owner", "mortgage", "neither", "staying with family"],
    required: false,
    category: "logistics",
  },
  origin_lease_termination_notice_days: {
    key: "origin_lease_termination_notice_days",
    label: "Origin Lease Termination Notice (Days)",
    intent: "Days' notice needed to terminate origin lease (typically 30-90) — for Departure Origin Services timeline",
    examples: ["How many days' notice does your landlord require?"],
    extractionHints: ["notice", "30 days", "60 days", "90 days", "termination", "break lease"],
    required: (p) => p.origin_lease_status === "renting",
    category: "logistics",
    dependsOn: { field: "origin_lease_status", values: ["renting"] },
  },

  // -------- Driver's license / mobility --------
  driver_license_origin: {
    key: "driver_license_origin",
    label: "Driver's License (Origin)",
    intent: "Whether the user holds a driver's license in their origin country (gating; surfaced contextually)",
    examples: ["Do you have a driver's license?"],
    extractionHints: ["license", "driving license", "permit", "drive"],
    required: false,
    category: "logistics",
  },
  driver_license_destination_intent: {
    key: "driver_license_destination_intent",
    label: "Destination License Intent",
    intent: "Plan for destination license (use_existing | exchange | convert | not_driving) — EU mutual recognition vs non-EU conversion paths",
    examples: ["What's your plan for driving in the destination — use the current license, exchange it, or convert?"],
    extractionHints: ["use existing", "exchange license", "convert", "not driving", "mutual recognition"],
    required: (p) => p.driver_license_origin === "yes",
    category: "logistics",
    dependsOn: { field: "driver_license_origin", values: ["yes"] },
  },

  // -------- Working remote during transition --------
  working_remote_during_transition: {
    key: "working_remote_during_transition",
    label: "Working Remote During Transition",
    intent: "Whether user will work remotely during the move period (affects tax residency rules during transition)",
    examples: ["Will you be working remotely during the move?"],
    extractionHints: ["remote", "work from anywhere", "during the move", "transition period"],
    required: false,
    category: "logistics",
  },

  // -------- Lifestyle / NEVER required (asked only if user volunteers) --------
  religious_practice_required: {
    key: "religious_practice_required",
    label: "Religious / Lifestyle Practice",
    intent: "Free-text disclosure of religious or lifestyle practice (community matching, dietary needs, schooling) — NEVER asked unprompted",
    examples: ["(only surfaced if user volunteers)"],
    extractionHints: ["mosque", "church", "synagogue", "temple", "halal", "kosher", "vegan", "religion", "faith"],
    required: false,
    category: "lifestyle",
  },
  register_with_origin_embassy_intent: {
    key: "register_with_origin_embassy_intent",
    label: "Embassy Registration Intent",
    intent: "Whether user intends to register with origin embassy (yes | no | already_registered) — NEVER asked unprompted",
    examples: ["(only surfaced if user volunteers)"],
    extractionHints: ["embassy", "consulate", "STEP", "register", "consular protection"],
    required: false,
    category: "lifestyle",
  },
  emergency_contact_origin_name: {
    key: "emergency_contact_origin_name",
    label: "Emergency Contact (Name)",
    intent: "Emergency contact name in origin country (always optional)",
    examples: ["(only surfaced if user volunteers)"],
    extractionHints: ["emergency contact", "next of kin", "in case of"],
    required: false,
    category: "lifestyle",
  },
  emergency_contact_origin_phone: {
    key: "emergency_contact_origin_phone",
    label: "Emergency Contact (Phone)",
    intent: "Emergency contact phone in origin country (always optional)",
    examples: ["(only surfaced if user volunteers)"],
    extractionHints: ["phone", "number", "contact", "reach"],
    required: false,
    category: "lifestyle",
  },
  pre_existing_investments_to_migrate: {
    key: "pre_existing_investments_to_migrate",
    label: "Pre-Existing Investments to Migrate",
    intent: "Whether user has investments needing migration planning — NEVER asked unprompted",
    examples: ["(only surfaced if user volunteers)"],
    extractionHints: ["investments", "portfolio", "stocks", "brokerage", "ISA", "401k"],
    required: false,
    category: "lifestyle",
  },
  existing_offshore_accounts: {
    key: "existing_offshore_accounts",
    label: "Existing Offshore Accounts",
    intent: "Whether user holds existing offshore accounts (FBAR/CRS reporting awareness) — NEVER asked unprompted",
    examples: ["(only surfaced if user volunteers)"],
    extractionHints: ["offshore", "FBAR", "FATCA", "CRS", "foreign account"],
    required: false,
    category: "lifestyle",
  },

  // -------- Insurance needs --------
  insurance_needs_household: {
    key: "insurance_needs_household",
    label: "Household Insurance Needed",
    intent: "Whether user needs household / contents insurance in destination",
    examples: ["Will you need household insurance?"],
    extractionHints: ["household insurance", "contents", "renter's insurance"],
    required: false,
    category: "lifestyle",
  },
  insurance_needs_vehicle: {
    key: "insurance_needs_vehicle",
    label: "Vehicle Insurance Needed",
    intent: "Whether user needs vehicle insurance (n_a if not bringing vehicle)",
    examples: ["Will you need vehicle insurance?"],
    extractionHints: ["car insurance", "auto insurance", "vehicle policy"],
    required: false,
    category: "lifestyle",
  },
  insurance_needs_life: {
    key: "insurance_needs_life",
    label: "Life Insurance Needed",
    intent: "Whether user needs life insurance review for the move",
    examples: ["Any life-insurance considerations for the move?"],
    extractionHints: ["life insurance", "term life", "policy"],
    required: false,
    category: "lifestyle",
  },
  gap_insurance_needed: {
    key: "gap_insurance_needed",
    label: "Gap Insurance Needed",
    intent: "Whether user needs gap insurance (between origin coverage end and destination coverage start)",
    examples: ["Will there be a gap between insurance coverages?"],
    extractionHints: ["gap insurance", "coverage gap", "interim", "between policies"],
    required: false,
    category: "lifestyle",
  },

  // -------- Family visa cascade awareness --------
  family_visa_cascade_aware: {
    key: "family_visa_cascade_aware",
    label: "Family Visa Cascade Awareness",
    intent: "Whether user understands the primary-then-dependent visa sequence (primary's visa must be approved before dependents apply)",
    examples: ["Are you aware that your visa is processed first, then dependents?"],
    extractionHints: ["aware", "understand", "cascade", "sequence", "dependent visa", "after primary"],
    required: (p) =>
      p.visa_role === "primary" &&
      (p.spouse_joining === "yes" || Boolean(p.children_count && p.children_count !== "0")),
    category: "family",
  },
}

// Profile data schema with all fields
export const ProfileSchema = z.object({
  // Core
  name: z.string().nullable(),
  citizenship: z.string().nullable(),
  other_citizenships: z.string().nullable(),
  birth_year: z.string().nullable(),
  current_location: z.string().nullable(),
  destination: z.string().nullable(),
  target_city: z.string().nullable(),
  purpose: z.enum(["study", "work", "settle", "digital_nomad", "other"]).nullable(),
  visa_role: z.enum(["primary", "dependent"]).nullable(),
  
  // Partner/sponsor info
  partner_citizenship: z.string().nullable(),
  partner_visa_status: z.enum(["citizen", "permanent_resident", "work_visa", "student_visa", "other"]).nullable(),
  partner_residency_duration: z.string().nullable(),
  relationship_type: z.enum(["spouse", "fiancé", "registered_partner", "cohabitant", "parent", "child", "other"]).nullable(),
  relationship_duration: z.string().nullable(),
  
  // Study-specific
  study_type: z.string().nullable(),
  study_field: z.string().nullable(),
  study_funding: z.string().nullable(),
  
  // Work-specific
  job_offer: z.string().nullable(),
  job_field: z.string().nullable(),
  employer_sponsorship: z.string().nullable(),
  highly_skilled: z.string().nullable(),
  
  // Digital nomad specific
  remote_income: z.string().nullable(),
  income_source: z.string().nullable(),
  monthly_income: z.string().nullable(),
  income_consistency: z.enum(["stable", "variable", "new"]).nullable(),
  income_history_months: z.string().nullable(),
  
  // Settlement specific
  settlement_reason: z.string().nullable(),
  family_ties: z.string().nullable(),
  
  // Timeline
  duration: z.string().nullable(),
  timeline: z.string().nullable(),
  
  // Family
  moving_alone: z.string().nullable(),
  spouse_joining: z.string().nullable(),
  children_count: z.string().nullable(),
  children_ages: z.string().nullable(),
  
  // Financial
  savings_available: z.string().nullable(),
  monthly_budget: z.string().nullable(),
  preferred_currency: z.string().nullable(),
  need_budget_help: z.string().nullable(),
  
  // Background
  language_skill: z.string().nullable(),
  education_level: z.string().nullable(),
  years_experience: z.string().nullable(),
  
  // Legal
  prior_visa: z.string().nullable(),
  visa_rejections: z.string().nullable(),
  
  // Special
  healthcare_needs: z.string().nullable(),
  pets: z.string().nullable(),
  special_requirements: z.string().nullable(),

  // === V2 AGENCY-GRADE FIELDS (Wave 1.2) ===
  // Posted-worker
  posting_or_secondment: z.string().nullable(),
  home_country_employer: z.string().nullable(),
  posting_employer_address: z.string().nullable(),
  posting_duration_months: z.string().nullable(),
  a1_certificate_status: z.string().nullable(),
  coc_status: z.string().nullable(),
  pwd_filed: z.string().nullable(),
  // Prior immigration
  prior_visa_country: z.string().nullable(),
  prior_visa_type: z.string().nullable(),
  prior_residence_outside_origin: z.string().nullable(),
  // Document logistics
  birth_certificate_apostille_status: z.string().nullable(),
  marriage_certificate_apostille_status: z.string().nullable(),
  diploma_apostille_status: z.string().nullable(),
  police_clearance_status: z.string().nullable(),
  medical_exam_required: z.string().nullable(),
  // Trailing spouse
  spouse_career_field: z.string().nullable(),
  spouse_seeking_work: z.string().nullable(),
  spouse_language_skills: z.string().nullable(),
  spouse_visa_dependency: z.string().nullable(),
  // Children specifics
  children_school_type_preference: z.string().nullable(),
  children_language_skills_destination: z.string().nullable(),
  children_special_needs: z.string().nullable(),
  children_birth_certificate_apostille_status: z.string().nullable(),
  // Healthcare specifics
  chronic_condition_description: z.string().nullable(),
  prescription_medications: z.string().nullable(),
  english_speaking_doctor_required: z.string().nullable(),
  // Healthcare continuity
  prescription_medications_list: z.string().nullable(),
  pre_existing_condition_disclosure_concern: z.string().nullable(),
  // Pet specifics
  pet_microchip_status: z.string().nullable(),
  pet_vaccination_status: z.string().nullable(),
  pet_size_weight: z.string().nullable(),
  pet_breed: z.string().nullable(),
  pet_age: z.string().nullable(),
  // Vehicle
  bringing_vehicle: z.string().nullable(),
  vehicle_make_model_year: z.string().nullable(),
  vehicle_origin_country: z.string().nullable(),
  vehicle_emission_standard: z.string().nullable(),
  // Property/housing
  home_purchase_intent: z.string().nullable(),
  rental_budget_max: z.string().nullable(),
  furnished_preference: z.string().nullable(),
  commute_tolerance_minutes: z.string().nullable(),
  accessibility_needs: z.string().nullable(),
  // Departure tax/pension
  departure_tax_filing_required: z.string().nullable(),
  exit_tax_obligations: z.string().nullable(),
  pension_continuity_required: z.string().nullable(),
  // Goods shipping
  bringing_personal_effects: z.string().nullable(),
  estimated_goods_volume_cubic_meters: z.string().nullable(),
  goods_shipping_method: z.string().nullable(),
  need_storage: z.string().nullable(),
  // Origin departure
  origin_lease_status: z.string().nullable(),
  origin_lease_termination_notice_days: z.string().nullable(),
  // Driver's license
  driver_license_origin: z.string().nullable(),
  driver_license_destination_intent: z.string().nullable(),
  // Working remote during transition
  working_remote_during_transition: z.string().nullable(),
  // Lifestyle (NEVER required)
  religious_practice_required: z.string().nullable(),
  register_with_origin_embassy_intent: z.string().nullable(),
  emergency_contact_origin_name: z.string().nullable(),
  emergency_contact_origin_phone: z.string().nullable(),
  pre_existing_investments_to_migrate: z.string().nullable(),
  existing_offshore_accounts: z.string().nullable(),
  // Insurance needs
  insurance_needs_household: z.string().nullable(),
  insurance_needs_vehicle: z.string().nullable(),
  insurance_needs_life: z.string().nullable(),
  gap_insurance_needed: z.string().nullable(),
  // Family visa cascade
  family_visa_cascade_aware: z.string().nullable(),
})

export type Profile = z.infer<typeof ProfileSchema>

// Empty profile for initialization
export const EMPTY_PROFILE: Profile = {
  name: null,
  citizenship: null,
  other_citizenships: null,
  birth_year: null,
  current_location: null,
  destination: null,
  target_city: null,
  purpose: null,
  visa_role: null,
  partner_citizenship: null,
  partner_visa_status: null,
  partner_residency_duration: null,
  relationship_type: null,
  relationship_duration: null,
  study_type: null,
  study_field: null,
  study_funding: null,
  job_offer: null,
  job_field: null,
  employer_sponsorship: null,
  highly_skilled: null,
  remote_income: null,
  income_source: null,
  monthly_income: null,
  income_consistency: null,
  income_history_months: null,
  settlement_reason: null,
  family_ties: null,
  duration: null,
  timeline: null,
  moving_alone: null,
  spouse_joining: null,
  children_count: null,
  children_ages: null,
  savings_available: null,
  monthly_budget: null,
  preferred_currency: null,
  need_budget_help: null,
  language_skill: null,
  education_level: null,
  years_experience: null,
  prior_visa: null,
  visa_rejections: null,
  healthcare_needs: null,
  pets: null,
  special_requirements: null,

  // === V2 AGENCY-GRADE FIELDS (Wave 1.2) ===
  posting_or_secondment: null,
  home_country_employer: null,
  posting_employer_address: null,
  posting_duration_months: null,
  a1_certificate_status: null,
  coc_status: null,
  pwd_filed: null,
  prior_visa_country: null,
  prior_visa_type: null,
  prior_residence_outside_origin: null,
  birth_certificate_apostille_status: null,
  marriage_certificate_apostille_status: null,
  diploma_apostille_status: null,
  police_clearance_status: null,
  medical_exam_required: null,
  spouse_career_field: null,
  spouse_seeking_work: null,
  spouse_language_skills: null,
  spouse_visa_dependency: null,
  children_school_type_preference: null,
  children_language_skills_destination: null,
  children_special_needs: null,
  children_birth_certificate_apostille_status: null,
  chronic_condition_description: null,
  prescription_medications: null,
  english_speaking_doctor_required: null,
  prescription_medications_list: null,
  pre_existing_condition_disclosure_concern: null,
  pet_microchip_status: null,
  pet_vaccination_status: null,
  pet_size_weight: null,
  pet_breed: null,
  pet_age: null,
  bringing_vehicle: null,
  vehicle_make_model_year: null,
  vehicle_origin_country: null,
  vehicle_emission_standard: null,
  home_purchase_intent: null,
  rental_budget_max: null,
  furnished_preference: null,
  commute_tolerance_minutes: null,
  accessibility_needs: null,
  departure_tax_filing_required: null,
  exit_tax_obligations: null,
  pension_continuity_required: null,
  bringing_personal_effects: null,
  estimated_goods_volume_cubic_meters: null,
  goods_shipping_method: null,
  need_storage: null,
  origin_lease_status: null,
  origin_lease_termination_notice_days: null,
  driver_license_origin: null,
  driver_license_destination_intent: null,
  working_remote_during_transition: null,
  religious_practice_required: null,
  register_with_origin_embassy_intent: null,
  emergency_contact_origin_name: null,
  emergency_contact_origin_phone: null,
  pre_existing_investments_to_migrate: null,
  existing_offshore_accounts: null,
  insurance_needs_household: null,
  insurance_needs_vehicle: null,
  insurance_needs_life: null,
  gap_insurance_needed: null,
  family_visa_cascade_aware: null,
}

// Get required fields based on current profile state
export function getRequiredFields(profile: Profile): AllFieldKey[] {
  const required: AllFieldKey[] = []
  
  for (const [key, config] of Object.entries(FIELD_CONFIG)) {
    const fieldKey = key as AllFieldKey
    
    // Check if field is required
    let isRequired = false
    if (typeof config.required === "boolean") {
      isRequired = config.required
    } else if (typeof config.required === "function") {
      isRequired = config.required(profile)
    }
    
    // Check dependencies
    if (isRequired && config.dependsOn) {
      const dependentValue = profile[config.dependsOn.field as keyof Profile]
      if (!dependentValue || !config.dependsOn.values.includes(dependentValue as string)) {
        isRequired = false
      }
    }
    
    if (isRequired) {
      required.push(fieldKey)
    }
  }
  
  return required
}

// Get field metadata (for backwards compatibility)
export const FIELD_METADATA = Object.fromEntries(
  Object.entries(FIELD_CONFIG).map(([key, config]) => [
    key,
    {
      intent: config.intent,
      examples: config.examples,
      extractionHints: config.extractionHints,
    },
  ])
) as Record<AllFieldKey, { intent: string; examples: string[]; extractionHints: string[] }>

// Legacy exports for backwards compatibility
export const REQUIRED_FIELDS = ALL_FIELDS
export type RequiredFieldKey = AllFieldKey
