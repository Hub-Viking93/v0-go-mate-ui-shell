// =============================================================
// @workspace/agents — Phase 4C driver's licence + insurance
// =============================================================
// Two state-driven advisory layers for under-appreciated parts of the
// move: do you need to act on your driving licence, and which
// insurance step matters first?
//
// This is NOT a marketplace, comparison engine, or partner integration.
// It says "act / wait / not relevant" with reasoning grounded in the
// user's actual profile state, and points at existing settling-in
// tasks where they already exist.
//
// Phase 4C explicit non-goals:
//   • No insurance-product comparison.
//   • No affiliate / partner logic.
//   • No 4D cultural deep-dive.
//   • No country-specific encyclopedia.
// =============================================================

import type { DocumentCategory } from "./walkthrough.js";

// ---- Public types ---------------------------------------------------------

/**
 * Coarse urgency bucket. Mirrors the Phase 4A playbook windows so the
 * dashboard reads consistently across surfaces.
 *
 *   now         — should act this week (or pre-arrival)
 *   first_30d   — should act in the first month
 *   later       — useful but not blocking
 *   not_required — based on state, no action required
 */
export type GuidanceUrgency = "now" | "first_30d" | "later" | "not_required";

export type LicenceStatus =
  | "needed"            // explicit conversion / exchange action required
  | "likely_carries_over" // mutual recognition or similar — usually fine
  | "not_required"      // user doesn't drive
  | "uncertain";        // we can't tell from state

export interface DriversLicenseGuidance {
  status: LicenceStatus;
  /** One-line user-facing summary. */
  summary: string;
  /** Bullet-list of state signals that led to this status. */
  reasoning: string[];
  /** Single most useful next action; null when no action needed. */
  recommendedAction: string | null;
  urgency: GuidanceUrgency;
  /** Canonical settling-task ref when one exists. */
  relatedTaskRef?: string;
}

export interface InsuranceItem {
  /** Stable id ("insurance:health-bridge"). */
  id: string;
  /** Insurance type label. */
  label: string;
  /** State-grounded reason this item matters now (or doesn't). */
  whyItMatters: string;
  /** Single recommended action. */
  recommendedAction: string;
  urgency: GuidanceUrgency;
  /** "must_have" / "recommended" / "optional" — drives label tone. */
  priority: "must_have" | "recommended" | "optional";
  /** Canonical settling-task ref when one exists. */
  relatedTaskRef?: string;
}

export interface InsuranceGuidance {
  /** Sorted by urgency desc, priority desc, then id. */
  items: InsuranceItem[];
  /** First item in the sorted list, or null when items is empty. */
  topPriority: InsuranceItem | null;
}

export interface Phase4cReport {
  generatedAt: string;
  driversLicense: DriversLicenseGuidance;
  insurance: InsuranceGuidance;
}

// ---- Inputs ---------------------------------------------------------------

export interface Phase4cProfileInputs {
  destination?: string | null;
  citizenship?: string | null;
  driver_license_origin?: string | null;
  bringing_vehicle?: string | null;
  pets?: string | null;
  prescription_medications?: string | null;
  chronic_condition_description?: string | null;
  /** "renting" / "owning" / "with_family" / null. */
  origin_lease_status?: string | null;
  arrival_date?: string | null;
}

export interface Phase4cSettlingTask {
  taskKey: string;
  status: string;
}

export interface Phase4cInputs {
  profile: Phase4cProfileInputs;
  vault: { coveredCategories: DocumentCategory[] };
  settlingTasks: Phase4cSettlingTask[];
  /** "collecting" | "ready_for_pre_departure" | "pre_departure" | "arrived" | … */
  stage: string | null;
  /** True when EU/EEA citizen + EU/EEA destination. */
  isFreeMovement: boolean;
}

// ---- Helpers --------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function isYes(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true";
}

function statusFromTask(
  taskKey: string,
  tasks: Phase4cSettlingTask[],
): "completed" | "skipped" | "in_progress" | "pending" {
  const row = tasks.find((t) => t.taskKey === taskKey);
  if (!row) return "pending";
  if (row.status === "completed") return "completed";
  if (row.status === "skipped") return "skipped";
  if (row.status === "in_progress") return "in_progress";
  return "pending";
}

