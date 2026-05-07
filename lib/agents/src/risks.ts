// =============================================================
// @workspace/agents — Phase 3B risks + blockers
// =============================================================
// Pure code, no LLM. Given the same plan-state snapshot the
// readiness model uses (plus per-task document-coverage info),
// derive a STRUCTURED list of risks the user is currently sitting
// on top of. Each risk explains itself: what it is, why it's a
// problem, what could happen, and whether it is currently a
// hard blocker for some task.
//
// Phase 3B is intentionally not Phase 3C:
//   • No alternative pathways (Plan B).
//   • No "if denied, do X" branching.
//   • No fallback playbooks.
//   • No generic "red flag" boilerplate — every risk must point at a
//     concrete piece of state that justifies it.
//
// This is the first time the system says "what is fragile / dangerous
// / blocking right now in your relocation".
// =============================================================

import type { DocumentCategory } from "./walkthrough.js";

// ---- Public types ---------------------------------------------------------

/**
 * High-level domain a risk belongs to. Drives icon + grouping in the UI.
 *
 *   visa                   — anything around residence permit / pathway / application status
 *   money                  — savings runway, currency mismatch, missing financial proof
 *   document               — required vault categories not covered for some active task
 *   timing                 — schedule pressure: arrival vs. open tasks, overdue deadlines
 *   special_circumstance   — context-specific risk: posted worker without A1, pet without
 *                            health certificate, prescription meds, prior visa rejection
 */
export type RiskDomain =
  | "visa"
  | "money"
  | "document"
  | "timing"
  | "special_circumstance";

/**
 * Three severity buckets, deliberately coarse:
 *   info     — worth knowing; no action required right now
 *   warning  — should be addressed; not blocking immediate progress
 *   critical — needs attention; usually correlates with isBlocker=true
 */
export type RiskSeverity = "info" | "warning" | "critical";

export interface Risk {
  /** Stable id ("risk:visa-no-passport"). Used for React keys + analytics. */
  id: string;
  domain: RiskDomain;
  severity: RiskSeverity;
  /** Short user-facing label. Max ~70 chars. Renders as the card heading. */
  title: string;
  /** Why this is a problem. Two sentences max. Renders below the title. */
  explanation: string;
  /** What could happen if the user does nothing. Renders as a tagged line. */
  consequence: string;
  /** True when the risk currently STOPS progress somewhere. */
  isBlocker: boolean;
  /**
   * Optional canonical task reference this risk blocks. Format
   * "<origin>:<key>", same shape as `linked_task_keys` (Phase 2B).
   * Drives the "View task" CTA on blocker cards.
   */
  blockedTaskRef?: string;
}

export interface RiskReport {
  generatedAt: string;
  /**
   * All surfaced risks, sorted by severity (critical → warning → info)
   * and within severity, blockers first.
   */
  risks: Risk[];
  riskCount: number;
  blockerCount: number;
  /**
   * Counts split by severity — useful for top-level dashboard hints
   * ("3 critical risks, 5 warnings").
   */
  countsBySeverity: Record<RiskSeverity, number>;
}

// ---- Inputs ---------------------------------------------------------------

export interface RiskProfileInputs {
  destination?: string | null;
  citizenship?: string | null;
  purpose?: string | null;
  visa_role?: string | null;
  posting_or_secondment?: string | null;
  pets?: string | null;
  prescription_medications?: string | null;
  bringing_vehicle?: string | null;
  /**
   * Free-form profile flag indicating the user has had a prior visa
   * rejection. Read with several aliases below to be tolerant of
   * how the field was actually authored. Truthy when present + non-empty.
   */
  prior_visa_rejection?: string | boolean | null;
  prior_visa_refusal?: string | boolean | null;
  /** Same currency-string conventions as readiness — "45000 EUR" / "10000 SEK". */
  savings_available?: number | string | null;
  monthly_budget?: number | string | null;
  preferred_currency?: string | null;
  arrival_date?: string | null;
  timeline?: string | null;
}

export interface RiskVisaInputs {
  hasResearch: boolean;
  pathwaySelected: boolean;
  isFreeMovement: boolean;
  applicationStatus?: string | null;
}

export interface RiskVaultInputs {
  /** Distinct categories that have at least one uploaded doc. */
  coveredCategories: DocumentCategory[];
  totalDocs: number;
}

