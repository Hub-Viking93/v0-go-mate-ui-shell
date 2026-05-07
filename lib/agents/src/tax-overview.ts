// =============================================================
// @workspace/agents — Phase 6C tax-overview layer
// =============================================================
// Year-1 tax orientation. Helps the user understand what the first
// fiscal year typically looks like after a move — WITHOUT pretending
// to be a tax engine, calculator, or filing product.
//
// Five blocks:
//   1. yearOneSummary    — 2-3 sentences framing the first fiscal year.
//   2. checkpoints[]     — likely obligations / things to track.
//   3. watchouts[]       — common pitfalls, gated by profile signals.
//   4. nextStep          — single best next action given current state.
//   5. disclaimer        — explicit orientation-not-advice framing.
//
// Phase 6C explicit non-goals:
//   • No rate, threshold, or amount guesses (zero numeric tax claims).
//   • No filing-engine, no return generator, no calculator.
//   • No accountant-grade legal certainty.
//   • No deep departure-tax analysis (5B already cross-references that).
//   • No family / dependents / spouse tax logic (Phase 6B territory).
//   • No marketing for tax-prep providers.
// =============================================================

// ---- Public types ---------------------------------------------------------

export type TaxRegimeProfile =
  /** Most EU member states + similar — residency-test based, year-end declaration default. */
  | "eu_residency_based"
  /** UK — Statutory Residence Test, split-year treatment. */
  | "uk_srt"
  /** US — citizenship-based taxation, continues regardless of where the
   *  user lives. Surfaces only when user is US citizen. */
  | "us_citizenship_based"
  /** Canada — residency-based, but uses ties-test. */
  | "canada_residency_based"
  /** Australia / New Zealand. */
  | "aunz_residency_based"
  /** Anything else — generic orientation only. */
  | "generic";

export type CheckpointTiming =
  | "before_move"
  | "first_30d"
  | "first_90d"
  | "first_year_end"
  | "ongoing";

export type CheckpointKind =
  | "registration"
  | "withholding"
  | "residency_clock"
  | "dual_residency"
  | "year_end_filing"
  | "social_security"
  | "departure_origin";

export interface TaxCheckpoint {
  id: string;
  kind: CheckpointKind;
  timing: CheckpointTiming;
  title: string;
  description: string;
  /** Why now — pinpoints the user benefit. */
  whyItMatters: string;
}

export type WatchoutSeverity = "info" | "warning" | "high";

export type WatchoutKind =
  | "tax_residence_trap"
  | "double_taxation_risk"
  | "departure_tax"
  | "us_citizenship_based_taxation"
  | "social_security_continuity"
  | "split_year_handling"
  | "foreign_income_reporting"
  | "year_end_calendar";

export interface TaxWatchout {
  id: string;
  kind: WatchoutKind;
  severity: WatchoutSeverity;
  title: string;
  description: string;
  /** What the user should actually do about it. */
  whatToDo: string;
}

export type TaxNextStepKind =
  | "due_diligence"
  | "talk_to_accountant"
  | "register_destination"
  | "track_residency_days"
  | "file_year_one_return"
  | "monitor";

export interface TaxNextStep {
  kind: TaxNextStepKind;
  title: string;
  body: string;
  /** Optional SPA route for deep-link, when applicable (e.g. checklist). */
  targetRoute: string | null;
}

export interface TaxOverviewReport {
  generatedAt: string;
  destination: string | null;
  origin: string | null;
  regimeProfile: TaxRegimeProfile;
  regimeLabel: string;
  yearOneSummary: string;
  checkpoints: TaxCheckpoint[];
  watchouts: TaxWatchout[];
  nextStep: TaxNextStep;
  /** Always present — the layer is orientation, not advice. */
  disclaimer: string;
}

// ---- Inputs ---------------------------------------------------------------

export interface TaxProfileInputs {
  destination?: string | null;
  current_location?: string | null;
  citizenship?: string | null;
  purpose?: string | null;
  posting_or_secondment?: string | null;
  departure_tax_filing_required?: string | null;
}

export interface TaxOverviewInputs {
  profile: TaxProfileInputs;
  arrivalDate: string | null;
  stage: string | null;
  /** Override clock for tests. */
  now?: Date;
}

// ---- Helpers --------------------------------------------------------------

function lower(v: string | null | undefined): string {
  return (v ?? "").toString().trim().toLowerCase();
}

