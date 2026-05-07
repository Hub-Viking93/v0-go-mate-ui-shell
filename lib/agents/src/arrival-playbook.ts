// =============================================================
// @workspace/agents — Phase 4A arrival playbook
// =============================================================
// Two hand-authored time-bucketed playbooks for the post-arrival
// period: "First 72 hours" (immediate landing) and "First 30 days"
// (operational setup). Pure code, deterministic.
//
// Phase 4A is intentionally NOT another sort of the checklist:
//
//   • Most items live OUTSIDE the settling-in DAG (e.g. "buy a SIM",
//     "photograph originals", "locate nearest 24h pharmacy") — they
//     don't earn their own task row but matter on day-one.
//   • Items that DO map to a settling-in task carry a `relatedTaskRef`
//     so the UI can deep-link, and pull `status` from the actual task
//     row instead of asking the user to re-tick a box.
//   • Each item carries a `whyNow` sentence anchored in the time
//     window — what makes this item useful in the first 72 hours vs.
//     30 days, not just "this is required someday".
//
// Phase 4A explicit non-goals:
//   • No banking flow (4B).
//   • No insurance flow (4C).
//   • No cultural deep-dive (4C / 4D).
//   • No new specialist pipelines.
// =============================================================

import type { DocumentCategory } from "./walkthrough.js";

// ---- Public types ---------------------------------------------------------

export type PlaybookItemStatus = "completed" | "pending" | "not_applicable";

export type PlaybookPhase =
  | "pre_arrival"
  | "first_72h"
  | "first_30d"
  | "post_30d";

export interface PlaybookItem {
  /** Stable id for React keys + analytics ("playbook:locate-keys"). */
  id: string;
  title: string;
  /**
   * One-sentence "why this item belongs to THIS time window". Anchored
   * in the moment, not in long-term consequence. Authored, not LLM.
   */
  whyNow: string;
  /**
   * Canonical task ref ("settling-in:reg-population") when the item
   * mirrors a settling-in task. The UI pulls status from the task and
   * deep-links into the checklist sheet.
   */
  relatedTaskRef?: string;
  /**
   * "completed"      — derived from a related settling-in task being done
   * "pending"        — applicable but not done
   * "not_applicable" — gated out by profile flags (e.g. license conv.
   *                    when user doesn't drive)
   */
  status: PlaybookItemStatus;
  /** Author-set ordinal within the bucket. Lower = earlier. */
  order: number;
}

export interface ArrivalPlaybook {
  generatedAt: string;
  /** Echoed back from the plan; null if not set. */
  arrivalDate: string | null;
  /** Days since arrival; negative when arrival is in the future. */
  daysSinceArrival: number | null;
  /** Time-bucket the user is currently in. */
  phase: PlaybookPhase;
  first72Hours: PlaybookItem[];
  first30Days: PlaybookItem[];
}

// ---- Inputs ---------------------------------------------------------------

export interface PlaybookProfileInputs {
  destination?: string | null;
  citizenship?: string | null;
  visa_role?: string | null;
  posting_or_secondment?: string | null;
  pets?: string | null;
  children_count?: number | string | null;
  bringing_vehicle?: string | null;
  driver_license_origin?: string | null;
  prescription_medications?: string | null;
}

/** Subset of a settling-in task row the playbook needs. */
export interface PlaybookSettlingTask {
  /** Stable taskKey ("reg-population"). */
  taskKey: string;
  status: string;
}

export interface PlaybookInputs {
  profile: PlaybookProfileInputs;
  arrivalDate: string | null;
  stage: string | null;
  vault: { coveredCategories: DocumentCategory[] };
  /** Open + completed settling-in tasks, indexed by their taskKey. */
  settlingTasks: PlaybookSettlingTask[];
}

// ---- Helpers --------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function asInt(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isYes(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true";
}

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / DAY_MS);
}

function phaseFromDays(d: number | null): PlaybookPhase {
  if (d == null) return "pre_arrival";
  if (d < 0) return "pre_arrival";
  if (d <= 3) return "first_72h";
  if (d <= 30) return "first_30d";
  return "post_30d";
}

function statusFromTask(
  taskKey: string,
  tasks: PlaybookSettlingTask[],
): PlaybookItemStatus {
  const row = tasks.find((t) => t.taskKey === taskKey);
  if (!row) return "pending";
  if (row.status === "completed") return "completed";
  if (row.status === "skipped") return "not_applicable";
  return "pending";
}

// ---- Authored playbook items ---------------------------------------------

