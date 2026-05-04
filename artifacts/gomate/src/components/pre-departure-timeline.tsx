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

type ActionStatus = "not_started" | "in_progress" | "complete" | "blocked" | "skipped";

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
}

interface TimelineResponse {
  planId: string;
  actions: ActionView[];
  totalActions: number;
  criticalPathActionKeys: string[];
  longestLeadTimeWeeks: number;
  moveDate: string;
  generatedAt: string;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your pre-move timeline…
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card shadow-[0_12px_40px_rgba(20,48,42,0.08)]">
        <div
          className="h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, #1B3A2D 0%, #2D6A4F 60%, #5EE89C 100%)",
          }}
        />
        <div className="p-7 md:p-8">
          <div className="flex items-start gap-5">
            {/* Real, contextual icon — Plane reads as "departure /
                move plan". The previous Sparkles glyph reads as
                generic "AI", which is what it landed on every other
                AI-generated card too. */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-[#1B3A2D]/10 ring-1 ring-emerald-500/30 flex items-center justify-center shrink-0">
              <Plane className="w-7 h-7 text-emerald-700 dark:text-emerald-400" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="gm-eyebrow text-emerald-700 dark:text-emerald-400">Pre-move plan</p>
              <h2
                className="font-serif text-foreground mt-1"
                style={{
                  fontSize: "24px",
                  fontWeight: 600,
                  letterSpacing: "-0.012em",
                  lineHeight: 1.15,
                }}
              >
                Generate your week-by-week move plan
              </h2>
              <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed max-w-xl">
                Our specialists sequence every pre-move action —
                {" "}<span className="text-foreground font-medium">visa pickup</span>,
                {" "}<span className="text-foreground font-medium">apostille chain</span>,
                {" "}<span className="text-foreground font-medium">A1 certificate</span>,
                {" "}<span className="text-foreground font-medium">banking bridge</span>,
                {" "}<span className="text-foreground font-medium">pet vaccination</span>
                {" "}— into a timeline with critical path highlighted.
              </p>
              {error && (
                <div className="text-sm text-rose-700 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-xl px-3 py-2 mt-4">
                  {error}
                </div>
              )}
              <Button
                onClick={handleGenerate}
                disabled={generating}
                size="lg"
                className="gap-2 mt-5 rounded-full bg-gradient-to-r from-[#1B3A2D] to-[#2D6A4F] text-white shadow-md hover:opacity-95"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plane className="w-4 h-4" />}
                {generating ? "Generating…" : "Generate my pre-move checklist"}
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
      <div className="rounded-2xl bg-gradient-to-br from-[#1B3A2D] via-[#234D3A] to-[#2D6A4F] text-white p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(94,232,156,0.25),transparent_60%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] font-semibold text-emerald-200/80 mb-2">
              Pre-departure
            </p>
            <h1 className="text-3xl sm:text-4xl font-serif tracking-tight leading-tight">
              {countdown.primary}
            </h1>
            <p className="text-sm text-emerald-100/80 mt-2">
              Move date: {countdown.sub} · {timeline.longestLeadTimeWeeks}-week lead time on the longest item
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <Stat label="Done" value={stats.complete} accent="text-emerald-300" />
            <Stat label="In progress" value={stats.inProgress} accent="text-amber-300" />
            <Stat label="Not started" value={stats.notStarted} accent="text-white" />
          </div>
        </div>
      </div>

      {/* Re-generate */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? "Regenerating…" : "Regenerate from latest profile"}
        </Button>
      </div>

      {/* Vertical bucket timeline */}
      <div className="space-y-6">
        {buckets.map(([weeks, actions]) => (
          <div key={weeks} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center font-serif text-lg font-bold">
                {weeks}w
              </div>
              <div>
                <h2 className="text-base font-semibold">
                  {weeks} week{weeks === 1 ? "" : "s"} before move
                </h2>
                <p className="text-xs text-muted-foreground">
                  {actions.length} action{actions.length === 1 ? "" : "s"} kick off this week
                </p>
              </div>
            </div>
            <div className="space-y-2 pl-6 border-l border-stone-200 dark:border-stone-800 ml-6">
              {actions.map((a) => (
                <ActionCard
                  key={a.id}
                  action={a}
                  expanded={expandedId === a.id}
                  onToggle={() => setExpandedId((id) => (id === a.id ? null : a.id))}
                  onStatusChange={(next) => handleStatusChange(a, next)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sources */}
      {sourceList.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" /> Official sources used
          </h3>
          <ol className="space-y-1.5 text-xs">
            {sourceList.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-400 hover:underline">
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
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="text-center">
      <div className={cn("text-2xl font-serif font-bold tabular-nums", accent)}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-100/70 mt-0.5">{label}</div>
    </div>
  );
}

function ActionCard({
  action,
  expanded,
  onToggle,
  onStatusChange,
}: {
  action: ActionView;
  expanded: boolean;
  onToggle: () => void;
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
        <button type="button" onClick={onToggle} className="flex-1 text-left">
          <div className="flex items-start gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={cn("text-[10px] py-0", tint)}>
              {CATEGORY_LABEL[action.category] ?? action.category}
            </Badge>
            {action.onCriticalPath && (
              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] py-0">
                Critical path
              </Badge>
            )}
            {action.deadlineIso && (
              <span className="text-[11px] text-muted-foreground">deadline {action.deadlineIso}</span>
            )}
          </div>
          <p className={cn("text-sm font-semibold leading-snug", action.status === "complete" && "line-through text-muted-foreground")}>
            {action.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{action.description}</p>
        </button>
        <button type="button" onClick={onToggle} className="shrink-0 text-muted-foreground" aria-label="Expand">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-dashed border-stone-200 dark:border-stone-800">
          <p className="text-xs text-muted-foreground leading-relaxed pt-3">{action.description}</p>
          {action.documentsNeeded.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-600 dark:text-stone-400 mb-1.5">
                Documents needed
              </p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                {action.documentsNeeded.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {action.legalConsequenceIfMissed && (
            <div className="flex gap-2 text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-lg p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
              <span className="text-amber-900 dark:text-amber-200 leading-relaxed">
                <span className="font-semibold">If missed: </span>
                {action.legalConsequenceIfMissed}
              </span>
            </div>
          )}
          {action.officialSourceUrl && (
            <div>
              <TrustBadge
                sources={[{
                  name: action.title + " — official source",
                  url: action.officialSourceUrl,
                  authority: "official",
                }]}
              />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant={action.status === "in_progress" ? "default" : "outline"}
              onClick={() => onStatusChange("in_progress")}
              className="text-xs h-7"
            >
              Mark in progress
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange("skipped")}
              className="text-xs h-7"
            >
              Skip
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            Added by: {action.agentWhoAddedIt}
          </p>
        </div>
      )}
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
