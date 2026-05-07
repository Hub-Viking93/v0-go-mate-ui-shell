// =============================================================
// @workspace/agents — Phase 3C pathway plan + Plan B
// =============================================================
// Pure code, no LLM. Builds on Phase 3A (readiness) + 3B (risks)
// by adding the first real "if your current path doesn't hold,
// here's the next best move" layer.
//
// Phase 3C explicit non-goals:
//   • Not a generic visa marketplace. We don't enumerate every
//     pathway for every country.
//   • No open recommendations browser.
//   • No free AI reasoning. Everything is state-driven.
//   • No enterprise / global mobility flows.
//
// What this module IS:
//   • A purpose-anchored primary path (work / study / digital
//     nomad / settle).
//   • Realistic alternatives surfaced ONLY when state actually
//     supports them (e.g. you have education credentials, you're
//     an EU citizen with EU destination, etc.).
//   • Denied / delayed / stalled guidance triggered by application
//     status + lifecycle stage + arrival date.
// =============================================================

import type { DocumentCategory } from "./walkthrough.js";

// ---- Public types ---------------------------------------------------------

export type PurposeKey =
  | "work"
  | "study"
  | "digital_nomad"
  | "settle"
  | "free_movement"
  | "other";

/** A primary pathway that matches the user's declared purpose. */
export interface PrimaryPath {
  id: PurposeKey;
  label: string;
  /** Short one-line "why this is your current path" explanation. */
  rationale: string;
  /**
   * State-bound reasons the path is fragile right now. Empty when path
   * looks healthy. UI uses this to decide whether to surface alternatives.
   */
  weaknesses: string[];
  /** Convenience boolean: weaknesses.length > 0. */
  isWeak: boolean;
}

/** A realistic fallback / sibling pathway. */
export interface AlternativePath {
  id: string;
  label: string;
  /**
   * Why this alternative may fit, anchored in concrete state. Single
   * sentence. Never generic ("you may consider…").
   */
  whyMayFit: string;
  /**
   * Concrete changes if the user adopts this path. Each bullet is an
   * imperative verb.
   */
  whatChangesNow: string[];
  /**
   * "weak" — only loosely fits, mention as option
   * "moderate" — concrete signal supports it
   * "strong" — strongly suggested by the state
   */
  fitStrength: "weak" | "moderate" | "strong";
}

/** Active scenario-change advice when something has gone wrong. */
export interface ScenarioGuidance {
  scenario: "denied" | "delayed" | "stalled";
  /** Concrete state that triggered this guidance. */
  trigger: string;
  /** What this affects in the relocation plan. */
  affects: string[];
  /** Tasks / decisions that should pause now. */
  whatPausesNow: string[];
  /** What the user should actually do instead, in order. */
  whatToDoInstead: string[];
  /**
   * True when state suggests pivoting away from the primary path. False
   * when state suggests waiting / strengthening + re-applying.
   */
  shouldSwitchPath: boolean;
}

export interface PathwayPlan {
  generatedAt: string;
  primaryPath: PrimaryPath | null;
  alternatives: AlternativePath[];
  /** Null when no scenario is active. */
  guidance: ScenarioGuidance | null;
}

// ---- Inputs ---------------------------------------------------------------

export interface PathwayProfileInputs {
  destination?: string | null;
  citizenship?: string | null;
  purpose?: string | null;
  visa_role?: string | null;
  posting_or_secondment?: string | null;
  /** Free-form admission status: "received" | "applied" | "not_started" | etc. */
  admission_status?: string | null;
  /**
   * Free-form sponsorship flag — author may use either field; we
   * accept any non-empty truthy string as "sponsored".
   */
  employer_sponsorship?: string | null;
  has_employer_sponsor?: string | null;
  /** Same currency-string conventions as readiness. */
  savings_available?: number | string | null;
  monthly_budget?: number | string | null;
  monthly_income?: number | string | null;
  preferred_currency?: string | null;
  arrival_date?: string | null;
}

export interface PathwayVisaInputs {
  hasResearch: boolean;
  pathwaySelected: boolean;
  isFreeMovement: boolean;
  applicationStatus?: string | null;
}

export interface PathwayVaultInputs {
  coveredCategories: DocumentCategory[];
  totalDocs: number;
}