/** Build the First-72-hours bucket. Items are conditional on profile. */
function buildFirst72Hours(inputs: PlaybookInputs): PlaybookItem[] {
  const { profile } = inputs;
  const items: PlaybookItem[] = [];

  items.push({
    id: "playbook:locate-keys",
    title: "Pick up your keys + walk through the accommodation",
    whyNow:
      "Day 0 is the only window where you can still flag missing keys, broken locks or undelivered furniture before the landlord's office closes for the weekend.",
    status: "pending",
    order: 0,
  });

  items.push({
    id: "playbook:essentials-on-you",
    title: "Keep passport + permit + lease on you for the first encounters",
    whyNow:
      "Banks, mobile-network shops and registration offices in the first 72 hours all ask for these in-person. A scan on your phone won't always cut it.",
    status: "pending",
    order: 1,
  });

  items.push({
    id: "playbook:destination-sim",
    title: "Activate a destination SIM or eSIM",
    whyNow:
      "Most authority booking portals and bank-onboarding flows send 2FA codes to a destination phone number. Without one, paperwork stalls.",
    status: "pending",
    order: 2,
  });

  items.push({
    id: "playbook:photo-originals",
    title: "Photograph all originals and back them up to a separate cloud",
    whyNow:
      "The first 72 hours are when documents are most vulnerable to being misplaced — taxis, hotel safes, layered jacket pockets. Cloud-back-up before you unpack.",
    status: "pending",
    order: 3,
  });

  items.push({
    id: "playbook:essentials-shop",
    title: "Day-1 essentials: groceries, plug adapters, transit card",
    whyNow:
      "You can't run errands productively without water, food, and the ability to charge your phone. Fix the basics before chasing paperwork.",
    status: "pending",
    order: 4,
  });

  items.push({
    id: "playbook:nearest-emergency",
    title: "Note nearest 24h pharmacy + emergency room",
    whyNow:
      "Jet lag, food sensitivity, and stress headaches are common in the first 72 hours. Knowing the nearest 24h pharmacy + ER address gives you cover before you have a healthcare card.",
    status: "pending",
    order: 5,
  });

  if (isYes(profile.posting_or_secondment)) {
    items.push({
      id: "playbook:posting-a1-handover",
      title: "Hand your A1 / CoC certificate to destination HR on day one",
      whyNow:
        "Posted-worker rules require the certificate to be on file before work starts. Many destinations also require a separate Posted Worker Declaration — both reference the A1 number.",
      relatedTaskRef: "settling-in:emp-a1-on-file",
      status: statusFromTask("emp-a1-on-file", inputs.settlingTasks),
      order: 6,
    });
  }

  if (asInt(profile.children_count) > 0) {
    items.push({
      id: "playbook:school-locate",
      title: "Locate the school / kindergarten you'll register with",
      whyNow:
        "School slots fill in the same week you arrive. Walk past the building and confirm the office hours so you can be first in line on Monday.",
      relatedTaskRef: "settling-in:family-school-confirm",
      status: statusFromTask("family-school-confirm", inputs.settlingTasks),
      order: 7,
    });
  }

  if (
    typeof profile.prescription_medications === "string" &&
    profile.prescription_medications.trim().length > 3 &&
    profile.prescription_medications.toLowerCase() !== "no" &&
    profile.prescription_medications.toLowerCase() !== "none"
  ) {
    items.push({
      id: "playbook:prescription-handoff",
      title: "Take your doctor's letter to the nearest pharmacy",
      whyNow:
        "Some origin medications are restricted in the destination. The pharmacist tells you on day one whether you need a local equivalent before you're out of supply.",
      status: "pending",
      order: 8,
    });
  }

  if (
    typeof profile.pets === "string" &&
    profile.pets.length > 0 &&
    profile.pets !== "none" &&
    profile.pets !== "no"
  ) {
    items.push({
      id: "playbook:pet-bedding",
      title: "Set up the pet's space + locate the nearest vet",
      whyNow:
        "Pets show stress on the first day in a new home — a familiar bed and an identified local vet head off middle-of-the-night vet searches.",
      status: "pending",
      order: 9,
    });
  }

  return items.sort((a, b) => a.order - b.order);
}

