// PreDepartureTimeline — week-by-week move plan UI.
//
// Self-contained component. Reads from GET /api/pre-departure, generates
// via POST /api/pre-departure/generate, updates statuses via PATCH
// /api/pre-departure/:actionId.
//
// Visual system: matches the dashboard / immigration / guidance
// "sage stationery" pass — eyebrow rhythm, gm-surface cards, 3px
// severity stripes (not full tinted backgrounds), brand-green CTAs,
// inline status text instead of multi-coloured pill clusters.

import { useEffect, useMemo, useState } from "react";
import {
  Plane,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
  ChevronRight,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TaskDetailSheet,
  type TaskDetailViewModel,
  type TaskWalkthroughView,
  type VaultDocRefView,
} from "@/components/task-detail-sheet";
import {
  ResearchProvenanceBadge,
  type ResearchProvenance,
} from "@/components/research-provenance-badge";
import { ResearchSuggestionsBanner } from "@/components/research-suggestions-banner";

type ActionStatus = "not_started" | "in_progress" | "complete" | "blocked" | "skipped";
type Urgency = "overdue" | "urgent" | "approaching" | "normal";
type DeadlineType = "legal" | "practical" | "recommended";

interface ActionView {
  id: string;
  title: string;
  description: string;
  category: string;
  weeksBeforeMoveStart: number;
  weeksBeforeMoveDeadline: number;
  estimatedDurationDays: number;
  dependsOn: string[];
  documentsNeeded: string[];
  officialSourceUrl: string | null;
  preFilledFormUrl: string | null;
  agentWhoAddedIt: string;
  legalConsequenceIfMissed: string;
  status: ActionStatus;
  sortOrder: number;
  onCriticalPath?: boolean;
  deadlineIso?: string;
  completedAt?: string | null;
  userNotes?: string | null;
  /** Phase 1A — server-computed urgency bucket. */
  urgency?: Urgency;
  /** Phase 1A — explicit deadline weight. */
  deadlineType?: DeadlineType;
  /** Phase 1A — days until deadline (negative when overdue). */
  daysUntilDeadline?: number | null;
  /** Phase 1B — structured walkthrough payload. */
  walkthrough?: TaskWalkthroughView | null;
}

interface TimelineResponse {
  planId: string;
  actions: ActionView[];
  totalActions: number;
  criticalPathActionKeys: string[];
  longestLeadTimeWeeks: number;
  moveDate: string;
  generatedAt: string;
  stats?: { total: number; overdue: number; urgent: number; approaching: number };
  /** Phase D-B — per-domain provenance (researched / legacy_research / generic). */
  provenance?: Record<string, ResearchProvenance>;
}

const CATEGORY_LABEL: Record<string, string> = {
  visa: "Visa",
  documents: "Documents",
  tax: "Tax",
  banking: "Banking",
  housing: "Housing",
  health: "Health",
  pets: "Pets",
  posted_worker: "Posted-worker",
  schools: "Schools",
  vehicle: "Vehicle",
  logistics: "Logistics",
  admin: "Admin",
};

function urgencyMeta(
  urgency: Urgency | undefined,
  daysLeft: number | null | undefined,
): { label: string; color: string; stripe: string } | null {
  if (!urgency || urgency === "normal") return null;
  if (urgency === "overdue") {
    const n = typeof daysLeft === "number" ? Math.abs(daysLeft) : null;
    return {
      label: n != null ? `Overdue · ${n}d` : "Overdue",
      color: "text-[#B5414C]",
      stripe: "#B5414C",
    };
  }
  if (urgency === "urgent") {
    if (daysLeft == null || daysLeft <= 0) {
      return { label: "Due today", color: "text-[#8C6B2F]", stripe: "#C99746" };
    }
    return {
      label: daysLeft === 1 ? "Due tomorrow" : `Due in ${daysLeft}d`,
      color: "text-[#8C6B2F]",
      stripe: "#C99746",
    };
  }
  // approaching
  return {
    label:
      typeof daysLeft === "number" && daysLeft <= 7
        ? "Due this week"
        : `Due in ${daysLeft ?? "≤14"}d`,
    color: "text-[#3F6B53]",
    stripe: "#7BB091",
  };
}

function deadlineTypeLabel(deadlineType: DeadlineType | undefined): string | null {
  if (deadlineType === "legal") return "Legal";
  if (deadlineType === "recommended") return "Recommended";
  return null;
}

