import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { generateText } from "ai"
import FirecrawlApp from "@mendable/firecrawl-js"
import { getAllSources } from "@/lib/gomate/official-sources"

// Lazy-initialize Firecrawl (returns null if API key is missing)
function getFirecrawl(): FirecrawlApp | null {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    console.warn("[GoMate] FIRECRAWL_API_KEY not set, skipping scraping")
    return null
  }
  return new FirecrawlApp({ apiKey })
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

    // Scrape official sources (only if Firecrawl is available)
    const firecrawl = getFirecrawl()
    console.log("[v0] firecrawl instance:", firecrawl ? Object.getOwnPropertyNames(Object.getPrototypeOf(firecrawl)) : "null")
    console.log("[v0] firecrawl type:", typeof firecrawl, firecrawl?.constructor?.name)
    console.log("[v0] scrapeUrl type:", typeof firecrawl?.scrapeUrl)
    
    if (firecrawl && typeof firecrawl.scrapeUrl === "function") {
      for (const url of sourcesToScrape.slice(0, 4)) {
        try {
          const scrapeResult = await firecrawl.scrapeUrl(url, {
            formats: ["markdown"],
          })
          if (scrapeResult.success && scrapeResult.markdown) {
            scrapedContent.push(
              `--- Content from ${url} ---\n${scrapeResult.markdown.slice(0, 8000)}`
            )
          }
        } catch (scrapeError) {
          console.error(`[GoMate] Failed to scrape ${url}:`, scrapeError)
        }
      }

      // Search for specific local requirements
      const searchQueries = [
        `${destination} residence registration requirements for foreigners ${new Date().getFullYear()}`,
        `${destination} tax registration foreign residents`,
        `${destination} healthcare insurance registration expats`,
        `${destination} open bank account foreigner requirements`,
        `${destination} drivers license exchange conversion foreign`,
        `${destinationCity ? `${destinationCity} ${destination}` : destination} moving checklist expats`,
      ]

      for (const query of searchQueries.slice(0, 4)) {
        try {
          if (typeof firecrawl.search !== "function") break
          const searchResult = await firecrawl.search(query, { limit: 2 })
          if (searchResult.success && searchResult.data) {
            for (const result of searchResult.data) {
              if (result.markdown) {
                scrapedContent.push(
                  `--- Search result for "${query}" ---\n${result.markdown.slice(0, 4000)}`
                )
              }
            }
          }
        } catch (searchError) {
          console.error(`[GoMate] Search failed for "${query}":`, searchError)
        }
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

    // Call AI to analyze and structure the research
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
      temperature: 0.3,
    })

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

    // Build the complete research object
    const research: LocalRequirementsResearch = {
      destination,
      destinationCity,
      categories: parsedResearch.categories || {
        registration: [],
        taxId: [],
        healthcare: [],
        banking: [],
        driversLicense: [],
        utilities: [],
        housing: [],
        other: [],
      },
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
