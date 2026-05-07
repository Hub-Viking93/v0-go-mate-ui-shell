// =============================================================
// @workspace/agents — Phase 5C pet-relocation layer
// =============================================================
// Practical decision support for moving pets internationally:
// timeline + microchip + vaccinations + import rules + transport.
//
// Five blocks:
//   1. Microchip guidance — status + the "before-rabies" ordering rule.
//   2. Vaccination guidance — what's typical, the post-vaccine waiting
//      window, what to bring to the vet.
//   3. Import-rule guidance — destination-region-typical patterns
//      (EU / UK / USA / Australia / generic).
//   4. Transport guidance — cabin vs cargo, breed/age/season risks.
//   5. Timeline — ordered phases keyed off arrival_date.
//
// Phase 5C explicit non-goals:
//   • No live-rule integration with destination authorities.
//   • No partner / pet-mover / vet-booking marketplace.
//   • No flight-booking integration.
//   • No insurance marketplace.
//   • No generic pet-care content.
//   • No multi-pet logistics engine — one logical pet at a time.
// =============================================================

// ---- Public types ---------------------------------------------------------

export type PetRelocationDirection = "leaving_origin" | "leaving_destination";

export type MicrochipStatus = "in_place" | "outdated" | "missing" | "unknown";

export type VaccinationStatus = "current" | "outdated" | "starting" | "unknown";

export type GuidanceUrgency = "now" | "soon" | "on_track" | "later" | "complete";

export type DestinationRuleProfile =
  | "eu"
  | "uk"
  | "usa"
  | "canada"
  | "australia_nz"
  | "rabies_free"
  | "generic";

export type TransportMode = "cabin" | "cargo" | "ground" | "unknown";

export interface PetSummary {
  /** Surface-name from profile.pets — passed through. */
  species: string | null;
  breed: string | null;
  size_weight: string | null;
  age: string | null;
  microchip: MicrochipStatus;
  vaccination: VaccinationStatus;
  /** Heuristic — true if pet is one of the flagged short-snouted breeds many
   *  airlines restrict in cargo. */
  isSnubNosedBreed: boolean;
}

export interface MicrochipGuidance {
  status: MicrochipStatus;
  urgency: GuidanceUrgency;
  message: string;
  recommendedAction: string;
  /**
   * The canonical "ordering" callout — microchip must be implanted BEFORE
   * rabies vaccination for EU / UK pet-passport schemes. Captured as its
   * own field so the UI can render it as a warning.
   */
  orderingRule: string;
}

export interface VaccinationGuidance {
  status: VaccinationStatus;
  urgency: GuidanceUrgency;
  message: string;
  recommendedAction: string;
  /** EU pet passports require a 21-day waiting period after primary rabies. */
  postVaccineWaitDays: number;
  /** Common gap a newcomer trips on. */
  commonGap: string;
}

export interface ImportRuleGuidance {
  destinationProfile: DestinationRuleProfile;
  destinationLabel: string;
  /** Ranked list of bullet-points the user should verify with the destination
   *  authority. We do NOT claim to be authoritative. */
  keyChecks: string[];
  /** Estimated minimum lead time before move-in for full compliance. */
  minimumLeadTimeWeeks: number;
  /** Major watch-out — biggest single thing newcomers miss. */
  biggestWatchOut: string;
  /** Where to verify the rules officially (category, not a clickable link). */
  authoritativeSource: string;
}

export interface TransportGuidance {
  recommendedMode: TransportMode;
  modeReasoning: string[];
  airlineConstraints: string[];
  /** Breed-restriction warning when the pet is on the snub-nosed list. */
  breedWarning: string | null;
  /** Layover risk: long flights with cargo transfers in summer/winter. */
  seasonalConsideration: string;
  /** Crate must comply with IATA Live Animals Regulations. */
  cratePrep: string;
}

export type TimelinePhaseKey =
  | "T-26w"
  | "T-12w"
  | "T-8w"
  | "T-4w"
  | "T-2w"
  | "T-1w"
  | "move_day"
  | "post_arrival";

