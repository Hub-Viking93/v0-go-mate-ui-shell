"use server"

import { createClient } from "@/lib/supabase/server"
import type { Profile } from "./profile-schema"

export type PlanStage = "collecting" | "generating" | "complete"

export interface RelocationPlan {
  id: string
  user_id: string
  profile_data: Profile
  stage: PlanStage
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
  
  const { data, error } = await supabase
    .from("relocation_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
  
  if (error || !data) return null
  return data as RelocationPlan
}

// Create a new plan for the user
export async function createPlan(initialProfile?: Partial<Profile>): Promise<RelocationPlan | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data, error } = await supabase
    .from("relocation_plans")
    .insert({
      user_id: user.id,
      profile_data: initialProfile || {},
      stage: "collecting",
    })
    .select()
    .single()
  
  if (error) {
    console.error("[GoMate] Failed to create plan:", error)
    return null
  }
  
  return data as RelocationPlan
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
