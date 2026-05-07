// =============================================================
// ArrivalPlaybookSection — Phase 4A "first 72 hours / first 30 days"
// =============================================================
// Renders the structured arrival playbook returned by /api/arrival-playbook:
//
//   • Phase chip — "Pre-arrival preview" / "Day 2 — first 72 hours" /
//     "Day 14 — first 30 days" / "Beyond first 30 days".
//   • Two distinct sub-sections, "First 72 hours" and "First 30 days",
//     never collapsed into a single list.
//   • Per item: title + whyNow rationale + status indicator (✓/○/—)
//     + optional "View task" link when relatedTaskRef is set.
//
// Phase 4A explicit non-goals:
//   • Not a re-skin of the checklist — many items have no relatedTaskRef.
//   • No new full domain flows (banking / healthcare / cultural).
//   • No new specialist pipelines.
// =============================================================

import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  Loader2,
  MapPin,
  MinusCircle,
  Plane,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PlaybookItemStatus = "completed" | "pending" | "not_applicable";
type PlaybookPhase = "pre_arrival" | "first_72h" | "first_30d" | "post_30d";

interface PlaybookItem {
  id: string;
  title: string;
  whyNow: string;
  relatedTaskRef?: string;
  status: PlaybookItemStatus;
  order: number;
}

interface ArrivalPlaybook {
  planId: string;
  generatedAt: string;
  arrivalDate: string | null;
  daysSinceArrival: number | null;
  phase: PlaybookPhase;
  first72Hours: PlaybookItem[];
  first30Days: PlaybookItem[];
}

const PHASE_META: Record<
  PlaybookPhase,
  { label: (days: number | null) => string; icon: LucideIcon; tone: string }
> = {
  pre_arrival: {
    label: () => "Pre-arrival preview",
    icon: Plane,
    tone: "border-stone-300 dark:border-stone-700 bg-stone-100/60 dark:bg-stone-900/40 text-stone-700 dark:text-stone-300",
  },
  first_72h: {
    label: (d) => `Day ${d ?? 0} — first 72 hours`,
    icon: Sparkles,
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  first_30d: {
    label: (d) => `Day ${d ?? 0} — first 30 days`,
    icon: Compass,
    tone: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  post_30d: {
    label: (d) =>
      d != null && d > 30
        ? `Beyond first 30 days (day ${d})`
        : "Beyond first 30 days",
    icon: MapPin,
    tone: "border-stone-500/40 bg-stone-500/10 text-stone-700 dark:text-stone-300",
  },
};

const STATUS_META: Record<
  PlaybookItemStatus,
  { icon: LucideIcon; iconClass: string; label: string }
> = {
  completed: {
    icon: CheckCircle2,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    label: "Completed",
  },
  pending: {
    icon: Circle,
    iconClass: "text-stone-400 dark:text-stone-500",
    label: "Pending",
  },
  not_applicable: {
    icon: MinusCircle,
    iconClass: "text-stone-300 dark:text-stone-600",
    label: "Not applicable",
  },
};

export function ArrivalPlaybookSection() {
  const [book, setBook] = useState<ArrivalPlaybook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/arrival-playbook");
        if (!res.ok) {
          if (res.status === 404) {
            setBook(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as ArrivalPlaybook;
        if (!cancelled) setBook(data);
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
        data-testid="arrival-playbook-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your arrival playbook…
      </div>
    );
  }
  if (error || !book) {
    return (
      <div
        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-card p-6"
        data-testid="arrival-playbook-section"
      >
        <h3 className="text-sm font-semibold mb-1">Arrival playbook</h3>
        <p className="text-xs text-muted-foreground">
          {error
            ? `Couldn't load the playbook: ${error}`
            : "Set an arrival date in your profile to see your first-72-hours and first-30-days plan."}
        </p>
      </div>
    );
  }

  const phaseMeta = PHASE_META[book.phase];
  const PhaseIcon = phaseMeta.icon;

  return (
    <section className="space-y-4" data-testid="arrival-playbook-section">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2
            className="text-lg font-semibold text-foreground"
            data-testid="arrival-playbook-heading"
          >
            Arrival playbook
          </h2>
          <p className="text-xs text-muted-foreground">
            What to do right after you land. Two windows, ordered, with
            clear rationale per item.
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("text-[10px] py-0.5 gap-1", phaseMeta.tone)}
          data-testid="arrival-playbook-phase"
          data-phase={book.phase}
        >
          <PhaseIcon className="w-3 h-3" />
          {phaseMeta.label(book.daysSinceArrival)}
        </Badge>
      </div>

      <PlaybookBucket
        title="First 72 hours"
        subtitle="Immediate landing — settle in, stay reachable, protect your originals."
        items={book.first72Hours}
        bucket="first72Hours"
        accentClass="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        Icon={Sparkles}
      />
      <PlaybookBucket
        title="First 30 days"
        subtitle="Operational setup — get your local IDs, money, healthcare, payroll on track."
        items={book.first30Days}
        bucket="first30Days"
        accentClass="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
        Icon={Compass}
      />

      <p className="text-[11px] text-muted-foreground italic">
        These windows are general best-practice for relocations — your specific
        landing may need adjustments. Use the underlying checklist for deadlines.
      </p>
    </section>
  );
}

function PlaybookBucket({
  title,
  subtitle,
  items,
  bucket,
  Icon,
}: {
  title: string;
  subtitle: string;
  items: PlaybookItem[];
  bucket: string;
  /** @deprecated kept for type-compat; no longer used (no icon bubble) */
  accentClass?: string;
  Icon: LucideIcon;
}) {
  if (items.length === 0) return null;
  const done = items.filter((i) => i.status === "completed").length;
  return (
    <div className="space-y-2" data-testid={`arrival-playbook-bucket-${bucket}`}>
      <header className="flex items-baseline gap-2 flex-wrap">
        <Icon className="w-3.5 h-3.5 text-[#7E9088] shrink-0 self-center" strokeWidth={1.7} />
        <h3 className="text-[13px] font-semibold text-[#1F2A24]">{title}</h3>
        <span className="text-[11px] text-[#7E9088]">·</span>
        <span className="text-[11px] text-[#7E9088] flex-1 min-w-0">{subtitle}</span>
        <span className="text-[11px] tabular-nums text-[#4E5F57] font-medium">
          {done} / {items.length}
        </span>
      </header>
      <ol className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={item.id}>
            <PlaybookItemRow item={item} index={idx + 1} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function PlaybookItemRow({ item, index }: { item: PlaybookItem; index: number }) {
  const meta = STATUS_META[item.status];
  const StatusIcon = meta.icon;
  const taskHref = relatedTaskHref(item.relatedTaskRef);
  return (
    <article
      className="bg-card px-3.5 py-2.5"
      style={{
        border: "1px solid #DCE7DF",
        borderRadius: "6px",
      }}
      data-testid={`arrival-playbook-item-${item.id}`}
      data-item-status={item.status}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5 inline-flex items-center justify-center">
          <StatusIcon className={cn("w-4 h-4", meta.iconClass)} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={cn(
                "text-sm font-medium leading-snug",
                item.status === "completed" && "line-through text-muted-foreground",
              )}
            >
              <span className="text-muted-foreground mr-1.5">{index}.</span>
              {item.title}
            </p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1 flex items-start gap-1.5">
            <Clock className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold not-italic text-foreground/80">Why now: </span>
              {item.whyNow}
            </span>
          </p>
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
