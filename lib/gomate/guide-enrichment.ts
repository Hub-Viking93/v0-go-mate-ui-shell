/**
 * Guide Enrichment Service
 *
 * Uses LLM (Claude Sonnet 4 via OpenRouter) to generate deep, personalized
 * content for each guide section. The template skeleton from guide-generator.ts
 * provides structure and fallback; this layer adds rich prose.
 *
 * Architecture (v2 — per-section calls):
 *   1. Fetch web research via Firecrawl (optional, ~5s)
 *   2. For each guide section, build a focused prompt + small JSON schema
 *   3. Run sections in parallel batches (3 concurrent)
 *   4. Each section: LLM call → JSON parse → merge into skeleton
 *   5. On per-section failure → keep skeleton for that section only
 *   6. Partial enrichment is always better than total fallback
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

      return combined.slice(0, 3000)
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    console.log("[GoMate][Enrichment] Research fetch failed, proceeding without:", error instanceof Error ? error.message : error)
    return ""
  }
}

// ============================================================================
// PROFILE CONTEXT
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

  if (profile.job_offer) parts.push(`Has job offer: ${profile.job_offer}`)
  if (profile.job_field) parts.push(`Job field: ${profile.job_field}`)
  if (profile.employer_sponsorship) parts.push(`Employer sponsorship: ${profile.employer_sponsorship}`)
  if (profile.highly_skilled) parts.push(`Highly skilled: ${profile.highly_skilled}`)

  if (profile.study_type) parts.push(`Study type: ${profile.study_type}`)
  if (profile.study_field) parts.push(`Field of study: ${profile.study_field}`)

  if (profile.remote_income) parts.push(`Remote income: ${profile.remote_income}`)
  if (profile.monthly_income) parts.push(`Monthly income: ${profile.monthly_income}`)
  if (profile.income_source) parts.push(`Income source: ${profile.income_source}`)

  if (profile.moving_alone) parts.push(`Moving alone: ${profile.moving_alone}`)
  if (profile.spouse_joining) parts.push(`Spouse joining: ${profile.spouse_joining}`)
  if (profile.children_count) parts.push(`Number of children: ${profile.children_count}`)
  if (profile.children_ages) parts.push(`Children ages: ${profile.children_ages}`)
  if (profile.pets) parts.push(`Pets: ${profile.pets}`)

  if (profile.savings_available) parts.push(`Savings: ${profile.savings_available}`)
  if (profile.monthly_budget) parts.push(`Monthly budget: ${profile.monthly_budget}`)

  if (profile.education_level) parts.push(`Education: ${profile.education_level}`)
  if (profile.language_skill) parts.push(`Destination language level: ${profile.language_skill}`)
  if (profile.years_experience) parts.push(`Years of experience: ${profile.years_experience}`)

  if (profile.healthcare_needs) parts.push(`Healthcare needs: ${profile.healthcare_needs}`)
  if (profile.special_requirements) parts.push(`Special requirements: ${profile.special_requirements}`)

  if (profile.prior_visa) parts.push(`Prior visa: ${profile.prior_visa}`)
  if (profile.visa_rejections) parts.push(`Visa rejections: ${profile.visa_rejections}`)

  return parts.join("\n")
}

// ============================================================================
// PER-SECTION ENRICHMENT
// ============================================================================

interface SectionEnrichment {
  /** Section name for logging */
  name: string
  /** Build the section-specific prompt */
  buildPrompt: (ctx: EnrichmentContext) => string
  /** Merge parsed JSON result into guide. Returns modified guide. */
  merge: (guide: Guide, result: Record<string, unknown>) => Guide
  /** Max output tokens for this section */
  maxTokens: number
  /** Whether this section should be included (e.g. jobs only for work purpose) */
  shouldRun?: (ctx: EnrichmentContext) => boolean
}

interface EnrichmentContext {
  profile: Profile
  skeleton: Guide
  research: string
  destination: string
  city: string
  citizenship: string
  purpose: string
  purposeLabel: string
  profileContext: string
  familyNote: string
  dataNote: string
}

