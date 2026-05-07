// =============================================================
// DepartureFlowSection — Phase 5B "departure / repatriation flow"
// =============================================================
// Practical decision support for shutting down origin life: timing,
// cancel items (lease/utilities/subscriptions), deregistrations
// (population register, tax, social insurance, vehicle, mail forwarding),
// and belongings (take/sell/store/donate/dispose).
//
// NOT a movers marketplace, NOT shipment tracking, NOT a resale platform,
// NOT a contract-law engine.
// =============================================================

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Box,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Gauge,
  Home,
  Loader2,
  PackageCheck,
  Plane,
  Power,
  Receipt,
  Shield,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---- Types (mirror of API) ------------------------------------------------

type WhenToAct =
  | "now"
  | "8w_before"
  | "4w_before"
  | "2w_before"
  | "1w_before"
  | "move_day"
  | "after_move";

type CancelCategory =
  | "lease"
  | "utilities"
  | "subscriptions"
  | "insurance_origin"
  | "memberships"
  | "phone";

interface CancelItem {
  id: string;
  category: CancelCategory;
  title: string;
  description: string;
  noticeWeeks: number;
  whenToAct: WhenToAct;
  watchOut: string | null;
}

type DeregisterCategory =
  | "population_register"
  | "tax_authority"
  | "social_insurance"
  | "voter_registration"
  | "vehicle"
  | "mail_forwarding"
  | "professional_register";

interface DeregisterItem {
  id: string;
  category: DeregisterCategory;
  title: string;
  description: string;
  whenToAct: WhenToAct;
  legalConsequence: string;
  isDeregistration: boolean;
}

type BelongingsAction = "take" | "sell" | "store" | "donate" | "dispose";

interface BelongingsCategoryItem {
  id: string;
  label: string;
  recommendedActions: BelongingsAction[];
  guidance: string;
  examples: string[];
  watchOut: string | null;
}

type DepartureUrgency = "early" | "on_track" | "compressed" | "very_late" | "post_departure";

interface TimingMilestone {
  weeksBefore: number;
  label: string;
}

interface DepartureTiming {
  departureDate: string | null;
  weeksUntilDeparture: number | null;
  urgency: DepartureUrgency;
  message: string;
  nextStep: string;
  milestones: TimingMilestone[];
}

interface DepartureFlowReport {
  planId: string;
  generatedAt: string;
  direction: "leaving_origin" | "leaving_destination";
  closingFrom: string | null;
  goingTo: string | null;
  stage: string | null;
  timing: DepartureTiming;
  cancelItems: CancelItem[];
  deregisterItems: DeregisterItem[];
  belongings: BelongingsCategoryItem[];
  nextStep: string;
}

// ---- Visual meta ----------------------------------------------------------

function urgencyStripe(u: DepartureUrgency): string {
  if (u === "very_late") return "#B5414C";
  if (u === "compressed") return "#C99746";
  if (u === "post_departure") return "#5D9CA5";
  return "#7BB091";
}
function urgencyText(u: DepartureUrgency): { label: string; color: string } {
  if (u === "very_late") return { label: "Important — very late", color: "text-[#B5414C]" };
  if (u === "compressed") return { label: "Compressed", color: "text-[#8C6B2F]" };
  if (u === "post_departure") return { label: "Post-departure", color: "text-[#3F6B6F]" };
  if (u === "early") return { label: "Plenty of time", color: "text-[#3F6B53]" };
  return { label: "On track", color: "text-[#3F6B53]" };
}

const WHEN_LABEL: Record<WhenToAct, string> = {
  now: "Send today",
  "8w_before": "T-8 weeks",
  "4w_before": "T-4 weeks",
  "2w_before": "T-2 weeks",
  "1w_before": "T-1 week",
  move_day: "Move day",
  after_move: "After move",
};

function whenStripe(w: WhenToAct): string | undefined {
  if (w === "now") return "#B5414C";
  if (w === "8w_before") return "#C99746";
  if (w === "4w_before") return "#C99746";
  if (w === "2w_before") return "#7BB091";
  if (w === "1w_before") return "#7BB091";
  if (w === "after_move") return "#5D9CA5";
  return undefined;
}
function whenText(w: WhenToAct): string {
  if (w === "now") return "text-[#B5414C]";
  if (w === "8w_before" || w === "4w_before") return "text-[#8C6B2F]";
  if (w === "2w_before" || w === "1w_before") return "text-[#3F6B53]";
  if (w === "after_move") return "text-[#3F6B6F]";
  return "text-[#7E9088]";
}

const CANCEL_ICON: Record<CancelCategory, LucideIcon> = {
  lease: Home,
  utilities: Power,
  subscriptions: Receipt,
  insurance_origin: Shield,
  memberships: ClipboardList,
  phone: Receipt,
};

const DEREG_ICON: Record<DeregisterCategory, LucideIcon> = {
  population_register: ClipboardList,
  tax_authority: Receipt,
  social_insurance: Shield,
  voter_registration: ClipboardList,
  vehicle: Truck,
  mail_forwarding: Plane,
  professional_register: ClipboardList,
};

