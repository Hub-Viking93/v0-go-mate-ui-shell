import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { performLocalRequirementsResearch } from "@/lib/gomate/research-local-requirements"

function normalizeLocalRequirements(raw: any): any {
  if (!raw) return raw
  if (Array.isArray(raw.categories)) {
    return {
      ...raw,
      categories: raw.categories.map((cat: any) => ({
        ...cat,
        category: cat.category || "Other",
        items: (cat.items || []).map((item: any) => ({
          title: item.title || item.name || "Untitled",
          description: item.description || "",
          steps: item.steps || [],
          documents: item.documents || item.requiredDocuments || [],
          estimatedTime: item.estimatedTime || "",
          cost: item.cost || "",
          officialLink: (item.officialLinks || [])[0] || item.officialLink || "",
          tips: item.tips || [],
        })),
      })),
    }
  }
  if (raw.categories && typeof raw.categories === "object") {
    const labelMap: Record<string, string> = {
      registration: "Registration",
      taxId: "Tax ID",
      healthcare: "Healthcare",
      banking: "Banking",
      driversLicense: "Driver's License",
      utilities: "Utilities",
      housing: "Housing",
      other: "Other",
    }
    return {
      ...raw,
      categories: Object.entries(raw.categories)
        .filter(([, items]) => Array.isArray(items) && (items as any[]).length > 0)
        .map(([key, items]) => ({
          category: labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1),
          items: (items as any[]).map((item: any) => ({
            title: item.title || item.name || "Untitled",
            description: item.description || "",
            steps: item.steps || [],
            documents: item.documents || item.requiredDocuments || [],
            estimatedTime: item.estimatedTime || "",
            cost: item.cost || "",
            officialLink: (item.officialLinks || [])[0] || item.officialLink || "",
            tips: item.tips || [],
          })),
        })),
    }
  }
  return raw
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

    const body = await request.json()
    const { planId, forceRefresh = false } = body
    const result = await performLocalRequirementsResearch(
      supabase,
      planId,
      user.id,
      forceRefresh
    )

    if (result.ok) {
      return NextResponse.json(
        {
          ...result.body,
          research: normalizeLocalRequirements(result.body.research),
        },
        { status: result.status }
      )
    }

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("[GoMate] Local requirements research error:", error)
    return NextResponse.json(
      { error: "Failed to perform local requirements research" },
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
      research: normalizeLocalRequirements(plan.local_requirements_research),
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
