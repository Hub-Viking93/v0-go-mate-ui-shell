// =============================================================
// @workspace/agents — Phase 5.1 pre-departure timeline lib
// =============================================================
// Pure code, no LLM. Takes the user profile + a chosen visa pathway
// + the move date + the in-memory specialist outputs and computes
// an ordered, dependency-aware timeline of pre-departure actions.
//
// What this module IS:
//   * Deterministic. Given the same inputs it ALWAYS returns the
//     same actions in the same order. No model calls, no randomness.
//   * Domain-aware. We know which specialists contribute which
//     classes of action (visa → application; documents → apostille
//     chain; pet → microchip + rabies wait; posted_worker → A1 +
//     PWD; tax → departure declaration; etc.). The contribution
//     table below is the source of truth.
//   * Dependency-aware. Actions express upstream dependencies via
//     `dependsOn`; the critical-path computation honours them.
//
// What this module is NOT:
//   * A persistence layer. Caller (api-server route) writes to DB.
//   * A narrative generator. Optional in 5.2 via a tiny LLM wrapper.
//
// SCALE NOTE: we cap the timeline at 25 actions max — beyond that
// the user's eyes glaze over and the dashboard view becomes noisy.
// We pick the highest-priority items first.
// =============================================================

export interface PreDepartureProfile {
  citizenship?: string | null;
  destination?: string | null;
  target_city?: string | null;
  purpose?: string | null;
  visa_role?: string | null;
  posting_or_secondment?: string | null;
  pets?: string | null;
  children_count?: number | string | null;
  bringing_vehicle?: string | null;
  prescription_medications?: string | null;
  birth_certificate_apostille_status?: string | null;
  marriage_certificate_apostille_status?: string | null;
  diploma_apostille_status?: string | null;
  police_clearance_status?: string | null;
  a1_certificate_status?: string | null;
  coc_status?: string | null;
  pwd_filed?: string | null;
  origin_lease_status?: string | null;
  origin_lease_termination_notice_days?: number | string | null;
  spouse_joining?: string | null;
  bringing_personal_effects?: string | null;
  [k: string]: unknown;
}

/** Tiny shape from research-orchestrator's SynthesizerInput[]. */
export interface PreDepartureSpecialistOutput {
  name: string;
  output?: { contentParagraphs?: string[]; citations?: Array<{ url: string; label?: string }> };
}

export interface VisaPathwayLite {
  name?: string;
  type?: string;
  estimatedProcessingWeeks?: number;
  officialUrl?: string;
}

export type ActionStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "blocked"
  | "skipped";

export interface PreDepartureAction {
  id: string;
  title: string;
  description: string;
  category:
    | "visa"
    | "documents"
    | "tax"
    | "banking"
    | "housing"
    | "health"
    | "pets"
    | "posted_worker"
    | "schools"
    | "vehicle"
    | "logistics"
    | "admin";
  weeksBeforeMoveStart: number;
  weeksBeforeMoveDeadline: number;
  estimatedDurationDays: number;
  dependsOn: string[];
  documentsNeeded: string[];
  officialSourceUrl: string | null;
  preFilledFormUrl: string | null;
  agentWhoAddedIt: string;
  legalConsequenceIfMissed: string;
  status: ActionStatus;
  sortOrder: number;
}

export interface PreDepartureTimeline {
  actions: PreDepartureAction[];
  totalActions: number;
  longestLeadTimeWeeks: number;
  criticalPath: PreDepartureAction[];
  moveDateIso: string;
  generatedAt: string;
}

const MAX_ACTIONS = 25;

interface ActionDraft extends Omit<PreDepartureAction, "sortOrder" | "status"> {
  /** Priority weight — lower = added first to the final list. */
  priority: number;
}

// ---- Contribution rules ---------------------------------------------------

