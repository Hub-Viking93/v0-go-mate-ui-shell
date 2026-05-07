// PreDepartureTimeline — week-by-week move plan UI.
//
// Self-contained component. Reads from GET /api/pre-departure, generates
// via POST /api/pre-departure/generate, updates statuses via PATCH
// /api/pre-departure/:actionId. Used inside the /checklist page's
// "Pre-move" tab so the rich timeline lives under the consolidated
// Checklist surface (the standalone /pre-departure route is now a
// Redirect to /checklist?tab=pre-move).

import { useEffect, useMemo, useState } from "react";
import {
  Plane,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrustBadge } from "@/components/trust-badge";
import { cn } from "@/lib/utils";
import {
  TaskDetailSheet,
  type TaskDetailViewModel,
  type TaskWalkthroughView,
  type VaultDocRefView,
} from "@/components/task-detail-sheet";

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

const CATEGORY_TINT: Record<string, string> = {
  visa: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  documents: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  tax: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
  banking: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  housing: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  health: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30",
  pets: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  posted_worker: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  schools: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  vehicle: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  logistics: "bg-stone-500/10 text-stone-700 dark:text-stone-400 border-stone-500/30",
  admin: "bg-stone-500/10 text-stone-700 dark:text-stone-400 border-stone-500/30",
};

function urgencyBadge(
  urgency: Urgency | undefined,
  daysLeft: number | null | undefined,
): { label: string; className: string } | null {
  if (!urgency || urgency === "normal") return null;
  if (urgency === "overdue") {
    const n = typeof daysLeft === "number" ? Math.abs(daysLeft) : null;
    return {
      label: n != null ? `Overdue by ${n}d` : "Overdue",
      className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
    };
  }
  if (urgency === "urgent") {
    if (daysLeft == null || daysLeft <= 0) {
      return {
        label: "Due today",
        className: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40",
      };
    }
    return {
      label: daysLeft === 1 ? "Due tomorrow" : `Due in ${daysLeft}d`,
      className: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40",
    };
  }
  // approaching
  return {
    label: typeof daysLeft === "number" && daysLeft <= 7 ? "Due this week" : `Due in ${daysLeft ?? "≤14"}d`,
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  };
}

