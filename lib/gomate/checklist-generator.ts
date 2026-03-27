import FirecrawlApp from "@mendable/firecrawl-js"
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import { getSourceUrl, getAllSources } from "./official-sources"

const openrouter = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
})

// Types
export interface ChecklistItem {
  id: string
  document: string
  description: string
  priority: "critical" | "high" | "medium" | "low"
  required: boolean
  category: string
  whereToGet?: string
  officialLink?: string
  estimatedTime?: string
  cost?: string
  tips?: string[]
  visaSpecific?: boolean
  /** B2-011: Per-item source URL for traceability */
  sourceUrl?: string
}

export interface ChecklistGeneratorInput {
  citizenship: string
  destination: string
  destinationCity?: string
  purpose: string
  visaType?: string
  visaName?: string
  qualifications?: string
  hasJobOffer?: boolean
  hasUniversityAdmission?: boolean
  hasFamilyInDestination?: boolean
  currentDocuments?: string[]
}

export interface GeneratedChecklist {
  items: ChecklistItem[]
  visaType: string | null
  destination: string
  generatedAt: string
  researchSources: string[]
  /** B2-007: Whether this checklist used the default fallback instead of AI-researched items */
  isFallback: boolean
  /** B2-007: What inputs were actually available when generating */
  generatorInputs: {
    hadVisaResearch: boolean
    hadFirecrawlResearch: boolean
    visaName: string | null
  }
}

// B2-008: Canonical document ID generation — shared identity contract
export function canonicalDocumentId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64)
}

// B2-010: Zod schema for structured output — replaces regex JSON extraction
const checklistItemSchema = z.object({
  id: z.string().describe("Unique snake_case identifier for this document"),
  document: z.string().describe("Name of the document"),
  description: z.string().describe("Brief description of what this document is"),
  priority: z.enum(["critical", "high", "medium", "low"]),
  required: z.boolean(),
  category: z.enum(["identity", "visa", "financial", "medical", "education", "housing", "travel", "legal", "other"]),
  whereToGet: z.string().optional().describe("Where/how to obtain this document"),
  officialLink: z.string().optional().describe("Direct URL to official source for this document"),
  estimatedTime: z.string().optional().describe("How long it takes to obtain, e.g. '1-2 weeks'"),
  cost: z.string().optional().describe("Approximate cost if applicable, e.g. '~50 EUR'"),
  tips: z.array(z.string()).optional().describe("1-2 helpful tips"),
  visaSpecific: z.boolean().optional().describe("True if specific to the visa type"),
  sourceUrl: z.string().optional().describe("URL of the source that mentions this requirement"),
})

const checklistOutputSchema = z.object({
  items: z.array(checklistItemSchema),
})

// Initialize Firecrawl
function getFirecrawl(): FirecrawlApp | null {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    console.warn("[ChecklistGenerator] FIRECRAWL_API_KEY not set")
    return null
  }
  return new FirecrawlApp({ apiKey })
}

// Search for visa-specific document requirements
async function searchDocumentRequirements(
  firecrawl: FirecrawlApp,
  destination: string,
  visaType: string,
  citizenship: string
): Promise<string[]> {
  const results: string[] = []

  try {
    // Search for specific visa document requirements
    const searchQueries = [
      `${destination} ${visaType} visa required documents checklist`,
      `${destination} ${visaType} visa application documents ${citizenship} citizens`,
      `${destination} immigration ${visaType} supporting documents`,
    ]

    for (const query of searchQueries.slice(0, 2)) {
      try {
        const searchResult = await firecrawl.search(query, {
          limit: 3,
          scrapeOptions: {
            formats: ["markdown"],
            onlyMainContent: true,
          },
        })

        if (searchResult.success && searchResult.data) {
          for (const result of searchResult.data) {
            if (result.markdown) {
              results.push(result.markdown.slice(0, 4000))
            }
          }
        }
      } catch (searchError) {
        console.warn(`[ChecklistGenerator] Search failed for: ${query}`, searchError)
      }
    }
  } catch (error) {
    console.error("[ChecklistGenerator] Error searching document requirements:", error)
  }

  return results
}

// Scrape official immigration website for document requirements
async function scrapeOfficialSources(
  firecrawl: FirecrawlApp,
  destination: string,
  visaType: string
): Promise<{ content: string; url: string }[]> {
  const results: { content: string; url: string }[] = []

  try {
    // Get official immigration URL
    const immigrationUrl = getSourceUrl(destination, "immigration")
    const visaUrl = getSourceUrl(destination, "visa")

    const urlsToScrape = [immigrationUrl, visaUrl].filter(Boolean) as string[]

    for (const url of urlsToScrape.slice(0, 2)) {
      try {
        const scrapeResult = await firecrawl.scrapeUrl(url, {
          formats: ["markdown"],
          onlyMainContent: true,
        })

        if (scrapeResult.success && scrapeResult.markdown) {
          results.push({
            content: scrapeResult.markdown.slice(0, 5000),
            url,
          })
        }
      } catch (scrapeError) {
        console.warn(`[ChecklistGenerator] Failed to scrape ${url}`, scrapeError)
      }
    }
  } catch (error) {
    console.error("[ChecklistGenerator] Error scraping official sources:", error)
  }

  return results
}