function daysBetween(aIso: string | null | undefined, b: Date): number | null {
  if (!aIso) return null;
  const ms = Date.parse(aIso);
  if (!Number.isFinite(ms)) return null;
  return Math.round((ms - b.getTime()) / (24 * 60 * 60 * 1000));
}

function isUSCitizen(citizenship: string | null | undefined): boolean {
  const v = lower(citizenship);
  if (!v) return false;
  return (
    v === "us" ||
    v === "usa" ||
    v.includes("united states") ||
    v.includes("american")
  );
}

// ---- Regime detection -----------------------------------------------------

interface RegimeEntry {
  profile: TaxRegimeProfile;
  label: string;
  countries: string[];
}

const REGIMES: RegimeEntry[] = [
  {
    profile: "eu_residency_based",
    label: "EU residency-based regime",
    countries: [
      "sweden", "germany", "france", "spain", "italy", "netherlands", "belgium",
      "austria", "denmark", "finland", "ireland", "portugal", "greece", "poland",
      "czech", "czechia", "slovakia", "hungary", "luxembourg", "estonia",
      "latvia", "lithuania", "slovenia", "croatia", "bulgaria", "romania",
      "malta", "cyprus", "iceland", "norway",
    ],
  },
  {
    profile: "uk_srt",
    label: "UK Statutory Residence Test",
    countries: ["united kingdom", "uk", "great britain", "england", "scotland", "wales", "northern ireland"],
  },
  {
    profile: "canada_residency_based",
    label: "Canada residency / ties test",
    countries: ["canada"],
  },
  {
    profile: "aunz_residency_based",
    label: "Australia / NZ residency regime",
    countries: ["australia", "new zealand", "nz"],
  },
];

function detectRegime(destination: string | null | undefined): RegimeEntry {
  const norm = lower(destination);
  if (norm) {
    for (const r of REGIMES) {
      // Same logic as 5C lookup: short codes need exact match to avoid
      // catching substrings like "us" inside "australia".
      if (
        r.countries.some((c) => {
          if (c.length < 4) return norm === c;
          return norm === c || norm.includes(c);
        })
      ) {
        return r;
      }
    }
  }
  return { profile: "generic", label: "Destination-authority year-1 framing", countries: [] };
}

// ---- Year-1 summary -------------------------------------------------------

function buildYearOneSummary(
  inputs: TaxOverviewInputs,
  regime: RegimeEntry,
  citizenshipUS: boolean,
): string {
  const dest = inputs.profile.destination ?? "your destination";
  const origin = inputs.profile.current_location ?? "your origin";
  const purpose = lower(inputs.profile.purpose);

  const baseLines: string[] = [];
  baseLines.push(
    `Your first fiscal year in ${capitalize(dest)} usually looks different from a normal year — part of it falls under ${capitalize(origin)}'s rules and part under ${capitalize(dest)}'s, and the line between them depends on when you become a tax resident.`,
  );

  switch (regime.profile) {
    case "eu_residency_based":
      baseLines.push(
        `Most EU residency regimes use a 183-day-style test plus a habitual-residence factor — once you cross the threshold, ${capitalize(dest)} can tax your worldwide income from that day forward.`,
      );
      break;
    case "uk_srt":
      baseLines.push(
        `The UK uses the Statutory Residence Test (SRT) and a separate split-year treatment — both are gates the first year, and they can produce surprising outcomes if you don't track your day count from arrival.`,
      );
      break;
    case "canada_residency_based":
      baseLines.push(
        `Canadian residency is based on a ties-test rather than a hard day count — even a partial-year stay can make you a tax resident if your significant ties (home, family) are in Canada.`,
      );
      break;
    case "aunz_residency_based":
      baseLines.push(
        `Australian / NZ tax residency starts as soon as you make the destination your "ordinary" residence — there's a multi-factor test, not a simple day count, and the first-year status is often where people slip up.`,
      );
      break;
    case "us_citizenship_based":
      // Only used when a US destination is detected — not yet wired.
      baseLines.push(
        `The US is unusual: it taxes citizens and green-card holders on their worldwide income regardless of where they live. Your first US year may overlap with another country's tax year.`,
      );
      break;
    default:
      baseLines.push(
        `We don't have a destination-specific framing on file for ${capitalize(dest)} — verify the local residency rules with the destination's revenue authority before assuming anything.`,
      );
  }

  if (citizenshipUS && regime.profile !== "us_citizenship_based") {
    baseLines.push(
      `As a US citizen you remain in the US tax system regardless of where you live — that's a parallel obligation on top of ${capitalize(dest)}'s.`,
    );
  }

  if (purpose === "digital_nomad" || purpose === "digital nomad") {
    baseLines.push(
      `Digital-nomad setups are often the trickiest first year — staying long enough in one place can flip you into local tax residency before you realise.`,
    );
  }

  return baseLines.join(" ");
}

