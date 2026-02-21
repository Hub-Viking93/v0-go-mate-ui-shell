import { createClient } from "@/lib/supabase/server"
import type { Profile } from "./profile-schema"

// Save profile data to Supabase
export async function saveProfileToSupabase(profile: Partial<Profile>): Promise<boolean> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log("[GoMate] No authenticated user, skipping profile save")
      return false
    }
    
    // Get the user's current plan (is_current = true)
    const { data: existingPlan } = await supabase
      .from("relocation_plans")
      .select("id, profile_data")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle()
    
    if (existingPlan) {
      // Update existing plan with merged profile
      const mergedProfile = {
        ...(existingPlan.profile_data || {}),
        ...profile,
      }
      
      // Auto-generate title when destination/purpose are first set
      const updateData: Record<string, unknown> = {
        profile_data: mergedProfile,
        updated_at: new Date().toISOString(),
      }
      
      // Get current plan title to check if it needs auto-generation
      const { data: fullPlan } = await supabase
        .from("relocation_plans")
        .select("title")
        .eq("id", existingPlan.id)
        .single()
      
      const hasAutoTitle = !fullPlan?.title || fullPlan.title.startsWith("Plan ")
      const dest = mergedProfile.destination as string | undefined
      const purp = mergedProfile.purpose as string | undefined
      
      if (hasAutoTitle && dest) {
        if (purp) {
          const label = purp.charAt(0).toUpperCase() + purp.slice(1)
          updateData.title = `${label} in ${dest}`
        } else {
          updateData.title = `Move to ${dest}`
        }
      }
      
      const { error } = await supabase
        .from("relocation_plans")
        .update(updateData)
        .eq("id", existingPlan.id)
      
      if (error) {
        console.error("[GoMate] Failed to update profile:", error)
        return false
      }
      
      return true
    } else {
      // Create new plan and mark as current
      const { error } = await supabase
        .from("relocation_plans")
        .insert({
          user_id: user.id,
          profile_data: profile,
          stage: "collecting",
          is_current: true,
        })
      
      if (error) {
        console.error("[GoMate] Failed to create plan:", error)
        return false
      }
      
      return true
    }
  } catch (error) {
    console.error("[GoMate] Error saving profile:", error)
    return false
  }
}

// Load profile from Supabase
export async function loadProfileFromSupabase(): Promise<Profile | null> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    
    const { data: plan } = await supabase
      .from("relocation_plans")
      .select("profile_data")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle()
    
    return plan?.profile_data as Profile || null
  } catch {
    return null
  }
}
