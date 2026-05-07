// =============================================================
// SetupFlowsSection — Phase 4B "banking + healthcare flows"
// =============================================================
// Renders two distinct stepper-style flows returned by /api/flows.
// Each step shows status (✓ / ▶ / ⊘ / ○ / —), prerequisite gating,
// "why this step matters", and an optional deep-link to the underlying
// settling-in task.
//
// Phase 4B explicit non-goals:
//   • Not just two task lists in a new layout — prerequisite gating
//     is what makes this an active flow.
//   • No banking-product comparison (4C+).
//   • No insurance depth (4C).
//   • No cultural deep-dive.
// =============================================================

import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertOctagon,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Circle,
  Clock,
  HeartPulse,
  Loader2,
  MinusCircle,
  Play,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type FlowKey = "banking" | "healthcare";
type FlowStatus = "blocked" | "ready" | "in_progress" | "completed";
type FlowStepStatus =
  | "blocked"
  | "ready"
  | "in_progress"
  | "completed"
  | "not_applicable";

interface FlowStep {
  id: string;
  title: string;
  whyThisStepMatters: string;
  prerequisites: string[];
  status: FlowStepStatus;
  blockedReason?: string;
  relatedTaskRef?: string;
  nextAction?: string;
}
interface Flow {
  id: FlowKey;
  label: string;
  goal: string;
  status: FlowStatus;
  currentStepId: string | null;
  steps: FlowStep[];
}
interface FlowsReport {
  planId: string;
  generatedAt: string;
  banking: Flow;
  healthcare: Flow;
}