function daysUntil(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - now.getTime()) / DAY_MS);
}

const URGENCY_RANK: Record<GuidanceUrgency, number> = {
  now: 0,
  first_30d: 1,
  later: 2,
  not_required: 3,
};
const PRIORITY_RANK: Record<InsuranceItem["priority"], number> = {
  must_have: 0,
  recommended: 1,
  optional: 2,
};

// ---- Driver's licence deriver ---------------------------------------------

export function deriveDriversLicenseGuidance(
  inputs: Phase4cInputs,
): DriversLicenseGuidance {
  const { profile, isFreeMovement, settlingTasks } = inputs;
  const hasLicence = isYes(profile.driver_license_origin);
  const bringingVehicle = isYes(profile.bringing_vehicle);
  const conversionTask = statusFromTask("transit-license", settlingTasks);

  // 1) User doesn't drive → not required.
  if (!hasLicence && !bringingVehicle) {
    return {
      status: "not_required",
      summary: "You haven't indicated that you drive — no licence action needed.",
      reasoning: [
        "Profile shows no origin licence and no vehicle being brought.",
        "If that changes, this card will update with conversion guidance.",
      ],
      recommendedAction: null,
      urgency: "not_required",
    };
  }

  // 2) Conversion task already completed.
  if (conversionTask === "completed") {
    return {
      status: "likely_carries_over",
      summary: "You've already completed the licence conversion task.",
      reasoning: ["The transit-license task is marked completed in your settling-in checklist."],
      recommendedAction: null,
      urgency: "not_required",
      relatedTaskRef: "settling-in:transit-license",
    };
  }

  // 3) EU/EEA freedom of movement — mutual recognition for most licences.
  if (isFreeMovement) {
    return {
      status: "likely_carries_over",
      summary: "EU/EEA licences are mutually recognised — your card likely keeps working.",
      reasoning: [
        "EU/EEA-issued licences are recognised across member states without exchange.",
        "Some destinations still need a notification when you become resident — confirm in the destination's transport-authority portal.",
      ],
      recommendedAction:
        "Verify destination notification rules in the transport-authority portal — usually a 5-minute online step.",
      urgency: "later",
    };
  }

  // 4) Non-EU origin → exchange action needed.
  return {
    status: "needed",
    summary: "Your non-EU/EEA licence usually needs to be exchanged within 6-12 months of moving.",
    reasoning: [
      "Driving on an unconverted non-EU licence past the conversion window voids your insurance in an accident.",
      "Most destinations have a 6-12 month grace period, after which the origin licence is treated as expired for driving purposes.",
      bringingVehicle
        ? "You're bringing a vehicle — re-registration usually requires a destination licence first."
        : "Even without a vehicle, exchanging early avoids surprise expiry.",
    ],
    recommendedAction:
      "Open the transit-license task and start the exchange application — the round-trip is typically 4-6 weeks.",
    urgency: "first_30d",
    relatedTaskRef: "settling-in:transit-license",
  };
}

// ---- Insurance deriver ----------------------------------------------------