export interface TimelinePhase {
  id: TimelinePhaseKey;
  weeksBefore: number;
  label: string;
  whatHappens: string;
  /** Bulleted to-dos under this phase. */
  todos: string[];
  /** Has the user already passed this phase given current state? */
  passed: boolean;
  /** Is the user behind on this phase given the arrival_date? */
  behind: boolean;
  /** Phase-only watch-out (often the most-skipped step). */
  watchOut: string | null;
}

export interface PetRelocationReport {
  generatedAt: string;
  direction: PetRelocationDirection;
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

// ---- Inputs ---------------------------------------------------------------

export interface PetProfileInputs {
  destination?: string | null;
  pets?: string | null;
  pet_microchip_status?: string | null;
  pet_vaccination_status?: string | null;
  pet_breed?: string | null;
  pet_size_weight?: string | null;
  pet_age?: string | null;
}

export interface PetRelocationInputs {
  profile: PetProfileInputs;
  arrivalDate: string | null;
  stage: string | null;
}

// ---- Helpers --------------------------------------------------------------

function weeksUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.parse(dateStr);
  if (!Number.isFinite(ms)) return null;
  return Math.round((ms - Date.now()) / (7 * 24 * 60 * 60 * 1000));
}

function hasPets(p: PetProfileInputs | null | undefined): boolean {
  const v = (p?.pets ?? "").toString().trim().toLowerCase();
  return v.length > 0 && v !== "none" && v !== "no";
}

const SNUB_NOSED_PATTERNS = [
  "bulldog", "pug", "boxer", "boston terrier", "shih tzu", "shih-tzu",
  "lhasa", "pekingese", "chow chow", "cane corso",
  "persian", "himalayan", "exotic shorthair", "british shorthair", "burmese",
];

function detectSnubNosed(breed: string | null | undefined): boolean {
  if (!breed) return false;
  const norm = breed.toLowerCase();
  return SNUB_NOSED_PATTERNS.some((p) => norm.includes(p));
}

function normalizeMicrochip(raw: string | null | undefined): MicrochipStatus {
  const v = (raw ?? "").toString().trim().toLowerCase();
  if (!v) return "unknown";
  if (v === "yes" || v === "in_place" || v === "iso" || v === "iso_compliant" || v === "compliant" || v === "have") return "in_place";
  if (v === "no" || v === "missing" || v === "none") return "missing";
  if (v === "old" || v === "outdated" || v === "non_iso" || v === "old_non_iso") return "outdated";
  return "unknown";
}

function normalizeVaccination(raw: string | null | undefined): VaccinationStatus {
  const v = (raw ?? "").toString().trim().toLowerCase();
  if (!v) return "unknown";
  if (v === "current" || v === "up_to_date" || v === "up-to-date" || v === "yes") return "current";
  if (v === "outdated" || v === "expired" || v === "lapsed") return "outdated";
  if (v === "starting" || v === "in_progress" || v === "none" || v === "no") return "starting";
  return "unknown";
}

// ---- Destination rule profile --------------------------------------------

interface DestRuleEntry {
  profile: DestinationRuleProfile;
  label: string;
  countries: string[];
  keyChecks: string[];
  minimumLeadTimeWeeks: number;
  biggestWatchOut: string;
  authoritativeSource: string;
}

