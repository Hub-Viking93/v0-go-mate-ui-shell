import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"
import { COUNTRY_DATA } from "@/lib/gomate/guide-generator"
import { getAllSources } from "@/lib/gomate/official-sources"

const DIGITAL_BRIDGE_OPTIONS = [
  { name: "Wise", url: "https://wise.com", features: ["Multi-currency", "Low fees", "Fast setup"] },
  { name: "Revolut", url: "https://revolut.com", features: ["Multi-currency", "Free ATM withdrawals", "Fast setup"] },
  { name: "N26", url: "https://n26.com", features: ["EU-based", "Free account", "IBAN included"] },
]

// GET: Assemble banking wizard data from multiple sources
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "post_arrival_assistant")) {
    return NextResponse.json({ error: "Upgrade required" }, { status: 403 })
  }

  const { data: plan, error } = await supabase
    .from("relocation_plans")
    .select("id, profile_data, local_requirements_research")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (error || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  const profile = plan.profile_data as { destination?: string; target_city?: string } | null
  const destination = profile?.destination || ""
  const city = profile?.target_city || ""

  // Get guide banking_section if available
  const { data: guide } = await supabase
    .from("guides")
    .select("banking_section")
    .eq("plan_id", plan.id)
    .eq("is_current", true)
    .maybeSingle()

  const bankingSection = (guide?.banking_section || null) as {
    overview?: string
    recommendedBanks?: Array<{ name: string; type?: string; features?: string[]; url?: string }>
    requirements?: string[]
    digitalBanks?: Array<{ name: string; features?: string[] }>
    accountOpeningGuide?: string
    tips?: string[]
  } | null

  // Get COUNTRY_DATA banks
  const countryKey = destination.toUpperCase().replace(/\s+/g, "_")
  const countryData = COUNTRY_DATA[countryKey] || COUNTRY_DATA[destination] || null
  const popularBanks = countryData?.popularBanks || []
  const bankingNotes = countryData?.bankingNotes || ""

  // Get banking items from local_requirements_research
  const localReq = plan.local_requirements_research as {
    categories?: Array<{
      category: string
      items?: Array<{
        title: string
        steps?: string[]
        documents?: string[]
        estimatedTime?: string
        cost?: string
        officialLink?: string
        tips?: string[]
      }>
    }>
  } | null

  const bankingCategory = localReq?.categories?.find(
    (c) => c.category?.toLowerCase().includes("bank")
  )
  const bankingItems = bankingCategory?.items || []

  // Assemble banks — merge guide + COUNTRY_DATA, dedup by name
  const bankMap = new Map<string, { name: string; type: string; features: string[]; url?: string }>()
  for (const b of popularBanks) {
    bankMap.set(b.name, { name: b.name, type: b.type, features: b.features })
  }
  if (bankingSection?.recommendedBanks) {
    for (const b of bankingSection.recommendedBanks) {
      if (!bankMap.has(b.name)) {
        bankMap.set(b.name, { name: b.name, type: b.type || "traditional", features: b.features || [], url: b.url })
      } else {
        const existing = bankMap.get(b.name)!
        if (b.url) existing.url = b.url
      }
    }
  }

  // Assemble documents needed
  const documentsNeeded = new Set<string>()
  if (bankingSection?.requirements) {
    for (const r of bankingSection.requirements) documentsNeeded.add(r)
  }
  for (const item of bankingItems) {
    if (item.documents) {
      for (const d of item.documents) documentsNeeded.add(d)
    }
  }

  // Steps from local requirements
  const steps: string[] = []
  for (const item of bankingItems) {
    if (item.steps) steps.push(...item.steps)
  }
  if (steps.length === 0 && bankingSection?.accountOpeningGuide) {
    steps.push(bankingSection.accountOpeningGuide)
  }

  // Tips
  const tips: string[] = []
  if (bankingSection?.tips) tips.push(...bankingSection.tips)
  for (const item of bankingItems) {
    if (item.tips) tips.push(...item.tips)
  }

  // Official links
  const officialLinks: { name: string; url: string }[] = []
  const sources = getAllSources(destination)
  if (sources?.banking) {
    officialLinks.push({ name: "Financial Regulator", url: sources.banking })
  }
  for (const item of bankingItems) {
    if (item.officialLink) {
      officialLinks.push({ name: item.title, url: item.officialLink })
    }
  }

  // Estimated time from local requirements
  const estimatedTime = bankingItems[0]?.estimatedTime || null

  return NextResponse.json({
    planId: plan.id,
    destination,
    city,
    banks: Array.from(bankMap.values()),
    bankingNotes,
    steps,
    documentsNeeded: Array.from(documentsNeeded),
    digitalBridgeOptions: DIGITAL_BRIDGE_OPTIONS,
    officialLinks,
    tips,
    estimatedTime,
  })
}
