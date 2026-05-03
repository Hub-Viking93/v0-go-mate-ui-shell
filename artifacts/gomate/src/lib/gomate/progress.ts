import { type Profile, getRequiredFields } from "@/lib/gomate/profile-schema"
import { getFilledFields } from "@/lib/gomate/state-machine"
import { getProfileReadiness } from "@/lib/gomate/core-state"
import { isPostArrivalStage } from "@/lib/gomate/post-arrival"

/**
 * Server-only progress computation.
 * Progress is always computed, never stored — single source of truth.
 */

export interface ProgressResult {
  interview_progress: {
    percentage: number
    completed: number
    total: number
    confirmed: number
    confirmedPercentage: number
    readyToLock: boolean
  }
  post_arrival_progress: {
    percentage: number
    completed: number
    total: number
  }
  compliance_progress: {
    percentage: number
    completed: number
    total: number
  }
}

export function computeInterviewProgress(profile: Profile | null): {
  percentage: number
  completed: number
  total: number
  confirmed: number
  confirmedPercentage: number
  readyToLock: boolean
} {
  if (!profile) {
    return {
      percentage: 0,
      completed: 0,
      total: 0,
      confirmed: 0,
      confirmedPercentage: 0,
      readyToLock: false,
    }
  }
  const requiredFields = getRequiredFields(profile)
  const filledFields = getFilledFields(profile)
  const readiness = getProfileReadiness(profile)
  const total = requiredFields.length
  const completed = filledFields.length
  return {
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    completed,
    total,
    confirmed: readiness.confirmedCount,
    confirmedPercentage:
      total > 0 ? Math.round((readiness.confirmedCount / total) * 100) : 0,
    readyToLock: readiness.isReadyForLock,
  }
}

export function computePostArrivalProgress(
  tasks: Array<{ status: string; is_legal_requirement?: boolean | null }>,
  options?: { stage?: string | null }
): {
  percentage: number
  completed: number
  total: number
} {
  if (!isPostArrivalStage(options?.stage)) {
    return {
      percentage: 0,
      completed: 0,
      total: 0,
    }
  }

  const total = tasks.length
  const completed = tasks.filter((t) => t.status === "completed").length
  return {
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    completed,
    total,
  }
}

export function computeComplianceProgress(
  tasks: Array<{ status: string; is_legal_requirement?: boolean | null }>,
  options?: { stage?: string | null }
): {
  percentage: number
  completed: number
  total: number
} {
  if (!isPostArrivalStage(options?.stage)) {
    return {
      percentage: 0,
      completed: 0,
      total: 0,
    }
  }

  const requiredTasks = tasks.filter((task) => task.is_legal_requirement)
  const completed = requiredTasks.filter((task) => task.status === "completed").length

  return {
    percentage:
      requiredTasks.length > 0
        ? Math.round((completed / requiredTasks.length) * 100)
        : 0,
    completed,
    total: requiredTasks.length,
  }
}

export function computeProgress(
  profile: Profile | null,
  tasks: Array<{ status: string; is_legal_requirement?: boolean | null }>,
  options?: { stage?: string | null }
): ProgressResult {
  return {
    interview_progress: computeInterviewProgress(profile),
    post_arrival_progress: computePostArrivalProgress(tasks, options),
    compliance_progress: computeComplianceProgress(tasks, options),
  }
}