// ---- Checkpoints ----------------------------------------------------------

function buildCheckpoints(inputs: TaxOverviewInputs, regime: RegimeEntry): TaxCheckpoint[] {
  const purpose = lower(inputs.profile.purpose);
  const isPosting = lower(inputs.profile.posting_or_secondment) === "yes";
  const out: TaxCheckpoint[] = [];

  // Registration with destination tax authority — universal.
  out.push({
    id: "ck:tax-registration",
    kind: "registration",
    timing: "first_30d",
    title: "Register with the destination tax authority",
    description:
      "Most destinations issue a tax / fiscal ID separately from civil registration. Get it on file early — payroll, banks, and benefits all reference it.",
    whyItMatters:
      "Without a tax ID your first salary will likely be withheld at the highest emergency rate, and refunds take a year to settle.",
  });

  // Residency-day clock — universal but framed by regime.
  out.push({
    id: "ck:residency-clock",
    kind: "residency_clock",
    timing: "ongoing",
    title:
      regime.profile === "uk_srt"
        ? "Track your day count for the SRT"
        : regime.profile === "canada_residency_based"
        ? "Track your residency ties (home, family, bank accounts)"
        : regime.profile === "aunz_residency_based"
        ? "Track your residency factors and physical presence"
        : "Track residency days from arrival",
    description:
      "Keep a simple log of arrivals + departures. Boarding passes + accommodation receipts are the standard backup if a tax authority asks later.",
    whyItMatters:
      "Year-end residency status is decided by a count + a ties-test in most regimes — don't reconstruct it under deadline pressure.",
  });

  // Withholding / payroll registration — only when there's an employer.
  if (purpose === "work" || purpose === "settle" || isPosting) {
    out.push({
      id: "ck:employer-withholding",
      kind: "withholding",
      timing: "first_30d",
      title: "Confirm your employer's payroll setup",
      description:
        "Your employer needs your destination tax ID + bank to apply the right withholding rate. Confirm in writing what rate they're applying.",
      whyItMatters:
        "Wrong withholding rate is the most common first-year mistake — easy to fix early, painful at year-end.",
    });
  }

  // Posted-worker / A1 / CoC continuity — only when posting.
  if (isPosting) {
    out.push({
      id: "ck:social-security-continuity",
      kind: "social_security",
      timing: "before_move",
      title: "Confirm social-security continuity (A1 / CoC / PWD)",
      description:
        "Postings often keep social-security in the origin country via an A1 (EU) or Certificate of Coverage (US treaty). Your employer arranges this; you confirm it's on file before you move.",
      whyItMatters:
        "Without it you may end up paying social-security in both countries at once — and reclaiming overpayments takes a year minimum.",
    });
  }

  // Year-end declaration window — universal.
  out.push({
    id: "ck:year-one-declaration",
    kind: "year_end_filing",
    timing: "first_year_end",
    title: "Mark the first year-end declaration window",
    description:
      "Most destinations expect a declaration in the spring after your first calendar year. The window is short — set the calendar reminder when you arrive, not when the form lands.",
    whyItMatters:
      "Late filing can void a tax-treaty position you'd otherwise be entitled to, and trigger penalties that compound while a refund waits.",
  });

  // Dual-residency check — surfaces when both origin + destination are set.
  if (inputs.profile.current_location && inputs.profile.destination) {
    out.push({
      id: "ck:dual-residency-check",
      kind: "dual_residency",
      timing: "first_90d",
      title: "Check the origin↔destination tax treaty (if any)",
      description:
        "Most pairs have a double-taxation treaty with a residency tie-breaker (permanent home → centre-of-vital-interests → habitual abode → citizenship). It can save real money — but you have to claim the position.",
      whyItMatters:
        "Year-1 is when treaty residency is determined. Don't assume it auto-applies — many filers default to taxing the same income twice.",
    });
  }

  // Departure tax — only if origin has one flagged.
  if (lower(inputs.profile.departure_tax_filing_required) !== "no") {
    out.push({
      id: "ck:departure-origin",
      kind: "departure_origin",
      timing: "before_move",
      title: "Close out origin-country tax residency",
      description:
        "Your origin's revenue authority needs a final / partial-year return. Some origins (Sweden, Norway, US, Eritrea) keep tax obligations alive after physical departure.",
      whyItMatters:
        "Skipping this is one of the few first-year mistakes that compounds across decades — clean exits make later refunds + treaty positions easier.",
    });
  }

  return out;
}

