/**
 * Usage Guard — Server-side enforcement of generation limits and rate limiting.
 *
 * All limits are enforced here, never on the frontend.
 * Routes call checkUsageLimit() before expensive work and recordUsage() after.
 */

import { createClient } from "@/lib/supabase/server"
import type { Tier } from "./tier"
import { getUserTier } from "./tier"

// ============================================================
// Types
// ============================================================

export type UsageEventType =
  | "research"
  | "guide_generation"
  | "settling_in_generation"
  | "chat_message"

/** Expensive event types that count toward the monthly generation cap. */
const GENERATION_TYPES: UsageEventType[] = [
  "research",
  "guide_generation",
  "settling_in_generation",
]

export interface UsageLimitResult {
  allowed: boolean
  /** Current count in the billing window */
  used: number
  /** Max allowed in the billing window */
  limit: number
  /** Human-readable reason when blocked */
  reason?: string
}

// ============================================================
// Limits Configuration
// ============================================================

/**
 * Monthly generation caps per tier.
 * A "generation" = one research trigger, one guide generation, or one settling-in generation.
 * These are the most expensive operations (~6K–42K tokens + Firecrawl calls each).
 */
const MONTHLY_GENERATION_LIMITS: Record<Tier, number> = {
  free: 2,         // 2 total (enough for 1 research + 1 guide)
  pro_single: 5,   // 5/month — covers normal use + a few regenerations
  pro_plus: 15,    // 15/month — power users, multiple plans
}

/**
 * Rate limits: max requests per minute per user per event type.
 * Prevents spam, loops, and accidental double-triggers.
 */
const RATE_LIMITS_PER_MINUTE: Record<UsageEventType, number> = {
  research: 2,
  guide_generation: 2,
  settling_in_generation: 2,
  // Onboarding has ~20 questions and a real user can blow past 15 in a minute
  // when they're typing fast. 30/min keeps abuse protection while not
  // breaking real interview pace.
  chat_message: 30,
}

/**
 * Maximum estimated tokens per single request. If a request would exceed this,
 * it's likely a bug or abuse. Block it.
 */
export const MAX_TOKENS_PER_REQUEST: Record<UsageEventType, number> = {
  research: 10_000,           // visa + local + checklist combined
  guide_generation: 50_000,   // 10 sections × ~5K each
  settling_in_generation: 8_000,
  chat_message: 1_000,
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Check whether a user is allowed to perform an expensive operation.
 * Call this BEFORE starting the operation.
 *
 * Checks both:
 * 1. Monthly generation cap (for generation types)
 * 2. Per-minute rate limit (for all types)
 */
export async function checkUsageLimit(
  userId: string,
  eventType: UsageEventType
): Promise<UsageLimitResult> {
  const supabase = await createClient()
  const tier = await getUserTier(userId)

  // --- Rate limit check (per minute) ---
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
  const { count: recentCount } = await supabase
    .from("usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .gte("created_at", oneMinuteAgo)

  const rateLimit = RATE_LIMITS_PER_MINUTE[eventType]
  if ((recentCount ?? 0) >= rateLimit) {
    return {
      allowed: false,
      used: recentCount ?? 0,
      limit: rateLimit,
      reason: "Rate limit exceeded. Please wait a moment before trying again.",
    }
  }

  // --- Monthly generation cap (only for expensive operations) ---
  if (GENERATION_TYPES.includes(eventType)) {
    const monthStart = getMonthStart().toISOString()
    const monthlyLimit = MONTHLY_GENERATION_LIMITS[tier]

    const { count: monthlyCount } = await supabase
      .from("usage_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("event_type", GENERATION_TYPES)
      .gte("created_at", monthStart)

    const used = monthlyCount ?? 0
    if (used >= monthlyLimit) {
      const tierMessage = tier === "free"
        ? "Upgrade to Pro to get more generations."
        : tier === "pro_single"
          ? "Upgrade to Pro+ for more generations, or wait until next month."
          : "Monthly generation limit reached. Your limit resets next month."

      return {
        allowed: false,
        used,
        limit: monthlyLimit,
        reason: `You've used ${used} of ${monthlyLimit} generations this month. ${tierMessage}`,
      }
    }

    return { allowed: true, used, limit: monthlyLimit }
  }

  // Non-generation types: rate limit passed, allowed
  return { allowed: true, used: recentCount ?? 0, limit: rateLimit }
}

/**
 * Record a usage event AFTER the operation completes successfully.
 * Only call this on success — failed operations should not consume quota.
 */
export async function recordUsage(
  userId: string,
  eventType: UsageEventType,
  planId?: string,
  tokenEstimate?: number
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("usage_events")
    .insert({
      user_id: userId,
      event_type: eventType,
      plan_id: planId || null,
      token_estimate: tokenEstimate || null,
    })

  if (error) {
    // Log but don't block — recording failure shouldn't break the user flow.
    // The operation already succeeded at this point.
    console.error("[GoMate] Failed to record usage event:", error)
  }
}

/**
 * Get a user's current usage summary for display in the UI.
 */
export async function getUsageSummary(userId: string): Promise<{
  tier: Tier
  generationsUsed: number
  generationsLimit: number
  resetsAt: string
}> {
  const tier = await getUserTier(userId)
  const monthStart = getMonthStart()
  const supabase = await createClient()

  const { count } = await supabase
    .from("usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("event_type", GENERATION_TYPES)
    .gte("created_at", monthStart.toISOString())

  // Next month start
  const resetsAt = new Date(monthStart)
  resetsAt.setMonth(resetsAt.getMonth() + 1)

  return {
    tier,
    generationsUsed: count ?? 0,
    generationsLimit: MONTHLY_GENERATION_LIMITS[tier],
    resetsAt: resetsAt.toISOString(),
  }
}

// ============================================================
// Helpers
// ============================================================

/** Get the start of the current calendar month in UTC. */
function getMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
