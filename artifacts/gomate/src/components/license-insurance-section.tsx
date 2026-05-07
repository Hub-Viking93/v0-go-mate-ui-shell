// =============================================================
// LicenseInsuranceSection — Phase 4C
// =============================================================
// Two distinct guidance cards on the dashboard:
//
//   • Driver's licence — "do you need to act?" with status pill
//     (needed / likely_carries_over / not_required / uncertain),
//     reasoning bullets, and a recommended next action.
//
//   • Insurance — stacked items by urgency (now → first_30d → later
//     → not_required), each with priority pill (must_have / recommended /
//     optional), why-it-matters, and recommended action. Top-priority
//     item is visually elevated.
//
// Phase 4C explicit non-goals:
//   • No insurance product comparison.
//   • No marketplace / affiliate logic.
//   • No 4D cultural deep-dive.
// =============================================================

import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  HelpCircle,
  Loader2,
  Car,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type GuidanceUrgency = "now" | "first_30d" | "later" | "not_required";
type LicenceStatus = "needed" | "likely_carries_over" | "not_required" | "uncertain";

interface DriversLicenseGuidance {
  status: LicenceStatus;
  summary: string;
  reasoning: string[];
  recommendedAction: string | null;
  urgency: GuidanceUrgency;
  relatedTaskRef?: string;
}

interface InsuranceItem {
  id: string;
  label: string;
  whyItMatters: string;
  recommendedAction: string;
  urgency: GuidanceUrgency;
  priority: "must_have" | "recommended" | "optional";
  relatedTaskRef?: string;
}

interface InsuranceGuidance {
  items: InsuranceItem[];
  topPriority: InsuranceItem | null;
}

interface Phase4cReport {
  planId: string;
  generatedAt: string;
  driversLicense: DriversLicenseGuidance;
  insurance: InsuranceGuidance;
}

const URGENCY_META: Record<
  GuidanceUrgency,
  { label: string; pill: string; icon: LucideIcon }
> = {
  now: {
    label: "Act now",
    pill: "border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/10",
    icon: AlertOctagon,
  },
  first_30d: {
    label: "First 30 days",
    pill: "border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10",
    icon: Clock,
  },
  later: {
    label: "Later",
    pill: "border-stone-500/40 text-stone-700 dark:text-stone-300 bg-stone-500/10",
    icon: Compass,
  },
  not_required: {
    label: "No action",
    pill: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
    icon: CheckCircle2,
  },
};

const LICENCE_STATUS_META: Record<
  LicenceStatus,
  { label: string; pill: string }
> = {
  needed: {
    label: "Action needed",
    pill: "border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10",
  },
  likely_carries_over: {
    label: "Likely fine",
    pill: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
  },
  not_required: {
    label: "Not required",
    pill: "border-stone-500/40 text-stone-700 dark:text-stone-300 bg-stone-500/10",
  },
  uncertain: {
    label: "Check destination rules",
    pill: "border-stone-500/40 text-stone-700 dark:text-stone-300 bg-stone-500/10",
  },
};

const PRIORITY_META: Record<
  InsuranceItem["priority"],
  { label: string; pill: string }
> = {
  must_have: {
    label: "Must-have",
    pill: "border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/10",
  },
  recommended: {
    label: "Recommended",
    pill: "border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10",
  },
  optional: {
    label: "Optional",
    pill: "border-stone-500/40 text-stone-700 dark:text-stone-300 bg-stone-500/10",
  },
};

