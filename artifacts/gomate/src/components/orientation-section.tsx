// =============================================================
// OrientationSection — Phase 4D "cultural orientation"
// =============================================================
// Practical-systems orientation cards. Authored topics, scannable
// layout, do/dont takeaways. NOT a country guide, NOT tourism
// content, NOT a marketplace.
// =============================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Globe,
  Home,
  Layers,
  Loader2,
  MapPin,
  Smartphone,
  Stethoscope,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type OrientationCategory =
  | "systems"
  | "everyday_apps"
  | "address_logic"
  | "healthcare_practice"
  | "housing_culture"
  | "common_pitfalls";
type OrientationPhase = "any_time" | "first_72h" | "first_30d" | "later";
type TakeawayKind = "do" | "dont" | "neutral";

interface OrientationTakeaway {
  text: string;
  kind: TakeawayKind;
}
interface OrientationTopic {
  id: string;
  category: OrientationCategory;
  title: string;
  summary: string;
  whyItMatters: string;
  practicalTakeaways: OrientationTakeaway[];
  phase: OrientationPhase;
  relatedTaskRef?: string;
  order: number;
}
interface OrientationReport {
  planId: string;
  generatedAt: string;
  destination: string | null;
  isFreeMovement: boolean;
  topics: OrientationTopic[];
}

const CATEGORY_META: Record<OrientationCategory, { label: string; icon: LucideIcon; tone: string }> = {
  systems: {
    label: "Systems",
    icon: Layers,
    tone: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
  },
  everyday_apps: {
    label: "Everyday apps",
    icon: Smartphone,
    tone: "border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10",
  },
  address_logic: {
    label: "Address logic",
    icon: MapPin,
    tone: "border-cyan-500/40 text-cyan-700 dark:text-cyan-300 bg-cyan-500/10",
  },
  healthcare_practice: {
    label: "Healthcare practice",
    icon: Stethoscope,
    tone: "border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/10",
  },
  housing_culture: {
    label: "Housing culture",
    icon: Home,
    tone: "border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10",
  },
  common_pitfalls: {
    label: "Common pitfalls",
    icon: AlertTriangle,
    tone: "border-stone-500/40 text-stone-700 dark:text-stone-300 bg-stone-500/10",
  },
};

const PHASE_META: Record<OrientationPhase, { label: string; pill: string }> = {
  any_time: {
    label: "Any time",
    pill: "border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300",
  },
  first_72h: {
    label: "First 72h",
    pill: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  },
  first_30d: {
    label: "First 30 days",
    pill: "border-indigo-500/40 text-indigo-700 dark:text-indigo-300",
  },
  later: {
    label: "Later",
    pill: "border-stone-500/40 text-stone-700 dark:text-stone-300",
  },
};

type FilterMode = "all" | "first_72h" | "first_30d";