// ---- Watchouts ------------------------------------------------------------

function buildWatchouts(
  inputs: TaxOverviewInputs,
  regime: RegimeEntry,
  citizenshipUS: boolean,
): TaxWatchout[] {
  const purpose = lower(inputs.profile.purpose);
  const isPosting = lower(inputs.profile.posting_or_secondment) === "yes";
  const out: TaxWatchout[] = [];

  // Tax-residence trap — always relevant; gets escalated to 'high' for nomads.
  out.push({
    id: "wo:tax-residence-trap",
    kind: "tax_residence_trap",
    severity: purpose === "digital_nomad" ? "high" : "warning",
    title: "Don't accidentally double up on tax residency",
    description:
      "Your origin doesn't always release you the day you fly. Until you've crossed the destination's residency threshold AND closed out the origin's, you can be tax-resident in two places at once.",
    whatToDo:
      "Track days; understand the destination's residency test BEFORE arrival; close the origin's tax residency on time.",
  });

  // US citizenship-based taxation — surfaces only when relevant.
  if (citizenshipUS) {
    out.push({
      id: "wo:us-citizenship-based-taxation",
      kind: "us_citizenship_based_taxation",
      severity: "high",
      title: "US citizenship-based taxation (FBAR + FATCA + 1040)",
      description:
        "As a US citizen you keep filing US returns regardless of where you live. Foreign accounts above thresholds also trigger FBAR and FATCA reporting.",
      whatToDo:
        "Map both calendars early. A cross-border accountant who knows both sides is usually worth it the first year.",
    });
  }

  // Departure-tax double-up.
  if (lower(inputs.profile.departure_tax_filing_required) !== "no") {
    out.push({
      id: "wo:departure-tax",
      kind: "departure_tax",
      severity: "warning",
      title: "Origin departure-tax obligations don't end on departure",
      description:
        "Some origins keep you in the tax system for unrealised gains (exit tax) or pension transfers — even if the destination would also tax them later.",
      whatToDo:
        "Flag any unrealised assets, pensions, or stock-option positions to a cross-border accountant before the move date locks.",
    });
  }

  // Posted-worker A1/CoC double-payment risk.
  if (isPosting) {
    out.push({
      id: "wo:social-security-continuity",
      kind: "social_security_continuity",
      severity: "warning",
      title: "Without A1 / CoC, you may pay social-security twice",
      description:
        "Postings without the right paperwork can land social-security charges in both origin and destination — destination often charges by default unless you prove continuity.",
      whatToDo:
        "Confirm the A1 (EU) or Certificate of Coverage (US treaty) is in hand before the first payroll cycle.",
    });
  }

  // Split-year / first-year quirks — UK-specific framing, but the same
  // principle applies in most residency regimes.
  out.push({
    id: "wo:split-year-handling",
    kind: "split_year_handling",
    severity: "info",
    title: "Split-year / partial-year treatment is the rule, not the exception",
    description:
      "First-year filings often need to split income between origin and destination periods. Tax software designed for residents may not support it cleanly.",
    whatToDo:
      "If your country offers free tax software, double-check it handles partial-year. If not, keep a simple income log so an accountant can split it cleanly.",
  });

  // Year-end calendar (regime-coloured).
  out.push({
    id: "wo:year-end-calendar",
    kind: "year_end_calendar",
    severity: "info",
    title: "First year-end declaration windows are short",
    description: regimeShortWindowCopy(regime.profile),
    whatToDo:
      "Set a calendar reminder for the destination's filing window the day you arrive. Don't rely on the authority sending you a paper notice.",
  });

  // Foreign-income reporting for non-US residency-based regimes.
  out.push({
    id: "wo:foreign-income-reporting",
    kind: "foreign_income_reporting",
    severity: "info",
    title: "Income earned abroad may still need to be reported",
    description:
      "Most residency regimes ask for worldwide income on the year-end declaration. That includes interest from origin bank accounts, rental income, and investment gains.",
    whatToDo:
      "List every income source open in the origin and decide whether to keep, close, or report each one.",
  });

  return out;
}