function alwaysApplicable(profile: PreDepartureProfile): ActionDraft[] {
  const dest = profile.destination ?? "your destination";
  return [
    {
      id: "always-confirm-eligibility",
      title: "Confirm visa pathway and eligibility",
      description: `Re-read the visa decision in your dashboard and confirm the pathway still matches your situation. If anything has changed (job offer, relationship status, dependents), pause here and update your profile before any documents are filed.`,
      category: "visa",
      weeksBeforeMoveStart: 12,
      weeksBeforeMoveDeadline: 11,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: [],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "departure_coordinator",
      legalConsequenceIfMissed: "Wrong visa pathway = re-application from scratch and 8-12 weeks lost.",
      priority: 0,
    },
    {
      id: "always-mail-forwarding",
      title: "Set up mail forwarding from origin address",
      description: `Set up a forwarding service so post sent to your origin address reaches you in ${dest}. In Germany this is Nachsendeservice via Deutsche Post; equivalents exist in every EU country.`,
      category: "admin",
      weeksBeforeMoveStart: 3,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: ["Origin address", "New destination address"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "departure_coordinator",
      legalConsequenceIfMissed: "Missed tax notices, missed bank correspondence, account freezes.",
      priority: 95,
    },
    {
      id: "always-day1-bag",
      title: "Pack day-1 carry-on (originals + receipts)",
      description: `Print and pack: passports, visa stickers, A1 certificates if any, all apostilled originals, employment contract, accommodation booking, insurance proofs. Carry-on only — never check this bag.`,
      category: "logistics",
      weeksBeforeMoveStart: 1,
      weeksBeforeMoveDeadline: 0,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: ["All originals + apostilles + visa documents"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "departure_coordinator",
      legalConsequenceIfMissed: "Lost / checked = sometimes a new visa application.",
      priority: 99,
    },
  ];
}

function visaContributions(
  profile: PreDepartureProfile,
  visa: VisaPathwayLite | null,
): ActionDraft[] {
  if (profile.visa_role !== "primary" && profile.visa_role !== "dependent") return [];
  // EU/EEA citizens to EU destinations don't need a permit — skip the visa block entirely.
  const isFreeMovement =
    typeof profile.citizenship === "string" &&
    (profile.citizenship.toLowerCase() === "swedish" ||
      profile.citizenship.toLowerCase() === "german" ||
      profile.citizenship.toLowerCase() === "french") &&
    typeof profile.destination === "string" &&
    /sweden|germany|france|spain|italy|netherlands|portugal|finland|denmark|austria/i.test(
      profile.destination,
    );
  if (isFreeMovement) return [];

  const procWeeks = visa?.estimatedProcessingWeeks ?? 8;
  const officialUrl = visa?.officialUrl ?? null;
  const visaName = visa?.name ?? "the recommended residence permit";
  return [
    {
      id: "visa-gather-docs",
      title: `Gather documentation for ${visaName}`,
      description: `Pull together every supporting document the destination immigration authority lists for this pathway. Cross-check the official checklist before filing.`,
      category: "documents",
      weeksBeforeMoveStart: procWeeks + 4,
      weeksBeforeMoveDeadline: procWeeks + 1,
      estimatedDurationDays: 14,
      dependsOn: ["docs-birth-apostille"],
      documentsNeeded: ["Passport", "Application form", "Photos", "Supporting docs per checklist"],
      officialSourceUrl: officialUrl,
      preFilledFormUrl: null,
      agentWhoAddedIt: "visa_specialist",
      legalConsequenceIfMissed: "Application rejected for incomplete documentation; re-file from scratch.",
      priority: 10,
    },
    {
      id: "visa-submit",
      title: `Submit ${visaName} application`,
      description: `Submit via the official portal or in person at the embassy / consulate. Keep a stamped receipt — it's your proof of pending status.`,
      category: "visa",
      weeksBeforeMoveStart: procWeeks,
      weeksBeforeMoveDeadline: Math.max(1, procWeeks - 2),
      estimatedDurationDays: 1,
      dependsOn: ["visa-gather-docs"],
      documentsNeeded: ["All gathered docs", "Application fee"],
      officialSourceUrl: officialUrl,
      preFilledFormUrl: null,
      agentWhoAddedIt: "visa_specialist",
      legalConsequenceIfMissed: "Cannot legally enter / work in destination on the planned date.",
      priority: 11,
    },
    {
      id: "visa-pickup",
      title: "Pick up visa sticker / decision letter",
      description: `Most consulates require an in-person pickup. Schedule the appointment as soon as the decision lands. Carry passport.`,
      category: "visa",
      weeksBeforeMoveStart: 2,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 1,
      dependsOn: ["visa-submit"],
      documentsNeeded: ["Passport", "Decision notice email"],
      officialSourceUrl: officialUrl,
      preFilledFormUrl: null,
      agentWhoAddedIt: "visa_specialist",
      legalConsequenceIfMissed: "No physical proof of permit at border — entry refused.",
      priority: 12,
    },
  ];
}

function documentContributions(profile: PreDepartureProfile): ActionDraft[] {
  const out: ActionDraft[] = [];
  if (profile.birth_certificate_apostille_status !== "obtained" && profile.birth_certificate_apostille_status !== "not_needed") {
    out.push({
      id: "docs-birth-apostille",
      title: "Apostille birth certificate",
      description: `Order an apostilled copy from your origin country's apostille authority. Lead time runs 2-6 weeks depending on country (Germany: 2-3 weeks via Bundesjustizamt; Philippines: 4-6 weeks via DFA).`,
      category: "documents",
      weeksBeforeMoveStart: 12,
      weeksBeforeMoveDeadline: 8,
      estimatedDurationDays: 21,
      dependsOn: [],
      documentsNeeded: ["Original birth certificate", "Application form", "Apostille fee"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "documents_specialist",
      legalConsequenceIfMissed: "Visa application rejected — birth-cert apostille is mandatory for most family-reunification + dependent permits.",
      priority: 5,
    });
  }
  if (profile.marriage_certificate_apostille_status === "in_progress" || profile.marriage_certificate_apostille_status === "applied" || profile.marriage_certificate_apostille_status === "not_started") {
    out.push({
      id: "docs-marriage-apostille",
      title: "Apostille marriage certificate",
      description: `Same authority as the birth certificate, parallel-process to save time. Mandatory for spouse-of-citizen and family-reunion permits.`,
      category: "documents",
      weeksBeforeMoveStart: 12,
      weeksBeforeMoveDeadline: 8,
      estimatedDurationDays: 21,
      dependsOn: [],
      documentsNeeded: ["Original marriage certificate", "Application form"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "documents_specialist",
      legalConsequenceIfMissed: "Spouse-of-citizen permit cannot be filed without it.",
      priority: 6,
    });
  }
  if (profile.diploma_apostille_status === "in_progress" || profile.diploma_apostille_status === "not_started") {
    out.push({
      id: "docs-diploma-apostille",
      title: "Apostille academic diploma",
      description: `Required for skilled-worker visa categories and many regulated professions. Some authorities require notarisation first, then apostille — confirm both steps.`,
      category: "documents",
      weeksBeforeMoveStart: 11,
      weeksBeforeMoveDeadline: 8,
      estimatedDurationDays: 21,
      dependsOn: [],
      documentsNeeded: ["Diploma original", "Notarised copy if required"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "documents_specialist",
      legalConsequenceIfMissed: "Skilled-worker visa application rejected for missing qualification proof.",
      priority: 7,
    });
  }
  if (profile.police_clearance_status === "applied" || profile.police_clearance_status === "not_started") {
    out.push({
      id: "docs-police-clearance",
      title: "Obtain police clearance certificate",
      description: `Apply at the origin-country police authority (Germany: Führungszeugnis via Bundesamt für Justiz; Philippines: NBI clearance). Typically 4-6 weeks. Many destinations require it apostilled too.`,
      category: "documents",
      weeksBeforeMoveStart: 10,
      weeksBeforeMoveDeadline: 6,
      estimatedDurationDays: 28,
      dependsOn: [],
      documentsNeeded: ["Passport", "Application form", "Fee"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "documents_specialist",
      legalConsequenceIfMissed: "Visa application held / rejected without clearance.",
      priority: 8,
    });
  }
  return out;
}

function postedWorkerContributions(profile: PreDepartureProfile): ActionDraft[] {
  if (profile.posting_or_secondment !== "yes") return [];
  const out: ActionDraft[] = [];
  if (profile.a1_certificate_status !== "obtained") {
    out.push({
      id: "pw-a1-certificate",
      title: "Apply for A1 social-security certificate",
      description: `The A1 proves your home-country social security continues during the EU posting (Regulation 883/2004). Apply via origin social-security agency: Deutsche Rentenversicherung (DE), URSSAF (FR), Försäkringskassan (SE). Issuance: 4-6 weeks. Mandatory for EU postings under 24 months.`,
      category: "posted_worker",
      weeksBeforeMoveStart: 10,
      weeksBeforeMoveDeadline: 4,
      estimatedDurationDays: 35,
      dependsOn: [],
      documentsNeeded: ["Posting contract", "Employer details origin + destination", "Posting duration"],
      officialSourceUrl: "https://ec.europa.eu/social/main.jsp?catId=471",
      preFilledFormUrl: null,
      agentWhoAddedIt: "posted_worker_specialist",
      legalConsequenceIfMissed: "Double social-security contributions in both countries; €5k-50k risk.",
      priority: 4,
    });
  }
  if (profile.coc_status !== "obtained" && profile.coc_status !== "not_applicable") {
    out.push({
      id: "pw-coc",
      title: "Obtain Certificate of Coverage (CoC) — non-EU bilateral treaty",
      description: `For postings under bilateral social-security treaties (US-Sweden, India-Sweden, Korea-Germany, etc.). Same purpose as A1 but covers non-EU corridors. Apply via origin's social security authority.`,
      category: "posted_worker",
      weeksBeforeMoveStart: 12,
      weeksBeforeMoveDeadline: 6,
      estimatedDurationDays: 42,
      dependsOn: [],
      documentsNeeded: ["Posting contract", "Treaty reference"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "posted_worker_specialist",
      legalConsequenceIfMissed: "Double taxation + double social charges.",
      priority: 4,
    });
  }
  if (profile.pwd_filed !== "yes") {
    out.push({
      id: "pw-pwd-filing",
      title: "File Posted Worker Declaration with destination labour authority",
      description: `MUST be filed before work starts. Destinations: Sweden → Arbetsmiljöverket; Germany → ZOLL Mindestlohn-Meldeportal; France → SIPSI. Failure = fines from €1k upward and immediate work stoppage.`,
      category: "posted_worker",
      weeksBeforeMoveStart: 4,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 3,
      dependsOn: ["pw-a1-certificate"],
      documentsNeeded: ["A1 certificate", "Posting contract", "Destination contact person"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "posted_worker_specialist",
      legalConsequenceIfMissed: "Up to €500k fine for the employer; work stoppage; possible ban.",
      priority: 5,
    });
  }
  return out;
}

function petContributions(profile: PreDepartureProfile): ActionDraft[] {
  if (!profile.pets || profile.pets === "none" || profile.pets === "no") return [];
  return [
    {
      id: "pets-microchip-rabies",
      title: "Verify pet microchip + rabies vaccination",
      description: `EU travel requires ISO 11784/11785-compliant microchip implanted BEFORE the rabies vaccine, plus a 21-day post-vaccination wait before the pet may travel. Plan from this constraint backward.`,
      category: "pets",
      weeksBeforeMoveStart: 10,
      weeksBeforeMoveDeadline: 4,
      estimatedDurationDays: 21,
      dependsOn: [],
      documentsNeeded: ["Vet records", "Microchip ID number"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "pet_specialist",
      legalConsequenceIfMissed: "Pet quarantined or denied entry at border.",
      priority: 15,
    },
    {
      id: "pets-export-permit",
      title: "Pre-flight vet check + EU pet passport / health certificate",
      description: `10 days before travel, get the official EU pet passport (if EU origin) or USDA-endorsed health certificate (US, etc.). Carrier may require it earlier.`,
      category: "pets",
      weeksBeforeMoveStart: 2,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 2,
      dependsOn: ["pets-microchip-rabies"],
      documentsNeeded: ["Microchip + rabies records"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "pet_specialist",
      legalConsequenceIfMissed: "Animal denied at the gate.",
      priority: 16,
    },
  ];
}

function bankingContributions(profile: PreDepartureProfile): ActionDraft[] {
  void profile;
  return [
    {
      id: "bank-bridge-account",
      title: "Set up Wise / Revolut bridge account",
      description: `Open a multi-currency account NOW so you can receive your final origin paycheck and send funds to a destination account once you have a personnummer / steuerliche-IdNr / NIE. Free, takes ~10 minutes.`,
      category: "banking",
      weeksBeforeMoveStart: 8,
      weeksBeforeMoveDeadline: 6,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: ["Passport", "Selfie"],
      officialSourceUrl: "https://wise.com",
      preFilledFormUrl: null,
      agentWhoAddedIt: "banking_helper",
      legalConsequenceIfMissed: "1-3 months of no banking access in destination during onboarding gap.",
      priority: 25,
    },
    {
      id: "bank-notify-origin",
      title: "Notify origin bank of move + update tax residency",
      description: `Most banks require a residency declaration (FATCA / CRS rules). Update before move so account isn't frozen.`,
      category: "banking",
      weeksBeforeMoveStart: 3,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 2,
      dependsOn: [],
      documentsNeeded: ["Move date", "Destination address"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "banking_helper",
      legalConsequenceIfMissed: "Account frozen mid-move with funds inaccessible.",
      priority: 26,
    },
  ];
}

function healthContributions(profile: PreDepartureProfile): ActionDraft[] {
  const out: ActionDraft[] = [
    {
      id: "health-travel-insurance",
      title: "Buy travel + interim health insurance",
      description: `Bridge between origin coverage end and destination coverage start. SafetyWing, Cigna Global, or any local insurer. 90-day minimum coverage recommended.`,
      category: "health",
      weeksBeforeMoveStart: 4,
      weeksBeforeMoveDeadline: 2,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: ["Travel dates", "Destination address"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "healthcare_navigator",
      legalConsequenceIfMissed: "Uninsured medical bills can run €5k-50k for a single ER visit.",
      priority: 30,
    },
  ];
  if (profile.prescription_medications === "yes" || (typeof profile.prescription_medications === "string" && profile.prescription_medications.length > 3)) {
    out.push({
      id: "health-medication-supply",
      title: "Stock 90-day supply of prescription medications",
      description: `Some medications widely used in origin are restricted in destination (Adderall in JP/SE, certain CBD in UAE, codeine in many countries). Get a doctor's letter listing each medication, dose, and reason — carry with you.`,
      category: "health",
      weeksBeforeMoveStart: 4,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 7,
      dependsOn: [],
      documentsNeeded: ["Prescriptions", "Doctor's letter"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "healthcare_navigator",
      legalConsequenceIfMissed: "Possession charge if medication restricted; worst case detention.",
      priority: 31,
    });
  }
  return out;
}

function vehicleContributions(profile: PreDepartureProfile): ActionDraft[] {
  if (profile.bringing_vehicle !== "yes") return [];
  return [
    {
      id: "vehicle-emissions",
      title: "Verify vehicle emissions compliance for destination",
      description: `EU destinations require Euro 5/6 standard for new registration. Check destination customs portal before shipping; some vehicles cannot be re-registered.`,
      category: "vehicle",
      weeksBeforeMoveStart: 8,
      weeksBeforeMoveDeadline: 6,
      estimatedDurationDays: 7,
      dependsOn: [],
      documentsNeeded: ["Vehicle registration", "Emissions certificate"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "vehicle_import_specialist",
      legalConsequenceIfMissed: "Cannot register vehicle in destination — forced sale or ship-back.",
      priority: 40,
    },
  ];
}

function leaseContributions(profile: PreDepartureProfile): ActionDraft[] {
  const noticeDaysRaw = profile.origin_lease_termination_notice_days;
  const noticeDays =
    typeof noticeDaysRaw === "number"
      ? noticeDaysRaw
      : typeof noticeDaysRaw === "string"
        ? Number.parseInt(noticeDaysRaw, 10) || 90
        : 90;
  if (profile.origin_lease_status !== "renting") return [];
  const noticeWeeks = Math.ceil(noticeDays / 7);
  return [
    {
      id: "lease-terminate",
      title: "Send written termination notice to origin landlord",
      description: `Statutory notice in your origin country is ${noticeDays} days. Send registered mail with proof of receipt. Include desired handover date and forwarding address.`,
      category: "logistics",
      weeksBeforeMoveStart: noticeWeeks + 1,
      weeksBeforeMoveDeadline: noticeWeeks,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: ["Lease agreement", "Move date"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "departure_coordinator",
      legalConsequenceIfMissed: "Pay an extra month's rent for every week you're late.",
      priority: 50,
    },
  ];
}

function shippingContributions(profile: PreDepartureProfile): ActionDraft[] {
  if (profile.bringing_personal_effects !== "yes") return [];
  return [
    {
      id: "ship-quote",
      title: "Get 3 international shipping quotes",
      description: `Container vs groupage vs air. Sea: 6-10 weeks transit Europe→Asia. Air: 5-10 days but 5x cost. Get 3 quotes with insurance.`,
      category: "logistics",
      weeksBeforeMoveStart: 6,
      weeksBeforeMoveDeadline: 4,
      estimatedDurationDays: 5,
      dependsOn: [],
      documentsNeeded: ["Inventory list", "Origin + destination addresses"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "departure_coordinator",
      legalConsequenceIfMissed: "Last-minute booking is 2-3x cost; you may not have your stuff for 3 months after arrival.",
      priority: 55,
    },
  ];
}

// Topological sort with critical-path computation. Cycles are
// defensively broken (we trust our own inputs) — but the loop
// detection is here so a future contributor cannot accidentally
// create a deadlock.
function computeCriticalPath(actions: PreDepartureAction[]): PreDepartureAction[] {
  const byId = new Map<string, PreDepartureAction>();
  for (const a of actions) byId.set(a.id, a);

  // Earliest-finish in DAYS from "now" (= MAX_LEAD * 7 days).
  const efDays = new Map<string, number>();
  function ef(id: string, depth = 0): number {
    if (depth > actions.length + 5) return 0; // cycle guard
    const cached = efDays.get(id);
    if (cached !== undefined) return cached;
    const a = byId.get(id);
    if (!a) return 0;
    let maxDep = 0;
    for (const dep of a.dependsOn) {
      const d = ef(dep, depth + 1);
      if (d > maxDep) maxDep = d;
    }
    const ownDuration = a.estimatedDurationDays;
    const ownStartDay = Math.max(0, (efDays.get("__moveDay") ?? actions.reduce((m, x) => Math.max(m, x.weeksBeforeMoveStart), 0) * 7) - a.weeksBeforeMoveStart * 7);
    const fin = Math.max(maxDep, ownStartDay) + ownDuration;
    efDays.set(id, fin);
    return fin;
  }
  let latestFinish = 0;
  let latestId: string | null = null;
  for (const a of actions) {
    const f = ef(a.id);
    if (f >= latestFinish) {
      latestFinish = f;
      latestId = a.id;
    }
  }
  if (!latestId) return [];

  // Walk back along the dependency chain whose finish equals the predecessor finish.
  const path: PreDepartureAction[] = [];
  const seen = new Set<string>();
  let cur: string | null = latestId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const a = byId.get(cur);
    if (!a) break;
    path.unshift(a);
    let next: string | null = null;
    let bestFin = -1;
    for (const dep of a.dependsOn) {
      const f = efDays.get(dep) ?? 0;
      if (f > bestFin) {
        bestFin = f;
        next = dep;
      }
    }
    cur = next;
  }
  return path;
}

/**
 * Generate the pre-departure timeline.
 *
 * @param profile           Plan profile (read-only).
 * @param visa              Selected visa pathway (or null if free movement).
 * @param moveDate          Desired arrival date in destination.
 * @param specialistOutputs Specialist outputs from the research run (used only for citation enrichment in 5.2 narrative wrapper).
 */
export function generatePreDepartureTimeline(
  profile: PreDepartureProfile,
  visa: VisaPathwayLite | null,
  moveDate: Date,
  specialistOutputs: PreDepartureSpecialistOutput[] = [],
): PreDepartureTimeline {
  void specialistOutputs; // 5.2 narrative wrapper consumes this.

  const drafts: ActionDraft[] = [
    ...alwaysApplicable(profile),
    ...visaContributions(profile, visa),
    ...documentContributions(profile),
    ...postedWorkerContributions(profile),
    ...petContributions(profile),
    ...bankingContributions(profile),
    ...healthContributions(profile),
    ...vehicleContributions(profile),
    ...leaseContributions(profile),
    ...shippingContributions(profile),
  ];

  // Sort by priority then earliest-start.
  drafts.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.weeksBeforeMoveStart - a.weeksBeforeMoveStart;
  });
  const trimmed = drafts.slice(0, MAX_ACTIONS);

  // Materialize into final actions sorted earliest-start first.
  const actions: PreDepartureAction[] = trimmed
    .map((d, i) => {
      const { priority, ...rest } = d;
      void priority;
      return { ...rest, status: "not_started" as ActionStatus, sortOrder: i };
    })
    .sort((a, b) => b.weeksBeforeMoveStart - a.weeksBeforeMoveStart)
    .map((a, i) => ({ ...a, sortOrder: i }));

  const criticalPath = computeCriticalPath(actions);
  const longestLeadTimeWeeks = actions.reduce((m, a) => Math.max(m, a.weeksBeforeMoveStart), 0);

  return {
    actions,
    totalActions: actions.length,
    longestLeadTimeWeeks,
    criticalPath,
    moveDateIso: moveDate.toISOString(),
    generatedAt: new Date().toISOString(),
  };
}