const RULE_TABLE: DestRuleEntry[] = [
  {
    profile: "eu",
    label: "EU pet-passport scheme",
    countries: ["sweden", "germany", "france", "spain", "italy", "netherlands", "belgium", "austria", "denmark", "finland", "ireland", "portugal", "greece", "poland", "czech", "czechia", "slovakia", "hungary", "luxembourg", "estonia", "latvia", "lithuania", "slovenia", "croatia", "bulgaria", "romania", "malta", "cyprus", "iceland", "norway"],
    keyChecks: [
      "ISO 11784/11785 microchip in place BEFORE rabies vaccination.",
      "Valid rabies vaccination — minimum 21-day wait after primary shot.",
      "EU pet passport (or 3rd-country health certificate within 10 days of travel).",
      "Tapeworm treatment 24-120 hours before entry to FI / IE / MT / NO (dogs only).",
      "Entry through a Travellers' Point of Entry (TPE) at the destination airport.",
    ],
    minimumLeadTimeWeeks: 4,
    biggestWatchOut: "Microchip implanted AFTER rabies = the rabies shot doesn't count. Order matters.",
    authoritativeSource: "Destination country's veterinary / agriculture ministry pet-import page",
  },
  {
    profile: "uk",
    label: "UK GOV.UK pet-import (post-Brexit)",
    countries: ["united kingdom", "uk", "great britain", "england", "scotland", "wales", "northern ireland"],
    keyChecks: [
      "ISO microchip + rabies vaccination + 21-day wait (same as EU).",
      "Animal Health Certificate (AHC) issued by an Official Veterinarian within 10 days of travel — replaces the EU pet passport for arrivals from non-UK countries.",
      "Tapeworm treatment 24-120 hours before entry (dogs only).",
      "Approved route + carrier — entry must be on a UK-listed transport route.",
    ],
    minimumLeadTimeWeeks: 5,
    biggestWatchOut: "AHCs are valid for 10 days only — book the vet appointment with the date already locked.",
    authoritativeSource: "GOV.UK pet-travel pages",
  },
  {
    profile: "usa",
    label: "USA CDC + USDA APHIS",
    countries: ["united states", "usa", "us", "america"],
    keyChecks: [
      "Rabies vaccination + valid certificate (specific format depends on origin).",
      "Dogs from high-risk rabies countries: CDC import permit + serology test required since 2024.",
      "USDA-endorsed health certificate within ~10 days of travel for most carriers.",
      "Some states (Hawaii) have an additional quarantine + serology cycle — start 6+ months ahead.",
    ],
    minimumLeadTimeWeeks: 4,
    biggestWatchOut: "CDC's high-risk-country list is updated periodically — verify origin status BEFORE booking the flight.",
    authoritativeSource: "CDC Bringing Animals to the U.S. + USDA APHIS Pet Travel pages",
  },
  {
    profile: "canada",
    label: "Canada CFIA",
    countries: ["canada"],
    keyChecks: [
      "Rabies vaccination certificate (English or French) — chip + form requirements depend on origin.",
      "Veterinary export certificate from origin endorsed by a competent authority.",
      "Some provinces add their own rules — check destination province as well.",
    ],
    minimumLeadTimeWeeks: 3,
    biggestWatchOut: "Rules differ for commercial vs personal import — confirm yours is treated as personal travel.",
    authoritativeSource: "CFIA — Canadian Food Inspection Agency pet-import page",
  },
  {
    profile: "australia_nz",
    label: "Australia / New Zealand (rabies-titer regime)",
    countries: ["australia", "new zealand", "nz"],
    keyChecks: [
      "Rabies vaccination + 30-day wait + RNATT (rabies neutralising antibody titer) blood test ≥ 0.5 IU/ml.",
      "Minimum 180-day wait between a successful titer and travel for AU; similar for NZ.",
      "Approved-country list — origin must be on it, or extra steps + quarantine apply.",
      "Permit application to DAFF (AU) or MPI (NZ) — NOT instant; submit 4-8 weeks before flight.",
      "Government-managed quarantine on arrival (10 days at Mickleham QLD for AU).",
    ],
    minimumLeadTimeWeeks: 28,
    biggestWatchOut: "The titer-test waiting period alone is 6 months — the single biggest reason newcomers can't travel together with their pet.",
    authoritativeSource: "AU DAFF Bringing cats and dogs to Australia / NZ MPI Importing pets",
  },
  {
    profile: "rabies_free",
    label: "Rabies-free destinations (Iceland, Singapore, Hong Kong, Japan, Malta)",
    countries: ["iceland", "singapore", "hong kong", "japan", "malta"],
    keyChecks: [
      "Most rabies-free destinations require a long titer + serology cycle similar to AU/NZ.",
      "Permits + advance notice are usually mandatory.",
      "Quarantine periods range from days to several months — check before committing.",
    ],
    minimumLeadTimeWeeks: 26,
    biggestWatchOut: "These rules are stricter than EU/UK — don't assume EU procedures generalise.",
    authoritativeSource: "Destination country's official agriculture / quarantine authority",
  },
];

