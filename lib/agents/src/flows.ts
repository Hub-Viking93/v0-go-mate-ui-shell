// =============================================================
// @workspace/agents — Phase 4B banking + healthcare setup flows
// =============================================================
// Two hand-authored, prerequisite-aware setup flows. Pure code.
//
// Phase 4B is intentionally NOT another playbook list. The model
// captures step-to-step *dependencies*, so a user who hasn't done
// address registration sees "Open bank account" as BLOCKED with a
// concrete reason, not just as another task in a queue.
//
// Phase 4B explicit non-goals:
//   • No insurance depth (Phase 4C).
//   • No cultural deep-dive (Phase 4C/4D).
//   • No external partner integrations.
//   • No exhaustive country matrix — flows are generic-by-design and
//     defer country specifics to the underlying settling-in tasks
//     (which already have country branches).
// =============================================================

import type { DocumentCategory } from "./walkthrough.js";

// ---- Public types ---------------------------------------------------------

export type FlowKey = "banking" | "healthcare";

/**
 * Flow-level rollup status.
 *   blocked     — current step has unmet prerequisites
 *   ready       — current step is actionable, nothing done yet
 *   in_progress — at least one step done, current step ready
 *   completed   — every applicable step done
 */
export type FlowStatus = "blocked" | "ready" | "in_progress" | "completed";

/**
 * Per-step status:
 *   blocked        — prerequisite not met yet
 *   ready          — actionable now
 *   in_progress    — task is not_completed but in_progress in the underlying
 *                    settling-in row
 *   completed      — done
 *   not_applicable — gated out by profile flag (e.g. pediatric step when
 *                    children_count == 0)
 */
export type FlowStepStatus =
  | "blocked"
  | "ready"
  | "in_progress"
  | "completed"
  | "not_applicable";

export interface FlowStep {
  /** Stable id, used for prerequisites + React keys + analytics. */
  id: string;
  /** Short user-facing title. */
  title: string;
  /** "Why this step matters" — anchored in flow context, not the task itself. */
  whyThisStepMatters: string;
  /** Step ids that must be completed (or not_applicable) before this is ready. */
  prerequisites: string[];
  /** Computed status — derived by the composer, not authored. */
  status: FlowStepStatus;
  /** Concrete reason when status === "blocked". */
  blockedReason?: string;
  /** Canonical settling-in task ref ("settling-in:<key>") when one exists. */
  relatedTaskRef?: string;
  /** Optional one-liner action — "Open the bank's app and ask for BankID activation". */
  nextAction?: string;
}

export interface Flow {
  id: FlowKey;
  label: string;
  /** What completing this flow gets the user. */
  goal: string;
  status: FlowStatus;
  /** First not-completed step's id, or null when flow is completed. */
  currentStepId: string | null;
  steps: FlowStep[];
}

export interface FlowsReport {
  generatedAt: string;
  banking: Flow;
  healthcare: Flow;
}

// ---- Inputs ---------------------------------------------------------------

export interface FlowProfileInputs {
  destination?: string | null;
  citizenship?: string | null;
  visa_role?: string | null;
  children_count?: number | string | null;
  prescription_medications?: string | null;
  /** "yes" / "true" indicates ongoing chronic-care or specialist needs. */
  chronic_condition_description?: string | null;
}

export interface FlowSettlingTask {
  taskKey: string;
  status: string;
}

export interface FlowInputs {
  profile: FlowProfileInputs;
  vault: { coveredCategories: DocumentCategory[] };
  settlingTasks: FlowSettlingTask[];
  stage: string | null;
}

// ---- Authored step shapes (pre-derivation) -------------------------------

interface AuthoredStep {
  id: string;
  title: string;
  whyThisStepMatters: string;
  prerequisites: string[];
  relatedTaskRef?: string;
  /**
   * Optional vault-coverage signal. When set, the step counts as completed
   * if the named category has at least one upload.
   */
  vaultCoverageOf?: DocumentCategory;
  /**
   * When true, this step has no settling-task or vault signal — the user
   * has to confirm it manually. Phase 4B doesn't yet expose a manual-tick
   * mechanism, so these surface as "ready" forever (informational).
   */
  manualOnly?: boolean;
  nextAction?: string;
  /**
   * When set, the step is included only when the predicate returns true
   * — used for child- / prescription-conditional steps.
   */
  applicableWhen?: (inputs: FlowInputs) => boolean;
}

// ---- Helpers --------------------------------------------------------------

