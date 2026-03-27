import type { SupabaseClient } from "@supabase/supabase-js"
import { getAllSources, getSourceUrl } from "./official-sources"
import { fetchWithRetry } from "./fetch-with-retry"

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"
const OPENAI_API_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "")
const OPENAI_API_URL = `${OPENAI_API_BASE}/chat/completions`
const IS_OPENROUTER = OPENAI_API_BASE.includes("openrouter.ai")

export interface VisaOption {
  name: string
  type: "work" | "student" | "digital_nomad" | "settlement" | "family" | "investor" | "other"
  eligibility: "likely_eligible" | "possibly_eligible" | "unlikely_eligible" | "unknown"
  eligibilityReason: string
  requirements: string[]
  processingTime: string
  cost: string
  validity: string
  benefits: string[]
  limitations: string[]
  officialLink?: string
  factors?: string[]
  assumptions?: string[]
  sourceUrls?: string[]
}

type NormalizedVisaEligibility = "high" | "medium" | "low" | "unknown"

export type NormalizedVisaOption = Omit<VisaOption, "eligibility"> & {
  eligibility: NormalizedVisaEligibility
}

export interface VisaResearchResult {
  destination: string
  citizenship: string
  purpose: string
  visaOptions: NormalizedVisaOption[]
  summary: string
  disclaimer: string
  generalRequirements: string[]
  importantNotes: string[]
  officialSources: { name: string; url: string }[]
  researchedAt: string
  confidence: "high" | "medium" | "low"
  /** Per-artifact quality metadata for downstream consumers (B2-002) */
  quality: "full" | "partial" | "fallback"
  /** Number of web sources actually scraped */
  sourceCount: number
}

interface UserProfile {
  citizenship: string
  destination: string
  purpose: string
  job_offer?: string
  highly_skilled?: string
  study_type?: string
  settlement_reason?: string
  education_level?: string
  years_experience?: string
  monthly_income?: string
  duration?: string
}

type ServiceResult<T> =
  | { ok: true; status: 200; body: T }
  | { ok: false; status: number; body: { error: string } }

interface VisaAnalysisResponse {
  visas?: VisaOption[]
  generalRequirements?: string[]
  importantNotes?: string[]
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

async function searchVisaInfo(query: string, limit = 3): Promise<string[]> {
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
      console.error("[GoMate] Firecrawl search failed:", response.status)
      return []
    }

    const data = await response.json()
    return (data.data || [])
      .map((item: { markdown?: string }) => item.markdown || "")
      .filter(Boolean)
  } catch (error) {
    console.error("[GoMate] Firecrawl search error:", error)
    return []
  }
}

function buildSearchQueries(profile: UserProfile): string[] {
  const queries: string[] = []
  const { citizenship, destination, purpose } = profile

  queries.push(`${destination} visa requirements for ${citizenship} citizens`)

  switch (purpose) {
    case "work":
      queries.push(`${destination} work visa work permit requirements`)
      if (profile.highly_skilled === "yes") {
        queries.push(`${destination} skilled worker visa blue card requirements`)
      }
      if (profile.job_offer === "yes") {
        queries.push(`${destination} employment visa employer sponsorship`)
      }
      break
    case "study":
      queries.push(`${destination} student visa requirements international students`)
      if (profile.study_type === "university") {
        queries.push(`${destination} university student visa application`)
      }
      break
    case "digital_nomad":
      queries.push(`${destination} digital nomad visa freelancer visa remote work`)
      queries.push(`${destination} self-employment visa freelance requirements`)
      break
    case "settle":
      queries.push(`${destination} residence permit permanent residency requirements`)
      if (profile.settlement_reason === "retirement") {
        queries.push(`${destination} retirement visa requirements`)
      } else if (profile.settlement_reason === "family_reunion") {
        queries.push(`${destination} family reunification visa requirements`)
      }
      break
    default:
      queries.push(`${destination} long term visa options ${citizenship}`)
  }

  return queries
}