function detectRuleProfile(destination: string | null | undefined): DestRuleEntry {
  const norm = (destination ?? "").toString().trim().toLowerCase();
  if (norm) {
    // Use substring match only for keywords ≥ 4 chars; short aliases like
    // "us"/"uk"/"nz" must match exactly to avoid catching e.g. "australia"
    // (which contains "us") or "ukraine" (which contains "uk").
    for (const e of RULE_TABLE) {
      if (
        e.countries.some((c) => {
          if (c.length < 4) return norm === c;
          return norm === c || norm.includes(c);
        })
      ) {
        return e;
      }
    }
  }
  // Generic fallback.
  return {
    profile: "generic",
    label: "Destination authority pet-import rules",
    countries: [],
    keyChecks: [
      "Verify the destination's pet-import requirements with its agriculture / veterinary authority.",
      "Most destinations require an ISO microchip + rabies vaccination + a vet-signed health certificate.",
      "Some destinations require a rabies-titer test + waiting period — check before booking.",
      "Many destinations require entry through specific airports / ports of entry.",
    ],
    minimumLeadTimeWeeks: 6,
    biggestWatchOut: "Don't book the flight before you've verified the destination's exact import rules — order of vaccinations and waiting periods often dictates the timeline.",
    authoritativeSource: "Destination country's agriculture / veterinary ministry",
  };
}

// ---- Microchip ------------------------------------------------------------

function buildMicrochipGuidance(pet: PetSummary): MicrochipGuidance {
  const ordering =
    "Microchip MUST be implanted before the rabies vaccination. If chipped after, the rabies shot has to be redone — there are no shortcuts.";
  switch (pet.microchip) {
    case "in_place":
      return {
        status: "in_place",
        urgency: "complete",
        message: "Microchip on file — confirm the number is ISO 11784/11785 compliant and in the vet's records.",
        recommendedAction:
          "Pull the chip number now and check it against the rabies certificate to be sure they match.",
        orderingRule: ordering,
      };
    case "missing":
      return {
        status: "missing",
        urgency: "now",
        message:
          "No microchip on file. This is the first compliance step — and it must happen before any rabies vaccination.",
        recommendedAction: "Book a vet appointment to implant an ISO 11784/11785 chip this week.",
        orderingRule: ordering,
      };
    case "outdated":
      return {
        status: "outdated",
        urgency: "soon",
        message:
          "An older / non-ISO microchip needs replacing for most international imports. Bring an ISO scanner to confirm.",
        recommendedAction:
          "Implant a second, ISO-compliant chip (rare to remove the old one) and re-link records.",
        orderingRule: ordering,
      };
    default:
      return {
        status: "unknown",
        urgency: "soon",
        message:
          "Microchip status not on file. Confirm with your vet — without an ISO chip the rest of the timeline can't start.",
        recommendedAction:
          "Pull the chip number from the vet record and confirm it's ISO 11784/11785 compliant.",
        orderingRule: ordering,
      };
  }
}

// ---- Vaccination ----------------------------------------------------------

function buildVaccinationGuidance(pet: PetSummary, ruleProfile: DestinationRuleProfile): VaccinationGuidance {
  const wait = ruleProfile === "australia_nz" || ruleProfile === "rabies_free" ? 30 : 21;
  const commonGap =
    ruleProfile === "australia_nz" || ruleProfile === "rabies_free"
      ? "The post-vaccine titer test takes additional waiting time on top of the 30-day vaccine wait. Plan for months."
      : "The 21-day wait is counted from the DATE OF THE VACCINATION, not the date of the certificate. Off-by-a-day errors are common.";
  switch (pet.vaccination) {
    case "current":
      return {
        status: "current",
        urgency: "complete",
        message:
          "Rabies + core vaccinations are current. Confirm the dates fall inside the destination's validity window.",
        recommendedAction:
          "Email the vet for an updated multi-page record with batch numbers — most destinations want them on the form.",
        postVaccineWaitDays: wait,
        commonGap,
      };
    case "outdated":
      return {
        status: "outdated",
        urgency: "soon",
        message:
          "Vaccinations have lapsed. A booster + the destination's wait period must clear before travel.",
        recommendedAction:
          `Book the booster now and budget at least ${wait} days before travel for it to count.`,
        postVaccineWaitDays: wait,
        commonGap,
      };
    case "starting":
      return {
        status: "starting",
        urgency: "now",
        message:
          "Primary rabies vaccination not yet on file. Book the appointment immediately — the wait period is on top.",
        recommendedAction: `Get the primary rabies vaccination, then wait ${wait} days minimum.`,
        postVaccineWaitDays: wait,
        commonGap,
      };
    default:
      return {
        status: "unknown",
        urgency: "soon",
        message:
          "Vaccination status not on file. Pull records from the vet so we can plan around the wait period.",
        recommendedAction:
          "Request a vaccination history including rabies + core vaccines, with batch numbers.",
        postVaccineWaitDays: wait,
        commonGap,
      };
  }
}

