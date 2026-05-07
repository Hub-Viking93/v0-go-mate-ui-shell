// =============================================================
// TaxOverviewSection — Phase 6C "tax overview"
// =============================================================
// Year-1 tax orientation: yearOneSummary + checkpoints + watchouts
// + nextStep + disclaimer. State-driven on destination, citizenship,
// purpose, posting_or_secondment, departure_tax_filing_required, stage,
// arrival_date.
//
// NOT a tax engine, NOT a calculator, NOT filing. Advisory only.
// =============================================================

import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Compass,
  FileWarning,
  Globe,
  Info,
  Loader2,
  Receipt,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---- Types (mirror of API) ------------------------------------------------

type TaxRegimeProfile =
  | "eu_residency_based"
  | "uk_srt"
  | "us_citizenship_based"
  | "canada_residency_based"
  | "aunz_residency_based"
  | "generic";

type CheckpointTiming = "before_move" | "first_30d" | "first_90d" | "first_year_end" | "ongoing";

type CheckpointKind =
  | "registration"
  | "withholding"
  | "residency_clock"
  | "dual_residency"
  | "year_end_filing"
  | "social_security"
  | "departure_origin";

interface TaxCheckpoint {
  id: string;
  kind: CheckpointKind;
  timing: CheckpointTiming;
  title: string;
  description: string;
  whyItMatters: string;
}

type WatchoutSeverity = "info" | "warning" | "high";

type WatchoutKind =
  | "tax_residence_trap"
  | "double_taxation_risk"
  | "departure_tax"
  | "us_citizenship_based_taxation"
  | "social_security_continuity"
  | "split_year_handling"
  | "foreign_income_reporting"
  | "year_end_calendar";

interface TaxWatchout {
  id: string;
  kind: WatchoutKind;
  severity: WatchoutSeverity;
  title: string;
  description: string;
  whatToDo: string;
}

type TaxNextStepKind =
  | "due_diligence"
  | "talk_to_accountant"
  | "register_destination"
  | "track_residency_days"
  | "file_year_one_return"
  | "monitor";

interface TaxNextStep {
  kind: TaxNextStepKind;
  title: string;
  body: string;
  targetRoute: string | null;
}

interface TaxOverviewReport {
  planId: string;
  generatedAt: string;
  destination: string | null;
  origin: string | null;
  regimeProfile: TaxRegimeProfile;
  regimeLabel: string;
  yearOneSummary: string;
  checkpoints: TaxCheckpoint[];
  watchouts: TaxWatchout[];
  nextStep: TaxNextStep;
  disclaimer: string;
}

// ---- Visual meta ----------------------------------------------------------

const TIMING_META: Record<CheckpointTiming, { label: string; color: string; stripe: string }> = {
  before_move: { label: "Before move", color: "text-[#B5414C]", stripe: "#B5414C" },
  first_30d: { label: "First 30d", color: "text-[#8C6B2F]", stripe: "#C99746" },
  first_90d: { label: "First 90d", color: "text-[#8C6B2F]", stripe: "#C99746" },
  first_year_end: { label: "First year-end", color: "text-[#3F6B6F]", stripe: "#5D9CA5" },
  ongoing: { label: "Ongoing", color: "text-[#7E9088]", stripe: "#DCE7DF" },
};

const KIND_ICON: Record<CheckpointKind, LucideIcon> = {
  registration: ClipboardCheck,
  withholding: Receipt,
  residency_clock: CalendarClock,
  dual_residency: Globe,
  year_end_filing: FileWarning,
  social_security: ShieldAlert,
  departure_origin: ArrowRight,
};

const SEVERITY_META: Record<
  WatchoutSeverity,
  { label: string; color: string; stripe: string; icon: LucideIcon }
> = {
  high: { label: "High", color: "text-[#B5414C]", stripe: "#B5414C", icon: AlertOctagon },
  warning: { label: "Warning", color: "text-[#8C6B2F]", stripe: "#C99746", icon: AlertTriangle },
  info: { label: "Info", color: "text-[#7E9088]", stripe: "#DCE7DF", icon: Info },
};

const REGIME_LABEL: Record<TaxRegimeProfile, string> = {
  eu_residency_based: "EU residency-based",
  uk_srt: "UK SRT",
  us_citizenship_based: "US citizenship-based",
  canada_residency_based: "Canada ties-test",
  aunz_residency_based: "Australia / NZ",
  generic: "Destination authority",
};

