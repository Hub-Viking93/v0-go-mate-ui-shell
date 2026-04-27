/**
 * LLM-cached cost-of-living estimator.
 *
 * Replaces the placeholder generic-fallback values in numbeo-scraper.ts that
 * tagged USD-magnitude defaults (1200 rent, 150 utilities, …) with whatever
 * local currency the country resolved to — producing nonsense numbers for
 * non-USD destinations (Lahore reported 1200 PKR ≈ $4, Tokyo 1200 JPY ≈ $8).
 *
 * Lookup order:
 *   1. Cached estimate in cost_of_living_estimates (≤ 90 days old).
 *   2. Generate via LLM (Claude Sonnet 4 via OpenRouter), cache it, return.
 *   3. If the LLM is unreachable, return null — callers should treat that as
 *      "no data" and surface an honest "Cost-of-living unavailable" UI state
 *      rather than show wrong numbers.
 */

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import type { NumbeoData } from "./numbeo-scraper"
import { getCurrencyFromCountry } from "./currency"

const OPENROUTER_API_KEY = process.env.OPENAI_API_KEY
const OPENROUTER_BASE_URL = process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1"

const openrouter = createOpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
  headers: {
    "HTTP-Referer": "https://gomate.app",
    "X-Title": "GoMate Cost of Living Estimator",
  },
})

interface CachedEstimate {
  city: string
  country: string
  currency: string
  data: NumbeoData
  source: string
  generated_at: string
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false } })
}

async function readCache(city: string, country: string): Promise<CachedEstimate | null> {
  const sb = getServiceClient()
  if (!sb) return null
  const { data, error } = await sb
    .from("cost_of_living_estimates")
    .select("*")
    .ilike("city", city)
    .ilike("country", country)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  // Ignore stale entries; pretend cache miss so callers refetch.
  const ageMs = Date.now() - new Date(data.generated_at as string).getTime()
  if (ageMs > 90 * 24 * 60 * 60 * 1000) return null
  return data as CachedEstimate
}

async function writeCache(city: string, country: string, data: NumbeoData): Promise<void> {
  const sb = getServiceClient()
  if (!sb) return
  await sb
    .from("cost_of_living_estimates")
    .upsert(
      {
        city,
        country,
        currency: data.currency,
        data,
        source: "llm-estimate",
      },
      { onConflict: "city,country" }
    )
}

/**
 * Build the prompt the LLM uses to estimate cost-of-living.
 */
function buildPrompt(city: string, country: string, currency: string): string {
  return `Estimate typical 2024 cost-of-living values for ${city}, ${country}. Return values in ${currency} (the local currency). Be realistic and specific to this city — do not return USD defaults.

Return ONLY a single JSON object matching this schema. Numbers must be in ${currency} and reflect real ${city} prices in 2024.

{
  "rent": {
    "apartment1BedCity": <number>,
    "apartment1BedOutside": <number>,
    "apartment3BedCity": <number>,
    "apartment3BedOutside": <number>
  },
  "utilities": { "basic": <number>, "internet": <number>, "mobile": <number> },
  "food": {
    "mealInexpensive": <number>,
    "mealMidRange": <number>,
    "mcMeal": <number>,
    "domesticBeer": <number>,
    "importedBeer": <number>,
    "cappuccino": <number>,
    "water1_5L": <number>,
    "milk1L": <number>,
    "bread": <number>,
    "eggs12": <number>,
    "chicken1kg": <number>,
    "rice1kg": <number>,
    "apples1kg": <number>
  },
  "transportation": {
    "monthlyPass": <number>,
    "oneWayTicket": <number>,
    "taxiStart": <number>,
    "taxi1km": <number>,
    "gasolinePerLiter": <number>
  },
  "healthcare": { "doctorVisit": <number>, "dentistVisit": <number> },
  "fitness": { "gymMonthly": <number>, "cinemaTicket": <number> },
  "childcare": { "preschoolMonthly": <number>, "primarySchoolYearly": <number> },
  "clothing": { "jeans": <number>, "summerDress": <number>, "runningShoes": <number>, "businessShoes": <number> },
  "costOfLivingIndex": <number 0-200, NYC=100>,
  "rentIndex": <number 0-200>,
  "groceriesIndex": <number 0-200>,
  "restaurantPriceIndex": <number 0-200>,
  "purchasingPowerIndex": <number 0-200>,
  "estimatedMonthlyBudget": {
    "single": { "minimum": <number>, "comfortable": <number> },
    "couple": { "minimum": <number>, "comfortable": <number> },
    "family4": { "minimum": <number>, "comfortable": <number> }
  }
}

CRITICAL: All monetary values must be in ${currency}, denominated as a real ${city} resident would experience. For example, a Tokyo 1-bedroom in the city centre is roughly 150,000–200,000 JPY/month — not 1,200 JPY. A São Paulo 1-bedroom in the city centre is roughly 3,500–5,500 BRL — not 1,200 BRL.

Return ONLY the JSON object — no prose, no markdown fences.`
}

