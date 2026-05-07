// =============================================================
// HousingSupportSection — Phase 5A "housing support"
// =============================================================
// Practical decision support: search guidance, budget reasonableness,
// process walkthrough, scam warnings, timing call.
//
// NOT a listings marketplace. NOT affiliate logic. NOT a lease-review
// engine. Five sub-blocks the user can scan in under a minute.
// =============================================================

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  Compass,
  Eye,
  FileSignature,
  Home,
  Loader2,
  ListChecks,
  Search,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---- Types (mirror of API) ------------------------------------------------

type SearchSourceCategory =
  | "national_aggregator"
  | "local_aggregator"
  | "tenant_union"
  | "expat_board"
  | "social_marketplace"
  | "agency_or_broker"
  | "student_specific"
  | "subletting";

interface SearchGuidance {
  id: string;
  category: SearchSourceCategory;
  label: string;
  whyUseful: string;
  watchOuts: string;
  examples: string[];
  applicability: "primary" | "secondary";
}

type Currency = "EUR" | "USD" | "GBP" | "SEK" | "DKK" | "NOK" | "CHF" | "CAD" | "AUD";

interface BudgetAmount {
  amount: number;
  currency: Currency;
}
interface PriceBand {
  kind: "shared_room" | "studio" | "one_bed" | "two_bed";
  min: number;
  max: number;
  currency: Currency;
  primary: boolean;
}
type BudgetVerdict = "comfortable" | "tight" | "unrealistic" | "no_data" | "no_user_budget";

interface PriceExpectations {
  hasUserBudget: boolean;
  userBudget: BudgetAmount | null;
  destination: string | null;
  realisticBands: PriceBand[];
  userBudgetEurEquivalent: number | null;
  budgetVerdict: BudgetVerdict;
  verdictReasoning: string[];
  notes: string[];
}

interface ProcessStep {
  id: string;
  order: number;
  title: string;
  whatHappens: string;
  whatYouNeed: string[];
  commonBottleneck: string | null;
}

type ScamSeverity = "high" | "medium";
interface ScamWarning {
  id: string;
  severity: ScamSeverity;
  signal: string;
  whyDangerous: string;
  whatToDo: string;
}

type TimingUrgency = "ahead" | "on_track" | "start_now" | "behind" | "post_arrival";
interface TimingMilestone {
  weeksBefore: number;
  label: string;
}
interface TimingGuidance {
  arrivalDate: string | null;
  weeksUntilArrival: number | null;
  recommendedStartWeeksBefore: number;
  urgency: TimingUrgency;
  message: string;
  milestones: TimingMilestone[];
  nextStep: string;
}

interface HousingSupportReport {
  planId: string;
  generatedAt: string;
  destination: string | null;
  targetCity: string | null;
  searchGuidance: SearchGuidance[];
  priceExpectations: PriceExpectations;
  processSteps: ProcessStep[];
  scamWarnings: ScamWarning[];
  timingGuidance: TimingGuidance;
}

// ---- Visual meta ----------------------------------------------------------

const CATEGORY_ICON: Record<SearchSourceCategory, LucideIcon> = {
  national_aggregator: Search,
  local_aggregator: Compass,
  tenant_union: ShieldAlert,
  expat_board: ListChecks,
  social_marketplace: Eye,
  agency_or_broker: FileSignature,
  student_specific: ListChecks,
  subletting: Home,
};

const KIND_LABEL: Record<PriceBand["kind"], string> = {
  shared_room: "Shared room",
  studio: "Studio",
  one_bed: "1-bedroom",
  two_bed: "2-bedroom",
};

// ---- Component ------------------------------------------------------------

