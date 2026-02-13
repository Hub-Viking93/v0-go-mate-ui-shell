import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Profile } from "@/lib/gomate/profile-schema"
import { generateGuideFromProfile } from "@/lib/gomate/guide-generator"

// GET - Fetch the current user's plan and profile
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Get the user's current plan (is_current = true)
    const { data: plan, error } = await supabase
      .from("relocation_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle()
    
    if (error) {
      console.error("[GoMate] Error fetching plan:", error)
      return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 })
    }
    
    // If no plan exists, create one
    if (!plan) {
      const { data: newPlan, error: createError } = await supabase
        .from("relocation_plans")
        .insert({
          user_id: user.id,
          profile_data: {},
          stage: "collecting",
          is_current: true,
        })
        .select()
        .single()
      
      if (createError) {
        console.error("[GoMate] Error creating plan:", createError)
        return NextResponse.json({ error: "Failed to create plan" }, { status: 500 })
      }
      
      return NextResponse.json({ plan: newPlan })
    }
    
    return NextResponse.json({ plan })
  } catch (error) {
    console.error("[GoMate] Error in GET /api/profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update the user's profile data
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { profileData, planId, action } = await req.json() as {
      profileData?: Partial<Profile>
      planId?: string
      action?: "lock" | "unlock"
    }
    
    // Get current plan (by specific ID or the active current plan)
    let query = supabase
      .from("relocation_plans")
      .select("*")
      .eq("user_id", user.id)
    
    if (planId) {
      query = query.eq("id", planId)
    } else {
      query = query.eq("is_current", true)
    }
    
    const { data: currentPlan, error: fetchError } = await query.maybeSingle()
    
    if (fetchError || !currentPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }
    
    // Handle lock/unlock actions
    if (action === "lock") {
      const { data: lockedPlan, error: lockError } = await supabase
        .from("relocation_plans")
        .update({
          locked: true,
          locked_at: new Date().toISOString(),
          stage: "complete",
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentPlan.id)
        .eq("user_id", user.id)
        .select()
        .single()
      
      if (lockError) {
        return NextResponse.json({ error: "Failed to lock plan" }, { status: 500 })
      }
      
      // Auto-generate a guide when plan is locked
      try {
        const profile = currentPlan.profile_data as Profile
        if (profile.destination) {
          // Check if guide already exists for this plan
          const { data: existingGuide } = await supabase
            .from("guides")
            .select("id")
            .eq("plan_id", currentPlan.id)
            .maybeSingle()
          
          if (!existingGuide) {
            const guideData = generateGuideFromProfile(profile)
            
            await supabase.from("guides").insert({
              user_id: user.id,
              plan_id: currentPlan.id,
              title: guideData.title,
              destination: guideData.destination,
              purpose: guideData.purpose,
              sections: guideData.sections,
            })
          }
        }
      } catch (guideError) {
        console.error("[GoMate] Error auto-generating guide:", guideError)
        // Don't fail the lock operation if guide generation fails
      }
      
      return NextResponse.json({ plan: lockedPlan })
    }
    
    if (action === "unlock") {
      const { data: unlockedPlan, error: unlockError } = await supabase
        .from("relocation_plans")
        .update({
          locked: false,
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentPlan.id)
        .eq("user_id", user.id)
        .select()
        .single()
      
      if (unlockError) {
        return NextResponse.json({ error: "Failed to unlock plan" }, { status: 500 })
      }
      return NextResponse.json({ plan: unlockedPlan })
    }
    
    // Check if plan is locked before allowing profile updates
    if (currentPlan.locked) {
      return NextResponse.json({ 
        error: "Plan is locked. Unlock it first to make changes.",
        locked: true 
      }, { status: 403 })
    }
    
    // Merge profile data
    const mergedProfile = {
      ...(currentPlan.profile_data || {}),
      ...profileData,
    }
    
    // Determine stage based on profile completeness
    const requiredFields = [
      "name", "citizenship", "current_location", "destination", "purpose",
      "sub_purpose", "duration", "timeline", "budget", "dependents",
      "language_skill", "work_eligibility", "education", "prior_visa", "special_needs"
    ]
    const filledCount = requiredFields.filter(f => mergedProfile[f]).length
    const isComplete = filledCount === requiredFields.length
    
    // Update plan
    const { data: updatedPlan, error: updateError } = await supabase
      .from("relocation_plans")
      .update({
        profile_data: mergedProfile,
        stage: isComplete ? "generating" : "collecting",
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentPlan.id)
      .eq("user_id", user.id)
      .select()
      .single()
    
    if (updateError) {
      console.error("[GoMate] Error updating plan:", updateError)
      return NextResponse.json({ error: "Failed to update plan" }, { status: 500 })
    }
    
    return NextResponse.json({ plan: updatedPlan })
  } catch (error) {
    console.error("[GoMate] Error in PATCH /api/profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
