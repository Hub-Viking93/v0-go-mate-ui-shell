// =============================================================
// PathwaysSection — Phase 3C "your path + Plan B"
// =============================================================
// Renders the structured PathwayPlan returned by /api/pathways:
//
//   • Active scenario banner (denied / delayed / stalled) when state
//     has triggered one — surfaced first because it changes what the
//     user should do right now.
//   • Primary path card — current pathway + rationale + weaknesses.
//   • Alternatives stack — only the alternatives the state actually
//     supports, ordered by fitStrength (strong → moderate → weak).
//
// Phase 3C explicit non-goals:
//   • No generic visa marketplace.
//   • No alternatives without state-grounded reasoning.
//   • No copy that "sounds confident" without backing.
// =============================================================

import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertOctagon,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Compass,
  GitBranch,
  Loader2,
  PauseCircle,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PurposeKey = "work" | "study" | "digital_nomad" | "settle" | "other";
type ScenarioKind = "denied" | "delayed" | "stalled";
type FitStrength = "strong" | "moderate" | "weak";

interface PrimaryPath {
  id: PurposeKey;
  label: string;
  rationale: string;
  weaknesses: string[];
  isWeak: boolean;
}
interface AlternativePath {
  id: string;
  label: string;
  whyMayFit: string;
  whatChangesNow: string[];
  fitStrength: FitStrength;
}
interface ScenarioGuidance {
  scenario: ScenarioKind;
  trigger: string;
  affects: string[];
  whatPausesNow: string[];
  whatToDoInstead: string[];
  shouldSwitchPath: boolean;
}
interface PathwayPlan {
  planId: string;
  generatedAt: string;
  primaryPath: PrimaryPath | null;
  alternatives: AlternativePath[];
  guidance: ScenarioGuidance | null;
}

const SCENARIO_META: Record<
  ScenarioKind,
  { label: string; icon: LucideIcon; tone: "rose" | "amber" | "stone" }
> = {
  denied: { label: "Application denied", icon: AlertOctagon, tone: "rose" },
  delayed: { label: "Application delayed", icon: Clock, tone: "amber" },
  stalled: { label: "Plan stalled", icon: PauseCircle, tone: "stone" },
};

const STRENGTH_META: Record<
  FitStrength,
  { label: string; pill: string }
> = {
  strong: {
    label: "Strong fit",
    pill: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
  },
  moderate: {
    label: "Possible fit",
    pill: "border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10",
  },
  weak: {
    label: "Loose fit",
    pill: "border-stone-500/40 text-stone-700 dark:text-stone-300 bg-stone-500/10",
  },
};

