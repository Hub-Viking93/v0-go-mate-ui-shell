import { test, expect, type Page } from "@playwright/test"
import { readFileSync, existsSync } from "node:fs"

const BASE = "http://localhost:3000"
const SCREENSHOT_DIR = "/tmp/gomate_onboarding_strict_10"

function loadLocalEnvValue(key: string): string {
  if (process.env[key]) return process.env[key] as string
  if (!existsSync(".env.local")) return ""

  const lines = readFileSync(".env.local", "utf8").split("\n")
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx === -1) continue

    const envKey = line.slice(0, idx).trim()
    if (envKey !== key) continue

    const rawValue = line.slice(idx + 1).trim()
    return rawValue.replace(/^['"]|['"]$/g, "")
  }

  return ""
}

const EMAIL = loadLocalEnvValue("TEST_EMAIL")
const PASSWORD = loadLocalEnvValue("TEST_PASSWORD")

interface Persona {
  name: string
  route: string
  expectedPurpose: "study" | "work" | "digital_nomad" | "settle"
  expectedDestination: string
  expectedCity: string
  expectedCitizenship: string
  fields: Record<string, string>
  expectedProfile: Record<string, string>
}

interface PersonaResult {
  persona: string
  completed: boolean
  turns: number
  idleCount: number
  stalledReason: string | null
  answeredKeys: string[]
  matchedKeys: string[]
  missingKeys: string[]
  wrongKeys: string[]
  dashboardVerified: boolean
}

interface Note {
  persona: string
  severity: "bug" | "warning" | "info"
  message: string
}

const allNotes: Note[] = []
const personaResults: PersonaResult[] = []

function note(persona: string, severity: Note["severity"], message: string) {
  allNotes.push({ persona, severity, message })
  const icon = severity === "bug" ? "❌" : severity === "warning" ? "⚠️" : "ℹ️"
  console.log(`  ${icon} [${persona}] ${message}`)
}

const LABEL_TO_KEY: Record<string, string> = {
  Name: "name",
  "Destination Country": "destination",
  Destination: "destination",
  "Target City": "target_city",
  Purpose: "purpose",
  "Visa Role": "visa_role",
  Timeline: "timeline",
  Citizenship: "citizenship",
  "Moving Alone": "moving_alone",
  "Type of Study": "study_type",
  "Field of Study": "study_field",
  "Study Funding": "study_funding",
  "Job Offer Status": "job_offer",
  "Job Offer": "job_offer",
  "Job Field": "job_field",
  "Employer Sponsorship": "employer_sponsorship",
  "Highly Skilled": "highly_skilled",
  "Highly Skilled Professional": "highly_skilled",
  "Years of Experience": "years_experience",
  "Work Experience": "years_experience",
  "Remote Income": "remote_income",
  "Income Source": "income_source",
  "Monthly Income": "monthly_income",
  "Income Consistency": "income_consistency",
  "Income History": "income_history_months",
  "Settlement Reason": "settlement_reason",
  "Family Ties": "family_ties",
  "Spouse Joining": "spouse_joining",
  "Number of Children": "children_count",
  "Children Ages": "children_ages",
  "Savings Available": "savings_available",
  "Available Savings": "savings_available",
  Savings: "savings_available",
  "Monthly Budget": "monthly_budget",
  "Budget Help Needed": "need_budget_help",
  "Current Location": "current_location",
  Duration: "duration",
  "Language Skill": "language_skill",
  "Language Skills": "language_skill",
  "Education Level": "education_level",
  Education: "education_level",
  "Prior Visa": "prior_visa",
  "Prior Visas": "prior_visa",
  "Visa Rejections": "visa_rejections",
  "Healthcare Needs": "healthcare_needs",
  Pets: "pets",
  "Special Requirements": "special_requirements",
}