// Generate checklist using AI
async function generateChecklistWithAI(
  input: ChecklistGeneratorInput,
  researchContent: string[],
  scrapedSources: { content: string; url: string }[]
): Promise<ChecklistItem[]> {
  const allContent = [
    ...researchContent,
    ...scrapedSources.map((s) => s.content),
  ].join("\n\n---\n\n")

  const officialSources = getAllSources(input.destination)
  const sourceLinks = officialSources
    ? Object.entries(officialSources)
        .filter(([, url]) => url)
        .map(([key, url]) => `- ${key}: ${url}`)
        .join("\n")
    : "No official sources available"

  const prompt = `You are an immigration document specialist. Based on the research content provided, generate a comprehensive document checklist for the following relocation:

**User Profile:**
- Citizenship: ${input.citizenship}
- Destination: ${input.destination}${input.destinationCity ? ` (${input.destinationCity})` : ""}
- Purpose: ${input.purpose}
- Visa Type: ${input.visaType || "Not yet determined"}
${input.visaName ? `- Visa Name: ${input.visaName}` : ""}
${input.qualifications ? `- Qualifications: ${input.qualifications}` : ""}
${input.hasJobOffer ? "- Has job offer: Yes" : ""}
${input.hasUniversityAdmission ? "- Has university admission: Yes" : ""}
${input.hasFamilyInDestination ? "- Has family in destination: Yes" : ""}

**Official Government Sources:**
${sourceLinks}

**Research Content:**
${allContent.slice(0, 15000)}

Generate a list of document checklist items. Each item should have:
- id: unique snake_case identifier
- document: name of the document
- description: brief description of what this document is
- priority: "critical" | "high" | "medium" | "low"
- required: true/false
- category: one of "identity", "visa", "financial", "medical", "education", "housing", "travel", "legal", "other"
- whereToGet: where/how to obtain this document
- officialLink: direct URL to official source for this document (if known)
- estimatedTime: how long it takes to obtain (e.g., "1-2 weeks")
- cost: approximate cost if applicable (e.g., "~50 EUR")
- tips: array of 1-2 helpful tips
- visaSpecific: true if this is specific to the visa type, false if general
- sourceUrl: URL from the research content that mentions this requirement (if identifiable)

**Important:**
1. Include ALL documents required for the specific visa type mentioned
2. Include general relocation documents (passport, photos, etc.)
3. Include country-specific requirements (e.g., blocked account for Germany students)
4. Include post-arrival registration documents
5. Prioritize critical documents that could delay the application
6. Include financial proof requirements with specific amounts if known
7. Be specific about document requirements (apostille, translations, etc.)`

  try {
    // B2-010: Use generateObject with Zod schema instead of regex JSON extraction
    const result = await generateObject({
      model: openrouter("anthropic/claude-sonnet-4"),
      prompt,
      schema: checklistOutputSchema,
      maxOutputTokens: 4000,
    })

    const items = result.object.items

    // B2-008: Normalize document IDs to canonical form for shared identity
    return items.map((item, index) => ({
      id: canonicalDocumentId(item.id || item.document || `doc_${index}`),
      document: item.document || "Unknown Document",
      description: item.description || "",
      priority: item.priority,
      required: item.required,
      category: item.category || "other",
      whereToGet: item.whereToGet,
      officialLink: item.officialLink,
      estimatedTime: item.estimatedTime,
      cost: item.cost,
      tips: item.tips || [],
      visaSpecific: item.visaSpecific ?? false,
      sourceUrl: item.sourceUrl,
    }))
  } catch (error) {
    console.error("[ChecklistGenerator] AI generation failed:", error)
    return getDefaultChecklist(input)
  }
}

