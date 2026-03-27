import { createClient } from "@/lib/supabase/server"
import type { Profile } from "./profile-schema"
import { derivePlanAuthority } from "./core-state"

// Save profile data to Supabase
export async function saveProfileToSupabase(profile: Partial<Profile>): Promise<boolean> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log("[GoMate] No authenticated user, skipping profile save")
      return false
    }
    
    const { data: existingPlan } = await supabase
      .from("relocation_plans")
      .select("id, profile_data, title, status, stage, locked, plan_version")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle()
    
    if (existingPlan) {
      const currentAuthority = derivePlanAuthority(existingPlan)
      if (!currentAuthority.canEditProfile) {
        return false
      }

      // Update existing plan with merged profile
      const mergedProfile = {
        ...(existingPlan.profile_data || {}),
        ...profile,
      }
      const nextAuthority = derivePlanAuthority({
        ...existingPlan,
        profile_data: mergedProfile,
      })
      
      // Auto-generate title when destination/purpose are first set
      const updateData: Record<string, unknown> = {
        profile_data: mergedProfile,
        stage: nextAuthority.stage,
        plan_version: ((existingPlan.plan_version as number) || 1) + 1,
        updated_at: new Date().toISOString(),
      }

      const hasAutoTitle =
        !existingPlan.title || existingPlan.title.startsWith("Plan ")
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
        .eq("plan_version", (existingPlan.plan_version as number) || 1)
      
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
          plan_version: 1,
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
