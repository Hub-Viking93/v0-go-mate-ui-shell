import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const maxDuration = 60 // Allow longer timeout for research

/**
 * POST /api/research/trigger
 * Triggers both visa and local requirements research for a plan
 * Called automatically after profile confirmation
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { planId } = body

    if (!planId) {
      return NextResponse.json({ error: "Plan ID required" }, { status: 400 })
    }

    // Verify the plan belongs to this user
    const { data: plan, error: planError } = await supabase
      .from("relocation_plans")
      .select("id, profile_data, research_status")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Skip if research is already in progress
    if (plan.research_status === "in_progress") {
      return NextResponse.json({ 
        message: "Research already in progress",
        status: "in_progress" 
      })
    }

    // Update status to pending
    await supabase
      .from("relocation_plans")
      .update({ research_status: "pending" })
      .eq("id", planId)

    // Get the base URL for internal API calls
    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || ""

    // Trigger research in parallel (non-blocking)
    // We'll use Promise.allSettled to handle partial failures gracefully
    const researchPromises = [
      // Visa research
      fetch(`${baseUrl}/api/research/visa`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": request.headers.get("cookie") || "",
        },
        body: JSON.stringify({ planId }),
      }).catch(err => {
        console.error("[Research Trigger] Visa research failed:", err)
        return { ok: false, error: err }
      }),
      
      // Local requirements research
      fetch(`${baseUrl}/api/research/local-requirements`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": request.headers.get("cookie") || "",
        },
        body: JSON.stringify({ planId }),
      }).catch(err => {
        console.error("[Research Trigger] Local requirements research failed:", err)
        return { ok: false, error: err }
      }),
      
      // Checklist research
      fetch(`${baseUrl}/api/research/checklist`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": request.headers.get("cookie") || "",
        },
        body: JSON.stringify({ planId }),
      }).catch(err => {
        console.error("[Research Trigger] Checklist research failed:", err)
        return { ok: false, error: err }
      }),
    ]

    // Wait for all research to complete
    const results = await Promise.allSettled(researchPromises)
    
    // Check results
    const visaResult = results[0]
    const localResult = results[1]
    const checklistResult = results[2]
    
    const allSucceeded = results.every(r => 
      r.status === "fulfilled" && (r.value as Response)?.ok
    )
    const someSucceeded = results.some(r => 
      r.status === "fulfilled" && (r.value as Response)?.ok
    )

    // Update final status
    const finalStatus = allSucceeded ? "completed" : someSucceeded ? "completed" : "failed"
    
    await supabase
      .from("relocation_plans")
      .update({ 
        research_status: finalStatus,
        research_completed_at: new Date().toISOString()
      })
      .eq("id", planId)

    return NextResponse.json({
      message: "Research completed",
      status: finalStatus,
      results: {
        visa: visaResult.status === "fulfilled" && (visaResult.value as Response)?.ok,
        localRequirements: localResult.status === "fulfilled" && (localResult.value as Response)?.ok,
        checklist: checklistResult.status === "fulfilled" && (checklistResult.value as Response)?.ok,
      }
    })
  } catch (error) {
    console.error("[Research Trigger] Error:", error)
    return NextResponse.json(
      { error: "Failed to trigger research" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/research/trigger
 * Get the current research status for a plan
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: plan } = await supabase
      .from("relocation_plans")
      .select("research_status, research_completed_at, visa_research, local_requirements_research")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json({ status: null })
    }

    return NextResponse.json({
      status: plan.research_status,
      completedAt: plan.research_completed_at,
      hasVisaResearch: !!plan.visa_research,
      hasLocalRequirements: !!plan.local_requirements_research,
    })
  } catch (error) {
    console.error("[Research Trigger] GET Error:", error)
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 })
  }
}