const PERSONAS: Persona[] = [
  {
    name: "Luciana",
    route: "Brazilian -> Tokyo",
    expectedPurpose: "study",
    expectedDestination: "Japan",
    expectedCity: "Tokyo",
    expectedCitizenship: "Brazilian",
    fields: {
      name: "Meu nome e Luciana.",
      destination: "Quero me mudar para o Japao.",
      target_city: "Tquio, especificamente Tokyo.",
      purpose: "Vou estudar um mestrado.",
      visa_role: "Sou a candidata principal.",
      timeline: "Em abril do ano que vem.",
      citizenship: "Sou brasileira, passaporte do Brasil.",
      moving_alone: "Sim, vou sozinha.",
      study_type: "Programa de mestrado em universidade.",
      study_field: "Engenharia robotica.",
      study_funding: "Tenho bolsa MEXT do governo japones.",
      savings_available: "Tenho cerca de 8000 dolares guardados.",
      monthly_budget: "Uns 150000 ienes por mes.",
      need_budget_help: "Sim, uma ajuda leve com o budget seria boa.",
      current_location: "Moro em Sao Paulo, Brasil.",
      duration: "Dois anos.",
      language_skill: "Meu japones e mais ou menos N4.",
      education_level: "Bacharelado em engenharia mecanica.",
      prior_visa: "Nunca tive visto japones.",
      visa_rejections: "Nenhuma rejeicao.",
      healthcare_needs: "Nao tenho necessidades medicas especiais.",
      pets: "Nao tenho pets.",
      special_requirements: "Nada especial.",
    },
    expectedProfile: {
      name: "Luciana",
      destination: "Japan",
      target_city: "Tokyo",
      purpose: "study",
      visa_role: "primary",
      citizenship: "Brazilian",
      study_type: "master",
      study_field: "robotics",
      study_funding: "MEXT",
      moving_alone: "yes",
      current_location: "Sao Paulo",
    },
  },
  {
    name: "Jake",
    route: "American -> Lisbon",
    expectedPurpose: "digital_nomad",
    expectedDestination: "Portugal",
    expectedCity: "Lisbon",
    expectedCitizenship: "American",
    fields: {
      name: "I'm Jake.",
      destination: "Portugal.",
      target_city: "Lisbon.",
      purpose: "I'm moving as a digital nomad.",
      visa_role: "Primary applicant.",
      timeline: "In about two months.",
      citizenship: "American, US passport.",
      moving_alone: "Yep, solo.",
      remote_income: "Yes, I earn remote income.",
      income_source: "Freelance web development for US clients.",
      monthly_income: "About 6000 dollars a month.",
      income_consistency: "Pretty stable month to month.",
      income_history_months: "I've done this for around three years.",
      savings_available: "Roughly 25000 dollars saved.",
      monthly_budget: "About 2000 euros per month.",
      need_budget_help: "No, I already planned that part.",
      current_location: "Austin, Texas, USA.",
      duration: "One to two years.",
      language_skill: "No Portuguese yet.",
      education_level: "Bachelor's in computer science.",
      prior_visa: "No Portuguese visa before.",
      visa_rejections: "Never been rejected.",
      healthcare_needs: "None.",
      pets: "No pets.",
      special_requirements: "Nothing special.",
    },
    expectedProfile: {
      name: "Jake",
      destination: "Portugal",
      target_city: "Lisbon",
      purpose: "digital_nomad",
      visa_role: "primary",
      citizenship: "American",
      remote_income: "yes",
      income_source: "freelance",
      monthly_income: "6000",
      income_consistency: "stable",
      current_location: "Austin",
    },
  },
  {
    name: "Margaret",
    route: "British -> Barcelona",
    expectedPurpose: "settle",
    expectedDestination: "Spain",
    expectedCity: "Barcelona",
    expectedCitizenship: "British",
    fields: {
      name: "I'm Margaret.",
      destination: "Spain.",
      target_city: "Barcelona.",
      purpose: "I want to settle there permanently for retirement.",
      visa_role: "I'm the primary applicant.",
      timeline: "In around six months.",
      citizenship: "British.",
      moving_alone: "No, my husband is coming with me.",
      settlement_reason: "Retirement and lifestyle change.",
      family_ties: "No family there, but we do have friends there.",
      spouse_joining: "Yes, my husband is joining.",
      children_count: "No dependent children.",
      savings_available: "About two hundred thousand pounds in savings and pension funds.",
      monthly_budget: "Around 3000 euros a month.",
      need_budget_help: "No, our finances are planned.",
      current_location: "Manchester, United Kingdom.",
      duration: "Permanently.",
      language_skill: "Basic Spanish, around A2.",
      education_level: "Bachelor's degree.",
      prior_visa: "No Spanish visa before.",
      visa_rejections: "No rejections.",
      healthcare_needs: "My husband needs regular blood pressure medication.",
      pets: "We have a cat coming with us.",
      special_requirements: "We need pet-friendly housing.",
    },
    expectedProfile: {
      name: "Margaret",
      destination: "Spain",
      target_city: "Barcelona",
      purpose: "settle",
      visa_role: "primary",
      citizenship: "British",
      moving_alone: "no",
      spouse_joining: "yes",
      settlement_reason: "retirement",
      healthcare_needs: "blood pressure",
      pets: "cat",
    },
  },
  {
    name: "Rajesh",
    route: "Indian -> Toronto",
    expectedPurpose: "work",
    expectedDestination: "Canada",
    expectedCity: "Toronto",
    expectedCitizenship: "Indian",
    fields: {
      name: "My name is Rajesh.",
      destination: "Canada.",
      target_city: "Toronto.",
      purpose: "I'm relocating for work.",
      visa_role: "I'm the primary applicant.",
      timeline: "In about five months.",
      citizenship: "Indian.",
      moving_alone: "No, I'm moving with my family.",
      job_offer: "Yes, I already have a job offer from a bank in Toronto.",
      job_field: "Data science and analytics.",
      employer_sponsorship: "Yes, the employer is sponsoring through LMIA.",
      highly_skilled: "Yes.",
      years_experience: "Twelve years.",
      spouse_joining: "Yes, my wife is coming too.",
      children_count: "Two children.",
      children_ages: "Eight and five years old.",
      savings_available: "About forty thousand US dollars saved.",
      monthly_budget: "Around 5000 Canadian dollars per month.",
      need_budget_help: "Some help would be useful for Toronto costs.",
      current_location: "Bangalore, India.",
      duration: "Planning permanent residence.",
      language_skill: "Fluent in English.",
      education_level: "Master's in statistics.",
      prior_visa: "I had a US tourist visa before.",
      visa_rejections: "No rejections.",
      healthcare_needs: "My younger child has mild asthma.",
      pets: "No pets.",
      special_requirements: "We need good schools nearby.",
    },
    expectedProfile: {
      name: "Rajesh",
      destination: "Canada",
      target_city: "Toronto",
      purpose: "work",
      visa_role: "primary",
      citizenship: "Indian",
      moving_alone: "no",
      job_offer: "yes",
      job_field: "data science",
      employer_sponsorship: "yes",
      children_count: "2",
    },
  },
  {
    name: "Wei",
    route: "Chinese -> Paris",
    expectedPurpose: "study",
    expectedDestination: "France",
    expectedCity: "Paris",
    expectedCitizenship: "Chinese",
    fields: {
      name: "Wo jiao Wei.",
      destination: "Wo yao qu France.",
      target_city: "Paris.",
      purpose: "Wo shi qu du PhD.",
      visa_role: "Wo shi zhuyao shenqingren.",
      timeline: "Jin nian jiu yue.",
      citizenship: "Wo shi Zhongguo gongmin.",
      moving_alone: "Shi de, wo yige ren.",
      study_type: "University PhD program.",
      study_field: "Molecular biology.",
      study_funding: "I have a university research fellowship.",
      savings_available: "Around ten thousand euros saved.",
      monthly_budget: "Around twelve hundred euros per month.",
      need_budget_help: "Yes, please help me budget.",
      current_location: "Beijing, China.",
      duration: "Three to four years.",
      language_skill: "French B1.",
      education_level: "Master's degree in biology.",
      prior_visa: "No French visa before, but I had a UK student visa.",
      visa_rejections: "No rejections.",
      healthcare_needs: "None.",
      pets: "No pets.",
      special_requirements: "Nothing special.",
    },
    expectedProfile: {
      name: "Wei",
      destination: "France",
      target_city: "Paris",
      purpose: "study",
      visa_role: "primary",
      citizenship: "Chinese",
      study_type: "phd",
      study_field: "biology",
      study_funding: "fellowship",
      current_location: "Beijing",
    },
  },
  {
    name: "Thandi",
    route: "South African -> Amsterdam",
    expectedPurpose: "work",
    expectedDestination: "Netherlands",
    expectedCity: "Amsterdam",
    expectedCitizenship: "South African",
    fields: {
      name: "I'm Thandi.",
      destination: "The Netherlands.",
      target_city: "Amsterdam.",
      purpose: "I'm moving for work.",
      visa_role: "Primary applicant.",
      timeline: "In around three months.",
      citizenship: "South African.",
      moving_alone: "No, my partner is joining me.",
      job_offer: "Yes, I have an offer from a tech startup.",
      job_field: "Product management.",
      employer_sponsorship: "Yes, they are sponsoring the visa.",
      highly_skilled: "Yes.",
      years_experience: "Nine years.",
      spouse_joining: "Yes, my partner is coming.",
      children_count: "No children.",
      savings_available: "About twenty thousand euros.",
      monthly_budget: "Around 3200 euros per month.",
      need_budget_help: "No thanks.",
      current_location: "Cape Town, South Africa.",
      duration: "At least three years.",
      language_skill: "English fluent, Dutch beginner.",
      education_level: "Bachelor's in business science.",
      prior_visa: "No Dutch visa before.",
      visa_rejections: "No rejections.",
      healthcare_needs: "None.",
      pets: "No pets.",
      special_requirements: "We'd prefer housing close to transit.",
    },
    expectedProfile: {
      name: "Thandi",
      destination: "Netherlands",
      target_city: "Amsterdam",
      purpose: "work",
      visa_role: "primary",
      citizenship: "South African",
      moving_alone: "no",
      spouse_joining: "yes",
      job_field: "product",
      employer_sponsorship: "yes",
    },
  },
  {
    name: "Mateo",
    route: "Argentinian -> Rome",
    expectedPurpose: "settle",
    expectedDestination: "Italy",
    expectedCity: "Rome",
    expectedCitizenship: "Argentinian",
    fields: {
      name: "Me llamo Mateo.",
      destination: "Italia.",
      target_city: "Roma.",
      purpose: "Quiero mudarme para establecerme definitivamente.",
      visa_role: "Soy el solicitante principal.",
      timeline: "En unos tres meses.",
      citizenship: "Soy argentino.",
      moving_alone: "Si, voy solo.",
      settlement_reason: "Ciudadania por ascendencia italiana.",
      family_ties: "Si, tengo primos en Roma.",
      savings_available: "Tengo unos quince mil euros.",
      monthly_budget: "Alrededor de 1800 euros por mes.",
      need_budget_help: "Un poco de ayuda estaria bien.",
      current_location: "Buenos Aires, Argentina.",
      duration: "Permanentemente.",
      language_skill: "Italiano intermedio, nivel B1.",
      education_level: "Licenciatura en arquitectura.",
      prior_visa: "No tuve visa italiana antes.",
      visa_rejections: "Nunca me rechazaron.",
      healthcare_needs: "Ninguna.",
      pets: "No tengo mascotas.",
      special_requirements: "Nada especial.",
    },
    expectedProfile: {
      name: "Mateo",
      destination: "Italy",
      target_city: "Rome",
      purpose: "settle",
      visa_role: "primary",
      citizenship: "Argentinian",
      settlement_reason: "ancestry",
      family_ties: "yes",
      moving_alone: "yes",
      current_location: "Buenos Aires",
    },
  },
  {
    name: "Amira",
    route: "Egyptian -> London",
    expectedPurpose: "study",
    expectedDestination: "United Kingdom",
    expectedCity: "London",
    expectedCitizenship: "Egyptian",
    fields: {
      name: "Ana Amira.",
      destination: "Aurid alintiqal ila almamlaka almutahida.",
      target_city: "London.",
      purpose: "Urid dirasat master fi alqanun alduwali.",
      visa_role: "Ana almutaqaddima alraisiya.",
      timeline: "Fi shahr September hatha aleam.",
      citizenship: "Masriya.",
      moving_alone: "Naeam, wahdi.",
      study_type: "Master's degree at a university.",
      study_field: "International law.",
      study_funding: "Self-funded with family support.",
      savings_available: "About thirty thousand pounds including family support.",
      monthly_budget: "Around fifteen hundred pounds monthly.",
      need_budget_help: "Yes please, London is expensive.",
      current_location: "Cairo, Egypt.",
      duration: "One year.",
      language_skill: "Fluent English.",
      education_level: "Bachelor's in law.",
      prior_visa: "I had a UK tourist visa before.",
      visa_rejections: "No rejections.",
      healthcare_needs: "None.",
      pets: "No pets.",
      special_requirements: "Nothing special.",
    },
    expectedProfile: {
      name: "Amira",
      destination: "United Kingdom",
      target_city: "London",
      purpose: "study",
      visa_role: "primary",
      citizenship: "Egyptian",
      study_type: "master",
      study_field: "law",
      study_funding: "family",
      current_location: "Cairo",
    },
  },
  {
    name: "Hassan",
    route: "Pakistani -> Sydney",
    expectedPurpose: "work",
    expectedDestination: "Australia",
    expectedCity: "Sydney",
    expectedCitizenship: "Pakistani",
    fields: {
      name: "Mera naam Hassan hai.",
      destination: "Australia.",
      target_city: "Sydney.",
      purpose: "Main kaam ke liye move kar raha hoon.",
      visa_role: "Main primary applicant hoon.",
      timeline: "Takreeban char mahine mein.",
      citizenship: "Pakistani.",
      moving_alone: "Nahin, meri wife aur beta saath aa rahe hain.",
      job_offer: "Ji haan, hospital se job offer mila hai.",
      job_field: "Cardiology, I'm a doctor.",
      employer_sponsorship: "Yes, the hospital is sponsoring my visa.",
      highly_skilled: "Yes, specialist doctor.",
      years_experience: "Ten years.",
      spouse_joining: "Yes, my wife is coming.",
      children_count: "One child.",
      children_ages: "Three years old.",
      savings_available: "About fifty thousand Australian dollars.",
      monthly_budget: "Around six thousand Australian dollars monthly.",
      need_budget_help: "No, we've planned it.",
      current_location: "Lahore, Pakistan.",
      duration: "Permanently, aiming for PR.",
      language_skill: "Fluent English.",
      education_level: "MBBS and cardiology fellowship.",
      prior_visa: "Had Australian tourist visa before.",
      visa_rejections: "No rejections.",
      healthcare_needs: "None for us.",
      pets: "No pets.",
      special_requirements: "Need daycare near the hospital.",
    },
    expectedProfile: {
      name: "Hassan",
      destination: "Australia",
      target_city: "Sydney",
      purpose: "work",
      visa_role: "primary",
      citizenship: "Pakistani",
      moving_alone: "no",
      spouse_joining: "yes",
      children_count: "1",
      job_field: "cardiology",
    },
  },
  {
    name: "Felix",
    route: "German -> Mexico City",
    expectedPurpose: "digital_nomad",
    expectedDestination: "Mexico",
    expectedCity: "Mexico City",
    expectedCitizenship: "German",
    fields: {
      name: "Ich heisse Felix.",
      destination: "Ich ziehe nach Mexiko.",
      target_city: "Mexiko-Stadt.",
      purpose: "Ich arbeite remote als digital nomad.",
      visa_role: "Ich bin der Hauptantragsteller.",
      timeline: "In etwa sechs Wochen.",
      citizenship: "Deutsch.",
      moving_alone: "Nein, meine Freundin kommt mit.",
      remote_income: "Ja, alles remote.",
      income_source: "Ich bin remote angestellt bei einer Firma in Berlin.",
      monthly_income: "Etwa 5000 Euro pro Monat.",
      income_consistency: "Sehr stabil, festes Gehalt.",
      income_history_months: "Seit vier Jahren.",
      spouse_joining: "Ja, meine Freundin kommt mit.",
      children_count: "Keine Kinder.",
      savings_available: "Etwa 30000 Euro.",
      monthly_budget: "Rund 40000 MXN pro Monat.",
      need_budget_help: "Nein danke.",
      current_location: "Berlin, Deutschland.",
      duration: "Sechs bis zwoelf Monate.",
      language_skill: "Spanisch B1.",
      education_level: "Master in Informatik.",
      prior_visa: "Kein mexikanisches Visum, nur Touristenaufenthalte.",
      visa_rejections: "Nie.",
      healthcare_needs: "Keine.",
      pets: "Keine Haustiere.",
      special_requirements: "Gute Coworking-Spaces waeren wichtig.",
    },
    expectedProfile: {
      name: "Felix",
      destination: "Mexico",
      target_city: "Mexico City",
      purpose: "digital_nomad",
      visa_role: "primary",
      citizenship: "German",
      moving_alone: "no",
      remote_income: "yes",
      income_source: "employed",
      monthly_income: "5000",
      current_location: "Berlin",
    },
  },
]