function asInt(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function statusFromTask(
  taskKey: string,
  tasks: FlowSettlingTask[],
): "completed" | "in_progress" | "skipped" | "pending" {
  const row = tasks.find((t) => t.taskKey === taskKey);
  if (!row) return "pending";
  if (row.status === "completed") return "completed";
  if (row.status === "skipped") return "skipped";
  if (row.status === "in_progress") return "in_progress";
  return "pending";
}

function prerequisiteSatisfied(
  prerequisiteId: string,
  derived: Map<string, FlowStep>,
): boolean {
  const prereq = derived.get(prerequisiteId);
  if (!prereq) return true; // unknown prereq = treat as satisfied (defensive)
  return prereq.status === "completed" || prereq.status === "not_applicable";
}

// ---- Banking flow ---------------------------------------------------------

const BANKING_AUTHORED: AuthoredStep[] = [
  {
    id: "address-registered",
    title: "Have your address registration done",
    whyThisStepMatters:
      "Most destination banks require proof of registration (personnummer / Anmeldebestätigung) before opening a salary account. Without it the bank visit ends in a 'come back when…'.",
    prerequisites: [],
    relatedTaskRef: "settling-in:reg-population",
    nextAction: "Complete the population-authority registration first.",
  },
  {
    id: "id-ready",
    title: "Have your ID + proof of address ready",
    whyThisStepMatters:
      "Banks run a hard KYC check at the branch — originals only, no phone scans. Bring passport, your housing contract, and (for non-EU citizens) your residence-permit decision.",
    prerequisites: ["address-registered"],
    vaultCoverageOf: "passport_id",
    nextAction: "Pack passport + housing contract before the appointment. Add the residence-permit decision if you needed a permit to enter.",
  },
  {
    id: "employment-doc-ready",
    title: "Bring the signed employment contract",
    whyThisStepMatters:
      "Most majors won't open salary accounts for new arrivals without an executed contract — they treat unemployed foreigners as high-risk.",
    prerequisites: [],
    vaultCoverageOf: "employment",
    nextAction: "Make sure the contract in your vault is signed (not just the offer letter).",
  },
  {
    id: "bank-account-open",
    title: "Open the destination bank account",
    whyThisStepMatters:
      "This is the actual goal — without a destination IBAN salary can't land, deposits can't be paid, and most digital services lock you out.",
    prerequisites: ["address-registered", "id-ready", "employment-doc-ready"],
    relatedTaskRef: "settling-in:bank-account-open",
  },
  {
    id: "digital-id",
    title: "Enroll BankID / digital ID",
    whyThisStepMatters:
      "Once the account is live, BankID (or local equivalent) unlocks every authority portal. Banks issue it the same day if you're already a customer.",
    prerequisites: ["bank-account-open"],
    relatedTaskRef: "settling-in:bank-bankid",
  },
  {
    id: "payroll-routing",
    title: "Hand IBAN to employer for payroll",
    whyThisStepMatters:
      "Forwarding the new account number to HR is what closes the loop — without it your first paycheck routes nowhere.",
    prerequisites: ["bank-account-open"],
    relatedTaskRef: "settling-in:bank-salary-setup",
  },
];

const BANKING_GOAL =
  "Get a destination bank account open, BankID enrolled, and payroll routed — in the right order, without bouncing between offices.";

// ---- Healthcare flow ------------------------------------------------------

function hasChildren(inputs: FlowInputs): boolean {
  return asInt(inputs.profile.children_count) > 0;
}

function hasMeds(inputs: FlowInputs): boolean {
  const m = inputs.profile.prescription_medications;
  if (!m || typeof m !== "string") return false;
  const s = m.trim().toLowerCase();
  return s.length > 3 && s !== "no" && s !== "none";
}

const HEALTHCARE_AUTHORED: AuthoredStep[] = [
  {
    id: "address-registered",
    title: "Have your address registration done",
    whyThisStepMatters:
      "Health-system enrolment (Försäkringskassan / Krankenkasse / equivalent) is keyed off the personnummer / national ID issued by the population authority. No registration, no card.",
    prerequisites: [],
    relatedTaskRef: "settling-in:reg-population",
  },
  {
    id: "health-card",
    title: "Receive the public health-insurance card",
    whyThisStepMatters:
      "The card auto-mails 2-4 weeks after registration. Without it, every clinic visit is processed as private and billed — sometimes for hundreds of euros.",
    prerequisites: ["address-registered"],
    relatedTaskRef: "settling-in:health-card",
  },
  {
    id: "primary-care-clinic",
    title: "Register with a primary-care clinic",
    whyThisStepMatters:
      "Picking your vårdcentral / Hausarzt / equivalent in week one means same-day phone bookings and a consistent medical record. Skipping turns every visit into the ER.",
    prerequisites: ["address-registered"],
    relatedTaskRef: "settling-in:health-vardcentral",
    nextAction: "Pick a clinic within ~5 km of your address — proximity matters more than ratings.",
  },
  {
    id: "prescription-transfer",
    title: "Transfer prescriptions to a local pharmacy",
    whyThisStepMatters:
      "Some origin medications are restricted in the destination. Transferring early gives the pharmacist time to flag substitutes before you run out.",
    prerequisites: ["primary-care-clinic"],
    relatedTaskRef: "settling-in:health-prescription",
    applicableWhen: hasMeds,
  },
  {
    id: "pediatric-registration",
    title: "Register children at the pediatric clinic",
    whyThisStepMatters:
      "Kids' wellness visits, vaccination schedules and school health forms all key off being on the local pediatric register (BVC in Sweden, Kinderarzt in Germany).",
    prerequisites: ["address-registered"],
    relatedTaskRef: "settling-in:health-pediatrician",
    applicableWhen: hasChildren,
  },
  {
    id: "emergency-numbers",
    title: "Save emergency + clinic numbers",
    whyThisStepMatters:
      "112 / 113 / 911 differ across destinations, and your clinic has its own out-of-hours line. Saving them on day one means you have it when stressed.",
    prerequisites: [],
    manualOnly: true,
  },
];

const HEALTHCARE_GOAL =
  "Be enrolled in the public health system, listed at a primary-care clinic, and prepared for prescriptions or pediatric care if relevant — before you actually need a doctor.";

// ---- Composer -------------------------------------------------------------

function deriveOneFlow(
  id: FlowKey,
  label: string,
  goal: string,
  authored: AuthoredStep[],
  inputs: FlowInputs,
): Flow {
  // First pass: filter out non-applicable steps + initialise without status.
  const applicable = authored.filter(
    (a) => !a.applicableWhen || a.applicableWhen(inputs),
  );

  // We resolve statuses in a single pass over the applicable list.
  // Authored ordering already respects topological dependencies (each
  // step's prerequisites only refer to steps that appeared earlier).
  const derived = new Map<string, FlowStep>();
  for (const a of applicable) {
    let status: FlowStepStatus = "ready";

    // 1) Determine "intrinsic" status from task / vault / manual signal.
    if (a.relatedTaskRef) {
      const key = a.relatedTaskRef.replace(/^settling-in:/, "");
      const t = statusFromTask(key, inputs.settlingTasks);
      if (t === "completed") status = "completed";
      else if (t === "skipped") status = "not_applicable";
      else if (t === "in_progress") status = "in_progress";
      else status = "ready";
    } else if (a.vaultCoverageOf) {
      status = inputs.vault.coveredCategories.includes(a.vaultCoverageOf)
        ? "completed"
        : "ready";
    } else if (a.manualOnly) {
      status = "ready";
    }

    // 2) Apply prerequisite gating: if a prereq isn't satisfied AND this
    //    step isn't already completed/N-A, mark as blocked.
    let blockedReason: string | undefined;
    if (status !== "completed" && status !== "not_applicable") {
      const unmet = a.prerequisites.filter(
        (p) => !prerequisiteSatisfied(p, derived),
      );
      if (unmet.length > 0) {
        status = "blocked";
        const unmetTitles = unmet
          .map((id) => derived.get(id)?.title ?? id)
          .join(", ");
        blockedReason = `Complete first: ${unmetTitles}`;
      }
    }

    derived.set(a.id, {
      id: a.id,
      title: a.title,
      whyThisStepMatters: a.whyThisStepMatters,
      prerequisites: a.prerequisites,
      status,
      blockedReason,
      relatedTaskRef: a.relatedTaskRef,
      nextAction: a.nextAction,
    });
  }

  const steps = Array.from(derived.values());

  // ---- Flow-level rollup -------------------------------------------------
  const completedCount = steps.filter(
    (s) => s.status === "completed" || s.status === "not_applicable",
  ).length;
  const allDone = completedCount === steps.length;
  const currentStep = steps.find(
    (s) => s.status !== "completed" && s.status !== "not_applicable",
  );
  const currentStepId = currentStep?.id ?? null;

  let flowStatus: FlowStatus;
  if (allDone) flowStatus = "completed";
  else if (!currentStep) flowStatus = "ready";
  else if (currentStep.status === "blocked") flowStatus = "blocked";
  else if (
    completedCount > 0 ||
    steps.some((s) => s.status === "in_progress")
  ) {
    flowStatus = "in_progress";
  } else {
    flowStatus = "ready";
  }

  return {
    id,
    label,
    goal,
    status: flowStatus,
    currentStepId,
    steps,
  };
}

export function deriveFlows(inputs: FlowInputs): FlowsReport {
  return {
    generatedAt: new Date().toISOString(),
    banking: deriveOneFlow(
      "banking",
      "Banking setup",
      BANKING_GOAL,
      BANKING_AUTHORED,
      inputs,
    ),
    healthcare: deriveOneFlow(
      "healthcare",
      "Healthcare setup",
      HEALTHCARE_GOAL,
      HEALTHCARE_AUTHORED,
      inputs,
    ),
  };
}

// Re-export per-flow builders for testability.
export const __TEST = { deriveOneFlow, BANKING_AUTHORED, HEALTHCARE_AUTHORED };
