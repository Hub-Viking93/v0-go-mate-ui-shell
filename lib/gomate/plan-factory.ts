"use server"

import { createClient } from "@/lib/supabase/server"
import type { Profile } from "./profile-schema"

export type PlanStage = "collecting" | "generating" | "complete"

export interface RelocationPlan {
  id: string
  user_id: string
  profile_data: Profile
  stage: PlanStage
  title: string | null
  status: "active" | "archived" | "completed"
  is_current: boolean
  visa_recommendations: any | null
  timeline: any | null
  budget_plan: any | null
  checklist: any | null
  created_at: string
  updated_at: string
}

// Get the current user's active plan
export async function getCurrentPlan(): Promise<RelocationPlan | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  // Try to find the current plan (is_current = true)
  const { data, error } = await supabase
    .from("relocation_plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()
  
  if (data) return data as RelocationPlan
  
  // Fallback: get most recent plan and set it as current
  const { data: latest } = await supabase
    .from("relocation_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if (!latest) return null
  
  // Mark it as current
  await supabase
    .from("relocation_plans")
    .update({ is_current: true })
    .eq("id", latest.id)
  
  return { ...latest, is_current: true } as RelocationPlan
}

// Create a new plan for the user, marking it as current
export async function createPlan(initialProfile?: Partial<Profile>, title?: string): Promise<RelocationPlan | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  // Clear is_current from all existing plans
  await supabase
    .from("relocation_plans")
    .update({ is_current: false })
    .eq("user_id", user.id)
  
  // Auto-generate title if not provided
  const autoTitle = title || generatePlanTitle(initialProfile)
  
  const { data, error } = await supabase
    .from("relocation_plans")
    .insert({
      user_id: user.id,
      profile_data: initialProfile || {},
      stage: "collecting",
      title: autoTitle,
      status: "active",
      is_current: true,
    })
    .select()
    .single()
  
  if (error) {
    console.error("[GoMate] Failed to create plan:", error)
    return null
  }
  
  return data as RelocationPlan
}

// Generate a default title from profile data
function generatePlanTitle(profile?: Partial<Profile>): string {
  if (profile?.destination && profile?.purpose) {
    const purposeLabel = profile.purpose.charAt(0).toUpperCase() + profile.purpose.slice(1)
    return `${purposeLabel} in ${profile.destination}`
  }
  if (profile?.destination) {
    return `Move to ${profile.destination}`
  }
  return `Plan ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
}

// Switch which plan is the user's current plan
export async function switchCurrentPlan(planId: string): Promise<RelocationPlan | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  // Verify the plan belongs to this user
  const { data: targetPlan } = await supabase
    .from("relocation_plans")
    .select("id")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single()
  
  if (!targetPlan) return null
  
  // Clear is_current from all plans
  await supabase
    .from("relocation_plans")
    .update({ is_current: false })
    .eq("user_id", user.id)
  
  // Set the target plan as current
  const { data, error } = await supabase
    .from("relocation_plans")
    .update({ is_current: true })
    .eq("id", planId)
    .eq("user_id", user.id)
    .select()
    .single()
  
  if (error) {
    console.error("[GoMate] Failed to switch plan:", error)
    return null
  }
  
  return data as RelocationPlan
}

// List all plans for a user (for the plan switcher)
export async function listUserPlans(): Promise<RelocationPlan[]> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  
  const { data, error } = await supabase
    .from("relocation_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("is_current", { ascending: false })
    .order("created_at", { ascending: false })
  
  if (error || !data) return []
  return data as RelocationPlan[]
}

// Rename a plan
export async function renamePlan(planId: string, title: string): Promise<boolean> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  
  const { error } = await supabase
    .from("relocation_plans")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("user_id", user.id)
  
  return !error
}

// Archive a plan
export async function archivePlan(planId: string): Promise<boolean> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  
  const { error } = await supabase
    .from("relocation_plans")
    .update({ status: "archived", is_current: false, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("user_id", user.id)
  
  return !error
}

// Update the plan's profile data
export async function updatePlanProfile(
  planId: string,
  profileData: Partial<Profile>
): Promise<RelocationPlan | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  // First get current profile data
  const { data: currentPlan } = await supabase
    .from("relocation_plans")
    .select("profile_data")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single()
  
  if (!currentPlan) return null
  
  // Merge the profile data
  const mergedProfile = {
    ...(currentPlan.profile_data || {}),
    ...profileData,
  }
  
  const { data, error } = await supabase
    .from("relocation_plans")
    .update({
      profile_data: mergedProfile,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("user_id", user.id)
    .select()
    .single()
  
  if (error) {
    console.error("[GoMate] Failed to update plan:", error)
    return null
  }
  
  return data as RelocationPlan
}

// Update the plan's stage
export async function updatePlanStage(
  planId: string,
  stage: PlanStage
): Promise<RelocationPlan | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data, error } = await supabase
    .from("relocation_plans")
    .update({
      stage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("user_id", user.id)
    .select()
    .single()
  
  if (error) {
    console.error("[GoMate] Failed to update stage:", error)
    return null
  }
  
  return data as RelocationPlan
}

// Get or create the user's plan
export async function getOrCreatePlan(): Promise<RelocationPlan | null> {
  const existing = await getCurrentPlan()
  if (existing) return existing
  return await createPlan()
}
