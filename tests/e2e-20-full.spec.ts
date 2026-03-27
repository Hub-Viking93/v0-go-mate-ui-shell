import { test, expect, type Page } from "@playwright/test"

const BASE = "http://localhost:3000"
const EMAIL = "axelcornelius93@gmail.com"
const PASSWORD = "AvC93!4778"
const SCREENSHOT_DIR = "/tmp/gomate_e2e_20_full"

// ─── Test Notes Accumulator ────────────────────────────────────────────────
interface TestNote {
  persona: string
  turn: number
  severity: "bug" | "warning" | "info" | "feature_gap"
  message: string
}

const allNotes: TestNote[] = []

function note(persona: string, turn: number, severity: TestNote["severity"], message: string) {
  allNotes.push({ persona, turn, severity, message })
  const icon = severity === "bug" ? "❌" : severity === "warning" ? "⚠️" : severity === "feature_gap" ? "🔍" : "ℹ️"
  console.log(`  ${icon} [${persona} T${turn}] ${message}`)
}

// ─── Result Tracking ───────────────────────────────────────────────────────
interface TabResult {
  enriched: boolean
  proseBlocks: number
  textLength: number
}

interface FullResult {
  persona: string
  onboardingComplete: boolean
  turns: number
  idleCount: number
  stuckFields: string[]
  dashboardOk: boolean
  guideGenerated: boolean
  guideTermsFound: number
  tabResults: Record<string, TabResult>
  tabsEnriched: number
  tabsTotal: number
  arrivalTriggered: boolean
  arrivalSkipReason?: string
  settlingGenerated: boolean
  settlingTaskCount: number
  settlingTermsFound: number
  postArrivalOk: boolean
  extractionBlocked: boolean
  durationSec: number
}

const allResults: FullResult[] = []

// ─── Field Label → Key mapping ─────────────────────────────────────────────
const LABEL_TO_KEY: Record<string, string> = {
  "Name": "name",
  "Destination Country": "destination",
  "Destination": "destination",
  "Target City": "target_city",
  "Purpose": "purpose",
  "Timeline": "timeline",
  "Citizenship": "citizenship",
  "Moving Alone": "moving_alone",
  "Job Offer Status": "job_offer",
  "Job Offer": "job_offer",
  "Job Field": "job_field",
  "Employer Sponsorship": "employer_sponsorship",
  "Highly Skilled": "highly_skilled",
  "Highly Skilled Professional": "highly_skilled",
  "Years of Experience": "years_experience",
  "Years Experience": "years_experience",
  "Work Experience": "years_experience",
  "Savings Available": "savings_available",
  "Available Savings": "savings_available",
  "Savings": "savings_available",
  "Monthly Budget": "monthly_budget",
  "Budget Help Needed": "need_budget_help",
  "Budget Help": "need_budget_help",
  "Current Location": "current_location",
  "Duration": "duration",
  "Intended Duration": "duration",
  "Language Skill": "language_skill",
  "Language Skills": "language_skill",
  "Education Level": "education_level",
  "Education": "education_level",
  "Prior Visa": "prior_visa",
  "Prior Visa History": "prior_visa",
  "Prior Visas": "prior_visa",
  "Visa Rejections": "visa_rejections",
  "Healthcare Needs": "healthcare_needs",
  "Healthcare": "healthcare_needs",
  "Pets": "pets",
  "Special Requirements": "special_requirements",
  "Number of Children": "children_count",
  "Children Count": "children_count",
  "Children's Ages": "children_ages",
  "Children Ages": "children_ages",
  "Spouse Joining": "spouse_joining",
  "Remote Income": "remote_income",
  "Income Source": "income_source",
  "Monthly Income": "monthly_income",
  "Income Consistency": "income_consistency",
  "Income History": "income_history_months",
  "Visa Role": "visa_role",
  "Type of Study": "study_type",
  "Study Type": "study_type",
  "Field of Study": "study_field",
  "Study Field": "study_field",
  "Study Funding": "study_funding",
  "Settlement Reason": "settlement_reason",
  "Family Ties": "family_ties",
  "Other Citizenships": "other_citizenships",
  "Birth Year": "birth_year",
  "Partner's Citizenship": "partner_citizenship",
  "Partner Citizenship": "partner_citizenship",
  "Partner's Visa/Residency Status": "partner_visa_status",
  "Partner Visa Status": "partner_visa_status",
  "Partner's Time in Country": "partner_residency_duration",
  "Relationship Type": "relationship_type",
  "Relationship Duration": "relationship_duration",
}

// ─── 20 Personas ───────────────────────────────────────────────────────────
interface Persona {
  name: string
  planTitle: string
  expectedPurpose: string
  expectedDestination: string
  expectedCity: string
  expectedCitizenship: string
  fields: Record<string, string>
  guideTerms: string[]
  settlingTerms: string[]
  postArrivalQuestion: string
  postArrivalExpectedTerms: string[]
}

