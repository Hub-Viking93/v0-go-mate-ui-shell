// =============================================================
// RisksSection — Phase 3B "what could go wrong, what's blocking"
// =============================================================
// Renders the structured risk list returned by /api/risks. Each risk
// is a card with severity pill, title, explanation, consequence, and
// (when applicable) a clear blocker pill + a CTA to the blocked task.
//
// Phase 3B explicit non-goals:
//   • No alternative pathways (Plan B) — that's Phase 3C.
//   • No "denied/delayed → do X" branching.
//   • No generic "red flag" copy — every risk explains itself from
//     concrete state.
// =============================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  FileWarning,
  Info,
  Loader2,
  ShieldAlert,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RiskDomain =
  | "visa"
  | "money"
  | "document"
  | "timing"
  | "special_circumstance";
type RiskSeverity = "info" | "warning" | "critical";

interface Risk {
  id: string;
  domain: RiskDomain;
  severity: RiskSeverity;
  title: string;
  explanation: string;
  consequence: string;
  isBlocker: boolean;
  blockedTaskRef?: string;
}

interface RiskReport {
  planId: string;
  generatedAt: string;
  risks: Risk[];
  riskCount: number;
  blockerCount: number;
  countsBySeverity: Record<RiskSeverity, number>;
}

const DOMAIN_META: Record<RiskDomain, { label: string; icon: LucideIcon }> = {
  visa: { label: "Visa", icon: ShieldAlert },
  money: { label: "Money", icon: Wallet },
  document: { label: "Documents", icon: FileWarning },
  timing: { label: "Timing", icon: Clock },
  special_circumstance: { label: "Context", icon: Sparkles },
};

const SEVERITY_META: Record<
  RiskSeverity,
  { label: string; icon: LucideIcon; stripe: string; statusText: string; iconColor: string }
> = {
  critical: {
    label: "Critical",
    icon: AlertOctagon,
    stripe: "#B5414C",
    statusText: "text-[#B5414C]",
    iconColor: "text-[#B5414C]",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    stripe: "#C99746",
    statusText: "text-[#8C6B2F]",
    iconColor: "text-[#C99746]",
  },
  info: {
    label: "Info",
    icon: Info,
    stripe: "#7E9088",
    statusText: "text-[#7E9088]",
    iconColor: "text-[#7E9088]",
  },
};

type FilterMode = "all" | "blockers";