const QUESTION_KEYWORDS: Array<{ key: string; clues: string[] }> = [
  { key: "name", clues: ["your name", "call you", "name?"] },
  { key: "destination", clues: ["which country", "where are you moving", "destination country"] },
  { key: "target_city", clues: ["which city", "target city", "what city"] },
  { key: "purpose", clues: ["purpose", "why are you moving", "moving for"] },
  { key: "visa_role", clues: ["primary applicant", "dependent", "visa role"] },
  { key: "timeline", clues: ["when", "timeline", "plan to move"] },
  { key: "citizenship", clues: ["citizenship", "passport", "nationality"] },
  { key: "moving_alone", clues: ["alone", "with you", "moving with", "family"] },
  { key: "job_offer", clues: ["job offer", "secured employment"] },
  { key: "job_field", clues: ["what field", "what industry", "profession"] },
  { key: "employer_sponsorship", clues: ["sponsor your visa", "sponsoring", "employer handle"] },
  { key: "study_type", clues: ["type of study", "what kind of program"] },
  { key: "study_field", clues: ["field of study", "what will you study"] },
  { key: "study_funding", clues: ["fund your studies", "scholarship", "self-fund"] },
  { key: "remote_income", clues: ["remote income", "earn income remotely"] },
  { key: "income_source", clues: ["income source", "where does your income come from"] },
  { key: "monthly_income", clues: ["monthly income", "how much do you earn"] },
  { key: "income_consistency", clues: ["consistent", "stable income", "vary a lot"] },
  { key: "income_history_months", clues: ["how long have you been earning", "income history"] },
  { key: "settlement_reason", clues: ["why settle", "settlement reason", "retiring", "ancestry"] },
  { key: "family_ties", clues: ["family ties", "family there", "relatives there"] },
  { key: "spouse_joining", clues: ["spouse joining", "partner joining"] },
  { key: "children_count", clues: ["how many children", "children count"] },
  { key: "children_ages", clues: ["children ages", "how old are your children"] },
  { key: "savings_available", clues: ["savings", "saved up"] },
  { key: "monthly_budget", clues: ["monthly budget", "budget per month"] },
  { key: "need_budget_help", clues: ["budget help", "help with budgeting"] },
  { key: "current_location", clues: ["currently located", "where do you live now", "current location"] },
  { key: "duration", clues: ["how long", "duration", "stay for"] },
  { key: "language_skill", clues: ["language skill", "speak", "language level"] },
  { key: "education_level", clues: ["education level", "highest education"] },
  { key: "years_experience", clues: ["years of experience", "work experience"] },
  { key: "prior_visa", clues: ["prior visa", "had a visa before"] },
  { key: "visa_rejections", clues: ["visa rejections", "ever been rejected"] },
  { key: "healthcare_needs", clues: ["healthcare needs", "medical needs"] },
  { key: "pets", clues: ["pets", "animals"] },
  { key: "special_requirements", clues: ["special requirements", "anything else"] },
]