function buildSystemPrompt(ctx: EnrichmentContext): string {
  return `You are an expert relocation consultant writing a premium, deeply personalized relocation guide for someone ${ctx.purposeLabel} to ${ctx.destination}${ctx.city ? ` (specifically ${ctx.city})` : ""}.

## USER PROFILE
${ctx.profileContext}

## EXISTING GUIDE DATA
- Visa: ${ctx.skeleton.visa.recommendedVisa} (${ctx.skeleton.visa.visaType})
- Budget: ${ctx.skeleton.budget.monthlyBudget.minimum}-${ctx.skeleton.budget.monthlyBudget.comfortable}/month
- Housing platforms: ${ctx.skeleton.housing.rentalPlatforms.map(p => p.name).join(", ")}
- Banks: ${ctx.skeleton.banking.recommendedBanks.map(b => b.name).join(", ")}
- Healthcare system: ${ctx.skeleton.healthcare.systemType}
${ctx.skeleton.jobs ? `- Job platforms: ${ctx.skeleton.jobs.jobPlatforms.map(p => p.name).join(", ")}` : ""}

${ctx.dataNote}

## STYLE
Write rich, specific, actionable content. This is a premium guide — NOT generic tips. Be specific to ${ctx.destination}, specific to this user's situation (${ctx.citizenship} citizen, ${ctx.purposeLabel}${ctx.familyNote}), and include details only a local expert would know. Each paragraph: 3-5 sentences. Use concrete details: real neighborhood names, specific document names, real processes, approximate timelines. Write flowing prose — no bullet points.

Return ONLY valid JSON (no markdown, no code fences).`
}

const PURPOSE_LABELS: Record<string, string> = {
  study: "studying",
  work: "working",
  settle: "settling permanently",
  digital_nomad: "working remotely as a digital nomad",
  other: "relocating",
}

// --- Section definitions ---

