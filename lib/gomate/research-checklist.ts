import type { SupabaseClient } from "@supabase/supabase-js"
import { generateChecklistFromPlan, type GeneratedChecklist } from "./checklist-generator"

type ServiceResult<T> =
  | { ok: true; status: 200; body: T }
  | { ok: false; status: number; body: { error: string } }

export interface ChecklistResearchMeta {
  status: "completed" | "failed"
  isFallback: boolean
  itemCount: number
  hadVisaResearch: boolean
}

export async function performChecklistResearch(
  supabase: SupabaseClient,
  userId: string,
  planId?: string
): Promise<ServiceResult<{ success: true; checklist: GeneratedChecklist; planId: string; meta: ChecklistResearchMeta }>> {
  try {
    let query = supabase
      .from("relocation_plans")
      .select("id, profile_data, visa_research, local_requirements_research")
      .eq("user_id", userId)

    if (planId) {
      query = query.eq("id", planId)
    } else {
      query = query.eq("is_current", true)
    }

    const { data: plan, error: planError } = await query.maybeSingle()
    if (planError || !plan) {
      return { ok: false, status: 404, body: { error: "Plan not found" } }
    }

    const profileData = plan.profile_data as Record<string, unknown> | null
    if (!profileData || !profileData.destination) {
      return {
        ok: false,
        status: 400,
        body: { error: "Please complete your profile first" },
      }
    }

    // B2-004/B2-012: Pass visa_research as canonical downstream input
    const checklist = await generateChecklistFromPlan({
      profile_data: profileData,
      visa_research: plan.visa_research as
        | { visaOptions?: Array<{ name: string; type: string; selected?: boolean }> }
        | undefined,
    })

    const { error: updateError } = await supabase
      .from("relocation_plans")
      .update({
        checklist_items: checklist,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id)
      .eq("user_id", userId)

    if (updateError) {
      console.error("[ChecklistAPI] Failed to save checklist:", updateError)
      return { ok: false, status: 500, body: { error: "Failed to save checklist" } }
    }

    // B2-002/B2-007: Return quality metadata for upstream status tracking
    const meta: ChecklistResearchMeta = {
      status: "completed",
      isFallback: checklist.isFallback,
      itemCount: checklist.items.length,
      hadVisaResearch: checklist.generatorInputs.hadVisaResearch,
    }

    return {
      ok: true,
      status: 200,
      body: {
        success: true,
        checklist,
        planId: plan.id,
        meta,
      },
    }
  } catch (error) {
    console.error("[ChecklistAPI] Error generating checklist:", error)
    return {
      ok: false,
      status: 500,
      body: { error: "Failed to generate checklist" },
    }
  }
}