// ---- Transport ------------------------------------------------------------

function buildTransportGuidance(pet: PetSummary): TransportGuidance {
  // Recommendation: cabin if small enough; otherwise cargo (with snub-nose
  // warnings); ground if origin and destination are road-connected.
  const sizeStr = (pet.size_weight ?? "").toLowerCase();
  const looksSmall = /(\b[0-7]\s*kg\b|\b1[0-2]?\s*kg\b|\bsmall\b|\btoy\b)/.test(sizeStr);
  const looksLarge = /(\bxl\b|\blarge\b|\b3\d\s*kg\b|\b[4-9]\d\s*kg\b|\bgiant\b)/.test(sizeStr);
  let mode: TransportMode = "unknown";
  const reasons: string[] = [];
  if (looksSmall) {
    mode = "cabin";
    reasons.push("Pet appears small enough for in-cabin travel — most carriers cap cabin pets around 7-8 kg total.");
  } else if (looksLarge) {
    mode = "cargo";
    reasons.push("Pet appears too large for cabin — manifest cargo with an IATA-compliant carrier is the typical path.");
  } else {
    reasons.push("Confirm cabin vs cargo with the airline — cabin caps total pet+carrier weight, often ≤ 8 kg.");
  }
  if (pet.isSnubNosedBreed) {
    reasons.push("Snub-nosed breed — many carriers refuse cargo year-round for these breeds. Check before booking.");
  }
  const breedWarning = pet.isSnubNosedBreed
    ? "Snub-nosed breeds (bulldogs, pugs, persians, etc.) are heat-sensitive — many airlines refuse cargo entirely. Look for a pet-specific carrier or a same-cabin option."
    : null;

  const seasonalConsideration =
    "Summer + winter cargo holds are temperature-restricted on many routes. Aim for shoulder seasons or short / direct flights with no transfer stops.";
  const cratePrep =
    "Crate must comply with IATA Live Animals Regulations: hard-sided, ventilated, secure latches, room to stand + turn. Buy 4+ weeks before travel so the pet acclimatises.";

  const airlineConstraints = [
    "Confirm cabin vs cargo eligibility BEFORE booking the flight, not after.",
    "Some airlines require a separate pet-booking call — don't rely on the website.",
    "Direct flights only where possible — layovers + transfers compound risk.",
    "Carry the original health certificate in the cabin, even when the pet flies cargo.",
  ];

  return {
    recommendedMode: mode,
    modeReasoning: reasons,
    airlineConstraints,
    breedWarning,
    seasonalConsideration,
    cratePrep,
  };
}

// ---- Timeline -------------------------------------------------------------