const PERSONAS: Persona[] = [
  // 1. Work - solo - Germany/Berlin - Nigerian
  {
    name: "Adebayo",
    planTitle: "Adebayo → Berlin",
    expectedPurpose: "work",
    expectedDestination: "Germany",
    expectedCity: "Berlin",
    expectedCitizenship: "Nigerian",
    fields: {
      name: "My name is Adebayo",
      destination: "Germany",
      target_city: "Berlin",
      purpose: "I'm relocating for work",
      timeline: "In about 4 months",
      citizenship: "Nigerian",
      moving_alone: "Yes, moving alone",
      visa_role: "I'm the primary applicant",
      job_offer: "Yes, I have a job offer from a fintech company",
      job_field: "Software engineering",
      employer_sponsorship: "Yes, my employer is sponsoring my visa",
      highly_skilled: "Yes, I'm a highly skilled professional",
      years_experience: "7 years of experience",
      savings_available: "About 15000 USD saved",
      monthly_budget: "Around 2500 EUR per month",
      need_budget_help: "No, I think I'll manage",
      current_location: "Currently living in Lagos, Nigeria",
      duration: "Planning to stay 3+ years, probably permanently",
      language_skill: "Very basic German, just started learning",
      education_level: "I have a bachelor's degree in computer science",
      prior_visa: "No, never had a German visa before",
      visa_rejections: "No rejections",
      healthcare_needs: "No special healthcare needs",
      pets: "No pets",
      special_requirements: "Nothing special",
    },
    guideTerms: ["anmeldung", "blue card", "n26", "immobilienscout", "steuer-id", "residence permit", "sparkasse", "aufenthaltstitel", "schufa"],
    settlingTerms: ["anmeldung", "registration", "bank", "insurance", "steuer", "residence"],
    postArrivalQuestion: "What should I do first after arriving in Berlin?",
    postArrivalExpectedTerms: ["anmeldung", "registration", "bank", "insurance", "apartment"],
  },
  // 2. Study - solo - Japan/Tokyo - Brazilian
  {
    name: "Luciana",
    planTitle: "Luciana → Tokyo",
    expectedPurpose: "study",
    expectedDestination: "Japan",
    expectedCity: "Tokyo",
    expectedCitizenship: "Brazilian",
    fields: {
      name: "My name is Luciana",
      destination: "Japan",
      target_city: "Tokyo",
      purpose: "I want to study",
      timeline: "Next April, for the spring semester",
      citizenship: "Brazilian",
      moving_alone: "Yes, just me",
      visa_role: "I'm the primary applicant",
      study_type: "University degree program — I'm doing a master's",
      study_field: "Robotics engineering",
      study_funding: "I received a MEXT scholarship from the Japanese government",
      savings_available: "About 8000 USD saved up",
      monthly_budget: "Around 150000 JPY per month, about 1000 USD",
      need_budget_help: "Maybe a little help would be nice",
      current_location: "São Paulo, Brazil",
      duration: "2 years for my master's program",
      language_skill: "I've been studying Japanese for a year, about N4 level",
      education_level: "Bachelor's degree in mechanical engineering",
      prior_visa: "No, never had a Japanese visa",
      visa_rejections: "No rejections ever",
      healthcare_needs: "No special needs",
      pets: "No pets",
      special_requirements: "Nothing specific",
    },
    guideTerms: ["residence card", "ward office", "zairyu", "suumo", "national health insurance", "student visa", "certificate of eligibility"],
    settlingTerms: ["ward office", "residence card", "bank", "health insurance", "registration"],
    postArrivalQuestion: "What should I do in my first week in Tokyo?",
    postArrivalExpectedTerms: ["ward office", "residence card", "bank", "insurance", "registration"],
  },
  // 3. Digital nomad - solo - Portugal/Lisbon - American
  {
    name: "Jake",
    planTitle: "Jake → Lisbon",
    expectedPurpose: "digital_nomad",
    expectedDestination: "Portugal",
    expectedCity: "Lisbon",
    expectedCitizenship: "American",
    fields: {
      name: "I'm Jake",
      destination: "Portugal",
      target_city: "Lisbon",
      purpose: "I'm a digital nomad, working remotely",
      timeline: "In about 2 months",
      citizenship: "American, US passport",
      moving_alone: "Yep, solo",
      visa_role: "Primary applicant",
      remote_income: "Yes, I earn income remotely",
      income_source: "Freelance web development for US clients",
      monthly_income: "Around 6000 USD per month",
      income_consistency: "Pretty stable, consistent monthly income",
      income_history_months: "About 3 years of freelancing",
      savings_available: "Around 25000 USD",
      monthly_budget: "About 2000 EUR per month",
      need_budget_help: "No, I've done my research",
      current_location: "Austin, Texas, USA",
      duration: "1-2 years, maybe longer",
      language_skill: "No Portuguese yet, plan to learn",
      education_level: "Bachelor's in computer science",
      prior_visa: "No prior Portuguese visa",
      visa_rejections: "Never had a rejection",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "Nothing special",
    },
    guideTerms: ["nif", "idealista", "d7", "d8", "digital nomad visa", "activobank", "sns", "seg social", "residence permit"],
    settlingTerms: ["nif", "registration", "bank", "health", "residence", "tax"],
    postArrivalQuestion: "What's the first thing I need to do when I arrive in Lisbon?",
    postArrivalExpectedTerms: ["nif", "registration", "bank", "apartment", "tax"],
  },
  // 4. Settle (retirement) - with spouse - Spain/Barcelona - British
  {
    name: "Margaret",
    planTitle: "Margaret → Barcelona",
    expectedPurpose: "settle",
    expectedDestination: "Spain",
    expectedCity: "Barcelona",
    expectedCitizenship: "British",
    fields: {
      name: "I'm Margaret",
      destination: "Spain",
      target_city: "Barcelona",
      purpose: "I want to settle permanently, retiring there",
      timeline: "In about 6 months",
      citizenship: "British",
      moving_alone: "No, my husband is coming with me",
      visa_role: "I'm the primary applicant",
      settlement_reason: "Retirement — we want to enjoy the Mediterranean lifestyle",
      family_ties: "No family there yet, but we have friends",
      spouse_joining: "Yes, my husband is coming with me",
      children_count: "No children coming with us, they're grown up",
      savings_available: "About 200000 GBP in savings and pension",
      monthly_budget: "Around 3000 EUR per month from pension",
      need_budget_help: "No, we've planned our finances",
      current_location: "Manchester, United Kingdom",
      duration: "Permanently",
      language_skill: "Basic Spanish, about A2 level",
      education_level: "Bachelor's degree in education",
      prior_visa: "No, we visited Spain as tourists before but no visa needed then",
      visa_rejections: "No rejections",
      healthcare_needs: "My husband has high blood pressure, needs regular medication",
      pets: "We have a cat that's coming with us",
      special_requirements: "We need to find a place that allows pets",
    },
    guideTerms: ["nie", "padron", "empadronamiento", "residencia", "idealista", "social security", "healthcare", "non-lucrative visa"],
    settlingTerms: ["nie", "padron", "registration", "bank", "health", "social security"],
    postArrivalQuestion: "What should we do first after arriving in Barcelona?",
    postArrivalExpectedTerms: ["nie", "padron", "registration", "bank", "healthcare"],
  },
  // 5. Work - with family (2 kids) - Canada/Toronto - Indian
  {
    name: "Rajesh",
    planTitle: "Rajesh → Toronto",
    expectedPurpose: "work",
    expectedDestination: "Canada",
    expectedCity: "Toronto",
    expectedCitizenship: "Indian",
    fields: {
      name: "I'm Rajesh",
      destination: "Canada",
      target_city: "Toronto",
      purpose: "Relocating for work",
      timeline: "In about 5 months",
      citizenship: "Indian",
      moving_alone: "No, moving with my whole family",
      visa_role: "I'm the primary applicant",
      job_offer: "Yes, got an offer from a bank in Toronto",
      job_field: "Data science and analytics",
      employer_sponsorship: "Yes, employer is sponsoring through LMIA",
      highly_skilled: "Yes, highly skilled",
      years_experience: "12 years in data science",
      spouse_joining: "Yes, my wife is coming",
      children_count: "2 children",
      children_ages: "8 and 5 years old",
      savings_available: "About 40000 USD saved",
      monthly_budget: "Around 5000 CAD per month",
      need_budget_help: "A little help would be nice for Toronto costs",
      current_location: "Bangalore, India",
      duration: "Planning permanent residence",
      language_skill: "Fluent in English",
      education_level: "Master's in statistics",
      prior_visa: "Had a US B1/B2 tourist visa before",
      visa_rejections: "No rejections",
      healthcare_needs: "My younger child has mild asthma",
      pets: "No pets",
      special_requirements: "Need schools near good neighborhoods for kids",
    },
    guideTerms: ["sin", "ohip", "td bank", "realtor.ca", "work permit", "lmia", "pr", "permanent residence", "health card"],
    settlingTerms: ["sin", "registration", "bank", "health card", "school"],
    postArrivalQuestion: "What do I need to do first when I arrive in Toronto with my family?",
    postArrivalExpectedTerms: ["sin", "bank", "health", "school", "registration"],
  },
  // 6. Digital nomad - solo - Thailand/Bangkok - Australian
  {
    name: "Liam",
    planTitle: "Liam → Bangkok",
    expectedPurpose: "digital_nomad",
    expectedDestination: "Thailand",
    expectedCity: "Bangkok",
    expectedCitizenship: "Australian",
    fields: {
      name: "I'm Liam",
      destination: "Thailand",
      target_city: "Bangkok",
      purpose: "I'm a digital nomad",
      timeline: "Next month",
      citizenship: "Australian",
      moving_alone: "Yeah, just me",
      visa_role: "Primary applicant",
      remote_income: "Yes, all remote income",
      income_source: "I run an e-commerce business",
      monthly_income: "About 8000 AUD per month",
      income_consistency: "Variable, some months better than others",
      income_history_months: "Been running the business for 2 years",
      savings_available: "About 35000 AUD",
      monthly_budget: "Around 60000 THB per month, about 2500 AUD",
      need_budget_help: "No thanks",
      current_location: "Melbourne, Australia",
      duration: "6-12 months, then maybe Bali",
      language_skill: "No Thai, just English",
      education_level: "Bachelor's in marketing",
      prior_visa: "Yes, visited Thailand on tourist visa before",
      visa_rejections: "Never",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "Need good internet for my business",
    },
    guideTerms: ["tm30", "tm6", "immigration", "visa", "bank account", "bangkok bank", "kasikorn", "health insurance", "extension"],
    settlingTerms: ["registration", "bank", "visa", "insurance", "immigration"],
    postArrivalQuestion: "What should I set up first in Bangkok as a digital nomad?",
    postArrivalExpectedTerms: ["visa", "bank", "insurance", "sim", "apartment"],
  },
  // 7. Study - solo - France/Paris - Chinese
  {
    name: "Wei",
    planTitle: "Wei → Paris",
    expectedPurpose: "study",
    expectedDestination: "France",
    expectedCity: "Paris",
    expectedCitizenship: "Chinese",
    fields: {
      name: "My name is Wei",
      destination: "France",
      target_city: "Paris",
      purpose: "I want to study",
      timeline: "September this year",
      citizenship: "Chinese",
      moving_alone: "Yes, alone",
      visa_role: "Primary applicant",
      study_type: "University — doing a PhD",
      study_field: "Molecular biology",
      study_funding: "I have a research fellowship from the university",
      savings_available: "About 10000 EUR saved",
      monthly_budget: "Around 1200 EUR per month",
      need_budget_help: "Yes, please help me plan",
      current_location: "Beijing, China",
      duration: "3-4 years for the PhD",
      language_skill: "B1 in French, intermediate level",
      education_level: "Master's degree in biology",
      prior_visa: "No French visa before, but had UK student visa",
      visa_rejections: "No rejections",
      healthcare_needs: "No special needs",
      pets: "No pets",
      special_requirements: "Nothing specific",
    },
    guideTerms: ["carte de séjour", "ofii", "caf", "ameli", "sécurité sociale", "campus france", "titre de séjour", "crous"],
    settlingTerms: ["carte de séjour", "registration", "bank", "health", "caf", "ofii"],
    postArrivalQuestion: "What's the first thing I need to do after arriving in Paris?",
    postArrivalExpectedTerms: ["registration", "bank", "insurance", "prefecture", "apartment"],
  },
  // 8. Work - with spouse - Netherlands/Amsterdam - South African
  {
    name: "Thandi",
    planTitle: "Thandi → Amsterdam",
    expectedPurpose: "work",
    expectedDestination: "Netherlands",
    expectedCity: "Amsterdam",
    expectedCitizenship: "South African",
    fields: {
      name: "I'm Thandi",
      destination: "Netherlands",
      target_city: "Amsterdam",
      purpose: "Moving for work",
      timeline: "In about 3 months",
      citizenship: "South African",
      moving_alone: "No, my partner is joining me",
      visa_role: "I'm the primary applicant",
      job_offer: "Yes, got an offer from a tech startup",
      job_field: "Product management",
      employer_sponsorship: "Yes, they're handling the visa through the 30% ruling",
      highly_skilled: "Yes",
      years_experience: "9 years in product",
      spouse_joining: "Yes, my partner is coming",
      children_count: "No children",
      savings_available: "About 20000 EUR",
      monthly_budget: "Around 3500 EUR per month",
      need_budget_help: "No, I'm good",
      current_location: "Cape Town, South Africa",
      duration: "At least 3 years, probably longer",
      language_skill: "No Dutch yet",
      education_level: "MBA from Stellenbosch University",
      prior_visa: "No Dutch visa before",
      visa_rejections: "No",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "Nothing special",
    },
    guideTerms: ["bsn", "digid", "30% ruling", "gemeente", "funda", "ing", "abn amro", "health insurance", "residence permit"],
    settlingTerms: ["bsn", "gemeente", "registration", "bank", "insurance", "digid"],
    postArrivalQuestion: "What should I do first after arriving in Amsterdam?",
    postArrivalExpectedTerms: ["bsn", "gemeente", "registration", "bank", "insurance"],
  },
  // 9. Settle (family reunion) - dependent - Sweden/Stockholm - Turkish
  {
    name: "Elif",
    planTitle: "Elif → Stockholm",
    expectedPurpose: "settle",
    expectedDestination: "Sweden",
    expectedCity: "Stockholm",
    expectedCitizenship: "Turkish",
    fields: {
      name: "I'm Elif",
      destination: "Sweden",
      target_city: "Stockholm",
      purpose: "I want to settle permanently, joining my husband",
      timeline: "In about 2 months",
      citizenship: "Turkish",
      moving_alone: "No, joining my husband who already lives there",
      visa_role: "I'm joining my husband, so I'm a dependent",
      settlement_reason: "Family reunion, my husband works in Stockholm",
      family_ties: "Yes, my husband has been living there for 3 years",
      partner_citizenship: "Turkish, same as me",
      partner_visa_status: "He has a work visa, permanent residency pending",
      relationship_type: "We're married, he's my spouse",
      spouse_joining: "I'm the one joining him",
      children_count: "No children yet",
      savings_available: "About 10000 EUR between us",
      monthly_budget: "Around 3000 EUR per month combined",
      need_budget_help: "Yes, Stockholm is expensive, help would be nice",
      current_location: "Istanbul, Turkey",
      duration: "Permanently",
      language_skill: "Basic Swedish, started SFI online",
      education_level: "Master's in architecture",
      prior_visa: "No Swedish visa, visited on Schengen tourist",
      visa_rejections: "No rejections",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "I'd like to find work as an architect eventually",
    },
    guideTerms: ["personnummer", "skatteverket", "migrationsverket", "bankid", "sfi", "folkbokföring", "residence permit", "family reunion"],
    settlingTerms: ["personnummer", "skatteverket", "registration", "bank", "insurance", "sfi"],
    postArrivalQuestion: "What should I do first after arriving in Stockholm?",
    postArrivalExpectedTerms: ["personnummer", "skatteverket", "registration", "bank", "sfi"],
  },
  // 10. Work - solo - Singapore - Filipino
  {
    name: "Carlo",
    planTitle: "Carlo → Singapore",
    expectedPurpose: "work",
    expectedDestination: "Singapore",
    expectedCity: "Singapore",
    expectedCitizenship: "Filipino",
    fields: {
      name: "My name is Carlo",
      destination: "Singapore",
      target_city: "Singapore",
      purpose: "I'm relocating for work",
      timeline: "Next month",
      citizenship: "Filipino",
      moving_alone: "Yes, moving alone",
      visa_role: "Primary applicant",
      job_offer: "Yes, I have an offer from a logistics company",
      job_field: "Supply chain and logistics management",
      employer_sponsorship: "Yes, employer is handling the Employment Pass",
      highly_skilled: "Yes, I'd say so",
      years_experience: "6 years",
      savings_available: "About 10000 USD",
      monthly_budget: "Around 3000 SGD per month",
      need_budget_help: "Yes, Singapore seems expensive",
      current_location: "Manila, Philippines",
      duration: "2-3 years initially",
      language_skill: "Fluent in English",
      education_level: "Bachelor's in industrial engineering",
      prior_visa: "No prior Singapore visa",
      visa_rejections: "No rejections",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "Nothing special",
    },
    guideTerms: ["employment pass", "singpass", "dbs", "ocbc", "hdb", "cpf", "medisave", "ica", "fin"],
    settlingTerms: ["singpass", "registration", "bank", "employment pass", "insurance"],
    postArrivalQuestion: "What should I set up first in Singapore?",
    postArrivalExpectedTerms: ["singpass", "bank", "employment pass", "registration"],
  },
  // 11. Digital nomad - with partner - Mexico/Mexico City - German
  {
    name: "Felix",
    planTitle: "Felix → Mexico City",
    expectedPurpose: "digital_nomad",
    expectedDestination: "Mexico",
    expectedCity: "Mexico City",
    expectedCitizenship: "German",
    fields: {
      name: "I'm Felix",
      destination: "Mexico",
      target_city: "Mexico City",
      purpose: "I'm a digital nomad, remote worker",
      timeline: "In about 6 weeks",
      citizenship: "German",
      moving_alone: "No, my girlfriend is coming with me",
      visa_role: "Primary applicant",
      remote_income: "Yes, all remote",
      income_source: "I'm employed remotely by a Berlin-based company",
      monthly_income: "About 5000 EUR per month",
      income_consistency: "Stable, regular salary",
      income_history_months: "Been with the company for 4 years",
      spouse_joining: "Yes, my girlfriend is joining",
      children_count: "No kids",
      savings_available: "About 30000 EUR",
      monthly_budget: "Around 40000 MXN per month, about 2000 EUR",
      need_budget_help: "No thanks",
      current_location: "Berlin, Germany",
      duration: "6 months to a year",
      language_skill: "Intermediate Spanish, about B1",
      education_level: "Master's in computer science",
      prior_visa: "No Mexican visa, visited as tourist before",
      visa_rejections: "Never",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "Good coworking spaces nearby would be great",
    },
    guideTerms: ["curp", "rfc", "inm", "temporary resident", "imss", "banamex", "bbva", "fmm", "tax"],
    settlingTerms: ["curp", "registration", "bank", "insurance", "visa", "rfc"],
    postArrivalQuestion: "What should I do first after arriving in Mexico City?",
    postArrivalExpectedTerms: ["curp", "registration", "bank", "visa", "insurance"],
  },
  // 12. Study - solo - UK/London - Egyptian
  {
    name: "Amira",
    planTitle: "Amira → London",
    expectedPurpose: "study",
    expectedDestination: "United Kingdom",
    expectedCity: "London",
    expectedCitizenship: "Egyptian",
    fields: {
      name: "I'm Amira",
      destination: "United Kingdom",
      target_city: "London",
      purpose: "I want to study",
      timeline: "September this year",
      citizenship: "Egyptian",
      moving_alone: "Yes, going alone",
      visa_role: "Primary applicant",
      study_type: "University, doing a master's degree",
      study_field: "International law",
      study_funding: "Self-funded with some help from family",
      savings_available: "About 30000 GBP including family support",
      monthly_budget: "Around 1500 GBP per month",
      need_budget_help: "Yes please, London is very expensive",
      current_location: "Cairo, Egypt",
      duration: "1 year for the master's",
      language_skill: "Fluent in English",
      education_level: "Bachelor's in law from Cairo University",
      prior_visa: "Had a UK tourist visa before",
      visa_rejections: "No rejections",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "Nothing special",
    },
    guideTerms: ["brp", "national insurance", "nhs", "rightmove", "student visa", "gp", "oyster", "council tax"],
    settlingTerms: ["brp", "registration", "bank", "nhs", "national insurance", "gp"],
    postArrivalQuestion: "What should I do first after arriving in London?",
    postArrivalExpectedTerms: ["brp", "bank", "nhs", "registration", "gp"],
  },
  // 13. Work - with family (1 kid) - Australia/Sydney - Pakistani
  {
    name: "Hassan",
    planTitle: "Hassan → Sydney",
    expectedPurpose: "work",
    expectedDestination: "Australia",
    expectedCity: "Sydney",
    expectedCitizenship: "Pakistani",
    fields: {
      name: "I'm Hassan",
      destination: "Australia",
      target_city: "Sydney",
      purpose: "Moving for work",
      timeline: "In about 4 months",
      citizenship: "Pakistani",
      moving_alone: "No, my wife and son are coming",
      visa_role: "I'm the primary applicant",
      job_offer: "Yes, got an offer from a hospital",
      job_field: "Medicine, I'm a doctor — cardiology",
      employer_sponsorship: "Yes, the hospital is sponsoring my visa",
      highly_skilled: "Yes, I'm a specialist cardiologist",
      years_experience: "10 years in cardiology",
      spouse_joining: "Yes, my wife is coming",
      children_count: "1 child",
      children_ages: "3 years old",
      savings_available: "About 50000 AUD",
      monthly_budget: "Around 6000 AUD per month",
      need_budget_help: "No, we've planned",
      current_location: "Lahore, Pakistan",
      duration: "Permanently, applying for PR",
      language_skill: "Fluent in English",
      education_level: "MBBS and fellowship in cardiology",
      prior_visa: "Had Australian tourist visa before",
      visa_rejections: "No rejections",
      healthcare_needs: "None for us",
      pets: "No pets",
      special_requirements: "Need a good daycare near the hospital",
    },
    guideTerms: ["tfn", "medicare", "commbank", "domain.com.au", "work visa", "482", "pr", "centrelink"],
    settlingTerms: ["tfn", "medicare", "registration", "bank", "school", "daycare"],
    postArrivalQuestion: "What do I need to set up first when I arrive in Sydney?",
    postArrivalExpectedTerms: ["tfn", "medicare", "bank", "registration"],
  },
  // 14. Settle (ancestry) - solo - Italy/Rome - Argentinian
  {
    name: "Mateo",
    planTitle: "Mateo → Rome",
    expectedPurpose: "settle",
    expectedDestination: "Italy",
    expectedCity: "Rome",
    expectedCitizenship: "Argentinian",
    fields: {
      name: "I'm Mateo",
      destination: "Italy",
      target_city: "Rome",
      purpose: "I want to settle permanently",
      timeline: "In about 3 months",
      citizenship: "Argentinian",
      moving_alone: "Yes, going alone",
      visa_role: "I'm the primary applicant",
      settlement_reason: "Ancestry — my grandparents were Italian, I'm applying for Italian citizenship by descent",
      family_ties: "Yes, I have cousins in Rome",
      savings_available: "About 15000 EUR",
      monthly_budget: "Around 1800 EUR per month",
      need_budget_help: "A little help would be good",
      current_location: "Buenos Aires, Argentina",
      duration: "Permanently",
      language_skill: "Intermediate Italian, about B1",
      education_level: "Bachelor's in architecture",
      prior_visa: "No Italian visa, but visited as tourist",
      visa_rejections: "No rejections",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "I need help understanding the jure sanguinis process",
    },
    guideTerms: ["codice fiscale", "permesso di soggiorno", "anagrafe", "tessera sanitaria", "idealista", "asl", "jure sanguinis", "comune"],
    settlingTerms: ["codice fiscale", "registration", "bank", "health", "anagrafe", "permesso"],
    postArrivalQuestion: "What should I do first after arriving in Rome?",
    postArrivalExpectedTerms: ["codice fiscale", "registration", "bank", "questura", "permesso"],
  },
  // 15. Digital nomad - solo - Colombia/Medellín - Canadian
  {
    name: "Sophie",
    planTitle: "Sophie → Medellín",
    expectedPurpose: "digital_nomad",
    expectedDestination: "Colombia",
    expectedCity: "Medellín",
    expectedCitizenship: "Canadian",
    fields: {
      name: "I'm Sophie",
      destination: "Colombia",
      target_city: "Medellín",
      purpose: "I'm a digital nomad",
      timeline: "In about 3 weeks",
      citizenship: "Canadian",
      moving_alone: "Yes, solo",
      visa_role: "Primary applicant",
      remote_income: "Yes",
      income_source: "I'm a freelance graphic designer",
      monthly_income: "About 4500 CAD per month",
      income_consistency: "Variable, depends on client projects",
      income_history_months: "About 2 years freelancing",
      savings_available: "About 18000 CAD",
      monthly_budget: "Around 5000000 COP per month, about 1500 CAD",
      need_budget_help: "No, I've talked to other nomads there",
      current_location: "Vancouver, Canada",
      duration: "6 months, then reassess",
      language_skill: "Intermediate Spanish, about B1",
      education_level: "Bachelor's in graphic design",
      prior_visa: "No Colombian visa, visited as tourist",
      visa_rejections: "Never",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "Looking for a neighborhood with good coffee shops to work from",
    },
    guideTerms: ["cedula", "digital nomad visa", "eps", "bancolombia", "finca raiz", "migración", "visa", "tax"],
    settlingTerms: ["cedula", "registration", "bank", "health", "visa", "eps"],
    postArrivalQuestion: "What should I set up first in Medellín?",
    postArrivalExpectedTerms: ["cedula", "bank", "visa", "sim", "apartment"],
  },
  // 16. Work - solo - South Korea/Seoul - Polish
  {
    name: "Kasia",
    planTitle: "Kasia → Seoul",
    expectedPurpose: "work",
    expectedDestination: "South Korea",
    expectedCity: "Seoul",
    expectedCitizenship: "Polish",
    fields: {
      name: "I'm Kasia",
      destination: "South Korea",
      target_city: "Seoul",
      purpose: "I'm relocating for work",
      timeline: "In about 2 months",
      citizenship: "Polish, so EU citizen",
      moving_alone: "Yes, going alone",
      visa_role: "Primary applicant",
      job_offer: "Yes, I have an offer to teach English at a hagwon",
      job_field: "Education and teaching",
      employer_sponsorship: "Yes, the school is sponsoring my E-2 visa",
      highly_skilled: "Not really, it's an English teaching position",
      years_experience: "3 years of teaching experience",
      savings_available: "About 5000 EUR",
      monthly_budget: "Around 1500000 KRW per month",
      need_budget_help: "Yes, I'm not sure about Seoul costs",
      current_location: "Warsaw, Poland",
      duration: "1 year initially, might extend",
      language_skill: "Very basic Korean, learning on Duolingo",
      education_level: "Bachelor's in English literature",
      prior_visa: "No Korean visa before",
      visa_rejections: "No rejections",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "I'd like to live near my school if possible",
    },
    guideTerms: ["arc", "alien registration", "nhis", "national health", "e-2", "kakao bank", "jeonse", "immigration office"],
    settlingTerms: ["arc", "alien registration", "bank", "health insurance", "immigration"],
    postArrivalQuestion: "What should I do first after arriving in Seoul?",
    postArrivalExpectedTerms: ["alien registration", "arc", "bank", "insurance"],
  },
  // 17. Study - solo - New Zealand/Auckland - Kenyan
  {
    name: "Wanjiku",
    planTitle: "Wanjiku → Auckland",
    expectedPurpose: "study",
    expectedDestination: "New Zealand",
    expectedCity: "Auckland",
    expectedCitizenship: "Kenyan",
    fields: {
      name: "I'm Wanjiku",
      destination: "New Zealand",
      target_city: "Auckland",
      purpose: "I want to study",
      timeline: "February next year",
      citizenship: "Kenyan",
      moving_alone: "Yes, going alone",
      visa_role: "Primary applicant",
      study_type: "University, doing a master's program",
      study_field: "Environmental science",
      study_funding: "Partial scholarship plus my own savings",
      savings_available: "About 12000 NZD including scholarship",
      monthly_budget: "Around 1800 NZD per month",
      need_budget_help: "Yes please",
      current_location: "Nairobi, Kenya",
      duration: "2 years for the master's",
      language_skill: "Fluent in English",
      education_level: "Bachelor's in environmental studies",
      prior_visa: "No New Zealand visa before",
      visa_rejections: "No rejections",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "Nothing specific",
    },
    guideTerms: ["ird number", "student visa", "trade me", "anz", "kiwibank", "studylink", "acc", "public health"],
    settlingTerms: ["ird", "registration", "bank", "health", "student visa"],
    postArrivalQuestion: "What should I do in my first week in Auckland?",
    postArrivalExpectedTerms: ["ird", "bank", "visa", "registration"],
  },
  // 18. Work - with spouse + pets - Switzerland/Zurich - Japanese
  {
    name: "Yuki",
    planTitle: "Yuki → Zurich",
    expectedPurpose: "work",
    expectedDestination: "Switzerland",
    expectedCity: "Zurich",
    expectedCitizenship: "Japanese",
    fields: {
      name: "I'm Yuki",
      destination: "Switzerland",
      target_city: "Zurich",
      purpose: "I'm relocating for work",
      timeline: "In about 4 months",
      citizenship: "Japanese",
      moving_alone: "No, my wife is coming with me",
      visa_role: "I'm the primary applicant",
      job_offer: "Yes, I got an offer from a pharmaceutical company",
      job_field: "Biomedical research",
      employer_sponsorship: "Yes, they're handling everything",
      highly_skilled: "Yes, I'm a senior researcher",
      years_experience: "15 years in biomedical research",
      spouse_joining: "Yes, my wife is coming",
      children_count: "No children",
      savings_available: "About 80000 CHF",
      monthly_budget: "Around 7000 CHF per month",
      need_budget_help: "No, we've planned",
      current_location: "Osaka, Japan",
      duration: "3+ years, probably longer",
      language_skill: "Basic German, about A1. Also speak English fluently",
      education_level: "PhD in biomedical engineering",
      prior_visa: "No Swiss visa before",
      visa_rejections: "No rejections",
      healthcare_needs: "None",
      pets: "We have a small dog, a Shiba Inu",
      special_requirements: "Need pet-friendly housing and info on bringing our dog",
    },
    guideTerms: ["ahv", "permit b", "gemeinde", "comparis", "ubs", "credit suisse", "krankenkasse", "obligatory health", "anmeldung"],
    settlingTerms: ["ahv", "gemeinde", "registration", "bank", "insurance", "anmeldung"],
    postArrivalQuestion: "What should I do first after arriving in Zurich?",
    postArrivalExpectedTerms: ["gemeinde", "registration", "bank", "insurance", "ahv"],
  },
  // 19. Digital nomad - solo - Estonia/Tallinn - Mexican
  {
    name: "Diego",
    planTitle: "Diego → Tallinn",
    expectedPurpose: "digital_nomad",
    expectedDestination: "Estonia",
    expectedCity: "Tallinn",
    expectedCitizenship: "Mexican",
    fields: {
      name: "I'm Diego",
      destination: "Estonia",
      target_city: "Tallinn",
      purpose: "I'm a digital nomad",
      timeline: "In about 2 months",
      citizenship: "Mexican",
      moving_alone: "Yes, solo",
      visa_role: "Primary applicant",
      remote_income: "Yes, all remote",
      income_source: "I own a small software development agency",
      monthly_income: "About 7000 USD per month",
      income_consistency: "Mostly stable, sometimes variable",
      income_history_months: "Running the agency for 5 years",
      savings_available: "About 40000 USD",
      monthly_budget: "Around 2500 EUR per month",
      need_budget_help: "No, I'm fine",
      current_location: "Guadalajara, Mexico",
      duration: "1 year with Estonia's digital nomad visa",
      language_skill: "No Estonian, but fluent in English",
      education_level: "Bachelor's in systems engineering",
      prior_visa: "No Estonian visa, but had Schengen tourist visa",
      visa_rejections: "No rejections",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "Interested in Estonia's e-residency program too",
    },
    guideTerms: ["e-residency", "digital nomad visa", "id card", "isikukood", "lhv", "swedbank", "ehis", "tervisekassa"],
    settlingTerms: ["id card", "registration", "bank", "insurance", "e-residency"],
    postArrivalQuestion: "What should I do first after arriving in Tallinn?",
    postArrivalExpectedTerms: ["registration", "bank", "visa", "id card", "e-residency"],
  },
  // 20. Work - with family (3 kids) - UAE/Dubai - Bangladeshi
  {
    name: "Farhan",
    planTitle: "Farhan → Dubai",
    expectedPurpose: "work",
    expectedDestination: "United Arab Emirates",
    expectedCity: "Dubai",
    expectedCitizenship: "Bangladeshi",
    fields: {
      name: "I'm Farhan",
      destination: "United Arab Emirates",
      target_city: "Dubai",
      purpose: "Relocating for work",
      timeline: "In about 2 months",
      citizenship: "Bangladeshi",
      moving_alone: "No, my whole family is coming — wife and 3 kids",
      visa_role: "I'm the primary applicant",
      job_offer: "Yes, got an offer from a construction engineering firm",
      job_field: "Civil engineering and construction management",
      employer_sponsorship: "Yes, employer handles the work visa and family visas",
      highly_skilled: "Yes, I'm a senior project manager",
      years_experience: "14 years in construction",
      spouse_joining: "Yes, my wife is coming",
      children_count: "3 children",
      children_ages: "12, 9, and 4 years old",
      savings_available: "About 30000 USD",
      monthly_budget: "Around 20000 AED per month",
      need_budget_help: "Yes, Dubai schools are expensive, help with planning",
      current_location: "Dhaka, Bangladesh",
      duration: "Long-term, at least 5 years",
      language_skill: "Fluent in English, basic Arabic",
      education_level: "Master's degree in civil engineering",
      prior_visa: "Had a UAE visit visa before",
      visa_rejections: "No rejections",
      healthcare_needs: "None",
      pets: "No pets",
      special_requirements: "Need to find good affordable international schools for all 3 kids",
    },
    guideTerms: ["emirates id", "residence visa", "ejari", "dewa", "dha", "medical fitness", "labour card", "dubizzle", "bayut"],
    settlingTerms: ["emirates id", "registration", "bank", "visa", "school", "medical"],
    postArrivalQuestion: "What do I need to do first in Dubai with my family?",
    postArrivalExpectedTerms: ["emirates id", "medical", "bank", "visa", "school"],
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────

async function waitForLoad(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
}

async function signIn(page: Page) {
  await page.goto(`${BASE}/auth/login`)
  await waitForLoad(page)
  const emailInput = page.locator('input[type="email"], input[name="email"]')
  const passwordInput = page.locator('input[type="password"], input[name="password"]')
  if (await emailInput.isVisible({ timeout: 5000 })) {
    await emailInput.fill(EMAIL)
    await passwordInput.fill(PASSWORD)
    const signInBtn = page.locator('button:has-text("Sign"), button:has-text("Log")')
    await signInBtn.click()
    await page.waitForURL(/\/(dashboard|chat|app)/, { timeout: 15000 })
  }
}

async function waitForAIResponse(page: Page, maxWait = 60000) {
  await page.waitForTimeout(1500)
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    const hasBounce = await page.locator(".animate-bounce").first().isVisible({ timeout: 300 }).catch(() => false)
    if (!hasBounce) {
      await page.waitForTimeout(500)
      const stillBouncing = await page.locator(".animate-bounce").first().isVisible({ timeout: 300 }).catch(() => false)
      if (!stillBouncing) break
    }
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(1000)
}

function findAnswer(persona: Persona, pendingLabel: string, pendingKey: string | null): string | null {
  if (pendingKey && persona.fields[pendingKey]) {
    return persona.fields[pendingKey]
  }
  const mappedKey = LABEL_TO_KEY[pendingLabel]
  if (mappedKey && persona.fields[mappedKey]) {
    return persona.fields[mappedKey]
  }
  const fuzzyKey = pendingLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
  for (const [key, value] of Object.entries(persona.fields)) {
    if (key.includes(fuzzyKey) || fuzzyKey.includes(key) ||
        pendingLabel.toLowerCase().includes(key.replace(/_/g, " "))) {
      return value
    }
  }
  return null
}

function getPendingKey(pendingLabel: string): string | null {
  return LABEL_TO_KEY[pendingLabel] || null
}

function validateTerms(text: string, terms: string[]): { found: string[]; missing: string[] } {
  const lower = text.toLowerCase()
  const found: string[] = []
  const missing: string[] = []
  for (const term of terms) {
    if (lower.includes(term.toLowerCase())) {
      found.push(term)
    } else {
      missing.push(term)
    }
  }
  return { found, missing }
}

// ─── Guide Tab Validation ──────────────────────────────────────────────────

const REQUIRED_TABS = ["overview", "visa", "budget", "housing", "practical", "culture", "timeline", "checklist"]
const CONDITIONAL_TABS = ["jobs", "education"]

async function validateGuideTabs(page: Page, persona: Persona, result: FullResult) {
  const allTabs = [...REQUIRED_TABS]

  for (const tab of CONDITIONAL_TABS) {
    const tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1)
    const tabExists = await page.locator(`[role="tab"][value="${tab}"], button[value="${tab}"], button:has-text("${tabLabel}")`).first().isVisible({ timeout: 1000 }).catch(() => false)
    if (tabExists) allTabs.push(tab)
  }

  result.tabsTotal = allTabs.length
  result.tabsEnriched = 0

  for (const tab of allTabs) {
    // Try multiple selectors for tab trigger
    let tabTrigger = page.locator(`[role="tab"][value="${tab}"]`)
    let tabVisible = await tabTrigger.isVisible({ timeout: 2000 }).catch(() => false)

    // Fallback: try data-value or button text
    if (!tabVisible) {
      tabTrigger = page.locator(`button[data-value="${tab}"], button[value="${tab}"]`)
      tabVisible = await tabTrigger.isVisible({ timeout: 1000 }).catch(() => false)
    }
    // Fallback: match by tab label text
    if (!tabVisible) {
      const tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1)
      tabTrigger = page.locator(`button:has-text("${tabLabel}")`)
      tabVisible = await tabTrigger.isVisible({ timeout: 1000 }).catch(() => false)
    }

    if (!tabVisible) {
      result.tabResults[tab] = { enriched: false, proseBlocks: 0, textLength: 0 }
      note(persona.name, 0, "warning", `Guide tab "${tab}" not found`)
      continue
    }

    await tabTrigger.click()
    await page.waitForTimeout(1500)

    // Use the ACTIVE tabpanel only — Radix renders all panels but hides inactive ones
    const activePanel = page.locator('[role="tabpanel"][data-state="active"], [data-slot="tabs-content"][data-state="active"]').first()
    const panelVisible = await activePanel.isVisible({ timeout: 3000 }).catch(() => false)
    let panelText = ""
    if (panelVisible) {
      panelText = await activePanel.textContent({ timeout: 3000 }).catch(() => "") || ""
    }
    // Fallback: try any visible tabpanel
    if (!panelText) {
      const anyPanel = page.locator('[role="tabpanel"]:visible').first()
      panelText = await anyPanel.textContent({ timeout: 2000 }).catch(() => "") || ""
    }
    const proseBlocks = await activePanel.locator('p.leading-relaxed').count().catch(() => 0)

    const isConditional = CONDITIONAL_TABS.includes(tab)
    const minLength = tab === "checklist" ? 100 : (isConditional ? 100 : 200)

    // Enriched = has substantial content. Prose blocks (EnrichedProse <p> tags) are a bonus signal,
    // but many tabs render data through structured components (lists, cards, tables) not prose.
    // Primary indicator: text length. Secondary: prose blocks for deep enrichment.
    const hasSubstantialContent = panelText.length > minLength
    const hasProseEnrichment = proseBlocks >= 1
    const isEnriched = hasSubstantialContent
    result.tabResults[tab] = {
      enriched: isEnriched,
      proseBlocks,
      textLength: panelText.length,
    }

    if (isEnriched) {
      result.tabsEnriched++
    } else {
      note(persona.name, 0, "warning", `Guide tab "${tab}" not enriched: ${proseBlocks} prose blocks, ${panelText.length} chars`)
    }

    console.log(`    Tab "${tab}": ${isEnriched ? "✅" : "❌"} (${proseBlocks} prose, ${panelText.length} chars)`)
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/${persona.name}_guide_tabs.png`, fullPage: true })
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test.describe.serial("GoMate 20-Persona Full E2E Test Suite v2", () => {
  test.describe.configure({ timeout: 900000 })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    const { execSync } = require("child_process")
    execSync(`mkdir -p ${SCREENSHOT_DIR}`)
    page = await browser.newPage()
    await signIn(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  for (let i = 0; i < PERSONAS.length; i++) {
    const persona = PERSONAS[i]
    const idx = i + 1

    test(`${idx}/20 — ${persona.name}: ${persona.expectedCitizenship} → ${persona.expectedCity} (${persona.expectedPurpose}) — FULL E2E`, async () => {
      const startTime = Date.now()
      console.log(`\n${"=".repeat(80)}`)
      console.log(`  TEST ${idx}/20: ${persona.name} (${persona.expectedCitizenship} → ${persona.expectedCity})`)
      console.log(`  Purpose: ${persona.expectedPurpose} | Full E2E flow`)
      console.log(`${"=".repeat(80)}`)

      const result: FullResult = {
        persona: persona.name,
        onboardingComplete: false,
        turns: 0,
        idleCount: 0,
        stuckFields: [],
        dashboardOk: false,
        guideGenerated: false,
        guideTermsFound: 0,
        tabResults: {},
        tabsEnriched: 0,
        tabsTotal: 0,
        arrivalTriggered: false,
        settlingGenerated: false,
        settlingTaskCount: 0,
        settlingTermsFound: 0,
        postArrivalOk: false,
        extractionBlocked: false,
        durationSec: 0,
      }

      // ═══════════════════════════════════════════════════════════════════
      // STAGE 1: Create plan + Onboarding chat
      // ═══════════════════════════════════════════════════════════════════
      console.log(`\n  ── STAGE 1: Onboarding ──`)

      const createResult = await page.evaluate(async (title: string) => {
        const res = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        })
        return { status: res.status, data: await res.json() }
      }, persona.planTitle)

      if (createResult.status === 403) {
        note(persona.name, 0, "bug", `Plan creation blocked (403): ${JSON.stringify(createResult.data)}`)
        result.durationSec = Math.round((Date.now() - startTime) / 1000)
        allResults.push(result)
        return
      }
      expect(createResult.status).toBe(200)
      console.log(`  ✓ Plan created: ${persona.planTitle}`)

      await page.goto(`${BASE}/chat`)
      await waitForLoad(page)
      await page.waitForTimeout(4000)

      const chatInput = page.locator('input[placeholder="Type your message..."]').first()
      await chatInput.waitFor({ timeout: 15000 })

      let idleCount = 0
      let totalTurns = 0
      let lastPendingField = ""
      let stuckCount = 0
      const stuckFields: string[] = []
      let reachedReview = false

      for (let turn = 0; turn < 35; turn++) {
        totalTurns++

        const nextSpan = page.locator('span.text-primary:has-text("Next:")').first()
        let pendingLabel = ""
        if (await nextSpan.isVisible({ timeout: 1000 }).catch(() => false)) {
          const spanText = (await nextSpan.textContent()) || ""
          pendingLabel = spanText.replace("Next:", "").trim()
        }

        const bodyText = (await page.textContent("body")) || ""
        const completionMatch = bodyText.match(/(\d+)%/)
        const pct = completionMatch ? parseInt(completionMatch[1]) : 0

        const confirmBtnVisible = await page.locator('[data-testid="confirm-plan-btn"]').isVisible({ timeout: 500 }).catch(() => false)
        const reviewHeader = await page.locator('p:has-text("Review your profile")').isVisible({ timeout: 500 }).catch(() => false)
        const noPendingField = pendingLabel === "" && pct >= 90

        if (pct >= 100 || confirmBtnVisible || reviewHeader || noPendingField) {
          console.log(`  ✅ Profile complete at ${pct}% after ${totalTurns} turns`)
          reachedReview = true
          break
        }

        if (pendingLabel && pendingLabel === lastPendingField) {
          stuckCount++
          if (stuckCount >= 3) {
            note(persona.name, totalTurns, "warning", `Stuck on "${pendingLabel}" for ${stuckCount} consecutive turns`)
            if (!stuckFields.includes(pendingLabel)) stuckFields.push(pendingLabel)
          }
        } else {
          stuckCount = 0
        }
        lastPendingField = pendingLabel

        let answer = ""
        const pendingKey = pendingLabel ? getPendingKey(pendingLabel) : null

        if (pendingLabel) {
          const found = findAnswer(persona, pendingLabel, pendingKey)
          if (found) {
            answer = found
          } else {
            note(persona.name, totalTurns, "warning", `Unknown field label: "${pendingLabel}" — using generic answer`)
            answer = `Regarding ${pendingLabel}: nothing special to mention`
          }
        } else {
          if (turn === 0) {
            answer = `Hi, ${persona.fields.name?.replace(/^(My name is |I'm |I am )/, "") || persona.name}`
          } else {
            const lastMessages = bodyText.slice(-800).toLowerCase()
            const isAskingQuestion = lastMessages.includes("?")
            if (isAskingQuestion) {
              const contextClues: Record<string, string[]> = {
                name: ["your name", "call you"],
                destination: ["where", "country", "move to", "relocat"],
                target_city: ["city", "which city"],
                purpose: ["why", "purpose", "reason", "moving for"],
                citizenship: ["passport", "citizen", "nationality"],
                timeline: ["when", "timeline", "plan to move"],
                moving_alone: ["alone", "anyone", "family", "partner", "with you"],
              }
              let contextAnswer: string | null = null
              for (const [fieldKey, clues] of Object.entries(contextClues)) {
                if (clues.some(c => lastMessages.includes(c)) && persona.fields[fieldKey]) {
                  contextAnswer = persona.fields[fieldKey]
                  break
                }
              }
              answer = contextAnswer || "What's the next question?"
            } else {
              const idlePhrases = ["feel free to ask", "let me know if you", "anything else you'd like", "is there anything else", "don't hesitate", "happy to help with anything"]
              const isIdle = idlePhrases.some(p => lastMessages.includes(p))
              if (isIdle && pct < 100) {
                idleCount++
                note(persona.name, totalTurns, "bug", `AI went IDLE at ${pct}% — onboarding incomplete`)
                answer = "Please continue with the next question for my profile"
              } else {
                answer = "What information do you need next?"
              }
            }
          }
        }

        const recentText = bodyText.slice(-600).toLowerCase()
        const idleCheckPhrases = ["feel free to ask", "let me know if you", "anything else you'd like", "is there anything else", "don't hesitate"]
        const isIdleCheck = idleCheckPhrases.some(p => recentText.includes(p)) && pct < 100 && pendingLabel !== ""
        if (isIdleCheck) {
          note(persona.name, totalTurns, "bug", `AI went IDLE at ${pct}% while "${pendingLabel}" is pending`)
          idleCount++
        }

        console.log(`  [T${totalTurns}] ${pct}% | Next: "${pendingLabel}" → "${answer.slice(0, 60)}..."`)
        await chatInput.fill(answer)
        await chatInput.press("Enter")
        await waitForAIResponse(page)
      }

      result.onboardingComplete = reachedReview
      result.turns = totalTurns
      result.idleCount = idleCount
      result.stuckFields = stuckFields

      if (!reachedReview) {
        note(persona.name, totalTurns, "bug", `Did NOT reach review state after ${totalTurns} turns`)
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_stuck.png`, fullPage: true })
      }

      // ═══════════════════════════════════════════════════════════════════
      // STAGE 2: Confirm + Lock
      // ═══════════════════════════════════════════════════════════════════
      console.log(`\n  ── STAGE 2: Confirm + Lock ──`)

      const confirmBtn = page.locator('[data-testid="confirm-plan-btn"]')
      let confirmVisible = await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)

      if (!confirmVisible && reachedReview) {
        console.log(`  ↻ Nudging AI to trigger review state...`)
        const nudgeInput = page.locator('input[placeholder="Type your message..."]').first()
        if (await nudgeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nudgeInput.fill("I think that covers everything. Is my profile complete?")
          await nudgeInput.press("Enter")
          await waitForAIResponse(page)
          await page.waitForTimeout(2000)
          confirmVisible = await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)
        }
      }

      if (!confirmVisible && reachedReview) {
        console.log(`  ↻ Second nudge — requesting profile summary...`)
        const nudgeInput2 = page.locator('input[placeholder="Type your message..."]').first()
        if (await nudgeInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nudgeInput2.fill("Yes, please confirm my profile and generate the plan.")
          await nudgeInput2.press("Enter")
          await waitForAIResponse(page)
          await page.waitForTimeout(2000)
          confirmVisible = await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)
        }
      }

      if (confirmVisible) {
        await confirmBtn.click()
        console.log(`  ✓ Clicked confirm — waiting for plan generation...`)
        await waitForAIResponse(page, 90000)
        await page.waitForTimeout(5000)
      } else {
        note(persona.name, totalTurns, "warning", "Confirm button not visible after reaching review/complete")
      }

      await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_after_confirm.png`, fullPage: true })

      // ── Lock the plan via Dashboard ──
      // The confirm button in chat sends a message but does NOT lock the plan.
      // Locking is done via the dashboard's "Lock plan" button, which calls PATCH /api/profile { action: "lock" }.
      console.log(`  ↻ Navigating to dashboard to lock plan...`)
      await page.goto(`${BASE}/dashboard`)
      await waitForLoad(page)
      await page.waitForTimeout(6000)

      const lockBtn = page.locator('button:has-text("Lock plan")')
      let lockBtnVisible = await lockBtn.isVisible({ timeout: 10000 }).catch(() => false)

      if (!lockBtnVisible) {
        // Reload in case dashboard cached stale state
        await page.reload()
        await waitForLoad(page)
        await page.waitForTimeout(6000)
        lockBtnVisible = await lockBtn.isVisible({ timeout: 10000 }).catch(() => false)
      }

      if (lockBtnVisible) {
        await lockBtn.click()
        console.log(`  ✓ Clicked "Lock plan" — waiting for lock to complete...`)
        await page.waitForTimeout(8000)

        // Verify lock + stage via API
        const lockCheck = await page.evaluate(async () => {
          const res = await fetch("/api/profile")
          if (!res.ok) return null
          const data = await res.json()
          return { locked: data.plan?.locked, stage: data.plan?.stage }
        })
        if (lockCheck) {
          console.log(`  📋 Lock check: locked=${lockCheck.locked}, stage=${lockCheck.stage}`)
          if (!lockCheck.locked) {
            note(persona.name, 0, "warning", `Plan not locked after clicking Lock plan button (stage=${lockCheck.stage})`)
          }
        }
      } else {
        // Try locking via API directly as fallback
        console.log(`  ⚠️ Lock button not visible — trying API lock as fallback...`)
        const apiLockResult = await page.evaluate(async () => {
          // First get current plan version
          const profileRes = await fetch("/api/profile")
          if (!profileRes.ok) return { error: "profile_fetch_failed" }
          const profileData = await profileRes.json()
          const planVersion = profileData.plan?.plan_version || 0

          const res = await fetch("/api/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "lock", expectedVersion: planVersion }),
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            return { error: `status_${res.status}`, detail: errData }
          }
          const data = await res.json()
          return { locked: data.plan?.locked, stage: data.plan?.stage }
        })
        console.log(`  📋 API lock result:`, JSON.stringify(apiLockResult))
        if (apiLockResult && "error" in apiLockResult) {
          note(persona.name, 0, "warning", `API lock failed: ${apiLockResult.error}`)
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // STAGE 3: Dashboard Verification
      // ═══════════════════════════════════════════════════════════════════
      console.log(`\n  ── STAGE 3: Dashboard Verification ──`)

      await page.goto(`${BASE}/dashboard`)
      await waitForLoad(page)
      await page.waitForTimeout(4000)

      const dashBody = (await page.textContent("body")) || ""
      const dashLower = dashBody.toLowerCase()

      const hasName = dashBody.includes(persona.name)
      const hasDestination = dashLower.includes(persona.expectedDestination.toLowerCase())
      const hasCity = dashLower.includes(persona.expectedCity.toLowerCase())

      result.dashboardOk = hasName && hasDestination
      if (!hasName) note(persona.name, 0, "bug", `Dashboard missing name "${persona.name}"`)
      if (!hasDestination) note(persona.name, 0, "bug", `Dashboard missing destination "${persona.expectedDestination}"`)
      if (!hasCity) note(persona.name, 0, "warning", `Dashboard missing city "${persona.expectedCity}"`)

      const profileData = await page.evaluate(async () => {
        const res = await fetch("/api/profile")
        if (!res.ok) return null
        const data = await res.json()
        return data.plan?.profile_data || null
      })

      if (profileData) {
        const nonNullFields = Object.entries(profileData).filter(([, v]) => v !== null && v !== "").length
        console.log(`  📋 API: ${nonNullFields} non-null fields`)
        if (nonNullFields < 8) {
          note(persona.name, 0, "bug", `Only ${nonNullFields} non-null fields in profile — too few`)
        }
      } else {
        note(persona.name, 0, "bug", "API: Could not fetch profile data")
      }

      await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_dashboard.png`, fullPage: true })

      // ═══════════════════════════════════════════════════════════════════
      // STAGE 4: Guide Generation + Full Tab Enrichment Validation
      // ═══════════════════════════════════════════════════════════════════
      console.log(`\n  ── STAGE 4: Guide Generation + Tab Validation ──`)

      await page.goto(`${BASE}/guides`)
      await waitForLoad(page)
      await page.waitForTimeout(3000)

      let guideFound = false
      const guideStart = Date.now()

      // Check immediately if guide already exists
      const initialGuideCards = page.locator('.gm-card')
      if (await initialGuideCards.count() > 0) {
        guideFound = true
      }

      // If no guide, try clicking Generate button right away
      if (!guideFound) {
        const generateBtn = page.locator('button:has-text("Generate Guide")')
        const genVisible = await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)
        if (genVisible) {
          console.log(`  ↻ Clicking "Generate Guide"...`)
          await generateBtn.click()
          await page.waitForTimeout(3000)
        }

        // Poll for up to 180s (guide generation + enrichment can be slow)
        for (let poll = 0; poll < 36; poll++) {
          const count = await page.locator('.gm-card').count()
          if (count > 0) {
            guideFound = true
            break
          }

          await page.waitForTimeout(5000)
          // Reload every 30s to check if guide appeared
          if (poll % 6 === 5) {
            await page.reload()
            await waitForLoad(page)
            await page.waitForTimeout(2000)
          }
        }
      }

      if (guideFound) {
        result.guideGenerated = true
        console.log(`  ✓ Guide found after ${Math.round((Date.now() - guideStart) / 1000)}s`)

        const guideLink = page.locator('.gm-card').first()
        await guideLink.click()
        // Wait for navigation to guide detail page
        await page.waitForURL(/\/guides\//, { timeout: 10000 }).catch(() => {})
        await waitForLoad(page)
        await page.waitForTimeout(3000)

        // Verify we're on the guide detail page
        const currentUrl = page.url()
        if (!currentUrl.includes("/guides/")) {
          note(persona.name, 0, "warning", `Guide card click did not navigate — URL: ${currentUrl}`)
        }

        // Check destination-specific terms across all tab content
        // First collect text from all tabs
        let allGuideText = (await page.textContent("body")) || ""

        // Validate all tabs for enriched content
        await validateGuideTabs(page, persona, result)

        // Re-read full body after tab cycling (captures all loaded tab content)
        allGuideText = (await page.textContent("body")) || ""
        const termResults = validateTerms(allGuideText, persona.guideTerms)
        result.guideTermsFound = termResults.found.length
        console.log(`  📋 Guide terms: ${termResults.found.length}/${persona.guideTerms.length} found`)
        if (termResults.found.length > 0) console.log(`    Found: ${termResults.found.join(", ")}`)
        if (termResults.missing.length > 0) console.log(`    Missing: ${termResults.missing.join(", ")}`)

        console.log(`  📋 Tab enrichment: ${result.tabsEnriched}/${result.tabsTotal}`)
      } else {
        note(persona.name, 0, "bug", "Guide not generated after 180s")
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_no_guide.png`, fullPage: true })
      }

      // ═══════════════════════════════════════════════════════════════════
      // STAGE 5: Trigger Arrival (v2 — button-only detection)
      // ═══════════════════════════════════════════════════════════════════
      console.log(`\n  ── STAGE 5: Trigger Arrival ──`)

      await page.goto(`${BASE}/dashboard`)
      await waitForLoad(page)
      await page.waitForTimeout(3000)

      // Wait for dashboard to fully load, then check for arrival banner
      await page.waitForTimeout(3000)
      const arrivalBtn = page.locator('button:has-text("I\'ve arrived!")')
      let arrivalBtnVisible = await arrivalBtn.isVisible({ timeout: 5000 }).catch(() => false)

      // If not visible, reload and try again (dashboard may cache stale state)
      if (!arrivalBtnVisible) {
        await page.reload()
        await waitForLoad(page)
        await page.waitForTimeout(4000)
        arrivalBtnVisible = await arrivalBtn.isVisible({ timeout: 5000 }).catch(() => false)
      }

      if (arrivalBtnVisible) {
        await arrivalBtn.click()
        await page.waitForTimeout(1000)

        const dateInput = page.locator('input[type="date"]')
        const dateVisible = await dateInput.isVisible({ timeout: 5000 }).catch(() => false)
        if (dateVisible) {
          const confirmArrivalBtn = page.locator('button:has-text("Confirm")')
          await confirmArrivalBtn.click()
          console.log(`  ✓ Confirmed arrival — waiting for redirect...`)
          await page.waitForTimeout(5000)
          result.arrivalTriggered = true
        } else {
          note(persona.name, 0, "warning", "Date picker did not appear after clicking arrival button")
          result.arrivalSkipReason = "date_picker_missing"
        }
      } else {
        const planState = await page.evaluate(async () => {
          const [profileRes, subRes] = await Promise.all([
            fetch("/api/profile"),
            fetch("/api/subscription"),
          ])
          const profileData = profileRes.ok ? await profileRes.json() : null
          const subData = subRes.ok ? await subRes.json() : null
          return {
            stage: profileData?.plan?.stage,
            tier: subData?.subscription?.tier || subData?.tier || "unknown",
          }
        })

        if (planState) {
          if (planState.stage === "arrived") {
            result.arrivalSkipReason = "already_arrived"
            result.arrivalTriggered = true
            console.log(`  ℹ️ Plan already in arrived state`)
          } else if (planState.tier !== "pro_plus") {
            result.arrivalSkipReason = "tier_not_pro_plus"
            console.log(`  ℹ️ Tier is ${planState.tier} — arrival requires pro_plus`)
          } else if (planState.stage !== "complete") {
            result.arrivalSkipReason = `stage_is_${planState.stage}`
            console.log(`  ℹ️ Plan stage is "${planState.stage}" — needs "complete" for arrival`)
          } else {
            result.arrivalSkipReason = "button_not_visible_unknown"
            note(persona.name, 0, "warning", `Arrival button not visible despite stage=${planState.stage}, tier=${planState.tier}`)
          }
        } else {
          result.arrivalSkipReason = "api_error"
          note(persona.name, 0, "warning", "Could not check plan state via API")
        }
      }

      await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_arrival.png`, fullPage: true })

      // ═══════════════════════════════════════════════════════════════════
      // STAGE 6: Settling-in Checklist
      // ═══════════════════════════════════════════════════════════════════
      if (result.arrivalTriggered) {
        console.log(`\n  ── STAGE 6: Settling-in Checklist ──`)

        await page.goto(`${BASE}/settling-in`)
        await waitForLoad(page)
        await page.waitForTimeout(3000)

        const generateSettlingBtn = page.locator('button:has-text("Generate checklist")')
        const genVisible = await generateSettlingBtn.isVisible({ timeout: 5000 }).catch(() => false)

        if (genVisible) {
          console.log(`  ↻ Clicking "Generate checklist"...`)
          await generateSettlingBtn.click()
        }

        let tasksFound = false
        for (let poll = 0; poll < 24; poll++) {
          const bodyText = (await page.textContent("body")) || ""
          const hasStats = bodyText.includes("/") && (bodyText.includes("available") || bodyText.includes("legal"))
          if (hasStats) {
            tasksFound = true
            break
          }
          await page.waitForTimeout(5000)
          if (poll % 4 === 3) {
            await page.reload()
            await waitForLoad(page)
          }
        }

        if (tasksFound) {
          result.settlingGenerated = true
          const settlingBody = (await page.textContent("body")) || ""

          const taskCountMatch = settlingBody.match(/(\d+)\/(\d+)/)
          if (taskCountMatch) {
            result.settlingTaskCount = parseInt(taskCountMatch[2])
            console.log(`  ✓ Settling-in tasks found: ${result.settlingTaskCount}`)
          }

          const termResults = validateTerms(settlingBody, persona.settlingTerms)
          result.settlingTermsFound = termResults.found.length
          console.log(`  📋 Settling terms: ${termResults.found.length}/${persona.settlingTerms.length} found`)
          if (termResults.found.length > 0) console.log(`    Found: ${termResults.found.join(", ")}`)

          const hasLegal = settlingBody.toLowerCase().includes("legal")
          if (hasLegal) {
            console.log(`  ✓ Legal requirement markers present`)
          } else {
            note(persona.name, 0, "info", "No legal requirement markers found in settling-in")
          }
        } else {
          note(persona.name, 0, "bug", "Settling-in tasks not generated after 120s")
        }

        await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_settling.png`, fullPage: true })
      } else {
        console.log(`\n  ── STAGE 6: SKIPPED (arrival not triggered: ${result.arrivalSkipReason}) ──`)
      }

      // ═══════════════════════════════════════════════════════════════════
      // STAGE 7: Post-Arrival Chat
      // ═══════════════════════════════════════════════════════════════════
      if (result.arrivalTriggered) {
        console.log(`\n  ── STAGE 7: Post-Arrival Chat ──`)

        await page.goto(`${BASE}/chat`)
        await waitForLoad(page)
        await page.waitForTimeout(4000)

        const postChatInput = page
          .locator('input[placeholder="Ask follow-up questions..."], input[placeholder="Type your message..."]')
          .first()
        const inputVisible = await postChatInput.isVisible({ timeout: 10000 }).catch(() => false)

        if (inputVisible) {
          await postChatInput.fill(persona.postArrivalQuestion)
          await postChatInput.press("Enter")
          await waitForAIResponse(page, 30000)

          const responseText = (await page.textContent("body")) || ""
          const termResults = validateTerms(responseText, persona.postArrivalExpectedTerms)
          result.postArrivalOk = termResults.found.length >= 1
          console.log(`  📋 Post-arrival terms: ${termResults.found.length}/${persona.postArrivalExpectedTerms.length} found`)
          if (termResults.found.length > 0) console.log(`    Found: ${termResults.found.join(", ")}`)

          await postChatInput.fill(`Actually I'm going to France now, change my destination`)
          await postChatInput.press("Enter")
          await waitForAIResponse(page, 20000)

          const postExtractionProfile = await page.evaluate(async () => {
            const res = await fetch("/api/profile")
            if (!res.ok) return null
            const data = await res.json()
            return data.plan?.profile_data || null
          })

          if (postExtractionProfile) {
            const destAfter = (postExtractionProfile.destination || "").toLowerCase()
            const stillOriginal = destAfter.includes(persona.expectedDestination.toLowerCase())
            result.extractionBlocked = stillOriginal
            if (!stillOriginal) {
              note(persona.name, 0, "bug", `Profile destination changed to "${destAfter}" — extraction NOT blocked post-arrival!`)
            } else {
              console.log(`  ✓ Extraction blocked — destination still "${persona.expectedDestination}"`)
            }
          } else {
            note(persona.name, 0, "warning", "Could not verify extraction block via API")
          }
        } else {
          note(persona.name, 0, "warning", "Chat input not visible for post-arrival test")
        }

        await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_post_chat.png`, fullPage: true })
      } else {
        console.log(`\n  ── STAGE 7: SKIPPED (arrival not triggered) ──`)
      }

      // ═══════════════════════════════════════════════════════════════════
      // FINALIZE
      // ═══════════════════════════════════════════════════════════════════
      result.durationSec = Math.round((Date.now() - startTime) / 1000)
      allResults.push(result)

      console.log(`\n  ── RESULT: ${result.onboardingComplete ? "✅" : "❌"} Onboard | ${result.guideGenerated ? "✅" : "❌"} Guide (${result.tabsEnriched}/${result.tabsTotal} tabs) | ${result.arrivalTriggered ? "✅" : "⏭️"} Arrive | ${result.settlingGenerated ? "✅" : "❌"} Settle | ${result.postArrivalOk ? "✅" : "❌"} PostAr | ${result.durationSec}s ──`)
    })
  }

  // ─── Final Summary Test ──────────────────────────────────────────────────
  test("SUMMARY — 20 Persona Full E2E Results", async () => {
    console.log(`\n${"═".repeat(100)}`)
    console.log(`  FINAL TEST REPORT: 20-PERSONA FULL E2E`)
    console.log(`${"═".repeat(100)}`)

    const onboardOk = allResults.filter(r => r.onboardingComplete).length
    const guideOk = allResults.filter(r => r.guideGenerated).length
    const arrivalOk = allResults.filter(r => r.arrivalTriggered).length
    const settleOk = allResults.filter(r => r.settlingGenerated).length
    const postArOk = allResults.filter(r => r.postArrivalOk).length
    const extractOk = allResults.filter(r => r.extractionBlocked).length
    const avgDuration = allResults.length > 0 ? Math.round(allResults.reduce((s, r) => s + r.durationSec, 0) / allResults.length) : 0

    console.log(`\n  📊 OVERVIEW`)
    console.log(`  ──────────────────────────────────`)
    console.log(`  Onboarding complete:    ${onboardOk}/20`)
    console.log(`  Guides generated:       ${guideOk}/20`)
    console.log(`  Arrival triggered:      ${arrivalOk}/20`)
    console.log(`  Settling-in generated:  ${settleOk}/20`)
    console.log(`  Post-arrival chat OK:   ${postArOk}/20`)
    console.log(`  Extraction blocked:     ${extractOk}/20`)
    console.log(`  Average duration:       ${avgDuration}s`)

    const totalTabs = allResults.reduce((s, r) => s + r.tabsTotal, 0)
    const enrichedTabs = allResults.reduce((s, r) => s + r.tabsEnriched, 0)
    console.log(`  Tab enrichment:         ${enrichedTabs}/${totalTabs} across all personas`)

    console.log(`\n  📋 PER-PERSONA RESULTS`)
    console.log(`  ${"─".repeat(96)}`)
    console.log(`  ${"Name".padEnd(12)} ${"Dest".padEnd(14)} ${"Purpose".padEnd(14)} ${"Onb".padEnd(5)} ${"Guide".padEnd(6)} ${"Tabs".padEnd(7)} ${"Arrive".padEnd(8)} ${"Settle".padEnd(8)} ${"PostAr".padEnd(8)} ${"Time".padEnd(6)}`)
    console.log(`  ${"─".repeat(96)}`)

    for (const r of allResults) {
      const p = PERSONAS.find(p => p.name === r.persona)!
      console.log(
        `  ${r.persona.padEnd(12)} ${p.expectedCity.padEnd(14)} ${p.expectedPurpose.padEnd(14)} ${(r.onboardingComplete ? "✅" : "❌").padEnd(5)} ${(r.guideGenerated ? "✅" : "❌").padEnd(6)} ${(`${r.tabsEnriched}/${r.tabsTotal}`).padEnd(7)} ${(r.arrivalTriggered ? "✅" : "⏭️").padEnd(8)} ${(r.settlingGenerated ? "✅" : "❌").padEnd(8)} ${(r.postArrivalOk ? "✅" : "❌").padEnd(8)} ${(r.durationSec + "s").padEnd(6)}`
      )
    }

    const tabGapPersonas = allResults.filter(r => r.tabsEnriched < r.tabsTotal && r.tabsTotal > 0)
    if (tabGapPersonas.length > 0) {
      console.log(`\n  📑 TAB ENRICHMENT GAPS`)
      console.log(`  ${"─".repeat(80)}`)
      for (const r of tabGapPersonas) {
        const missingTabs = Object.entries(r.tabResults)
          .filter(([, v]) => !v.enriched)
          .map(([k]) => k)
        console.log(`  [${r.persona}] Missing enrichment: ${missingTabs.join(", ")}`)
      }
    }

    const bugs = allNotes.filter(n => n.severity === "bug")
    if (bugs.length > 0) {
      console.log(`\n  🐛 BUGS (${bugs.length})`)
      console.log(`  ${"─".repeat(80)}`)
      for (const b of bugs) {
        console.log(`  [${b.persona}] ${b.message}`)
      }
    }

    const warnings = allNotes.filter(n => n.severity === "warning")
    if (warnings.length > 0) {
      console.log(`\n  ⚠️  WARNINGS (${warnings.length})`)
      console.log(`  ${"─".repeat(80)}`)
      for (const w of warnings) {
        console.log(`  [${w.persona}] ${w.message}`)
      }
    }

    const featureGaps = allNotes.filter(n => n.severity === "feature_gap")
    if (featureGaps.length > 0) {
      console.log(`\n  🔍 FEATURE GAPS (${featureGaps.length})`)
      console.log(`  ${"─".repeat(80)}`)
      for (const f of featureGaps) {
        console.log(`  [${f.persona}] ${f.message}`)
      }
    }

    const { writeFileSync } = require("fs")
    const reportLines = [
      `# GoMate 20-Persona Full E2E Test Report`,
      ``,
      `**Date:** ${new Date().toISOString()}`,
      ``,
      `## Overview`,
      `- Onboarding complete: ${onboardOk}/20`,
      `- Guides generated: ${guideOk}/20`,
      `- Tab enrichment: ${enrichedTabs}/${totalTabs}`,
      `- Arrival triggered: ${arrivalOk}/20`,
      `- Settling-in generated: ${settleOk}/20`,
      `- Post-arrival chat OK: ${postArOk}/20`,
      `- Extraction blocked: ${extractOk}/20`,
      `- Average duration: ${avgDuration}s`,
      ``,
      `## Per-Persona Results`,
      ``,
      `| # | Name | Route | Purpose | Onboard | Guide | Tabs | Arrive | Settle | PostAr | Time |`,
      `|---|------|-------|---------|---------|-------|------|--------|--------|--------|------|`,
    ]

    for (let i = 0; i < allResults.length; i++) {
      const r = allResults[i]
      const p = PERSONAS[i]
      reportLines.push(
        `| ${i + 1} | ${r.persona} | ${p.expectedCitizenship} → ${p.expectedCity} | ${p.expectedPurpose} | ${r.onboardingComplete ? "✅" : "❌"} | ${r.guideGenerated ? "✅" : "❌"} | ${r.tabsEnriched}/${r.tabsTotal} | ${r.arrivalTriggered ? "✅" : "⏭️"} | ${r.settlingGenerated ? "✅" : "❌"} | ${r.postArrivalOk ? "✅" : "❌"} | ${r.durationSec}s |`
      )
    }

    if (tabGapPersonas.length > 0) {
      reportLines.push(``, `## Tab Enrichment Gaps`, ``)
      for (const r of tabGapPersonas) {
        const details = Object.entries(r.tabResults)
          .filter(([, v]) => !v.enriched)
          .map(([k, v]) => `${k} (${v.proseBlocks} prose, ${v.textLength} chars)`)
        reportLines.push(`- **${r.persona}**: ${details.join(", ")}`)
      }
    }

    if (bugs.length > 0) {
      reportLines.push(``, `## Bugs (${bugs.length})`, ``)
      for (const b of bugs) reportLines.push(`- **[${b.persona}]** ${b.message}`)
    }

    if (warnings.length > 0) {
      reportLines.push(``, `## Warnings (${warnings.length})`, ``)
      for (const w of warnings) reportLines.push(`- **[${w.persona}]** ${w.message}`)
    }

    if (featureGaps.length > 0) {
      reportLines.push(``, `## Feature Gaps (${featureGaps.length})`, ``)
      for (const f of featureGaps) reportLines.push(`- **[${f.persona}]** ${f.message}`)
    }

    writeFileSync(`${SCREENSHOT_DIR}/REPORT.md`, reportLines.join("\n"))
    console.log(`\n  📄 Full report written to ${SCREENSHOT_DIR}/REPORT.md`)
  })
})
