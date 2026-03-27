/**
 * Guide Enrichment Service
 *
 * Uses LLM (Claude Sonnet 4 via OpenRouter) to generate deep, personalized
 * content for each guide section. The template skeleton from guide-generator.ts
 * provides structure and fallback; this layer adds rich prose.
 *
 * Architecture:
 *   1. Fetch web research via Firecrawl (optional, ~5s)
 *   2. Build enrichment prompt from profile + skeleton + research
 *   3. Single LLM call → structured JSON with enriched content
 *   4. Merge enriched fields into skeleton (preserve numbers, links, platforms)
 *   5. On any failure → return skeleton unchanged (graceful degradation)
 */

import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { searchAndScrape } from "./web-research"
import type { Profile } from "./profile-schema"
import type { Guide } from "./guide-generator"

const openrouter = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================================================
// TYPES
// ============================================================================

interface EnrichedGuideContent {
  overview: { summary: string }
  visa: {
    detailedProcess: string
    warnings: string[]
  }
  budget: {
    overview: string
    savingStrategy: string
  }
  housing: {
    overview: string
    neighborhoodGuide: string
    rentalProcess: string
  }
  banking: {
    overview: string
    accountOpeningGuide: string
  }
  healthcare: {
    overview: string
    registrationGuide: string
    insuranceAdvice: string
  }
  culture: {
    overview: string
    deepDive: string
    workplaceCulture: string
    socialIntegration: string
  }
  jobs?: {
    overview: string
    marketOverview: string
    salaryExpectations: string
    searchStrategy: string
  }
  education?: {
    systemOverview: string
    applicationStrategy: string
  }
  timeline: {
    overview: string
  }
  practicalTips: string[]
}

// ============================================================================
// RESEARCH
// ============================================================================

/**
 * Fetch web research via Firecrawl to ground LLM in real-time data.
 * Returns concatenated markdown capped at ~3000 chars.
 * Falls back to empty string on any failure.
 */
