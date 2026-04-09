import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { performVisaResearch } from "@/lib/gomate/research-visa"
import { performLocalRequirementsResearch } from "@/lib/gomate/research-local-requirements"
import { performChecklistResearch } from "@/lib/gomate/research-checklist"
import { checkUsageLimit, recordUsage } from "@/lib/gomate/usage-guard"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"

export const maxDuration = 60 // Allow longer timeout for research

/**
 * POST /api/research/trigger
 * Triggers visa, local requirements, and checklist research for a plan.
 * Called automatically after profile confirmation.
 *
 * B2-002: Computes honest per-artifact quality and stores research_meta.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tier = await getUserTier(user.id)
    if (!hasFeatureAccess(tier, "visa_recommendation")) {
      return NextResponse.json({ error: "Research requires a paid plan" }, { status: 403 })
    }

    const body = await request.json()
    const { planId } = body

    if (!planId) {
      return NextResponse.json({ error: "Plan ID required" }, { status: 400 })
    }

    // Verify the plan belongs to this user
    const { data: plan, error: planError } = await supabase
      .from("relocation_plans")
      .select("id, profile_data, research_status, locked, stage")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const researchEligible = Boolean(plan.locked) && (plan.stage === "complete" || plan.stage === "arrived")
    if (!researchEligible) {
      return NextResponse.json(
        { error: "Plan must be locked before research can run" },
        { status: 409 }
      )
    }

    // Skip if research is already in progress
    if (plan.research_status === "in_progress") {
      return NextResponse.json({
        message: "Research already in progress",
        status: "in_progress"
      })
    }

    // --- Usage guard: check generation limit before expensive research ---
    const usageCheck = await checkUsageLimit(user.id, "research")
    if (!usageCheck.allowed) {
      return NextResponse.json({
        error: usageCheck.reason,
        usage: { used: usageCheck.used, limit: usageCheck.limit },
      }, { status: 429 })
    }

    // Mark aggregate research as actively running before helper execution.
    await supabase
      .from("relocation_plans")
      .update({ research_status: "in_progress" })
      .eq("id", planId)
      .eq("user_id", user.id)

    // Trigger research in parallel via direct function calls.
    const researchPromises = [
      performVisaResearch(supabase, planId, user.id, false).catch(err => {
        console.error("[Research Trigger] Visa research failed:", err)
        return { ok: false as const, status: 500, body: { error: "Visa research failed" } }
      }),
      performLocalRequirementsResearch(supabase, planId, user.id, false, false).catch(err => {
        console.error("[Research Trigger] Local requirements research failed:", err)
        return { ok: false as const, status: 500, body: { error: "Local requirements research failed" } }
      }),
      performChecklistResearch(supabase, user.id, planId).catch(err => {
        console.error("[Research Trigger] Checklist research failed:", err)
        return { ok: false as const, status: 500, body: { error: "Checklist research failed" } }
      }),
    ]

    // Wait for all research to complete
    const results = await Promise.allSettled(researchPromises)

    // Check results
    const visaResult = results[0]
    const localResult = results[1]
    const checklistResult = results[2]

    const visaOk = visaResult.status === "fulfilled" && visaResult.value.ok
    const localOk = localResult.status === "fulfilled" && localResult.value.ok
    const checklistOk = checklistResult.status === "fulfilled" && checklistResult.value.ok

    const allSucceeded = visaOk && localOk && checklistOk
    const someSucceeded = visaOk || localOk || checklistOk

    // B2-002: Assess per-artifact quality for honest status reporting
    const visaQuality = visaOk && visaResult.status === "fulfilled" && visaResult.value.ok
      ? (visaResult.value.body as { research: { quality: string; visaOptions: unknown[] } }).research?.quality ?? "unknown"
      : "failed"
    const visaOptionCount = visaOk && visaResult.status === "fulfilled" && visaResult.value.ok
      ? (visaResult.value.body as { research: { visaOptions: unknown[] } }).research?.visaOptions?.length ?? 0
      : 0

    const checklistMeta = checklistOk && checklistResult.status === "fulfilled" && checklistResult.value.ok
      ? (checklistResult.value.body as { meta?: { isFallback: boolean; itemCount: number; hadVisaResearch: boolean } }).meta
      : null

    // B2-002: Compute honest aggregate status
    // "completed" = all succeeded with useful content
    // "partial" = some succeeded but quality is degraded (e.g., empty visa options, fallback checklist)
    // "failed" = nothing useful
    const hasDegradedQuality = visaQuality === "fallback" || visaOptionCount === 0 || checklistMeta?.isFallback
    let finalStatus: string
    if (allSucceeded && !hasDegradedQuality) {
      finalStatus = "completed"
    } else if (someSucceeded) {
      finalStatus = "partial"
    } else {
      finalStatus = "failed"
    }

    // B2-002: Store per-artifact metadata in research_meta
    const researchMeta = {
      visa: {
        status: visaOk ? "completed" : "failed",
        quality: visaQuality,
        optionCount: visaOptionCount,
      },
      localRequirements: {
        status: localOk ? "completed" : "failed",
      },
      checklist: {
        status: checklistOk ? "completed" : "failed",
        isFallback: checklistMeta?.isFallback ?? true,
        itemCount: checklistMeta?.itemCount ?? 0,
        hadVisaResearch: checklistMeta?.hadVisaResearch ?? false,
      },
    }

    const { error: finalUpdateError } = await supabase
      .from("relocation_plans")
      .update({
        research_status: finalStatus,
        research_completed_at: new Date().toISOString(),
        research_meta: researchMeta,
      })
      .eq("id", planId)
      .eq("user_id", user.id)

    if (finalUpdateError) {
      console.error("[Research Trigger] Failed to save final status:", finalUpdateError)
    }

    // Record usage on success or partial success (research ran, consumed API credits)
    if (finalStatus === "completed" || finalStatus === "partial") {
      await recordUsage(user.id, "research", planId, 10_000)
    }

    return NextResponse.json({
      message: finalStatus === "completed"
        ? "Research completed"
        : finalStatus === "partial"
          ? "Research completed with degraded quality"
          : "Research failed",
      status: finalStatus,
      results: {
        visa: visaOk,
        localRequirements: localOk,
        checklist: checklistOk,
      },
      meta: researchMeta,
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
 * Get the current research status for a plan.
 * B2-002: Returns per-artifact quality from research_meta.
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
      .select("research_status, research_completed_at, visa_research, local_requirements_research, research_meta")
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
      meta: plan.research_meta || null,
    })
  } catch (error) {
    console.error("[Research Trigger] GET Error:", error)
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 })
  }
}