async function waitForLoad(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
}

async function waitForAIResponse(page: Page, maxWait = 25000): Promise<boolean> {
  const start = Date.now()
  await page.waitForTimeout(1200)

  while (Date.now() - start < maxWait) {
    const stillTyping = await page
      .locator(".animate-bounce")
      .first()
      .isVisible({ timeout: 200 })
      .catch(() => false)

    if (!stillTyping) {
      await page.waitForTimeout(1000)
      const bouncedAgain = await page
        .locator(".animate-bounce")
        .first()
        .isVisible({ timeout: 200 })
        .catch(() => false)
      if (!bouncedAgain) return true
    }

    await page.waitForTimeout(500)
  }

  return false
}

async function signIn(page: Page) {
  expect(EMAIL).toBeTruthy()
  expect(PASSWORD).toBeTruthy()

  await page.goto(`${BASE}/auth/login`)
  await waitForLoad(page)

  const emailInput = page.locator('input[type="email"], input[name="email"]')
  const passwordInput = page.locator('input[type="password"], input[name="password"]')

  if (await emailInput.isVisible({ timeout: 5000 })) {
    await emailInput.fill(EMAIL)
    await passwordInput.fill(PASSWORD)
    await page.locator('button:has-text("Sign"), button:has-text("Log")').click()
    await page.waitForURL(/\/(dashboard|chat|app)/, { timeout: 15000 })
  }
}