function deadlineTypeBadge(
  deadlineType: DeadlineType | undefined,
): { label: string; className: string } | null {
  if (!deadlineType) return null;
  if (deadlineType === "legal") {
    return {
      label: "Legal",
      className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    };
  }
  if (deadlineType === "recommended") {
    return {
      label: "Recommended",
      className: "bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-500/30",
    };
  }
  return null; // "practical" stays implicit; default styling
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
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your pre-move timeline…
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="rounded-xl border border-stone-200/80 dark:border-stone-800 bg-card">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E4F5EB] ring-1 ring-[#A8D9C0] flex items-center justify-center shrink-0">
              <Plane className="w-5 h-5 text-[#14532D]" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                Generate your week-by-week move plan
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                Our specialists sequence every pre-move action into a timeline with critical path highlighted.
              </p>
              {error && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 mt-2">
                  {error}
                </div>
              )}
              <Button
                onClick={handleGenerate}
                disabled={generating}
                size="sm"
                className="gap-1.5 mt-3 rounded-lg bg-[#0D9488] text-white hover:bg-[#0F766E]"
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
      {/* Header — countdown + stats */}
      <div className="rounded-xl bg-[#0F172A] text-white p-4 sm:p-5 relative overflow-hidden">
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-300/80 mb-1">
              Pre-departure
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {countdown.primary}
            </h1>
            <p className="text-xs text-emerald-200/70 mt-1">
              Move: {countdown.sub} · {timeline.longestLeadTimeWeeks}w lead time
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <Stat label="Done" value={stats.complete} accent="text-emerald-300" />
            <Stat label="In progress" value={stats.inProgress} accent="text-amber-300" />
            <Stat label="Not started" value={stats.notStarted} accent="text-white" />
          </div>
        </div>
      </div>

      {/* Phase 1A — overdue / urgent banner */}
      {urgentActions.length > 0 && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-700 dark:text-rose-400" />
            <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
              {urgentActions.filter((a) => a.urgency === "overdue").length > 0
                ? `${urgentActions.filter((a) => a.urgency === "overdue").length} overdue · ${urgentActions.filter((a) => a.urgency === "urgent").length} due in ≤3 days`
                : `${urgentActions.length} action${urgentActions.length === 1 ? "" : "s"} due in ≤3 days`}
            </h3>
          </div>
          <ul className="space-y-1.5">
            {urgentActions.map((a) => {
              const u = urgencyBadge(a.urgency, a.daysUntilDeadline ?? null);
              return (
                <li key={a.id} className="flex items-center gap-2 text-xs">
                  {u && (
                    <Badge variant="outline" className={cn("text-[10px] py-0 shrink-0", u.className)}>
                      {u.label}
                    </Badge>
                  )}
                  <button
                    type="button"
                    className="text-left text-stone-800 dark:text-stone-200 hover:underline truncate"
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

      {/* Re-generate */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? "Regenerating…" : "Regenerate from latest profile"}
        </Button>
      </div>

      {/* Vertical bucket timeline */}
      <div className="space-y-5">
        {buckets.map(([weeks, actions]) => (
          <div key={weeks} className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#0F172A] text-white flex items-center justify-center text-sm font-bold">
                {weeks}w
              </div>
              <div>
                <h2 className="text-sm font-semibold">
                  {weeks} week{weeks === 1 ? "" : "s"} before move
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {actions.length} action{actions.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="space-y-2 pl-5 border-l border-stone-200 dark:border-stone-800 ml-5">
              {actions.map((a) => (
                <ActionCard
                  key={a.id}
                  action={a}
                  onOpenDetail={() => setDetailActionId(a.id)}
                  onStatusChange={(next) => handleStatusChange(a, next)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sources */}
      {sourceList.length > 0 && (
        <Card className="p-3">
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#0D9488]" /> Sources
          </h3>
          <ol className="space-y-1 text-xs">
            {sourceList.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#0D9488] hover:underline">
                  {s.title} <ExternalLink className="inline w-3 h-3" />
                </a>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Stuck? */}
      <Card className="p-5 bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/60 dark:border-emerald-900/40">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Plane className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Stuck on a step?</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Open the chat and ask GoMate. The specialists know the exact form numbers, deadlines, and contact points for every step here.
            </p>
            <Button asChild size="sm" variant="outline">
              <a href="/chat">Ask GoMate →</a>
            </Button>
          </div>
        </div>
      </Card>

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

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="text-center">
      <div className={cn("text-2xl font-sans font-bold tabular-nums", accent)}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-100/70 mt-0.5">{label}</div>
    </div>
  );
}

function ActionCard({
  action,
  onOpenDetail,
  onStatusChange,
}: {
  action: ActionView;
  onOpenDetail: () => void;
  onStatusChange: (next: ActionStatus) => void;
}) {
  const statusIcon =
    action.status === "complete" ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
    ) : action.status === "in_progress" ? (
      <Clock className="w-5 h-5 text-amber-600" />
    ) : (
      <Circle className="w-5 h-5 text-stone-400" />
    );

  const tint = CATEGORY_TINT[action.category] ?? CATEGORY_TINT.admin;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-shadow hover:shadow-sm",
        action.onCriticalPath ? "border-l-4 border-l-rose-500" : "border-stone-200 dark:border-stone-800",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const next: ActionStatus = action.status === "complete" ? "not_started" : "complete";
            onStatusChange(next);
          }}
          className="mt-0.5 shrink-0"
          aria-label="Toggle complete"
        >
          {statusIcon}
        </button>
        <button type="button" onClick={onOpenDetail} className="flex-1 text-left">
          <div className="flex items-start gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={cn("text-[10px] py-0", tint)}>
              {CATEGORY_LABEL[action.category] ?? action.category}
            </Badge>
            {(() => {
              const u = urgencyBadge(action.urgency, action.daysUntilDeadline ?? null);
              return u ? (
                <Badge variant="outline" className={cn("text-[10px] py-0", u.className)}>
                  {u.label}
                </Badge>
              ) : null;
            })()}
            {(() => {
              const d = deadlineTypeBadge(action.deadlineType);
              return d ? (
                <Badge variant="outline" className={cn("text-[10px] py-0", d.className)}>
                  {d.label}
                </Badge>
              ) : null;
            })()}
            {action.onCriticalPath && (
              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] py-0">
                Critical path
              </Badge>
            )}
            {action.deadlineIso && (
              <span className="text-[11px] text-muted-foreground">by {action.deadlineIso}</span>
            )}
          </div>
          <p className={cn("text-sm font-semibold leading-snug", action.status === "complete" && "line-through text-muted-foreground")}>
            {action.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{action.description}</p>
        </button>
        <button type="button" onClick={onOpenDetail} className="shrink-0 text-muted-foreground" aria-label="Open walkthrough">
          <ChevronRight className="w-4 h-4" />
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
