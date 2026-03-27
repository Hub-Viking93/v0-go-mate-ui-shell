import { test, expect, type Page } from "@playwright/test"

const BASE = "http://localhost:3000"
const EMAIL = "axelcornelius93@gmail.com"
const PASSWORD = "AvC93!4778"
const SCREENSHOT_DIR = "/tmp/gomate_onboarding_20"

// ─── Test Notes Accumulator ────────────────────────────────────────────────
interface TestNote {
  persona: string
  turn: number
  severity: "bug" | "warning" | "info"
  message: string
  screenshot?: string
}

const allNotes: TestNote[] = []
const personaResults: {
  persona: string
  completed: boolean
  finalPercent: number
  totalTurns: number
  idleCount: number
  stuckFields: string[]
  dashboardVerified: boolean
  fieldsCorrect: string[]
  fieldsMissing: string[]
  fieldsWrong: string[]
  duration: number
}[] = []

function note(persona: string, turn: number, severity: TestNote["severity"], message: string) {
  allNotes.push({ persona, turn, severity, message })
  const icon = severity === "bug" ? "❌" : severity === "warning" ? "⚠️" : "ℹ️"
  console.log(`  ${icon} [${persona} T${turn}] ${message}`)
}

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
  // Expected purpose for dashboard verification
  expectedPurpose: string
  expectedDestination: string
  expectedCity: string
  expectedCitizenship: string
  // Field answers keyed by profile field key
  fields: Record<string, string>
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
  // Brief wait for request to start
  await page.waitForTimeout(1500)

  const start = Date.now()
  while (Date.now() - start < maxWait) {
    // Check for typing indicator (bounce dots)
    const hasBounce = await page.locator(".animate-bounce").first().isVisible({ timeout: 300 }).catch(() => false)
    if (!hasBounce) {
      // Also check if streaming content is still being rendered
      await page.waitForTimeout(500)
      const stillBouncing = await page.locator(".animate-bounce").first().isVisible({ timeout: 300 }).catch(() => false)
      if (!stillBouncing) break
    }
    await page.waitForTimeout(500)
  }
  // Extra settle time
  await page.waitForTimeout(1000)
}

