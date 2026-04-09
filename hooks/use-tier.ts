"use client"

import { useEffect, useState, useCallback } from "react"
import type { Tier, Feature } from "@/components/tier-gate"
import { hasAccess } from "@/components/tier-gate"

interface SubscriptionData {
  subscription: {
    id: string
    tier: Tier
    billing_cycle: string | null
    status: string
    plan_limit: number
    price_usd: number
    expires_at: string | null
  }
  plans: {
    current: number
    limit: number
    canCreate: boolean
  }
  features: Record<string, boolean>
}

interface UseTierReturn {
  tier: Tier
  loading: boolean
  features: Record<string, boolean>
  planCount: number
  planLimit: number
  canCreatePlan: boolean
  can: (feature: Feature) => boolean
  refresh: () => Promise<void>
}

export function useTier(): UseTierReturn {
  const [tier, setTier] = useState<Tier>("free")
  const [loading, setLoading] = useState(true)
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [planCount, setPlanCount] = useState(0)
  const [planLimit, setPlanLimit] = useState(1)
  const [canCreate, setCanCreate] = useState(false)

  const fetchTier = useCallback(async () => {
    try {
      const response = await fetch("/api/subscription")
      if (response.ok) {
        const data: SubscriptionData = await response.json()
        setTier(data.subscription.tier as Tier)
        setFeatures(data.features)
        setPlanCount(data.plans.current)
        setPlanLimit(data.plans.limit)
        setCanCreate(data.plans.canCreate)
      }
    } catch (error) {
      console.error("[GoMate] Error fetching tier:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTier()
  }, [fetchTier])

  const can = useCallback(
    (feature: Feature) => {
      if (loading) return true // Optimistic: assume access while loading
      return hasAccess(tier, feature)
    },
    [tier, loading]
  )

  return {
    tier,
    loading,
    features,
    planCount,
    planLimit,
    canCreatePlan: canCreate,
    can,
    refresh: fetchTier,
  }
}
