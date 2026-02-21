/**
 * Visa Research API Endpoint
 * 
 * Uses Firecrawl to scrape official immigration websites and AI to analyze
 * and extract structured visa recommendations for the user's profile.
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getAllSources, getSourceUrl } from "@/lib/gomate/official-sources"

// Normalize old DB visa research shape to component-expected shape
function normalizeVisaResearch(raw: any): any {
  if (!raw) return raw
  const eligMap: Record<string, string> = {
    likely_eligible: "high", possibly_eligible: "medium", unlikely_eligible: "low",
  }
  const visaOptions = (raw.visaOptions || raw.recommendedVisas || []).map((v: any) => ({
    ...v,
    eligibility: eligMap[v.eligibility] || v.eligibility || "unknown",
  }))
  return {
    ...raw,
    visaOptions,
    citizenship: raw.citizenship || raw.nationality,
  }
}

// Firecrawl configuration
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"

// Types for visa research
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
}

export interface VisaResearchResult {
  destination: string
  nationality: string
  purpose: string
  recommendedVisas: VisaOption[]
  generalRequirements: string[]
  importantNotes: string[]
  officialSources: { name: string; url: string }[]
  researchedAt: string
  confidence: "high" | "medium" | "low"
}

interface UserProfile {
  citizenship: string
  destination: string
  purpose: string
  job_offer?: string
  job_field?: string
  employer_sponsorship?: string
  highly_skilled?: string
  study_type?: string
  study_field?: string
  remote_income?: string
  monthly_income?: string
  settlement_reason?: string
  family_ties?: string
  education_level?: string
  years_experience?: string
  duration?: string
}

/**
 * Scrape a URL using Firecrawl
 */
async function scrapeUrl(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    console.log("[GoMate] Firecrawl API key not configured")
    return null
  }

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
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
 * Search and scrape visa information
 */
async function searchVisaInfo(query: string, limit = 3): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) {
    return []
  }

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/search`, {
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
    })

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

/**
 * Build search queries based on user profile
 */
function buildSearchQueries(profile: UserProfile): string[] {
  const queries: string[] = []
  const { citizenship, destination, purpose } = profile

  // Base visa query
  queries.push(`${destination} visa requirements for ${citizenship} citizens`)

  // Purpose-specific queries
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

/**
 * Use AI to analyze scraped content and extract visa options
 */
async function analyzeVisaContent(
  scrapedContent: string[],
  profile: UserProfile
): Promise<VisaOption[]> {
  const combinedContent = scrapedContent.join("\n\n---\n\n").slice(0, 50000) // Limit content size

  const prompt = `Analyze the following visa information for someone with this profile:
- Nationality: ${profile.citizenship}
- Destination: ${profile.destination}
- Purpose: ${profile.purpose}
- Education: ${profile.education_level || "Not specified"}
- Work Experience: ${profile.years_experience || "Not specified"} years
- Job Offer: ${profile.job_offer || "No"}
- Highly Skilled: ${profile.highly_skilled || "Unknown"}
- Monthly Income: ${profile.monthly_income || "Not specified"}
- Duration of Stay: ${profile.duration || "Not specified"}

Based on the content below, identify ALL relevant visa options for this person. For each visa, provide:
1. Official name of the visa
2. Type (work, student, digital_nomad, settlement, family, investor, or other)
3. Whether they are likely eligible, possibly eligible, or unlikely eligible
4. Key requirements (list each one)
5. Typical processing time
6. Approximate cost
7. Validity period
8. Main benefits
9. Any limitations

SCRAPED CONTENT:
${combinedContent}