function buildTimeline(
  inputs: PetRelocationInputs,
  rule: DestRuleEntry,
  pet: PetSummary,
): TimelinePhase[] {
  const wks = weeksUntil(inputs.arrivalDate);
  const isLong = rule.profile === "australia_nz" || rule.profile === "rabies_free";

  const phases: TimelinePhase[] = [];

  if (isLong) {
    phases.push({
      id: "T-26w",
      weeksBefore: 26,
      label: "T-26+ weeks",
      whatHappens: "Long-cycle prep — the rabies-titer waiting window for Australia / NZ / rabies-free destinations.",
      todos: [
        "Confirm chip + rabies vaccination on file or book them.",
        "Run rabies-titer (RNATT) blood test 30 days after vaccination.",
        "Plan the 6-month wait between titer and travel.",
      ],
      passed: false,
      behind: false,
      watchOut:
        "If the titer comes back below 0.5 IU/ml, the cycle restarts — bake a 1-month buffer into your plan.",
    });
  }

  phases.push(
    {
      id: "T-12w",
      weeksBefore: 12,
      label: "T-12 weeks",
      whatHappens: "Confirm import rules + microchip + start any required vaccinations.",
      todos: [
        "Pull destination's pet-import page and screenshot the requirements.",
        "Confirm ISO microchip is in place; book vet appointment if not.",
        "Schedule any rabies / booster vaccinations needed.",
      ],
      passed: false,
      behind: false,
      watchOut: "Microchip BEFORE rabies — order matters. Don't skip this verification.",
    },
    {
      id: "T-8w",
      weeksBefore: 8,
      label: "T-8 weeks",
      whatHappens: "Vaccinations completed; start the post-vaccine wait + paperwork prep.",
      todos: [
        "Verify rabies vaccination certificate has the right format for the destination.",
        "Order an IATA-compliant travel crate — let the pet acclimatise.",
        "Decide on cabin vs cargo with the airline.",
      ],
      passed: false,
      behind: false,
      watchOut: null,
    },
    {
      id: "T-4w",
      weeksBefore: 4,
      label: "T-4 weeks",
      whatHappens: "Health-certificate booking + airline confirmation.",
      todos: [
        "Book the vet appointment for the health certificate.",
        "Confirm flight + carrier eligibility for the pet.",
        "If applicable, request the destination authority's pet-import permit.",
      ],
      passed: false,
      behind: false,
      watchOut:
        "Health certificates are often valid only for 10 days before travel. Don't book the vet too early.",
    },
    {
      id: "T-2w",
      weeksBefore: 2,
      label: "T-2 weeks",
      whatHappens: "USDA / AHC / equivalent endorsement + final logistics.",
      todos: [
        "Submit health certificate for endorsement (USDA APHIS, official vet, etc.).",
        "Confirm crate fit + airline check-in process.",
        "Stock 2-3 days of food + medication for travel + arrival buffer.",
      ],
      passed: false,
      behind: false,
      watchOut:
        "Endorsement turnaround is rarely same-day — leave room for a re-submission if anything is rejected.",
    },
    {
      id: "T-1w",
      weeksBefore: 1,
      label: "T-1 week",
      whatHappens: "Final vet visit + paperwork in hand.",
      todos: [
        "Final fitness-to-fly vet check.",
        "Tapeworm treatment if travelling to FI / IE / MT / NO / UK (dogs only).",
        "Print + carry all documents in the cabin — never check them in.",
      ],
      passed: false,
      behind: false,
      watchOut: "Tapeworm treatment must happen 24-120 hours before entry — outside that window is non-compliant.",
    },
    {
      id: "move_day",
      weeksBefore: 0,
      label: "Move day",
      whatHappens: "Travel + entry inspection.",
      todos: [
        "Withhold food 4 hours pre-flight; small water OK.",
        "Arrive early; pet check-in is a separate counter at most airports.",
        "Carry chip number, rabies certificate, and entry permit on you.",
      ],
      passed: false,
      behind: false,
      watchOut: null,
    },
    {
      id: "post_arrival",
      weeksBefore: -2,
      label: "After arrival",
      whatHappens: "Local pet registration + acclimatisation.",
      todos: [
        "Register pet locally (some destinations require it within 7-14 days).",
        "Find a destination vet for ongoing care + transferring records.",
        "Update the chip database with the destination address.",
      ],
      passed: false,
      behind: false,
      watchOut: null,
    },
  );

  // Mark passed / behind based on weeks-until.
  if (wks !== null) {
    for (const p of phases) {
      if (wks < 0) {
        p.passed = true;
      } else if (wks < p.weeksBefore) {
        // The user is past this phase's recommended start; the question is
        // whether they're "behind".
        p.behind = true;
      }
    }
  }

  // Filter the post_arrival phase if the user hasn't arrived yet — keep it,
  // it's a useful signpost. Do not strip it.

  // Mark microchip phase passed when chip is in_place AND vaccination is current.
  if (pet.microchip === "in_place" && pet.vaccination === "current") {
    const t12 = phases.find((p) => p.id === "T-12w");
    if (t12) t12.passed = true;
  }

  return phases;
}

// ---- Composer -------------------------------------------------------------

