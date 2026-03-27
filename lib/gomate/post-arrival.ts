import { computeAvailableTasks } from "@/lib/gomate/settling-in-generator"

export type SettlingTaskStatus =
  | "locked"
  | "available"
  | "in_progress"
  | "completed"
  | "skipped"
  | "overdue"

export type TaskUrgency = "overdue" | "urgent" | "approaching" | "normal"
export type ComplianceScope = "required" | "recommended"
export type ComplianceStatus =
  | "none"
  | "completed"
  | "overdue"
  | "urgent"
  | "upcoming"

export interface SettlingTaskRow {
  id: string
  title: string
  status: string | null
  depends_on: string[] | null
  deadline_at?: string | null
  deadline_days?: number | null
  is_legal_requirement?: boolean | null
}

export interface BlockedByTask {
  id: string
  title: string
}

export interface EnrichedSettlingTask extends SettlingTaskRow {
  status: SettlingTaskStatus
  depends_on: string[]
  days_until_deadline: number | null
  urgency: TaskUrgency
  compliance_scope: ComplianceScope
  compliance_status: ComplianceStatus
  block_reason?: "PREREQUISITES_INCOMPLETE"
  blocked_by?: BlockedByTask[]
}

export interface SettlingStats {
  total: number
  completed: number
  overdue: number
  available: number
  locked: number
  legalTotal: number
  legalCompleted: number
  progressPercent: number
  compliancePercent: number
}

export interface HiddenPostArrivalState {
  hiddenTaskCount: number
  hiddenCompletedCount: number
  hiddenRequiredCount: number
  hiddenRequiredCompletedCount: number
  generatedFlag: boolean
  arrivalDatePresent: boolean
}

function toDeadlineDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function withDerivedDeadline<T extends SettlingTaskRow>(
  task: T,
  arrivalDate: string | null
): T {
  if (task.deadline_at || task.deadline_days == null || !arrivalDate) {
    return {
      ...task,
      depends_on: (task.depends_on as string[]) || [],
    }
  }

  const anchoredDate = new Date(arrivalDate)
  anchoredDate.setDate(anchoredDate.getDate() + task.deadline_days)

  return {
    ...task,
    depends_on: (task.depends_on as string[]) || [],
    deadline_at: anchoredDate.toISOString(),
  }
}

function toComplianceScope(task: SettlingTaskRow): ComplianceScope {
  return task.is_legal_requirement ? "required" : "recommended"
}

function toComplianceStatus(task: {
  compliance_scope: ComplianceScope
  status: SettlingTaskStatus
  urgency: TaskUrgency
}): ComplianceStatus {
  if (task.compliance_scope !== "required") {
    return "none"
  }

  if (task.status === "completed") {
    return "completed"
  }

  if (task.urgency === "overdue") {
    return "overdue"
  }

  if (task.urgency === "urgent" || task.urgency === "approaching") {
    return "urgent"
  }

  return "upcoming"
}

export function isPostArrivalStage(stage: string | null | undefined): boolean {
  return stage === "arrived"
}

export function zeroSettlingStats(): SettlingStats {
  return {
    total: 0,
    completed: 0,
    overdue: 0,
    available: 0,
    locked: 0,
    legalTotal: 0,
    legalCompleted: 0,
    progressPercent: 0,
    compliancePercent: 0,
  }
}

export function summarizeHiddenPostArrivalState(input: {
  tasks: Array<{ status: string | null; is_legal_requirement?: boolean | null }>
  generatedFlag: boolean
  arrivalDate: string | null
}): HiddenPostArrivalState | null {
  const hiddenTaskCount = input.tasks.length

  if (
    hiddenTaskCount === 0 &&
    !input.generatedFlag &&
    !input.arrivalDate
  ) {
    return null
  }

  const hiddenCompletedCount = input.tasks.filter(
    (task) => task.status === "completed"
  ).length
  const requiredTasks = input.tasks.filter((task) => task.is_legal_requirement)
  const hiddenRequiredCompletedCount = requiredTasks.filter(
    (task) => task.status === "completed"
  ).length

  return {
    hiddenTaskCount,
    hiddenCompletedCount,
    hiddenRequiredCount: requiredTasks.length,
    hiddenRequiredCompletedCount,
    generatedFlag: input.generatedFlag,
    arrivalDatePresent: Boolean(input.arrivalDate),
  }
}