Respond in this exact JSON format:
{
  "visas": [
    {
      "name": "Visa Name",
      "type": "work",
      "eligibility": "likely_eligible",
      "eligibilityReason": "Why they qualify or don't",
      "requirements": ["Requirement 1", "Requirement 2"],
      "processingTime": "2-4 weeks",
      "cost": "€100-150",
      "validity": "1 year, renewable",
      "benefits": ["Benefit 1", "Benefit 2"],
      "limitations": ["Limitation 1"]
    }
  ],
  "generalRequirements": ["Valid passport", "Proof of funds"],
  "importantNotes": ["Note about application process"]
}`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an immigration expert. Analyze visa information and provide accurate, structured recommendations. Always be conservative with eligibility assessments - if unsure, say 'possibly_eligible'. Include all relevant visa options, not just the most obvious ones.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      console.error("[GoMate] OpenAI API failed:", response.status)
      return []
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error("[GoMate] Could not parse AI response")
      return []
    }

    const parsed = JSON.parse(jsonMatch[0])
    return parsed.visas || []
  } catch (error) {
    console.error("[GoMate] AI analysis error:", error)
    return []
  }
}

/**
 * POST: Perform visa research for a user
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { planId } = body

    // Get the relocation plan with profile data
    const { data: plan, error: planError } = await supabase
      .from("relocation_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const profileData = plan.profile_data as UserProfile

    if (!profileData?.citizenship || !profileData?.destination) {
      return NextResponse.json(
        { error: "Profile missing citizenship or destination" },
        { status: 400 }
      )
    }

    // Update research status to in_progress
    await supabase
      .from("relocation_plans")
      .update({ research_status: "in_progress" })
      .eq("id", planId)

    // Get official sources for the destination
    const officialSources = getAllSources(profileData.destination)
    const immigrationUrl = getSourceUrl(profileData.destination, "immigration")
    const visaUrl = getSourceUrl(profileData.destination, "visa")

    // Collect content from multiple sources
    const scrapedContent: string[] = []

    // 1. Scrape official immigration website if available
    if (immigrationUrl) {
      const content = await scrapeUrl(immigrationUrl)
      if (content) {
        scrapedContent.push(`[Official Immigration Website]\n${content}`)
      }
    }

    // 2. Scrape visa portal if available
    if (visaUrl && visaUrl !== immigrationUrl) {
      const content = await scrapeUrl(visaUrl)
      if (content) {
        scrapedContent.push(`[Visa Portal]\n${content}`)
      }
    }

    // 3. Search for additional visa information
    const queries = buildSearchQueries(profileData)
    for (const query of queries.slice(0, 2)) {
      // Limit to 2 searches to conserve credits
      const results = await searchVisaInfo(query, 2)
      scrapedContent.push(...results)
    }

    // 4. Analyze content with AI
    let recommendedVisas: VisaOption[] = []
    let generalRequirements: string[] = []
    let importantNotes: string[] = []
    let confidence: "high" | "medium" | "low" = "low"

    if (scrapedContent.length > 0) {
      try {
        const aiResponse = await analyzeVisaContent(scrapedContent, profileData)
        recommendedVisas = aiResponse
        confidence = scrapedContent.length >= 3 ? "high" : "medium"
      } catch (e) {
        console.error("[GoMate] AI analysis failed:", e)
      }
    }

    // Add official links to visa options
    recommendedVisas = recommendedVisas.map((visa) => ({
      ...visa,
      officialLink: immigrationUrl || visaUrl || undefined,
    }))

    // Build official sources list
    const sourcesList: { name: string; url: string }[] = []
    if (officialSources) {
      if (officialSources.immigration) {
        sourcesList.push({
          name: "Immigration Authority",
          url: officialSources.immigration,
        })
      }
      if (officialSources.visa) {
        sourcesList.push({ name: "Visa Portal", url: officialSources.visa })
      }
    }

    // Task 3: Map eligibility values from AI format to component format
    const eligibilityMap: Record<string, string> = {
      likely_eligible: "high",
      possibly_eligible: "medium",
      unlikely_eligible: "low",
    }

    // Task 2: Rename recommendedVisas -> visaOptions and map eligibility
    const visaOptions = recommendedVisas.map((visa) => ({
      ...visa,
      eligibility: eligibilityMap[visa.eligibility] || visa.eligibility || "unknown",
    }))

    // Build final result in the shape the component expects
    const researchResult = {
      destination: profileData.destination,
      citizenship: profileData.citizenship,
      purpose: profileData.purpose || "other",
      visaOptions,
      summary: `Found ${visaOptions.length} visa option${visaOptions.length !== 1 ? "s" : ""} for ${profileData.citizenship} citizens moving to ${profileData.destination}.`,
      disclaimer: "Visa requirements change frequently. Always verify information on official government websites before applying.",
      generalRequirements,
      importantNotes,
      officialSources: sourcesList,
      researchedAt: new Date().toISOString(),
      confidence,
    }

    // Save research results to database
    const { error: updateError } = await supabase
      .from("relocation_plans")
      .update({
        visa_research: researchResult,
        research_status: "completed",
        research_completed_at: new Date().toISOString(),
      })
      .eq("id", planId)

    if (updateError) {
      console.error("[GoMate] Failed to save research:", updateError)
    }

    // Task 1: Wrap in { research: ... } envelope to match component's data.research access
    return NextResponse.json({ research: researchResult })
  } catch (error) {
    console.error("[GoMate] Visa research error:", error)
    return NextResponse.json(
      { error: "Failed to perform visa research" },
      { status: 500 }
    )
  }
}

/**
 * GET: Retrieve cached visa research
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const planId = searchParams.get("planId")

    if (!planId) {
      return NextResponse.json({ error: "Plan ID required" }, { status: 400 })
    }

    const { data: plan, error } = await supabase
      .from("relocation_plans")
      .select("visa_research, research_status, research_completed_at")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single()

    if (error || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    return NextResponse.json({
      research: normalizeVisaResearch(plan.visa_research),
      visaResearch: normalizeVisaResearch(plan.visa_research),
      status: plan.research_status,
      completedAt: plan.research_completed_at,
    })
  } catch (error) {
    console.error("[GoMate] Get visa research error:", error)
    return NextResponse.json(
      { error: "Failed to retrieve visa research" },
      { status: 500 }
    )
  }
}
