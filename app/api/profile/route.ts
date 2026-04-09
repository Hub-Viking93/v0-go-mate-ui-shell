import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { type Profile } from "@/lib/gomate/profile-schema"
import { generateGuide, guideToDbFormat } from "@/lib/gomate/guide-generator"
import {
  attachDerivedPlanState,
  derivePlanAuthority,
  getOwnedPlan,
} from "@/lib/gomate/core-state"
import { computePlanChangeSummary } from "@/lib/gomate/plan-diff"

// GET - Fetch the current user's plan and profile
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { data: plan, error } = await getOwnedPlan(supabase, user.id)
    
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
        // Constraint violation: a concurrent request already created the plan.
        // Re-fetch and return the existing plan instead of failing.
        const { data: existingPlan } = await getOwnedPlan(supabase, user.id)

        if (!existingPlan) {
          console.error("[GoMate] Error creating plan:", createError)
          return NextResponse.json({ error: "Failed to create plan" }, { status: 500 })
        }
        return NextResponse.json({ plan: attachDerivedPlanState(existingPlan) })
      }

      return NextResponse.json({ plan: attachDerivedPlanState(newPlan) })
    }
    
    return NextResponse.json({ plan: attachDerivedPlanState(plan) })
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
    
    const { profileData, planId, action, expectedVersion } = await req.json() as {
      profileData?: Partial<Profile>
      planId?: string
      action?: "lock" | "unlock"
      expectedVersion?: number
    }
    
    const { data: currentPlan, error: fetchError } = await getOwnedPlan(
      supabase,
      user.id,
      { planId }
    )
    
    if (fetchError || !currentPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const currentVersion = (currentPlan.plan_version as number) || 1
    const currentAuthority = derivePlanAuthority(currentPlan)

    if (typeof expectedVersion !== "number") {
      return NextResponse.json(
        { error: "expectedVersion is required for profile state changes.", currentVersion },
        { status: 409 }
      )
    }

    if (expectedVersion !== currentVersion) {
      return NextResponse.json(
        { error: "Version conflict. Reload and retry.", currentVersion },
        { status: 409 }
      )
    }

    // Handle lock/unlock actions
    if (action === "lock") {
      if (!currentAuthority.canLock) {
        return NextResponse.json(
          {
            error: "Plan is not ready to lock.",
            lifecycle: currentAuthority.lifecycle,
            readiness: currentAuthority.readiness,
          },
          { status: 409 }
        )
      }

      const lockVersion = currentVersion + 1
      const { data: lockedPlan, error: lockError } = await supabase
        .from("relocation_plans")
        .update({
          locked: true,
          locked_at: new Date().toISOString(),
          stage: "complete",
          plan_version: lockVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentPlan.id)
        .eq("user_id", user.id)
        .eq("plan_version", currentVersion)
        .select()
        .maybeSingle()
      
      if (!lockedPlan) {
        return NextResponse.json(
          { error: "Version conflict. Reload and retry.", currentVersion: lockVersion - 1 },
          { status: 409 }
        )
      }

      if (lockError) {
        return NextResponse.json({ error: "Failed to lock plan" }, { status: 500 })
      }

      let finalPlan = lockedPlan

      // Auto-generate a guide when plan is locked. onboarding_completed is set
      // only after a guide already exists or a new guide insert succeeds.
      try {
        const profile = currentPlan.profile_data as Profile
        if (profile.destination) {
          // Check if a current guide already exists for this plan + destination + purpose
          const { data: existingGuide, error: existingGuideError } = await supabase
            .from("guides")
            .select("id")
            .eq("plan_id", currentPlan.id)
            .eq("destination", profile.destination)
            .eq("purpose", profile.purpose || "other")
            .eq("guide_type", "main")
            .eq("is_current", true)
            .maybeSingle()

          if (existingGuideError && existingGuideError.code !== "PGRST116") {
            console.error("[GoMate] Error checking existing guide:", existingGuideError)
          }

          let guideReady = Boolean(existingGuide)

          if (!guideReady) {
            const guide = await generateGuide(profile)
            const dbData = guideToDbFormat(guide, user.id, currentPlan.id)
            const planVersion = (currentPlan as Record<string, unknown>).plan_version as number || 1
            const { error: guideInsertError } = await supabase.from("guides").insert({
              ...dbData,
              guide_type: "main",
              guide_version: 1,
              plan_version_at_generation: planVersion,
              profile_snapshot: profile,
              is_stale: false,
              is_current: true,
            })

            if (guideInsertError) {
              console.error("[GoMate] Error inserting auto-generated guide:", guideInsertError)
            } else {
              guideReady = true
            }
          }

          if (guideReady && !lockedPlan.onboarding_completed) {
            const { data: completedPlan, error: onboardingError } = await supabase
              .from("relocation_plans")
              .update({
                onboarding_completed: true,
                updated_at: new Date().toISOString(),
              })
              .eq("id", currentPlan.id)
              .eq("user_id", user.id)
              .select()
              .single()

            if (onboardingError) {
              console.error("[GoMate] Error marking onboarding complete:", onboardingError)
              return NextResponse.json(
                { error: "Failed to finalize onboarding state" },
                { status: 500 }
              )
            }

            finalPlan = completedPlan
          }
        }
      } catch (guideError) {
        console.error("[GoMate] Error auto-generating guide:", guideError)
      }
      
      return NextResponse.json({ plan: attachDerivedPlanState(finalPlan) })
    }
    
    if (action === "unlock") {
      if (!currentPlan.locked) {
        return NextResponse.json({ error: "Plan is not locked." }, { status: 409 })
      }

      if (currentAuthority.lifecycle === "arrived") {
        return NextResponse.json(
          { error: "Arrived plans cannot be unlocked." },
          { status: 409 }
        )
      }

      const { data: unlockedPlan, error: unlockError } = await supabase
        .from("relocation_plans")
        .update({
          locked: false,
          locked_at: null,
          stage: "collecting",
          plan_version: currentVersion + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentPlan.id)
        .eq("user_id", user.id)
        .eq("plan_version", currentVersion)
        .select()
        .maybeSingle()
      
      if (!unlockedPlan) {
        return NextResponse.json(
          { error: "Version conflict. Reload and retry.", currentVersion },
          { status: 409 }
        )
      }

      if (unlockError) {
        return NextResponse.json({ error: "Failed to unlock plan" }, { status: 500 })
      }
      return NextResponse.json({ plan: attachDerivedPlanState(unlockedPlan) })
    }
    
    if (!profileData || typeof profileData !== "object") {
      return NextResponse.json({ error: "profileData is required" }, { status: 400 })
    }

    if (!currentAuthority.canEditProfile) {
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
    const nextAuthority = derivePlanAuthority({
      ...currentPlan,
      profile_data: mergedProfile,
    })

    // Update plan
    const { data: updatedPlan, error: updateError } = await supabase
      .from("relocation_plans")
      .update({
        profile_data: mergedProfile,
        stage: nextAuthority.stage,
        plan_version: currentVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentPlan.id)
      .eq("user_id", user.id)
      .eq("plan_version", currentVersion)
      .select()
      .maybeSingle()
    
    if (!updatedPlan) {
      return NextResponse.json(
        { error: "Version conflict. Reload and retry.", currentVersion },
        { status: 409 }
      )
    }

    if (updateError) {
      console.error("[GoMate] Error updating plan:", updateError)
      return NextResponse.json({ error: "Failed to update plan" }, { status: 500 })
    }

    // Mark any existing guide as stale when profile changes
    const staleReason = profileData?.destination !== undefined
      ? "destination_changed"
      : "profile_changed"
    await supabase
      .from("guides")
      .update({
        is_stale: true,
        stale_at: new Date().toISOString(),
        stale_reason: staleReason,
      })
      .eq("plan_id", currentPlan.id)
      .eq("user_id", user.id)
      .is("is_stale", false)

    // Compute change summary by comparing against the current guide's profile snapshot
    let changeSummary = null
    const { data: currentGuide } = await supabase
      .from("guides")
      .select("profile_snapshot")
      .eq("plan_id", currentPlan.id)
      .eq("is_current", true)
      .maybeSingle()

    if (currentGuide?.profile_snapshot) {
      changeSummary = computePlanChangeSummary(
        currentGuide.profile_snapshot as Record<string, unknown>,
        mergedProfile as Record<string, unknown>,
      )
    }

    return NextResponse.json({ plan: attachDerivedPlanState(updatedPlan), changeSummary })
  } catch (error) {
    console.error("[GoMate] Error in PATCH /api/profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
