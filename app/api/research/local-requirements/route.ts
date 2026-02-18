import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getAllSources } from "@/lib/gomate/official-sources"

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"

// Scrape a URL using Firecrawl REST API
async function scrapeUrl(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) return null
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

// Search using Firecrawl REST API
async function searchFirecrawl(query: string, limit = 2): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) return []
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
  destinationCity?: string
  categories: {
    registration: LocalRequirement[]
    taxId: LocalRequirement[]
    healthcare: LocalRequirement[]
    banking: LocalRequirement[]
    driversLicense: LocalRequirement[]
    utilities: LocalRequirement[]
    housing: LocalRequirement[]
    other: LocalRequirement[]
  }
  generalTips: string[]
  importantDeadlines: { task: string; deadline: string }[]
  researchedAt: string
  sources: string[]
}

// POST - Perform local requirements research using Firecrawl + AI
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
    const { planId, forceRefresh = false } = body

    // Get the user's relocation plan
    const { data: plan, error: planError } = await supabase
      .from("relocation_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Relocation plan not found" },
        { status: 404 }
      )
    }

    // Check if we have cached research that's less than 7 days old
    if (
      !forceRefresh &&
      plan.local_requirements_research &&
      plan.research_completed_at
    ) {
      const researchAge =
        Date.now() - new Date(plan.research_completed_at).getTime()
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

      if (researchAge < sevenDaysMs) {
        return NextResponse.json({
          research: plan.local_requirements_research,
          cached: true,
          cachedAt: plan.research_completed_at,
        })
      }
    }

    // Update status to in_progress
    await supabase
      .from("relocation_plans")
      .update({ research_status: "in_progress" })
      .eq("id", planId)

    const profileData = plan.profile_data || {}
    const destination = profileData.destination || profileData.destinationCountry
    const destinationCity = profileData.destinationCity || profileData.city

    if (!destination) {
      return NextResponse.json(
        { error: "Destination country is required" },
        { status: 400 }
      )
    }

    // Get official sources for the destination
    const officialSources = getAllSources(destination)
    const sourcesToScrape: string[] = []
    const scrapedContent: string[] = []

    if (officialSources) {
      if (officialSources.immigration) sourcesToScrape.push(officialSources.immigration)
      if (officialSources.housing) sourcesToScrape.push(officialSources.housing)
      if (officialSources.banking) sourcesToScrape.push(officialSources.banking)
      if (officialSources.employment) sourcesToScrape.push(officialSources.employment)
      if (officialSources.safety) sourcesToScrape.push(officialSources.safety)
    }

    // Scrape official sources using Firecrawl REST API
    for (const url of sourcesToScrape.slice(0, 4)) {
      const content = await scrapeUrl(url)
      if (content) {
        scrapedContent.push(`--- Content from ${url} ---\n${content.slice(0, 8000)}`)
      }
    }

    // Search for specific local requirements using Firecrawl REST API
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

    // Build the AI prompt
    const prompt = `You are an expert relocation consultant. Analyze the following information about moving to ${destination}${destinationCity ? ` (specifically ${destinationCity})` : ""} and provide comprehensive local requirements research.

USER PROFILE:
- Destination: ${destination}${destinationCity ? `, ${destinationCity}` : ""}
- Purpose: ${profileData.purpose || "General relocation"}
- Citizenship: ${profileData.citizenship || "Unknown"}
- Timeline: ${profileData.timeline || "Not specified"}
- Has job offer: ${profileData.hasJobOffer ? "Yes" : "No"}
- Family size: ${profileData.familySize || 1}

SCRAPED CONTENT FROM OFFICIAL SOURCES:
${scrapedContent.join("\n\n").slice(0, 25000)}

Based on this information, provide detailed local requirements research in JSON format. Include:

1. Registration requirements (residence registration, city hall registration, etc.)
2. Tax ID requirements (how to get tax number, registration process)
3. Healthcare requirements (health insurance, registration with doctors)
4. Banking requirements (opening bank account, required documents)
5. Driver's license (exchange process, requirements, tests needed)
6. Utilities (setting up electricity, water, internet)
7. Housing (rental requirements, deposit rules, tenant rights)
8. Other important requirements

For each requirement, provide:
- Detailed steps
- Required documents
- Estimated time to complete
- Costs involved
- Official links where available
- Practical tips
- Deadlines if applicable

Respond ONLY with valid JSON in this exact structure:
{
  "categories": {
    "registration": [
      {
        "category": "registration",
        "name": "City Registration (e.g., Anmeldung)",
        "description": "Brief description",
        "steps": ["Step 1", "Step 2"],
        "requiredDocuments": ["Document 1", "Document 2"],
        "estimatedTime": "1-2 weeks",
        "cost": "Free or amount",
        "officialLinks": ["https://..."],
        "tips": ["Tip 1", "Tip 2"],
        "deadline": "Within 14 days of arrival"
      }
    ],
    "taxId": [],
    "healthcare": [],
    "banking": [],
    "driversLicense": [],
    "utilities": [],
    "housing": [],
    "other": []
  },
  "generalTips": ["General tip 1", "General tip 2"],
  "importantDeadlines": [
    { "task": "Task name", "deadline": "Deadline description" }
  ]
}`

    // Call OpenAI directly to analyze and structure the research
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content: "You are an expert relocation consultant. Provide accurate, structured local requirements research. Respond ONLY with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text()
      console.error("[GoMate] OpenAI API failed:", aiResponse.status, errBody)
      throw new Error(`OpenAI API failed with status ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    const text = aiData.choices?.[0]?.message?.content || ""

    // Parse the AI response
    let parsedResearch: Partial<LocalRequirementsResearch>
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("No JSON found in response")
      }
      parsedResearch = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error("[GoMate] Failed to parse AI response:", parseError)
      // Return a basic structure if parsing fails
      parsedResearch = {
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
          "Research specific requirements for your visa type",
          "Keep copies of all important documents",
          "Start processes early as they can take time",
        ],
        importantDeadlines: [],
      }
    }

    // Convert categories from keyed object to array format expected by the component
    // API returns: { registration: [...], taxId: [...] }
    // Component expects: [{ category: "Registration", items: [...] }, ...]
    const rawCategories = parsedResearch.categories || {
      registration: [],
      taxId: [],
      healthcare: [],
      banking: [],
      driversLicense: [],
      utilities: [],
      housing: [],
      other: [],
    }
    
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
    
    const normalizedCategories = Object.entries(rawCategories)
      .filter(([, items]) => Array.isArray(items) && items.length > 0)
      .map(([key, items]) => ({
        category: categoryLabelMap[key] || key.charAt(0).toUpperCase() + key.slice(1),
        items: (items as any[]).map((item: any) => ({
          // Task 6: Map name -> title
          title: item.name || item.title || "Untitled",
          description: item.description || "",
          steps: item.steps || [],
          // Task 5: Map requiredDocuments -> documents
          documents: item.requiredDocuments || item.documents || [],
          estimatedTime: item.estimatedTime || "",
          cost: item.cost || "",
          officialLink: (item.officialLinks || [])[0] || item.officialLink || "",
          tips: item.tips || [],
        })),
      }))
    
    // Build the complete research object
    const research = {
      destination,
      city: destinationCity,
      categories: normalizedCategories,
      summary: `Local requirements research for ${destination}${destinationCity ? ` (${destinationCity})` : ""}.`,
      disclaimer: "Requirements may vary based on your visa type and personal circumstances. Always verify with official sources.",
      generalTips: parsedResearch.generalTips || [],
      importantDeadlines: parsedResearch.importantDeadlines || [],
      researchedAt: new Date().toISOString(),
      sources: sourcesToScrape,
    }

    // Save to database
    const { error: updateError } = await supabase
      .from("relocation_plans")
      .update({
        local_requirements_research: research,
        research_completed_at: new Date().toISOString(),
        research_status: "completed",
      })
      .eq("id", planId)

    if (updateError) {
      console.error("[GoMate] Failed to save local requirements research:", updateError)
    }

    return NextResponse.json({
      research,
      cached: false,
    })
  } catch (error) {
    console.error("[GoMate] Local requirements research error:", error)

    // Try to update status to failed
    try {
      const supabase = await createClient()
      const body = await request.clone().json()
      if (body.planId) {
        await supabase
          .from("relocation_plans")
          .update({ research_status: "failed" })
          .eq("id", body.planId)
      }
    } catch {
      // Ignore update errors
    }

    return NextResponse.json(
      { error: "Failed to perform local requirements research" },
      { status: 500 }
    )
  }
}

// GET - Retrieve cached local requirements research
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
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      )
    }

    const { data: plan, error } = await supabase
      .from("relocation_plans")
      .select("local_requirements_research, research_completed_at, research_status")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single()

    if (error || !plan) {
      return NextResponse.json(
        { error: "Relocation plan not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      research: plan.local_requirements_research,
      cachedAt: plan.research_completed_at,
      status: plan.research_status,
    })
  } catch (error) {
    console.error("[GoMate] Get local requirements error:", error)
    return NextResponse.json(
      { error: "Failed to retrieve local requirements research" },
      { status: 500 }
    )
  }
}
