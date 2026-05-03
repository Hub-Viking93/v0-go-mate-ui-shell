

import { cn } from "@/lib/utils"
import { Check, Circle, Clock, FileText, Send, ThumbsUp, XCircle } from "lucide-react"

export type VisaApplicationStatus =
  | "not_started"
  | "preparing"
  | "submitted"
  | "awaiting_decision"
  | "approved"
  | "rejected"

const STEPS: { status: VisaApplicationStatus; label: string; icon: typeof Circle }[] = [
  { status: "not_started", label: "Not Started", icon: Circle },
  { status: "preparing", label: "Preparing", icon: FileText },
  { status: "submitted", label: "Submitted", icon: Send },
  { status: "awaiting_decision", label: "Awaiting Decision", icon: Clock },
  { status: "approved", label: "Approved", icon: ThumbsUp },
]

function getStepIndex(status: VisaApplicationStatus | null): number {
  if (!status || status === "not_started") return 0
  if (status === "rejected") return 3 // stays at awaiting_decision level visually
  const idx = STEPS.findIndex((s) => s.status === status)
  return idx >= 0 ? idx : 0
}

interface VisaStatusStepperProps {
  currentStatus: VisaApplicationStatus | null
  onStatusChange: (status: VisaApplicationStatus) => void
  disabled?: boolean
}

export function VisaStatusStepper({ currentStatus, onStatusChange, disabled }: VisaStatusStepperProps) {
  const activeIndex = getStepIndex(currentStatus)
  const isRejected = currentStatus === "rejected"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-1">
        {STEPS.map((step, i) => {
          const isActive = i === activeIndex && !isRejected
          const isCompleted = i < activeIndex && !isRejected
          const StepIcon = step.icon

          return (
            <div key={step.status} className="flex flex-1 items-center">
              <button
                onClick={() => !disabled && onStatusChange(step.status)}
                disabled={disabled}
                className={cn(
                  "flex flex-col items-center gap-1.5 flex-1 group",
                  !disabled && "cursor-pointer"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                  isCompleted && "bg-emerald-500 border-emerald-500 text-white",
                  isActive && "bg-primary border-primary text-primary-foreground",
                  !isActive && !isCompleted && "border-muted-foreground/30 text-muted-foreground bg-background",
                  !disabled && !isActive && !isCompleted && "group-hover:border-primary/50",
                )}>
                  {isCompleted ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                </div>
                <span className={cn(
                  "text-[10px] text-center leading-tight",
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "h-0.5 flex-1 mx-1 mt-[-18px]",
                  i < activeIndex && !isRejected ? "bg-emerald-500" : "bg-muted-foreground/20"
                )} />
              )}
            </div>
          )
        })}
      </div>

      {/* Rejected state */}
      {isRejected && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Application Rejected</p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">You can re-select a visa type to start a new application.</p>
          </div>
          <button
            onClick={() => !disabled && onStatusChange("not_started")}
            disabled={disabled}
            className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 underline"
          >
            Reset
          </button>
        </div>
      )}

      {/* Set as rejected button (only visible when awaiting) */}
      {currentStatus === "awaiting_decision" && (
        <button
          onClick={() => !disabled && onStatusChange("rejected")}
          disabled={disabled}
          className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
        >
          Mark as rejected
        </button>
      )}
    </div>
  )
}
