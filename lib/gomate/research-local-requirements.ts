import type { SupabaseClient } from "@supabase/supabase-js"
import { getAllSources } from "./official-sources"
import { fetchWithRetry } from "./fetch-with-retry"

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"
const OPENAI_API_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "")
const OPENAI_API_URL = `${OPENAI_API_BASE}/chat/completions`
const IS_OPENROUTER = OPENAI_API_BASE.includes("openrouter.ai")

type ServiceResult<T> =
  | { ok: true; status: 200; body: T }
  | { ok: false; status: number; body: { error: string } }

interface LocalRequirement {
  category: string
  name: string
  description: string
  steps: string[]
  requiredDocuments: string[]
  estimatedTime: string
  cost: string
  officialLinks: string[]
  tips: string[]
  deadline?: string
}

interface LocalRequirementsResearch {
  destination: string
  city?: string
  categories: Array<{
    category: string
    items: Array<{
      title: string
      description: string
      steps: string[]
      documents: string[]
      estimatedTime: string
      cost: string
      officialLink: string
      tips: string[]
    }>
  }>
  summary: string
  disclaimer: string
  generalTips: string[]
  importantDeadlines: { task: string; deadline: string }[]
  researchedAt: string
  sources: string[]
}

interface RawLocalRequirementsResearch {
  categories?: {
    registration?: LocalRequirement[]
    taxId?: LocalRequirement[]
    healthcare?: LocalRequirement[]
    banking?: LocalRequirement[]
    driversLicense?: LocalRequirement[]
    utilities?: LocalRequirement[]
    housing?: LocalRequirement[]
    other?: LocalRequirement[]
  }
  generalTips?: string[]
  importantDeadlines?: { task: string; deadline: string }[]
}

function buildAIHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  }

  if (IS_OPENROUTER) {
    headers["HTTP-Referer"] = "https://gomate.app"
    headers["X-Title"] = "GoMate"
  }

  return headers
}

function buildFallbackLocalRequirementsResearch(): RawLocalRequirementsResearch {
  return {
    categories: {
      registration: [],
      taxId: [],
      healthcare: [],
      banking: [],
      driversLicense: [],
      utilities: [],
      housing: [],
      other: [],
    },
    generalTips: [
      "Verify all requirements with official government sources before acting.",
      "Keep digital and physical copies of your key identity and immigration documents.",
      "Start registration and appointment booking early because local processing times vary.",
    ],
    importantDeadlines: [],
  }
}

async function scrapeUrl(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) return null

  try {
    const response = await fetchWithRetry(
      `${FIRECRAWL_BASE_URL}/scrape`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 3000,
        }),
      },
      15_000
    )

    if (!response.ok) {
      console.error(`[GoMate] Firecrawl scrape failed for ${url}:`, response.status)
      return null
    }

    const data = await response.json()
    return data.data?.markdown || null
  } catch (error) {
    console.error(`[GoMate] Firecrawl scrape error for ${url}:`, error)
    return null
  }
}

