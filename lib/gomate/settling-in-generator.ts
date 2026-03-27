import FirecrawlApp from "@mendable/firecrawl-js"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { getSourceUrl, getAllSources } from "./official-sources"

const openrouter = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================================================
// TYPES
// ============================================================================

export interface SettlingTask {
  tempId: string // temporary ID used during generation for dependency references
  title: string
  description: string
  category: SettlingCategory
  dependsOnTempIds: string[] // references to other tempIds (resolved to UUIDs on insert)
  deadlineDays: number | null // days after arrival by which this must be done
  isLegalRequirement: boolean
  steps: string[]
  documentsNeeded: string[]
  officialLink: string
  estimatedTime: string
  cost: string
  sortOrder: number
}

export type SettlingCategory =
  | "registration"
  | "banking"
  | "housing"
  | "healthcare"
  | "employment"
  | "transport"
  | "utilities"
  | "social"
  | "legal"
  | "other"

export const SETTLING_CATEGORIES: { key: SettlingCategory; label: string; icon: string }[] = [
  { key: "registration", label: "Registration & ID", icon: "ClipboardList" },
  { key: "banking", label: "Banking & Finance", icon: "Landmark" },
  { key: "housing", label: "Housing & Utilities", icon: "Home" },
  { key: "healthcare", label: "Healthcare", icon: "HeartPulse" },
  { key: "employment", label: "Employment", icon: "Briefcase" },
  { key: "transport", label: "Transport", icon: "Car" },
  { key: "utilities", label: "Utilities & Internet", icon: "Wifi" },
  { key: "social", label: "Social & Community", icon: "Users" },
  { key: "legal", label: "Legal & Tax", icon: "Scale" },
  { key: "other", label: "Other", icon: "MoreHorizontal" },
]

export interface SettlingGeneratorInput {
  citizenship: string
  destination: string
  destinationCity?: string
  purpose: string
  visaType?: string
  visaName?: string
  hasJobOffer?: boolean
  hasFamilyInDestination?: boolean
  movingWithFamily?: boolean
  budget?: string
}

export interface GeneratedSettlingPlan {
  tasks: SettlingTask[]
  destination: string
  generatedAt: string
  researchSources: string[]
}

// ============================================================================
// FIRECRAWL RESEARCH
// ============================================================================

function getFirecrawl(): FirecrawlApp | null {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    console.warn("[SettlingGenerator] FIRECRAWL_API_KEY not set")
    return null
  }
  return new FirecrawlApp({ apiKey })
}

async function searchSettlingRequirements(
  firecrawl: FirecrawlApp,
  destination: string,
  citizenship: string,
  city?: string
): Promise<string[]> {
  const results: string[] = []
  const cityStr = city ? ` ${city}` : ""

  const queries = [
    `${destination}${cityStr} what to do after arriving checklist new residents`,
    `${destination} city registration residence permit after arrival ${citizenship}`,
    `${destination} open bank account foreign resident requirements`,
    `${destination} healthcare registration expats newcomers`,
  ]

  for (const query of queries.slice(0, 3)) {
    try {
      const searchResult = await firecrawl.search(query, {
        limit: 2,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      })
      if (searchResult.success && searchResult.data) {
        for (const r of searchResult.data) {
          if (r.markdown) results.push(r.markdown.slice(0, 3000))
        }
      }
    } catch (err) {
      console.warn(`[SettlingGenerator] Search failed: ${query}`, err)
    }
  }
  return results
}

async function scrapeSettlingSources(
  firecrawl: FirecrawlApp,
  destination: string
): Promise<{ content: string; url: string }[]> {
  const results: { content: string; url: string }[] = []
  const urls = [
    getSourceUrl(destination, "immigration"),
    getSourceUrl(destination, "banking"),
    getSourceUrl(destination, "housing"),
  ].filter(Boolean) as string[]

  for (const url of urls.slice(0, 2)) {
    try {
      const res = await firecrawl.scrapeUrl(url, {
        formats: ["markdown"],
        onlyMainContent: true,
      })
      if (res.success && res.markdown) {
        results.push({ content: res.markdown.slice(0, 4000), url })
      }
    } catch (err) {
      console.warn(`[SettlingGenerator] Scrape failed: ${url}`, err)
    }
  }
  return results
}

