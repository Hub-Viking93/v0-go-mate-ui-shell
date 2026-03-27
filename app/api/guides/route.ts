import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateGuide, guideToDbFormat } from "@/lib/gomate/guide-generator"
import { resolveGuideImage } from "@/lib/gomate/image-service"
import type { Profile } from "@/lib/gomate/profile-schema"
import type { DestinationImage } from "@/lib/gomate/image-service"

export const maxDuration = 120

/** Build the hero image DB fields from a resolved DestinationImage */
function heroImageFields(img: DestinationImage) {
  return {
    hero_image_id: img.id,
    hero_image_url: img.storageUrl,
    hero_image_attribution: img.photographerName
      ? { photographerName: img.photographerName, photographerUrl: img.photographerUrl }
      : null,
  }
}

// GET - Fetch user's guides (only current guides by default)
export async function GET(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const includeArchived = searchParams.get("include_archived") === "true"
    const planIdFilter = searchParams.get("plan_id")

    // Determine which plan to scope guides to
    let scopePlanId = planIdFilter
    if (!scopePlanId && !includeArchived) {
      // Default: only show guides for the user's current plan
      const { data: currentPlan } = await supabase
        .from("relocation_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_current", true)
        .maybeSingle()
      scopePlanId = currentPlan?.id || null
    }

    let query = supabase
      .from("guides")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (!includeArchived) {
      query = query.eq("is_current", true)
    }

    if (scopePlanId) {
      query = query.eq("plan_id", scopePlanId)
    }

    const { data: guides, error } = await query

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

// POST - Generate a new guide from profile
// Generates ONE complete guide per destination/purpose combination with all sections
// Phase 4: Snapshot-bound regeneration + logical guide identity enforcement
export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { planId, guideId } = await req.json()

    // Fetch the plan to get profile data
    let profile: Profile | null = null
    let currentPlanId: string | undefined = planId
    let planVersion: number = 1

    if (planId) {
      const { data: plan, error } = await supabase
        .from("relocation_plans")
        .select("profile_data, plan_version")
        .eq("id", planId)
        .eq("user_id", user.id)
        .single()

      if (error || !plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 })
      }

      profile = plan.profile_data as Profile
      planVersion = (plan.plan_version as number) || 1
    } else {
      // Get the user's current plan
      const { data: plan } = await supabase
        .from("relocation_plans")
        .select("id, profile_data, plan_version")
        .eq("user_id", user.id)
        .eq("is_current", true)
        .maybeSingle()

      if (plan?.profile_data) {
        profile = plan.profile_data as Profile
        currentPlanId = plan.id
        planVersion = (plan.plan_version as number) || 1
      }
    }

    if (!profile || !profile.destination) {
      return NextResponse.json({
        error: "Complete your profile first to generate a guide"
      }, { status: 400 })
    }

    // Determine guide_type (always "main" for v1)
    const guideType = "main"
    const destination = profile.destination
    const purpose = profile.purpose || "other"

    if (guideId) {
      // --- Regeneration path: regenerate a specific existing guide ---
      const { data: existingGuide, error: guideError } = await supabase
        .from("guides")
        .select("id, guide_version, plan_id, destination, purpose, guide_type, is_current")
        .eq("id", guideId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (guideError) {
        console.error("[GoMate] Error fetching requested guide:", guideError)
        return NextResponse.json({ error: "Failed to fetch guide" }, { status: 500 })
      }

      if (!existingGuide) {
        return NextResponse.json({ error: "Guide not found" }, { status: 404 })
      }

      if (currentPlanId && existingGuide.plan_id && existingGuide.plan_id !== currentPlanId) {
        return NextResponse.json({ error: "Guide does not belong to the supplied plan" }, { status: 400 })
      }

      // B4-002: Snapshot-bound regeneration check
      const guideDestination = existingGuide.destination
      const guidePurpose = existingGuide.purpose || "other"
      const identityChanged = guideDestination !== destination || guidePurpose !== purpose

      // Determine which guide row to actually regenerate into.
      // If the requested guide is non-current or its identity doesn't match the profile,
      // find or create the canonical current guide for the profile's identity instead.
      let targetGuideId = existingGuide.id
      let targetVersion = (existingGuide.guide_version as number) || 1

      if (identityChanged || !existingGuide.is_current) {
        // Mark the requested guide as non-current if it still is
        if (existingGuide.is_current) {
          await supabase
            .from("guides")
            .update({ is_current: false, is_stale: true, stale_reason: "identity_superseded" })
            .eq("id", existingGuide.id)
        }

        // Find the current guide for the profile's actual identity
        const { data: currentForIdentity } = await supabase
          .from("guides")
          .select("id, guide_version")
          .eq("plan_id", currentPlanId!)
          .eq("destination", destination)
          .eq("purpose", purpose)
          .eq("guide_type", guideType)
          .eq("is_current", true)
          .maybeSingle()

        if (currentForIdentity) {
          targetGuideId = currentForIdentity.id
          targetVersion = (currentForIdentity.guide_version as number) || 1
        } else {
          // No current guide for this identity — fall through to insert below
          targetGuideId = ""
        }
      }

      if (targetGuideId) {
        // Regenerate in place: update the target guide with fresh content + frozen snapshot
        const [guide, heroImage] = await Promise.all([
          generateGuide(profile),
          resolveGuideImage(profile.destination, profile.target_city),
        ])
        const dbData = guideToDbFormat(guide, user.id, currentPlanId)
        const newVersion = targetVersion + 1

        const { data: updatedGuide, error: updateError } = await supabase
          .from("guides")
          .update({
            ...dbData,
            ...heroImageFields(heroImage),
            guide_version: newVersion,
            plan_version_at_generation: planVersion,
            profile_snapshot: profile,
            is_stale: false,
            stale_at: null,
            stale_reason: null,
            is_current: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetGuideId)
          .select()
          .single()

        if (updateError) {
          console.error("[GoMate] Error updating guide:", updateError)
          return NextResponse.json({ error: "Failed to update guide" }, { status: 500 })
        }

        return NextResponse.json({ guide: updatedGuide, updated: true })
      }

      // No current guide for this identity exists — fall through to insert below
    } else {
      // --- New generation path: check for existing current guide with same identity ---
      const { data: existingCurrent, error: lookupError } = await supabase
        .from("guides")
        .select("id, guide_version, plan_id")
        .eq("user_id", user.id)
        .eq("destination", destination)
        .eq("purpose", purpose)
        .eq("guide_type", guideType)
        .eq("is_current", true)
        .maybeSingle()

      if (lookupError && lookupError.code !== "PGRST116") {
        console.error("[GoMate] Error fetching existing guide:", lookupError)
        return NextResponse.json({ error: "Failed to fetch guide" }, { status: 500 })
      }

      if (currentPlanId && existingCurrent?.plan_id === currentPlanId) {
        // Same plan, same identity: regenerate in place
        const [guide, heroImage] = await Promise.all([
          generateGuide(profile),
          resolveGuideImage(profile.destination, profile.target_city),
        ])
        const dbData = guideToDbFormat(guide, user.id, currentPlanId)
        const newVersion = ((existingCurrent.guide_version as number) || 1) + 1

        const { data: updatedGuide, error: updateError } = await supabase
          .from("guides")
          .update({
            ...dbData,
            ...heroImageFields(heroImage),
            guide_version: newVersion,
            plan_version_at_generation: planVersion,
            profile_snapshot: profile,
            is_stale: false,
            stale_at: null,
            stale_reason: null,
            is_current: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCurrent.id)
          .select()
          .single()

        if (updateError) {
          console.error("[GoMate] Error updating guide:", updateError)
          return NextResponse.json({ error: "Failed to update guide" }, { status: 500 })
        }

        return NextResponse.json({ guide: updatedGuide, updated: true })
      }

      // B4-003: If there's an existing current guide for this identity under a different plan,
      // mark it non-current before inserting
      if (existingCurrent) {
        await supabase
          .from("guides")
          .update({ is_current: false })
          .eq("id", existingCurrent.id)
      }
    }

    // --- Create new guide with profile snapshot ---
    const [guide, heroImage] = await Promise.all([
      generateGuide(profile),
      resolveGuideImage(profile.destination, profile.target_city),
    ])
    const dbData = guideToDbFormat(guide, user.id, currentPlanId)

    const { data: newGuide, error: insertError } = await supabase
      .from("guides")
      .insert({
        ...dbData,
        ...heroImageFields(heroImage),
        guide_type: guideType,
        guide_version: 1,
        plan_version_at_generation: planVersion,
        profile_snapshot: profile,
        is_stale: false,
        is_current: true,
      })
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