export function OrientationSection() {
  const [report, setReport] = useState<OrientationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FilterMode>("all");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/orientation");
        if (!res.ok) {
          if (res.status === 404) {
            setReport(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as OrientationReport;
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

  const visible = useMemo<OrientationTopic[]>(() => {
    if (!report) return [];
    if (mode === "all") return report.topics;
    return report.topics.filter((t) => t.phase === mode || t.phase === "any_time");
  }, [report, mode]);

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 text-muted-foreground p-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-card"
        data-testid="orientation-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your orientation guide…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div
        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-card p-6"
        data-testid="orientation-section"
      >
        <h3 className="text-sm font-semibold mb-1">Cultural orientation</h3>
        <p className="text-xs text-muted-foreground">
          {error
            ? `Couldn't load orientation: ${error}`
            : "Set destination + arrival to see how everyday systems work where you're moving."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="orientation-section">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground" data-testid="orientation-heading">
            Cultural orientation
          </h2>
          <p className="text-xs text-muted-foreground">
            How everyday systems actually work {report.destination ? `in ${report.destination}` : "where you're moving"} — practical orientation, not a country guide.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-1 rounded-full border border-stone-200 dark:border-stone-800 bg-card p-0.5"
          data-testid="orientation-filter"
        >
          <FilterPill active={mode === "all"} label={`All (${report.topics.length})`} onClick={() => setMode("all")} />
          <FilterPill active={mode === "first_72h"} label="First 72h" onClick={() => setMode("first_72h")} />
          <FilterPill active={mode === "first_30d"} label="First 30 days" onClick={() => setMode("first_30d")} />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-card p-5 text-center text-xs text-muted-foreground">
          No topics match this filter. Switch to "All".
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start" data-testid="orientation-grid">
          {visible.map((t) => (
            <TopicCard key={t.id} topic={t} />
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Practical orientation — destination-generic patterns, not legal advice or country-specific
        rules. Local norms vary; treat takeaways as starting points.
      </p>
    </section>
  );
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-xs rounded-full transition-colors",
        active
          ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function TopicCard({ topic }: { topic: OrientationTopic }) {
  const cat = CATEGORY_META[topic.category];
  const phase = PHASE_META[topic.phase];
  const Icon = cat.icon;
  const taskHref = relatedTaskHref(topic.relatedTaskRef);
  void phase; // legacy ref
  const phaseLabel =
    topic.phase === "first_72h"
      ? "First 72h"
      : topic.phase === "first_30d"
        ? "First 30 days"
        : topic.phase === "any_time"
          ? "Any time"
          : "Later";
  return (
    <details
      className="group bg-card"
      style={{ border: "1px solid #DCE7DF", borderRadius: "6px" }}
      data-testid={`orientation-topic-${topic.id}`}
      data-orientation-category={topic.category}
      data-orientation-phase={topic.phase}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-start gap-2">
          <Icon className="w-3.5 h-3.5 text-[#7E9088] shrink-0 mt-0.5" strokeWidth={1.7} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-[13px] font-semibold leading-snug text-[#1F2A24]">
                {topic.title}
              </h3>
              <span className="text-[11px] text-[#7E9088]">{cat.label}</span>
              <span className="text-[11px] text-[#7E9088]">·</span>
              <span className="text-[11px] text-[#4E5F57] font-medium">{phaseLabel}</span>
            </div>
            <p className="text-[12px] text-[#4E5F57] leading-relaxed mt-0.5">
              {topic.summary}
            </p>
          </div>
          <ChevronDown
            className="w-3.5 h-3.5 text-[#7E9088] shrink-0 mt-0.5 transition-transform group-open:rotate-180"
            strokeWidth={1.7}
          />
        </div>
      </summary>

      <div
        className="px-3.5 pb-3 pl-9 space-y-2"
        style={{ borderTop: "1px solid #ECF1EC", paddingTop: "8px" }}
      >
        <p className="text-[11px] text-[#7E9088] leading-relaxed">
          <span className="font-semibold text-[#4E5F57]">Why this matters: </span>
          {topic.whyItMatters}
        </p>

        <ul className="space-y-1">
          {topic.practicalTakeaways.map((t, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[12px] leading-relaxed"
              data-takeaway-kind={t.kind}
            >
              <span className="shrink-0 mt-1">
                {t.kind === "do" ? (
                  <Check className="w-3 h-3 text-[#3F6B53]" strokeWidth={2} />
                ) : t.kind === "dont" ? (
                  <X className="w-3 h-3 text-[#7E9088]" strokeWidth={2} />
                ) : (
                  <span className="block w-1 h-1 mt-1 rounded-full bg-[#7E9088]" />
                )}
              </span>
              <span className="text-[#1F2A24]">{t.text}</span>
            </li>
          ))}
        </ul>

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
    </details>
  );
}

function relatedTaskHref(ref: string | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith("settling-in:")) return "/checklist?tab=post-move";
  if (ref.startsWith("pre-departure:")) return "/checklist?tab=pre-move";
  return "/checklist";
}

// Marker import to keep tooling happy if any of these end up unused.
void Globe;