/** A single open task as the risk module sees it. */
export interface RiskOpenTask {
  /** Canonical ref ("settling-in:reg-population" / "pre-departure:visa-submit"). */
  taskRef: string;
  title: string;
  origin: "settling-in" | "pre-departure";
  /** ISO date of the task's deadline, when computable. */
  deadlineIso?: string | null;
  /** Days until deadline, negative when overdue. Null when no deadline. */
  daysUntilDeadline?: number | null;
  /** From Phase 1A. Used to skip "normal"-bucket items in timing risks. */
  urgency?: "overdue" | "urgent" | "approaching" | "normal";
  /** Document categories required by this task. */
  requiredCategories: DocumentCategory[];
  /**
   * Categories on this task whose requirement is satisfied by either an
   * explicit link OR a same-category match in the vault.
   */
  coveredCategories: DocumentCategory[];
}

export interface RiskInputs {
  profile: RiskProfileInputs;
  visa: RiskVisaInputs;
  vault: RiskVaultInputs;
  /** All open tasks (settling-in + pre-departure) — completed/skipped excluded. */
  openTasks: RiskOpenTask[];
  /** "collecting" | "generating" | "complete" | "ready_for_pre_departure" | "pre_departure" | "arrived" | … */
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
  if (typeof v === "number") {
    return Number.isFinite(v) ? { amount: v, currency: null } : null;
  }
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
    if (lastComma > lastDot) {
      normalised = normalised.replace(/\./g, "").replace(",", ".");
    } else {
      normalised = normalised.replace(/,/g, "");
    }
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
    return s === "yes" || s === "true" || s === "1" || s === "y";
  }
  return false;
}

function daysUntil(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / DAY_MS);
}

// ---- Per-domain derivers --------------------------------------------------

function deriveVisaRisks(inputs: RiskInputs): Risk[] {
  const out: Risk[] = [];
  const { visa, vault, profile } = inputs;
  if (visa.isFreeMovement) return out; // EU/EEA → no visa risks at this layer.

  if (profile.purpose && !visa.hasResearch) {
    out.push({
      id: "risk:visa-no-research",
      domain: "visa",
      severity: "warning",
      title: "Visa research not run yet",
      explanation:
        "You've set a purpose but the visa pathway research hasn't been generated for this plan.",
      consequence:
        "Without research you can't pick a pathway, gather the right evidence, or estimate processing time.",
      isBlocker: false,
    });
  }

  if (visa.hasResearch && !visa.pathwaySelected) {
    out.push({
      id: "risk:visa-no-pathway-selected",
      domain: "visa",
      severity: "warning",
      title: "No visa pathway selected",
      explanation:
        "Different pathways need different documents. Until you commit to one, you can't finalise the document checklist.",
      consequence:
        "You may end up gathering documents that don't match the pathway you eventually pick.",
      isBlocker: false,
    });
  }

  if (visa.applicationStatus === "rejected") {
    out.push({
      id: "risk:visa-rejected",
      domain: "visa",
      severity: "critical",
      title: "Recent visa application rejected",
      explanation:
        "The most recent application status on file is rejected. A re-file usually needs stronger evidence on the rejection ground.",
      consequence:
        "Re-applying without addressing the rejection reason often leads to a second rejection.",
      isBlocker: false,
    });
  }

  if (visa.pathwaySelected && !vault.coveredCategories.includes("passport_id")) {
    out.push({
      id: "risk:visa-no-passport",
      domain: "visa",
      severity: "critical",
      title: "No passport on file",
      explanation:
        "A pathway is selected but no passport / national-ID document is in your vault yet. Every visa application starts here.",
      consequence:
        "You can't submit, can't open a destination bank account, and can't finalise registration after arrival.",
      isBlocker: true,
    });
  }

  if (
    visa.pathwaySelected &&
    !vault.coveredCategories.includes("visa_permit") &&
    visa.applicationStatus === "approved"
  ) {
    out.push({
      id: "risk:visa-no-permit-card",
      domain: "visa",
      severity: "warning",
      title: "Approved but no permit / decision letter uploaded",
      explanation:
        "Your application is approved but the permit card or decision letter isn't in your vault. Banks and registration offices ask for this on day one.",
      consequence:
        "Day-1 banking and registration may be delayed until you upload the proof of legal status.",
      isBlocker: false,
    });
  }

  return out;
}