async function apiJson(page: Page, input: { path: string; method?: string; body?: unknown }) {
  return page.evaluate(async ({ path, method, body }) => {
    const res = await fetch(path, {
      method: method || "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })

    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      data = null
    }

    return { status: res.status, ok: res.ok, data }
  }, input)
}

async function createPersonaPlan(page: Page, persona: Persona, index: number) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const createResult = await apiJson(page, {
    path: "/api/plans",
    method: "POST",
    body: {
      title: `Strict Debug ${String(index + 1).padStart(2, "0")} - ${persona.name} - ${timestamp}`,
    },
  })
  expect(createResult.ok).toBe(true)
  const createdPlan = (createResult.data as any)?.plan
  expect(createdPlan?.id).toBeTruthy()
  return createdPlan
}

async function getLastAssistantMessage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("div.justify-start"))
    const texts = rows
      .map((row) => row.textContent?.replace(/\s+/g, " ").trim() || "")
      .filter(Boolean)
    return texts[texts.length - 1] || ""
  })
}

function isExplicitQuestion(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    text.includes("?") ||
    /\b(what|which|where|when|who|how|do you|are you|can you|could you|would you|tell me)\b/.test(lower)
  )
}

function normalize(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function inferKey(pendingLabel: string, question: string): string | null {
  if (pendingLabel && LABEL_TO_KEY[pendingLabel]) return LABEL_TO_KEY[pendingLabel]

  const normalizedLabel = normalize(pendingLabel)
  if (normalizedLabel) {
    for (const [label, key] of Object.entries(LABEL_TO_KEY)) {
      const normalizedKnownLabel = normalize(label)
      if (
        normalizedKnownLabel === normalizedLabel ||
        normalizedKnownLabel.includes(normalizedLabel) ||
        normalizedLabel.includes(normalizedKnownLabel)
      ) {
        return key
      }
    }
  }

  const normalizedQuestion = normalize(question)
  for (const entry of QUESTION_KEYWORDS) {
    if (entry.clues.some((clue) => normalizedQuestion.includes(normalize(clue)))) {
      return entry.key
    }
  }

  if (normalizedLabel) {
    const personaLikeKey = Object.values(LABEL_TO_KEY).find((key) => {
      const normalizedKey = normalize(key.replace(/_/g, " "))
      return normalizedLabel.includes(normalizedKey) || normalizedKey.includes(normalizedLabel)
    })
    if (personaLikeKey) return personaLikeKey
  }

  return null
}

function valueLooksCorrect(key: string, actualRaw: unknown, expectedRaw: string): boolean {
  const actual = normalize(String(actualRaw || ""))
  const expected = normalize(expectedRaw)

  if (!actual) return false
  if (actual.includes(expected) || expected.includes(actual)) return true

  const booleanSynonyms: Record<string, string[]> = {
    yes: ["yes", "true", "solo", "primary", "stable"],
    no: ["no", "false"],
    primary: ["primary", "main"],
    study: ["study", "student", "masters", "master", "phd", "university"],
    work: ["work", "job", "employment"],
    settle: ["settle", "retire", "retirement", "ancestry", "permanent"],
    digital_nomad: ["digital nomad", "nomad", "remote", "freelance"],
    freelance: ["freelance", "client"],
    employed: ["employed", "salary", "company"],
    stable: ["stable", "consistent", "regular"],
  }

  if (booleanSynonyms[expected]) {
    return booleanSynonyms[expected].some((term) => actual.includes(term))
  }

  const expectedTokens = expected.split(" ").filter((token) => token.length >= 3)
  if (expectedTokens.length === 0) return false
  const overlap = expectedTokens.filter((token) => actual.includes(token))
  return overlap.length >= Math.min(2, expectedTokens.length)
}

async function verifyDashboard(page: Page, persona: Persona) {
  await page.goto(`${BASE}/dashboard`)
  await waitForLoad(page)
  await page.waitForTimeout(4000)

  const body = (await page.textContent("body")) || ""
  const normalizedBody = normalize(body)
  const requiredTerms = [
    persona.name,
    persona.expectedDestination,
    persona.expectedCity,
    persona.expectedCitizenship,
  ]

  const matched = requiredTerms.filter((term) => normalizedBody.includes(normalize(term)))
  return matched.length >= 3
}

test.describe.serial("Strict 10-persona onboarding and dashboard validation", () => {
  test.describe.configure({ timeout: 720000 })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    const { execSync } = require("node:child_process")
    execSync(`mkdir -p ${SCREENSHOT_DIR}`)

    page = await browser.newPage()
    await signIn(page)
  })

  test.afterAll(async () => {
    if (page) {
      await page.close().catch(() => {})
    }
  })

  for (const [index, persona] of PERSONAS.entries()) {
    test(`${index + 1}/10 ${persona.name} (${persona.route})`, async () => {
      console.log(`\n${"=".repeat(80)}`)
      console.log(`  Persona ${index + 1}/10: ${persona.name} | ${persona.route}`)
      console.log(`${"=".repeat(80)}`)

      const createdPlan = await createPersonaPlan(page, persona, index)
      console.log(`  Plan created: ${createdPlan.id} | ${createdPlan.title}`)
      await page.goto(`${BASE}/chat`)
      await waitForLoad(page)
      await page.waitForTimeout(3000)

      const chatInput = page.locator('input[placeholder="Type your message..."]').first()
      await chatInput.waitFor({ timeout: 15000 })

      const answeredKeys = new Set<string>()
      const matchedKeys: string[] = []
      const missingKeys: string[] = []
      const wrongKeys: string[] = []
      let completed = false
      let turns = 0
      let idleCount = 0
      let stalledReason: string | null = null
      let lastPendingLabel = ""
      let repeatedPendingCount = 0

      for (let step = 0; step < 40; step++) {
        const pendingText = ((await page.locator("span.text-primary").first().textContent().catch(() => "")) || "").trim()
        const pendingLabel = pendingText.startsWith("Next:") ? pendingText.replace("Next:", "").trim() : ""
        const confirmBtn = page.locator('[data-testid="confirm-plan-btn"]')
        const confirmVisible = await confirmBtn.isVisible({ timeout: 500 }).catch(() => false)
        const lastAssistant = await getLastAssistantMessage(page)
        const bodyText = (await page.textContent("body")) || ""
        const progressMatch = bodyText.match(/(\d+)%/)
        const pct = progressMatch ? parseInt(progressMatch[1], 10) : 0

        if (confirmVisible) {
          await confirmBtn.click()
          const confirmSettled = await waitForAIResponse(page, 45000)
          if (!confirmSettled) {
            idleCount += 1
            stalledReason = "Plan confirmation/generation did not settle within timeout"
            note(persona.name, "bug", stalledReason)
          }
          completed = true
          break
        }

        if (pct >= 100 && !pendingLabel) {
          await page.waitForTimeout(2500)
          const confirmVisibleAfterSettle = await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)
          if (confirmVisibleAfterSettle) {
            await confirmBtn.click()
            const confirmSettled = await waitForAIResponse(page, 45000)
            if (!confirmSettled) {
              idleCount += 1
              stalledReason = "Plan confirmation/generation did not settle within timeout"
              note(persona.name, "bug", stalledReason)
            }
            completed = true
          } else {
            stalledReason = "Profile reached 100% with no pending field, but review/confirm UI never appeared"
            note(persona.name, "bug", stalledReason)
          }
          break
        }

        if (pendingLabel && pendingLabel === lastPendingLabel) {
          repeatedPendingCount += 1
        } else {
          repeatedPendingCount = 0
        }
        lastPendingLabel = pendingLabel

        if (repeatedPendingCount >= 2) {
          note(persona.name, "warning", `Pending field repeated: ${pendingLabel}`)
        }

        if (!isExplicitQuestion(lastAssistant)) {
          if (pct < 100 || pendingLabel) {
            idleCount += 1
            stalledReason = `AI stopped asking explicit questions at ${pct}%${pendingLabel ? ` while "${pendingLabel}" was pending` : ""}`
            note(persona.name, "bug", stalledReason)
            break
          }
          await page.waitForTimeout(2000)
          continue
        }

        const fieldKey = inferKey(pendingLabel, lastAssistant)
        if (!fieldKey || !persona.fields[fieldKey]) {
          stalledReason = `Explicit question could not be mapped to an answerable field${pendingLabel ? ` (${pendingLabel})` : ""}`
          note(persona.name, "warning", stalledReason)
          break
        }

        turns += 1
        answeredKeys.add(fieldKey)
        const answer = persona.fields[fieldKey]
        console.log(`  [T${turns}] ${pct}% | ${pendingLabel || fieldKey} -> ${answer.slice(0, 70)}`)

        await chatInput.fill(answer)
        await chatInput.press("Enter")
        const settled = await waitForAIResponse(page)
        if (!settled) {
          idleCount += 1
          stalledReason = `AI response did not settle within timeout after answering "${pendingLabel || fieldKey}"`
          note(persona.name, "bug", stalledReason)
          break
        }
      }

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${String(index + 1).padStart(2, "0")}_${persona.name}_chat.png`,
        fullPage: true,
      })

      const profileResponse = await apiJson(page, { path: "/api/profile" })
      expect(profileResponse.ok).toBe(true)
      const profile = ((profileResponse.data as any)?.plan?.profile_data || {}) as Record<string, unknown>

      for (const key of answeredKeys) {
        const expected = persona.expectedProfile[key]
        if (!expected) continue

        const actual = profile[key]
        if (actual === null || actual === undefined || actual === "") {
          missingKeys.push(key)
          note(persona.name, "bug", `Profile missing answered field "${key}"`)
          continue
        }

        if (valueLooksCorrect(key, actual, expected)) {
          matchedKeys.push(key)
        } else {
          wrongKeys.push(`${key}: got "${String(actual)}" expected ~"${expected}"`)
          note(persona.name, "bug", `Profile mismatch for "${key}": got "${String(actual)}" expected ~"${expected}"`)
        }
      }

      const dashboardVerified = await verifyDashboard(page, persona)
      if (!dashboardVerified) {
        note(persona.name, "bug", "Dashboard did not reflect enough of the persona's final state")
      }

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${String(index + 1).padStart(2, "0")}_${persona.name}_dashboard.png`,
        fullPage: true,
      })

      personaResults.push({
        persona: persona.name,
        completed,
        turns,
        idleCount,
        stalledReason,
        answeredKeys: Array.from(answeredKeys),
        matchedKeys,
        missingKeys,
        wrongKeys,
        dashboardVerified,
      })

      console.log(`  Result: completed=${completed} turns=${turns} idle=${idleCount} dashboard=${dashboardVerified}`)
      if (stalledReason) console.log(`  Stalled: ${stalledReason}`)
      if (missingKeys.length) console.log(`  Missing: ${missingKeys.join(", ")}`)
      if (wrongKeys.length) console.log(`  Wrong: ${wrongKeys.join(" | ")}`)
    })
  }

  test("Summary", async () => {
    const completed = personaResults.filter((result) => result.completed).length
    const dashboardOk = personaResults.filter((result) => result.dashboardVerified).length
    const bugs = allNotes.filter((entry) => entry.severity === "bug")
    const warnings = allNotes.filter((entry) => entry.severity === "warning")

    console.log(`\n${"=".repeat(80)}`)
    console.log("  STRICT 10-PERSONA SUMMARY")
    console.log(`${"=".repeat(80)}`)
    console.log(`  Completed onboarding: ${completed}/${PERSONAS.length}`)
    console.log(`  Dashboard verified:   ${dashboardOk}/${PERSONAS.length}`)
    console.log(`  Bugs:                 ${bugs.length}`)
    console.log(`  Warnings:             ${warnings.length}`)

    for (const result of personaResults) {
      console.log(
        `  ${result.persona.padEnd(12)} done=${String(result.completed).padEnd(5)} turns=${String(result.turns).padEnd(3)} idle=${String(result.idleCount).padEnd(2)} dashboard=${String(result.dashboardVerified).padEnd(5)}`
      )
    }

    const lines = [
      "# Strict 10 Persona Onboarding Report",
      "",
      `Completed onboarding: ${completed}/${PERSONAS.length}`,
      `Dashboard verified: ${dashboardOk}/${PERSONAS.length}`,
      `Bugs: ${bugs.length}`,
      `Warnings: ${warnings.length}`,
      "",
      "## Persona Results",
      "",
      "| Persona | Complete | Turns | Idle | Dashboard | Answered | Matched | Missing | Wrong | Stall |",
      "|---|---|---:|---:|---|---|---|---|---|---|",
      ...personaResults.map((result) => {
        const wrong = result.wrongKeys.join("; ").replace(/\|/g, "/")
        return `| ${result.persona} | ${result.completed ? "yes" : "no"} | ${result.turns} | ${result.idleCount} | ${result.dashboardVerified ? "yes" : "no"} | ${result.answeredKeys.join(", ")} | ${result.matchedKeys.join(", ")} | ${result.missingKeys.join(", ")} | ${wrong} | ${result.stalledReason || ""} |`
      }),
      "",
      "## Notes",
      "",
      ...allNotes.map((entry) => `- [${entry.severity}] ${entry.persona}: ${entry.message}`),
    ]

    const { writeFileSync } = require("node:fs")
    writeFileSync(`${SCREENSHOT_DIR}/REPORT.md`, lines.join("\n"))
    expect(personaResults.length).toBe(PERSONAS.length)
  })
})
