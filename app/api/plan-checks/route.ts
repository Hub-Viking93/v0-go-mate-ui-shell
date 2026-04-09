import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"
import { getOwnedPlan } from "@/lib/gomate/core-state"
import { validatePlanConsistency } from "@/lib/gomate/plan-consistency"
import { COUNTRY_DATA } from "@/lib/gomate/guide-generator"
import { getGenericFallbackData } from "@/lib/gomate/numbeo-scraper"
import type { Profile } from "@/lib/gomate/profile-schema"

const EU_COUNTRY_CODES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
  "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
])

function getCitizenshipCategory(citizenship: string): string {
  return EU_COUNTRY_CODES.has(citizenship.toUpperCase()) ? "eu_citizen" : "non_eu"
}

const GENERIC_FORGOTTEN_ITEMS = [
  { item: "Deregister from your home country", why: "Many countries require formal deregistration. Failing to do so can cause tax residency complications and double taxation.", when: "before_move" as const, applies_to: null, lastVerified: "2026-03-01" },
  { item: "Check for insurance gaps during transit", why: "Your home country insurance may end before your destination coverage starts. Ensure continuous coverage during the transition period.", when: "before_move" as const, applies_to: null, lastVerified: "2026-03-01" },
  { item: "Save emergency numbers for your destination", why: "Know the local emergency numbers (police, ambulance, fire) before you arrive. They differ by country.", when: "first_week" as const, applies_to: null, lastVerified: "2026-03-01" },
  { item: "Get a local SIM card or eSIM", why: "A local phone number is essential for banking, deliveries, and communication. Many services require a local number for verification.", when: "first_week" as const, applies_to: null, lastVerified: "2026-03-01" },
  { item: "Learn 10 essential phrases in the local language", why: "Basic phrases (hello, thank you, excuse me, where is...) make daily interactions smoother and show respect for local culture.", when: "first_month" as const, applies_to: null, lastVerified: "2026-03-01" },
]

type ForgottenItem = {
  item: string
  why: string
  when: "before_move" | "first_week" | "first_month" | "ongoing"
  applies_to?: string[] | null
  lastVerified: string
}

function getForgottenItems(
  destination: string | undefined,
  citizenship: string | undefined,
  tier: string,
): ForgottenItem[] {
  if (!destination) return GENERIC_FORGOTTEN_ITEMS

  const countryKey = Object.keys(COUNTRY_DATA).find(
    (k) => k.toLowerCase() === destination.toLowerCase(),
  )

  // Free tier gets generic list only
  if (tier === "free" || !countryKey) {
    return GENERIC_FORGOTTEN_ITEMS
  }

  const countryItems = COUNTRY_DATA[countryKey].commonlyForgotten
  if (!countryItems || countryItems.length === 0) {
    return GENERIC_FORGOTTEN_ITEMS
  }

  // Filter by citizenship category
  const citizenCategory = citizenship ? getCitizenshipCategory(citizenship) : null

  return countryItems.filter((item) => {
    if (!item.applies_to || item.applies_to.length === 0) return true
    if (!citizenCategory) return true
    return item.applies_to.includes(citizenCategory)
  })
}

// GET /api/plan-checks — returns consistency warnings + forgotten items
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)

  // @ts-expect-error -- Supabase deep type instantiation (same as cost-of-living/route.ts)
  const { data: plan, error: planError } = await getOwnedPlan(supabase, user.id)
  if (planError || !plan) {
    return NextResponse.json({ error: "No plan found" }, { status: 404 })
  }

  const profile = (plan.profile_data as Profile | null) || null

  // Consistency warnings: pro_single+ only
  let warnings: ReturnType<typeof validatePlanConsistency> = []
  if (hasFeatureAccess(tier, "plan_consistency")) {
    // Get Numbeo data for budget checks
    const destination = profile?.destination || undefined
    const city = profile?.target_city || undefined
    const numbeoData = destination
      ? getGenericFallbackData(city, destination)
      : null

    // Get settling-in tasks for dependency checks
    const { data: tasks } = await supabase
      .from("settling_in_tasks")
      .select("id, status, blocked_by, title")
      .eq("plan_id", plan.id as string)

    warnings = validatePlanConsistency({
      profile_data: profile as Record<string, unknown> | undefined,
      stage: plan.stage as string,
      visa_research: plan.visa_research as Record<string, unknown> | null,
      numbeo_data: numbeoData as { estimatedMonthlyBudget?: { single?: { minimum?: number; comfortable?: number } } } | null,
      document_statuses: plan.document_statuses as Record<string, { status?: string; expiryDate?: string }> | null,
      checklist_items: plan.checklist_items as { categories?: Array<{ items?: Array<{ id?: string; priority?: string; required?: boolean }> }> } | null,
      settling_in_tasks: (tasks || []).map((t) => ({
        id: t.id,
        status: t.status,
        blocked_by: t.blocked_by as string[] | null,
        title: t.title,
      })),
    })
  }

  // Forgotten items: all tiers (free = generic only)
  const forgottenItems = getForgottenItems(
    profile?.destination || undefined,
    profile?.citizenship || undefined,
    tier,
  )

  return NextResponse.json({
    warnings,
    forgottenItems,
    checkedAt: new Date().toISOString(),
  })
}
