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
import { fetchWithRetry } from "./fetch-with-retry"
import { getGenericFallbackData, type NumbeoData } from "./numbeo-scraper"

// Firecrawl API configuration
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"

// In-memory cache removed — non-functional in serverless (Vercel).
// Each invocation fetches fresh data. For caching, use database persistence.

/**
 * Scrape a URL using Firecrawl API
 */
export async function scrapeUrl(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    console.log("[GoMate] Firecrawl API key not configured, using fallback data")
    return null
  }

  try {
    const response = await fetchWithRetry(`${FIRECRAWL_BASE_URL}/scrape`, {
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
    }, 15_000)

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
    const response = await fetchWithRetry(`${FIRECRAWL_BASE_URL}/search`, {
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
    }, 15_000)

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
  currency: string
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

// Convert NumbeoData (canonical authority from numbeo-scraper.ts) to CostOfLivingData
// This ensures the chat/guide path uses the same data source as the API.
function numbeoToCostOfLiving(data: NumbeoData): CostOfLivingData {
  return {
    city: data.city,
    country: data.country,
    currency: data.currency || "USD",
    monthlyRent1Bed: {
      city: data.rent?.apartment1BedCity || 1000,
      outside: data.rent?.apartment1BedOutside || 700,
    },
    monthlyRent3Bed: {
      city: data.rent?.apartment3BedCity || 1800,
      outside: data.rent?.apartment3BedOutside || 1200,
    },
    utilities: data.utilities?.basic || 150,
    internet: data.utilities?.internet || 40,
    mealInexpensive: data.food?.mealInexpensive || 12,
    mealMidRange: data.food?.mealMidRange || 45,
    groceries: (data.food?.mealInexpensive || 12) * 20, // estimated monthly groceries
    transportation: data.transportation?.monthlyPass || 75,
    overallIndex: data.costOfLivingIndex || 65,
    source: data.source,
    lastUpdated: data.lastUpdated,
  }
}

// Get cost of living data for a country/city.
// Authority: delegates to numbeo-scraper.ts getGenericFallbackData() which is the
// single canonical source for cost data across both the API and helper paths.
export function getCostOfLivingData(
  country: string,
  city?: string
): CostOfLivingData | null {
  const numbeoData = getGenericFallbackData(city, country)
  return numbeoToCostOfLiving(numbeoData)
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