function deriveMoneyRisks(inputs: RiskInputs): Risk[] {
  const out: Risk[] = [];
  const { profile, openTasks } = inputs;
  const savings = parseAmount(profile.savings_available);
  const monthly = parseAmount(profile.monthly_budget);
  const fallbackCcy = profile.preferred_currency?.toUpperCase() ?? null;
  const savingsCcy = savings?.currency ?? fallbackCcy;
  const monthlyCcy = monthly?.currency ?? fallbackCcy;
  const sameCurrency =
    savings && monthly && savingsCcy && monthlyCcy && savingsCcy === monthlyCcy;
  const ratio =
    sameCurrency && monthly!.amount > 0 ? savings!.amount / monthly!.amount : null;

  if (savings == null) {
    out.push({
      id: "risk:money-no-savings-figure",
      domain: "money",
      severity: "warning",
      title: "No savings figure on file",
      explanation:
        "Without savings_available we can't estimate your runway during the onboarding gap before payroll lands.",
      consequence:
        "You may underestimate the cushion you need and run short during the first 1-3 months.",
      isBlocker: false,
    });
  } else if (savings.amount === 0) {
    out.push({
      id: "risk:money-zero-savings",
      domain: "money",
      severity: "critical",
      title: "Savings on file is zero",
      explanation:
        "The first 1-3 months in a new country usually run on savings — your destination salary often pays in arrears.",
      consequence:
        "You may not be able to cover deposit, fees, and living costs before the first paycheck.",
      isBlocker: false,
    });
  } else if (ratio != null && ratio < 3) {
    out.push({
      id: "risk:money-thin-runway",
      domain: "money",
      severity: "warning",
      title: `Savings cover only ~${ratio.toFixed(1)} months at your target budget`,
      explanation:
        "Most relocations need 3-6 months of buffer to bridge banking + payroll setup, deposits and surprises.",
      consequence:
        "An unexpected cost (deposit, vet, late paycheck) could leave you short before income normalises.",
      isBlocker: false,
    });
  } else if (savings && monthly && !sameCurrency) {
    out.push({
      id: "risk:money-currency-mismatch",
      domain: "money",
      severity: "info",
      title: "Savings and monthly budget are in different currencies",
      explanation: `Savings is in ${savings.currency ?? "no currency"} and monthly budget is in ${monthly.currency ?? "no currency"}. We can't compute a runway ratio until both sides agree.`,
      consequence:
        "Your runway estimate is unavailable in the readiness panel until you pick a single currency.",
      isBlocker: false,
    });
  }

  // Per-task: financial proof required but not covered → blocker for that task.
  for (const t of openTasks) {
    if (
      t.requiredCategories.includes("financial") &&
      !t.coveredCategories.includes("financial")
    ) {
      out.push({
        id: `risk:money-financial-proof-missing:${t.taskRef}`,
        domain: "money",
        severity: "critical",
        title: `No financial proof for "${t.title}"`,
        explanation:
          "This task asks for a bank statement, sponsor letter or proof-of-funds, but nothing in that category is in your vault.",
        consequence:
          "You can't submit / complete this task without the financial evidence the authority expects.",
        isBlocker: true,
        blockedTaskRef: t.taskRef,
      });
    }
  }

  return out;
}

function deriveDocumentRisks(inputs: RiskInputs): Risk[] {
  const out: Risk[] = [];
  const { openTasks, vault, profile } = inputs;

  // For each open task with required categories, surface ONE blocker risk
  // listing the categories that are still missing for that task.
  for (const t of openTasks) {
    if (t.requiredCategories.length === 0) continue;
    const missing = t.requiredCategories.filter((c) => !t.coveredCategories.includes(c));
    if (missing.length === 0) continue;
    // The "money" domain already covers `financial` blockers above; skip
    // those here to avoid double-listing the same task.
    const docMissing = missing.filter((c) => c !== "financial");
    if (docMissing.length === 0) continue;
    out.push({
      id: `risk:document-missing-for-task:${t.taskRef}`,
      domain: "document",
      severity: "critical",
      title: `Missing documents for "${t.title}"`,
      explanation: `This task can't be completed until you cover: ${docMissing.map(humaniseCategory).join(", ")}.`,
      consequence:
        "Authorities and banks check these on the spot — a missing item here usually means a re-visit.",
      isBlocker: true,
      blockedTaskRef: t.taskRef,
    });
  }

  // Empty vault but arrival imminent — high-level alert independent of any task.
  const arrivalIn =
    profile.arrival_date != null
      ? daysUntil(profile.arrival_date, new Date())
      : null;
  if (vault.totalDocs === 0 && arrivalIn != null && arrivalIn <= 30 && arrivalIn > -30) {
    out.push({
      id: "risk:document-empty-vault-near-arrival",
      domain: "document",
      severity: "warning",
      title: "Vault is empty and arrival is close",
      explanation:
        "You have no documents uploaded yet and your arrival is within 30 days. The first weeks at destination are document-heavy.",
      consequence:
        "Without scans on hand you'll lose time hunting paperwork during registration, banking and lease signing.",
      isBlocker: false,
    });
  }

  return out;
}

