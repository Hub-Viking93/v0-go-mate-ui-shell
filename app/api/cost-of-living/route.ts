import { NextResponse } from "next/server"
import { getCostOfLivingFromNumbeo, compareCostOfLiving, getGenericFallbackData } from "@/lib/gomate/numbeo-scraper"
import { createClient } from "@/lib/supabase/server"
import { derivePlanAuthority, getOwnedPlan } from "@/lib/gomate/core-state"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "cost_of_living")) {
    return NextResponse.json({ error: "Cost of living analysis requires a paid plan" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const country = searchParams.get("country")
  const city = searchParams.get("city")
  const compareFrom = searchParams.get("compareFrom")
  const compareFromCountry = searchParams.get("compareFromCountry")

  if (!country) {
    return NextResponse.json(
      { error: "Country parameter is required" },
      { status: 400 }
    )
  }

  // True only when the value really came from a live Numbeo scrape. LLM
  // estimates and generic fallbacks both flip this to true so the UI's
  // "Estimated" badge fires.
  const isLive = (d: { source?: string } | null | undefined) =>
    typeof d?.source === "string" && d.source.toLowerCase().includes("numbeo")

  try {
    // If comparison is requested
    if (compareFrom && compareFromCountry) {
      const comparison = await compareCostOfLiving(
        compareFrom,
        compareFromCountry,
        city || country,
        country
      )
      const fromOut = comparison.from || getGenericFallbackData(compareFrom, compareFromCountry)
      const toOut = comparison.to || getGenericFallbackData(city || country, country)
      const isFallback =
        !comparison.from || !comparison.to || !isLive(fromOut) || !isLive(toOut)
      return NextResponse.json({
        ...comparison,
        from: fromOut,
        to: toOut,
        isFallback,
      })
    }

    // Single location lookup
    const data = await getCostOfLivingFromNumbeo(country, city || undefined)

    if (!data) {
      const fallbackData = getGenericFallbackData(city || country, country)
      return NextResponse.json({ ...fallbackData, isFallback: true })
    }

    return NextResponse.json({ ...data, isFallback: !isLive(data) })
  } catch (error) {
    console.error("[GoMate] Cost of living API error:", error)
    const fallbackData = getGenericFallbackData(city || country, country)
    return NextResponse.json({ ...fallbackData, isFallback: true, error: "Using estimated data" })
  }
}

// POST endpoint to save user's cost of living preferences
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "cost_of_living")) {
    return NextResponse.json({ error: "Cost of living requires a paid plan" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { lifestyleLevel, includeItems, expectedVersion } = body

    const { data: plan } = await getOwnedPlan(supabase, user.id, {
      select: "id, profile_data, status, stage, locked, plan_version",
    })

    if (!plan) {
      return NextResponse.json({ error: "No plan found" }, { status: 404 })
    }

    const currentVersion = (plan.plan_version as number) || 1
    if (typeof expectedVersion !== "number") {
      return NextResponse.json(
        { error: "expectedVersion is required for profile state changes.", currentVersion },
        { status: 409 }
      )
    }

    if (expectedVersion !== currentVersion) {
      return NextResponse.json(
        { error: "Version conflict. Reload and retry.", currentVersion },
        { status: 409 }
      )
    }

    const authority = derivePlanAuthority(plan)
    if (!authority.canEditProfile) {
      return NextResponse.json(
        { error: "Plan is locked. Unlock it first to make changes." },
        { status: 403 }
      )
    }

    // Update profile with cost preferences
    const updatedProfile = {
      ...plan.profile_data,
      cost_preferences: {
        lifestyleLevel, // "minimum" | "comfortable" | "luxury"
        includeItems, // { gym: boolean, entertainment: boolean, etc. }
      },
    }

    const nextAuthority = derivePlanAuthority({
      ...plan,
      profile_data: updatedProfile,
    })

    const { data: updatedPlan, error } = await supabase
      .from("relocation_plans")
      .update({
        profile_data: updatedProfile,
        stage: nextAuthority.stage,
        plan_version: currentVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id)
      .eq("plan_version", currentVersion)
      .select("id")
      .maybeSingle()

    if (!updatedPlan) {
      return NextResponse.json(
        { error: "Version conflict. Reload and retry.", currentVersion },
        { status: 409 }
      )
    }

    if (error) {
      return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 })
    }

    return NextResponse.json({ success: true, planVersion: currentVersion + 1 })
  } catch (error) {
    console.error("[GoMate] Cost preferences save error:", error)
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    )
  }
}