function regimeShortWindowCopy(p: TaxRegimeProfile): string {
  switch (p) {
    case "eu_residency_based":
      return "Most EU year-end declarations open in spring (Mar-Jun) and close fast — paper notices arrive late, online portals open earlier.";
    case "uk_srt":
      return "UK Self Assessment runs to 31 January for online filing. SRT calculations are part of the same return.";
    case "canada_residency_based":
      return "Canadian T1 is due 30 April. Self-employed have 15 June, but interest still accrues from 30 April.";
    case "aunz_residency_based":
      return "Australian individual returns are due 31 October without a tax agent; NZ runs to 7 July.";
    default:
      return "Year-end declaration windows vary — confirm the destination's exact deadline before relying on local rumour.";
  }
}

// ---- Next step ------------------------------------------------------------

function buildNextStep(inputs: TaxOverviewInputs): TaxNextStep {
  const stage = lower(inputs.stage);
  const purpose = lower(inputs.profile.purpose);
  const days = daysBetween(inputs.arrivalDate, inputs.now ?? new Date());

  if (stage === "exploring" || !stage) {
    return {
      kind: "due_diligence",
      title: "Confirm tax-residency rules in your destination as part of due-diligence",
      body: "Before you commit, read the destination's residency-test summary on its official tax-authority site. It's the single fastest way to avoid year-1 surprises.",
      targetRoute: null,
    };
  }

  if (stage === "ready_for_pre_departure" || stage === "pre_departure") {
    if (days !== null && days <= 30) {
      return {
        kind: "talk_to_accountant",
        title: "Book a 30-min cross-border tax call before you fly",
        body:
          "A short call with someone who knows both origin and destination can save real money — especially with stock options, pensions, or sold property.",
        targetRoute: null,
      };
    }
    return {
      kind: "talk_to_accountant",
      title: "Talk to a cross-border accountant now",
      body:
        "Year-1 setup decisions (timing, residency claim, A1) are best made before the move date locks. A consult now is cheaper than a fix later.",
      targetRoute: null,
    };
  }

  if (stage === "arrived") {
    return {
      kind: "register_destination",
      title: "Register with the destination's tax authority within the first weeks",
      body:
        "Without a tax ID your first salary will be withheld at the emergency rate. Bring passport, residence permit (if relevant), and address proof.",
      targetRoute: "/checklist?tab=post-move",
    };
  }

  if (stage === "settling_in" || stage === "complete") {
    return {
      kind: "track_residency_days",
      title: "Track residency days; mark the first year-end deadline now",
      body:
        "A simple spreadsheet of arrival/departure dates is enough. Set the calendar reminder for the year-end window — they're shorter than people remember.",
      targetRoute: "/checklist?tab=post-move",
    };
  }

  if (purpose === "digital_nomad") {
    return {
      kind: "monitor",
      title: "Monitor where you're physically present each month",
      body:
        "For nomadic setups, the most important year-1 risk is sliding into a tax residency you didn't intend. A simple log per location is the standard mitigation.",
      targetRoute: null,
    };
  }

  return {
    kind: "due_diligence",
    title: "Confirm tax-residency rules before commitments lock",
    body:
      "The destination's tax-authority site is the cleanest first stop. After that, a 30-min call with a cross-border accountant is the highest-leverage step.",
    targetRoute: null,
  };
}

// ---- Disclaimer -----------------------------------------------------------

const DISCLAIMER =
  "This is orientation, not tax advice. Tax rules change, treaty claims have caveats, and your individual situation matters. Confirm anything that affects money or filings with a qualified cross-border tax professional.";

// ---- Composer -------------------------------------------------------------

function capitalize(s: string): string {
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function deriveTaxOverview(inputs: TaxOverviewInputs): TaxOverviewReport {
  const regime = detectRegime(inputs.profile.destination ?? null);
  const citizenshipUS = isUSCitizen(inputs.profile.citizenship ?? null);

  return {
    generatedAt: new Date().toISOString(),
    destination: inputs.profile.destination ?? null,
    origin: inputs.profile.current_location ?? null,
    regimeProfile: regime.profile,
    regimeLabel: regime.label,
    yearOneSummary: buildYearOneSummary(inputs, regime, citizenshipUS),
    checkpoints: buildCheckpoints(inputs, regime),
    watchouts: buildWatchouts(inputs, regime, citizenshipUS),
    nextStep: buildNextStep(inputs),
    disclaimer: DISCLAIMER,
  };
}