function findAnswer(persona: Persona, pendingLabel: string, pendingKey: string | null): string | null {
  // Try direct key match
  if (pendingKey && persona.fields[pendingKey]) {
    return persona.fields[pendingKey]
  }

  // Try label → key mapping
  const mappedKey = LABEL_TO_KEY[pendingLabel]
  if (mappedKey && persona.fields[mappedKey]) {
    return persona.fields[mappedKey]
  }

  // Fuzzy match: convert label to snake_case and search
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

// ─── Tests ─────────────────────────────────────────────────────────────────

test.describe.serial("GoMate 20-Persona Onboarding Test Suite", () => {
  // 12 minutes per test (generous for AI response times)
  test.describe.configure({ timeout: 720000 })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    // Create screenshot directory
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

    test(`${idx}/20 — ${persona.name}: ${persona.expectedCitizenship} → ${persona.expectedCity}, ${persona.expectedDestination} (${persona.expectedPurpose})`, async () => {
      const startTime = Date.now()
      console.log(`\n${"=".repeat(70)}`)
      console.log(`  TEST ${idx}/20: ${persona.name} (${persona.expectedCitizenship} → ${persona.expectedCity})`)
      console.log(`  Purpose: ${persona.expectedPurpose}`)
      console.log(`${"=".repeat(70)}`)

      // ── Step 1: Create fresh plan ──
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
        // Try to archive old plans
        note(persona.name, 0, "info", "Plan limit reached — skipping this persona")
        personaResults.push({
          persona: persona.name,
          completed: false,
          finalPercent: 0,
          totalTurns: 0,
          idleCount: 0,
          stuckFields: [],
          dashboardVerified: false,
          fieldsCorrect: [],
          fieldsMissing: [],
          fieldsWrong: [],
          duration: Date.now() - startTime,
        })
        return
      }
      expect(createResult.status).toBe(200)
      console.log(`  ✓ Plan created: ${persona.planTitle}`)

      // ── Step 2: Navigate to chat ──
      await page.goto(`${BASE}/chat`)
      await waitForLoad(page)
      await page.waitForTimeout(4000)

      const chatInput = page.locator('input[placeholder="Type your message..."]').first()
      await chatInput.waitFor({ timeout: 15000 })

      // ── Step 3: Onboarding conversation ──
      let idleCount = 0
      let totalTurns = 0
      let lastPendingField = ""
      let stuckCount = 0
      const stuckFields: string[] = []
      let reachedReview = false

      for (let turn = 0; turn < 35; turn++) {
        totalTurns++

        // Read the "Next:" field indicator
        const nextSpan = page.locator('span.text-primary:has-text("Next:")').first()
        let pendingLabel = ""
        if (await nextSpan.isVisible({ timeout: 1000 }).catch(() => false)) {
          const spanText = (await nextSpan.textContent()) || ""
          pendingLabel = spanText.replace("Next:", "").trim()
        }

        // Read page state
        const bodyText = (await page.textContent("body")) || ""
        const completionMatch = bodyText.match(/(\d+)%/)
        const pct = completionMatch ? parseInt(completionMatch[1]) : 0

        // Check for review state: use data-testid selectors as ground truth
        // Do NOT match loose phrases like "Looks good" — AI uses them mid-conversation
        const confirmBtnVisible = await page.locator('[data-testid="confirm-plan-btn"]').isVisible({ timeout: 500 }).catch(() => false)
        const reviewHeader = await page.locator('p:has-text("Review your profile")').isVisible({ timeout: 500 }).catch(() => false)
        const noPendingField = pendingLabel === "" && pct >= 90
        if (pct >= 100 || confirmBtnVisible || reviewHeader || noPendingField) {
          console.log(`  ✅ Profile complete at ${pct}% after ${totalTurns} turns`)
          reachedReview = true
          await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_complete.png`, fullPage: true })
          break
        }

        // Detect stuck on same field
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

        // Determine answer
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
          // No "Next:" indicator — either first turn or AI went off-script
          if (turn === 0) {
            answer = `Hi, ${persona.fields.name?.replace(/^(My name is |I'm |I am )/, "") || persona.name}`
          } else {
            // Check if AI is asking a question in its last message
            const lastMessages = bodyText.slice(-800).toLowerCase()
            const isAskingQuestion = lastMessages.includes("?")

            if (isAskingQuestion) {
              // Try to figure out what it's asking about from context
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

              if (contextAnswer) {
                answer = contextAnswer
              } else {
                // Generic: just provide the next unfilled piece of info
                answer = "What's the next question?"
                note(persona.name, totalTurns, "info", "AI asked a question but no Next: indicator visible")
              }
            } else {
              // Check for idle
              const idlePhrases = [
                "feel free to ask",
                "let me know if you",
                "anything else you'd like",
                "is there anything else",
                "don't hesitate",
                "happy to help with anything",
              ]
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

        // Check for idle phrases in recent text
        const recentText = bodyText.slice(-600).toLowerCase()
        const idlePhrases = [
          "feel free to ask",
          "let me know if you",
          "anything else you'd like",
          "is there anything else",
          "don't hesitate",
        ]
        const isIdle = idlePhrases.some(p => recentText.includes(p)) && pct < 100 && pendingLabel !== ""
        if (isIdle) {
          note(persona.name, totalTurns, "bug", `AI went IDLE at ${pct}% while "${pendingLabel}" is pending`)
          idleCount++
        }

        console.log(`  [T${totalTurns}] ${pct}% | Next: "${pendingLabel}" → "${answer.slice(0, 60)}..."`)
        await chatInput.fill(answer)
        await chatInput.press("Enter")
        await waitForAIResponse(page)
      }

      if (!reachedReview) {
        const finalBody = (await page.textContent("body")) || ""
        const finalMatch = finalBody.match(/(\d+)%/)
        const finalPct = finalMatch ? parseInt(finalMatch[1]) : 0
        note(persona.name, totalTurns, "bug", `Did NOT reach review state after ${totalTurns} turns. Final: ${finalPct}%`)
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_stuck.png`, fullPage: true })
      }

      // ── Step 4: Click "Looks good, generate plan" if visible ──
      // Use data-testid for reliable detection; retry with nudge if needed
      const confirmBtn = page.locator('[data-testid="confirm-plan-btn"]')
      let confirmVisible = await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)

      // Retry 1: If not visible, send a nudge to trigger backend state re-evaluation
      if (!confirmVisible && reachedReview) {
        const nudgeInput = page.locator('input[placeholder="Type your message..."]').first()
        const inputVisible = await nudgeInput.isVisible({ timeout: 2000 }).catch(() => false)
        if (inputVisible) {
          console.log(`  ↻ Nudging AI to trigger review state...`)
          await nudgeInput.fill("I think that covers everything. Is my profile complete?")
          await nudgeInput.press("Enter")
          await waitForAIResponse(page)
          // Extra settle time for React to process SSE metadata and re-render
          await page.waitForTimeout(2000)
          confirmVisible = await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)
        }
      }

      // Retry 2: If still not visible, try one more nudge with explicit confirmation request
      if (!confirmVisible && reachedReview) {
        const nudgeInput2 = page.locator('input[placeholder="Type your message..."]').first()
        const inputVisible2 = await nudgeInput2.isVisible({ timeout: 2000 }).catch(() => false)
        if (inputVisible2) {
          console.log(`  ↻ Second nudge — requesting profile summary...`)
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
        await waitForAIResponse(page, 90000) // Guide generation can be slow
        await page.waitForTimeout(5000)
      } else {
        note(persona.name, totalTurns, "warning", "Confirm button not visible after reaching review/complete")
      }

      await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_after_confirm.png`, fullPage: true })

      // ── Step 5: Verify Dashboard ──
      await page.goto(`${BASE}/dashboard`)
      await waitForLoad(page)
      await page.waitForTimeout(4000)

      const dashBody = (await page.textContent("body")) || ""
      const dashLower = dashBody.toLowerCase()

      await page.screenshot({ path: `${SCREENSHOT_DIR}/${idx}_${persona.name}_dashboard.png`, fullPage: true })

      const fieldsCorrect: string[] = []
      const fieldsMissing: string[] = []
      const fieldsWrong: string[] = []

      // Check key fields on dashboard
      // Name
      if (dashBody.includes(persona.name)) {
        fieldsCorrect.push("name")
      } else {
        fieldsMissing.push("name")
        note(persona.name, 0, "bug", `Dashboard missing name "${persona.name}"`)
      }

      // Destination
      if (dashLower.includes(persona.expectedDestination.toLowerCase())) {
        fieldsCorrect.push("destination")
      } else {
        fieldsMissing.push("destination")
        note(persona.name, 0, "bug", `Dashboard missing destination "${persona.expectedDestination}"`)
      }

      // City
      if (dashLower.includes(persona.expectedCity.toLowerCase())) {
        fieldsCorrect.push("target_city")
      } else {
        fieldsMissing.push("target_city")
        note(persona.name, 0, "warning", `Dashboard missing city "${persona.expectedCity}"`)
      }

      // Purpose
      const purposeLabels: Record<string, string[]> = {
        work: ["work", "employment", "job"],
        study: ["study", "student", "education", "academic"],
        digital_nomad: ["digital nomad", "remote", "nomad", "freelance"],
        settle: ["settle", "settlement", "retire", "permanent", "family reunion"],
      }
      const purposeTerms = purposeLabels[persona.expectedPurpose] || [persona.expectedPurpose]
      if (purposeTerms.some(t => dashLower.includes(t))) {
        fieldsCorrect.push("purpose")
      } else {
        fieldsMissing.push("purpose")
        note(persona.name, 0, "warning", `Dashboard missing purpose "${persona.expectedPurpose}"`)
      }

      // Citizenship
      if (dashLower.includes(persona.expectedCitizenship.toLowerCase())) {
        fieldsCorrect.push("citizenship")
      } else {
        fieldsMissing.push("citizenship")
        note(persona.name, 0, "warning", `Dashboard missing citizenship "${persona.expectedCitizenship}"`)
      }

      // ── Step 6: Verify via API ──
      const profileData = await page.evaluate(async () => {
        const res = await fetch("/api/profile")
        if (!res.ok) return null
        const data = await res.json()
        return data.plan?.profile_data || null
      })

      if (profileData) {
        console.log(`  📋 API Profile Data:`)

        // Check each expected field
        const criticalFields = [
          { key: "name", expected: persona.name },
          { key: "destination", expected: persona.expectedDestination },
          { key: "target_city", expected: persona.expectedCity },
          { key: "citizenship", expected: persona.expectedCitizenship },
          { key: "purpose", expected: persona.expectedPurpose },
        ]

        for (const { key, expected } of criticalFields) {
          const actual = profileData[key]
          if (!actual) {
            if (!fieldsMissing.includes(key)) fieldsMissing.push(key)
            note(persona.name, 0, "bug", `API: "${key}" is null/empty (expected: "${expected}")`)
          } else {
            const actualLower = (actual as string).toLowerCase()
            const expectedLower = expected.toLowerCase()
            // Relaxed check: actual contains expected or expected contains actual
            if (actualLower.includes(expectedLower) || expectedLower.includes(actualLower) ||
                // For purpose, check enum value
                (key === "purpose" && actualLower === expectedLower)) {
              if (!fieldsCorrect.includes(key)) fieldsCorrect.push(key)
              console.log(`    ✓ ${key}: "${actual}"`)
            } else {
              // Partial match for names
              if (key === "name" && (actualLower.includes(persona.name.toLowerCase()) || persona.name.toLowerCase().includes(actualLower))) {
                if (!fieldsCorrect.includes(key)) fieldsCorrect.push(key)
                console.log(`    ✓ ${key}: "${actual}" (partial match)`)
              } else {
                fieldsWrong.push(`${key}: got "${actual}" expected ~"${expected}"`)
                note(persona.name, 0, "bug", `API: "${key}" = "${actual}" but expected ~"${expected}"`)
              }
            }
          }
        }

        // Check non-null fields count
        const nonNullFields = Object.entries(profileData).filter(([, v]) => v !== null && v !== "").length
        console.log(`    📊 Non-null fields: ${nonNullFields}`)
        if (nonNullFields < 8) {
          note(persona.name, 0, "bug", `Only ${nonNullFields} non-null fields in profile — too few`)
        }

        // Check purpose-specific fields
        if (persona.expectedPurpose === "work") {
          if (!profileData.job_field) note(persona.name, 0, "warning", "API: job_field is null for work purpose")
        }
        if (persona.expectedPurpose === "study") {
          if (!profileData.study_type) note(persona.name, 0, "warning", "API: study_type is null for study purpose")
        }
        if (persona.expectedPurpose === "digital_nomad") {
          if (!profileData.monthly_income) note(persona.name, 0, "warning", "API: monthly_income is null for digital_nomad")
        }
        if (persona.expectedPurpose === "settle") {
          if (!profileData.settlement_reason) note(persona.name, 0, "warning", "API: settlement_reason is null for settle purpose")
        }

        // Check moving_alone and family fields
        const movingAlone = profileData.moving_alone
        if (movingAlone === "no" || movingAlone === "No") {
          if (!profileData.spouse_joining) {
            note(persona.name, 0, "warning", "API: spouse_joining is null but moving_alone=no")
          }
          if (persona.fields.children_count && persona.fields.children_count !== "0" && persona.fields.children_count.toLowerCase() !== "no children") {
            if (!profileData.children_count) {
              note(persona.name, 0, "warning", "API: children_count is null but persona has children")
            }
          }
        }
      } else {
        note(persona.name, 0, "bug", "API: Could not fetch profile data")
      }

      // Get final completion
      const finalBody = (await page.textContent("body")) || ""
      const finalPctMatch = finalBody.match(/(\d+)%/)
      const finalPercent = finalPctMatch ? parseInt(finalPctMatch[1]) : 0

      const duration = Date.now() - startTime

      personaResults.push({
        persona: persona.name,
        completed: reachedReview,
        finalPercent,
        totalTurns,
        idleCount,
        stuckFields,
        dashboardVerified: fieldsCorrect.length >= 3,
        fieldsCorrect,
        fieldsMissing,
        fieldsWrong,
        duration,
      })

      console.log(`  ── Result: ${reachedReview ? "✅ COMPLETED" : "❌ INCOMPLETE"} | ${finalPercent}% | ${totalTurns} turns | ${idleCount} idles | ${Math.round(duration / 1000)}s`)
      console.log(`  ── Fields OK: [${fieldsCorrect.join(", ")}]`)
      if (fieldsMissing.length) console.log(`  ── Fields MISSING: [${fieldsMissing.join(", ")}]`)
      if (fieldsWrong.length) console.log(`  ── Fields WRONG: [${fieldsWrong.join(", ")}]`)
    })
  }

  // ─── Final Summary Test ──────────────────────────────────────────────────
  test("SUMMARY — 20 Persona Onboarding Results", async () => {
    console.log(`\n${"═".repeat(80)}`)
    console.log(`  FINAL TEST REPORT: 20-PERSONA ONBOARDING`)
    console.log(`${"═".repeat(80)}`)

    const completed = personaResults.filter(r => r.completed).length
    const dashboardOK = personaResults.filter(r => r.dashboardVerified).length
    const totalIdles = personaResults.reduce((sum, r) => sum + r.idleCount, 0)
    const avgTurns = Math.round(personaResults.reduce((sum, r) => sum + r.totalTurns, 0) / personaResults.length)
    const avgDuration = Math.round(personaResults.reduce((sum, r) => sum + r.duration, 0) / personaResults.length / 1000)

    console.log(`\n  📊 OVERVIEW`)
    console.log(`  ─────────────────────────────────`)
    console.log(`  Completed onboarding:  ${completed}/20`)
    console.log(`  Dashboard verified:    ${dashboardOK}/20`)
    console.log(`  Total idle incidents:  ${totalIdles}`)
    console.log(`  Average turns:         ${avgTurns}`)
    console.log(`  Average duration:      ${avgDuration}s`)

    console.log(`\n  📋 PER-PERSONA RESULTS`)
    console.log(`  ${"─".repeat(76)}`)
    console.log(`  ${"Name".padEnd(12)} ${"Dest".padEnd(14)} ${"Purpose".padEnd(14)} ${"Done".padEnd(6)} ${"Pct".padEnd(5)} ${"Turns".padEnd(6)} ${"Idle".padEnd(5)} ${"DB OK".padEnd(6)}`)
    console.log(`  ${"─".repeat(76)}`)

    for (const r of personaResults) {
      const persona = PERSONAS.find(p => p.name === r.persona)!
      console.log(
        `  ${r.persona.padEnd(12)} ${persona.expectedCity.padEnd(14)} ${persona.expectedPurpose.padEnd(14)} ${(r.completed ? "✅" : "❌").padEnd(6)} ${(r.finalPercent + "%").padEnd(5)} ${String(r.totalTurns).padEnd(6)} ${String(r.idleCount).padEnd(5)} ${(r.dashboardVerified ? "✅" : "❌").padEnd(6)}`
      )
    }

    // Bug summary
    const bugs = allNotes.filter(n => n.severity === "bug")
    const warnings = allNotes.filter(n => n.severity === "warning")

    if (bugs.length > 0) {
      console.log(`\n  🐛 BUGS (${bugs.length})`)
      console.log(`  ${"─".repeat(70)}`)
      for (const b of bugs) {
        console.log(`  [${b.persona}] ${b.message}`)
      }
    }

    if (warnings.length > 0) {
      console.log(`\n  ⚠️  WARNINGS (${warnings.length})`)
      console.log(`  ${"─".repeat(70)}`)
      for (const w of warnings) {
        console.log(`  [${w.persona}] ${w.message}`)
      }
    }

    // Write results to file
    const reportLines = [
      `# GoMate 20-Persona Onboarding Test Report`,
      ``,
      `**Date:** ${new Date().toISOString()}`,
      ``,
      `## Overview`,
      `- Completed: ${completed}/20`,
      `- Dashboard verified: ${dashboardOK}/20`,
      `- Total idle incidents: ${totalIdles}`,
      `- Average turns: ${avgTurns}`,
      `- Average duration: ${avgDuration}s`,
      ``,
      `## Per-Persona Results`,
      ``,
      `| # | Name | Route | Purpose | Complete | % | Turns | Idle | Dashboard |`,
      `|---|------|-------|---------|----------|---|-------|------|-----------|`,
    ]

    for (let i = 0; i < personaResults.length; i++) {
      const r = personaResults[i]
      const persona = PERSONAS[i]
      reportLines.push(
        `| ${i + 1} | ${r.persona} | ${persona.expectedCitizenship} → ${persona.expectedCity} | ${persona.expectedPurpose} | ${r.completed ? "✅" : "❌"} | ${r.finalPercent}% | ${r.totalTurns} | ${r.idleCount} | ${r.dashboardVerified ? "✅" : "❌"} |`
      )
    }

    reportLines.push(``, `## Bugs (${bugs.length})`, ``)
    for (const b of bugs) {
      reportLines.push(`- **[${b.persona}]** ${b.message}`)
    }

    reportLines.push(``, `## Warnings (${warnings.length})`, ``)
    for (const w of warnings) {
      reportLines.push(`- **[${w.persona}]** ${w.message}`)
    }

    // Write report via page context (file system access from test)
    const { writeFileSync } = require("fs")
    writeFileSync("/tmp/gomate_onboarding_20/REPORT.md", reportLines.join("\n"))
    console.log(`\n  📄 Full report written to ${SCREENSHOT_DIR}/REPORT.md`)

    console.log(`\n${"═".repeat(80)}`)

    // The test passes if at least 15/20 completed (75%)
    expect(completed).toBeGreaterThanOrEqual(15)
  })
})