export function RisksSection() {
  const [report, setReport] = useState<RiskReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FilterMode>("all");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/risks");
        if (!res.ok) {
          if (res.status === 404) {
            setReport(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as RiskReport;
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

  const visible = useMemo<Risk[]>(() => {
    if (!report) return [];
    return mode === "blockers" ? report.risks.filter((r) => r.isBlocker) : report.risks;
  }, [report, mode]);

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 text-[#7E9088] text-[12.5px] gm-surface px-5 py-4"
        data-testid="risks-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your risks…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="gm-surface p-5" data-testid="risks-section">
        <span className="gm-eyebrow mb-2">Risks &amp; blockers</span>
        <p className="text-[12.5px] text-[#7E9088] mt-2 leading-relaxed">
          {error
            ? `Couldn't load risks: ${error}`
            : "Complete onboarding to see what's risky or blocking in your plan."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-3" data-testid="risks-section">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <span className="gm-eyebrow">Risks &amp; blockers</span>
          <h2 className="text-[15px] font-semibold text-[#1F2A24] mt-1.5" data-testid="risks-heading">
            What could go wrong
          </h2>
          <p className="text-[12px] text-[#7E9088] mt-0.5" data-testid="risks-subtitle">
            {report.blockerCount > 0 && (
              <span className="font-semibold text-[#B5414C]">{report.blockerCount} blocker{report.blockerCount === 1 ? "" : "s"}</span>
            )}
            {report.blockerCount > 0 && report.riskCount > report.blockerCount && (
              <span> · {report.riskCount} total</span>
            )}
          </p>
        </div>
        {report.risks.length > 0 && (
          <div
            className="inline-flex items-center gap-0.5 rounded-md p-0.5 gm-surface-sub"
            data-testid="risks-filter"
          >
            <FilterPill
              active={mode === "all"}
              label={`All (${report.riskCount})`}
              onClick={() => setMode("all")}
            />
            <FilterPill
              active={mode === "blockers"}
              label={`Blockers (${report.blockerCount})`}
              onClick={() => setMode("blockers")}
              tone="rose"
            />
          </div>
        )}
      </div>

      {/* Empty state — nothing to flag */}
      {report.risks.length === 0 && <EmptyState />}

      {/* Filtered empty (mode=blockers but no blockers) */}
      {report.risks.length > 0 && visible.length === 0 && mode === "blockers" && (
        <div className="gm-surface px-3.5 py-3 flex items-center gap-2 text-[12.5px]">
          <CheckCircle2 className="w-4 h-4 text-[#3F6B53]" strokeWidth={1.7} />
          <span className="text-[#1F2A24]">
            No active blockers. Switch to <span className="font-semibold">All</span> to see warnings + info.
          </span>
        </div>
      )}

      {/* Risk items */}
      <ul className="space-y-2.5">
        {visible.map((r) => (
          <li key={r.id}>
            <RiskCard risk={r} />
          </li>
        ))}
      </ul>

      <p className="text-[11.5px] text-[#7E9088] italic">
        These are state-driven flags, not legal advice. Authorities make the final call.
      </p>
    </section>
  );
}

function FilterPill({
  active,
  label,
  onClick,
  tone,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tone?: "rose";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-[11.5px] font-medium rounded transition-colors duration-[150ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
        active
          ? tone === "rose"
            ? "bg-[#F5DDDF] text-[#8B2F38]"
            : "bg-[#1F2A24] text-white"
          : "text-[#7E9088] hover:text-[#1F2A24]",
      )}
    >
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="gm-surface px-4 py-4">
      <div className="flex items-start gap-3">
        <span
          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: "#E4F2EA", color: "#2C6440" }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.7} />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-[#1F2A24]">No active risks surfaced</p>
          <p className="text-[11.5px] text-[#7E9088] mt-1 leading-relaxed">
            We didn't find anything fragile or blocking in your current plan state.
            New risks will appear here as deadlines approach or required documents change.
          </p>
        </div>
      </div>
    </div>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  const sev = SEVERITY_META[risk.severity];
  const dom = DOMAIN_META[risk.domain];
  const SevIcon = sev.icon;
  const DomIcon = dom.icon;
  const taskHref = blockedTaskHref(risk.blockedTaskRef);
  return (
    <article
      className="gm-surface px-3.5 py-3"
      style={{ borderLeft: `3px solid ${sev.stripe}` }}
      data-testid={`risk-card-${risk.id}`}
      data-risk-severity={risk.severity}
      data-risk-domain={risk.domain}
      data-risk-blocker={risk.isBlocker ? "true" : "false"}
    >
      <header className="flex items-start gap-2 mb-1.5">
        <SevIcon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", sev.iconColor)} strokeWidth={1.7} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3 className="text-[13px] font-semibold leading-snug text-[#1F2A24]">{risk.title}</h3>
            <span className={cn("text-[11px] font-medium", sev.statusText)}>
              {sev.label}
            </span>
            {risk.isBlocker && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#B5414C]">
                <Ban className="w-2.5 h-2.5" strokeWidth={2} />
                Blocker
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[#7E9088]">
              <DomIcon className="w-3 h-3" strokeWidth={1.7} />
              {dom.label}
            </span>
          </div>
          <p className="text-[12px] text-[#4E5F57] leading-relaxed">{risk.explanation}</p>
        </div>
      </header>

      <div className="pl-5 space-y-1">
        <p className="text-[11.5px] leading-relaxed">
          <span className="font-semibold text-[#1F2A24]">If left:</span>{" "}
          <span className="text-[#7E9088]">{risk.consequence}</span>
        </p>

        {taskHref && (
          <Link href={taskHref} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#3F6B53] hover:text-[#2D3E36] transition-colors">
            View blocked task
            <ArrowRight className="w-3 h-3" strokeWidth={1.7} />
          </Link>
        )}
      </div>
    </article>
  );
}

/**
 * Resolve a `blockedTaskRef` like "settling-in:reg-population" into a
 * checklist URL that lands the user on the right tab. We can't link
 * directly to the open task-sheet today (it's controlled by per-card
 * state), so we drop them on the right tab where the task is visible.
 */
function blockedTaskHref(ref: string | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith("settling-in:")) return "/checklist?tab=post-move";
  if (ref.startsWith("pre-departure:")) return "/checklist?tab=pre-move";
  return "/checklist";
}