function buildPetSummary(profile: PetProfileInputs): PetSummary {
  return {
    species: profile.pets ?? null,
    breed: profile.pet_breed ?? null,
    size_weight: profile.pet_size_weight ?? null,
    age: profile.pet_age ?? null,
    microchip: normalizeMicrochip(profile.pet_microchip_status),
    vaccination: normalizeVaccination(profile.pet_vaccination_status),
    isSnubNosedBreed: detectSnubNosed(profile.pet_breed),
  };
}

function emptyReport(inputs: PetRelocationInputs): PetRelocationReport {
  // No-pets state — we still return a report so the API contract is stable.
  // The UI will render an empty-state pointing at the profile.
  const rule = detectRuleProfile(inputs.profile.destination ?? null);
  const blankPet: PetSummary = {
    species: null,
    breed: null,
    size_weight: null,
    age: null,
    microchip: "unknown",
    vaccination: "unknown",
    isSnubNosedBreed: false,
  };
  return {
    generatedAt: new Date().toISOString(),
    direction: "leaving_origin",
    hasPets: false,
    pet: null,
    destination: inputs.profile.destination ?? null,
    arrivalDate: inputs.arrivalDate,
    weeksUntilDeparture: weeksUntil(inputs.arrivalDate),
    microchipGuidance: {
      status: "unknown",
      urgency: "later",
      message: "No pets on file.",
      recommendedAction: "Add a pet in your profile if you're moving with one.",
      orderingRule:
        "Microchip MUST be implanted before the rabies vaccination — a relevant rule once a pet is on file.",
    },
    vaccinationGuidance: {
      status: "unknown",
      urgency: "later",
      message: "No pets on file.",
      recommendedAction: "Add a pet in your profile to get vaccination guidance.",
      postVaccineWaitDays: 21,
      commonGap: "",
    },
    importRuleGuidance: {
      destinationProfile: rule.profile,
      destinationLabel: rule.label,
      keyChecks: rule.keyChecks,
      minimumLeadTimeWeeks: rule.minimumLeadTimeWeeks,
      biggestWatchOut: rule.biggestWatchOut,
      authoritativeSource: rule.authoritativeSource,
    },
    transportGuidance: buildTransportGuidance(blankPet),
    timeline: [],
    nextStep: "Add a pet to your profile to unlock pet-relocation guidance.",
  };
}

function pickHeadlineNextStep(
  microchip: MicrochipGuidance,
  vaccination: VaccinationGuidance,
): string {
  // Microchip NOW > Vaccination NOW > Microchip SOON > Vaccination SOON >
  // generic "verify destination rules".
  if (microchip.urgency === "now") return microchip.recommendedAction;
  if (vaccination.urgency === "now") return vaccination.recommendedAction;
  if (microchip.urgency === "soon") return microchip.recommendedAction;
  if (vaccination.urgency === "soon") return vaccination.recommendedAction;
  return "Verify the destination's pet-import requirements and confirm the timeline below.";
}

export function derivePetRelocation(inputs: PetRelocationInputs): PetRelocationReport {
  if (!hasPets(inputs.profile)) {
    return emptyReport(inputs);
  }

  const pet = buildPetSummary(inputs.profile);
  const rule = detectRuleProfile(inputs.profile.destination ?? null);
  const microchipGuidance = buildMicrochipGuidance(pet);
  const vaccinationGuidance = buildVaccinationGuidance(pet, rule.profile);
  const transportGuidance = buildTransportGuidance(pet);
  const timeline = buildTimeline(inputs, rule, pet);
  const nextStep = pickHeadlineNextStep(microchipGuidance, vaccinationGuidance);

  return {
    generatedAt: new Date().toISOString(),
    direction: "leaving_origin",
    hasPets: true,
    pet,
    destination: inputs.profile.destination ?? null,
    arrivalDate: inputs.arrivalDate,
    weeksUntilDeparture: weeksUntil(inputs.arrivalDate),
    microchipGuidance,
    vaccinationGuidance,
    importRuleGuidance: {
      destinationProfile: rule.profile,
      destinationLabel: rule.label,
      keyChecks: rule.keyChecks,
      minimumLeadTimeWeeks: rule.minimumLeadTimeWeeks,
      biggestWatchOut: rule.biggestWatchOut,
      authoritativeSource: rule.authoritativeSource,
    },
    transportGuidance,
    timeline,
    nextStep,
  };
}
