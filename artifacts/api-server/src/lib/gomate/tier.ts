import type { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "pro";
export type BillingCycle = "monthly" | "annual";
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";

export interface UserSubscription {
  id: string;
  user_id: string;
  tier: Tier;
  billing_cycle: BillingCycle | null;
  status: SubscriptionStatus;
  plan_limit: number;
  price_usd: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  started_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Feature =
  | "chat" | "visa_recommendation" | "local_requirements" | "cost_of_living"
  | "budget_planner" | "affordability_analysis" | "guides" | "documents"
  | "pre_move_timeline" | "plan_consistency" | "tax_overview" | "chat_history"
  | "plan_switcher" | "post_relocation" | "settling_in_tasks" | "compliance_alerts"
  | "compliance_calendar" | "post_arrival_assistant" | "visa_tracker"
  | "banking_wizard" | "tax_registration" | "wellbeing_checkins"
  | "free_chat_post_arrival" | "multi_plan" | "settling_in_full" | "wellbeing_checkins_full";

const FREE_FEATURES: Feature[] = ["chat", "visa_recommendation"];
const PRO_FEATURES: Feature[] = [
  "chat", "visa_recommendation", "local_requirements", "cost_of_living",
  "budget_planner", "affordability_analysis", "guides", "documents",
  "pre_move_timeline", "plan_consistency", "tax_overview", "chat_history",
  "plan_switcher", "post_relocation", "settling_in_tasks", "compliance_alerts",
  "compliance_calendar", "post_arrival_assistant", "visa_tracker",
  "banking_wizard", "tax_registration", "wellbeing_checkins",
  "free_chat_post_arrival", "multi_plan", "settling_in_full", "wellbeing_checkins_full",
];

const TIER_FEATURES: Record<Tier, Set<Feature>> = {
  free: new Set(FREE_FEATURES),
  pro: new Set(PRO_FEATURES),
};

export function hasFeatureAccess(tier: Tier, feature: Feature): boolean {
  if (isBuildathonFreeMode()) return true;
  return TIER_FEATURES[tier]?.has(feature) ?? false;
}

// Buildathon override: judges should be able to test full Pro experience without paying.
// getUserTier() always returns "pro" while this flag is on. Remove or set
// GOMATE_BUILDATHON_FREE=false post-launch to restore real subscription gating.
export function isBuildathonFreeMode(): boolean {
  return process.env["GOMATE_BUILDATHON_FREE"] !== "false";
}

if (isBuildathonFreeMode()) {
  console.warn(
    "[gomate/tier] GOMATE_BUILDATHON_FREE active — all users treated as Pro, plan limits removed.",
  );
}

export function getEffectiveTier(
  sub: Pick<UserSubscription, "tier" | "status"> | null | undefined,
): Tier {
  if (isBuildathonFreeMode()) return "pro";
  if (!sub) return "free";
  return sub.status === "active" ? sub.tier : "free";
}

export async function ensureSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSubscription | null> {
  const { data: existing } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing as UserSubscription;
  const { data: created, error } = await supabase
    .from("user_subscriptions")
    .insert({ user_id: userId, tier: "free", status: "active", plan_limit: 1, price_usd: 0 })
    .select()
    .single();
  if (error) return null;
  return created as UserSubscription;
}

export async function getUserTier(supabase: SupabaseClient, userId: string): Promise<Tier> {
  // Buildathon override always wins.
  if (isBuildathonFreeMode()) return "pro";
  const sub = await ensureSubscription(supabase, userId);
  return getEffectiveTier(sub);
}

export async function canCreatePlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ allowed: boolean; current: number; limit: number; tier: Tier }> {
  if (isBuildathonFreeMode()) {
    const { count } = await supabase
      .from("relocation_plans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    return { allowed: true, current: count ?? 0, limit: 999, tier: "pro" };
  }
  const sub = await ensureSubscription(supabase, userId);
  if (!sub) return { allowed: false, current: 0, limit: 1, tier: "free" };
  const { count } = await supabase
    .from("relocation_plans")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  const effective = getEffectiveTier(sub);
  const limit = effective === "pro" ? 999 : 1;
  return {
    allowed: (count ?? 0) < limit,
    current: count ?? 0,
    limit,
    tier: effective,
  };
}

export interface PricingOption {
  tier: Tier;
  billing_cycle: BillingCycle | null;
  label: string;
  price_usd: number;
  price_display: string;
  plan_limit: number;
  savings_percent: number | null;
  description: string;
  features: string[];
}

const PRO_FEATURE_BULLETS = [
  "Unlimited relocation plans",
  "Visa recommendations & full research",
  "AI-generated relocation guides with citations",
  "Local requirements & cost of living analysis",
  "Budget planner & affordability analysis",
  "Document checklist with status tracking",
  "Pre-move timeline & checklist",
  "Visa application tracker",
  "Post-arrival settling-in checklist",
  "Banking & tax registration guides",
  "Compliance calendar, alerts & iCal export",
  "Post-arrival AI assistant & free chat",
  "Wellbeing check-ins",
  "Plan consistency monitoring",
];

export const PRICING: PricingOption[] = [
  {
    tier: "free",
    billing_cycle: null,
    label: "Free",
    price_usd: 0,
    price_display: "$0",
    plan_limit: 1,
    savings_percent: null,
    description: "Explore your relocation options",
    features: ["Full chat interview", "Profile building (65+ fields)", "Basic country overview", "1 active relocation plan"],
  },
  {
    tier: "pro",
    billing_cycle: "monthly",
    label: "Pro Monthly",
    price_usd: 39,
    price_display: "$39/mo",
    plan_limit: 999,
    savings_percent: null,
    description: "Your full relocation companion",
    features: PRO_FEATURE_BULLETS,
  },
  {
    tier: "pro",
    billing_cycle: "annual",
    label: "Pro Annual",
    price_usd: 299,
    price_display: "$299/yr",
    plan_limit: 999,
    savings_percent: 36,
    description: "Best value — saves ~36%",
    features: [...PRO_FEATURE_BULLETS, "Save ~36% vs monthly"],
  },
];