const FLOW_META: Record<FlowKey, { icon: LucideIcon; tone: string }> = {
  banking: {
    icon: Banknote,
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  healthcare: {
    icon: HeartPulse,
    tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

const FLOW_STATUS_META: Record<
  FlowStatus,
  { label: string; pill: string }
> = {
  blocked: {
    label: "Blocked",
    pill: "border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/10",
  },
  ready: {
    label: "Ready to start",
    pill: "border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10",
  },
  in_progress: {
    label: "In progress",
    pill: "border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10",
  },
  completed: {
    label: "Completed",
    pill: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
  },
};

const STEP_STATUS_META: Record<
  FlowStepStatus,
  { icon: LucideIcon; iconClass: string; label: string }
> = {
  blocked: { icon: AlertOctagon, iconClass: "text-rose-600 dark:text-rose-400", label: "Blocked" },
  ready: { icon: Circle, iconClass: "text-stone-400 dark:text-stone-500", label: "Ready" },
  in_progress: { icon: Play, iconClass: "text-indigo-600 dark:text-indigo-400", label: "In progress" },
  completed: { icon: CheckCircle2, iconClass: "text-emerald-600 dark:text-emerald-400", label: "Completed" },
  not_applicable: { icon: MinusCircle, iconClass: "text-stone-300 dark:text-stone-600", label: "Not applicable" },
};

export function SetupFlowsSection() {
  const [report, setReport] = useState<FlowsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/flows");
        if (!res.ok) {
          if (res.status === 404) {
            setReport(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as FlowsReport;
        if (!cancelled) setReport(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 text-muted-foreground p-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-card"
        data-testid="setup-flows-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your setup flows…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div
        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-card p-6"
        data-testid="setup-flows-section"
      >
        <h3 className="text-sm font-semibold mb-1">Banking &amp; healthcare setup</h3>
        <p className="text-xs text-muted-foreground">
          {error
            ? `Couldn't load setup flows: ${error}`
            : "Active plan needed to derive your banking + healthcare setup flows."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="setup-flows-section">
      <div>
        <h2 className="text-lg font-semibold text-foreground" data-testid="setup-flows-heading">
          Banking &amp; healthcare setup
        </h2>
        <p className="text-xs text-muted-foreground">
          Two ordered setup flows. Each step gates on the previous so you don't
          show up at the bank without an address registration.
        </p>
      </div>

      <FlowCard flow={report.banking} />
      <FlowCard flow={report.healthcare} />

      <p className="text-[11px] text-muted-foreground italic">
        Setup flows mirror the underlying checklist. Mark tasks completed in the
        checklist to advance these.
      </p>
    </section>
  );
}

function FlowCard({ flow }: { flow: Flow }) {
  const meta = FLOW_META[flow.id];
  const Icon = meta.icon;
  const statusMeta = FLOW_STATUS_META[flow.status];
  const completed = flow.steps.filter(
    (s) => s.status === "completed" || s.status === "not_applicable",
  ).length;
  // Map flow status to a calm inline status word + colour. "Important"
  // is reserved for genuine blockers; in_progress / complete / ready get
  // calm status copy.
  const statusText =
    flow.status === "blocked"
      ? "text-[#B5414C]"
      : flow.status === "in_progress"
        ? "text-[#8C6B2F]"
        : flow.status === "completed"
          ? "text-[#3F6B53]"
          : "text-[#4E5F57]";
  void statusMeta; // legacy reference; kept for future use
  void meta;
  return (
    <article
      className="bg-card px-3.5 py-2.5"
      style={{ border: "1px solid #DCE7DF", borderRadius: "6px" }}
      data-testid={`flow-${flow.id}`}
      data-flow-status={flow.status}
      data-current-step={flow.currentStepId ?? ""}
    >
      <header className="flex items-baseline gap-2 flex-wrap mb-2">
        <Icon className="w-3.5 h-3.5 text-[#7E9088] shrink-0 self-center" strokeWidth={1.7} />
        <h3 className="text-[13px] font-semibold text-[#1F2A24]">{flow.label}</h3>
        <span className={cn("text-[11px] font-medium", statusText)}>
          {flow.status === "blocked"
            ? "Important — pending"
            : flow.status === "in_progress"
              ? "In progress"
              : flow.status === "completed"
                ? "Complete"
                : "Ready to start"}
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-[#4E5F57] font-medium">
          {completed} / {flow.steps.length}
        </span>
      </header>
      <p className="text-[12px] text-[#4E5F57] mb-3 leading-relaxed">{flow.goal}</p>

      <ol className="space-y-1.5" data-testid={`flow-steps-${flow.id}`}>
        {flow.steps.map((step, idx) => (
          <li key={step.id}>
            <FlowStepRow
              step={step}
              index={idx + 1}
              isCurrent={flow.currentStepId === step.id}
            />
          </li>
        ))}
      </ol>
    </article>
  );
}

function FlowStepRow({
  step,
  index,
  isCurrent,
}: {
  step: FlowStep;
  index: number;
  isCurrent: boolean;
}) {
  const meta = STEP_STATUS_META[step.status];
  const StatusIcon = meta.icon;
  const taskHref = relatedTaskHref(step.relatedTaskRef);
  const isDone = step.status === "completed" || step.status === "not_applicable";
  // Calm severity stripe: amber when current, stone for blocked/pending,
  // sage when done. No more rose ring, no more AI-warning red bubbles.
  const stripe = isCurrent
    ? "#7BB091"
    : step.status === "blocked"
      ? "#7E9088"
      : step.status === "completed"
        ? "#7BB091"
        : "#DCE7DF";
  void meta; // legacy reference; status-icon kept inline
  return (
    <article
      className="bg-card px-3 py-2"
      style={{
        border: "1px solid #DCE7DF",
        borderLeft: `3px solid ${stripe}`,
        borderRadius: "6px",
      }}
      data-testid={`flow-step-${step.id}`}
      data-step-status={step.status}
      data-step-current={isCurrent ? "true" : "false"}
    >
      <div className="flex items-start gap-2">
        <StatusIcon
          className={cn(
            "w-3.5 h-3.5 shrink-0 mt-0.5",
            step.status === "completed"
              ? "text-[#3F6B53]"
              : step.status === "blocked"
                ? "text-[#7E9088]"
                : "text-[#4E5F57]",
          )}
          strokeWidth={1.7}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <p
              className={cn(
                "text-[13px] font-medium leading-snug text-[#1F2A24]",
                isDone && "line-through text-[#7E9088]",
              )}
            >
              <span className="text-[#7E9088] mr-1.5">{index}.</span>
              {step.title}
            </p>
            {isCurrent && (
              <span className="text-[11px] font-medium text-[#3F6B53]">Priority — do this next</span>
            )}
          </div>
          <p className="text-[11px] text-[#4E5F57] leading-relaxed mt-0.5">
            <span className="font-semibold text-[#1F2A24]">Why this step: </span>
            {step.whyThisStepMatters}
          </p>
          {step.status === "blocked" && step.blockedReason && (
            <p className="text-[11px] text-[#7E9088] leading-relaxed mt-0.5">
              <span className="font-semibold text-[#4E5F57]">Pending: </span>
              {step.blockedReason}
            </p>
          )}
          {!isDone && step.nextAction && (
            <p className="text-[11px] text-foreground/80 italic mt-1.5">
              <span className="font-semibold not-italic">Next: </span>
              {step.nextAction}
            </p>
          )}
          {taskHref && (
            <Link
              href={taskHref}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline mt-1.5"
            >
              View task
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function relatedTaskHref(ref: string | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith("settling-in:")) return "/checklist?tab=post-move";
  if (ref.startsWith("pre-departure:")) return "/checklist?tab=pre-move";
  return "/checklist";
}