// ============================================================================
// AI GENERATION
// ============================================================================

async function generateSettlingTasksWithAI(
  input: SettlingGeneratorInput,
  research: string[],
  scraped: { content: string; url: string }[]
): Promise<SettlingTask[]> {
  const allContent = [...research, ...scraped.map((s) => s.content)].join("\n\n---\n\n")

  const sources = getAllSources(input.destination)
  const sourceLinks = sources
    ? Object.entries(sources)
        .filter(([, url]) => url)
        .map(([k, url]) => `- ${k}: ${url}`)
        .join("\n")
    : "None available"

  const prompt = `You are an expert relocation advisor. Generate a comprehensive settling-in checklist for someone who has JUST ARRIVED in their new country. These are POST-ARRIVAL tasks only (not visa/pre-departure tasks).

**Relocated Person:**
- From: ${input.citizenship}
- Arrived in: ${input.destination}${input.destinationCity ? ` (${input.destinationCity})` : ""}
- Purpose: ${input.purpose}
- Visa: ${input.visaName || input.visaType || "Not specified"}
${input.hasJobOffer ? "- Has a job offer" : ""}
${input.hasFamilyInDestination ? "- Has family in destination" : ""}
${input.movingWithFamily ? "- Moving with family" : ""}
${input.budget ? `- Budget level: ${input.budget}` : ""}

**Official Sources:**
${sourceLinks}

**Research:**
${allContent.slice(0, 12000)}

Generate a JSON array of settling-in tasks. Each task MUST have:
- tempId: short unique snake_case ID (e.g. "register_residence", "open_bank")
- title: clear task name
- description: 1-2 sentence explanation
- category: one of "registration", "banking", "housing", "healthcare", "employment", "transport", "utilities", "social", "legal", "other"
- dependsOnTempIds: array of tempId strings this task depends on (empty if none). A task is "locked" until ALL its dependencies are completed.
- deadlineDays: number of days after arrival by which this MUST be done (null if no legal deadline). Only set for legally mandated tasks.
- isLegalRequirement: true if failing to do this could result in fines or legal issues
- steps: array of 2-5 concise step strings
- documentsNeeded: array of document names needed for this task
- officialLink: URL to the official resource for this task (use sources above)
- estimatedTime: e.g. "30 minutes", "1-2 hours", "2-3 weeks"
- cost: e.g. "Free", "~50 EUR", "Varies"
- sortOrder: integer 0-99 representing recommended order

**Critical Rules:**
1. DEPENDENCY GRAPH: Model real dependencies. E.g. opening a bank account often requires a residence registration first. Healthcare registration may require a bank account. Build a realistic DAG.
2. DEADLINES: Many countries have legal deadlines (e.g. Germany: register residence within 14 days). Include accurate deadlineDays for legally mandated tasks.
3. LEGAL REQUIREMENTS: Mark isLegalRequirement=true for tasks that are legally mandated (residence registration, tax registration, etc.)
4. COUNTRY-SPECIFIC: Include country-specific tasks (e.g. Anmeldung in Germany, NIE in Spain, BSN in Netherlands, Social Security Number in US)
5. Generate 15-25 tasks covering all categories
6. Sort by logical order: registration first, then banking, healthcare, etc.

Return ONLY a valid JSON array.`

  try {
    const result = await generateText({
      model: openrouter("anthropic/claude-sonnet-4"),
      prompt,
      maxOutputTokens: 6000,
    })

    const jsonMatch = result.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error("[SettlingGenerator] No JSON array in AI response")
      return getDefaultSettlingTasks(input)
    }

    const raw = JSON.parse(jsonMatch[0]) as SettlingTask[]
    const validCategories = SETTLING_CATEGORIES.map((c) => c.key)

    return raw.map((t, i) => ({
      tempId: t.tempId || `task_${i}`,
      title: t.title || "Untitled Task",
      description: t.description || "",
      category: validCategories.includes(t.category as SettlingCategory)
        ? (t.category as SettlingCategory)
        : "other",
      dependsOnTempIds: Array.isArray(t.dependsOnTempIds) ? t.dependsOnTempIds : [],
      deadlineDays: typeof t.deadlineDays === "number" ? t.deadlineDays : null,
      isLegalRequirement: typeof t.isLegalRequirement === "boolean" ? t.isLegalRequirement : false,
      steps: Array.isArray(t.steps) ? t.steps : [],
      documentsNeeded: Array.isArray(t.documentsNeeded) ? t.documentsNeeded : [],
      officialLink: t.officialLink || "",
      estimatedTime: t.estimatedTime || "",
      cost: t.cost || "",
      sortOrder: typeof t.sortOrder === "number" ? t.sortOrder : i * 5,
    }))
  } catch (error) {
    console.error("[SettlingGenerator] AI generation failed:", error)
    return getDefaultSettlingTasks(input)
  }
}

