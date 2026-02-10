import { createClient } from "@/lib/supabase/server"

// ============================================================
// Tier & Subscription Types
// ============================================================

export type Tier = "free" | "pro_single" | "pro_plus"
export type BillingCycle = "one_time" | "monthly" | "quarterly" | "biannual" | "annual"
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due"

export interface UserSubscription {
  id: string
  user_id: string
  tier: Tier
  billing_cycle: BillingCycle | null
  status: SubscriptionStatus
  plan_limit: number
  price_sek: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  started_at: string
  expires_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Feature Access Matrix
// ============================================================

export type Feature =
  | "chat"
  | "visa_recommendation"
  | "local_requirements"
  | "cost_of_living"
  | "budget_planner"
  | "guides"
  | "documents"
  | "booking"
  | "plan_switcher"
  | "post_relocation"
  | "compliance_alerts"
  | "post_arrival_assistant"

const TIER_FEATURES: Record<Tier, Record<Feature, boolean>> = {
  free: {
    chat: true,
    visa_recommendation: false,
    local_requirements: false,
    cost_of_living: false,
    budget_planner: false,
    guides: false,
    documents: false,
    booking: false,
    plan_switcher: false,
    post_relocation: false,
    compliance_alerts: false,
    post_arrival_assistant: false,
  },
  pro_single: {
    chat: true,
    visa_recommendation: true,
    local_requirements: true,
    cost_of_living: true,
    budget_planner: true,
    guides: true,
    documents: true,
    booking: true,
    plan_switcher: false,
    post_relocation: false,
    compliance_alerts: false,
    post_arrival_assistant: false,
  },
  pro_plus: {
    chat: true,
    visa_recommendation: true,
    local_requirements: true,
    cost_of_living: true,
    budget_planner: true,
    guides: true,
    documents: true,
    booking: true,
    plan_switcher: true,
    post_relocation: true,
    compliance_alerts: true,
    post_arrival_assistant: true,
  },
}

// ============================================================
// Pricing Configuration
// ============================================================

export interface PricingOption {
  tier: Tier
  billing_cycle: BillingCycle | null
  label: string
  price_sek: number
  price_display: string
  plan_limit: number
  savings_percent: number | null
  description: string
  features: string[]
}

export const PRICING: PricingOption[] = [
  {
    tier: "free",
    billing_cycle: null,
    label: "Free",
    price_sek: 0,
    price_display: "0 kr",
    plan_limit: 1,
    savings_percent: null,
    description: "Explore your relocation options",
    features: [
      "Full chat interview",
      "Profile building",
      "Basic relocation overview",
    ],
  },
  {
    tier: "pro_single",
    billing_cycle: "one_time",
    label: "Pro Single",
    price_sek: 699,
    price_display: "699 kr",
    plan_limit: 1,
    savings_percent: null,
    description: "Complete pre-relocation plan",
    features: [
      "Everything in Free",
      "Visa recommendations",
      "Local requirements",
      "Cost of living analysis",
      "Budget planner",
      "Full relocation guide",
      "Document checklist",
      "Flight search",
    ],
  },
  {
    tier: "pro_plus",
    billing_cycle: "monthly",
    label: "Pro+ Monthly",
    price_sek: 249,
    price_display: "249 kr/mo",
    plan_limit: 999,
    savings_percent: null,
    description: "Full relocation support with post-arrival assistance",
    features: [
      "Everything in Pro Single",
      "Unlimited relocation plans",
      "Post-relocation checklist",
      "Post-arrival AI assistant",
      "Compliance alerts",
      "Budget reality tracking",
    ],
  },
  {
    tier: "pro_plus",
    billing_cycle: "quarterly",
    label: "Pro+ 3 Months",
    price_sek: 599,
    price_display: "599 kr",
    plan_limit: 999,
    savings_percent: 20,
    description: "Save 20% with a 3-month commitment",
    features: [
      "Everything in Pro+ Monthly",
      "20% savings vs monthly",
    ],
  },
  {
    tier: "pro_plus",
    billing_cycle: "biannual",
    label: "Pro+ 6 Months",
    price_sek: 999,
    price_display: "999 kr",
    plan_limit: 999,
    savings_percent: 33,
    description: "Save 33% with a 6-month commitment",
    features: [
      "Everything in Pro+ Monthly",
      "33% savings vs monthly",
    ],
  },
  {
    tier: "pro_plus",
    billing_cycle: "annual",
    label: "Pro+ Annual",
    price_sek: 1699,
    price_display: "1 699 kr",
    plan_limit: 999,
    savings_percent: 43,
    description: "Best value - save 43% with an annual plan",
    features: [
      "Everything in Pro+ Monthly",
      "43% savings vs monthly",
    ],
  },
]

// ============================================================
// Tier Display Helpers
// ============================================================

export const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  pro_single: "Pro Single",
  pro_plus: "Pro+",
}