async function searchFirecrawl(query: string, limit = 2): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) return []

  try {
    const response = await fetchWithRetry(
      `${FIRECRAWL_BASE_URL}/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          query,
          limit,
          scrapeOptions: {
            formats: ["markdown"],
            onlyMainContent: true,
          },
        }),
      },
      15_000
    )

    if (!response.ok) {
      console.error(`[GoMate] Firecrawl search failed for "${query}":`, response.status)
      return []
    }

    const data = await response.json()
    return (data.data || [])
      .map((item: { markdown?: string }) => item.markdown || "")
      .filter(Boolean)
  } catch (error) {
    console.error(`[GoMate] Firecrawl search error for "${query}":`, error)
    return []
  }
}

async function analyzeLocalRequirements(
  destination: string,
  destinationCity: string | undefined,
  profileData: Record<string, any>,
  scrapedContent: string[]
): Promise<RawLocalRequirementsResearch> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  if (!FIRECRAWL_API_KEY && scrapedContent.length === 0) {
    console.warn("[GoMate][LocalReq] FIRECRAWL_API_KEY not set — running LLM-only research")
  }

  const hasWebContent = scrapedContent.length > 0
  const dataSourceSection = hasWebContent
    ? `SCRAPED CONTENT FROM OFFICIAL SOURCES:\n${scrapedContent.join("\n\n").slice(0, 16_000)}`
    : `No web research content was available. Use your training knowledge about administrative requirements for foreigners moving to ${destination}. Only state requirements you are confident about. Include registration, banking, healthcare enrollment, tax ID, and any mandatory steps.`

  const prompt = `You are an expert relocation consultant. ${hasWebContent ? "Analyze the following information about" : "Provide comprehensive local requirements research for someone"} moving to ${destination}${destinationCity ? ` (specifically ${destinationCity})` : ""}.

USER PROFILE:
- Destination: ${destination}${destinationCity ? `, ${destinationCity}` : ""}
- Purpose: ${profileData.purpose || "General relocation"}
- Citizenship: ${profileData.citizenship || "Unknown"}
- Timeline: ${profileData.timeline || "Not specified"}
- Has job offer: ${profileData.job_offer === "yes" ? "Yes" : "No"}
- Family size: ${
    profileData.moving_alone === "yes"
      ? 1
      : 1 + (profileData.spouse_joining === "yes" ? 1 : 0) + (parseInt(profileData.children_count || "0", 10) || 0)
  }

${dataSourceSection}

Respond with a JSON object in this structure:
{
  "categories": {
    "registration": [{ "category": "registration", "name": "", "description": "", "steps": [], "requiredDocuments": [], "estimatedTime": "", "cost": "", "officialLinks": [], "tips": [], "deadline": "" }],
    "taxId": [],
    "healthcare": [],
    "banking": [],
    "driversLicense": [],
    "utilities": [],
    "housing": [],
    "other": []
  },
  "generalTips": [],
  "importantDeadlines": [{ "task": "", "deadline": "" }]
}`

  try {
    const response = await fetchWithRetry(
      OPENAI_API_URL,
      {
        method: "POST",
        headers: buildAIHeaders(),
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are an expert relocation consultant. Provide accurate, structured local requirements research. Respond only with valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 2500,
        }),
      },
      45_000,
      1
    )

    if (!response.ok) {
      const errBody = await response.text()
      console.error("[GoMate] OpenAI API failed:", response.status, errBody)
      return buildFallbackLocalRequirementsResearch()
    }

    const aiData = await response.json()
    const text = aiData.choices?.[0]?.message?.content || ""

    try {
      return JSON.parse(text) as RawLocalRequirementsResearch
    } catch (parseError) {
      console.error("[GoMate] Failed to parse AI response:", parseError)
      return buildFallbackLocalRequirementsResearch()
    }
  } catch (error) {
    console.error("[GoMate] OpenAI local requirements analysis failed:", error)
    return buildFallbackLocalRequirementsResearch()
  }
}

function normalizeCategories(rawCategories: RawLocalRequirementsResearch["categories"]) {
  const categoryLabelMap: Record<string, string> = {
    registration: "Registration",
    taxId: "Tax ID",
    healthcare: "Healthcare",
    banking: "Banking",
    driversLicense: "Driver's License",
    utilities: "Utilities",
    housing: "Housing",
    other: "Other",
  }

  return Object.entries(
    rawCategories || {
      registration: [],
      taxId: [],
      healthcare: [],
      banking: [],
      driversLicense: [],
      utilities: [],
      housing: [],
      other: [],
    }
  )
    .filter(([, items]) => Array.isArray(items) && items.length > 0)
    .map(([key, items]) => ({
      category: categoryLabelMap[key] || key.charAt(0).toUpperCase() + key.slice(1),
      items: (items as LocalRequirement[]).map((item) => ({
        title: item.name || "Untitled",
        description: item.description || "",
        steps: item.steps || [],
        documents: item.requiredDocuments || [],
        estimatedTime: item.estimatedTime || "",
        cost: item.cost || "",
        officialLink: item.officialLinks?.[0] || "",
        tips: item.tips || [],
      })),
    }))
}

export async function performLocalRequirementsResearch(
  supabase: SupabaseClient,
  planId: string,
  userId: string,
  forceRefresh = false,
  manageResearchStatus = true
): Promise<ServiceResult<{ research: LocalRequirementsResearch; cached: boolean; cachedAt?: string }>> {
  try {
    if (!planId) {
      return { ok: false, status: 400, body: { error: "Plan ID is required" } }
    }

    const { data: plan, error: planError } = await supabase
      .from("relocation_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", userId)
      .single()

    if (planError || !plan) {
      return { ok: false, status: 404, body: { error: "Relocation plan not found" } }
    }

    const cachedCategoryCount = Array.isArray(plan.local_requirements_research?.categories)
      ? plan.local_requirements_research.categories.length
      : 0
    const hasMeaningfulCachedResearch = cachedCategoryCount > 0

    if (!forceRefresh && hasMeaningfulCachedResearch && plan.local_requirements_research && plan.research_completed_at) {
      const researchAge = Date.now() - new Date(plan.research_completed_at).getTime()
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
      if (researchAge < sevenDaysMs) {
        return {
          ok: true,
          status: 200,
          body: {
            research: plan.local_requirements_research as LocalRequirementsResearch,
            cached: true,
            cachedAt: plan.research_completed_at,
          },
        }
      }
    }

    if (manageResearchStatus) {
      const { error: statusError } = await supabase
        .from("relocation_plans")
        .update({ research_status: "in_progress" })
        .eq("id", planId)
        .eq("user_id", userId)

      if (statusError) {
        return { ok: false, status: 500, body: { error: "Failed to start local requirements research" } }
      }
    }

    const profileData = (plan.profile_data || {}) as Record<string, any>
    const destination = profileData.destination || profileData.destinationCountry
    const destinationCity = profileData.target_city || profileData.destinationCity || profileData.city

    if (!destination) {
      return { ok: false, status: 400, body: { error: "Destination country is required" } }
    }

    const officialSources = getAllSources(destination)
    const sourcesToScrape: string[] = []
    const scrapedContent: string[] = []

    if (officialSources?.immigration) sourcesToScrape.push(officialSources.immigration)
    if (officialSources?.housing) sourcesToScrape.push(officialSources.housing)
    if (officialSources?.banking) sourcesToScrape.push(officialSources.banking)
    if (officialSources?.employment) sourcesToScrape.push(officialSources.employment)
    if (officialSources?.safety) sourcesToScrape.push(officialSources.safety)

    for (const url of sourcesToScrape.slice(0, 4)) {
      const content = await scrapeUrl(url)
      if (content) {
        scrapedContent.push(`--- Content from ${url} ---\n${content.slice(0, 8000)}`)
      }
    }

    const searchQueries = [
      `${destination} residence registration requirements for foreigners ${new Date().getFullYear()}`,
      `${destination} tax registration foreign residents`,
      `${destination} healthcare insurance registration expats`,
      `${destination} open bank account foreigner requirements`,
      `${destination} drivers license exchange conversion foreign`,
      `${destinationCity ? `${destinationCity} ${destination}` : destination} moving checklist expats`,
    ]

    for (const query of searchQueries.slice(0, 4)) {
      const results = await searchFirecrawl(query, 2)
      for (const markdown of results) {
        scrapedContent.push(`--- Search result for "${query}" ---\n${markdown.slice(0, 4000)}`)
      }
    }

    const parsedResearch = await analyzeLocalRequirements(
      destination,
      destinationCity,
      profileData,
      scrapedContent
    )

    const research: LocalRequirementsResearch = {
      destination,
      city: destinationCity,
      categories: normalizeCategories(parsedResearch.categories),
      summary: `Local requirements research for ${destination}${destinationCity ? ` (${destinationCity})` : ""}.`,
      disclaimer:
        "Requirements may vary based on your visa type and personal circumstances. Always verify with official sources.",
      generalTips: parsedResearch.generalTips || [],
      importantDeadlines: parsedResearch.importantDeadlines || [],
      researchedAt: new Date().toISOString(),
      sources: sourcesToScrape,
    }

    const updatePayload: {
      local_requirements_research: LocalRequirementsResearch
      research_completed_at?: string
      research_status?: "completed"
    } = {
      local_requirements_research: research,
    }

    if (manageResearchStatus) {
      updatePayload.research_completed_at = new Date().toISOString()
      updatePayload.research_status = "completed"
    }

    const { error: updateError } = await supabase
      .from("relocation_plans")
      .update(updatePayload)
      .eq("id", planId)
      .eq("user_id", userId)

    if (updateError) {
      return { ok: false, status: 500, body: { error: "Failed to save local requirements research" } }
    }

    return {
      ok: true,
      status: 200,
      body: {
        research,
        cached: false,
      },
    }
  } catch (error) {
    console.error("[GoMate] Local requirements research error:", error)

    if (manageResearchStatus) {
      await supabase
        .from("relocation_plans")
        .update({ research_status: "failed" })
        .eq("id", planId)
        .eq("user_id", userId)
    }

    return {
      ok: false,
      status: 500,
      body: { error: "Failed to perform local requirements research" },
    }
  }
}
