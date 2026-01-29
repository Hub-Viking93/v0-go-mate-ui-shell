import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateGuide, guideToDbFormat } from "@/lib/gomate/guide-generator"
import type { Profile } from "@/lib/gomate/profile-schema"

export const maxDuration = 60

// GET - Fetch user's guides
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { data: guides, error } = await supabase
      .from("guides")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    
    if (error) {
      console.error("[GoMate] Error fetching guides:", error)
      return NextResponse.json({ error: "Failed to fetch guides" }, { status: 500 })
    }
    
    return NextResponse.json({ guides: guides || [] })
  } catch (error) {
    console.error("[GoMate] Error in GET /api/guides:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Guide types to generate
const GUIDE_TYPES = [
  { name: "Main Relocation Guide", type: "main" },
  { name: "Visa & Legal Guide", type: "visa" },
  { name: "Budget & Finance Guide", type: "budget" },
  { name: "Housing & Accommodation Guide", type: "housing" },
  { name: "Practical Setup Guide", type: "practical" }, // banking, healthcare, utilities
  { name: "Culture & Lifestyle Guide", type: "culture" },
  { name: "Nightlife & Social Guide", type: "nightlife" },
  { name: "Safety & Emergency Guide", type: "safety" },
  { name: "Expat Community Guide", type: "expat" },
  { name: "Transport & Getting Around", type: "transport" },
  { name: "Food & Dining Guide", type: "food" },
]

// POST - Generate a new guide from profile
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { planId, generateAll } = await req.json()
    
    // Fetch the plan to get profile data
    let profile: Profile | null = null
    let currentPlanId: string | undefined = planId
    
    if (planId) {
      const { data: plan, error } = await supabase
        .from("relocation_plans")
        .select("profile_data")
        .eq("id", planId)
        .eq("user_id", user.id)
        .single()
      
      if (error || !plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 })
      }
      
      profile = plan.profile_data as Profile
    } else {
      // Get most recent plan
      const { data: plan } = await supabase
        .from("relocation_plans")
        .select("id, profile_data")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (plan?.profile_data) {
        profile = plan.profile_data as Profile
        currentPlanId = plan.id
      }
    }
    
    if (!profile || !profile.destination) {
      return NextResponse.json({ 
        error: "Complete your profile first to generate a guide" 
      }, { status: 400 })
    }
    
    // If generateAll is true, create all guide types
    if (generateAll) {
      const guides: Array<{ type: string; guide: unknown; created: boolean; updated: boolean }> = []
      
      for (const guideType of GUIDE_TYPES) {
        // Check if this guide type already exists
        const { data: existingGuide } = await supabase
          .from("guides")
          .select("id")
          .eq("user_id", user.id)
          .eq("destination", profile.destination)
          .eq("purpose", profile.purpose || "other")
          .eq("guide_type", guideType.type)
          .maybeSingle()
        
        const guide = generateGuide(profile)
        const dbData = {
          ...guideToDbFormat(guide, user.id, currentPlanId),
          title: `${profile.destination} - ${guideType.name}`,
          guide_type: guideType.type,
        }
        
        if (existingGuide) {
          // Update existing
          const { data: updatedGuide, error: updateError } = await supabase
            .from("guides")
            .update({
              ...dbData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingGuide.id)
            .select()
            .single()
          
          if (!updateError && updatedGuide) {
            guides.push({ type: guideType.type, guide: updatedGuide, created: false, updated: true })
          }
        } else {
          // Create new
          const { data: newGuide, error: insertError } = await supabase
            .from("guides")
            .insert(dbData)
            .select()
            .single()
          
          if (!insertError && newGuide) {
            guides.push({ type: guideType.type, guide: newGuide, created: true, updated: false })
          }
        }
      }
      
      return NextResponse.json({ 
        guides, 
        total: guides.length,
        created: guides.filter(g => g.created).length,
        updated: guides.filter(g => g.updated).length,
      })
    }
    
    // Single guide generation (original behavior)
    // Check if guide already exists for this destination
    const { data: existingGuide } = await supabase
      .from("guides")
      .select("id")
      .eq("user_id", user.id)
      .eq("destination", profile.destination)
      .eq("purpose", profile.purpose || "other")
      .maybeSingle()
    
    if (existingGuide) {
      // Update existing guide
      const guide = generateGuide(profile)
      const dbData = guideToDbFormat(guide, user.id, currentPlanId)
      
      const { data: updatedGuide, error: updateError } = await supabase
        .from("guides")
        .update({
          ...dbData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingGuide.id)
        .select()
        .single()
      
      if (updateError) {
        console.error("[GoMate] Error updating guide:", updateError)
        return NextResponse.json({ error: "Failed to update guide" }, { status: 500 })
      }
      
      return NextResponse.json({ guide: updatedGuide, updated: true })
    }
    
    // Generate new guide
    const guide = generateGuide(profile)
    const dbData = guideToDbFormat(guide, user.id, currentPlanId)
    
    const { data: newGuide, error: insertError } = await supabase
      .from("guides")
      .insert(dbData)
      .select()
      .single()
    
    if (insertError) {
      console.error("[GoMate] Error creating guide:", insertError)
      return NextResponse.json({ error: "Failed to create guide" }, { status: 500 })
    }
    
    return NextResponse.json({ guide: newGuide, created: true })
  } catch (error) {
    console.error("[GoMate] Error in POST /api/guides:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