export interface PathwayInputs {
  profile: PathwayProfileInputs;
  visa: PathwayVisaInputs;
  vault: PathwayVaultInputs;
  /** Open task counters from settling-in + pre-departure. */
  openSettlingCount: number;
  overdueCount: number;
  /** "collecting" | "ready_for_pre_departure" | "pre_departure" | "arrived" | … */
  stage: string | null;
}

// ---- Helpers --------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

interface ParsedAmount {
  amount: number;
  currency: string | null;
}
function parseAmount(v: number | string | null | undefined): ParsedAmount | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? { amount: v, currency: null } : null;
  const raw = v.trim();
  if (!raw) return null;
  const isoMatch = raw.match(/\b([A-Z]{3})\b/);
  let currency: string | null = isoMatch ? isoMatch[1] : null;
  if (!currency) {
    if (raw.includes("€")) currency = "EUR";
    else if (raw.includes("£")) currency = "GBP";
    else if (raw.includes("$")) currency = "USD";
    else if (/\bkr\b/i.test(raw)) currency = "SEK";
  }
  const numericOnly = raw.replace(/[^\d.,-]/g, "");
  if (!numericOnly) return null;
  let normalised = numericOnly;
  if (normalised.includes(".") && normalised.includes(",")) {
    const lastDot = normalised.lastIndexOf(".");
    const lastComma = normalised.lastIndexOf(",");
    if (lastComma > lastDot) normalised = normalised.replace(/\./g, "").replace(",", ".");
    else normalised = normalised.replace(/,/g, "");
  } else if (normalised.includes(",") && !normalised.includes(".")) {
    if (/,\d{1,2}$/.test(normalised)) normalised = normalised.replace(",", ".");
    else normalised = normalised.replace(/,/g, "");
  }
  const n = Number(normalised);
  if (!Number.isFinite(n)) return null;
  return { amount: n, currency };
}
function isFlagTrue(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "yes" || s === "true" || s === "1" || s === "y" || s === "received" ||
      s === "obtained" || s === "sponsored" || s === "confirmed";
  }
  return false;
}

function daysUntil(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / DAY_MS);
}

function purposeFromProfile(p: PathwayProfileInputs): PurposeKey | null {
  const raw = (p.purpose ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("work") || raw === "employment") return "work";
  if (raw.includes("study") || raw === "education") return "study";
  if (raw.includes("nomad") || raw.includes("remote")) return "digital_nomad";
  if (raw.includes("settle") || raw.includes("family") || raw.includes("retire")) return "settle";
  return "other";
}

// ---- Primary derivers -----------------------------------------------------

function deriveWorkPrimary(inputs: PathwayInputs): PrimaryPath {
  const { profile, vault } = inputs;
  const hasEmployment = vault.coveredCategories.includes("employment");
  const sponsored =
    isFlagTrue(profile.employer_sponsorship) || isFlagTrue(profile.has_employer_sponsor);
  const weaknesses: string[] = [];
  if (!hasEmployment && !sponsored) {
    weaknesses.push("No signed employment contract or HR letter in your vault yet");
  }
  if (!profile.visa_role || profile.visa_role === "none") {
    weaknesses.push("Visa role not set — work pathway can't sequence dependent tasks without it");
  }
  return {
    id: "work",
    label: "Work permit",
    rationale: profile.destination
      ? `You set 'work' as the reason for moving to ${profile.destination}.`
      : "You set 'work' as your relocation reason.",
    weaknesses,
    isWeak: weaknesses.length > 0,
  };
}

function deriveStudyPrimary(inputs: PathwayInputs): PrimaryPath {
  const { profile, vault } = inputs;
  const hasEducation = vault.coveredCategories.includes("education");
  const admitted = isFlagTrue(profile.admission_status);
  const weaknesses: string[] = [];
  if (!admitted) {
    weaknesses.push("No university / program admission on file yet");
  }
  if (!hasEducation) {
    weaknesses.push("No diploma or transcripts uploaded — study permits typically require both");
  }
  return {
    id: "study",
    label: "Study permit",
    rationale: profile.destination
      ? `You set 'study' as your reason for moving to ${profile.destination}.`
      : "You set 'study' as your relocation reason.",
    weaknesses,
    isWeak: weaknesses.length > 0,
  };
}