function deriveTimingRisks(inputs: RiskInputs): Risk[] {
  const out: Risk[] = [];
  const { profile, openTasks, stage } = inputs;
  const arrivalIn =
    profile.arrival_date != null
      ? daysUntil(profile.arrival_date, new Date())
      : null;

  if (arrivalIn != null && arrivalIn < 0 && stage === "pre_departure") {
    out.push({
      id: "risk:timing-arrival-passed-pre-departure",
      domain: "timing",
      severity: "critical",
      title: "Move date has passed but you're still in pre-departure",
      explanation:
        "Your arrival_date is in the past while the plan is still in 'pre-departure' stage. Either the date is wrong or the move has actually happened.",
      consequence:
        "Settling-in tasks can't generate until the plan moves to 'arrived', and pre-move deadlines are stale.",
      isBlocker: false,
    });
  }

  const overdueTasks = openTasks.filter((t) => t.urgency === "overdue");
  if (overdueTasks.length > 0) {
    out.push({
      id: "risk:timing-overdue-tasks",
      domain: "timing",
      severity: "warning",
      title: `${overdueTasks.length} task${overdueTasks.length === 1 ? "" : "s"} overdue`,
      explanation:
        "One or more tasks have a deadline in the past. Some carry fines (e.g. late Anmeldung); others block dependent steps.",
      consequence:
        "Late registration in Sweden / Germany can mean fines plus pushed-back personnummer / Steuer-ID issuance.",
      isBlocker: false,
    });
  }

  const urgentPreMove = openTasks.filter(
    (t) => t.origin === "pre-departure" && (t.urgency === "urgent" || t.urgency === "overdue"),
  );
  if (urgentPreMove.length >= 3 && arrivalIn != null && arrivalIn <= 21) {
    out.push({
      id: "risk:timing-pre-move-pile-up",
      domain: "timing",
      severity: "critical",
      title: "Several pre-move tasks pile up close to arrival",
      explanation: `${urgentPreMove.length} pre-move tasks are urgent or overdue and arrival is in ${arrivalIn} day${arrivalIn === 1 ? "" : "s"}. The remaining time may not be enough to clear them.`,
      consequence:
        "Apostille, A1 and similar items have hard lead times — missing them often pushes the move itself.",
      isBlocker: false,
    });
  }

  return out;
}