const SECTIONS: SectionEnrichment[] = [
  {
    name: "overview",
    maxTokens: 3000,
    buildPrompt: (ctx) => `Generate the overview section.

Return JSON:
{
  "summary": "3-4 paragraphs providing a warm, informative introduction to relocating to ${ctx.destination}. Paint a picture of what life is actually like. Include practical reality checks alongside the exciting parts."
}`,
    merge: (guide, result) => {
      if (typeof result.summary === "string" && result.summary.length > 50) {
        guide.overview = { ...guide.overview, summary: result.summary }
      }
      return guide
    },
  },
  {
    name: "visa",
    maxTokens: 5000,
    buildPrompt: (ctx) => `Generate the visa section.

Return JSON:
{
  "detailedProcess": "3-4 paragraphs walking through the actual visa application process step by step. Include specific documents needed, where to apply, typical waiting times, and common pitfalls for ${ctx.citizenship} citizens.",
  "warnings": ["3-5 specific warnings or gotchas that apply to this user's situation"]
}`,
    merge: (guide, result) => {
      if (typeof result.detailedProcess === "string" && result.detailedProcess.length > 50) {
        guide.visa = { ...guide.visa, detailedProcess: result.detailedProcess }
      }
      if (Array.isArray(result.warnings) && result.warnings.length > 0) {
        guide.visa = { ...guide.visa, warnings: result.warnings as string[] }
      }
      return guide
    },
  },
  {
    name: "budget",
    maxTokens: 4000,
    buildPrompt: (ctx) => `Generate the budget section.

Return JSON:
{
  "overview": "2-3 paragraphs analyzing the real cost of living in ${ctx.destination}${ctx.city ? ` (${ctx.city})` : ""}. Go beyond numbers — explain what daily life actually costs, where money goes unexpectedly, how costs compare to other popular expat destinations, and money-saving strategies locals use.",
  "savingStrategy": "2-3 paragraphs with a personalized saving and financial strategy. Include tips on currency exchange, international transfers, tax optimization for ${ctx.purposeLabel}, and financial pitfalls to avoid."
}`,
    merge: (guide, result) => {
      if (typeof result.overview === "string" && result.overview.length > 50) {
        guide.budget = { ...guide.budget, costComparison: result.overview }
      }
      if (typeof result.savingStrategy === "string" && result.savingStrategy.length > 50) {
        guide.budget = { ...guide.budget, savingStrategy: result.savingStrategy }
      }
      return guide
    },
  },
  {
    name: "housing",
    maxTokens: 6000,
    buildPrompt: (ctx) => `Generate the housing section.

Return JSON:
{
  "overview": "3-4 paragraphs on the housing market reality. Include typical rental processes, what landlords expect, market conditions, and realistic timelines for finding housing.",
  "neighborhoodGuide": "3-4 paragraphs recommending specific areas${ctx.city ? ` in ${ctx.city}` : ""} based on the user's profile (${ctx.profile.special_requirements || "general preferences"}${ctx.familyNote}). Name real neighborhoods, describe their character, and give price indications.",
  "rentalProcess": "2-3 paragraphs on the step-by-step rental process. Required documents, typical deposits, lease terms, tenant rights, and things to watch out for."
}`,
    merge: (guide, result) => {
      if (typeof result.overview === "string" && result.overview.length > 50) {
        guide.housing = { ...guide.housing, overview: result.overview }
      }
      if (typeof result.neighborhoodGuide === "string" && result.neighborhoodGuide.length > 50) {
        guide.housing = { ...guide.housing, neighborhoodGuide: result.neighborhoodGuide }
      }
      if (typeof result.rentalProcess === "string" && result.rentalProcess.length > 50) {
        guide.housing = { ...guide.housing, rentalProcess: result.rentalProcess }
      }
      return guide
    },
  },
  {
    name: "banking",
    maxTokens: 3000,
    buildPrompt: (ctx) => `Generate the banking section.

Return JSON:
{
  "overview": "2-3 paragraphs on the banking landscape. How banking works for newcomers, what to expect, common frustrations and how to navigate them.",
  "accountOpeningGuide": "2-3 paragraphs with step-by-step instructions for opening a bank account as a newcomer. Include which documents to bring, which bank to start with given their situation, and typical timelines."
}`,
    merge: (guide, result) => {
      if (typeof result.overview === "string" && result.overview.length > 50) {
        guide.banking = { ...guide.banking, overview: result.overview }
      }
      if (typeof result.accountOpeningGuide === "string" && result.accountOpeningGuide.length > 50) {
        guide.banking = { ...guide.banking, accountOpeningGuide: result.accountOpeningGuide }
      }
      return guide
    },
  },
  {
    name: "healthcare",
    maxTokens: 4000,
    buildPrompt: (ctx) => `Generate the healthcare section.

Return JSON:
{
  "overview": "2-3 paragraphs explaining the healthcare system in practical terms. How it actually works day-to-day for an expat, not just the official description.",
  "registrationGuide": "2-3 paragraphs on how to register for healthcare, choose insurance, find a doctor, and handle prescriptions.",
  "insuranceAdvice": "1-2 paragraphs with specific insurance advice based on their situation${ctx.profile.healthcare_needs ? ` (they have noted: ${ctx.profile.healthcare_needs})` : ""}${ctx.profile.moving_alone === "no" ? " including family coverage" : ""}."
}`,
    merge: (guide, result) => {
      if (typeof result.overview === "string" && result.overview.length > 50) {
        guide.healthcare = { ...guide.healthcare, overview: result.overview }
      }
      if (typeof result.registrationGuide === "string" && result.registrationGuide.length > 50) {
        guide.healthcare = { ...guide.healthcare, registrationGuide: result.registrationGuide }
      }
      if (typeof result.insuranceAdvice === "string" && result.insuranceAdvice.length > 50) {
        guide.healthcare = { ...guide.healthcare, insuranceAdvice: result.insuranceAdvice }
      }
      return guide
    },
  },
  {
    name: "culture",
    maxTokens: 6000,
    buildPrompt: (ctx) => `Generate the culture section.

Return JSON:
{
  "overview": "2-3 paragraphs painting a vivid picture of daily life and culture in ${ctx.destination}. What makes this place unique, what the social fabric feels like, and how it differs from what most foreigners expect.",
  "deepDive": "3-4 paragraphs on cultural integration. Go beyond surface-level tips — explain the WHY behind cultural norms, how to actually build genuine connections, and what the adjustment curve looks like.",
  "workplaceCulture": "2-3 paragraphs on workplace culture${ctx.profile.job_field ? ` specifically in ${ctx.profile.job_field}` : ""}. Communication styles, hierarchy, work-life balance expectations, and how to navigate office politics as a foreigner.",
  "socialIntegration": "2-3 paragraphs on building a social life. Where to meet people, how friendships typically form in this culture, expat communities vs local integration, and realistic expectations."
}`,
    merge: (guide, result) => {
      if (typeof result.overview === "string" && result.overview.length > 50) {
        guide.culture = { ...guide.culture, overview: result.overview }
      }
      if (typeof result.deepDive === "string" && result.deepDive.length > 50) {
        guide.culture = { ...guide.culture, deepDive: result.deepDive }
      }
      if (typeof result.workplaceCulture === "string" && result.workplaceCulture.length > 50) {
        guide.culture = { ...guide.culture, workplaceCulture: result.workplaceCulture }
      }
      if (typeof result.socialIntegration === "string" && result.socialIntegration.length > 50) {
        guide.culture = { ...guide.culture, socialIntegration: result.socialIntegration }
      }
      return guide
    },
  },
  {
    name: "jobs",
    maxTokens: 5000,
    shouldRun: (ctx) => ctx.purpose === "work" || ctx.purpose === "digital_nomad",
    buildPrompt: (ctx) => `Generate the jobs/employment section.

Return JSON:
{
  "overview": "2-3 paragraphs giving a rich overview of the employment landscape in ${ctx.destination} for ${ctx.purpose === "digital_nomad" ? "digital nomads and remote workers" : "international workers"}. Include the current state of the market, what industries are thriving, and what it's actually like to work there.",
  "marketOverview": "2-3 paragraphs analyzing the job market in ${ctx.destination} for someone in ${ctx.profile.job_field || "their field"}. Include in-demand sectors, salary ranges where known, hiring culture, and realistic expectations.",
  "salaryExpectations": "1-2 paragraphs on typical salary ranges, tax implications, and how salaries compare to cost of living.",
  "searchStrategy": "2-3 paragraphs with a personalized job search strategy based on their profile. Include specific platforms, networking approaches, and timeline."
}`,
    merge: (guide, result) => {
      if (!guide.jobs) return guide
      if (typeof result.overview === "string" && result.overview.length > 50) {
        guide.jobs = { ...guide.jobs, overview: result.overview }
      }
      if (typeof result.marketOverview === "string" && result.marketOverview.length > 50) {
        guide.jobs = { ...guide.jobs, marketOverview: result.marketOverview }
      }
      if (typeof result.salaryExpectations === "string" && result.salaryExpectations.length > 50) {
        guide.jobs = { ...guide.jobs, salaryExpectations: result.salaryExpectations }
      }
      if (typeof result.searchStrategy === "string" && result.searchStrategy.length > 50) {
        guide.jobs = { ...guide.jobs, searchStrategy: result.searchStrategy }
      }
      return guide
    },
  },
  {
    name: "education",
    maxTokens: 4000,
    shouldRun: (ctx) => ctx.purpose === "study",
    buildPrompt: (ctx) => `Generate the education section.

Return JSON:
{
  "systemOverview": "2-3 paragraphs on the education system in ${ctx.destination}. How it works for international students, accreditation, teaching language, academic culture.",
  "applicationStrategy": "2-3 paragraphs on a personalized application strategy for ${ctx.profile.study_field || "their field"}. Include specific steps, deadlines, and tips."
}`,
    merge: (guide, result) => {
      if (!guide.education) return guide
      if (typeof result.systemOverview === "string" && result.systemOverview.length > 50) {
        guide.education = { ...guide.education, systemOverview: result.systemOverview }
      }
      if (typeof result.applicationStrategy === "string" && result.applicationStrategy.length > 50) {
        guide.education = { ...guide.education, applicationStrategy: result.applicationStrategy }
      }
      return guide
    },
  },
  {
    name: "timeline",
    maxTokens: 2000,
    buildPrompt: (ctx) => `Generate the timeline section.

Return JSON:
{
  "overview": "2-3 paragraphs providing a realistic timeline narrative for this relocation. What should happen when, typical bureaucratic delays to expect, and how to sequence the big tasks (housing, banking, registration, healthcare) most efficiently."
}`,
    merge: (guide, result) => {
      if (typeof result.overview === "string" && result.overview.length > 50) {
        guide.timeline = { ...guide.timeline, overview: result.overview }
      }
      return guide
    },
  },
  {
    name: "practicalTips",
    maxTokens: 3000,
    buildPrompt: (ctx) => `Generate practical tips for someone relocating to ${ctx.destination}.

Return JSON:
{
  "tips": ["10-15 highly specific, actionable tips that are unique to ${ctx.destination}. NOT generic advice like 'learn the language'. Instead: specific apps to download, bureaucratic shortcuts, things nobody tells you, money-saving tricks, etc."]
}`,
    merge: (guide, result) => {
      if (Array.isArray(result.tips) && result.tips.length > 0) {
        guide.usefulTips = result.tips as string[]
      }
      return guide
    },
  },
]