const ACTION_META: Record<BelongingsAction, { label: string; color: string }> = {
  take: { label: "Take", color: "text-[#3F6B53]" },
  sell: { label: "Sell", color: "text-[#3F6B6F]" },
  store: { label: "Store", color: "text-[#5D9CA5]" },
  donate: { label: "Donate", color: "text-[#8C6B2F]" },
  dispose: { label: "Dispose", color: "text-[#7E9088]" },
};

// ---- Component ------------------------------------------------------------

export function DepartureFlowSection() {
  const [report, setReport] = useState<DepartureFlowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/departure-flow");
        if (!res.ok) {
          if (res.status === 404) {
            setReport(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as DepartureFlowReport;
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
        data-testid="departure-flow-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your departure plan…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="gm-surface p-5" data-testid="departure-flow-section">
        <span className="gm-eyebrow mb-2">Closing down origin</span>
        <p className="text-[12.5px] text-[#7E9088] mt-2 leading-relaxed">
          {error
            ? `Couldn't load departure plan: ${error}`
            : "Set departure / arrival date to get a personalised closing-down call."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-8" data-testid="departure-flow-section">
      <div>
        <span className="gm-eyebrow">Departure</span>
        <h2 className="text-[16px] font-semibold text-[#1F2A24] mt-1.5" data-testid="departure-flow-heading">
          Closing down {report.closingFrom ? formatTitle(report.closingFrom) : "origin"}
        </h2>
        <p className="text-[12px] text-[#7E9088] mt-0.5 leading-relaxed">
          Cancel, deregister, and decide what to do with your stuff — practical decision support, not a movers marketplace.
        </p>
      </div>

      {/* Headline state — open by default */}
      <TimingCard timing={report.timing} headlineNextStep={report.nextStep} />

      <CollapseSection
        title="Cancel"
        description="Private contracts: leases, utilities, subscriptions, insurance, memberships."
        count={report.cancelItems.length}
      >
        {report.cancelItems.map((it) => (
          <CancelRow key={it.id} item={it} />
        ))}
      </CollapseSection>

      <CollapseSection
        title="Deregister + notify"
        description="Authorities, registers, mail. Different from cancellations — these don't cascade automatically."
        count={report.deregisterItems.length}
      >
        {report.deregisterItems.map((it) => (
          <DeregisterRow key={it.id} item={it} />
        ))}
      </CollapseSection>

      <CollapseSection
        title="What to do with your stuff"
        description="Take, sell, store, donate, dispose — guidance per category. Default action shown first."
        count={report.belongings.length}
      >
        {report.belongings.map((cat) => (
          <BelongingsRow key={cat.id} category={cat} />
        ))}
      </CollapseSection>

      <p className="text-[11.5px] text-[#7E9088] italic leading-relaxed">
        Departure support is decision orientation only — not a contract-law engine, mover booking, or
        resale marketplace. Notice periods and forms vary by country and contract; verify before sending.
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

// ---- Headline ------------------------------------------------------------

function TimingCard({
  timing,
  headlineNextStep,
}: {
  timing: DepartureTiming;
  headlineNextStep: string;
}) {
  const stripe = urgencyStripe(timing.urgency);
  const t = urgencyText(timing.urgency);
  return (
    <article
      className="gm-surface px-3.5 py-3"
      style={{ borderLeft: `3px solid ${stripe}` }}
      data-testid="departure-timing-card"
      data-departure-urgency={timing.urgency}
    >
      <header className="flex items-baseline gap-2 flex-wrap mb-1">
        <CalendarClock className="w-3.5 h-3.5 text-[#7E9088] shrink-0 self-center" strokeWidth={1.7} />
        <h3 className="text-[13.5px] font-semibold text-[#1F2A24]">When you leave</h3>
        <span className={cn("text-[11.5px] font-medium", t.color)}>{t.label}</span>
        {timing.weeksUntilDeparture !== null && (
          <>
            <span className="text-[11px] text-[#7E9088]">·</span>
            <span className="text-[11.5px] text-[#4E5F57]">
              {timing.weeksUntilDeparture >= 0
                ? `${timing.weeksUntilDeparture} wks to departure`
                : `${Math.abs(timing.weeksUntilDeparture)} wks since departure`}
            </span>
          </>
        )}
      </header>
      <div className="pl-5 space-y-1.5">
        <p className="text-[12.5px] text-[#4E5F57] leading-relaxed">{timing.message}</p>
        <p className="text-[11.5px] text-[#7E9088] leading-relaxed">
          <span className="font-semibold text-[#4E5F57]">Next step: </span>
          {headlineNextStep}
        </p>
        <ul className="space-y-0.5 pt-1" data-testid="departure-timing-milestones">
          {timing.milestones.map((m, i) => (
            <li
              key={i}
              className="text-[11.5px] text-[#4E5F57] flex items-baseline gap-2"
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

// ---- Rows ----------------------------------------------------------------

function CancelRow({ item }: { item: CancelItem }) {
  const Icon = CANCEL_ICON[item.category] ?? Power;
  const stripe = whenStripe(item.whenToAct);
  return (
    <details
      className="group gm-surface"
      style={stripe ? { borderLeft: `3px solid ${stripe}` } : undefined}
      data-testid={`departure-cancel-${item.id}`}
      data-cancel-when={item.whenToAct}
      data-cancel-category={item.category}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
          <h4 className="text-[13px] font-semibold text-[#1F2A24] flex-1 min-w-0 truncate">{item.title}</h4>
          <span className={cn("text-[11px] font-medium shrink-0", whenText(item.whenToAct))}>
            {WHEN_LABEL[item.whenToAct]}
          </span>
          <ChevronDown
            className="w-3.5 h-3.5 text-[#7E9088] shrink-0 transition-transform group-open:rotate-180"
            strokeWidth={1.7}
          />
        </div>
      </summary>
      <div className="px-3.5 pb-3 pl-9 space-y-1.5" style={{ borderTop: "1px solid #ECF1EC", paddingTop: "8px" }}>
        <p className="text-[12px] text-[#4E5F57] leading-relaxed">{item.description}</p>
        {item.watchOut && (
          <p className="text-[11.5px] text-[#8C6B2F] leading-relaxed flex items-baseline gap-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0 translate-y-0.5" strokeWidth={1.8} />
            <span>{item.watchOut}</span>
          </p>
        )}
      </div>
    </details>
  );
}

function DeregisterRow({ item }: { item: DeregisterItem }) {
  const Icon = DEREG_ICON[item.category] ?? ClipboardList;
  const stripe = whenStripe(item.whenToAct);
  return (
    <details
      className="group gm-surface"
      style={stripe ? { borderLeft: `3px solid ${stripe}` } : undefined}
      data-testid={`departure-deregister-${item.id}`}
      data-deregister-when={item.whenToAct}
      data-deregister-category={item.category}
      data-is-deregistration={item.isDeregistration ? "true" : "false"}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
          <h4 className="text-[13px] font-semibold text-[#1F2A24] flex-1 min-w-0 truncate">{item.title}</h4>
          <span className={cn("text-[11px] font-medium shrink-0", whenText(item.whenToAct))}>
            {WHEN_LABEL[item.whenToAct]}
          </span>
          {!item.isDeregistration && (
            <span className="text-[11px] text-[#7E9088] shrink-0">· Notification</span>
          )}
          <ChevronDown
            className="w-3.5 h-3.5 text-[#7E9088] shrink-0 transition-transform group-open:rotate-180"
            strokeWidth={1.7}
          />
        </div>
      </summary>
      <div className="px-3.5 pb-3 pl-9 space-y-1.5" style={{ borderTop: "1px solid #ECF1EC", paddingTop: "8px" }}>
        <p className="text-[12px] text-[#4E5F57] leading-relaxed">{item.description}</p>
        <p className="text-[11.5px] text-[#7E9088] leading-relaxed">
          <span className="font-semibold text-[#1F2A24]">If you skip it: </span>
          {item.legalConsequence}
        </p>
      </div>
    </details>
  );
}

function BelongingsRow({ category }: { category: BelongingsCategoryItem }) {
  const primary = category.recommendedActions[0];
  const Icon = primary === "take" ? PackageCheck : Box;
  return (
    <details
      className="group gm-surface"
      data-testid={`departure-belongings-${category.id}`}
      data-primary-action={primary}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon className="w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
          <h4 className="text-[13px] font-semibold text-[#1F2A24] flex-1 min-w-0">{category.label}</h4>
          <span className="flex items-center gap-1.5 shrink-0">
            {category.recommendedActions.map((a, i) => (
              <span
                key={a}
                className={cn("text-[11px] font-medium", ACTION_META[a].color)}
                data-testid={`belongings-action-${category.id}-${a}`}
              >
                {ACTION_META[a].label}
                {i < category.recommendedActions.length - 1 ? <span className="text-[#DCE7DF]"> · </span> : null}
              </span>
            ))}
          </span>
          <ChevronDown
            className="w-3.5 h-3.5 text-[#7E9088] shrink-0 transition-transform group-open:rotate-180"
            strokeWidth={1.7}
          />
        </div>
      </summary>
      <div className="px-3.5 pb-3 pl-9 space-y-1.5" style={{ borderTop: "1px solid #ECF1EC", paddingTop: "8px" }}>
        <p className="text-[12px] text-[#4E5F57] leading-relaxed">{category.guidance}</p>
        {category.examples.length > 0 && (
          <p className="text-[11.5px] text-[#7E9088] leading-relaxed">
            <span className="font-semibold text-[#4E5F57]">Examples: </span>
            {category.examples.join(", ")}
          </p>
        )}
        {category.watchOut && (
          <p className="text-[11.5px] text-[#8C6B2F] italic leading-relaxed flex items-baseline gap-1.5">
            <Gauge className="w-3 h-3 shrink-0 translate-y-0.5" strokeWidth={1.8} />
            <span>{category.watchOut}</span>
          </p>
        )}
      </div>
    </details>
  );
}

function formatTitle(s: string | null | undefined): string {
  if (!s) return "origin";
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
