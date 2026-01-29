/**
 * Web Research Service for GoMate
 * 
 * Fetches real-time data for relocation planning:
 * - Cost of living data from Numbeo-like sources
 * - Visa processing information
 * - City-specific details
 * - Housing market data
 * 
 * Uses Firecrawl API for web scraping and AI extraction.
 */

import type { Profile } from "./profile-schema"

// Firecrawl API configuration
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"

// Cache for fetched data (in-memory, resets on server restart)
const dataCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

/**
 * Scrape a URL using Firecrawl API
 */
export async function scrapeUrl(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    console.log("[GoMate] Firecrawl API key not configured, using fallback data")
    return null
  }

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    })

    if (!response.ok) {
      console.error("[GoMate] Firecrawl scrape failed:", response.status)
      return null
    }

    const data = await response.json()
    return data.data?.markdown || null
  } catch (error) {
    console.error("[GoMate] Firecrawl scrape error:", error)
    return null
  }
}

/**
 * Search and scrape using Firecrawl
 */
export async function searchAndScrape(query: string, limit = 3): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) {
    return []
  }

  try {
    // Use Firecrawl's search endpoint
    const response = await fetch(`${FIRECRAWL_BASE_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      }),
    })

    if (!response.ok) {
      console.error("[GoMate] Firecrawl search failed:", response.status)
      return []
    }

    const data = await response.json()
    return (data.data || []).map((item: { markdown?: string }) => item.markdown || "").filter(Boolean)
  } catch (error) {
    console.error("[GoMate] Firecrawl search error:", error)
    return []
  }
}

/**
 * Fetch live cost of living data from Numbeo
 */
export async function fetchLiveCostOfLiving(
  country: string,
  city?: string
): Promise<Partial<CostOfLivingData> | null> {
  const cacheKey = `col_${country}_${city || "default"}`
  const cached = dataCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as Partial<CostOfLivingData>
  }

  const location = city ? `${city}, ${country}` : country
  const searchQuery = `cost of living ${location} rent utilities groceries transportation site:numbeo.com`
  
  const results = await searchAndScrape(searchQuery, 2)
  
  if (results.length === 0) {
    return null
  }

  // Parse the Numbeo data from markdown
  // This is a simplified extraction - in production you'd want more robust parsing
  const content = results.join("\n")
  const extractedData: Partial<CostOfLivingData> = {
    city: city || "Major city",
    country,
    source: "Numbeo (via Firecrawl)",
    lastUpdated: new Date().toISOString().split("T")[0],
  }

  // Try to extract numbers from the content
  const rentMatch = content.match(/apartment.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i)
  if (rentMatch) {
    const rent = parseFloat(rentMatch[1].replace(",", ""))
    extractedData.monthlyRent1Bed = { city: rent, outside: rent * 0.7 }
  }

  const utilitiesMatch = content.match(/utilities.*?(\d{1,3}(?:\.\d{2})?)/i)
  if (utilitiesMatch) {
    extractedData.utilities = parseFloat(utilitiesMatch[1])
  }

  // Cache the result
  dataCache.set(cacheKey, { data: extractedData, timestamp: Date.now() })
  
  return extractedData
}

/**
 * Fetch visa information for a specific country and purpose
 */
export async function fetchVisaInfo(
  fromCountry: string,
  toCountry: string,
  purpose: string
): Promise<VisaProcessingData | null> {
  const cacheKey = `visa_${fromCountry}_${toCountry}_${purpose}`
  const cached = dataCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as VisaProcessingData
  }

  const purposeMap: Record<string, string> = {
    study: "student visa",
    work: "work visa work permit",
    settle: "residence permit immigration",
    digital_nomad: "digital nomad visa remote work visa",
  }

  const visaType = purposeMap[purpose] || "visa"
  const searchQuery = `${toCountry} ${visaType} requirements processing time ${fromCountry} citizens`
  
  const results = await searchAndScrape(searchQuery, 3)
  
  if (results.length === 0) {
    return null
  }

  const content = results.join("\n")
  
  // Extract visa information
  const visaData: VisaProcessingData = {
    visaType: purpose,
    country: toCountry,
    processingTime: "Varies",
    applicationFee: "Check official sources",
    requirements: [],
    tips: [],
    source: "Web research (via Firecrawl)",
  }

  // Try to extract processing time
  const timeMatch = content.match(/processing.*?(\d+[-–]\d+\s*(?:days|weeks|months)|\d+\s*(?:days|weeks|months))/i)
  if (timeMatch) {
    visaData.processingTime = timeMatch[1]
  }

  // Try to extract fee
  const feeMatch = content.match(/(?:fee|cost).*?(?:€|£|\$|EUR|USD|GBP)\s*(\d+(?:,\d+)?)/i)
  if (feeMatch) {
    visaData.applicationFee = feeMatch[0]
  }

  // Cache the result
  dataCache.set(cacheKey, { data: visaData, timestamp: Date.now() })
  
  return visaData
}

/**
 * Fetch housing information for a city
 */
export async function fetchHousingInfo(
  country: string,
  city?: string
): Promise<HousingData | null> {
  const location = city || country
  const searchQuery = `rent apartment ${location} expat housing tips rental platforms`
  
  const results = await searchAndScrape(searchQuery, 2)
  
  if (results.length === 0) {
    return null
  }

  return {
    city: city || "Major cities",
    averageRent: "Varies by area",
    popularAreas: [],
    rentalPlatforms: [],
    tips: [
      "Start your search 1-2 months before moving",
      "Consider temporary accommodation first",
      "Check if utilities are included in rent",
    ],
    source: "Web research (via Firecrawl)",
  }
}

/**
 * Perform comprehensive research for a profile
 */
export async function performComprehensiveResearch(
  profile: Profile
): Promise<ResearchResults> {
  const destination = profile.destination || ""
  const city = profile.target_city
  const citizenship = profile.citizenship || ""
  const purpose = profile.purpose || "other"

  // Fetch data in parallel
  const [liveColData, visaInfo, housingInfo] = await Promise.all([
    fetchLiveCostOfLiving(destination, city),
    fetchVisaInfo(citizenship, destination, purpose),
    fetchHousingInfo(destination, city),
  ])

  // Get fallback data if live fetch failed
  const fallbackColData = getCostOfLivingData(destination, city)
  const costOfLiving = liveColData 
    ? { ...fallbackColData, ...liveColData } as CostOfLivingData
    : fallbackColData || undefined

  return {
    costOfLiving,
    visaProcessing: visaInfo || undefined,
    housing: housingInfo || undefined,
    timestamp: new Date().toISOString(),
  }
}

export interface CostOfLivingData {
  city: string
  country: string
  monthlyRent1Bed: { city: number; outside: number }
  monthlyRent3Bed: { city: number; outside: number }
  utilities: number
  internet: number
  mealInexpensive: number
  mealMidRange: number
  groceries: number
  transportation: number
  overallIndex: number
  source: string
  lastUpdated: string
}

export interface VisaProcessingData {
  visaType: string
  country: string
  processingTime: string
  applicationFee: string
  requirements: string[]
  tips: string[]
  source: string
}

export interface HousingData {
  city: string
  averageRent: string
  popularAreas: string[]
  rentalPlatforms: string[]
  tips: string[]
  source: string
}

export interface BankingData {
  country: string
  popularBanks: string[]
  digitalBanks: string[]
  requirements: string[]
  tips: string[]
  source: string
}

export interface HealthcareData {
  country: string
  systemType: string
  insuranceRequired: boolean
  publicHealthcare: boolean
  averageCost: string
  popularProviders: string[]
  tips: string[]
  source: string
}

export interface CultureData {
  country: string
  language: string
  businessEtiquette: string[]
  socialNorms: string[]
  dosDonts: { dos: string[]; donts: string[] }
  tips: string[]
  source: string
}

export interface ResearchResults {
  costOfLiving?: CostOfLivingData
  visaProcessing?: VisaProcessingData
  housing?: HousingData
  banking?: BankingData
  healthcare?: HealthcareData
  culture?: CultureData
  timestamp: string
}

// Pre-compiled cost of living estimates (fallback data)
// These are approximate monthly costs in USD
const COST_OF_LIVING_ESTIMATES: Record<string, Partial<CostOfLivingData>> = {
  germany: {
    monthlyRent1Bed: { city: 900, outside: 650 },
    monthlyRent3Bed: { city: 1600, outside: 1100 },
    utilities: 250,
    internet: 35,
    mealInexpensive: 12,
    mealMidRange: 45,
    groceries: 300,
    transportation: 85,
    overallIndex: 65,
  },
  netherlands: {
    monthlyRent1Bed: { city: 1400, outside: 1000 },
    monthlyRent3Bed: { city: 2200, outside: 1600 },
    utilities: 200,
    internet: 45,
    mealInexpensive: 18,
    mealMidRange: 55,
    groceries: 350,
    transportation: 100,
    overallIndex: 75,
  },
  sweden: {
    monthlyRent1Bed: { city: 1100, outside: 800 },
    monthlyRent3Bed: { city: 1800, outside: 1300 },
    utilities: 80,
    internet: 30,
    mealInexpensive: 15,
    mealMidRange: 60,
    groceries: 320,
    transportation: 90,
    overallIndex: 70,
  },
  spain: {
    monthlyRent1Bed: { city: 850, outside: 550 },
    monthlyRent3Bed: { city: 1400, outside: 900 },
    utilities: 130,
    internet: 35,
    mealInexpensive: 12,
    mealMidRange: 40,
    groceries: 250,
    transportation: 45,
    overallIndex: 55,
  },
  portugal: {
    monthlyRent1Bed: { city: 900, outside: 600 },
    monthlyRent3Bed: { city: 1500, outside: 950 },
    utilities: 120,
    internet: 35,
    mealInexpensive: 10,
    mealMidRange: 35,
    groceries: 230,
    transportation: 40,
    overallIndex: 50,
  },
  france: {
    monthlyRent1Bed: { city: 1100, outside: 750 },
    monthlyRent3Bed: { city: 2000, outside: 1300 },
    utilities: 180,
    internet: 30,
    mealInexpensive: 15,
    mealMidRange: 50,
    groceries: 320,
    transportation: 75,
    overallIndex: 70,
  },
  italy: {
    monthlyRent1Bed: { city: 800, outside: 550 },
    monthlyRent3Bed: { city: 1400, outside: 900 },
    utilities: 180,
    internet: 30,
    mealInexpensive: 15,
    mealMidRange: 50,
    groceries: 280,
    transportation: 35,
    overallIndex: 60,
  },
  japan: {
    monthlyRent1Bed: { city: 700, outside: 450 },
    monthlyRent3Bed: { city: 1500, outside: 900 },
    utilities: 150,
    internet: 40,
    mealInexpensive: 8,
    mealMidRange: 30,
    groceries: 350,
    transportation: 100,
    overallIndex: 75,
  },
  canada: {
    monthlyRent1Bed: { city: 1500, outside: 1100 },
    monthlyRent3Bed: { city: 2500, outside: 1800 },
    utilities: 150,
    internet: 70,
    mealInexpensive: 18,
    mealMidRange: 65,
    groceries: 400,
    transportation: 110,
    overallIndex: 72,
  },
  australia: {
    monthlyRent1Bed: { city: 1600, outside: 1100 },
    monthlyRent3Bed: { city: 2800, outside: 1900 },
    utilities: 150,
    internet: 60,
    mealInexpensive: 20,
    mealMidRange: 70,
    groceries: 400,
    transportation: 130,
    overallIndex: 78,
  },
  "united kingdom": {
    monthlyRent1Bed: { city: 1500, outside: 1000 },
    monthlyRent3Bed: { city: 2500, outside: 1700 },
    utilities: 200,
    internet: 35,
    mealInexpensive: 15,
    mealMidRange: 55,
    groceries: 350,
    transportation: 150,
    overallIndex: 72,
  },
  "united states": {
    monthlyRent1Bed: { city: 1800, outside: 1300 },
    monthlyRent3Bed: { city: 3000, outside: 2100 },
    utilities: 180,
    internet: 65,
    mealInexpensive: 18,
    mealMidRange: 65,
    groceries: 400,
    transportation: 70,
    overallIndex: 75,
  },
}

// Get cost of living data for a country (uses fallback data)
export function getCostOfLivingData(
  country: string,
  city?: string
): CostOfLivingData | null {
  const normalizedCountry = country.toLowerCase().trim()
  const estimate = COST_OF_LIVING_ESTIMATES[normalizedCountry]

  if (!estimate) {
    return null
  }

  return {
    city: city || "Major city",
    country: country,
    monthlyRent1Bed: estimate.monthlyRent1Bed || { city: 1000, outside: 700 },
    monthlyRent3Bed: estimate.monthlyRent3Bed || { city: 1800, outside: 1200 },
    utilities: estimate.utilities || 150,
    internet: estimate.internet || 40,
    mealInexpensive: estimate.mealInexpensive || 12,
    mealMidRange: estimate.mealMidRange || 45,
    groceries: estimate.groceries || 300,
    transportation: estimate.transportation || 75,
    overallIndex: estimate.overallIndex || 65,
    source: "GoMate estimates based on Numbeo data",
    lastUpdated: new Date().toISOString().split("T")[0],
  }
}

// Calculate monthly budget based on profile and cost of living
export function calculateMonthlyBudget(
  profile: Profile,
  costData: CostOfLivingData
): {
  minimum: number
  comfortable: number
  breakdown: Record<string, number>
} {
  const isFamily = profile.moving_alone === "no"
  const hasKids = profile.number_of_children && parseInt(profile.number_of_children) > 0
  const rentMultiplier = isFamily ? 1.5 : 1
  const foodMultiplier = isFamily ? (hasKids ? 2.5 : 2) : 1

  const rent = costData.monthlyRent1Bed.city * rentMultiplier
  const utilities = costData.utilities * (isFamily ? 1.3 : 1)
  const groceries = costData.groceries * foodMultiplier
  const transportation = costData.transportation * (isFamily ? 1.5 : 1)
  const internet = costData.internet
  const misc = 200 * (isFamily ? 1.5 : 1)

  const minimum = rent + utilities + groceries + transportation + internet + misc
  const comfortable = minimum * 1.3

  return {
    minimum: Math.round(minimum),
    comfortable: Math.round(comfortable),
    breakdown: {
      rent: Math.round(rent),
      utilities: Math.round(utilities),
      groceries: Math.round(groceries),
      transportation: Math.round(transportation),
      internet: Math.round(internet),
      miscellaneous: Math.round(misc),
    },
  }
}

// Calculate savings target based on profile
export function calculateSavingsTarget(
  profile: Profile,
  monthlyBudget: number
): {
  emergencyFund: number
  movingCosts: number
  initialSetup: number
  visaFees: number
  total: number
  timeline: string
} {
  const destination = profile.destination?.toLowerCase() || ""
  
  // Base calculations
  const emergencyFund = monthlyBudget * 3 // 3 months emergency fund
  const movingCosts = 2000 // Flights, shipping, etc.
  const initialSetup = monthlyBudget * 2 // First month rent + deposit + furniture
  
  // Visa fees vary by country and type
  let visaFees = 500
  if (destination.includes("united states")) visaFees = 1500
  else if (destination.includes("canada")) visaFees = 800
  else if (destination.includes("australia")) visaFees = 1200
  else if (destination.includes("united kingdom")) visaFees = 1000
  else if (destination.includes("japan")) visaFees = 400
  else if (destination.includes("germany") || destination.includes("netherlands")) visaFees = 300

  const total = emergencyFund + movingCosts + initialSetup + visaFees

  // Timeline suggestion based on when they want to move
  let timeline = "Start saving now"
  const timelineStr = profile.timeline?.toLowerCase() || ""
  if (timelineStr.includes("asap") || timelineStr.includes("soon")) {
    timeline = "Aim to save within 2-3 months"
  } else if (timelineStr.includes("6 month") || timelineStr.includes("half")) {
    timeline = "Save steadily over 4-5 months"
  } else if (timelineStr.includes("year") || timelineStr.includes("12 month")) {
    timeline = "You have time - save a consistent amount monthly"
  }

  return {
    emergencyFund: Math.round(emergencyFund),
    movingCosts: Math.round(movingCosts),
    initialSetup: Math.round(initialSetup),
    visaFees: Math.round(visaFees),
    total: Math.round(total),
    timeline,
  }
}

// Format research results for display
export function formatResearchSummary(
  profile: Profile,
  costData: CostOfLivingData | null
): string {
  if (!costData) {
    return `Unfortunately, we don't have detailed cost of living data for ${profile.destination || "your destination"} yet.`
  }

  const budget = calculateMonthlyBudget(profile, costData)
  const savings = calculateSavingsTarget(profile, budget.comfortable)
  const isFamily = profile.moving_alone === "no"
  const familyNote = isFamily ? " for your family" : ""

  return `
## Cost of Living in ${costData.city}, ${costData.country}

### Monthly Budget${familyNote}
- **Minimum needed:** $${budget.minimum.toLocaleString()}/month
- **Comfortable living:** $${budget.comfortable.toLocaleString()}/month

### Breakdown
| Expense | Estimated Cost |
|---------|----------------|
| Rent | $${budget.breakdown.rent.toLocaleString()} |
| Utilities | $${budget.breakdown.utilities.toLocaleString()} |
| Groceries | $${budget.breakdown.groceries.toLocaleString()} |
| Transportation | $${budget.breakdown.transportation.toLocaleString()} |
| Internet | $${budget.breakdown.internet.toLocaleString()} |
| Miscellaneous | $${budget.breakdown.miscellaneous.toLocaleString()} |

### Savings Target Before Moving
- Emergency fund (3 months): $${savings.emergencyFund.toLocaleString()}
- Moving costs: $${savings.movingCosts.toLocaleString()}
- Initial setup: $${savings.initialSetup.toLocaleString()}
- Visa fees: $${savings.visaFees.toLocaleString()}
- **Total recommended:** $${savings.total.toLocaleString()}

${savings.timeline}

*Data source: ${costData.source}*
  `.trim()
}