export function LicenseInsuranceSection() {
  const [report, setReport] = useState<Phase4cReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/license-insurance");
        if (!res.ok) {
          if (res.status === 404) {
            setReport(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as Phase4cReport;
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
        data-testid="license-insurance-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your licence + insurance guidance…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div
        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-card p-6"
        data-testid="license-insurance-section"
      >
        <h3 className="text-sm font-semibold mb-1">Driver's licence &amp; insurance</h3>
        <p className="text-xs text-muted-foreground">
          {error
            ? `Couldn't load 4C guidance: ${error}`
            : "Active plan needed to derive licence + insurance guidance."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="license-insurance-section">
      <div>
        <h2
          className="text-lg font-semibold text-foreground"
          data-testid="license-insurance-heading"
        >
          Driver's licence &amp; insurance
        </h2>
        <p className="text-xs text-muted-foreground">
          Two often-missed pieces of the move. We tell you whether to act now, in the first
          month, or just keep on file.
        </p>
      </div>

      <DriversLicenseCard guidance={report.driversLicense} />
      <InsuranceCard guidance={report.insurance} />

      <p className="text-[11px] text-muted-foreground italic">
        Guidance is state-driven, not legal advice. Final eligibility rules sit with the
        destination authority + insurer.
      </p>
    </section>
  );
}

// ---- Driver's licence card ------------------------------------------------

function DriversLicenseCard({ guidance }: { guidance: DriversLicenseGuidance }) {
  const statusMeta = LICENCE_STATUS_META[guidance.status];
  const urgencyMeta = URGENCY_META[guidance.urgency];
  const taskHref = relatedTaskHref(guidance.relatedTaskRef);
  const stripe = stripeForUrgency(guidance.urgency);
  return (
    <article
      className="bg-card px-3.5 py-2.5"
      style={{
        border: "1px solid #DCE7DF",
        borderLeft: `3px solid ${stripe}`,
        borderRadius: "6px",
      }}
      data-testid="drivers-license-card"
      data-licence-status={guidance.status}
      data-licence-urgency={guidance.urgency}
    >
      <header className="flex items-baseline gap-2 flex-wrap mb-1">
        <Car className="w-3.5 h-3.5 text-[#7E9088] shrink-0 self-center" strokeWidth={1.7} />
        <h3 className="text-[13px] font-semibold text-[#1F2A24]">Driver's licence</h3>
        <span className={cn("text-[11px] font-medium", statusTextForUrgency(guidance.urgency))}>
          {statusMeta.label}
        </span>
        <span className="text-[11px] text-[#7E9088]">·</span>
        <span className="text-[11px] text-[#7E9088]">{urgencyMeta.label}</span>
      </header>
      <p className="text-[12px] text-[#4E5F57] leading-relaxed pl-5">{guidance.summary}</p>

      <div className="pl-5 space-y-2 mt-2">
        {guidance.reasoning.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[#7E9088] font-semibold mb-1">
              Why we landed here
            </p>
            <ul className="space-y-0.5 list-disc ml-4 text-[11px] text-[#4E5F57]">
              {guidance.reasoning.map((r, i) => (
                <li key={i} className="leading-relaxed">{r}</li>
              ))}
            </ul>
          </div>
        )}

        {guidance.recommendedAction && (
          <p className="text-[12px] leading-relaxed">
            <span className="font-semibold text-[#1F2A24]">Next: </span>
            <span className="text-[#4E5F57]">{guidance.recommendedAction}</span>
          </p>
        )}

        {!guidance.recommendedAction && guidance.urgency === "not_required" && (
          <p className="text-[12px] text-[#3F6B53] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" strokeWidth={1.7} />
            Nothing to do here right now.
          </p>
        )}

        {taskHref && (
          <Link
            href={taskHref}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3F6B53] hover:underline"
          >
            View task
            <ArrowRight className="w-3 h-3" strokeWidth={1.7} />
          </Link>
        )}
      </div>
    </article>
  );
}

function stripeForUrgency(u: GuidanceUrgency): string {
  switch (u) {
    case "now":
      return "#B5414C";
    case "first_30d":
      return "#C99746";
    case "later":
      return "#8FB9BF";
    case "not_required":
    default:
      return "#DCE7DF";
  }
}

function statusTextForUrgency(u: GuidanceUrgency): string {
  switch (u) {
    case "now":
      return "text-[#B5414C]";
    case "first_30d":
      return "text-[#8C6B2F]";
    case "later":
      return "text-[#3F6B6F]";
    case "not_required":
    default:
      return "text-[#4E5F57]";
  }
}

// ---- Insurance card -------------------------------------------------------

function InsuranceCard({ guidance }: { guidance: InsuranceGuidance }) {
  return (
    <article
      className="bg-card px-3.5 py-2.5"
      style={{ border: "1px solid #DCE7DF", borderRadius: "6px" }}
      data-testid="insurance-card"
    >
      <header className="flex items-baseline gap-2 flex-wrap mb-1">
        <ShieldCheck className="w-3.5 h-3.5 text-[#7E9088] shrink-0 self-center" strokeWidth={1.7} />
        <h3 className="text-[13px] font-semibold text-[#1F2A24]">Insurance</h3>
        {guidance.topPriority && (
          <span
            className={cn(
              "text-[11px] font-medium",
              statusTextForUrgency(guidance.topPriority.urgency),
            )}
          >
            Priority: {guidance.topPriority.label}
          </span>
        )}
      </header>
      <p className="text-[12px] text-[#4E5F57] mb-2 pl-5">
        What to start with, what can wait, and what you don't need to think about for now.
      </p>

      {guidance.items.length === 0 ? (
        <div className="pl-5">
          <p className="text-[12px] text-[#7E9088] italic">
            Nothing surfaced for your current state. As your stage advances, items will
            appear here.
          </p>
        </div>
      ) : (
        <ul className="pl-5 space-y-1.5">
          {guidance.items.map((item, idx) => (
            <li key={item.id}>
              <InsuranceRow item={item} isTop={idx === 0} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function InsuranceRow({ item, isTop }: { item: InsuranceItem; isTop: boolean }) {
  const urgency = URGENCY_META[item.urgency];
  const priority = PRIORITY_META[item.priority];
  const UrgencyIcon = urgency.icon;
  const taskHref = relatedTaskHref(item.relatedTaskRef);
  const stripe = stripeForUrgency(item.urgency);
  void priority; // legacy ref
  return (
    <article
      className="bg-card px-3 py-2"
      style={{
        border: "1px solid #DCE7DF",
        borderLeft: `3px solid ${stripe}`,
        borderRadius: "6px",
      }}
      data-testid={`insurance-item-${item.id}`}
      data-insurance-urgency={item.urgency}
      data-insurance-priority={item.priority}
    >
      <div className="flex items-start gap-2">
        <UrgencyIcon
          className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", statusTextForUrgency(item.urgency))}
          strokeWidth={1.7}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <p className="text-[13px] font-medium leading-snug text-[#1F2A24]">{item.label}</p>
            <span className={cn("text-[11px] font-medium", statusTextForUrgency(item.urgency))}>
              {item.urgency === "now"
                ? isTop
                  ? "Important — act now"
                  : "Act now"
                : urgency.label}
            </span>
            {item.priority === "must_have" && (
              <span className="text-[11px] text-[#7E9088]">· Must have</span>
            )}
            {item.priority === "recommended" && (
              <span className="text-[11px] text-[#7E9088]">· Recommended</span>
            )}
          </div>
          <p className="text-[11px] text-[#4E5F57] leading-relaxed mt-0.5">
            <span className="font-semibold text-[#1F2A24]">Why: </span>
            {item.whyItMatters}
          </p>
          <p className="text-[11px] text-[#4E5F57] leading-relaxed mt-0.5">
            <span className="font-semibold text-[#1F2A24]">Next: </span>
            {item.recommendedAction}
          </p>
          {taskHref && (
            <Link
              href={taskHref}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3F6B53] hover:underline mt-1"
            >
              View task
              <ArrowRight className="w-3 h-3" strokeWidth={1.7} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function urgencyClassFromUrgency(u: GuidanceUrgency): string {
  switch (u) {
    case "now":
      return "text-rose-600 dark:text-rose-400";
    case "first_30d":
      return "text-amber-600 dark:text-amber-400";
    case "later":
      return "text-stone-500 dark:text-stone-400";
    case "not_required":
      return "text-emerald-600 dark:text-emerald-400";
  }
}

function relatedTaskHref(ref: string | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith("settling-in:")) return "/checklist?tab=post-move";
  if (ref.startsWith("pre-departure:")) return "/checklist?tab=pre-move";
  return "/checklist";
}

// Marker import to keep tooling happy.
void HelpCircle;
