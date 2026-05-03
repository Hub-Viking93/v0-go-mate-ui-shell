import type { ProfileReadiness } from "./core-state"
import type { Profile } from "./profile-schema"
import { currentLocationLooksLikeExitTaxCountry } from "./exit-tax-list"

// =====================================================================
// computeVisibleCards — single source of truth for which dashboard
// cards should render given a profile and plan snapshot.
//
// Each card has a stable string ID (CardId) and a numeric priority used
// for ordering inside a dynamic grid. Lower number = render first.
// Priority bands:
//   10–19   visa (most critical — visa drives everything else)
//   20–29   deadline-sensitive (departure tax, schools, posted worker)
//   30–39   financial (cost of living, affordability, tax, banking)
//   40–49   advisory / informational (cultural, history, etc.)
//   50–59   stage-gated (pre-departure, compliance, settling-in,
//           wellbeing) — only shown for the matching lifecycle stage
//   60–69   always-on plan helpers (consistency, commonly-forgotten)
// =====================================================================

export type CardId =
  // Always-on
  | "visa-routes-card"
  | "cost-of-living-card"
  | "affordability-card"
  | "profile-details-card"
  | "tax-overview-card"
  | "cultural-card"
  | "plan-consistency-alerts"
  | "commonly-forgotten-section"
  // Research-gated
  | "visa-research-card"
  | "document-progress-card"
  | "interactive-document-checklist"
  | "banking-wizard-card"
  // Visa-pathway-gated
  | "visa-status-stepper"
  | "visa-deadline-card"
  // Stage-gated
  | "pre-departure-timeline"
  | "compliance-alerts"
  | "compliance-calendar"
  | "compliance-timeline"
  | "settling-in-task-card"
  | "wellbeing-checkin"
  | "arrival-banner"
  // Profile-conditional specialist cards
  | "schools-card"
  | "pet-relocation-card"
  | "income-compliance-card"
  | "family-reunion-card"
  | "departure-tax-card"
  | "vehicle-import-card"
  | "property-purchase-card"
  | "posted-worker-card"
  | "trailing-spouse-card"
  | "chronic-health-card"
  | "prior-visa-history-card"

export interface VisibleCard {
  id: CardId
  priority: number
  /** Short human-readable explanation of why this card was included. */
  reason: string
}

export interface VisibleCardSet {
  /** All visible cards, sorted ascending by priority. */
  cards: VisibleCard[]
  /** IDs that are always shown regardless of profile state. */
  alwaysShow: CardId[]
  /**
   * IDs shown because of profile-conditional or stage-conditional rules,
   * paired with the reason they were included.
   */
  conditionallyShown: { id: CardId; reason: string }[]
}

export interface PlanStateInput {
  stage?: string | null
  lifecycle?: string | null
  locked?: boolean | null
  /** "completed" | "in_progress" | "partial" | "failed" | null */
  researchStatus?: string | null
  /** Mirrors `relocation_plans.visa_application` JSONB column. */
  visaApplication?: { selectedVisaType?: string | null } | null
}

const ALWAYS_SHOW: { id: CardId; priority: number; reason: string }[] = [
  { id: "visa-routes-card", priority: 10, reason: "Always shown" },
  { id: "profile-details-card", priority: 12, reason: "Always shown" },
  { id: "cost-of-living-card", priority: 30, reason: "Always shown" },
  { id: "affordability-card", priority: 31, reason: "Always shown" },
  { id: "tax-overview-card", priority: 32, reason: "Always shown" },
  { id: "cultural-card", priority: 40, reason: "Always shown" },
  { id: "plan-consistency-alerts", priority: 60, reason: "Always shown" },
  { id: "commonly-forgotten-section", priority: 61, reason: "Always shown" },
]

function isYes(v: string | null | undefined): boolean {
  return typeof v === "string" && v.toLowerCase() === "yes"
}

function childrenCountToInt(v: string | null | undefined): number {
  if (!v) return 0
  const n = parseInt(String(v).match(/\d+/)?.[0] ?? "", 10)
  return Number.isFinite(n) ? n : 0
}