function deriveDigitalNomadPrimary(inputs: PathwayInputs): PrimaryPath {
  const { profile } = inputs;
  const monthlyIncome = parseAmount(profile.monthly_income);
  const weaknesses: string[] = [];
  if (!monthlyIncome) {
    weaknesses.push("No monthly remote income on file — most digital-nomad visas have a numeric threshold");
  } else if (monthlyIncome.amount < 2500) {
    // Heuristic: most EU digital-nomad permits sit at €2,500-5,000/mo.
    weaknesses.push(
      `Monthly income (${monthlyIncome.amount} ${monthlyIncome.currency ?? ""}) is below the threshold most EU digital-nomad permits use (~€2,500-5,000)`,
    );
  }
  return {
    id: "digital_nomad",
    label: "Digital nomad permit",
    rationale: profile.destination
      ? `You set 'digital nomad' as the path for moving to ${profile.destination}.`
      : "You set 'digital nomad' as your relocation reason.",
    weaknesses,
    isWeak: weaknesses.length > 0,
  };
}

function deriveSettlePrimary(inputs: PathwayInputs): PrimaryPath {
  const { profile, vault } = inputs;
  const hasCivil = vault.coveredCategories.includes("civil");
  const weaknesses: string[] = [];
  if (!hasCivil) {
    weaknesses.push("No civil documents (birth / marriage certificates) uploaded yet");
  }
  if (!profile.visa_role || profile.visa_role === "primary") {
    // For settle / family-reunion we expect "dependent" or "spouse" usually.
    weaknesses.push(
      "Visa role suggests primary applicant; family-reunion / settle paths usually expect a dependent or spouse role",
    );
  }
  return {
    id: "settle",
    label: "Family / settle pathway",
    rationale: profile.destination
      ? `You set 'settle' as the reason for moving to ${profile.destination}.`
      : "You set 'settle' as your relocation reason.",
    weaknesses,
    isWeak: weaknesses.length > 0,
  };
}

// ---- Alternative derivers -------------------------------------------------

function deriveWorkAlternatives(inputs: PathwayInputs): AlternativePath[] {
  const out: AlternativePath[] = [];
  const { profile, vault } = inputs;
  // NOTE: free movement is handled at the composer level as the actual
  // primary pathway, not as an alternative. Don't surface it here.
  // Study fallback if education on file (non-blocking; we don't know admission status yet).
  if (vault.coveredCategories.includes("education")) {
    out.push({
      id: "study",
      label: "Study permit",
      whyMayFit:
        "You have education credentials on file. If a sponsored work offer doesn't materialise, a study program may unlock the same destination on a different track.",
      whatChangesNow: [
        "Apply to a recognised program in your destination country",
        "Plan finances for tuition + living, not just relocation",
        "Switch the document checklist to study-permit requirements",
      ],
      fitStrength: vault.coveredCategories.includes("financial") ? "moderate" : "weak",
    });
  }
  // Posting alternative: A1 / posted-worker setup if the user has been thinking work.
  if (profile.posting_or_secondment === "yes") {
    out.push({
      id: "posted-worker",
      label: "Posted-worker / secondment",
      whyMayFit:
        "Your profile says posting / secondment is yes — you may be eligible for an A1 + posted-worker declaration instead of a regular work permit.",
      whatChangesNow: [
        "Apply for A1 (or bilateral CoC) via your origin social-security agency",
        "File the destination Posted Worker Declaration before work starts",
        "Skip the residence-permit category that assumes a destination employer",
      ],
      fitStrength: "moderate",
    });
  }
  return out;
}

function deriveStudyAlternatives(inputs: PathwayInputs): AlternativePath[] {
  const out: AlternativePath[] = [];
  const { profile, vault } = inputs;
  // Free movement is handled at the composer level — not surfaced here.
  // Defer scenario — not a "path" but a structured time-shift recommendation.
  const arrivalIn = daysUntil(profile.arrival_date, new Date());
  if (arrivalIn != null && arrivalIn < 60) {
    out.push({
      id: "defer-to-next-term",
      label: "Defer to next intake",
      whyMayFit:
        "Less than 60 days to your planned arrival without confirmed admission — applying for the next term is usually safer than rushing this one.",
      whatChangesNow: [
        "Push your move date by one academic term",
        "Use the extra time to secure admission + apostille education records",
        "Pause pre-move tasks tied to the current arrival date",
      ],
      fitStrength: "moderate",
    });
  }
  // Work-route fallback if user has employment docs uploaded.
  if (vault.coveredCategories.includes("employment")) {
    out.push({
      id: "work",
      label: "Work permit",
      whyMayFit:
        "You have employment documents on file. If admission stalls, a sponsored work permit may be a faster route to the destination.",
      whatChangesNow: [
        "Confirm the employment offer is destination-based",
        "Switch the document checklist to work-permit requirements",
        "Keep the education docs — many work permits also weight credentials",
      ],
      fitStrength: "weak",
    });
  }
  return out;
}