export function PathwaysSection() {
  const [plan, setPlan] = useState<PathwayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/pathways");
        if (!res.ok) {
          if (res.status === 404) {
            setPlan(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as PathwayPlan;
        if (!cancelled) setPlan(data);
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
        className="flex items-center gap-2 text-[#7E9088] text-[12.5px] gm-surface px-5 py-4"
        data-testid="pathways-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your pathway…
      </div>
    );
  }
  if (error || !plan) {
    return (
      <div className="gm-surface p-5" data-testid="pathways-section">
        <span className="gm-eyebrow mb-2">Plan B</span>
        <p className="text-[12.5px] text-[#7E9088] mt-2 leading-relaxed">
          {error
            ? `Couldn't load the pathway plan: ${error}`
            : "Pick a relocation purpose to see your current path and realistic alternatives."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="pathways-section">
      <div>
        <span className="gm-eyebrow">Plan B</span>
        <h2 className="text-[15px] font-semibold text-[#1F2A24] mt-1.5" data-testid="pathways-heading">
          Your path &amp; alternatives
        </h2>
      </div>

      {plan.guidance && <ScenarioBanner guidance={plan.guidance} />}

      {plan.primaryPath ? (
        <PrimaryCard primary={plan.primaryPath} />
      ) : (
        <PrimaryEmpty />
      )}

      {plan.alternatives.length > 0 && (
        <div className="space-y-2.5" data-testid="pathways-alternatives">
          <span className="gm-eyebrow">Alternatives that fit your state</span>
          <ul className="space-y-2.5">
            {plan.alternatives.map((alt) => (
              <li key={alt.id}>
                <AlternativeCard alt={alt} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11.5px] text-[#7E9088] italic">
        These suggestions are state-driven, not legal advice. Final decisions stay with you and the authority.
      </p>
    </section>
  );
}

// ---- Sub-components -------------------------------------------------------

function ScenarioBanner({ guidance }: { guidance: ScenarioGuidance }) {
  const meta = SCENARIO_META[guidance.scenario];
  const Icon = meta.icon;
  const stripe =
    meta.tone === "rose" ? "#B5414C" : meta.tone === "amber" ? "#C99746" : "#7E9088";
  const statusText =
    meta.tone === "rose"
      ? "text-[#B5414C]"
      : meta.tone === "amber"
        ? "text-[#8C6B2F]"
        : "text-[#4E5F57]";
  return (
    <div
      className="gm-surface px-3.5 py-3"
      style={{ borderLeft: `3px solid ${stripe}` }}
      data-testid="pathways-scenario-banner"
      data-scenario={guidance.scenario}
    >
      <header className="flex items-start gap-2 mb-2">
        <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", statusText)} strokeWidth={1.7} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h3 className="text-[13px] font-semibold leading-snug text-[#1F2A24]">
              {guidance.trigger}
            </h3>
            <span className={cn("text-[11px] font-medium", statusText)}>{meta.label}</span>
          </div>
        </div>
        {guidance.shouldSwitchPath && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#B5414C] shrink-0">
            <RotateCcw className="w-3 h-3" strokeWidth={1.7} />
            Pivot suggested
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-5">
        <ScenarioColumn icon={Sparkles} label="Affects" items={guidance.affects} />
        <ScenarioColumn icon={PauseCircle} label="Pause now" items={guidance.whatPausesNow} />
        <ScenarioColumn icon={ArrowUpRight} label="Do instead" items={guidance.whatToDoInstead} />
      </div>
    </div>
  );
}

function ScenarioColumn({
  icon: Icon,
  label,
  items,
}: {
  icon: LucideIcon;
  label: string;
  items: string[];
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide font-semibold opacity-80 mb-1 flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <ul className="space-y-0.5 list-disc ml-4">
        {items.map((it, i) => (
          <li key={i} className="text-xs leading-relaxed">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrimaryCard({ primary }: { primary: PrimaryPath }) {
  const stripe = primary.isWeak ? "#C99746" : "#7BB091";
  const statusText = primary.isWeak ? "text-[#8C6B2F]" : "text-[#3F6B53]";
  return (
    <article
      className="gm-surface px-3.5 py-3"
      style={{ borderLeft: `3px solid ${stripe}` }}
      data-testid="pathways-primary"
      data-primary-id={primary.id}
      data-primary-weak={primary.isWeak ? "true" : "false"}
    >
      <header className="flex items-start gap-2 mb-1">
        <Compass className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", statusText)} strokeWidth={1.7} />
        <div className="flex-1 min-w-0">
          <span className="gm-eyebrow !text-[10px]">Current path</span>
          <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
            <h3 className="text-[13px] font-semibold text-[#1F2A24]">{primary.label}</h3>
            <span className={cn("text-[11px] font-medium", statusText)}>
              {primary.isWeak ? "Fragile" : "Holding up"}
            </span>
          </div>
        </div>
      </header>
      <p className="text-[12px] text-[#4E5F57] leading-relaxed pl-5">
        {primary.rationale}
      </p>
      {primary.weaknesses.length > 0 && (
        <div className="pl-5 mt-2">
          <span className="gm-eyebrow !text-[10px] mb-1">Why it's fragile right now</span>
          <ul className="space-y-0.5 list-disc ml-4 text-[12px] text-[#4E5F57]">
            {primary.weaknesses.map((w, i) => (
              <li key={i} className="leading-relaxed">{w}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function PrimaryEmpty() {
  return (
    <article className="gm-surface px-3.5 py-3">
      <header className="flex items-start gap-2 mb-1">
        <Compass className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7E9088]" strokeWidth={1.7} />
        <div className="flex-1 min-w-0">
          <span className="gm-eyebrow !text-[10px]">Current path</span>
          <h3 className="text-[13px] font-semibold text-[#1F2A24] mt-0.5">Not set yet</h3>
        </div>
      </header>
      <p className="text-[12px] text-[#4E5F57] leading-relaxed pl-5">
        Pick a relocation purpose (work / study / digital nomad / settle) in
        onboarding and we'll surface the right primary path + alternatives.
      </p>
      <div className="pl-5 mt-2">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[#3F6B53] hover:underline"
        >
          Open onboarding
          <ArrowRight className="w-3 h-3" strokeWidth={1.7} />
        </Link>
      </div>
    </article>
  );
}

function AlternativeCard({ alt }: { alt: AlternativePath }) {
  const meta = STRENGTH_META[alt.fitStrength];
  const stripe =
    alt.fitStrength === "strong"
      ? "#7BB091"
      : alt.fitStrength === "moderate"
        ? "#C99746"
        : "#7E9088";
  const statusText =
    alt.fitStrength === "strong"
      ? "text-[#3F6B53]"
      : alt.fitStrength === "moderate"
        ? "text-[#8C6B2F]"
        : "text-[#4E5F57]";
  void meta; // legacy reference; kept for potential future use
  return (
    <article
      className="gm-surface px-3.5 py-3"
      style={{ borderLeft: `3px solid ${stripe}` }}
      data-testid={`pathways-alternative-${alt.id}`}
      data-alt-strength={alt.fitStrength}
    >
      <header className="flex items-start gap-2 mb-1">
        <GitBranch className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", statusText)} strokeWidth={1.7} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h4 className="text-[13px] font-semibold text-[#1F2A24]">{alt.label}</h4>
            <span className={cn("text-[11px] font-medium", statusText)}>
              {alt.fitStrength === "strong"
                ? "Strong fit"
                : alt.fitStrength === "moderate"
                  ? "Possible fit"
                  : "Loose fit"}
            </span>
          </div>
          <p className="text-[12px] text-[#4E5F57] leading-relaxed mt-0.5">
            {alt.whyMayFit}
          </p>
        </div>
      </header>
      <div className="pl-5">
        <p className="text-[10px] uppercase tracking-wide font-semibold text-[#7E9088] mb-1 flex items-center gap-1">
          <CalendarClock className="w-3 h-3" strokeWidth={1.7} />
          What changes if you pivot
        </p>
        <ul className="space-y-0.5 list-disc ml-4 text-[12px] text-[#4E5F57]">
          {alt.whatChangesNow.map((c, i) => (
            <li key={i} className="leading-relaxed">{c}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

// Marker import to keep tooling happy if any of these end up unused
// in a refactor — they're referenced via tones.
void CheckCircle2;