export const TIER_COLORS: Record<Tier, { bg: string; text: string; border: string }> = {
  free: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
  pro_single: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30" },
  pro_plus: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
}

// ============================================================
// Server-Side Tier Functions
// ============================================================

/**
 * Get or create a user's subscription.
 * Always returns a subscription - creates a free tier if none exists.
 */
export async function ensureSubscription(userId?: string): Promise<UserSubscription | null> {
  const supabase = await createClient()

  // Get user ID if not provided
  let uid = userId
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    uid = user.id
  }

  // Try to get existing subscription
  const { data: existing } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle()

  if (existing) return existing as UserSubscription

  // Create free tier subscription
  const { data: created, error } = await supabase
    .from("user_subscriptions")
    .insert({
      user_id: uid,
      tier: "free",
      status: "active",
      plan_limit: 1,
      price_sek: 0,
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to create subscription:", error)
    return null
  }

  return created as UserSubscription
}

/**
 * Get the user's current tier. Returns "free" if no subscription found.
 */
export async function getUserTier(userId?: string): Promise<Tier> {
  const sub = await ensureSubscription(userId)
  if (!sub) return "free"

  // Check if subscription is still active
  if (sub.status !== "active") return "free"
  if (sub.expires_at && new Date(sub.expires_at) < new Date()) return "free"

  return sub.tier
}

/**
 * Get the full subscription object for the current user.
 */
export async function getUserSubscription(userId?: string): Promise<UserSubscription | null> {
  return ensureSubscription(userId)
}

/**
 * Check if a user can access a specific feature based on their tier.
 */
export async function canAccessFeature(feature: Feature, userId?: string): Promise<boolean> {
  const tier = await getUserTier(userId)
  return TIER_FEATURES[tier]?.[feature] ?? false
}

/**
 * Check feature access synchronously when you already have the tier.
 */
export function hasFeatureAccess(tier: Tier, feature: Feature): boolean {
  return TIER_FEATURES[tier]?.[feature] ?? false
}

/**
 * Check if a user can create a new plan based on their tier's plan limit.
 */
export async function canCreatePlan(userId?: string): Promise<{ allowed: boolean; current: number; limit: number; tier: Tier }> {
  const sub = await ensureSubscription(userId)
  if (!sub) return { allowed: false, current: 0, limit: 1, tier: "free" }

  const supabase = await createClient()
  const { count } = await supabase
    .from("relocation_plans")
    .select("*", { count: "exact", head: true })
    .eq("user_id", sub.user_id)

  const currentCount = count ?? 0
  const tier = sub.status === "active" ? sub.tier : "free" as Tier

  return {
    allowed: currentCount < sub.plan_limit,
    current: currentCount,
    limit: sub.plan_limit,
    tier,
  }
}

/**
 * Upgrade a user's subscription (for use without Stripe - manual/admin upgrade).
 * In the future, this will be called after successful Stripe payment.
 */
export async function upgradeSubscription(
  userId: string,
  tier: Tier,
  billingCycle: BillingCycle | null
): Promise<UserSubscription | null> {
  const supabase = await createClient()

  // Find matching pricing
  const pricing = PRICING.find((p) => p.tier === tier && p.billing_cycle === billingCycle)
  if (!pricing) return null

  // Calculate expiry for subscriptions
  let expiresAt: string | null = null
  if (billingCycle && billingCycle !== "one_time") {
    const now = new Date()
    switch (billingCycle) {
      case "monthly":
        now.setMonth(now.getMonth() + 1)
        break
      case "quarterly":
        now.setMonth(now.getMonth() + 3)
        break
      case "biannual":
        now.setMonth(now.getMonth() + 6)
        break
      case "annual":
        now.setFullYear(now.getFullYear() + 1)
        break
    }
    expiresAt = now.toISOString()
  }

  const { data, error } = await supabase
    .from("user_subscriptions")
    .update({
      tier,
      billing_cycle: billingCycle,
      status: "active",
      plan_limit: pricing.plan_limit,
      price_sek: pricing.price_sek,
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
      cancelled_at: null,
    })
    .eq("user_id", userId)
    .select()
    .single()

  if (error) {
    console.error("Failed to upgrade subscription:", error)
    return null
  }

  return data as UserSubscription
}

/**
 * Downgrade a user back to free tier.
 */
export async function downgradeToFree(userId: string): Promise<UserSubscription | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_subscriptions")
    .update({
      tier: "free" as Tier,
      billing_cycle: null,
      status: "active",
      plan_limit: 1,
      price_sek: 0,
      expires_at: null,
      cancelled_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select()
    .single()

  if (error) {
    console.error("Failed to downgrade subscription:", error)
    return null
  }

  return data as UserSubscription
}
