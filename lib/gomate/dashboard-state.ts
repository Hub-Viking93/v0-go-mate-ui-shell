import type { ProfileReadiness } from "./core-state"

export type DashboardStateId =
  | "start_profile"
  | "collecting_profile"
  | "ready_to_lock"
  | "locked_pre_arrival"
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
    progress?.interview_progress.confirmed ??
    plan?.readiness?.confirmedCount ??
    progress?.interview_progress.completed ??
    0
  const requiredCount =
    progress?.interview_progress.total ?? plan?.readiness?.requiredCount ?? 0
  const confirmedPercentage =
    progress?.interview_progress.confirmedPercentage ??
    progress?.interview_progress.percentage ??
    0
  const readyToLock =
    plan?.canLock ??
    progress?.interview_progress.readyToLock ??
    plan?.readiness?.isReadyForLock ??
    false

  const lifecycle = plan?.lifecycle || "collecting"
  const isLocked = Boolean(plan?.locked)
  const isArrived = lifecycle === "arrived" || plan?.stage === "arrived"

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
