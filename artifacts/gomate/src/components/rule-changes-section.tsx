// =============================================================
// RuleChangesSection — Phase 6D "rule-change monitoring"
// =============================================================
// Plan-relevant rule changes only — derived from an authored feed
// + a per-user predicate engine. Each card shows: source / changedAt /
// summary / why-it-affects-you / impact / recommended action + ack
// controls (mark reviewed / dismiss / request research).
//
// NOT a news feed, NOT a content library, NOT a real-time monitor —
// orientation around a small curated set of changes that map onto
// profile state.
// =============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Globe,
  Info,
  Loader2,
  PawPrint,
  RefreshCw,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---- Types (mirror of API) ------------------------------------------------

type RuleChangeAreaKind =
  | "visa_immigration"
  | "border_entry"
  | "pet_import"
  | "housing_market"
  | "tax_residency"
  | "social_security";

type RuleChangeImpactSeverity = "info" | "review" | "action_required";

type RuleChangeAckStatus = "new" | "reviewed" | "dismissed" | "research_requested";

type RuleChangeRecommendedActionKind =
  | "review_pathway"
  | "review_documents"
  | "rerun_research"
  | "confirm_official_source"
  | "monitor";

interface RuleChangeRecommendedAction {
  kind: RuleChangeRecommendedActionKind;
  title: string;
  body: string;
  targetRoute: string | null;
}

interface RuleChangeRelevant {
  id: string;
  title: string;
  area: RuleChangeAreaKind;
  source: { name: string; kind: string; url?: string | null };
  changedAt: string;
  publishedAt: string;
  summary: string;
  shouldTriggerResearch: boolean;
  isRelevant: true;
  relevanceReasons: string[];
  impactSummary: string;
  impactSeverity: RuleChangeImpactSeverity;
  recommendedAction: RuleChangeRecommendedAction;
  ack: { status: RuleChangeAckStatus; at: string };
}

interface RuleChangeReport {
  planId: string;
  generatedAt: string;
  relevant: RuleChangeRelevant[];
  totalFeed: number;
  counts: {
    new: number;
    reviewed: number;
    dismissed: number;
    researchRequested: number;
    actionRequired: number;
  };
}

// ---- Visual meta ----------------------------------------------------------

// Light-sage admin styling (parity with ReadinessSection): severity is
// signalled by a thin left-edge stripe + inline status text, not a red
// AI-warning pill.
const SEVERITY_META: Record<
  RuleChangeImpactSeverity,
  { label: string; stripe: string; statusText: string; icon: LucideIcon }
> = {
  action_required: {
    label: "Action required",
    stripe: "#B5414C",
    statusText: "text-[#B5414C]",
    icon: AlertOctagon,
  },
  review: {
    label: "Review",
    stripe: "#C99746",
    statusText: "text-[#8C6B2F]",
    icon: AlertTriangle,
  },
  info: {
    label: "Info",
    stripe: "#8FB9BF",
    statusText: "text-[#4E5F57]",
    icon: Info,
  },
};

const AREA_ICON: Record<RuleChangeAreaKind, LucideIcon> = {
  visa_immigration: ShieldAlert,
  border_entry: Globe,
  pet_import: PawPrint,
  housing_market: Building2,
  tax_residency: Globe,
  social_security: ShieldAlert,
};

const ACK_LABEL: Record<RuleChangeAckStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  research_requested: "Research requested",
};

const ACK_TONE: Record<RuleChangeAckStatus, string> = {
  new: "text-[#3F6B53]",
  reviewed: "text-[#7E9088]",
  dismissed: "text-[#7E9088]",
  research_requested: "text-[#3F6B6F]",
};

// ---- Component ------------------------------------------------------------

interface RuleChangesSectionProps {
  /** Optional scope: only show rule-changes whose area matches one of
   *  these. Used by /immigration to scope to visa/border, while
   *  /guidance shows the full feed. */
  areaFilter?: RuleChangeAreaKind[];
}