export function computeVisibleCards(
  profile: Profile,
  plan: PlanStateInput,
): VisibleCardSet {
  const cards: VisibleCard[] = []
  const conditionallyShown: { id: CardId; reason: string }[] = []
  const seen = new Set<CardId>()

  const push = (
    id: CardId,
    priority: number,
    reason: string,
    isConditional: boolean,
  ) => {
    if (seen.has(id)) return
    seen.add(id)
    cards.push({ id, priority, reason })
    if (isConditional) conditionallyShown.push({ id, reason })
  }

  for (const c of ALWAYS_SHOW) push(c.id, c.priority, c.reason, false)

  const researchComplete = plan.researchStatus === "completed"
  const stage = plan.stage ?? null
  const lifecycle = plan.lifecycle ?? null
  const isArrived = stage === "arrived" || lifecycle === "arrived"
  const isPreDeparture = stage === "pre_departure"
  const visaPathwaySelected = !!plan.visaApplication?.selectedVisaType

  // Research-gated
  if (researchComplete) {
    push("visa-research-card", 11, "Research complete", true)
    push("document-progress-card", 33, "Research complete", true)
    push("interactive-document-checklist", 34, "Research complete", true)
    push("banking-wizard-card", 35, "Research complete", true)
  }

  // Visa-pathway-gated
  if (visaPathwaySelected) {
    push("visa-status-stepper", 13, "Visa pathway selected", true)
    if (researchComplete) {
      push("visa-deadline-card", 14, "Pathway selected + research complete", true)
    }
  }

  // Stage-gated: pre-departure
  if (isPreDeparture) {
    push("pre-departure-timeline", 50, "Plan stage is pre_departure", true)
  }

  // Stage-gated: arrived
  if (isArrived) {
    push("arrival-banner", 51, "Recently arrived", true)
    push("compliance-alerts", 52, "Arrived — compliance window active", true)
    push("compliance-calendar", 53, "Arrived — compliance window active", true)
    push("compliance-timeline", 54, "Arrived — compliance window active", true)
    push("settling-in-task-card", 55, "Arrived — settling-in active", true)
    push("wellbeing-checkin", 56, "Arrived — wellbeing check-in", true)
  }

  // Profile-conditional specialist cards
  if (childrenCountToInt(profile.children_count) > 0) {
    push("schools-card", 21, "Children in household", true)
  }

  if (profile.pets && profile.pets !== "none") {
    push("pet-relocation-card", 41, `Pet present (${profile.pets})`, true)
  }

  if (profile.purpose === "digital_nomad") {
    push("income-compliance-card", 22, "Digital nomad pathway", true)
  }

  if (profile.visa_role === "dependent" || profile.settlement_reason === "family_reunion") {
    push(
      "family-reunion-card",
      23,
      profile.visa_role === "dependent" ? "Dependent visa role" : "Family-reunion settlement",
      true,
    )
  }

  if (currentLocationLooksLikeExitTaxCountry(profile.current_location)) {
    push("departure-tax-card", 20, "Current location is an exit-tax country", true)
  }

  if (isYes(profile.bringing_vehicle)) {
    push("vehicle-import-card", 42, "Bringing a vehicle", true)
  }

  if (isYes(profile.home_purchase_intent)) {
    push("property-purchase-card", 36, "Plans to purchase property", true)
  }

  if (isYes(profile.posting_or_secondment)) {
    push("posted-worker-card", 24, "Corporate posting / secondment", true)
  }

  if (isYes(profile.spouse_joining) && isYes(profile.spouse_seeking_work)) {
    push("trailing-spouse-card", 37, "Spouse joining and seeking work", true)
  }

  if (
    (profile.healthcare_needs && profile.healthcare_needs !== "none") ||
    (profile.chronic_condition_description && profile.chronic_condition_description.trim().length > 0)
  ) {
    push("chronic-health-card", 38, "Healthcare needs disclosed", true)
  }

  if (isYes(profile.prior_visa) || isYes(profile.visa_rejections)) {
    push(
      "prior-visa-history-card",
      43,
      isYes(profile.visa_rejections) ? "Prior visa rejections" : "Prior visa history",
      true,
    )
  }

  cards.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))

  return {
    cards,
    alwaysShow: ALWAYS_SHOW.map((c) => c.id),
    conditionallyShown,
  }
}

export type DashboardStateId =
  | "start_profile"
  | "collecting_profile"
  | "ready_to_lock"
  | "locked_pre_arrival"
  | "generating"
  | "ready_for_pre_departure"
  | "pre_departure_active"
  | "arrived_setup"
  | "arrived_attention"
  | "arrived_active"

export interface DashboardInterviewProgress {
  percentage: number
  completed: number
  total: number
  confirmed?: number
  confirmedPercentage?: number
  readyToLock?: boolean
}

export interface DashboardProgressSnapshot {
  interview_progress: DashboardInterviewProgress
  post_arrival_progress: {
    percentage: number
    completed: number
    total: number
  }
}

export interface DashboardPlanSnapshot {
  stage?: string | null
  lifecycle?: string | null
  locked?: boolean | null
  canLock?: boolean | null
  canEditProfile?: boolean | null
  readiness?: ProfileReadiness | null
}