function formatCountdown(moveDateIso: string): { primary: string; sub: string } {
  const days = Math.ceil((new Date(moveDateIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { primary: "Already past your move date", sub: moveDateIso };
  const weeks = Math.floor(days / 7);
  const restDays = days % 7;
  if (weeks === 0) return { primary: `${days} day${days === 1 ? "" : "s"} to move`, sub: moveDateIso };
  return {
    primary: `${weeks} week${weeks === 1 ? "" : "s"}${restDays > 0 ? ` ${restDays} day${restDays === 1 ? "" : "s"}` : ""} to move`,
    sub: moveDateIso,
  };
}

export function PreDepartureTimeline() {
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailActionId, setDetailActionId] = useState<string | null>(null);
  const [vaultDocs, setVaultDocs] = useState<VaultDocRefView[]>([]);

  const refreshVault = async () => {
    try {
      const res = await fetch("/api/vault");
      if (!res.ok) return;
      const data = (await res.json()) as { documents: Array<{
        id: string;
        fileName: string;
        category: VaultDocRefView["category"];
        uploadedAt: string;
        linkedTaskKeys: string[];
      }> };
      setVaultDocs(
        (data.documents ?? []).map((d) => ({
          id: d.id,
          fileName: d.fileName,
          category: d.category,
          uploadedAt: d.uploadedAt,
          linkedTaskKeys: d.linkedTaskKeys ?? [],
        })),
      );
    } catch {
      /* swallow */
    }
  };

  useEffect(() => {
    void refreshVault();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pre-departure");
      if (res.status === 404) {
        setTimeline(null);
        return;
      }
      if (!res.ok) {
        setError(`Failed to load (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as TimelineResponse;
      setTimeline(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/pre-departure/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setTimeline(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (action: ActionView, next: ActionStatus) => {
    setTimeline((t) =>
      t ? { ...t, actions: t.actions.map((a) => (a.id === action.id ? { ...a, status: next } : a)) } : t,
    );
    try {
      const res = await fetch(`/api/pre-departure/${encodeURIComponent(action.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTimeline((t) =>
        t ? { ...t, actions: t.actions.map((a) => (a.id === action.id ? { ...a, ...data.action } : a)) } : t,
      );
    } catch {
      setTimeline((t) =>
        t ? { ...t, actions: t.actions.map((a) => (a.id === action.id ? action : a)) } : t,
      );
    }
  };

  const buckets = useMemo(() => {
    if (!timeline) return [];
    const map = new Map<number, ActionView[]>();
    for (const a of timeline.actions) {
      const key = a.weeksBeforeMoveStart;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [timeline]);

  const sourceList = useMemo(() => {
    if (!timeline) return [];
    const seen = new Map<string, { url: string; title: string }>();
    for (const a of timeline.actions) {
      if (!a.officialSourceUrl) continue;
      if (seen.has(a.officialSourceUrl)) continue;
      seen.set(a.officialSourceUrl, {
        url: a.officialSourceUrl,
        title: extractDomain(a.officialSourceUrl),
      });
    }
    return Array.from(seen.values());
  }, [timeline]);

  const stats = useMemo(() => {
    if (!timeline) return { total: 0, complete: 0, inProgress: 0, notStarted: 0 };
    const total = timeline.actions.length;
    const complete = timeline.actions.filter((a) => a.status === "complete").length;
    const inProgress = timeline.actions.filter((a) => a.status === "in_progress").length;
    const notStarted = timeline.actions.filter((a) => a.status === "not_started").length;
    return { total, complete, inProgress, notStarted };
  }, [timeline]);

  const urgentActions = useMemo(() => {
    if (!timeline) return [] as ActionView[];
    return timeline.actions
      .filter((a) => (a.urgency === "overdue" || a.urgency === "urgent") && a.status !== "complete" && a.status !== "skipped")
      .slice(0, 6);
  }, [timeline]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#7E9088] text-[12.5px] gm-surface px-5 py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your pre-move timeline…
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="space-y-4">
        {/* Phase E3-B — banner appears even on empty-state so a user
            who lands here AFTER changing their profile sees the
            suggestion to refresh BEFORE clicking Generate. Otherwise
            they'd generate a timeline from stale research and only
            then see the banner. */}
        <ResearchSuggestionsBanner surface="pre_move" onAfterRefresh={load} />

        <div className="gm-surface px-5 py-5 max-w-2xl">
          <div className="flex items-start gap-3">
            <span
              className="inline-flex items-center justify-center w-9 h-9 rounded-md shrink-0"
              style={{ background: "#E4F2EA", color: "#2C6440" }}
            >
              <Plane className="w-4 h-4" strokeWidth={1.8} />
            </span>
            <div className="flex-1 min-w-0">
              <span className="gm-eyebrow">Pre-departure</span>
              <h2 className="text-[16px] font-semibold text-[#1F2A24] mt-1.5">
                Generate your week-by-week move plan
              </h2>
              <p className="text-[12px] text-[#7E9088] mt-1 leading-relaxed max-w-xl">
                Our specialists sequence every pre-move action into a timeline with critical path highlighted.
              </p>
              {error && (
                <div className="text-[12px] text-[#8B2F38] gm-surface-sub px-2.5 py-1.5 mt-2.5" style={{ borderColor: "#E8B8BD" }}>
                  {error}
                </div>
              )}
              <Button
                onClick={handleGenerate}
                disabled={generating}
                size="sm"
                className="gap-1.5 mt-3 rounded-md bg-[#1B7A40] text-white hover:bg-[#15663A] shadow-sm"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plane className="w-3.5 h-3.5" />}
                {generating ? "Generating…" : "Generate checklist"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const countdown = formatCountdown(timeline.moveDate);

  return (
    <div className="space-y-6">
      {/* Phase E3-B — profile-diff suggestions banner. Renders nothing
          when there are no suggestions, so it's safe to mount
          unconditionally above the rest of the page. */}
      <ResearchSuggestionsBanner surface="pre_move" onAfterRefresh={load} />

      {/* Header — countdown + stats grid */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <span className="gm-eyebrow">Pre-departure</span>
            <h2 className="text-[20px] font-semibold tracking-tight text-[#1F2A24] mt-2">
              {countdown.primary}
            </h2>
            <p className="text-[12px] text-[#7E9088] mt-0.5">
              Move {countdown.sub} · {timeline.longestLeadTimeWeeks}w lead time
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="gap-2 h-8 rounded-md border-[#DCE7DF] hover:border-[#B5D2BC] hover:bg-[#F7FAF7]"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? "Regenerating…" : "Regenerate from latest profile"}
          </Button>
        </div>
        <div className="gm-surface grid grid-cols-3 divide-x divide-[#E2E8E1]">
          <StatCell label="Done" value={stats.complete} valueColor="text-[#3F6B53]" />
          <StatCell label="In progress" value={stats.inProgress} valueColor="text-[#8C6B2F]" />
          <StatCell label="Not started" value={stats.notStarted} valueColor="text-[#1F2A24]" />
        </div>
        {/* Phase D-B — per-domain provenance summary. /pre-move is
            grouped by week (not by domain), so a top-of-page summary
            is the cleanest spot for the user to see which domains
            are research-backed at a glance. Click any chip for the
            source list. */}
        <TimelineProvenanceSummary
          provenance={timeline.provenance ?? null}
          onRefreshed={() => { void load() }}
        />
      </section>

      {/* Overdue / urgent strip */}
      {urgentActions.length > 0 && (
        <div
          className="gm-surface px-3.5 py-3"
          style={{ borderLeft: "3px solid #B5414C" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[#B5414C]" strokeWidth={1.7} />
            <h3 className="text-[13px] font-semibold text-[#1F2A24]">
              {urgentActions.filter((a) => a.urgency === "overdue").length > 0
                ? `${urgentActions.filter((a) => a.urgency === "overdue").length} overdue · ${urgentActions.filter((a) => a.urgency === "urgent").length} due in ≤3 days`
                : `${urgentActions.length} action${urgentActions.length === 1 ? "" : "s"} due in ≤3 days`}
            </h3>
          </div>
          <ul className="space-y-1.5 pl-6">
            {urgentActions.map((a) => {
              const u = urgencyMeta(a.urgency, a.daysUntilDeadline ?? null);
              return (
                <li key={a.id} className="flex items-center gap-2 text-[12px]">
                  {u && (
                    <span className={cn("font-medium shrink-0", u.color)}>{u.label}</span>
                  )}
                  <button
                    type="button"
                    className="text-left text-[#1F2A24] hover:text-[#3F6B53] transition-colors truncate"
                    onClick={() => setDetailActionId(a.id)}
                  >
                    {a.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Bucketed timeline */}
      <div className="space-y-7">
        {buckets.map(([weeks, actions]) => (
          <section key={weeks} className="space-y-3">
            <div>
              <span className="gm-eyebrow">T-{weeks} weeks</span>
              <h3 className="text-[15px] font-semibold text-[#1F2A24] mt-1.5">
                {weeks} week{weeks === 1 ? "" : "s"} before move
                <span className="ml-2 text-[12px] font-normal text-[#7E9088]">
                  · {actions.length} action{actions.length === 1 ? "" : "s"}
                </span>
              </h3>
            </div>
            <div className="space-y-2">
              {actions.map((a) => (
                <ActionRow
                  key={a.id}
                  action={a}
                  onOpenDetail={() => setDetailActionId(a.id)}
                  onStatusChange={(next) => handleStatusChange(a, next)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Sources */}
      {sourceList.length > 0 && (
        <div className="gm-surface px-3.5 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="w-3.5 h-3.5 text-[#7E9088]" strokeWidth={1.7} />
            <span className="gm-eyebrow !mb-0">Sources</span>
          </div>
          <ol className="space-y-1 text-[12px] pl-5">
            {sourceList.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3F6B53] hover:text-[#15663A] transition-colors inline-flex items-center gap-1"
                >
                  {s.title}
                  <ExternalLink className="w-3 h-3" strokeWidth={1.7} />
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Stuck? */}
      <div className="gm-surface px-4 py-4">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-md shrink-0"
            style={{ background: "#E4F2EA", color: "#2C6440" }}
          >
            <Plane className="w-4 h-4" strokeWidth={1.8} />
          </span>
          <div className="flex-1">
            <h3 className="text-[14px] font-semibold text-[#1F2A24]">Stuck on a step?</h3>
            <p className="text-[12px] text-[#7E9088] mt-1 mb-3 leading-relaxed">
              Open the chat and ask GoMate. The specialists know the exact form numbers, deadlines, and contact points for every step here.
            </p>
            <Button asChild size="sm" variant="outline" className="rounded-md border-[#DCE7DF] hover:border-[#B5D2BC] hover:bg-[#F7FAF7]">
              <a href="/chat">Ask GoMate →</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Phase 1B detail sheet (+ Phase 2B doc section) */}
      <TaskDetailSheet
        open={Boolean(detailActionId)}
        onOpenChange={(o) => {
          if (!o) setDetailActionId(null);
        }}
        task={(() => {
          if (!detailActionId || !timeline) return null;
          const a = timeline.actions.find((x) => x.id === detailActionId);
          return a ? actionToViewModel(a, timeline.planId) : null;
        })()}
        vaultDocs={vaultDocs}
        onVaultChange={refreshVault}
        onStatusChange={async (next) => {
          if (!timeline || !detailActionId) return;
          const a = timeline.actions.find((x) => x.id === detailActionId);
          if (!a) return;
          const mapped: ActionStatus =
            next === "completed"
              ? "complete"
              : next === "available"
                ? "not_started"
                : (next as ActionStatus);
          await handleStatusChange(a, mapped);
        }}
      />
    </div>
  );
}

// =============================================================
// TimelineProvenanceSummary — Phase D-B
// =============================================================
// Compact row of per-domain badges for /pre-move. Each chip shows
// the domain's provenance kind (researched / legacy_research /
// generic) using the shared <ResearchProvenanceBadge>; clicking the
// chip opens its popover with the source list.
//
// Order is fixed so the chip layout is stable across runs:
// Visa, Documents, Housing, Banking, Healthcare. Domains absent
// from the API response render as "Generic" — same convention as
// the post-move version.
const PRE_DEPARTURE_DOMAIN_LABELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "visa", label: "Visa" },
  { key: "documents", label: "Documents" },
  { key: "housing", label: "Housing" },
  { key: "banking", label: "Banking" },
  { key: "healthcare", label: "Healthcare" },
];

function TimelineProvenanceSummary({
  provenance,
  onRefreshed,
}: {
  provenance: Record<string, ResearchProvenance> | null;
  onRefreshed?: () => void;
}) {
  // Safety net for old persisted timelines that lack provenance.
  // Renders the chip row as all-generic so the section is never
  // missing/blank — also makes "this content is not researched"
  // visible until the user regenerates.
  const safe: Record<string, ResearchProvenance> = provenance ?? {};
  return (
    <div
      className="gm-surface px-3.5 py-2.5 flex items-center gap-2 flex-wrap"
      data-testid="timeline-provenance-summary"
    >
      <span className="text-[10px] uppercase tracking-wide text-[#7E9088] mr-1">
        Sources
      </span>
      {PRE_DEPARTURE_DOMAIN_LABELS.map(({ key, label }) => {
        const p = safe[key] ?? { kind: "generic" as const };
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1"
            data-testid={`provenance-chip-${key}`}
            data-domain={key}
          >
            <span className="text-[11px] text-[#1F2A24]">{label}</span>
            <ResearchProvenanceBadge
              provenance={p}
              compact
              domain={key}
              onRefreshed={onRefreshed}
            />
          </span>
        );
      })}
    </div>
  );
}

function actionToViewModel(a: ActionView, planId: string): TaskDetailViewModel {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    category: a.category,
    urgency: a.urgency,
    deadlineType: a.deadlineType,
    deadlineAt: a.deadlineIso ?? null,
    daysUntilDeadline: a.daysUntilDeadline ?? null,
    estimatedTime: null,
    cost: null,
    officialLink: a.officialSourceUrl,
    documentsNeeded: a.documentsNeeded,
    legacySteps: [],
    walkthrough: a.walkthrough ?? null,
    status:
      a.status === "complete"
        ? "completed"
        : a.status === "not_started"
          ? "available"
          : a.status,
    taskRefKey: `pre-departure:${a.id}`,
    planId,
  };
}

function StatCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: number;
  valueColor: string;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#7E9088]">
        {label}
      </div>
      <div className={cn("text-[22px] font-semibold tabular-nums mt-1", valueColor)}>
        {value}
      </div>
    </div>
  );
}

function ActionRow({
  action,
  onOpenDetail,
  onStatusChange,
}: {
  action: ActionView;
  onOpenDetail: () => void;
  onStatusChange: (next: ActionStatus) => void;
}) {
  const u = urgencyMeta(action.urgency, action.daysUntilDeadline ?? null);
  const stripe = action.onCriticalPath ? "#B5414C" : u?.stripe;
  const completed = action.status === "complete";
  const inProgress = action.status === "in_progress";
  const dlType = deadlineTypeLabel(action.deadlineType);

  return (
    <div
      className="gm-surface gm-lift group"
      style={stripe ? { borderLeft: `3px solid ${stripe}` } : undefined}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const next: ActionStatus = completed ? "not_started" : "complete";
            onStatusChange(next);
          }}
          className="mt-0.5 shrink-0"
          aria-label="Toggle complete"
        >
          {completed ? (
            <CheckCircle2 className="w-5 h-5 text-[#3F6B53]" strokeWidth={1.8} />
          ) : inProgress ? (
            <Clock className="w-5 h-5 text-[#C99746]" strokeWidth={1.8} />
          ) : (
            <Circle className="w-5 h-5 text-[#9CB0A4]" strokeWidth={1.7} />
          )}
        </button>
        <button type="button" onClick={onOpenDetail} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1 text-[11.5px]">
            <span className="font-medium text-[#7E9088]">
              {CATEGORY_LABEL[action.category] ?? action.category}
            </span>
            {u && (
              <>
                <span className="text-[#DCE7DF]">·</span>
                <span className={cn("font-medium", u.color)}>{u.label}</span>
              </>
            )}
            {dlType && (
              <>
                <span className="text-[#DCE7DF]">·</span>
                <span className="font-medium text-[#7E9088]">{dlType}</span>
              </>
            )}
            {action.onCriticalPath && (
              <>
                <span className="text-[#DCE7DF]">·</span>
                <span className="font-semibold text-[#B5414C]">Critical path</span>
              </>
            )}
            {action.deadlineIso && (
              <>
                <span className="text-[#DCE7DF]">·</span>
                <span className="text-[#7E9088] tabular-nums">by {action.deadlineIso}</span>
              </>
            )}
          </div>
          <p
            className={cn(
              "text-[13.5px] font-semibold leading-snug text-[#1F2A24]",
              completed && "line-through text-[#7E9088]",
            )}
          >
            {action.title}
          </p>
          <p className="text-[12px] text-[#7E9088] line-clamp-2 mt-0.5 leading-relaxed">
            {action.description}
          </p>
        </button>
        <button
          type="button"
          onClick={onOpenDetail}
          className="shrink-0 text-[#9CB0A4] group-hover:text-[#1F2A24] transition-colors mt-0.5"
          aria-label="Open walkthrough"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