async function fetchGuideResearch(
  destination: string,
  city: string | null | undefined,
  purpose: string,
  citizenship: string | null | undefined
): Promise<string> {
  try {
    const year = new Date().getFullYear()
    const location = city || destination

    const queries = [
      `${location} expat relocation guide ${year} cost of living housing tips`,
      `${destination} ${purpose === "digital_nomad" ? "digital nomad" : purpose} visa requirements ${citizenship || ""} ${year}`,
    ]

    if (city) {
      queries.push(`${city} best neighborhoods for expats living areas ${year}`)
    }

    // Run searches in parallel with a 10-second overall timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    try {
      const results = await Promise.all(
        queries.map(q => searchAndScrape(q, 2))
      )
      clearTimeout(timeout)

      const combined = results
        .flat()
        .filter(Boolean)
        .join("\n\n---\n\n")

      // Cap at ~3000 chars to fit in LLM context without dominating it
      return combined.slice(0, 3000)
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    console.log("[GoMate] Guide research fetch failed, proceeding without:", error instanceof Error ? error.message : error)
    return ""
  }
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildProfileContext(profile: Profile): string {
  const parts: string[] = []

  if (profile.name) parts.push(`Name: ${profile.name}`)
  if (profile.citizenship) parts.push(`Citizenship: ${profile.citizenship}`)
  if (profile.current_location) parts.push(`Currently living in: ${profile.current_location}`)
  if (profile.birth_year) parts.push(`Birth year: ${profile.birth_year}`)
  if (profile.destination) parts.push(`Destination: ${profile.destination}`)
  if (profile.target_city) parts.push(`Target city: ${profile.target_city}`)
  if (profile.purpose) parts.push(`Purpose: ${profile.purpose}`)
  if (profile.timeline) parts.push(`Timeline: ${profile.timeline}`)
  if (profile.duration) parts.push(`Duration: ${profile.duration}`)

  // Work details
  if (profile.job_offer) parts.push(`Has job offer: ${profile.job_offer}`)
  if (profile.job_field) parts.push(`Job field: ${profile.job_field}`)
  if (profile.employer_sponsorship) parts.push(`Employer sponsorship: ${profile.employer_sponsorship}`)
  if (profile.highly_skilled) parts.push(`Highly skilled: ${profile.highly_skilled}`)

  // Study details
  if (profile.study_type) parts.push(`Study type: ${profile.study_type}`)
  if (profile.study_field) parts.push(`Field of study: ${profile.study_field}`)

  // Digital nomad
  if (profile.remote_income) parts.push(`Remote income: ${profile.remote_income}`)
  if (profile.monthly_income) parts.push(`Monthly income: ${profile.monthly_income}`)
  if (profile.income_source) parts.push(`Income source: ${profile.income_source}`)

  // Family
  if (profile.moving_alone) parts.push(`Moving alone: ${profile.moving_alone}`)
  if (profile.spouse_joining) parts.push(`Spouse joining: ${profile.spouse_joining}`)
  if (profile.children_count) parts.push(`Number of children: ${profile.children_count}`)
  if (profile.children_ages) parts.push(`Children ages: ${profile.children_ages}`)
  if (profile.pets) parts.push(`Pets: ${profile.pets}`)

  // Financial
  if (profile.savings_available) parts.push(`Savings: ${profile.savings_available}`)
  if (profile.monthly_budget) parts.push(`Monthly budget: ${profile.monthly_budget}`)

  // Background
  if (profile.education_level) parts.push(`Education: ${profile.education_level}`)
  if (profile.language_skill) parts.push(`Destination language level: ${profile.language_skill}`)
  if (profile.years_experience) parts.push(`Years of experience: ${profile.years_experience}`)

  // Practical
  if (profile.healthcare_needs) parts.push(`Healthcare needs: ${profile.healthcare_needs}`)
  if (profile.special_requirements) parts.push(`Special requirements: ${profile.special_requirements}`)

  // Legal
  if (profile.prior_visa) parts.push(`Prior visa: ${profile.prior_visa}`)
  if (profile.visa_rejections) parts.push(`Visa rejections: ${profile.visa_rejections}`)

  return parts.join("\n")
}

function buildEnrichmentPrompt(
  profile: Profile,
  skeleton: Guide,
  researchContext: string
): string {
  const destination = profile.destination || "the destination country"
  const city = profile.target_city || ""
  const purpose = profile.purpose || "relocating"
  const citizenship = profile.citizenship || "their home country"
  const profileContext = buildProfileContext(profile)

  const purposeLabel: Record<string, string> = {
    study: "studying",
    work: "working",
    settle: "settling permanently",
    digital_nomad: "working remotely as a digital nomad",
    other: "relocating",
  }

  const purposeSections = (purpose === "work" || purpose === "digital_nomad")
    ? `
"jobs": {
  "overview": "2-3 paragraphs giving a rich overview of the employment landscape in ${destination} for ${purpose === "digital_nomad" ? "digital nomads and remote workers" : "international workers"}. Include the current state of the market, what industries are thriving, and what it's actually like to work there.",
  "marketOverview": "2-3 paragraphs analyzing the job market in ${destination} for someone in ${profile.job_field || "their field"}. Include in-demand sectors, salary ranges where known, hiring culture, and realistic expectations.",
  "salaryExpectations": "1-2 paragraphs on typical salary ranges, tax implications, and how salaries compare to cost of living.",
  "searchStrategy": "2-3 paragraphs with a personalized job search strategy based on their profile. Include specific platforms, networking approaches, and timeline."
},`
    : purpose === "study"
    ? `
"education": {
  "systemOverview": "2-3 paragraphs on the education system in ${destination}. How it works for international students, accreditation, teaching language, academic culture.",
  "applicationStrategy": "2-3 paragraphs on a personalized application strategy for ${profile.study_field || "their field"}. Include specific steps, deadlines, and tips."
},`
    : ""

  return `You are an expert relocation consultant writing a premium, deeply personalized relocation guide for someone ${purposeLabel[purpose] || "relocating"} to ${destination}${city ? ` (specifically ${city})` : ""}.

## USER PROFILE
${profileContext}

## EXISTING GUIDE DATA
The guide already has these structured data points (keep them as-is, your job is to ADD rich prose):
- Visa: ${skeleton.visa.recommendedVisa} (${skeleton.visa.visaType})
- Budget: ${skeleton.budget.monthlyBudget.minimum}-${skeleton.budget.monthlyBudget.comfortable}/month
- Housing platforms: ${skeleton.housing.rentalPlatforms.map(p => p.name).join(", ")}
- Banks: ${skeleton.banking.recommendedBanks.map(b => b.name).join(", ")}
- Healthcare system: ${skeleton.healthcare.systemType}
${skeleton.jobs ? `- Job platforms: ${skeleton.jobs.jobPlatforms.map(p => p.name).join(", ")}` : ""}

${researchContext ? `## RECENT WEB RESEARCH (use to ground your advice in current data)\n${researchContext}\n` : ""}

## INSTRUCTIONS
Write rich, specific, actionable content for each section. This is a premium guide — NOT generic tips you could find in any travel blog. Be specific to ${destination}, specific to this user's situation (${citizenship} citizen, ${purposeLabel[purpose]}${profile.moving_alone === "no" ? ", moving with family" : ""}), and include details that only a local expert would know.

Each paragraph should be 3-5 sentences. Use concrete details: actual neighborhood names, specific document names, real processes, approximate timelines. Do NOT use bullet points — write flowing prose paragraphs.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):

{
  "overview": {
    "summary": "3-4 paragraphs providing a warm, informative introduction to relocating to ${destination}. Paint a picture of what life is actually like. Include practical reality checks alongside the exciting parts."
  },
  "visa": {
    "detailedProcess": "3-4 paragraphs walking through the actual visa application process step by step. Include specific documents needed, where to apply, typical waiting times, and common pitfalls for ${citizenship} citizens.",
    "warnings": ["3-5 specific warnings or gotchas that apply to this user's situation"]
  },
  "budget": {
    "overview": "2-3 paragraphs analyzing the real cost of living in ${destination}${city ? ` (${city})` : ""}. Go beyond numbers — explain what daily life actually costs, where money goes unexpectedly, how costs compare to other popular expat destinations, and money-saving strategies locals use.",
    "savingStrategy": "2-3 paragraphs with a personalized saving and financial strategy. Include tips on currency exchange, international transfers, tax optimization for ${purposeLabel[purpose] || "expats"}, and financial pitfalls to avoid."
  },
  "housing": {
    "overview": "3-4 paragraphs on the housing market reality. Include typical rental processes, what landlords expect, market conditions, and realistic timelines for finding housing.",
    "neighborhoodGuide": "3-4 paragraphs recommending specific areas${city ? ` in ${city}` : ""} based on the user's profile (${profile.special_requirements || "general preferences"}${profile.moving_alone === "no" ? ", family-friendly" : ""}). Name real neighborhoods, describe their character, and give price indications.",
    "rentalProcess": "2-3 paragraphs on the step-by-step rental process. Required documents, typical deposits, lease terms, tenant rights, and things to watch out for."
  },
  "banking": {
    "overview": "2-3 paragraphs on the banking landscape. How banking works for newcomers, what to expect, common frustrations and how to navigate them.",
    "accountOpeningGuide": "2-3 paragraphs with step-by-step instructions for opening a bank account as a newcomer. Include which documents to bring, which bank to start with given their situation, and typical timelines."
  },
  "healthcare": {
    "overview": "2-3 paragraphs explaining the healthcare system in practical terms. How it actually works day-to-day for an expat, not just the official description.",
    "registrationGuide": "2-3 paragraphs on how to register for healthcare, choose insurance, find a doctor, and handle prescriptions.",
    "insuranceAdvice": "1-2 paragraphs with specific insurance advice based on their situation${profile.healthcare_needs ? ` (they have noted: ${profile.healthcare_needs})` : ""}${profile.moving_alone === "no" ? " including family coverage" : ""}."
  },
  "culture": {
    "overview": "2-3 paragraphs painting a vivid picture of daily life and culture in ${destination}. What makes this place unique, what the social fabric feels like, and how it differs from what most foreigners expect.",
    "deepDive": "3-4 paragraphs on cultural integration. Go beyond surface-level tips — explain the WHY behind cultural norms, how to actually build genuine connections, and what the adjustment curve looks like.",
    "workplaceCulture": "2-3 paragraphs on workplace culture${profile.job_field ? ` specifically in ${profile.job_field}` : ""}. Communication styles, hierarchy, work-life balance expectations, and how to navigate office politics as a foreigner.",
    "socialIntegration": "2-3 paragraphs on building a social life. Where to meet people, how friendships typically form in this culture, expat communities vs local integration, and realistic expectations."
  },${purposeSections}
  "timeline": {
    "overview": "2-3 paragraphs providing a realistic timeline narrative for this relocation. What should happen when, typical bureaucratic delays to expect, and how to sequence the big tasks (housing, banking, registration, healthcare) most efficiently."
  },
  "practicalTips": [
    "10-15 highly specific, actionable tips that are unique to ${destination}. NOT generic advice like 'learn the language'. Instead, things like specific apps to download, bureaucratic shortcuts, things nobody tells you, money-saving tricks, etc."
  ]
}`
}

// ============================================================================
// LLM CALL + MERGE
// ============================================================================

/**
 * Enrich a skeleton guide with LLM-generated content.
 * On any failure, returns the skeleton unchanged.
 */
export async function enrichGuide(profile: Profile, skeleton: Guide): Promise<Guide> {
  try {
    console.log("[GoMate] Starting guide enrichment for:", profile.destination)

    // 1. Fetch web research (non-blocking failure)
    const research = await fetchGuideResearch(
      profile.destination || "",
      profile.target_city,
      profile.purpose || "other",
      profile.citizenship
    )

    // 2. Build prompt
    const prompt = buildEnrichmentPrompt(profile, skeleton, research)

    // 3. LLM call (50s safety-net timeout — complex destinations can take 30-45s)
    const llmController = new AbortController()
    const llmTimeout = setTimeout(() => llmController.abort(), 50_000)
    const result = await generateText({
      model: openrouter("anthropic/claude-sonnet-4"),
      prompt,
      maxOutputTokens: 30000,
      abortSignal: llmController.signal,
    })
    clearTimeout(llmTimeout)

    // 4. Parse JSON response
    let jsonText = result.text.trim()

    console.log(`[GoMate] LLM response length: ${jsonText.length} chars, finish reason: ${result.finishReason}`)

    // Strip markdown code fences if present
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    // Try direct JSON.parse first (works when LLM returns clean JSON)
    let enriched: EnrichedGuideContent
    try {
      enriched = JSON.parse(jsonText.trim())
    } catch {
      // Fallback: extract JSON via brace matching (string-aware, finds LAST depth-0)
      const firstBrace = jsonText.indexOf("{")
      if (firstBrace === -1) throw new Error("No JSON object found in LLM response")
      let depth = 0
      let lastBrace = -1
      let inString = false
      let escape = false
      for (let i = firstBrace; i < jsonText.length; i++) {
        const ch = jsonText[i]
        if (escape) { escape = false; continue }
        if (ch === "\\") { escape = true; continue }
        if (ch === '"') { inString = !inString; continue }
        if (inString) continue
        if (ch === "{") depth++
        else if (ch === "}") {
          depth--
          if (depth === 0) lastBrace = i
        }
      }
      if (lastBrace === -1) throw new Error("Unterminated JSON object in LLM response")
      jsonText = jsonText.slice(firstBrace, lastBrace + 1)
      enriched = JSON.parse(jsonText)
    }

    // Log which sections were enriched
    const enrichedKeys = Object.keys(enriched).filter(k => {
      const val = enriched[k as keyof EnrichedGuideContent]
      return val != null && (typeof val !== "object" || Object.keys(val as object).length > 0)
    })
    console.log(`[GoMate] Guide enrichment complete — sections: ${enrichedKeys.join(", ")}`)

    return mergeEnrichment(skeleton, enriched)
  } catch (error) {
    console.error("[GoMate] Guide enrichment failed, using template content:", error instanceof Error ? error.message : error)
    return skeleton
  }
}

function mergeEnrichment(skeleton: Guide, enriched: EnrichedGuideContent): Guide {
  const guide = { ...skeleton }

  // Overview
  if (enriched.overview?.summary) {
    guide.overview = {
      ...guide.overview,
      summary: enriched.overview.summary,
    }
  }

  // Visa
  if (enriched.visa) {
    guide.visa = {
      ...guide.visa,
      ...(enriched.visa.detailedProcess && { detailedProcess: enriched.visa.detailedProcess }),
      ...(enriched.visa.warnings?.length && { warnings: enriched.visa.warnings }),
    }
  }

  // Budget
  if (enriched.budget) {
    guide.budget = {
      ...guide.budget,
      ...(enriched.budget.overview && { costComparison: enriched.budget.overview }),
      ...(enriched.budget.savingStrategy && { savingStrategy: enriched.budget.savingStrategy }),
    }
  }

  // Housing
  if (enriched.housing) {
    guide.housing = {
      ...guide.housing,
      ...(enriched.housing.overview && { overview: enriched.housing.overview }),
      ...(enriched.housing.neighborhoodGuide && { neighborhoodGuide: enriched.housing.neighborhoodGuide }),
      ...(enriched.housing.rentalProcess && { rentalProcess: enriched.housing.rentalProcess }),
    }
  }

  // Banking
  if (enriched.banking) {
    guide.banking = {
      ...guide.banking,
      ...(enriched.banking.overview && { overview: enriched.banking.overview }),
      ...(enriched.banking.accountOpeningGuide && { accountOpeningGuide: enriched.banking.accountOpeningGuide }),
    }
  }

  // Healthcare
  if (enriched.healthcare) {
    guide.healthcare = {
      ...guide.healthcare,
      ...(enriched.healthcare.overview && { overview: enriched.healthcare.overview }),
      ...(enriched.healthcare.registrationGuide && { registrationGuide: enriched.healthcare.registrationGuide }),
      ...(enriched.healthcare.insuranceAdvice && { insuranceAdvice: enriched.healthcare.insuranceAdvice }),
    }
  }

  // Culture
  if (enriched.culture) {
    guide.culture = {
      ...guide.culture,
      ...(enriched.culture.overview && { overview: enriched.culture.overview }),
      ...(enriched.culture.deepDive && { deepDive: enriched.culture.deepDive }),
      ...(enriched.culture.workplaceCulture && { workplaceCulture: enriched.culture.workplaceCulture }),
      ...(enriched.culture.socialIntegration && { socialIntegration: enriched.culture.socialIntegration }),
    }
  }

  // Jobs (optional)
  if (enriched.jobs && guide.jobs) {
    guide.jobs = {
      ...guide.jobs,
      ...(enriched.jobs.overview && { overview: enriched.jobs.overview }),
      ...(enriched.jobs.marketOverview && { marketOverview: enriched.jobs.marketOverview }),
      ...(enriched.jobs.salaryExpectations && { salaryExpectations: enriched.jobs.salaryExpectations }),
      ...(enriched.jobs.searchStrategy && { searchStrategy: enriched.jobs.searchStrategy }),
    }
  }

  // Education (optional)
  if (enriched.education && guide.education) {
    guide.education = {
      ...guide.education,
      ...(enriched.education.systemOverview && { systemOverview: enriched.education.systemOverview }),
      ...(enriched.education.applicationStrategy && { applicationStrategy: enriched.education.applicationStrategy }),
    }
  }

  // Timeline
  if (enriched.timeline?.overview) {
    guide.timeline = {
      ...guide.timeline,
      overview: enriched.timeline.overview,
    }
  }

  // Practical tips — replace generic tips with enriched ones
  if (enriched.practicalTips?.length > 0) {
    guide.usefulTips = enriched.practicalTips
  }

  return guide
}