export function buildSettlingView<T extends SettlingTaskRow>(input: {
  tasks: T[]
  arrivalDate: string | null
  now?: Date
}): {
  tasks: Array<T & EnrichedSettlingTask>
  overdueIds: string[]
  nowAvailableIds: string[]
  stats: SettlingStats
} {
  const now = input.now || new Date()
  const tasksWithDeadlines = input.tasks.map((task) =>
    withDerivedDeadline(task, input.arrivalDate)
  )

  const nowAvailableIds = computeAvailableTasks(
    tasksWithDeadlines.map((task) => ({
      id: task.id,
      status: task.status || "locked",
      depends_on: task.depends_on || [],
    }))
  )

  const overdueIds: string[] = []
  const tasksWithStatus = tasksWithDeadlines.map((task) => {
    const deadlineAt = toDeadlineDate(task.deadline_at)
    let effectiveStatus = (task.status || "locked") as SettlingTaskStatus

    if (
      deadlineAt &&
      deadlineAt.getTime() < now.getTime() &&
      effectiveStatus !== "completed" &&
      effectiveStatus !== "skipped" &&
      effectiveStatus !== "overdue"
    ) {
      effectiveStatus = "overdue"
      overdueIds.push(task.id)
    } else if (
      effectiveStatus === "locked" &&
      nowAvailableIds.includes(task.id)
    ) {
      effectiveStatus = "available"
    }

    return {
      ...task,
      status: effectiveStatus,
      depends_on: task.depends_on || [],
    }
  })

  const completedIds = new Set(
    tasksWithStatus
      .filter((task) => task.status === "completed")
      .map((task) => task.id)
  )

  const enrichedTasks: Array<T & EnrichedSettlingTask> = tasksWithStatus.map((task) => {
    const deadlineAt = toDeadlineDate(task.deadline_at)
    const daysUntilDeadline = deadlineAt
      ? Math.ceil((deadlineAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null

    let urgency: TaskUrgency = "normal"
    if (deadlineAt && task.status !== "completed" && task.status !== "skipped") {
      if (task.status === "overdue" || (daysUntilDeadline ?? 0) < 0) {
        urgency = "overdue"
      } else if ((daysUntilDeadline ?? 0) <= 1) {
        urgency = "urgent"
      } else if ((daysUntilDeadline ?? 0) <= 7) {
        urgency = "approaching"
      }
    }

    const unmetDeps = task.depends_on.filter((depId) => !completedIds.has(depId))
    const blockedBy = unmetDeps
      .map((depId) => {
        const dependency = tasksWithStatus.find((candidate) => candidate.id === depId)
        if (!dependency) return null
        return { id: depId, title: dependency.title }
      })
      .filter((candidate): candidate is BlockedByTask => candidate !== null)

    const complianceScope = toComplianceScope(task)

    return {
      ...task,
      days_until_deadline: daysUntilDeadline,
      urgency,
      compliance_scope: complianceScope,
      compliance_status: toComplianceStatus({
        compliance_scope: complianceScope,
        status: task.status,
        urgency,
      }),
      block_reason:
        task.status === "locked" && blockedBy.length > 0
          ? "PREREQUISITES_INCOMPLETE"
          : undefined,
      blocked_by: task.status === "locked" && blockedBy.length > 0 ? blockedBy : undefined,
    } as T & EnrichedSettlingTask
  })

  const total = enrichedTasks.length
  const completed = enrichedTasks.filter((task) => task.status === "completed").length
  const overdue = enrichedTasks.filter((task) => task.status === "overdue").length
  const available = enrichedTasks.filter(
    (task) => task.status === "available" || task.status === "in_progress"
  ).length
  const legalTasks = enrichedTasks.filter(
    (task) => task.compliance_scope === "required"
  )
  const legalCompleted = legalTasks.filter(
    (task) => task.status === "completed"
  ).length

  return {
    tasks: enrichedTasks,
    overdueIds,
    nowAvailableIds: nowAvailableIds.filter((taskId) => {
      const task = tasksWithStatus.find((candidate) => candidate.id === taskId)
      return task?.status === "available"
    }),
    stats: {
      total,
      completed,
      overdue,
      available,
      locked: enrichedTasks.filter((task) => task.status === "locked").length,
      legalTotal: legalTasks.length,
      legalCompleted,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      compliancePercent:
        legalTasks.length > 0 ? Math.round((legalCompleted / legalTasks.length) * 100) : 0,
    },
  }
}