export interface DashboardSettlingSummary {
  generated: boolean
  stats: {
    total: number
    completed: number
    overdue: number
    available: number
    locked: number
    legalTotal: number
    legalCompleted: number
    progressPercent: number
  }
}

export interface DashboardState {
  id: DashboardStateId
  title: string
  description: string
  showWelcome: boolean
  showLockAction: boolean
  showUnlockAction: boolean
  showArrivalBanner: boolean
  showArrivedSummary: boolean
  chatActionLabel: string
  profileProgressLabel: string
  profileProgressSubtitle: string
  arrivedActionLabel?: string
  arrivedSummary?: string
  arrivedDetail?: string
}

export function deriveDashboardState(input: {
  plan: DashboardPlanSnapshot | null
  progress: DashboardProgressSnapshot | null
  settlingSummary?: DashboardSettlingSummary | null
}): DashboardState {
  const plan = input.plan
  const progress = input.progress
  const settlingSummary = input.settlingSummary

  const confirmedCount =
    progress?.interview_progress?.confirmed ??
    plan?.readiness?.confirmedCount ??
    progress?.interview_progress?.completed ??
    0
  const requiredCount =
    progress?.interview_progress?.total ?? plan?.readiness?.requiredCount ?? 0
  const confirmedPercentage =
    progress?.interview_progress?.confirmedPercentage ??
    progress?.interview_progress?.percentage ??
    0
  const readyToLock =
    plan?.canLock ??
    progress?.interview_progress?.readyToLock ??
    plan?.readiness?.isReadyForLock ??
    false

  const lifecycle = plan?.lifecycle || "collecting"
  const stage = plan?.stage
  const isLocked = Boolean(plan?.locked)
  const isArrived = lifecycle === "arrived" || stage === "arrived"

  // v2 lifecycle additions. These take precedence over the legacy v1
  // inference branches below so that a plan whose stage is explicitly
  // persisted as one of the new v2 values renders the right dashboard
  // state. UI/copy is intentionally minimal here — Wave 2 will replace
  // these placeholders with the real pre-departure / generation UX.
  if (stage === "generating") {
    return {
      id: "generating",
      title: "Building your relocation plan",
      description:
        "Your specialist agents are generating the first pass of your plan. This usually takes a minute.",
      showWelcome: false,
      showLockAction: false,
      showUnlockAction: false,
      showArrivalBanner: false,
      showArrivedSummary: false,
      chatActionLabel: "Open chat",
      profileProgressLabel: `${confirmedPercentage}%`,
      profileProgressSubtitle: `${confirmedCount} of ${requiredCount} confirmed fields`,
    }
  }

  if (stage === "ready_for_pre_departure") {
    return {
      id: "ready_for_pre_departure",
      title: "Your plan is ready — start pre-departure",
      description:
        "Your relocation plan is generated and locked. The next step is to kick off the pre-departure checklist.",
      showWelcome: false,
      showLockAction: false,
      showUnlockAction: true,
      showArrivalBanner: true,
      showArrivedSummary: false,
      chatActionLabel: "Ask follow-ups",
      profileProgressLabel: `${confirmedPercentage}%`,
      profileProgressSubtitle: `${confirmedCount} of ${requiredCount} confirmed fields`,
    }
  }

  if (stage === "pre_departure") {
    return {
      id: "pre_departure_active",
      title: "Pre-departure in progress",
      description:
        "Track outstanding pre-departure tasks (visa, banking, housing, paperwork) before you move.",
      showWelcome: false,
      showLockAction: false,
      showUnlockAction: false,
      showArrivalBanner: true,
      showArrivedSummary: false,
      chatActionLabel: "Ask follow-ups",
      profileProgressLabel: `${confirmedPercentage}%`,
      profileProgressSubtitle: `${confirmedCount} of ${requiredCount} confirmed fields`,
    }
  }


  if (isArrived) {
    // Profile stat card always shows profile field progress, not settling-in tasks
    const profileLabel = `${confirmedPercentage}%`
    const profileSubtitle = `${confirmedCount} of ${requiredCount} confirmed fields`

    if (!settlingSummary || !settlingSummary.generated) {
      return {
        id: "arrived_setup",
        title: "You have arrived",
        description:
          "Set up or open your settling-in checklist to track the first critical post-arrival tasks.",
        showWelcome: false,
        showLockAction: false,
        showUnlockAction: false,
        showArrivalBanner: false,
        showArrivedSummary: true,
        chatActionLabel: "Ask questions",
        profileProgressLabel: profileLabel,
        profileProgressSubtitle: profileSubtitle,
        arrivedActionLabel: "Open settling-in",
        arrivedSummary: "Your post-arrival checklist is ready to set up.",
        arrivedDetail:
          "Open the settling-in workspace to generate tasks, deadlines, and legal follow-up steps.",
      }
    }

    if (settlingSummary.stats.overdue > 0) {
      return {
        id: "arrived_attention",
        title: "Post-arrival action needed",
        description:
          "Overdue or urgent settling-in work needs attention. The dashboard should surface that work directly.",
        showWelcome: false,
        showLockAction: false,
        showUnlockAction: false,
        showArrivalBanner: false,
        showArrivedSummary: true,
        chatActionLabel: "Ask questions",
        profileProgressLabel: profileLabel,
        profileProgressSubtitle: profileSubtitle,
        arrivedActionLabel: "Resolve overdue work",
        arrivedSummary: `${settlingSummary.stats.overdue} overdue task${settlingSummary.stats.overdue === 1 ? "" : "s"} need attention`,
        arrivedDetail: `${settlingSummary.stats.available} active task${settlingSummary.stats.available === 1 ? "" : "s"} and ${settlingSummary.stats.legalCompleted}/${settlingSummary.stats.legalTotal} legal requirements completed.`,
      }
    }

    return {
      id: "arrived_active",
      title: "Post-arrival execution is underway",
      description:
        "Track active settling-in work, legal obligations, and what should be done next from one place.",
      showWelcome: false,
      showLockAction: false,
      showUnlockAction: false,
      showArrivalBanner: false,
      showArrivedSummary: true,
      chatActionLabel: "Ask questions",
      profileProgressLabel: profileLabel,
      profileProgressSubtitle: profileSubtitle,
      arrivedActionLabel:
        settlingSummary.stats.available > 0 ? "Continue settling-in" : "Review checklist",
      arrivedSummary:
        settlingSummary.stats.available > 0
          ? `${settlingSummary.stats.available} active task${settlingSummary.stats.available === 1 ? "" : "s"} ready now`
          : "No urgent tasks are blocking you right now",
      arrivedDetail: `${settlingSummary.stats.legalCompleted}/${settlingSummary.stats.legalTotal} legal requirements completed, ${settlingSummary.stats.locked} task${settlingSummary.stats.locked === 1 ? "" : "s"} still locked.`,
    }
  }

  if (isLocked) {
    return {
      id: "locked_pre_arrival",
      title: "Your plan is locked and ready",
      description:
        "Profile collection is complete. You can review outputs, chat for follow-up questions, and confirm arrival when you move.",
      showWelcome: false,
      showLockAction: false,
      showUnlockAction: true,
      showArrivalBanner: true,
      showArrivedSummary: false,
      chatActionLabel: "Ask questions",
      profileProgressLabel: `${confirmedPercentage}%`,
      profileProgressSubtitle: `${confirmedCount} of ${requiredCount} confirmed fields`,
    }
  }

  if (readyToLock) {
    return {
      id: "ready_to_lock",
      title: "Your profile is ready to lock",
      description:
        "All required profile fields are confirmed. Lock the plan when you are ready to freeze the profile and move to the next stage.",
      showWelcome: false,
      showLockAction: true,
      showUnlockAction: false,
      showArrivalBanner: false,
      showArrivedSummary: false,
      chatActionLabel: "Continue planning",
      profileProgressLabel: `${confirmedPercentage}%`,
      profileProgressSubtitle: `${confirmedCount} of ${requiredCount} confirmed fields`,
    }
  }

  if (confirmedCount === 0) {
    return {
      id: "start_profile",
      title: "Start your relocation profile",
      description:
        "Use chat to confirm the first required details. The dashboard will expand automatically as soon as real plan state exists.",
      showWelcome: true,
      showLockAction: false,
      showUnlockAction: false,
      showArrivalBanner: false,
      showArrivedSummary: false,
      chatActionLabel: "Start planning",
      profileProgressLabel: `${confirmedPercentage}%`,
      profileProgressSubtitle: `${confirmedCount} of ${requiredCount} confirmed fields`,
    }
  }

  return {
    id: "collecting_profile",
    title: "Your profile is still in progress",
    description:
      "Keep confirming required move details in chat. The dashboard is showing canonical progress from the current plan state.",
    showWelcome: false,
    showLockAction: false,
    showUnlockAction: false,
    showArrivalBanner: false,
    showArrivedSummary: false,
    chatActionLabel: "Continue planning",
    profileProgressLabel: `${confirmedPercentage}%`,
    profileProgressSubtitle: `${confirmedCount} of ${requiredCount} confirmed fields`,
  }
}