/**
 * Resolve the cost-of-living for a city + country.
 *
 * Returns NumbeoData with realistic local-currency values. Null if the LLM
 * call cannot be made (no API key, transient failure) — callers must treat
 * null as "no data" rather than substitute placeholders.
 */
export async function estimateCostOfLiving(city: string, country: string): Promise<NumbeoData | null> {
  const safeCity = (city || "").trim() || "Unknown City"
  const safeCountry = (country || "").trim() || "Unknown Country"

  // 1. Cache hit
  const cached = await readCache(safeCity, safeCountry).catch(() => null)
  if (cached?.data) {
    return {
      ...cached.data,
      city: safeCity,
      country: safeCountry,
      source: `LLM estimate · cached ${new Date(cached.generated_at).toISOString().split("T")[0]}`,
      lastUpdated: cached.generated_at.split("T")[0],
    }
  }

  // 2. LLM generation
  if (!OPENROUTER_API_KEY) return null
  const currency = getCurrencyFromCountry(safeCountry) || "USD"
  const prompt = buildPrompt(safeCity, safeCountry, currency)

  let llmText: string | null = null
  try {
    const result = await Promise.race([
      generateText({
        model: openrouter("anthropic/claude-sonnet-4"),
        prompt,
        maxOutputTokens: 1500,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("col-llm-timeout-25s")), 25_000)
      ),
    ])
    llmText = result.text
  } catch (err) {
    console.warn("[CostOfLivingEstimator] LLM call failed for", safeCity, safeCountry, err instanceof Error ? err.message : err)
    return null
  }

  // Strip any markdown fences just in case
  const jsonText = llmText.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  let parsed: Partial<NumbeoData>
  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    console.warn("[CostOfLivingEstimator] LLM response was not valid JSON; first 200 chars:", jsonText.slice(0, 200))
    return null
  }

  if (!parsed.rent || typeof parsed.rent.apartment1BedCity !== "number") {
    console.warn("[CostOfLivingEstimator] LLM response missing required fields", safeCity, safeCountry)
    return null
  }

  const today = new Date().toISOString().split("T")[0]
  const estimate: NumbeoData = {
    city: safeCity,
    country: safeCountry,
    currency,
    rent: parsed.rent,
    utilities: parsed.utilities ?? { basic: 0, internet: 0, mobile: 0 },
    food: parsed.food ?? {
      mealInexpensive: 0, mealMidRange: 0, mcMeal: 0, domesticBeer: 0, importedBeer: 0,
      cappuccino: 0, water1_5L: 0, milk1L: 0, bread: 0, eggs12: 0, chicken1kg: 0, rice1kg: 0, apples1kg: 0,
    },
    transportation: parsed.transportation ?? { monthlyPass: 0, oneWayTicket: 0, taxiStart: 0, taxi1km: 0, gasolinePerLiter: 0 },
    healthcare: parsed.healthcare ?? { doctorVisit: 0, dentistVisit: 0 },
    fitness: parsed.fitness ?? { gymMonthly: 0, cinemaTicket: 0 },
    childcare: parsed.childcare ?? { preschoolMonthly: 0, primarySchoolYearly: 0 },
    clothing: parsed.clothing ?? { jeans: 0, summerDress: 0, runningShoes: 0, businessShoes: 0 },
    costOfLivingIndex: parsed.costOfLivingIndex ?? 0,
    rentIndex: parsed.rentIndex ?? 0,
    groceriesIndex: parsed.groceriesIndex ?? 0,
    restaurantPriceIndex: parsed.restaurantPriceIndex ?? 0,
    purchasingPowerIndex: parsed.purchasingPowerIndex ?? 0,
    estimatedMonthlyBudget: parsed.estimatedMonthlyBudget ?? {
      single: { minimum: 0, comfortable: 0 },
      couple: { minimum: 0, comfortable: 0 },
      family4: { minimum: 0, comfortable: 0 },
    },
    source: "LLM estimate · fresh",
    lastUpdated: today,
  }

  // 3. Cache for 90 days
  void writeCache(safeCity, safeCountry, estimate).catch((err) => {
    console.warn("[CostOfLivingEstimator] Cache write failed:", err instanceof Error ? err.message : err)
  })

  return estimate
}
