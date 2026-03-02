import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ensureSubscription,
  canCreatePlan,
  hasFeatureAccess,
  PRICING,
  type Tier,
  type Feature,
} from "@/lib/gomate/tier"

// GET - Fetch current subscription + plan usage
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const subscription = await ensureSubscription(user.id)
    if (!subscription) {
      return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 })
    }

    const planStatus = await canCreatePlan(user.id)

    // Build feature access map
    const features: Record<string, boolean> = {}
    const featureList: Feature[] = [
      "chat", "visa_recommendation", "local_requirements", "cost_of_living",
      "budget_planner", "guides", "documents", "booking", "plan_switcher",
      "post_relocation", "compliance_alerts", "post_arrival_assistant",
    ]
    for (const feature of featureList) {
      features[feature] = hasFeatureAccess(subscription.tier as Tier, feature)
    }

    return NextResponse.json({
      subscription,
      plans: {
        current: planStatus.current,
        limit: planStatus.limit,
        canCreate: planStatus.allowed,
      },
      features,
      pricing: PRICING,
    })
  } catch (error) {
    console.error("Subscription GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

