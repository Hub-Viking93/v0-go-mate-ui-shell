/**
 * Visa Research API Endpoint
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { performVisaResearch } from "@/lib/gomate/research-visa"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"

function normalizeVisaResearch(raw: any): any {
  if (!raw) return raw
  const eligMap: Record<string, string> = {
    likely_eligible: "high",
    possibly_eligible: "medium",
    unlikely_eligible: "low",
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
    if (!hasFeatureAccess(tier, "visa_recommendation")) {
      return NextResponse.json({ error: "Visa research requires a paid plan" }, { status: 403 })
    }

    const body = await request.json()
    const result = await performVisaResearch(supabase, body.planId, user.id)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("[GoMate] Visa research error:", error)
    return NextResponse.json(
      { error: "Failed to perform visa research" },
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

    const normalized = normalizeVisaResearch(plan.visa_research)
    return NextResponse.json({
      research: normalized,
      visaResearch: normalized,
      status: plan.research_status,
      completedAt: plan.research_completed_at,
      quality: normalized?.quality || null,
    })
  } catch (error) {
    console.error("[GoMate] Get visa research error:", error)
    return NextResponse.json(
      { error: "Failed to retrieve visa research" },
      { status: 500 }
    )
  }
}