export function HousingSupportSection() {
  const [report, setReport] = useState<HousingSupportReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/housing-support");
        if (!res.ok) {
          if (res.status === 404) {
            setReport(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as HousingSupportReport;
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
        data-testid="housing-support-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your housing-support guide…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="gm-surface p-5" data-testid="housing-support-section">
        <span className="gm-eyebrow mb-2">Housing support</span>
        <p className="text-[12.5px] text-[#7E9088] mt-2 leading-relaxed">
          {error
            ? `Couldn't load housing support: ${error}`
            : "Set destination + arrival to get realistic budget, search and timing guidance."}
        </p>
      </div>
    );
  }

  const destinationLabel = report.targetCity
    ? `${formatTitle(report.targetCity)}, ${formatTitle(report.destination ?? "")}`
    : formatTitle(report.destination ?? "your destination");

  return (
    <section className="space-y-8" data-testid="housing-support-section">
      <div>
        <span className="gm-eyebrow">Housing support</span>
        <h2 className="text-[16px] font-semibold text-[#1F2A24] mt-1.5" data-testid="housing-support-heading">
          Find a place in {destinationLabel}
        </h2>
        <p className="text-[12px] text-[#7E9088] mt-0.5 leading-relaxed">
          Decision support across budget, search sources, process, scams and timing.
        </p>
      </div>

      {/* Headline state — open by default, this is the answer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BudgetCard expectations={report.priceExpectations} />
        <TimingCard timing={report.timingGuidance} />
      </div>

      {/* Supporting lists — sectioned typography, items collapsed */}
      <CollapseSection
        title="Where to search"
        description="Source categories — orientation, not recommendations. Verify the listing on its source before paying."
        count={report.searchGuidance.length}
      >
        {report.searchGuidance.map((item) => (
          <SearchRow key={item.id} item={item} />
        ))}
      </CollapseSection>

      <CollapseSection
        title="How the process works"
        description="What to expect end-to-end. Common bottleneck on each step is destination-aware."
        count={report.processSteps.length}
      >
        {report.processSteps.map((step) => (
          <ProcessRow key={step.id} step={step} />
        ))}
      </CollapseSection>

      <CollapseSection
        title="Red flags + scam patterns"
        description="If you see any of these, treat the listing as fake until proven otherwise."
        count={report.scamWarnings.length}
      >
        {report.scamWarnings.map((w) => (
          <ScamRow key={w.id} warning={w} />
        ))}
      </CollapseSection>

      <p className="text-[11.5px] text-[#7E9088] italic leading-relaxed">
        Housing support is decision orientation, not a listings marketplace or partner referral.
        Ranges are rough; verify everything against real listings and a written contract before paying.
      </p>
    </section>
  );
}

// ---- Section + row primitives --------------------------------------------

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

function SearchRow({ item }: { item: SearchGuidance }) {
  const Icon = CATEGORY_ICON[item.category] ?? Search;
  const isPrimary = item.applicability === "primary";
  return (
    <details
      className="group gm-surface"
      style={{ borderLeft: isPrimary ? "3px solid #7BB091" : undefined }}
      data-testid={`housing-search-${item.id}`}
      data-search-applicability={item.applicability}
      data-search-category={item.category}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
          <h4 className="text-[13px] font-semibold text-[#1F2A24] flex-1 min-w-0 truncate">
            {item.label}
          </h4>
          <span
            className={cn(
              "text-[11px] font-medium shrink-0",
              isPrimary ? "text-[#3F6B53]" : "text-[#7E9088]",
            )}
          >
            {isPrimary ? "Primary" : "Secondary"}
          </span>
          <ChevronDown
            className="w-3.5 h-3.5 text-[#7E9088] shrink-0 transition-transform group-open:rotate-180"
            strokeWidth={1.7}
          />
        </div>
      </summary>
      <div className="px-3.5 pb-3 pl-9 space-y-1.5" style={{ borderTop: "1px solid #ECF1EC", paddingTop: "8px" }}>
        <p className="text-[12px] text-[#4E5F57] leading-relaxed">{item.whyUseful}</p>
        {item.examples.length > 0 && (
          <p className="text-[11.5px] text-[#7E9088] leading-relaxed">
            <span className="font-semibold text-[#4E5F57]">Look up: </span>
            {item.examples.join(", ")}
          </p>
        )}
        <p className="text-[11px] text-[#7E9088] italic leading-relaxed">{item.watchOuts}</p>
      </div>
    </details>
  );
}

function ProcessRow({ step }: { step: ProcessStep }) {
  return (
    <details
      className="group gm-surface"
      data-testid={`housing-process-${step.id}`}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 w-5 h-5 rounded-full gm-surface-sub text-[10px] font-mono flex items-center justify-center text-[#4E5F57]">
            {step.order + 1}
          </span>
          <h4 className="text-[13px] font-semibold text-[#1F2A24] flex-1 min-w-0">{step.title}</h4>
          {step.commonBottleneck && (
            <span className="text-[11px] font-medium text-[#8C6B2F] shrink-0">Bottleneck</span>
          )}
          <ChevronDown
            className="w-3.5 h-3.5 text-[#7E9088] shrink-0 transition-transform group-open:rotate-180"
            strokeWidth={1.7}
          />
        </div>
      </summary>
      <div className="px-3.5 pb-3 pl-10 space-y-1.5" style={{ borderTop: "1px solid #ECF1EC", paddingTop: "8px" }}>
        <p className="text-[12px] text-[#4E5F57] leading-relaxed">{step.whatHappens}</p>
        {step.whatYouNeed.length > 0 && (
          <p className="text-[11.5px] text-[#7E9088] leading-relaxed">
            <span className="font-semibold text-[#4E5F57]">You'll need: </span>
            {step.whatYouNeed.join(" · ")}
          </p>
        )}
        {step.commonBottleneck && (
          <p
            className="text-[11.5px] leading-relaxed text-[#8C6B2F]"
            data-testid={`housing-bottleneck-${step.id}`}
          >
            <span className="font-semibold">Bottleneck: </span>
            {step.commonBottleneck}
          </p>
        )}
      </div>
    </details>
  );
}

function ScamRow({ warning }: { warning: ScamWarning }) {
  const stripe = warning.severity === "high" ? "#B5414C" : "#C99746";
  const statusText = warning.severity === "high" ? "text-[#B5414C]" : "text-[#8C6B2F]";
  const label = warning.severity === "high" ? "High risk" : "Medium risk";
  return (
    <details
      className="group gm-surface"
      style={{ borderLeft: `3px solid ${stripe}` }}
      data-testid={`housing-scam-${warning.id}`}
      data-scam-severity={warning.severity}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-center gap-2">
          <ShieldAlert className={cn("w-3.5 h-3.5 shrink-0", statusText)} strokeWidth={1.7} />
          <h4 className="text-[13px] font-semibold text-[#1F2A24] flex-1 min-w-0">{warning.signal}</h4>
          <span className={cn("text-[11px] font-medium shrink-0", statusText)}>{label}</span>
          <ChevronDown
            className="w-3.5 h-3.5 text-[#7E9088] shrink-0 transition-transform group-open:rotate-180"
            strokeWidth={1.7}
          />
        </div>
      </summary>
      <div className="px-3.5 pb-3 pl-9 space-y-1.5" style={{ borderTop: "1px solid #ECF1EC", paddingTop: "8px" }}>
        <p className="text-[12px] text-[#4E5F57] leading-relaxed">
          <span className="font-semibold text-[#1F2A24]">Why dangerous: </span>
          {warning.whyDangerous}
        </p>
        <p className="text-[12px] text-[#4E5F57] leading-relaxed">
          <span className="font-semibold text-[#1F2A24]">What to do: </span>
          {warning.whatToDo}
        </p>
      </div>
    </details>
  );
}

// ---- Sub-cards ------------------------------------------------------------

function BudgetCard({ expectations }: { expectations: PriceExpectations }) {
  const primaryBand = useMemo(
    () =>
      expectations.realisticBands.find((b) => b.primary) ??
      expectations.realisticBands[1] ??
      expectations.realisticBands[0] ??
      null,
    [expectations.realisticBands],
  );
  const stripe =
    expectations.budgetVerdict === "unrealistic"
      ? "#B5414C"
      : expectations.budgetVerdict === "tight"
        ? "#C99746"
        : expectations.budgetVerdict === "comfortable"
          ? "#7BB091"
          : "#DCE7DF";
  const verdictText =
    expectations.budgetVerdict === "unrealistic"
      ? { label: "Important — unrealistic", color: "text-[#B5414C]" }
      : expectations.budgetVerdict === "tight"
        ? { label: "Tight", color: "text-[#8C6B2F]" }
        : expectations.budgetVerdict === "comfortable"
          ? { label: "Realistic", color: "text-[#3F6B53]" }
          : expectations.budgetVerdict === "no_user_budget"
            ? { label: "Add budget", color: "text-[#4E5F57]" }
            : { label: "No band yet", color: "text-[#4E5F57]" };
  return (
    <article
      className="gm-surface px-3.5 py-3 h-full"
      style={{ borderLeft: `3px solid ${stripe}` }}
      data-testid="housing-budget-card"
      data-budget-verdict={expectations.budgetVerdict}
    >
      <header className="flex items-baseline gap-2 flex-wrap mb-1">
        <CircleDollarSign className="w-3.5 h-3.5 text-[#7E9088] shrink-0 self-center" strokeWidth={1.7} />
        <h3 className="text-[13px] font-semibold text-[#1F2A24]">Budget</h3>
        <span className={cn("text-[11px] font-medium", verdictText.color)}>{verdictText.label}</span>
        {expectations.userBudget && (
          <>
            <span className="text-[11px] text-[#7E9088]">·</span>
            <span className="text-[11px] text-[#4E5F57]">
              {expectations.userBudget.amount.toLocaleString()} {expectations.userBudget.currency}
            </span>
          </>
        )}
      </header>
      <div className="space-y-1.5 pl-5">
        {expectations.verdictReasoning.map((line, i) => (
          <p key={i} className="text-[12px] text-[#4E5F57] leading-relaxed">
            {line}
          </p>
        ))}
        {primaryBand && (
          <p className="text-[11px] text-[#7E9088]" data-testid="housing-band-summary">
            <span className="font-medium text-[#4E5F57]">Typical {KIND_LABEL[primaryBand.kind].toLowerCase()}: </span>
            €{primaryBand.min}–€{primaryBand.max}/month
          </p>
        )}
        {expectations.realisticBands.length > 1 && (
          <ul className="text-[11px] text-[#7E9088] space-y-0.5">
            {expectations.realisticBands
              .filter((b) => !b.primary)
              .map((b) => (
                <li key={b.kind}>
                  {KIND_LABEL[b.kind]}: €{b.min}–€{b.max}
                </li>
              ))}
          </ul>
        )}
        {expectations.notes.length > 0 && (
          <details className="group">
            <summary className="text-[11px] text-[#7E9088] cursor-pointer hover:text-[#4E5F57] inline-flex items-center gap-1">
              Notes
              <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" strokeWidth={1.7} />
            </summary>
            <div className="mt-1 space-y-1">
              {expectations.notes.map((n, i) => (
                <p key={i} className="text-[11px] text-[#7E9088] italic leading-relaxed">
                  {n}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>
    </article>
  );
}

function TimingCard({ timing }: { timing: TimingGuidance }) {
  const stripe =
    timing.urgency === "behind"
      ? "#B5414C"
      : timing.urgency === "start_now"
        ? "#C99746"
        : timing.urgency === "post_arrival"
          ? "#8FB9BF"
          : "#7BB091";
  const urgencyText =
    timing.urgency === "behind"
      ? { label: "Important — behind", color: "text-[#B5414C]" }
      : timing.urgency === "start_now"
        ? { label: "Start now", color: "text-[#8C6B2F]" }
        : timing.urgency === "ahead"
          ? { label: "Ahead of curve", color: "text-[#3F6B53]" }
          : timing.urgency === "on_track"
            ? { label: "On track", color: "text-[#3F6B53]" }
            : { label: "Post-arrival", color: "text-[#3F6B6F]" };
  return (
    <article
      className="gm-surface px-3.5 py-3 h-full"
      style={{ borderLeft: `3px solid ${stripe}` }}
      data-testid="housing-timing-card"
      data-timing-urgency={timing.urgency}
    >
      <header className="flex items-baseline gap-2 flex-wrap mb-1">
        <CalendarClock className="w-3.5 h-3.5 text-[#7E9088] shrink-0 self-center" strokeWidth={1.7} />
        <h3 className="text-[13px] font-semibold text-[#1F2A24]">When to start</h3>
        <span className={cn("text-[11px] font-medium", urgencyText.color)}>{urgencyText.label}</span>
        {timing.weeksUntilArrival !== null && (
          <>
            <span className="text-[11px] text-[#7E9088]">·</span>
            <span className="text-[11px] text-[#4E5F57]">
              {timing.weeksUntilArrival >= 0
                ? `${timing.weeksUntilArrival} wks to arrival`
                : `${Math.abs(timing.weeksUntilArrival)} wks since arrival`}
            </span>
          </>
        )}
      </header>
      <div className="space-y-1.5 pl-5">
        <p className="text-[12px] text-[#4E5F57] leading-relaxed">{timing.message}</p>
        <p className="text-[11px] text-[#7E9088] leading-relaxed">
          <span className="font-semibold text-[#4E5F57]">Next: </span>
          {timing.nextStep}
        </p>
        <ul className="space-y-0.5 pt-1" data-testid="housing-timing-milestones">
          {timing.milestones.map((m, i) => (
            <li
              key={i}
              className="text-[11px] text-[#4E5F57] flex items-baseline gap-2"
              data-milestone-weeks={m.weeksBefore}
            >
              <span className="font-mono text-[#7E9088] shrink-0 tabular-nums">
                T-{m.weeksBefore}w
              </span>
              <span>{m.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function formatTitle(s: string | null | undefined): string {
  if (!s) return "your destination";
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
