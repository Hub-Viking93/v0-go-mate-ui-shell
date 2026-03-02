"use client"

import { type ReactNode } from "react"
import { Lock, Sparkles, ArrowRight, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Feature-to-tier mapping (client-side mirror of server TIER_FEATURES)
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

export type Tier = "free" | "pro_single" | "pro_plus"

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

export function hasAccess(tier: Tier, feature: Feature): boolean {
  return TIER_FEATURES[tier]?.[feature] ?? false
}

// Minimum tier required for a feature
function getRequiredTier(feature: Feature): Tier {
  if (TIER_FEATURES.free[feature]) return "free"
  if (TIER_FEATURES.pro_single[feature]) return "pro_single"
  return "pro_plus"
}

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  pro_single: "Pro",
  pro_plus: "Pro+",
}

// Feature display metadata
const FEATURE_META: Partial<Record<Feature, { title: string; description: string }>> = {
  visa_recommendation: {
    title: "Visa Recommendations",
    description: "Get personalized visa pathway recommendations based on your profile.",
  },
  local_requirements: {
    title: "Local Requirements",
    description: "Discover country-specific registration, healthcare, and legal requirements.",
  },
  cost_of_living: {
    title: "Cost of Living Analysis",
    description: "Compare living costs and plan your budget for your destination.",
  },
  budget_planner: {
    title: "Budget Planner",
    description: "Get a detailed budget breakdown including moving costs and savings targets.",
  },
  guides: {
    title: "Relocation Guides",
    description: "AI-generated guides tailored to your destination and purpose.",
  },
  documents: {
    title: "Document Checklist",
    description: "A personalized checklist of all documents you need for your move.",
  },
  booking: {
    title: "Flight Search",
    description: "Search and compare flights from multiple travel platforms.",
  },
  post_relocation: {
    title: "Post-Relocation Support",
    description: "Settling-in checklists, compliance alerts, and ongoing AI assistance.",
  },
}

// ============================================================
// TierGate: Wraps content and shows blur + CTA if user lacks access
// ============================================================
interface TierGateProps {
  /** Current user tier */
  tier: Tier
  /** Feature required to view the content */
  feature: Feature
  /** Content to show when user has access */
  children: ReactNode
  /** Optional: callback when upgrade is clicked */
  onUpgrade?: () => void
  /** Show as card or inline */
  variant?: "card" | "inline" | "overlay"
  /** Custom title for the CTA */
  ctaTitle?: string
  /** Custom description for the CTA */
  ctaDescription?: string
  /** Additional className */
  className?: string
}

export function TierGate({
  tier,
  feature,
  children,
  onUpgrade,
  variant = "overlay",
  ctaTitle,
  ctaDescription,
  className,
}: TierGateProps) {
  if (hasAccess(tier, feature)) {
    return <>{children}</>
  }

  const meta = FEATURE_META[feature]
  const requiredTier = getRequiredTier(feature)
  const title = ctaTitle || meta?.title || "Premium Feature"
  const description = ctaDescription || meta?.description || "Upgrade to unlock this feature."

  if (variant === "card") {
    return (
      <UpgradeCTACard
        title={title}
        description={description}
        requiredTier={requiredTier}
        onUpgrade={onUpgrade}
        className={className}
      />
    )
  }

  if (variant === "inline") {
    return (
      <UpgradeCTAInline
        title={title}
        requiredTier={requiredTier}
        onUpgrade={onUpgrade}
        className={className}
      />
    )
  }

  // Default: overlay with blurred content behind it
  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none select-none blur-[6px] opacity-60" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px] rounded-xl">
        <UpgradeCTAOverlay
          title={title}
          description={description}
          requiredTier={requiredTier}
          onUpgrade={onUpgrade}
        />
      </div>
    </div>
  )
}

// ============================================================
// Full Page Gate: For entire pages that are locked (Documents, Booking, etc.)
// ============================================================
interface FullPageGateProps {
  tier: Tier
  feature: Feature
  children: ReactNode
  onUpgrade?: () => void
}

export function FullPageGate({ tier, feature, children, onUpgrade }: FullPageGateProps) {
  if (hasAccess(tier, feature)) {
    return <>{children}</>
  }

  const meta = FEATURE_META[feature]
  const requiredTier = getRequiredTier(feature)

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground text-balance">
            {meta?.title || "Premium Feature"}
          </h2>
          <p className="text-muted-foreground text-pretty leading-relaxed">
            {meta?.description || "Upgrade your plan to unlock this feature."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Crown className="w-3 h-3 mr-1" />
            {TIER_LABELS[requiredTier]} required
          </Badge>
        </div>
        <Button onClick={onUpgrade} size="lg" className="gap-2 w-full max-w-xs">
          <Sparkles className="w-4 h-4" />
          Upgrade to {TIER_LABELS[requiredTier]}
          <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="text-xs text-muted-foreground">
          {requiredTier === "pro_single" ? "One-time payment of 699 kr" : "Starting at 249 kr/mo"}
        </p>
      </div>
    </div>
  )
}

// ============================================================
// CTA Variants
// ============================================================

function UpgradeCTAOverlay({
  title,
  description,
  requiredTier,
  onUpgrade,
}: {
  title: string
  description: string
  requiredTier: Tier
  onUpgrade?: () => void
}) {
  return (
    <div className="text-center space-y-3 p-6 max-w-sm">
      <div className="mx-auto w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground text-balance">{title}</h3>
      <p className="text-sm text-muted-foreground text-pretty">{description}</p>
      <Button onClick={onUpgrade} size="sm" className="gap-2">
        <Sparkles className="w-3.5 h-3.5" />
        Upgrade to {TIER_LABELS[requiredTier]}
      </Button>
    </div>
  )
}

function UpgradeCTACard({
  title,
  description,
  requiredTier,
  onUpgrade,
  className,
}: {
  title: string
  description: string
  requiredTier: Tier
  onUpgrade?: () => void
  className?: string
}) {
  return (
    <Card className={cn("p-6 border-dashed border-primary/30 bg-primary/5", className)}>
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-xl bg-primary/10 shrink-0">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              <Crown className="w-2.5 h-2.5 mr-1" />
              {TIER_LABELS[requiredTier]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button onClick={onUpgrade} size="sm" variant="outline" className="gap-2 mt-1">
            <Sparkles className="w-3.5 h-3.5" />
            Upgrade
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function UpgradeCTAInline({
  title,
  requiredTier,
  onUpgrade,
  className,
}: {
  title: string
  requiredTier: Tier
  onUpgrade?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onUpgrade}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-dashed border-primary/30",
        "hover:bg-primary/10 transition-colors text-left w-full",
        className
      )}
    >
      <Lock className="w-4 h-4 text-primary shrink-0" />
      <span className="text-sm text-foreground font-medium">{title}</span>
      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 ml-auto">
        {TIER_LABELS[requiredTier]}
      </Badge>
    </button>
  )
}