async function analyzeVisaContent(
  scrapedContent: string[],
  profile: UserProfile
): Promise<VisaAnalysisResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return { visas: [], generalRequirements: [], importantNotes: [] }
  }

  const hasWebContent = scrapedContent.length > 0
  const combinedContent = hasWebContent ? scrapedContent.join("\n\n---\n\n").slice(0, 50_000) : ""

  const dataSourceSection = hasWebContent
    ? `Based on the content below, identify ALL relevant visa options for this person.

SCRAPED CONTENT:
${combinedContent}`
    : `No web research content was available. Use your training knowledge about ${profile.destination} visa options for ${profile.citizenship} nationals moving for ${profile.purpose}. Only state visa options and requirements you are confident about. Do not hallucinate specific fees or processing times — if unsure, say "varies" or "check official sources".`

  const prompt = `Analyze visa options for someone with this profile:
- Nationality: ${profile.citizenship}
- Destination: ${profile.destination}
- Purpose: ${profile.purpose}
- Education: ${profile.education_level || "Not specified"}
- Work Experience: ${profile.years_experience || "Not specified"} years
- Job Offer: ${profile.job_offer || "No"}
- Highly Skilled: ${profile.highly_skilled || "Unknown"}
- Monthly Income: ${profile.monthly_income || "Not specified"}
- Duration of Stay: ${profile.duration || "Not specified"}

${dataSourceSection}

For each visa, provide:
1. Official name of the visa
2. Type (work, student, digital_nomad, settlement, family, investor, or other)
3. Whether they are likely eligible, possibly eligible, or unlikely eligible
4. Key requirements (list each one)
5. Typical processing time
6. Approximate cost
7. Validity period
8. Main benefits
9. Any limitations
10. Key eligibility factors that drive the assessment (e.g., "Has job offer", "EU citizen")
11. Assumptions made about the applicant's situation
12. Source URLs from the research content that support this visa option (if identifiable)

Respond with a JSON object matching:
{
  "visas": [{ "name": "", "type": "work", "eligibility": "likely_eligible", "eligibilityReason": "", "requirements": [], "processingTime": "", "cost": "", "validity": "", "benefits": [], "limitations": [], "factors": ["key factor 1"], "assumptions": ["assumption 1"], "sourceUrls": ["https://..."] }],
  "generalRequirements": [],
  "importantNotes": []
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
                "You are an immigration expert. Analyze visa information and provide accurate, structured recommendations. Always be conservative with eligibility assessments. Respond only with valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      },
      20_000
    )

    if (!response.ok) {
      console.error("[GoMate] OpenAI API failed:", response.status)
      return { visas: [], generalRequirements: [], importantNotes: [] }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return { visas: [], generalRequirements: [], importantNotes: [] }

    return JSON.parse(content) as VisaAnalysisResponse
  } catch (error) {
    console.error("[GoMate] AI analysis error:", error)
    return { visas: [], generalRequirements: [], importantNotes: [] }
  }
}

export async function performVisaResearch(
  supabase: SupabaseClient,
  planId: string,
  userId: string,
  manageResearchStatus = true
): Promise<ServiceResult<{ research: VisaResearchResult }>> {
  try {
    if (!planId) {
      return { ok: false, status: 400, body: { error: "Plan ID required" } }
    }

    const { data: plan, error: planError } = await supabase
      .from("relocation_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", userId)
      .single()

    if (planError || !plan) {
      return { ok: false, status: 404, body: { error: "Plan not found" } }
    }

    const profileData = (plan.profile_data || {}) as UserProfile
    if (!profileData.citizenship || !profileData.destination) {
      return {
        ok: false,
        status: 400,
        body: { error: "Profile missing citizenship or destination" },
      }
    }

    if (manageResearchStatus) {
      const { error: statusError } = await supabase
        .from("relocation_plans")
        .update({ research_status: "in_progress" })
        .eq("id", planId)
        .eq("user_id", userId)

      if (statusError) {
        return { ok: false, status: 500, body: { error: "Failed to start visa research" } }
      }
    }

    const officialSources = getAllSources(profileData.destination)
    const immigrationUrl = getSourceUrl(profileData.destination, "immigration")
    const visaUrl = getSourceUrl(profileData.destination, "visa")
    const scrapedContent: string[] = []

    if (immigrationUrl) {
      const content = await scrapeUrl(immigrationUrl)
      if (content) scrapedContent.push(`[Official Immigration Website]\n${content}`)
    }

    if (visaUrl && visaUrl !== immigrationUrl) {
      const content = await scrapeUrl(visaUrl)
      if (content) scrapedContent.push(`[Visa Portal]\n${content}`)
    }

    const queries = buildSearchQueries(profileData)
    for (const query of queries.slice(0, 2)) {
      const results = await searchVisaInfo(query, 2)
      scrapedContent.push(...results)
    }

    if (!FIRECRAWL_API_KEY) {
      console.warn("[GoMate][Visa] FIRECRAWL_API_KEY not set — running LLM-only research")
    }

    // Always run LLM analysis — it handles empty scrapedContent with knowledge-only mode
    const analysis = await analyzeVisaContent(scrapedContent, profileData)

    const confidence: "high" | "medium" | "low" =
      scrapedContent.length >= 3 ? "high" : scrapedContent.length > 0 ? "medium" : "low"

    const sourcesList: { name: string; url: string }[] = []
    if (officialSources?.immigration) {
      sourcesList.push({ name: "Immigration Authority", url: officialSources.immigration })
    }
    if (officialSources?.visa) {
      sourcesList.push({ name: "Visa Portal", url: officialSources.visa })
    }

    const eligibilityMap: Record<string, NormalizedVisaEligibility> = {
      likely_eligible: "high",
      possibly_eligible: "medium",
      unlikely_eligible: "low",
    }
    const normalizedEligibilityValues = new Set<NormalizedVisaEligibility>([
      "high",
      "medium",
      "low",
      "unknown",
    ])

    const visaOptions: NormalizedVisaOption[] = (analysis.visas || []).map((visa) => ({
      ...visa,
      officialLink: immigrationUrl || visaUrl || visa.officialLink,
      eligibility: eligibilityMap[visa.eligibility]
        || (normalizedEligibilityValues.has(visa.eligibility as NormalizedVisaEligibility)
          ? (visa.eligibility as NormalizedVisaEligibility)
          : "unknown"),
      factors: Array.isArray(visa.factors) ? visa.factors : [],
      assumptions: Array.isArray(visa.assumptions) ? visa.assumptions : [],
      sourceUrls: Array.isArray(visa.sourceUrls) ? visa.sourceUrls : [],
    }))

    // B2-002: Compute quality based on actual artifact content, not just HTTP success
    const quality: "full" | "partial" | "fallback" =
      visaOptions.length > 0 && scrapedContent.length > 0
        ? "full"
        : visaOptions.length > 0 || scrapedContent.length > 0
          ? "partial"
          : "fallback"

    const researchResult: VisaResearchResult = {
      destination: profileData.destination,
      citizenship: profileData.citizenship,
      purpose: profileData.purpose || "other",
      visaOptions,
      summary: `Found ${visaOptions.length} visa option${visaOptions.length !== 1 ? "s" : ""} for ${profileData.citizenship} citizens moving to ${profileData.destination}.`,
      disclaimer:
        "Visa requirements change frequently. Always verify information on official government websites before applying.",
      generalRequirements: analysis.generalRequirements || [],
      importantNotes: analysis.importantNotes || [],
      officialSources: sourcesList,
      researchedAt: new Date().toISOString(),
      confidence,
      quality,
      sourceCount: scrapedContent.length,
    }

    const updatePayload: {
      visa_research: VisaResearchResult
      research_status?: "completed"
      research_completed_at?: string
    } = {
      visa_research: researchResult,
    }

    if (manageResearchStatus) {
      updatePayload.research_status = "completed"
      updatePayload.research_completed_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from("relocation_plans")
      .update(updatePayload)
      .eq("id", planId)
      .eq("user_id", userId)

    if (updateError) {
      return { ok: false, status: 500, body: { error: "Failed to save visa research" } }
    }

    return { ok: true, status: 200, body: { research: researchResult } }
  } catch (error) {
    console.error("[GoMate] Visa research error:", error)
    return {
      ok: false,
      status: 500,
      body: { error: "Failed to perform visa research" },
    }
  }
}