// ============================================================================
// JSON PARSING
// ============================================================================

/**
 * Repair common LLM JSON mistakes:
 * - Missing commas between properties (e.g. `"value"\n  "key"` → `"value",\n  "key"`)
 * - Trailing commas before closing braces/brackets
 */
function repairJson(text: string): string {
  // Fix missing comma between string value and next property key:
  // pattern: closing quote + whitespace + opening quote of next key
  // e.g.  ..."some text"\n  "nextKey":  →  ..."some text",\n  "nextKey":
  let repaired = text.replace(/(")\s*\n(\s*")/g, (match, q1, rest) => {
    // Only add comma if it looks like a property boundary (not inside an array of strings)
    return `${q1},\n${rest}`
  })

  // Fix missing comma after closing bracket/brace and next key:
  // e.g.  ...]\n  "nextKey":  →  ...],\n  "nextKey":
  repaired = repaired.replace(/([\]}])\s*\n(\s*")/g, "$1,\n$2")

  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,\s*([\]}])/g, "$1")

  return repaired
}

function parseJsonResponse(raw: string): Record<string, unknown> {
  let text = raw.trim()

  // Strip markdown code fences
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  // Extract via brace matching first (handles preamble text before JSON)
  const firstBrace = text.indexOf("{")
  if (firstBrace > 0) {
    let depth = 0
    let lastBrace = -1
    let inString = false
    let escape = false
    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i]
      if (escape) { escape = false; continue }
      if (ch === "\\") { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === "{") depth++
      else if (ch === "}") {
        depth--
        if (depth === 0) { lastBrace = i; break }
      }
    }
    if (lastBrace > 0) {
      text = text.slice(firstBrace, lastBrace + 1)
    }
  }

  // Try direct parse
  try {
    return JSON.parse(text)
  } catch {
    // Try with repairs
  }

  // Apply LLM JSON repairs and retry
  const repaired = repairJson(text)
  try {
    return JSON.parse(repaired)
  } catch (e) {
    throw new Error(`JSON parse failed after repair: ${e instanceof Error ? e.message : e}`)
  }
}

