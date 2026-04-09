/**
 * Tax Research API Endpoint
 *
 * POST — Run Firecrawl + AI tax research for the user's plan destination.
 * GET  — Retrieve stored tax research from relocation_plans.tax_research.
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { performTaxResearch } from "@/lib/gomate/tax-research"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tier = await getUserTier(user.id)
    if (!hasFeatureAccess(tier, "tax_overview")) {
      return NextResponse.json({ error: "Tax research requires a paid plan" }, { status: 403 })
    }

    const body = await request.json()
    if (!body.planId) {
      return NextResponse.json({ error: "Plan ID required" }, { status: 400 })
    }

    const result = await performTaxResearch(supabase, body.planId, user.id)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("[GoMate] Tax research error:", error)
    return NextResponse.json(
      { error: "Failed to perform tax research" },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tier = await getUserTier(user.id)
    if (!hasFeatureAccess(tier, "tax_overview")) {
      return NextResponse.json({ error: "Tax research requires a paid plan" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const planId = searchParams.get("planId")

    if (!planId) {
      return NextResponse.json({ error: "Plan ID required" }, { status: 400 })
    }

    const { data: plan, error } = await supabase
      .from("relocation_plans")
      .select("tax_research")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single()

    if (error || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    return NextResponse.json({
      research: plan.tax_research,
      quality: plan.tax_research?.quality || null,
      researchedAt: plan.tax_research?.researchedAt || null,
    })
  } catch (error) {
    console.error("[GoMate] Get tax research error:", error)
    return NextResponse.json(
      { error: "Failed to retrieve tax research" },
      { status: 500 }
    )
  }
}
