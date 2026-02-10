import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ensureSubscription,
  canCreatePlan,
  upgradeSubscription,
  downgradeToFree,
  hasFeatureAccess,
  PRICING,
  type Tier,
  type BillingCycle,
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

// POST - Upgrade or downgrade subscription
// In the future, this will be called after successful Stripe payment.
// For now, it directly updates the subscription (for testing/admin use).
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { action, tier, billing_cycle } = await req.json()

    if (action === "upgrade") {
      if (!tier) {
        return NextResponse.json({ error: "Tier is required" }, { status: 400 })
      }

      const validTiers = ["free", "pro_single", "pro_plus"]
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: "Invalid tier" }, { status: 400 })
      }

      // Pro single requires one_time billing
      if (tier === "pro_single" && billing_cycle && billing_cycle !== "one_time") {
        return NextResponse.json({ error: "Pro Single only supports one-time billing" }, { status: 400 })
      }

      // Pro plus requires a subscription billing cycle
      if (tier === "pro_plus") {
        const validCycles = ["monthly", "quarterly", "biannual", "annual"]
        if (!billing_cycle || !validCycles.includes(billing_cycle)) {
          return NextResponse.json({ error: "Pro+ requires a valid billing cycle" }, { status: 400 })
        }
      }

      const updated = await upgradeSubscription(
        user.id,
        tier as Tier,
        tier === "pro_single" ? "one_time" : (billing_cycle as BillingCycle)
      )

      if (!updated) {
        return NextResponse.json({ error: "Failed to upgrade subscription" }, { status: 500 })
      }

      return NextResponse.json({ subscription: updated, success: true })
    }

    if (action === "downgrade") {
      const updated = await downgradeToFree(user.id)

      if (!updated) {
        return NextResponse.json({ error: "Failed to downgrade subscription" }, { status: 500 })
      }

      return NextResponse.json({ subscription: updated, success: true })
    }

    return NextResponse.json({ error: "Invalid action. Use 'upgrade' or 'downgrade'." }, { status: 400 })
  } catch (error) {
    console.error("Subscription POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