// ============================================================================
// SINGLE SECTION ENRICHMENT CALL
// ============================================================================

async function callLLMForSection(
  section: SectionEnrichment,
  ctx: EnrichmentContext
): Promise<Record<string, unknown>> {
  const systemPrompt = buildSystemPrompt(ctx)
  const sectionPrompt = section.buildPrompt(ctx)

  // 25s per-section cap. Combined with batch parallelism this keeps the
  // total enrichment time within ~50s even when sections are slow.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    const response = await generateText({
      model: openrouter("anthropic/claude-sonnet-4"),
      system: systemPrompt,
      prompt: sectionPrompt,
      maxOutputTokens: section.maxTokens,
      abortSignal: controller.signal,
    })
    clearTimeout(timeout)

    const parsed = parseJsonResponse(response.text)
    console.log(`[GoMate][Enrichment] ✓ ${section.name} (${response.text.length} chars, ${response.finishReason})`)
    return parsed
  } finally {
    clearTimeout(timeout)
  }
}

async function enrichSection(
  section: SectionEnrichment,
  ctx: EnrichmentContext
): Promise<{ name: string; result: Record<string, unknown> | null }> {
  // Single-attempt with the 25s per-call cap. The retry loop here used to add
  // up to 50s extra per section which compounded across batches; the
  // skeleton sections are already credible, so a failed enrichment quietly
  // falls back to the skeleton rather than holding up the user.
  try {
    const result = await callLLMForSection(section, ctx)
    return { name: section.name, result }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn(`[GoMate][Enrichment] ✗ ${section.name} failed (using skeleton):`, msg)
    return { name: section.name, result: null }
  }
}