export function deriveInsuranceGuidance(inputs: Phase4cInputs): InsuranceGuidance {
  const { profile, vault, settlingTasks, stage } = inputs;
  const items: InsuranceItem[] = [];

  const arrivalIn = daysUntil(profile.arrival_date, new Date());
  const isArrived = stage === "arrived";
  const isPreArrival = !isArrived && (arrivalIn == null || arrivalIn > 0);
  const hasPublicHealthCard = vault.coveredCategories.includes("health_insurance");
  const healthCardTask = statusFromTask("health-card", settlingTasks);
  const housingInsuranceTask = statusFromTask("housing-insurance", settlingTasks);
  const hasMeds =
    typeof profile.prescription_medications === "string" &&
    profile.prescription_medications.trim().length > 3 &&
    profile.prescription_medications.toLowerCase() !== "no" &&
    profile.prescription_medications.toLowerCase() !== "none";
  const hasChronic =
    typeof profile.chronic_condition_description === "string" &&
    profile.chronic_condition_description.trim().length > 3;
  // Only surface home/contents when we have a positive renting signal —
  // surfacing it for users with unknown housing state is verify.md-flagged
  // as making it a default-recommendation (which is wrong when state is
  // genuinely unknown).
  const isRenter = profile.origin_lease_status === "renting";

  // 1) Travel + bridge health insurance — only relevant pre-arrival or in the
  //    first weeks while the destination card hasn't arrived.
  if (
    (isPreArrival || (isArrived && !hasPublicHealthCard && healthCardTask !== "completed"))
  ) {
    items.push({
      id: "insurance:travel-bridge",
      label: "Travel + bridge health insurance",
      whyItMatters: isPreArrival
        ? "Origin coverage usually ends the day you exit; destination coverage starts after registration. The 1-4 week gap is when uninsured medical bills hit hardest."
        : "Your destination health card hasn't been issued yet — until it lands, every clinic visit is processed as private and billed full price.",
      recommendedAction:
        "Buy a 90-day travel + medical policy covering arrival through first-authority-card issuance. Use any reputable local or international insurer.",
      urgency: "now",
      priority: hasChronic || hasMeds ? "must_have" : "recommended",
    });
  }

  // 2) Public health insurance enrolment — the destination card itself.
  if (isArrived && healthCardTask !== "completed") {
    items.push({
      id: "insurance:public-health-card",
      label: "Public health-insurance enrolment",
      whyItMatters:
        "The destination's public card auto-mails 2-4 weeks after population registration. Without it, every visit is private-rate.",
      recommendedAction:
        "Confirm registration is on file with the public health agency; the card auto-mails — track it.",
      urgency: "now",
      priority: "must_have",
      relatedTaskRef: "settling-in:health-card",
    });
  }

  // 3) Home / contents insurance.
  if (isRenter) {
    items.push({
      id: "insurance:home-contents",
      label: "Home / contents insurance",
      whyItMatters:
        "Many destination leases require it (Sweden's hemförsäkring, Germany's Hausratversicherung). Even when not mandatory, it's cheap (€10-25/month) and covers theft + water damage.",
      recommendedAction:
        "Sign up online once you have a destination address and bank account — most insurers issue same-day.",
      urgency: housingInsuranceTask === "completed" ? "not_required" : "first_30d",
      priority:
        housingInsuranceTask === "completed" ? "optional" : "recommended",
      relatedTaskRef: "settling-in:housing-insurance",
    });
  }

  // 4) Vehicle insurance — only if bringing or planning to drive.
  if (isYes(profile.bringing_vehicle)) {
    items.push({
      id: "insurance:vehicle",
      label: "Vehicle insurance",
      whyItMatters:
        "Driving in the destination requires a local-issued policy — origin policies don't carry across borders for residents.",
      recommendedAction:
        "Quote with at least two destination insurers BEFORE re-registering the vehicle; the policy needs to be in place on day one of registration.",
      urgency: "first_30d",
      priority: "must_have",
    });
  }

  // 5) Pet insurance — recommended but not urgent.
  if (
    typeof profile.pets === "string" &&
    profile.pets.length > 0 &&
    profile.pets !== "none" &&
    profile.pets !== "no"
  ) {
    items.push({
      id: "insurance:pet",
      label: "Pet insurance",
      whyItMatters:
        "Vet bills in your destination are usually higher than at origin. Pet insurance for €10-30/month covers most of the gap.",
      recommendedAction:
        "Compare 2-3 destination pet insurers; sign up after the pet has cleared its first local vet visit.",
      urgency: "later",
      priority: "recommended",
    });
  }

  // Stable sort: urgency desc (now first), priority desc, then id.
  items.sort((a, b) => {
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (u !== 0) return u;
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return a.id.localeCompare(b.id);
  });

  return {
    items,
    topPriority: items[0] ?? null,
  };
}

// ---- Top-level composer ---------------------------------------------------

export function deriveLicenseAndInsuranceGuidance(
  inputs: Phase4cInputs,
): Phase4cReport {
  return {
    generatedAt: new Date().toISOString(),
    driversLicense: deriveDriversLicenseGuidance(inputs),
    insurance: deriveInsuranceGuidance(inputs),
  };
}