const NEXT_STEP_META: Record<TaxNextStepKind, { label: string; color: string; icon: LucideIcon }> = {
  due_diligence: { label: "Due diligence", color: "text-[#7E9088]", icon: Compass },
  talk_to_accountant: { label: "Talk to a pro", color: "text-[#3F6B53]", icon: ShieldAlert },
  register_destination: { label: "Register", color: "text-[#8C6B2F]", icon: ClipboardCheck },
  track_residency_days: { label: "Track days", color: "text-[#3F6B6F]", icon: CalendarClock },
  file_year_one_return: { label: "File year-1", color: "text-[#B5414C]", icon: FileWarning },
  monitor: { label: "Monitor", color: "text-[#7E9088]", icon: Info },
};

// ---- Component ------------------------------------------------------------

export function TaxOverviewSection() {
  const [report, setReport] = useState<TaxOverviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/tax-overview");
        if (!res.ok) {
          if (res.status === 404) {
            setReport(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as TaxOverviewReport;
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
        className="flex items-center gap-2 text-[#7E9088] text-[12.5px] gm-surface px-5 py-4"
        data-testid="tax-overview-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your year-1 tax overview…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="gm-surface p-5" data-testid="tax-overview-section">
        <span className="gm-eyebrow mb-2">Year-1 tax overview</span>
        <p className="text-[12.5px] text-[#7E9088] mt-2 leading-relaxed">
          {error
            ? `Couldn't load tax overview: ${error}`
            : "Set destination + arrival date to get a year-1 tax orientation."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-8" data-testid="tax-overview-section">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <span className="gm-eyebrow">Year-1 tax</span>
          <h2 className="text-[16px] font-semibold text-[#1F2A24] mt-1.5" data-testid="tax-overview-heading">
            What to expect in your first fiscal year
          </h2>
          <p className="text-[12px] text-[#7E9088] mt-0.5 leading-relaxed">
            Practical orientation — checkpoints, watchouts and a single next step. Not tax advice.
          </p>
        </div>
        <span
          className="text-[11px] font-medium tabular-nums px-2 py-0.5 rounded text-[#3F6B6F] gm-surface-sub shrink-0"
          data-testid="tax-regime-badge"
        >
          {REGIME_LABEL[report.regimeProfile]}
        </span>
      </div>

      {/* Headline state — open by default */}
      <div className="space-y-3">
        <SummaryCard
          summary={report.yearOneSummary}
          regimeLabel={report.regimeLabel}
          regime={report.regimeProfile}
        />
        <NextStepCard nextStep={report.nextStep} />
      </div>

      <CollapseSection
        title="Likely checkpoints"
        description="What to keep on the radar — by when, and why it matters."
        count={report.checkpoints.length}
      >
        {report.checkpoints.map((c) => (
          <CheckpointRow key={c.id} checkpoint={c} />
        ))}
      </CollapseSection>

      <CollapseSection
        title="Common watchouts"
        description="Pitfalls year-1 filers fall into — gated by your profile so the list isn't generic."
        count={report.watchouts.length}
      >
        {report.watchouts.map((w) => (
          <WatchoutRow key={w.id} watchout={w} />
        ))}
      </CollapseSection>

      <p
        className="text-[11.5px] text-[#7E9088] italic leading-relaxed border-t border-[#DCE7DF] pt-3"
        data-testid="tax-disclaimer"
      >
        {report.disclaimer}
      </p>
    </section>
  );
}

// ---- Section primitive ---------------------------------------------------

function CollapseSection({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1F2A24]">{title}</h3>
          {description && (
            <p className="text-[11.5px] text-[#7E9088] mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
        {typeof count === "number" && (
          <span className="text-[11px] tabular-nums text-[#7E9088] gm-surface-sub px-2 py-0.5 shrink-0">
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

// ---- Headline sub-cards --------------------------------------------------

function SummaryCard({
  summary,
  regimeLabel,
  regime,
}: {
  summary: string;
  regimeLabel: string;
  regime: TaxRegimeProfile;
}) {
  return (
    <article
      className="gm-surface px-3.5 py-3"
      data-testid="tax-summary-card"
      data-regime-profile={regime}
    >
      <header className="flex items-baseline gap-2 flex-wrap mb-1.5">
        <Globe className="w-3.5 h-3.5 text-[#7E9088] shrink-0 self-center" strokeWidth={1.7} />
        <h3 className="text-[13.5px] font-semibold text-[#1F2A24]">What year 1 looks like</h3>
        <span className="text-[11.5px] text-[#7E9088]">·</span>
        <span className="text-[11.5px] text-[#4E5F57]">{regimeLabel}</span>
      </header>
      <p
        className="text-[12.5px] text-[#4E5F57] leading-relaxed pl-5"
        data-testid="tax-year-one-summary"
      >
        {summary}
      </p>
    </article>
  );
}

function NextStepCard({ nextStep }: { nextStep: TaxNextStep }) {
  const meta = NEXT_STEP_META[nextStep.kind];
  const Icon = meta.icon;
  const inner = (
    <article
      className={cn(
        "gm-surface px-3.5 py-3",
        nextStep.targetRoute && "gm-lift",
      )}
      data-testid="tax-next-step-card"
      data-next-step-kind={nextStep.kind}
    >
      <header className="flex items-baseline gap-2 flex-wrap mb-1.5">
        <Icon className={cn("w-3.5 h-3.5 shrink-0 self-center", meta.color)} strokeWidth={1.7} />
        <h3 className="text-[13.5px] font-semibold text-[#1F2A24]">{nextStep.title}</h3>
        <span className={cn("text-[11.5px] font-medium", meta.color)}>Next step · {meta.label}</span>
        {nextStep.targetRoute && (
          <ArrowRight className="gm-lift-arrow ml-auto w-3.5 h-3.5 text-[#7E9088]" strokeWidth={1.7} />
        )}
      </header>
      <p className="text-[12px] text-[#4E5F57] leading-relaxed pl-5">{nextStep.body}</p>
    </article>
  );
  if (nextStep.targetRoute) {
    return (
      <Link href={nextStep.targetRoute} className="block" data-testid="tax-next-step-link">
        {inner}
      </Link>
    );
  }
  return inner;
}

// ---- Rows ----------------------------------------------------------------

function CheckpointRow({ checkpoint }: { checkpoint: TaxCheckpoint }) {
  const Icon = KIND_ICON[checkpoint.kind] ?? CheckCircle2;
  const t = TIMING_META[checkpoint.timing];
  return (
    <details
      className="group gm-surface"
      style={{ borderLeft: `3px solid ${t.stripe}` }}
      data-testid={`tax-checkpoint-${checkpoint.id}`}
      data-checkpoint-kind={checkpoint.kind}
      data-checkpoint-timing={checkpoint.timing}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
          <h4 className="text-[13px] font-semibold text-[#1F2A24] flex-1 min-w-0 truncate">
            {checkpoint.title}
          </h4>
          <span className={cn("text-[11px] font-medium shrink-0", t.color)}>{t.label}</span>
          <ChevronDown
            className="w-3.5 h-3.5 text-[#7E9088] shrink-0 transition-transform group-open:rotate-180"
            strokeWidth={1.7}
          />
        </div>
      </summary>
      <div
        className="px-3.5 pb-3 pl-9 space-y-1.5"
        style={{ borderTop: "1px solid #ECF1EC", paddingTop: "8px" }}
      >
        <p className="text-[12px] text-[#4E5F57] leading-relaxed">{checkpoint.description}</p>
        <p className="text-[11.5px] text-[#7E9088] leading-relaxed">
          <span className="font-semibold text-[#1F2A24]">Why it matters: </span>
          {checkpoint.whyItMatters}
        </p>
      </div>
    </details>
  );
}

function WatchoutRow({ watchout }: { watchout: TaxWatchout }) {
  const meta = SEVERITY_META[watchout.severity];
  const Icon = meta.icon;
  return (
    <details
      className="group gm-surface"
      style={{ borderLeft: `3px solid ${meta.stripe}` }}
      data-testid={`tax-watchout-${watchout.id}`}
      data-watchout-kind={watchout.kind}
      data-watchout-severity={watchout.severity}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-3.5 h-3.5 shrink-0", meta.color)} strokeWidth={1.7} />
          <h4 className="text-[13px] font-semibold text-[#1F2A24] flex-1 min-w-0 truncate">
            {watchout.title}
          </h4>
          <span className={cn("text-[11px] font-medium shrink-0", meta.color)}>{meta.label}</span>
          <ChevronDown
            className="w-3.5 h-3.5 text-[#7E9088] shrink-0 transition-transform group-open:rotate-180"
            strokeWidth={1.7}
          />
        </div>
      </summary>
      <div
        className="px-3.5 pb-3 pl-9 space-y-1.5"
        style={{ borderTop: "1px solid #ECF1EC", paddingTop: "8px" }}
      >
        <p className="text-[12px] text-[#4E5F57] leading-relaxed">{watchout.description}</p>
        <p className="text-[11.5px] text-[#7E9088] leading-relaxed">
          <span className="font-semibold text-[#1F2A24]">What to do: </span>
          {watchout.whatToDo}
        </p>
      </div>
    </details>
  );
}