// Generate full research report for a profile
export function generateResearchReport(profile: Profile): string {
  const destination = profile.destination || "Unknown"
  const costData = getCostOfLivingData(destination, profile.target_city)
  
  const sections: string[] = []
  
  // Add cost of living section
  if (costData) {
    sections.push(formatResearchSummary(profile, costData))
  }
  
  // Add purpose-specific tips
  const purpose = profile.purpose || "other"
  if (purpose === "study") {
    sections.push(`
## Study Tips for ${destination}
- Research student visa requirements early
- Look into student housing options (often cheaper than private rentals)
- Check if your institution offers support services for international students
- Consider opening a local bank account with student benefits
- Explore student discounts for transportation and cultural activities
    `.trim())
  } else if (purpose === "work") {
    sections.push(`
## Working Tips for ${destination}
- Understand your tax obligations as a foreign worker
- Research local employment contracts and worker rights
- Consider professional networking groups for expats
- Look into health insurance requirements for workers
- Familiarize yourself with local workplace culture
    `.trim())
  } else if (purpose === "digital_nomad") {
    sections.push(`
## Digital Nomad Tips for ${destination}
- Research visa requirements for remote workers
- Look for coworking spaces with good internet
- Check time zone compatibility with your clients/team
- Consider temporary furnished apartments
- Look into international health insurance options
    `.trim())
  }

  // Add general relocation tips
  sections.push(`
## General Relocation Checklist
1. **Before you go:**
   - Gather all required documents
   - Apostille important certificates if needed
   - Set up international banking
   - Research health insurance options

2. **First week:**
   - Register with local authorities if required
   - Set up local phone number
   - Open local bank account
   - Get familiar with public transportation

3. **First month:**
   - Complete any required registrations
   - Set up utilities in your name
   - Register with healthcare system
   - Start building local network
  `.trim())

  return sections.join("\n\n---\n\n")
}