// ============================================================================
// DEFAULT TASKS (fallback when AI or Firecrawl unavailable)
// ============================================================================

function getDefaultSettlingTasks(input: SettlingGeneratorInput): SettlingTask[] {
  const tasks: SettlingTask[] = [
    {
      tempId: "register_residence",
      title: "Register your residence",
      description: "Register your address with the local authorities. This is legally required in most countries within the first 1-2 weeks.",
      category: "registration",
      dependsOnTempIds: [],
      deadlineDays: 14,
      isLegalRequirement: true,
      steps: [
        "Find the local registration office (city hall / Rathaus / mairie)",
        "Bring your passport, visa, and rental agreement",
        "Fill out the registration form",
        "Receive your registration confirmation",
      ],
      documentsNeeded: ["Passport", "Visa", "Rental agreement", "Landlord confirmation"],
      officialLink: getSourceUrl(input.destination, "immigration") || "",
      estimatedTime: "1-2 hours",
      cost: "Free",
      sortOrder: 0,
    },
    {
      tempId: "get_tax_id",
      title: "Obtain your tax ID number",
      description: "Apply for or receive your tax identification number. Usually assigned after residence registration.",
      category: "legal",
      dependsOnTempIds: ["register_residence"],
      deadlineDays: 30,
      isLegalRequirement: true,
      steps: [
        "This is often automatically assigned after residence registration",
        "Check with the local tax office if not received within 2 weeks",
        "Keep this number safe - you will need it for employment and banking",
      ],
      documentsNeeded: ["Residence registration confirmation", "Passport"],
      officialLink: "",
      estimatedTime: "Automatic or 1-2 weeks",
      cost: "Free",
      sortOrder: 5,
    },
    {
      tempId: "open_bank_account",
      title: "Open a local bank account",
      description: "Open a bank account to receive salary, pay rent, and manage daily expenses.",
      category: "banking",
      dependsOnTempIds: ["register_residence"],
      deadlineDays: null,
      isLegalRequirement: false,
      steps: [
        "Research local banks and compare fees",
        "Book an appointment or visit a branch",
        "Bring required documents",
        "Set up online banking",
      ],
      documentsNeeded: ["Passport", "Residence registration", "Proof of address", "Employment contract (if available)"],
      officialLink: getSourceUrl(input.destination, "banking") || "",
      estimatedTime: "1-2 hours (appointment may take days to get)",
      cost: "Free - varies by bank",
      sortOrder: 10,
    },
    {
      tempId: "register_healthcare",
      title: "Register for health insurance",
      description: "Register with the local healthcare system or confirm your insurance coverage.",
      category: "healthcare",
      dependsOnTempIds: ["register_residence"],
      deadlineDays: 30,
      isLegalRequirement: true,
      steps: [
        "Choose between public and private health insurance",
        "Provide your employer with insurance details (if employed)",
        "Register with a local general practitioner (GP)",
        "Obtain your health insurance card",
      ],
      documentsNeeded: ["Passport", "Residence registration", "Employment contract"],
      officialLink: "",
      estimatedTime: "2-3 hours research + 30 min registration",
      cost: "Varies by country and plan",
      sortOrder: 15,
    },
    {
      tempId: "get_phone_plan",
      title: "Get a local phone number / SIM card",
      description: "Get a local mobile number for daily life, banking verification, and official communications.",
      category: "utilities",
      dependsOnTempIds: [],
      deadlineDays: null,
      isLegalRequirement: false,
      steps: [
        "Compare local mobile providers",
        "Visit a store with your passport",
        "Choose a prepaid or contract plan",
        "Port your old number if desired",
      ],
      documentsNeeded: ["Passport", "Proof of address (for contracts)"],
      officialLink: "",
      estimatedTime: "30 minutes - 1 hour",
      cost: "10-30 EUR/month typical",
      sortOrder: 3,
    },
    {
      tempId: "setup_internet",
      title: "Set up home internet",
      description: "Arrange home internet service for your new address.",
      category: "utilities",
      dependsOnTempIds: ["get_phone_plan"],
      deadlineDays: null,
      isLegalRequirement: false,
      steps: [
        "Compare internet providers in your area",
        "Choose a plan (fiber if available)",
        "Schedule installation appointment",
        "Set up your Wi-Fi router",
      ],
      documentsNeeded: ["ID", "Bank account details", "Rental agreement"],
      officialLink: "",
      estimatedTime: "1-3 weeks for installation",
      cost: "20-60 EUR/month",
      sortOrder: 20,
    },
    {
      tempId: "register_gp",
      title: "Register with a local doctor (GP)",
      description: "Find and register with a general practitioner for routine healthcare needs.",
      category: "healthcare",
      dependsOnTempIds: ["register_healthcare"],
      deadlineDays: null,
      isLegalRequirement: false,
      steps: [
        "Search for GPs accepting new patients in your area",
        "Call to check availability and register",
        "Bring your health insurance details",
        "Schedule an introductory appointment if available",
      ],
      documentsNeeded: ["Health insurance card", "Passport", "Residence registration"],
      officialLink: "",
      estimatedTime: "1-2 hours",
      cost: "Free (covered by insurance)",
      sortOrder: 25,
    },
    {
      tempId: "learn_transport",
      title: "Learn the public transport system",
      description: "Get familiar with local buses, trains, and transit apps. Get a monthly pass if needed.",
      category: "transport",
      dependsOnTempIds: [],
      deadlineDays: null,
      isLegalRequirement: false,
      steps: [
        "Download the local transit app",
        "Learn the routes near your home and workplace",
        "Buy a monthly/weekly pass if commuting",
        "Learn bike-share or scooter-share options",
      ],
      documentsNeeded: [],
      officialLink: "",
      estimatedTime: "1-2 hours",
      cost: "Varies",
      sortOrder: 8,
    },
  ]

  // Add employment task if they have a job offer
  if (input.hasJobOffer || input.purpose === "work") {
    tasks.push({
      tempId: "start_employment",
      title: "Complete employment onboarding",
      description: "Provide your employer with all required documents for payroll and tax registration.",
      category: "employment",
      dependsOnTempIds: ["register_residence", "open_bank_account", "get_tax_id"],
      deadlineDays: null,
      isLegalRequirement: false,
      steps: [
        "Provide bank details for salary deposits",
        "Submit tax ID to your employer",
        "Complete any company onboarding paperwork",
        "Confirm your social security registration",
      ],
      documentsNeeded: ["Tax ID", "Bank account details", "Residence registration", "Work permit/visa"],
      officialLink: getSourceUrl(input.destination, "employment") || "",
      estimatedTime: "1-2 hours",
      cost: "Free",
      sortOrder: 30,
    })
  }

  // Add family tasks if applicable
  if (input.movingWithFamily) {
    tasks.push({
      tempId: "enroll_children",
      title: "Enroll children in school",
      description: "Research and enroll your children in local schools or international schools.",
      category: "social",
      dependsOnTempIds: ["register_residence"],
      deadlineDays: null,
      isLegalRequirement: true,
      steps: [
        "Research local and international school options",
        "Contact schools for availability",
        "Prepare required documents (birth certificates, school records)",
        "Complete enrollment and attend orientation",
      ],
      documentsNeeded: ["Birth certificates", "Previous school records", "Vaccination records", "Passport copies"],
      officialLink: "",
      estimatedTime: "Several weeks",
      cost: "Free (public) or varies (private/international)",
      sortOrder: 35,
    })
  }

  tasks.push({
    tempId: "explore_neighborhood",
    title: "Explore your neighborhood",
    description: "Find nearby grocery stores, pharmacies, restaurants, and essential services.",
    category: "social",
    dependsOnTempIds: [],
    deadlineDays: null,
    isLegalRequirement: false,
    steps: [
      "Walk around your neighborhood",
      "Locate the nearest supermarket, pharmacy, and doctor",
      "Find local cafes and restaurants",
      "Join local expat groups or community centers",
    ],
    documentsNeeded: [],
    officialLink: "",
    estimatedTime: "A few hours",
    cost: "Free",
    sortOrder: 2,
  })

  return tasks
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export async function generateSettlingInPlan(
  input: SettlingGeneratorInput
): Promise<GeneratedSettlingPlan> {
  const firecrawl = getFirecrawl()
  const researchSources: string[] = []
  let research: string[] = []
  let scraped: { content: string; url: string }[] = []

  if (firecrawl) {
    console.log("[SettlingGenerator] Starting post-arrival research...")

    research = await searchSettlingRequirements(
      firecrawl,
      input.destination,
      input.citizenship,
      input.destinationCity
    )

    scraped = await scrapeSettlingSources(firecrawl, input.destination)
    scraped.forEach((s) => researchSources.push(s.url))
  }

  let tasks: SettlingTask[]

  // Always attempt AI generation — Claude has strong knowledge of country-specific
  // post-arrival requirements even without web research context
  try {
    tasks = await generateSettlingTasksWithAI(input, research, scraped)
  } catch (error) {
    console.error("[SettlingGenerator] AI generation failed, using defaults:", error instanceof Error ? error.message : error)
    tasks = getDefaultSettlingTasks(input)
  }

  // Sort by sortOrder
  tasks.sort((a, b) => a.sortOrder - b.sortOrder)

  return {
    tasks,
    destination: input.destination,
    generatedAt: new Date().toISOString(),
    researchSources,
  }
}

// ============================================================================
// HELPER: Insert tasks into DB with dependency resolution
// ============================================================================

export function resolveDependencies(
  tasks: SettlingTask[],
  tempIdToUuid: Map<string, string>
): { taskUuid: string; dependsOn: string[] }[] {
  return tasks.map((t) => {
    const taskUuid = tempIdToUuid.get(t.tempId) || ""
    const dependsOn = t.dependsOnTempIds
      .map((dep) => tempIdToUuid.get(dep))
      .filter(Boolean) as string[]
    return { taskUuid, dependsOn }
  })
}

/**
 * Compute which tasks are available (all dependencies completed)
 */
export function computeAvailableTasks(
  tasks: { id: string; status: string; depends_on: string[] }[]
): string[] {
  const completedIds = new Set(
    tasks.filter((t) => t.status === "completed").map((t) => t.id)
  )

  return tasks
    .filter((t) => {
      if (t.status !== "locked") return false
      const deps = t.depends_on || []
      return deps.length === 0 || deps.every((d) => completedIds.has(d))
    })
    .map((t) => t.id)
}