function deriveDigitalNomadAlternatives(inputs: PathwayInputs): AlternativePath[] {
  const out: AlternativePath[] = [];
  const { profile, vault } = inputs;
  // Free movement is handled at the composer level — not surfaced here.
  const monthlyIncome = parseAmount(profile.monthly_income);
  if (monthlyIncome && monthlyIncome.amount < 2500) {
    out.push({
      id: "delay-build-income",
      label: "Delay the move and build income",
      whyMayFit:
        "Most EU digital-nomad permits require €2,500-5,000/month consistent remote income; current income is below that threshold.",
      whatChangesNow: [
        "Push the move date by 6-12 months",
        "Keep building documented client / employer history — three+ months of consistent income is what most permits require",
        "Save up the additional buffer the destination expects",
      ],
      fitStrength: "moderate",
    });
  }
  if (vault.coveredCategories.includes("employment")) {
    out.push({
      id: "work",
      label: "Sponsored work permit",
      whyMayFit:
        "If your remote employer can sponsor a destination work permit, the income threshold drops and you get a stronger residence basis.",
      whatChangesNow: [
        "Ask your employer if they have a destination entity or are willing to sponsor",
        "Switch the document checklist to work-permit requirements",
      ],
      fitStrength: "weak",
    });
  }
  return out;
}

function deriveSettleAlternatives(inputs: PathwayInputs): AlternativePath[] {
  const out: AlternativePath[] = [];
  const { vault } = inputs;
  // Free movement is handled at the composer level — not surfaced here.
  if (!vault.coveredCategories.includes("civil")) {
    out.push({
      id: "delay-apostille",
      label: "Delay until civil documents are apostilled",
      whyMayFit:
        "Family-reunion / settle paths require apostilled civil documents. Without them in your vault, a now-application will be rejected.",
      whatChangesNow: [
        "Apostille birth + marriage certificates first (lead time 2-6 weeks)",
        "Pause the residence-permit application until those are ready",
      ],
      fitStrength: "strong",
    });
  }
  return out;
}

// ---- Scenario triggers ----------------------------------------------------

function deriveScenarioGuidance(inputs: PathwayInputs): ScenarioGuidance | null {
  const { visa, profile, stage } = inputs;
  const arrivalIn = daysUntil(profile.arrival_date, new Date());
  const status = (visa.applicationStatus ?? "").toLowerCase();

  // 1) Denied — explicit application status.
  if (status === "rejected" || status === "denied") {
    return {
      scenario: "denied",
      trigger: "Most recent visa-application status is 'rejected'.",
      affects: [
        "Your planned arrival date",
        "Pre-move tasks tied to the rejected pathway",
        "Any housing / job commitments contingent on the permit",
      ],
      whatPausesNow: [
        "Don't book non-refundable flights or housing",
        "Don't terminate origin-country lease yet",
        "Pause the pre-move checklist until you have a re-file plan",
      ],
      whatToDoInstead: [
        "Read the rejection letter carefully — every authority must give a ground",
        "Address the specific ground (financial, intent, supporting docs) before re-filing",
        "Consider an alternative path if the ground is structural (e.g. ineligibility, not paperwork)",
      ],
      shouldSwitchPath: true,
    };
  }

  // 2) Delayed — submitted but no decision by the time arrival is close.
  if (
    (status === "submitted" || status === "decision_pending") &&
    arrivalIn != null &&
    arrivalIn <= 21 &&
    arrivalIn >= 0
  ) {
    return {
      scenario: "delayed",
      trigger: `Application is still pending and arrival is in ${arrivalIn} day${arrivalIn === 1 ? "" : "s"}.`,
      affects: [
        "Whether you can legally enter the destination on the planned date",
        "Onboarding tasks at destination (banking, registration, payroll)",
      ],
      whatPausesNow: [
        "Don't ship household goods until decision is in",
        "Don't sign a destination lease that starts before the planned arrival",
        "Hold off on terminating origin-country utilities",
      ],
      whatToDoInstead: [
        "Contact the issuing authority's status line for an ETA",
        "Have your employer ready to confirm employment one more time if asked",
        "Plan for a temporary rebooking of the move date — keep flights flexible",
      ],
      shouldSwitchPath: false,
    };
  }

  // 3) Stalled — pre-departure stage but arrival has clearly passed.
  if (stage === "pre_departure" && arrivalIn != null && arrivalIn <= -14) {
    return {
      scenario: "stalled",
      trigger: `Plan is in 'pre-departure' but the move date passed ${Math.abs(arrivalIn)} days ago.`,
      affects: [
        "All deadlines are stale (computed against the original move date)",
        "Settling-in tasks haven't been generated because stage hasn't flipped to 'arrived'",
      ],
      whatPausesNow: [
        "Pause pre-departure tasks — they're now timing-relative to a date that's gone",
      ],
      whatToDoInstead: [
        "If you've actually moved, mark arrival on the checklist so settling-in tasks generate",
        "If the move was postponed, update arrival_date in your profile so deadlines re-compute",
      ],
      shouldSwitchPath: false,
    };
  }

  return null;
}