// ============================================================================
// MAIN ENRICHMENT ORCHESTRATOR
// ============================================================================

/**
 * Run an array of promises in batches of `size`.
 */
async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  size: number
): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < tasks.length; i += size) {
    const batch = tasks.slice(i, i + size)
    const batchResults = await Promise.all(batch.map(fn => fn()))
    results.push(...batchResults)
  }
  return results
}

/**
 * Enrich a skeleton guide with LLM-generated content, section by section.
 * Each section runs independently — failed sections keep skeleton content.
 */
export async function enrichGuide(profile: Profile, skeleton: Guide): Promise<Guide> {
  const destination = profile.destination || "Unknown"

  // 1. Fetch web research (non-blocking)
  let research = ""
  try {
    research = await fetchGuideResearch(
      destination,
      profile.target_city,
      profile.purpose || "other",
      profile.citizenship
    )
    if (!research) {
      console.log("[GoMate][Enrichment] No web research available — proceeding with profile-only enrichment for:", destination)
    }
  } catch (researchError) {
    const msg = researchError instanceof Error ? researchError.message : String(researchError)
    console.warn("[GoMate][Enrichment] Research fetch failed, proceeding without:", msg)
  }

  // 2. Build shared context
  const purpose = profile.purpose || "other"
  const ctx: EnrichmentContext = {
    profile,
    skeleton,
    research,
    destination,
    city: profile.target_city || "",
    citizenship: profile.citizenship || "their home country",
    purpose,
    purposeLabel: PURPOSE_LABELS[purpose] || "relocating",
    profileContext: buildProfileContext(profile),
    familyNote: profile.moving_alone === "no" ? ", moving with family" : "",
    dataNote: research
      ? `## RECENT WEB RESEARCH (use to ground your advice in current data)\n${research}`
      : `## NOTE\nNo live web research was available. Use your training knowledge about ${destination} to provide accurate, specific guidance. Only state facts you are confident about. For numerical data (fees, processing times), indicate approximate ranges or say "verify with official sources" if unsure.`,
  }

  // 3. Filter sections to run
  const activeSections = SECTIONS.filter(s => !s.shouldRun || s.shouldRun(ctx))
  console.log(`[GoMate][Enrichment] Starting per-section enrichment for ${destination} — ${activeSections.length} sections`)

  // 4. Run in batches of 5 with an overall 90s budget. The batches mean we
  // don't hammer OpenRouter, but a stuck batch can't drag the whole guide
  // generation past a user-acceptable wait.
  const tasks = activeSections.map(section => () => enrichSection(section, ctx))
  const results = await Promise.race([
    runInBatches(tasks, 5),
    new Promise<{ name: string; result: Record<string, unknown> | null }[]>((resolve) =>
      setTimeout(() => {
        console.warn("[GoMate][Enrichment] Overall 90s budget hit — using skeleton sections for any unfinished enrichments")
        // Mark every section as failed so we fall back to skeleton for the rest
        resolve(activeSections.map((s) => ({ name: s.name, result: null })))
      }, 90_000)
    ),
  ])

  // 5. Merge successful results into skeleton
  let guide = { ...skeleton }
  let successCount = 0
  let failCount = 0

  for (const { name, result } of results) {
    if (result) {
      const section = activeSections.find(s => s.name === name)
      if (section) {
        guide = section.merge(guide, result)
        successCount++
      }
    } else {
      failCount++
    }
  }

  console.log(`[GoMate][Enrichment] Done — ${successCount}/${activeSections.length} sections enriched${failCount > 0 ? `, ${failCount} failed (kept skeleton)` : ""}`)
  return guide
}