function deriveSpecialCircumstanceRisks(inputs: RiskInputs): Risk[] {
  const out: Risk[] = [];
  const { profile, vault, openTasks } = inputs;
  const arrivalIn =
    profile.arrival_date != null
      ? daysUntil(profile.arrival_date, new Date())
      : null;

  // Posted worker without A1 + arrival close.
  if (profile.posting_or_secondment === "yes") {
    const employmentDocs = vault.coveredCategories.includes("employment");
    if (!employmentDocs && arrivalIn != null && arrivalIn <= 60) {
      out.push({
        id: "risk:special-posted-no-a1",
        domain: "special_circumstance",
        severity: "critical",
        title: "Posted-worker assignment without A1 / CoC on file",
        explanation:
          "Your posting needs an A1 (or bilateral CoC) on file before work starts. Issuance takes 4-6 weeks; your arrival is close.",
        consequence:
          "Without it you risk double social-security contributions (~25-30% of gross) and labour-authority fines for the employer.",
        isBlocker: false,
      });
    }
  }

  // Pet without pet documentation.
  const hasPet =
    typeof profile.pets === "string" &&
    profile.pets.length > 0 &&
    profile.pets !== "none" &&
    profile.pets !== "no";
  if (hasPet && !vault.coveredCategories.includes("pet")) {
    out.push({
      id: "risk:special-pet-no-docs",
      domain: "special_circumstance",
      severity: "warning",
      title: "Pet travel without pet documents",
      explanation:
        "You're travelling with a pet but no pet documents (microchip / rabies cert / EU pet passport) are in your vault.",
      consequence:
        "EU borders verify the chip-then-rabies-then-21-day-wait sequence; missing paperwork can mean refused entry at the gate.",
      isBlocker: false,
    });
  }

  // Prescription medications — info-level reminder.
  if (
    typeof profile.prescription_medications === "string" &&
    profile.prescription_medications.trim().length > 3 &&
    profile.prescription_medications.toLowerCase() !== "no" &&
    profile.prescription_medications.toLowerCase() !== "none"
  ) {
    out.push({
      id: "risk:special-prescription-meds",
      domain: "special_circumstance",
      severity: "info",
      title: "Prescription medications in transit",
      explanation:
        "Some medications widely used in your origin can be restricted in your destination (Adderall, codeine, certain CBD).",
      consequence:
        "Carry a doctor's letter listing each medication, dose, and reason — possession charges happen at customs.",
      isBlocker: false,
    });
  }

  // Prior visa rejection.
  if (
    isFlagTrue(profile.prior_visa_rejection) ||
    isFlagTrue(profile.prior_visa_refusal)
  ) {
    out.push({
      id: "risk:special-prior-rejection",
      domain: "special_circumstance",
      severity: "warning",
      title: "Prior visa rejection on record",
      explanation:
        "A previous rejection is flagged on your profile. Most pathways ask whether you've ever been refused, and answering 'yes' usually means stronger supporting evidence is needed.",
      consequence:
        "Without addressing the prior rejection ground (financial, intent, ties), the new application is more likely to be re-rejected.",
      isBlocker: false,
    });
  }

  // Vehicle import without vehicle docs.
  const hasVehicle = profile.bringing_vehicle === "yes";
  if (hasVehicle) {
    // We don't have a "vehicle" doc category in Phase 2; surface as info.
    void openTasks;
    out.push({
      id: "risk:special-vehicle-import",
      domain: "special_circumstance",
      severity: "info",
      title: "Vehicle import in progress",
      explanation:
        "Vehicle imports add an emissions check, customs filing, and re-registration — the destination may reject older vehicles outright.",
      consequence:
        "Plan for forced sale or ship-back if your vehicle doesn't meet destination Euro standards.",
      isBlocker: false,
    });
  }

  return out;
}

// ---- Top-level composer ---------------------------------------------------

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function deriveRisks(inputs: RiskInputs): RiskReport {
  const all: Risk[] = [
    ...deriveVisaRisks(inputs),
    ...deriveMoneyRisks(inputs),
    ...deriveDocumentRisks(inputs),
    ...deriveTimingRisks(inputs),
    ...deriveSpecialCircumstanceRisks(inputs),
  ];

  // Stable sort: severity desc, blockers first within severity.
  all.sort((a, b) => {
    const sa = SEVERITY_RANK[a.severity];
    const sb = SEVERITY_RANK[b.severity];
    if (sa !== sb) return sa - sb;
    if (a.isBlocker !== b.isBlocker) return a.isBlocker ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  const blockerCount = all.filter((r) => r.isBlocker).length;
  const countsBySeverity: Record<RiskSeverity, number> = {
    critical: all.filter((r) => r.severity === "critical").length,
    warning: all.filter((r) => r.severity === "warning").length,
    info: all.filter((r) => r.severity === "info").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    risks: all,
    riskCount: all.length,
    blockerCount,
    countsBySeverity,
  };
}

// Re-export the per-domain derivers for unit-style testing without
// having to reconstruct the whole composer.
export {
  deriveVisaRisks,
  deriveMoneyRisks,
  deriveDocumentRisks,
  deriveTimingRisks,
  deriveSpecialCircumstanceRisks,
};

// ---- Helpers --------------------------------------------------------------

function humaniseCategory(c: DocumentCategory): string {
  switch (c) {
    case "passport_id":
      return "Passport / ID";
    case "visa_permit":
      return "Visa / Permit";
    case "education":
      return "Education";
    case "employment":
      return "Employment";
    case "financial":
      return "Financial";
    case "housing":
      return "Housing";
    case "civil":
      return "Civil documents";
    case "health_insurance":
      return "Health / Insurance";
    case "pet":
      return "Pet documents";
    case "other":
      return "Other";
  }
}
