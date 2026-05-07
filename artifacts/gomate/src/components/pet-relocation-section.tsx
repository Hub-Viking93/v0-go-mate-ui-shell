// =============================================================
// PetRelocationSection — Phase 5C "pet relocation"
// =============================================================
// Practical decision support for moving pets internationally:
// timeline + microchip + vaccination + import-rule + transport.
//
// NOT a marketplace, NOT flight-booking, NOT vet-booking, NOT
// insurance-comparison. State-driven on profile.pets et al.
// =============================================================

import { useEffect, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Globe,
  Loader2,
  PawPrint,
  Plane,
  Shield,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---- Types (mirror of API) ------------------------------------------------

type MicrochipStatus = "in_place" | "outdated" | "missing" | "unknown";
type VaccinationStatus = "current" | "outdated" | "starting" | "unknown";
type GuidanceUrgency = "now" | "soon" | "on_track" | "later" | "complete";
type DestinationRuleProfile =
  | "eu" | "uk" | "usa" | "canada" | "australia_nz" | "rabies_free" | "generic";
type TransportMode = "cabin" | "cargo" | "ground" | "unknown";

interface PetSummary {
  species: string | null;
  breed: string | null;
  size_weight: string | null;
  age: string | null;
  microchip: MicrochipStatus;
  vaccination: VaccinationStatus;
  isSnubNosedBreed: boolean;
}

interface MicrochipGuidance {
  status: MicrochipStatus;
  urgency: GuidanceUrgency;
  message: string;
  recommendedAction: string;
  orderingRule: string;
}
interface VaccinationGuidance {
  status: VaccinationStatus;
  urgency: GuidanceUrgency;
  message: string;
  recommendedAction: string;
  postVaccineWaitDays: number;
  commonGap: string;
}
interface ImportRuleGuidance {
  destinationProfile: DestinationRuleProfile;
  destinationLabel: string;
  keyChecks: string[];
  minimumLeadTimeWeeks: number;
  biggestWatchOut: string;
  authoritativeSource: string;
}
interface TransportGuidance {
  recommendedMode: TransportMode;
  modeReasoning: string[];
  airlineConstraints: string[];
  breedWarning: string | null;
  seasonalConsideration: string;
  cratePrep: string;
}
type TimelinePhaseKey =
  | "T-26w" | "T-12w" | "T-8w" | "T-4w" | "T-2w" | "T-1w" | "move_day" | "post_arrival";
interface TimelinePhase {
  id: TimelinePhaseKey;
  weeksBefore: number;
  label: string;
  whatHappens: string;
  todos: string[];
  passed: boolean;
  behind: boolean;
  watchOut: string | null;
}
interface PetRelocationReport {
  planId: string;
  generatedAt: string;
  direction: string;
  hasPets: boolean;
  pet: PetSummary | null;
  destination: string | null;
  arrivalDate: string | null;
  weeksUntilDeparture: number | null;
  microchipGuidance: MicrochipGuidance;
  vaccinationGuidance: VaccinationGuidance;
  importRuleGuidance: ImportRuleGuidance;
  transportGuidance: TransportGuidance;
  timeline: TimelinePhase[];
  nextStep: string;
}

// ---- Visual meta ----------------------------------------------------------

function urgencyStripe(u: GuidanceUrgency): string | undefined {
  if (u === "now") return "#B5414C";
  if (u === "soon") return "#C99746";
  if (u === "on_track" || u === "complete") return "#7BB091";
  if (u === "later") return undefined;
  return undefined;
}
function urgencyText(u: GuidanceUrgency): { label: string; color: string } {
  if (u === "now") return { label: "Now", color: "text-[#B5414C]" };
  if (u === "soon") return { label: "Soon", color: "text-[#8C6B2F]" };
  if (u === "on_track") return { label: "On track", color: "text-[#3F6B53]" };
  if (u === "complete") return { label: "Complete", color: "text-[#3F6B53]" };
  return { label: "Later", color: "text-[#7E9088]" };
}

const RULE_PROFILE_LABEL: Record<DestinationRuleProfile, string> = {
  eu: "EU",
  uk: "United Kingdom",
  usa: "USA",
  canada: "Canada",
  australia_nz: "Australia / NZ",
  rabies_free: "Rabies-free destination",
  generic: "Destination authority",
};

// ---- Component ------------------------------------------------------------

export function PetRelocationSection() {
  const [report, setReport] = useState<PetRelocationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/pet-relocation");
        if (!res.ok) {
          if (res.status === 404) {
            setReport(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as PetRelocationReport;
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
        data-testid="pet-relocation-section"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your pet-relocation plan…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="gm-surface p-5" data-testid="pet-relocation-section">
        <span className="gm-eyebrow mb-2">Pet relocation</span>
        <p className="text-[12.5px] text-[#7E9088] mt-2 leading-relaxed">
          {error
            ? `Couldn't load pet-relocation plan: ${error}`
            : "Set destination + add a pet in your profile to get pet-relocation guidance."}
        </p>
      </div>
    );
  }

  // Empty state — user has no pets on file. Render a small invite, not the full layer.
  if (!report.hasPets) {
    return (
      <section className="space-y-3" data-testid="pet-relocation-section" data-pet-state="empty">
        <div>
          <span className="gm-eyebrow">Pet relocation</span>
          <h2 className="text-[16px] font-semibold text-[#1F2A24] mt-1.5" data-testid="pet-relocation-heading">
            Moving with a pet?
          </h2>
          <p className="text-[12px] text-[#7E9088] mt-0.5 leading-relaxed">
            Add one to your profile and we'll surface microchip, vaccination, import-rule and transport guidance.
          </p>
        </div>
        <div className="gm-surface px-3.5 py-3 flex items-center gap-2.5">
          <PawPrint className="w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
          <p className="text-[12.5px] text-[#4E5F57]">
            No pets on file. {report.nextStep}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8" data-testid="pet-relocation-section" data-pet-state="active">
      <div>
        <span className="gm-eyebrow">Pet relocation</span>
        <h2 className="text-[16px] font-semibold text-[#1F2A24] mt-1.5" data-testid="pet-relocation-heading">
          Moving your pet
        </h2>
        <p className="text-[12px] text-[#7E9088] mt-0.5 leading-relaxed">
          Microchip → vaccinations → import rules → transport → timeline. Decision support, not a marketplace.
        </p>
      </div>

      {/* Headline — open by default */}
      <PetSummaryCard pet={report.pet!} nextStep={report.nextStep} />

      <CollapseSection title="Microchip + vaccinations" count={2}>
        <MicrochipRow guidance={report.microchipGuidance} />
        <VaccinationRow guidance={report.vaccinationGuidance} />
      </CollapseSection>

      <CollapseSection
        title="Import / entry rules"
        description={`${RULE_PROFILE_LABEL[report.importRuleGuidance.destinationProfile]} · ≥${report.importRuleGuidance.minimumLeadTimeWeeks}w lead time`}
      >
        <ImportRuleRow guidance={report.importRuleGuidance} />
      </CollapseSection>

      <CollapseSection title="Transport / airline">
        <TransportRow guidance={report.transportGuidance} />
      </CollapseSection>

      <CollapseSection
        title="Timeline + ordering"
        description="What runs in which order. Behind markers flag phases past their typical start."
        count={report.timeline.length}
      >
        {report.timeline.map((p) => (
          <TimelineRow key={p.id} phase={p} />
        ))}
      </CollapseSection>

      <p className="text-[11.5px] text-[#7E9088] italic leading-relaxed">
        Pet-relocation guidance is decision orientation only — destination rules and airline policies
        change frequently. Always verify with the destination's official agriculture authority and your
        airline before booking flights or vet appointments.
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

// ---- Headline ------------------------------------------------------------

function PetSummaryCard({ pet, nextStep }: { pet: PetSummary; nextStep: string }) {
  return (
    <article
      className="gm-surface px-3.5 py-3"
      data-testid="pet-summary-card"
    >
      <header className="flex items-baseline gap-2 flex-wrap mb-2">
        <PawPrint className="w-3.5 h-3.5 text-[#7E9088] shrink-0 self-center" strokeWidth={1.7} />
        <h3 className="text-[13.5px] font-semibold text-[#1F2A24]">Your pet</h3>
        {pet.isSnubNosedBreed && (
          <span className="text-[11px] font-medium text-[#B5414C]">· Snub-nosed breed</span>
        )}
      </header>
      <div className="flex flex-wrap gap-1.5 pl-5 mb-2">
        {[pet.species, pet.breed, pet.size_weight, pet.age]
          .filter((s): s is string => Boolean(s))
          .map((s) => (
            <span
              key={s}
              className="text-[11px] tabular-nums text-[#4E5F57] gm-surface-sub px-2 py-0.5"
            >
              {s}
            </span>
          ))}
      </div>
      <p className="text-[11.5px] text-[#7E9088] leading-relaxed pl-5">
        <span className="font-semibold text-[#1F2A24]">Next step: </span>
        {nextStep}
      </p>
    </article>
  );
}

// ---- Rows ----------------------------------------------------------------

function CollapseRow({
  icon: Icon,
  title,
  status,
  stripe,
  statusColor,
  children,
  testid,
  dataAttrs,
}: {
  icon: LucideIcon;
  title: string;
  status?: string;
  stripe?: string;
  statusColor?: string;
  children: React.ReactNode;
  testid?: string;
  dataAttrs?: Record<string, string>;
}) {
  return (
    <details
      className="group gm-surface"
      style={stripe ? { borderLeft: `3px solid ${stripe}` } : undefined}
      data-testid={testid}
      {...dataAttrs}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
          <h4 className="text-[13px] font-semibold text-[#1F2A24] flex-1 min-w-0 truncate">
            {title}
          </h4>
          {status && (
            <span className={cn("text-[11px] font-medium shrink-0", statusColor ?? "text-[#7E9088]")}>
              {status}
            </span>
          )}
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
        {children}
      </div>
    </details>
  );
}

function MicrochipRow({ guidance }: { guidance: MicrochipGuidance }) {
  const t = urgencyText(guidance.urgency);
  return (
    <CollapseRow
      icon={Cpu}
      title="Microchip"
      status={t.label}
      statusColor={t.color}
      stripe={urgencyStripe(guidance.urgency)}
      testid="pet-microchip-card"
      dataAttrs={{
        "data-microchip-status": guidance.status,
        "data-microchip-urgency": guidance.urgency,
      }}
    >
      <p className="text-[12px] text-[#4E5F57] leading-relaxed">{guidance.message}</p>
      <p className="text-[11.5px] text-[#7E9088] leading-relaxed">
        <span className="font-semibold text-[#1F2A24]">Do this: </span>
        {guidance.recommendedAction}
      </p>
      <p
        className="text-[11.5px] leading-relaxed text-[#B5414C] flex items-baseline gap-1.5"
        data-testid="pet-microchip-ordering-rule"
      >
        <AlertOctagon className="w-3 h-3 shrink-0 translate-y-0.5" strokeWidth={1.8} />
        <span>
          <span className="font-semibold">Order matters: </span>
          {guidance.orderingRule}
        </span>
      </p>
    </CollapseRow>
  );
}

function VaccinationRow({ guidance }: { guidance: VaccinationGuidance }) {
  const t = urgencyText(guidance.urgency);
  return (
    <CollapseRow
      icon={Syringe}
      title="Vaccinations + health prep"
      status={t.label}
      statusColor={t.color}
      stripe={urgencyStripe(guidance.urgency)}
      testid="pet-vaccination-card"
      dataAttrs={{
        "data-vaccination-status": guidance.status,
        "data-vaccination-urgency": guidance.urgency,
      }}
    >
      <p className="text-[12px] text-[#4E5F57] leading-relaxed">{guidance.message}</p>
      <p className="text-[11.5px] text-[#7E9088] leading-relaxed">
        <span className="font-semibold text-[#1F2A24]">Do this: </span>
        {guidance.recommendedAction}
      </p>
      <p className="text-[11.5px] text-[#4E5F57] leading-relaxed">
        <span className="font-semibold">Wait window: </span>
        {guidance.postVaccineWaitDays} days minimum after primary rabies before travel.
      </p>
      {guidance.commonGap && (
        <p className="text-[11.5px] text-[#8C6B2F] leading-relaxed flex items-baseline gap-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0 translate-y-0.5" strokeWidth={1.8} />
          <span>
            <span className="font-semibold">Common gap: </span>
            {guidance.commonGap}
          </span>
        </p>
      )}
    </CollapseRow>
  );
}

function ImportRuleRow({ guidance }: { guidance: ImportRuleGuidance }) {
  return (
    <CollapseRow
      icon={Globe}
      title={guidance.destinationLabel}
      status={`≥${guidance.minimumLeadTimeWeeks}w lead`}
      statusColor="text-[#3F6B6F]"
      testid="pet-import-card"
      dataAttrs={{ "data-rule-profile": guidance.destinationProfile }}
    >
      <ul className="space-y-1" data-testid="pet-import-checks">
        {guidance.keyChecks.map((c, i) => (
          <li
            key={i}
            className="text-[12px] text-[#4E5F57] flex items-start gap-2 leading-relaxed"
          >
            <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-[#5D9CA5]" />
            <span>{c}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] text-[#B5414C] leading-relaxed pt-1 flex items-baseline gap-1.5">
        <AlertOctagon className="w-3 h-3 shrink-0 translate-y-0.5" strokeWidth={1.8} />
        <span>
          <span className="font-semibold">Biggest watch-out: </span>
          {guidance.biggestWatchOut}
        </span>
      </p>
      <p className="text-[11px] text-[#7E9088] italic leading-relaxed">
        Verify with: {guidance.authoritativeSource}
      </p>
    </CollapseRow>
  );
}

function TransportRow({ guidance }: { guidance: TransportGuidance }) {
  return (
    <CollapseRow
      icon={Plane}
      title={modeLabel(guidance.recommendedMode)}
      testid="pet-transport-card"
      dataAttrs={{ "data-transport-mode": guidance.recommendedMode }}
    >
      {guidance.modeReasoning.map((r, i) => (
        <p key={i} className="text-[12px] text-[#4E5F57] leading-relaxed">
          {r}
        </p>
      ))}
      {guidance.breedWarning && (
        <p
          className="text-[11.5px] text-[#B5414C] leading-relaxed flex items-baseline gap-1.5"
          data-testid="pet-transport-breed-warning"
        >
          <AlertOctagon className="w-3 h-3 shrink-0 translate-y-0.5" strokeWidth={1.8} />
          <span>
            <span className="font-semibold">Breed warning: </span>
            {guidance.breedWarning}
          </span>
        </p>
      )}
      <ul className="space-y-1" data-testid="pet-transport-constraints">
        {guidance.airlineConstraints.map((c, i) => (
          <li key={i} className="text-[11.5px] text-[#4E5F57] flex items-start gap-2 leading-relaxed">
            <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-[#5D9CA5]" />
            <span>{c}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] text-[#7E9088] leading-relaxed flex items-baseline gap-1.5">
        <Shield className="w-3 h-3 shrink-0 translate-y-0.5" strokeWidth={1.7} />
        <span>
          <span className="font-semibold text-[#1F2A24]">Crate prep: </span>
          {guidance.cratePrep}
        </span>
      </p>
      <p className="text-[11.5px] text-[#8C6B2F] leading-relaxed flex items-baseline gap-1.5">
        <AlertTriangle className="w-3 h-3 shrink-0 translate-y-0.5" strokeWidth={1.8} />
        <span>
          <span className="font-semibold">Season: </span>
          {guidance.seasonalConsideration}
        </span>
      </p>
    </CollapseRow>
  );
}

function TimelineRow({ phase }: { phase: TimelinePhase }) {
  const stripe = phase.passed ? "#7BB091" : phase.behind ? "#B5414C" : undefined;
  const status = phase.passed ? "Passed" : phase.behind ? "Behind" : undefined;
  const statusColor = phase.passed ? "text-[#3F6B53]" : phase.behind ? "text-[#B5414C]" : undefined;
  return (
    <details
      className="group gm-surface"
      style={stripe ? { borderLeft: `3px solid ${stripe}` } : undefined}
      data-testid={`pet-timeline-${phase.id}`}
      data-phase-passed={phase.passed ? "true" : "false"}
      data-phase-behind={phase.behind ? "true" : "false"}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 hover:bg-[#FCFDFB] transition-colors rounded-md">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
          <span className="font-mono text-[10.5px] tabular-nums text-[#7E9088] shrink-0">
            {phase.label}
          </span>
          <h4 className="text-[13px] font-semibold text-[#1F2A24] flex-1 min-w-0 truncate">
            {phase.whatHappens}
          </h4>
          {status && (
            <span className={cn("text-[11px] font-medium shrink-0", statusColor)}>{status}</span>
          )}
          <ChevronDown
            className="w-3.5 h-3.5 text-[#7E9088] shrink-0 transition-transform group-open:rotate-180"
            strokeWidth={1.7}
          />
        </div>
      </summary>
      <div
        className="px-3.5 pb-3 pl-10 space-y-1.5"
        style={{ borderTop: "1px solid #ECF1EC", paddingTop: "8px" }}
      >
        {phase.todos.length > 0 && (
          <ul className="space-y-0.5">
            {phase.todos.map((t, i) => (
              <li
                key={i}
                className="text-[11.5px] text-[#4E5F57] flex items-start gap-2 leading-relaxed"
              >
                <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-[#7E9088]" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        )}
        {phase.watchOut && (
          <p className="text-[11.5px] text-[#8C6B2F] leading-relaxed flex items-baseline gap-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0 translate-y-0.5" strokeWidth={1.8} />
            <span>{phase.watchOut}</span>
          </p>
        )}
      </div>
    </details>
  );
}

function modeLabel(m: TransportMode): string {
  switch (m) {
    case "cabin":
      return "Cabin (in-cabin pet)";
    case "cargo":
      return "Cargo (manifest)";
    case "ground":
      return "Ground transport";
    default:
      return "Mode unconfirmed";
  }
}

void CheckCircle2;