export function RuleChangesSection({ areaFilter }: RuleChangesSectionProps = {}) {
  const [report, setReport] = useState<RuleChangeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rule-changes");
      if (!res.ok) {
        if (res.status === 404) {
          setReport(null);
          setError(null);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as RuleChangeReport;
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patch = useCallback(
    async (id: string, action: "review" | "dismiss" | "request_research" | "reset") => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/rule-changes/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as RuleChangeReport & { ok: true };
        setReport(data);
      } catch (e) {
        console.warn("[rule-changes] patch failed:", e);
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const grouped = useMemo(() => {
    if (!report) return { active: [], dismissed: [], scopedTotal: 0 };
    const filtered = areaFilter
      ? report.relevant.filter((r) => areaFilter.includes(r.area))
      : report.relevant;
    const active: RuleChangeRelevant[] = [];
    const dismissed: RuleChangeRelevant[] = [];
    for (const r of filtered) {
      if (r.ack.status === "dismissed") dismissed.push(r);
      else active.push(r);
    }
    return { active, dismissed, scopedTotal: filtered.length };
  }, [report, areaFilter]);

  if (loading && !report) {
    return (
      <div
        className="flex items-center gap-2 text-[#7E9088] text-[12.5px] gm-surface px-5 py-4"
        data-testid="rule-changes-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading recent rule changes…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="gm-surface p-5" data-testid="rule-changes-section">
        <span className="gm-eyebrow mb-2">Rule changes</span>
        <p className="text-[12.5px] text-[#7E9088] mt-2 leading-relaxed">
          {error
            ? `Couldn't load rule-changes: ${error}`
            : "Set destination + arrival date to surface plan-affecting rule changes."}
        </p>
      </div>
    );
  }

  // Empty relevance set — render an honest empty state, not a feed.
  if (grouped.active.length === 0 && grouped.dismissed.length === 0) {
    return (
      <section className="space-y-3" data-testid="rule-changes-section" data-rule-changes-state="empty">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <span className="gm-eyebrow">Rule changes</span>
            <h2
              className="text-[15px] font-semibold text-[#1F2A24] mt-1.5"
              data-testid="rule-changes-heading"
            >
              Plan-affecting changes
            </h2>
            <p className="text-[12px] text-[#7E9088] mt-0.5 leading-relaxed">
              Curated rule changes from official sources, filtered to what touches your plan. Not a news feed.
            </p>
          </div>
          <span className="text-[11px] tabular-nums text-[#7E9088] gm-surface-sub px-2 py-1">
            {report.totalFeed} on file · 0 affect you
          </span>
        </div>
        <div className="gm-surface px-5 py-6 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto text-[#3F6B53] mb-2" strokeWidth={1.7} />
          <p className="text-[13px] font-semibold text-[#1F2A24]">No active rule-changes affect your plan right now</p>
          <p className="text-[11.5px] text-[#7E9088] mt-1 leading-relaxed max-w-md mx-auto">
            We only surface entries whose scope matches your destination, citizenship, pets, or other plan dimensions. We'll flag new ones here when they come in.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-testid="rule-changes-section" data-rule-changes-state="active">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <span className="gm-eyebrow">Rule changes</span>
          <h2
            className="text-[15px] font-semibold text-[#1F2A24] mt-1.5"
            data-testid="rule-changes-heading"
          >
            Plan-affecting changes
          </h2>
          <p className="text-[12px] text-[#7E9088] mt-0.5 leading-relaxed">
            Curated rule changes from official sources, filtered to what touches your plan. Not a news feed.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] tabular-nums text-[#7E9088] gm-surface-sub px-2 py-1">
            {report.totalFeed} on file · {grouped.active.length} affect you
          </span>
          {(() => {
            const scopedActionRequired = grouped.active.filter(
              (r) => r.impactSeverity === "action_required",
            ).length;
            return scopedActionRequired > 0 ? (
              <span
                className="text-[11px] font-semibold tabular-nums px-2 py-1 rounded text-[#8B2F38]"
                style={{ background: "#F5DDDF", border: "1px solid #E8B8BD" }}
                data-testid="rule-changes-action-count"
              >
                {scopedActionRequired} action required
              </span>
            ) : null;
          })()}
        </div>
      </div>

      <ul className="space-y-2.5" data-testid="rule-changes-active-list">
        {grouped.active.map((r) => (
          <RuleChangeCard
            key={r.id}
            change={r}
            busy={busyId === r.id}
            onReview={() => patch(r.id, "review")}
            onDismiss={() => patch(r.id, "dismiss")}
            onRequestResearch={() => patch(r.id, "request_research")}
          />
        ))}
      </ul>

      {grouped.dismissed.length > 0 && (
        <details
          open={showDismissed}
          onToggle={(e) => setShowDismissed((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="text-[11px] text-muted-foreground cursor-pointer">
            Dismissed ({grouped.dismissed.length})
          </summary>
          <ul className="space-y-2.5 mt-2" data-testid="rule-changes-dismissed-list">
            {grouped.dismissed.map((r) => (
              <RuleChangeCard
                key={r.id}
                change={r}
                busy={busyId === r.id}
                dimmed
                onReview={() => patch(r.id, "reset")}
                onDismiss={() => patch(r.id, "reset")}
                onRequestResearch={() => patch(r.id, "request_research")}
              />
            ))}
          </ul>
        </details>
      )}

      <p className="text-[11.5px] text-[#7E9088] italic leading-relaxed">
        Rule-changes are curated from official sources, not a real-time crawl. Always verify the latest
        on the source's own page before acting on something time-critical.
      </p>
    </section>
  );
}

// ---- Card -----------------------------------------------------------------

function RuleChangeCard({
  change,
  busy,
  dimmed,
  onReview,
  onDismiss,
  onRequestResearch,
}: {
  change: RuleChangeRelevant;
  busy: boolean;
  dimmed?: boolean;
  onReview: () => void;
  onDismiss: () => void;
  onRequestResearch: () => void;
}) {
  const sev = SEVERITY_META[change.impactSeverity];
  const SeverityIcon = sev.icon;
  const AreaIcon = AREA_ICON[change.area] ?? Info;
  return (
    <li
      className={cn("gm-surface", dimmed && "opacity-60")}
      style={{ borderLeft: `3px solid ${sev.stripe}` }}
      data-testid={`rule-change-${change.id}`}
      data-rule-change-area={change.area}
      data-rule-change-severity={change.impactSeverity}
      data-rule-change-ack-status={change.ack.status}
    >
      <div className="px-3.5 py-2.5">
      <header className="flex items-start gap-2 mb-1.5">
        <SeverityIcon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", sev.statusText)} strokeWidth={1.7} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap mb-0.5">
            <h3 className="text-[13px] font-semibold leading-snug text-[#1F2A24]">{change.title}</h3>
            <span className={cn("text-[11px] font-medium", sev.statusText)}>{sev.label}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[#7E9088]">
            <span className="inline-flex items-center gap-1">
              <AreaIcon className="w-3 h-3" strokeWidth={1.7} />
              {areaLabel(change.area)}
            </span>
            <span>·</span>
            <span>{change.source.name}</span>
            <span>·</span>
            <span>effective {formatDate(change.changedAt)}</span>
            <span>·</span>
            <span className={cn("font-medium", ACK_TONE[change.ack.status])}>
              {ACK_LABEL[change.ack.status]}
            </span>
            {change.shouldTriggerResearch && (
              <>
                <span>·</span>
                <span
                  className="text-[#3F6B6F]"
                  data-testid={`rule-change-${change.id}-research-flag`}
                >
                  Research-triggering
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="pl-5 space-y-1.5">
        <p className="text-xs text-foreground/85 leading-relaxed">
          <span className="font-semibold not-italic text-foreground/80">Change: </span>
          {change.summary}
        </p>
        <div data-testid={`rule-change-${change.id}-relevance`}>
          <p className="text-[11px] font-semibold text-foreground/80 mb-0.5">Why this affects you:</p>
          <ul className="space-y-0.5">
            {change.relevanceReasons.map((r, i) => (
              <li
                key={i}
                className="text-[11px] text-foreground/85 leading-relaxed flex items-start gap-2"
              >
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-cyan-500/70" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-foreground/85 leading-relaxed">
          <span className="font-semibold not-italic text-foreground/80">Impact: </span>
          {change.impactSummary}
        </p>
        <div
          className="gm-surface-sub p-2.5"
          data-testid={`rule-change-${change.id}-action`}
          data-action-kind={change.recommendedAction.kind}
        >
          <p className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-[#7E9088] mb-1 flex items-center gap-1">
            <ArrowRight className="w-3 h-3" strokeWidth={1.7} />
            Recommended next step
          </p>
          <p className="text-[12.5px] font-semibold text-[#1F2A24] leading-snug">{change.recommendedAction.title}</p>
          <p className="text-[11.5px] text-[#7E9088] mt-0.5 leading-relaxed">
            {change.recommendedAction.body}
          </p>
          {change.recommendedAction.targetRoute && (
            <Link
              href={change.recommendedAction.targetRoute}
              className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#3F6B53] hover:text-[#2D3E36] transition-colors mt-1.5"
              data-testid={`rule-change-${change.id}-action-link`}
            >
              Open <ArrowRight className="w-3 h-3" strokeWidth={1.7} />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {change.ack.status !== "reviewed" && !dimmed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReview}
              disabled={busy}
              className="h-7 text-[11px] px-2"
              data-testid={`rule-change-${change.id}-review`}
            >
              <Check className="w-3 h-3 mr-1" />
              Mark reviewed
            </Button>
          )}
          {change.shouldTriggerResearch && change.ack.status !== "research_requested" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRequestResearch}
              disabled={busy}
              className="h-7 text-[11px] px-2"
              data-testid={`rule-change-${change.id}-rerun-research`}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Re-run research
            </Button>
          )}
          {!dimmed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              disabled={busy}
              className="h-7 text-[11px] px-2 text-muted-foreground"
              data-testid={`rule-change-${change.id}-dismiss`}
            >
              <X className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
          )}
          {dimmed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReview}
              disabled={busy}
              className="h-7 text-[11px] px-2"
              data-testid={`rule-change-${change.id}-restore`}
            >
              Restore
            </Button>
          )}
          {change.source.url && (
            <a
              href={change.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              data-testid={`rule-change-${change.id}-source-link`}
            >
              Verify on source ↗
            </a>
          )}
        </div>
      </div>
      </div>
    </li>
  );
}

function areaLabel(a: RuleChangeAreaKind): string {
  switch (a) {
    case "visa_immigration":
      return "Visa / immigration";
    case "border_entry":
      return "Border entry";
    case "pet_import":
      return "Pet import";
    case "housing_market":
      return "Housing market";
    case "tax_residency":
      return "Tax residency";
    case "social_security":
      return "Social security";
    default:
      return a;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}