// Default checklist when AI generation fails
function getDefaultChecklist(input: ChecklistGeneratorInput): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: "passport",
      document: "Valid Passport",
      description: "Must be valid for at least 6 months beyond intended stay",
      priority: "critical",
      required: true,
      category: "identity",
      whereToGet: "Your country's passport office",
      estimatedTime: "2-6 weeks for renewal",
      tips: ["Ensure at least 2 blank pages", "Check expiry date early"],
    },
    {
      id: "passport_photos",
      document: "Passport Photos",
      description: "Recent biometric photos meeting destination requirements",
      priority: "high",
      required: true,
      category: "identity",
      whereToGet: "Photo studios or passport photo booths",
      estimatedTime: "Same day",
      cost: "~10-20 EUR",
      tips: ["Usually 35x45mm with white background"],
    },
    {
      id: "visa_application",
      document: "Visa Application Form",
      description: "Completed application for your visa type",
      priority: "critical",
      required: true,
      category: "visa",
      whereToGet: "Embassy website or visa application center",
      tips: ["Double-check all information before submitting"],
    },
    {
      id: "bank_statements",
      document: "Bank Statements",
      description: "Last 3-6 months showing sufficient funds",
      priority: "critical",
      required: true,
      category: "financial",
      whereToGet: "Your bank",
      estimatedTime: "1-3 days",
      tips: ["Show consistent income and savings"],
    },
    {
      id: "health_insurance",
      document: "Health Insurance Certificate",
      description: "Valid health insurance for your destination",
      priority: "critical",
      required: true,
      category: "medical",
      whereToGet: "Insurance providers",
      tips: ["Ensure coverage meets visa requirements"],
    },
  ]

  // Add purpose-specific documents
  if (input.purpose === "work" || input.hasJobOffer) {
    items.push({
      id: "job_contract",
      document: "Employment Contract",
      description: "Signed contract from your employer",
      priority: "critical",
      required: true,
      category: "visa",
      whereToGet: "Your employer",
      visaSpecific: true,
    })
  }

  if (input.purpose === "study" || input.hasUniversityAdmission) {
    items.push({
      id: "admission_letter",
      document: "University Admission Letter",
      description: "Official acceptance from your institution",
      priority: "critical",
      required: true,
      category: "visa",
      whereToGet: "Your university",
      visaSpecific: true,
    })
  }

  items.push({
    id: "accommodation_proof",
    document: "Proof of Accommodation",
    description: "Rental agreement, hotel booking, or host letter",
    priority: "high",
    required: true,
    category: "housing",
    whereToGet: "Landlord, hotel, or host",
    tips: ["May need proof for first 3 months"],
  })

  return items
}

// Main function to generate personalized checklist
export async function generatePersonalizedChecklist(
  input: ChecklistGeneratorInput
): Promise<GeneratedChecklist> {
  const firecrawl = getFirecrawl()
  const researchSources: string[] = []
  let researchContent: string[] = []
  let scrapedSources: { content: string; url: string }[] = []

  if (firecrawl && input.visaType) {
    // Perform research using Firecrawl
    console.log("[ChecklistGenerator] Starting document research...")

    // Search for document requirements
    researchContent = await searchDocumentRequirements(
      firecrawl,
      input.destination,
      input.visaType,
      input.citizenship
    )

    // Scrape official sources
    scrapedSources = await scrapeOfficialSources(
      firecrawl,
      input.destination,
      input.visaType
    )

    // Collect source URLs
    scrapedSources.forEach((s) => researchSources.push(s.url))
  }

  // B2-007: Track whether we used fallback or AI-researched content
  let items: ChecklistItem[]
  let isFallback = false

  if (researchContent.length > 0 || scrapedSources.length > 0) {
    items = await generateChecklistWithAI(input, researchContent, scrapedSources)
  } else {
    console.log("[ChecklistGenerator] No research content, using default checklist")
    items = getDefaultChecklist(input)
    isFallback = true
  }

  // B2-008: Ensure all items have canonical document IDs
  items = items.map(item => ({
    ...item,
    id: canonicalDocumentId(item.id || item.document),
  }))

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return {
    items,
    visaType: input.visaType || null,
    destination: input.destination,
    generatedAt: new Date().toISOString(),
    researchSources,
    isFallback,
    generatorInputs: {
      hadVisaResearch: !!input.visaType || !!input.visaName,
      hadFirecrawlResearch: researchContent.length > 0 || scrapedSources.length > 0,
      visaName: input.visaName || null,
    },
  }
}

// API endpoint helper - creates checklist from plan data
export async function generateChecklistFromPlan(planData: {
  profile_data: Record<string, unknown>
  visa_research?: {
    visaOptions?: Array<{
      name: string
      type: string
      selected?: boolean
    }>
  }
}): Promise<GeneratedChecklist> {
  const profile = planData.profile_data || {}
  const visaResearch = planData.visa_research

  // Find selected visa or first recommended
  let selectedVisa = visaResearch?.visaOptions?.find((v) => v.selected)
  if (!selectedVisa && visaResearch?.visaOptions?.length) {
    selectedVisa = visaResearch.visaOptions[0]
  }

  const input: ChecklistGeneratorInput = {
    citizenship: (profile.citizenship as string) || (profile.nationality as string) || "",
    destination: (profile.destination as string) || "",
    destinationCity: (profile.target_city as string) || (profile.destinationCity as string),
    purpose: (profile.purpose as string) || "other",
    visaType: selectedVisa?.type || (profile.visa_type as string),
    visaName: selectedVisa?.name,
    qualifications: (profile.education_level as string) || (profile.qualifications as string),
    hasJobOffer: !!(profile.has_job_offer || profile.job_offer),
    hasUniversityAdmission: !!(profile.has_admission || profile.university_admission),
    hasFamilyInDestination: !!(profile.has_family_there || profile.family_in_destination),
  }

  return generatePersonalizedChecklist(input)
}
