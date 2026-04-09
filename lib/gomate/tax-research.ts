import type { SupabaseClient } from "@supabase/supabase-js"
import { getSourceUrl } from "./official-sources"
import { fetchWithRetry } from "./fetch-with-retry"

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"
const OPENAI_API_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "")
const OPENAI_API_URL = `${OPENAI_API_BASE}/chat/completions`
const IS_OPENROUTER = OPENAI_API_BASE.includes("openrouter.ai")

export interface TaxBracket {
  upTo: number | null
  rate: number
}

export interface SpecialRegime {
  name: string
  summary: string
  eligibility: string
}

export interface TaxResearchResult {
  incomeTaxBrackets: TaxBracket[]
  socialContributions: string
  specialRegimes: SpecialRegime[]
  taxYear: string
  filingDeadline: string
  disclaimer: string
  officialLink: string
  lastVerified: string
  /** Metadata */
  researchedAt: string
  sourceUrl: string
  sourceCount: number
  quality: "full" | "partial" | "fallback"
}

type ServiceResult<T> =
  | { ok: true; status: 200; body: T }
  | { ok: false; status: number; body: { error: string } }

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
      console.error("[GoMate][Tax] Firecrawl scrape failed:", response.status)
      return null
    }

    const data = await response.json()
    return data.data?.markdown || null
  } catch (error) {
    console.error("[GoMate][Tax] Firecrawl scrape error:", error)
    return null
  }
}

async function searchTaxInfo(query: string, limit = 3): Promise<string[]> {
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
      console.error("[GoMate][Tax] Firecrawl search failed:", response.status)
      return []
    }

    const data = await response.json()
    return (data.data || [])
      .map((item: { markdown?: string }) => item.markdown || "")
      .filter(Boolean)
  } catch (error) {
    console.error("[GoMate][Tax] Firecrawl search error:", error)
    return []
  }
}

async function analyzeTaxContent(
  scrapedContent: string[],
  destination: string,
  taxUrl: string | null
): Promise<TaxResearchResult | null> {
  if (!process.env.OPENAI_API_KEY) return null

  const hasWebContent = scrapedContent.length > 0
  const combinedContent = hasWebContent ? scrapedContent.join("\n\n---\n\n").slice(0, 50_000) : ""

  const dataSourceSection = hasWebContent
    ? `Based on the scraped content below, extract the current income tax brackets and related tax information for ${destination}.

SCRAPED CONTENT:
${combinedContent}`
    : `No web research content was available. Use your training knowledge about ${destination}'s current income tax system. Only state information you are confident about. If unsure about specific rates or thresholds, omit them rather than guessing.`

  const prompt = `Extract the personal income tax information for ${destination}.

${dataSourceSection}

Respond with a JSON object matching this exact structure:
{
  "incomeTaxBrackets": [
    { "upTo": 11604, "rate": 0 },
    { "upTo": 50000, "rate": 0.14 },
    { "upTo": null, "rate": 0.45 }
  ],
  "socialContributions": "~20% employee share (health, pension, unemployment, long-term care)",
  "specialRegimes": [
    { "name": "Regime Name", "summary": "Brief description", "eligibility": "Who qualifies" }
  ],
  "taxYear": "2025",
  "filingDeadline": "July 31 of the following year",
  "disclaimer": "Rates may change. Consult a local tax advisor for personal advice."
}

Rules:
- "upTo" is the upper threshold in local currency. Use null for the highest bracket (no cap).
- "rate" is a decimal (0.14 = 14%). Include the 0% bracket if there is a tax-free allowance.
- Include ALL brackets, not just a summary.
- "specialRegimes" should list any favorable tax regimes for expats/newcomers (e.g., 30% ruling in Netherlands, Beckham Law in Spain, NHR in Portugal). Empty array if none.
- "socialContributions" should summarize the employee-side mandatory contributions.
- Be precise with numbers. If the source shows exact thresholds, use them.`

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
                "You are a tax expert specializing in international taxation. Extract accurate, structured tax information from official sources. Respond only with valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      },
      20_000
    )

    if (!response.ok) {
      console.error("[GoMate][Tax] OpenAI API failed:", response.status)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content) as {
      incomeTaxBrackets?: TaxBracket[]
      socialContributions?: string
      specialRegimes?: SpecialRegime[]
      taxYear?: string
      filingDeadline?: string
      disclaimer?: string
    }

    if (!parsed.incomeTaxBrackets || parsed.incomeTaxBrackets.length === 0) return null

    const quality: "full" | "partial" | "fallback" =
      hasWebContent && parsed.incomeTaxBrackets.length > 0
        ? "full"
        : parsed.incomeTaxBrackets.length > 0
          ? "partial"
          : "fallback"

    return {
      incomeTaxBrackets: parsed.incomeTaxBrackets,
      socialContributions: parsed.socialContributions || "Check local tax authority",
      specialRegimes: parsed.specialRegimes || [],
      taxYear: parsed.taxYear || new Date().getFullYear().toString(),
      filingDeadline: parsed.filingDeadline || "Check local tax authority",
      disclaimer:
        parsed.disclaimer ||
        "Tax rates change frequently. Consult a qualified tax advisor for personal advice.",
      officialLink: taxUrl || "",
      lastVerified: new Date().toISOString(),
      researchedAt: new Date().toISOString(),
      sourceUrl: taxUrl || "",
      sourceCount: scrapedContent.length,
      quality,
    }
  } catch (error) {
    console.error("[GoMate][Tax] AI analysis error:", error)
    return null
  }
}