/** Build the First-30-days bucket. */
function buildFirst30Days(inputs: PlaybookInputs): PlaybookItem[] {
  const { profile, settlingTasks } = inputs;
  const items: PlaybookItem[] = [];

  items.push({
    id: "playbook:population-registration",
    title: "Register at the population authority",
    whyNow:
      "Most destinations have a hard window (7-14 days) for this. Without a personnummer / Anmeldebestätigung the rest of the month's tasks block.",
    relatedTaskRef: "settling-in:reg-population",
    status: statusFromTask("reg-population", settlingTasks),
    order: 0,
  });

  if (
    profile.visa_role === "primary" ||
    profile.visa_role === "dependent"
  ) {
    items.push({
      id: "playbook:permit-pickup",
      title: "Collect the physical residence-permit card",
      whyNow:
        "Even if your decision was approved abroad, banks and HR ask for the physical card. Booking the pickup early in the first month avoids slot scarcity.",
      relatedTaskRef: "settling-in:reg-visa-pickup",
      status: statusFromTask("reg-visa-pickup", settlingTasks),
      order: 1,
    });
  }

  items.push({
    id: "playbook:bank-account",
    title: "Open the destination bank account",
    whyNow:
      "Salary, deposit, and most digital services need a destination IBAN. Open it within the first two weeks so payroll can land on time.",
    relatedTaskRef: "settling-in:bank-account-open",
    status: statusFromTask("bank-account-open", settlingTasks),
    order: 2,
  });

  items.push({
    id: "playbook:digital-id",
    title: "Enroll BankID / digital ID",
    whyNow:
      "BankID (or the local equivalent) unlocks every authority portal — Skatteverket, 1177, Försäkringskassan. Worth doing the moment your bank account is live.",
    relatedTaskRef: "settling-in:bank-bankid",
    status: statusFromTask("bank-bankid", settlingTasks),
    order: 3,
  });

  items.push({
    id: "playbook:id-card",
    title: "Apply for the local ID card",
    whyNow:
      "Some banks won't fully activate BankID without a local ID card. Process takes 2-3 weeks; start it early in the month.",
    relatedTaskRef: "settling-in:reg-id-card",
    status: statusFromTask("reg-id-card", settlingTasks),
    order: 4,
  });

  items.push({
    id: "playbook:primary-care",
    title: "Register with a primary care clinic",
    whyNow:
      "Picking a vårdcentral / Hausarzt / equivalent in week 1 means you have somewhere to call if you fall ill — without it every visit becomes the ER.",
    relatedTaskRef: "settling-in:health-vardcentral",
    status: statusFromTask("health-vardcentral", settlingTasks),
    order: 5,
  });

  items.push({
    id: "playbook:payroll-setup",
    title: "Confirm payroll setup with your employer",
    whyNow:
      "Hand HR your bank account + ID number now so the first paycheck lands on schedule. Late submission usually costs you a month.",
    relatedTaskRef: "settling-in:emp-payroll",
    status: statusFromTask("emp-payroll", settlingTasks),
    order: 6,
  });

  if (asInt(profile.children_count) > 0) {
    items.push({
      id: "playbook:school-confirm",
      title: "Confirm school placement in person",
      whyNow:
        "Schools ask for proof of address at the in-person visit. Once registration is done, walk in and convert your slot from 'pending' to 'enrolled'.",
      relatedTaskRef: "settling-in:family-school-confirm",
      status: statusFromTask("family-school-confirm", settlingTasks),
      order: 7,
    });
  }

  items.push({
    id: "playbook:transit-pass",
    title: "Buy a monthly transit pass",
    whyNow:
      "Per-trip tickets add up fast in the first weeks. The monthly card pays for itself within ~14 commutes and lets you explore neighbourhoods cheaply.",
    relatedTaskRef: "settling-in:transit-pass",
    status: statusFromTask("transit-pass", settlingTasks),
    order: 8,
  });

  if (isYes(profile.bringing_vehicle) || isYes(profile.driver_license_origin)) {
    items.push({
      id: "playbook:license-conversion",
      title: "Submit driver's licence conversion application",
      whyNow:
        "Most destinations have a 6-12 month conversion window. Filing in month one means you're not driving on a soon-to-be-invalid licence.",
      relatedTaskRef: "settling-in:transit-license",
      status: statusFromTask("transit-license", settlingTasks),
      order: 9,
    });
  }

  items.push({
    id: "playbook:tax-residency",
    title: "Verify destination tax-residency setup",
    whyNow:
      "Folkbokföring / Anmeldung triggers tax residency. Confirm the tax-table assignment in the authority portal before the first paycheck — fixing it later means a year of refund-claims.",
    relatedTaskRef: "settling-in:tax-residency-declaration",
    status: statusFromTask("tax-residency-declaration", settlingTasks),
    order: 10,
  });

  return items.sort((a, b) => a.order - b.order);
}

// ---- Top-level composer ---------------------------------------------------

export function deriveArrivalPlaybook(inputs: PlaybookInputs): ArrivalPlaybook {
  const now = new Date();
  const days = daysSince(inputs.arrivalDate, now);
  const phase = phaseFromDays(days);
  return {
    generatedAt: now.toISOString(),
    arrivalDate: inputs.arrivalDate,
    daysSinceArrival: days,
    phase,
    first72Hours: buildFirst72Hours(inputs),
    first30Days: buildFirst30Days(inputs),
  };
}

// Re-export per-bucket builders for testability.
export { buildFirst72Hours, buildFirst30Days };
