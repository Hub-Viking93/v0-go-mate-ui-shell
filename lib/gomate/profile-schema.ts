import { z } from "zod"

// All possible profile fields organized by category
export const ALL_FIELDS = [
  // Core identity (always required)
  "name",
  "citizenship",
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
  category: "core" | "purpose_specific" | "family" | "financial" | "background" | "legal" | "special"
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
    dependsOn: { field: "visa_role", values: ["dependent"] },
  },
  partner_visa_status: {
    key: "partner_visa_status",
    label: "Partner's Visa/Residency Status",
    intent: "What visa or residency status the partner holds",
    examples: ["What's your partner's residency status there?", "Does your partner have citizenship, permanent residency, or a work visa?"],
    extractionHints: ["citizen", "permanent resident", "work visa", "student visa", "residency", "PR", "green card", "settled"],
    required: (p) => p.visa_role === "dependent" || p.settlement_reason === "family_reunion",
    category: "family",
    dependsOn: { field: "visa_role", values: ["dependent"] },
  },
  partner_residency_duration: {
    key: "partner_residency_duration",
    label: "Partner's Time in Country",
    intent: "How long partner has been living in destination",
    examples: ["How long has your partner been living there?", "When did your partner move there?"],
    extractionHints: ["years", "months", "since", "moved", "living there", "been there"],
    required: false, // Only ask if relevant for visa type
    category: "family",
    dependsOn: { field: "visa_role", values: ["dependent"] },
  },
  relationship_type: {
    key: "relationship_type",
    label: "Relationship Type",
    intent: "Type of relationship with partner/sponsor",
    examples: ["What's your relationship?", "Are you married, engaged, or in a registered partnership?"],
    extractionHints: ["married", "spouse", "wife", "husband", "fiancé", "engaged", "partner", "cohabitant", "sambo", "boyfriend", "girlfriend"],
    required: (p) => p.visa_role === "dependent" || p.settlement_reason === "family_reunion",
    category: "family",
    dependsOn: { field: "visa_role", values: ["dependent"] },
  },
  relationship_duration: {
    key: "relationship_duration",
    label: "Relationship Duration",
    intent: "How long in the relationship (some visas require proof)",
    examples: ["How long have you been together?", "When did you get married or start your relationship?"],
    extractionHints: ["years", "months", "since", "married in", "together for", "met", "dating"],
    required: false, // Only ask if relevant for specific visa types
    category: "family",
    dependsOn: { field: "visa_role", values: ["dependent"] },
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
    required: (p) => p.moving_alone === "no" && p.children_count && p.children_count !== "0",
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

  // HEALTHCARE & SPECIAL NEEDS - Only ask if user mentions or context suggests
  healthcare_needs: {
    key: "healthcare_needs",
    label: "Healthcare Needs",
    intent: "Medical requirements and conditions",
    examples: ["Do you have any ongoing healthcare needs?", "Any medical conditions we should consider for your move?"],
    extractionHints: ["medical", "health", "condition", "medication", "doctor", "treatment", "none"],
    required: false, // Only ask if user mentions health concerns
    category: "special",
  },
  pets: {
    key: "pets",
    label: "Pets",
    intent: "Animals relocating with user",
    examples: ["Will you be bringing any pets?", "Do you have animals that need to travel with you?"],
    extractionHints: ["pet", "dog", "cat", "animal", "bird", "none", "no pets"],
    required: false, // Only ask if user mentions pets
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
}

// Profile data schema with all fields
export const ProfileSchema = z.object({
  // Core
  name: z.string().nullable(),
  citizenship: z.string().nullable(),
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
})

export type Profile = z.infer<typeof ProfileSchema>

// Empty profile for initialization
export const EMPTY_PROFILE: Profile = {
  name: null,
  citizenship: null,
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
  need_budget_help: null,
  language_skill: null,
  education_level: null,
  years_experience: null,
  prior_visa: null,
  visa_rejections: null,
  healthcare_needs: null,
  pets: null,
  special_requirements: null,
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