export async function performTaxResearch(
  supabase: SupabaseClient,
  planId: string,
  userId: string
): Promise<ServiceResult<{ research: TaxResearchResult }>> {
  try {
    if (!planId) {
      return { ok: false, status: 400, body: { error: "Plan ID required" } }
    }

    const { data: plan, error: planError } = await supabase
      .from("relocation_plans")
      .select("id, user_id, profile_data")
      .eq("id", planId)
      .eq("user_id", userId)
      .single()

    if (planError || !plan) {
      return { ok: false, status: 404, body: { error: "Plan not found" } }
    }

    const profileData = (plan.profile_data || {}) as { destination?: string }
    if (!profileData.destination) {
      return { ok: false, status: 400, body: { error: "Profile missing destination" } }
    }

    const destination = profileData.destination
    const taxUrl = getSourceUrl(destination, "tax")
    const scrapedContent: string[] = []

    // 1. Scrape the official tax authority URL if available
    if (taxUrl) {
      const content = await scrapeUrl(taxUrl)
      if (content) scrapedContent.push(`[Official Tax Authority]\n${content}`)
    }

    // 2. Search for supplementary tax info
    const searchQueries = [
      `${destination} personal income tax rates brackets ${new Date().getFullYear()}`,
      `${destination} expat tax special regime newcomer`,
    ]

    for (const query of searchQueries) {
      const results = await searchTaxInfo(query, 2)
      scrapedContent.push(...results)
    }

    if (!FIRECRAWL_API_KEY) {
      console.warn("[GoMate][Tax] FIRECRAWL_API_KEY not set — running LLM-only research")
    }

    // 3. AI extraction
    const result = await analyzeTaxContent(scrapedContent, destination, taxUrl)

    if (!result) {
      return { ok: false, status: 500, body: { error: "Failed to extract tax data" } }
    }

    // 4. Store result
    const { error: updateError } = await supabase
      .from("relocation_plans")
      .update({ tax_research: result })
      .eq("id", planId)
      .eq("user_id", userId)

    if (updateError) {
      return { ok: false, status: 500, body: { error: "Failed to save tax research" } }
    }

    return { ok: true, status: 200, body: { research: result } }
  } catch (error) {
    console.error("[GoMate][Tax] Research error:", error)
    return { ok: false, status: 500, body: { error: "Failed to perform tax research" } }
  }
}