// ---- Top-level composer ---------------------------------------------------

export function derivePathwayPlan(inputs: PathwayInputs): PathwayPlan {
  const guidance = deriveScenarioGuidance(inputs);

  // Free-movement short-circuit — when EU/EEA citizen + EU/EEA destination,
  // freedom of movement IS the legal main path, not an alternative. We do
  // not surface purpose-based alternatives here either: if the user is
  // EU + EU, telling them about a Work permit "alternative" would be
  // misleading.
  if (inputs.visa.isFreeMovement) {
    return {
      generatedAt: new Date().toISOString(),
      primaryPath: {
        id: "free_movement",
        label: "EU/EEA freedom of movement",
        rationale: inputs.profile.destination
          ? `Your citizenship + ${inputs.profile.destination} combination means you can move without a residence permit.`
          : "Your citizenship + destination combination means you can move without a residence permit.",
        weaknesses: [],
        isWeak: false,
      },
      alternatives: [],
      guidance,
    };
  }

  const purpose = purposeFromProfile(inputs.profile);
  let primary: PrimaryPath | null = null;
  let alternatives: AlternativePath[] = [];

  switch (purpose) {
    case "work":
      primary = deriveWorkPrimary(inputs);
      alternatives = deriveWorkAlternatives(inputs);
      break;
    case "study":
      primary = deriveStudyPrimary(inputs);
      alternatives = deriveStudyAlternatives(inputs);
      break;
    case "digital_nomad":
      primary = deriveDigitalNomadPrimary(inputs);
      alternatives = deriveDigitalNomadAlternatives(inputs);
      break;
    case "settle":
      primary = deriveSettlePrimary(inputs);
      alternatives = deriveSettleAlternatives(inputs);
      break;
    case "other":
    case "free_movement":
    case null:
      primary = null;
      alternatives = [];
      break;
  }

  // Stable ordering: strong → moderate → weak; within strength, by id.
  const strengthRank: Record<AlternativePath["fitStrength"], number> = {
    strong: 0,
    moderate: 1,
    weak: 2,
  };
  alternatives.sort((a, b) => {
    const r = strengthRank[a.fitStrength] - strengthRank[b.fitStrength];
    if (r !== 0) return r;
    return a.id.localeCompare(b.id);
  });

  // Suppress alternatives in the healthy state ("primary is holding up
  // and no scenario triggered"). This prevents the contradictory render
  // of a green "Holding up" primary card next to "switch path"
  // alternatives — verify.md non-negotiable.
  if (primary && !primary.isWeak && !guidance) {
    alternatives = [];
  }

  return {
    generatedAt: new Date().toISOString(),
    primaryPath: primary,
    alternatives,
    guidance,
  };
}

// Re-export per-purpose derivers for testability.
export {
  deriveWorkPrimary,
  deriveStudyPrimary,
  deriveDigitalNomadPrimary,
  deriveSettlePrimary,
  deriveWorkAlternatives,
  deriveStudyAlternatives,
  deriveDigitalNomadAlternatives,
  deriveSettleAlternatives,
  deriveScenarioGuidance,
};
