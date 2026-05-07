// =============================================================
// @workspace/agents — Phase 3A readiness model
// =============================================================
// Pure code, no LLM. Given a snapshot of the user's plan + vault +
// task state, derive a structured readiness report split across
// four domains (visa, money, document, move). Every level is
// EXPLAINABLE — each domain returns reasons + blockers + nextStep,
// not a single number.
//
// Phase 3A explicit non-goals:
//   • No "AI score" / generic health-meter
//   • No risk classification beyond "low / medium / high"
//   • No alternative-pathway / Plan-B reasoning (Phase 3C)
//   • No denied-or-delayed branching (Phase 3B)
//
// Architecture:
//   • A single ReadinessInputs snapshot bundles every signal we need.
//   • Each domain has its own pure deriver function that turns that
//     snapshot into a ReadinessSignal { level, reasons, blockers,
//     nextStep }.
//   • The top-level deriveReadiness composes those into a report
//     and surfaces a single highest-priority next step.
// =============================================================

import type { DocumentCategory } from "./walkthrough.js";

// ---- Public types ---------------------------------------------------------

export type ReadinessLevel = "low" | "medium" | "high";

export type ReadinessDomain = "visa" | "money" | "document" | "move";

export interface ReadinessSignal {
  level: ReadinessLevel;
  /**
   * Short, human-readable bullets describing WHY the level is what it is.
   * Always 1-3 items. Render as a small list under the level pill.
   */
  reasons: string[];
  /**
   * What's preventing the level from going up. Empty when level is "high".
   */
  blockers: string[];
  /**
   * The single most useful next action for this domain. Null when nothing
   * concrete is needed (e.g. visa freedom-of-movement → no next step).
   */
  nextStep: string | null;
}

export interface ReadinessReport {
  generatedAt: string;
  domains: Record<ReadinessDomain, ReadinessSignal>;
  /**
   * Highest-priority next step across all domains, used by dashboard
   * surfaces that only have room for one CTA. Null when everything is
   * "high" or nothing actionable is on file yet.
   */
  topPriority: { domain: ReadinessDomain; nextStep: string } | null;
}

// ---- Inputs ---------------------------------------------------------------

export interface ReadinessProfileInputs {
  destination?: string | null;
  citizenship?: string | null;
  purpose?: string | null;
  visa_role?: string | null;
  /**
   * Either a number, or a string like "45000 EUR" / "45 000 SEK". The deriver
   * extracts the numeric magnitude AND the currency token (when present).
   * Comparisons against `monthly_budget` only run when both magnitudes are
   * in the same currency — otherwise we down-grade to a partial signal
   * rather than fabricate a ratio.
   */
  savings_available?: number | string | null;
  /** Same shape conventions as `savings_available`. */
  monthly_budget?: number | string | null;
  /** Optional preferred currency hint from the profile. Used as a default
   *  when one of the amounts has no currency token. */
  preferred_currency?: string | null;
  arrival_date?: string | null;
  timeline?: string | null;
}

export interface ReadinessVisaInputs {
  /** True when visa research has been generated for this plan. */
  hasResearch: boolean;
  /** True when the user has picked a specific pathway from the research output. */
  pathwaySelected: boolean;
  /** True when the citizenship + destination combo is EU/EEA freedom of movement. */
  isFreeMovement: boolean;
  /** Application status if tracked: "not_started" | "submitted" | "approved" | "rejected". */
  applicationStatus?: string | null;
}

export interface ReadinessVaultInputs {
  /** Distinct categories that have at least one uploaded doc. */
  coveredCategories: DocumentCategory[];
  totalDocs: number;
}

export interface ReadinessTaskInputs {
  settlingTotal: number;
  settlingCompleted: number;
  settlingOverdue: number;
  preMoveTotal: number;
  preMoveCompleted: number;
  preMoveOverdue: number;
  /**
   * Union of every `requiredDocumentCategories` across tasks that aren't
   * yet completed. Drives the document-readiness comparison against
   * vault.coveredCategories.
   */
  requiredCategoriesAcrossOpenTasks: DocumentCategory[];
}

export interface ReadinessInputs {
  profile: ReadinessProfileInputs;
  visa: ReadinessVisaInputs;
  vault: ReadinessVaultInputs;
  tasks: ReadinessTaskInputs;
  /** "awaiting_collection" | "ready_for_pre_departure" | "pre_departure" | "arrived" | … */
  stage: string | null;
}

// ---- Derivers -------------------------------------------------------------

const REQUIRED_VISA_CATEGORIES: DocumentCategory[] = ["passport_id", "visa_permit"];

/**
 * Extract { amount, currency } from a number or a "45000 EUR"-style string.
 * Currency is best-effort: it picks up an ISO 4217 token (3 letters) or a
 * common symbol when present, otherwise null.
 *
 * Examples:
 *   45000             → { amount: 45000, currency: null }
 *   "45 000 SEK"      → { amount: 45000, currency: "SEK" }
 *   "$2,500"          → { amount: 2500,  currency: "USD" }
 *   "€1.500,00"       → { amount: 1500.00, currency: "EUR" }
 */
function parseAmount(
  v: number | string | null | undefined,
): { amount: number; currency: string | null } | null {
  if (v == null) return null;
  if (typeof v === "number") {
    return Number.isFinite(v) ? { amount: v, currency: null } : null;
  }
  const raw = v.trim();
  if (!raw) return null;
  // ISO 4217 token (e.g. "EUR", "SEK", "USD")
  const isoMatch = raw.match(/\b([A-Z]{3})\b/);
  let currency: string | null = isoMatch ? isoMatch[1] : null;
  if (!currency) {
    if (raw.includes("€")) currency = "EUR";
    else if (raw.includes("£")) currency = "GBP";
    else if (raw.includes("$")) currency = "USD";
    else if (/\bkr\b/i.test(raw)) currency = "SEK";
  }
  // Strip everything but digits, dot, comma, minus.
  const numericOnly = raw.replace(/[^\d.,-]/g, "");
  if (!numericOnly) return null;
  // Decide thousand-separator vs decimal: if both . and , appear, the LAST
  // one is the decimal separator.
  let normalised = numericOnly;
  if (normalised.includes(".") && normalised.includes(",")) {
    const lastDot = normalised.lastIndexOf(".");
    const lastComma = normalised.lastIndexOf(",");
    if (lastComma > lastDot) {
      // "1.500,00" → "1500.00"
      normalised = normalised.replace(/\./g, "").replace(",", ".");
    } else {
      // "1,500.00" → "1500.00"
      normalised = normalised.replace(/,/g, "");
    }
  } else if (normalised.includes(",") && !normalised.includes(".")) {
    // Ambiguous — treat comma as decimal if it's followed by 1-2 digits at end.
    if (/,\d{1,2}$/.test(normalised)) {
      normalised = normalised.replace(",", ".");
    } else {
      normalised = normalised.replace(/,/g, "");
    }
  }
  const n = Number(normalised);
  if (!Number.isFinite(n)) return null;
  return { amount: n, currency };
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

/**
 * Visa readiness — derived from visa research + pathway selection +
 * whether the canonical visa-related documents (passport, permit) are in
 * the vault. EU/EEA freedom of movement short-circuits to "high".
 */
export function deriveVisaReadiness(inputs: ReadinessInputs): ReadinessSignal {
  const { visa, profile, vault } = inputs;

  if (visa.isFreeMovement) {
    return {
      level: "high",
      reasons: ["EU/EEA freedom of movement — no visa needed for this destination"],
      blockers: [],
      nextStep: null,
    };
  }

  if (!profile.purpose && !visa.hasResearch) {
    return {
      level: "low",
      reasons: ["No purpose or visa research on file yet"],
      blockers: [
        "Pick what you're moving for (work, study, family, settle, digital nomad)",
        "Run visa research from your dashboard",
      ],
      nextStep: "Complete onboarding so we can suggest a visa pathway",
    };
  }

  if (!visa.hasResearch) {
    return {
      level: "low",
      reasons: ["Purpose set but no visa research yet"],
      blockers: ["Visa research hasn't been generated for this plan"],
      nextStep: "Run visa research from your dashboard",
    };
  }

  if (!visa.pathwaySelected) {
    return {
      level: "medium",
      reasons: [
        "Visa pathways researched but not yet selected",
      ],
      blockers: ["No specific pathway chosen — different pathways need different documents"],
      nextStep: "Open Visa & Legal and select a pathway",
    };
  }

  if (visa.applicationStatus === "rejected") {
    return {
      level: "low",
      reasons: ["Most recent application status: rejected"],
      blockers: ["Need to either re-file with stronger evidence or pick another pathway"],
      nextStep: "Open Visa & Legal to review what to do next",
    };
  }

  const covered = new Set(vault.coveredCategories);
  const missingVisaDocs = REQUIRED_VISA_CATEGORIES.filter((c) => !covered.has(c));

  if (missingVisaDocs.length > 0) {
    return {
      level: "medium",
      reasons: ["Pathway selected but core visa documents not yet in vault"],
      blockers: missingVisaDocs.map((c) =>
        c === "passport_id" ? "No passport / ID uploaded" : "No visa decision letter or permit uploaded",
      ),
      nextStep:
        missingVisaDocs[0] === "passport_id"
          ? "Upload your passport into the vault"
          : "Upload your visa decision letter / permit card",
    };
  }

  return {
    level: "high",
    reasons: [
      "Pathway selected and core visa documents on file",
    ],
    blockers: [],
    nextStep: visa.applicationStatus === "approved" ? null : "Check your application status",
  };
}

/**
 * Money readiness — savings vs. expected monthly budget, plus a check
 * that financial proof is in the vault when the active tasks ask for it.
 *
 * Buffer thresholds:
 *   • ≥ 6 × monthly = strong cushion → high
 *   • ≥ 3 × monthly = ok, with caveat if proof not uploaded
 *   • < 3 × monthly OR missing data = low
 */
export function deriveMoneyReadiness(inputs: ReadinessInputs): ReadinessSignal {
  const { profile, vault, tasks } = inputs;
  const savings = parseAmount(profile.savings_available);
  const monthly = parseAmount(profile.monthly_budget);

  // Resolve the currency for each side. If a side has no explicit currency
  // token, fall back to preferred_currency. We only compute a ratio when
  // BOTH sides are in the same resolved currency — otherwise we surface
  // the raw figures + a "currencies don't match" caveat.
  const fallbackCcy = profile.preferred_currency?.toUpperCase() ?? null;
  const savingsCcy = savings?.currency ?? fallbackCcy;
  const monthlyCcy = monthly?.currency ?? fallbackCcy;
  const sameCurrency =
    savings && monthly && savingsCcy && monthlyCcy && savingsCcy === monthlyCcy;
  const ratio =
    sameCurrency && monthly!.amount > 0 ? savings!.amount / monthly!.amount : null;

  const requiresFinancialProof = tasks.requiredCategoriesAcrossOpenTasks.includes("financial");
  const hasFinancialProof = vault.coveredCategories.includes("financial");

  if (!savings) {
    return {
      level: "low",
      reasons: ["No savings figure on file"],
      blockers: ["We can't gauge your buffer until savings_available is set"],
      nextStep: "Add your available savings in onboarding (Visa & Finance)",
    };
  }

  if (savings.amount === 0) {
    return {
      level: "low",
      reasons: ["Savings on file is 0"],
      blockers: [
        "No financial cushion for the typical 1-3 month onboarding period before payroll lands",
      ],
      nextStep: "Update savings_available or plan for a sponsor / advance from your employer",
    };
  }

  // Currencies don't agree → don't compute a ratio. Treat as Medium with a
  // clear reason rather than fabricating a number.
  if (savings && monthly && !sameCurrency) {
    const reasons: string[] = [
      `Savings (${savings.currency ?? "no currency"}) and monthly budget (${monthly.currency ?? "no currency"}) are in different currencies`,
    ];
    return {
      level: "medium",
      reasons,
      blockers: ["We can't compute a buffer ratio until both amounts are in the same currency"],
      nextStep:
        "Set preferred_currency in your profile, or restate savings + monthly budget in the same currency",
    };
  }

  if (ratio != null && ratio < 3) {
    return {
      level: "low",
      reasons: [`Savings cover ~${ratio.toFixed(1)} months at your target budget`],
      blockers: [
        "Most relocations need a 3-6 month cushion to bridge banking + payroll setup",
      ],
      nextStep: "Increase savings runway or lower your target monthly budget",
    };
  }

  if (requiresFinancialProof && !hasFinancialProof) {
    return {
      level: "medium",
      reasons:
        ratio != null
          ? [`Savings cover ~${ratio.toFixed(1)} months at your target budget`]
          : ["Savings on file"],
      blockers: ["Active tasks ask for financial proof but none is uploaded yet"],
      nextStep: "Upload a recent bank statement or sponsor letter into the vault",
    };
  }

  if (ratio != null && ratio < 6) {
    return {
      level: "medium",
      reasons: [`Savings cover ~${ratio.toFixed(1)} months at your target budget`],
      blockers: [
        "Cushion is OK but tight — surprises (deposit, fees, travel) can eat into it",
      ],
      nextStep: "Aim for a 6-month buffer if your destination has high deposit/move-in costs",
    };
  }

  // Either ratio ≥ 6 OR savings present without a monthly budget to compare to.
  return {
    level: ratio != null ? "high" : "medium",
    reasons: [
      ratio != null
        ? `Savings cover ${Math.floor(ratio)}+ months at your target budget`
        : "Savings logged but no monthly budget to compare against",
      ...(requiresFinancialProof && hasFinancialProof
        ? ["Financial proof uploaded for tasks that need it"]
        : []),
    ],
    blockers:
      ratio != null
        ? []
        : ["Set monthly_budget so we can compute your runway in months"],
    nextStep: ratio != null ? null : "Add monthly_budget to your profile",
  };
}

/**
 * Document readiness — what fraction of the categories required by
 * currently-open tasks is covered by the vault. When no task carries a
 * required-categories list yet (early in onboarding), defaults to medium
 * with a "nothing to gauge yet" reason.
 */
export function deriveDocumentReadiness(inputs: ReadinessInputs): ReadinessSignal {
  const { tasks, vault } = inputs;
  const required = new Set(tasks.requiredCategoriesAcrossOpenTasks);
  if (required.size === 0) {
    if (vault.totalDocs === 0) {
      return {
        level: "low",
        reasons: ["No documents in the vault yet"],
        blockers: ["Even before tasks ask, you'll need passport + visa basics"],
        nextStep: "Upload your passport into the vault to get started",
      };
    }
    return {
      level: "medium",
      reasons: ["Tasks haven't yet declared their document needs"],
      blockers: [],
      nextStep: "Generate your pre-move + settling-in plans to surface document requirements",
    };
  }

  const covered = new Set(vault.coveredCategories);
  const missing: DocumentCategory[] = [];
  let coveredCount = 0;
  for (const cat of required) {
    if (covered.has(cat)) coveredCount += 1;
    else missing.push(cat);
  }
  const coverage = coveredCount / required.size;
  const missingLabels = missing.map(humaniseCategory);

  if (coverage >= 0.8) {
    return {
      level: "high",
      reasons: [
        `${coveredCount} of ${required.size} required document categories covered`,
      ],
      blockers: [],
      nextStep: missing.length > 0 ? `Round it out: ${missingLabels.join(", ")}` : null,
    };
  }
  if (coverage >= 0.4) {
    return {
      level: "medium",
      reasons: [
        `${coveredCount} of ${required.size} required document categories covered`,
      ],
      blockers: missingLabels.length > 0 ? [`Still missing: ${missingLabels.join(", ")}`] : [],
      nextStep: missing.length > 0 ? `Upload ${humaniseCategory(missing[0])} next` : null,
    };
  }
  return {
    level: "low",
    reasons:
      vault.totalDocs === 0
        ? ["Vault is empty"]
        : [`Only ${coveredCount} of ${required.size} required categories covered`],
    blockers: [
      missingLabels.length > 0
        ? `Missing: ${missingLabels.join(", ")}`
        : "Vault has no relevant documents yet",
    ],
    nextStep:
      missing.length > 0
        ? `Start with ${humaniseCategory(missing[0])} — open the vault to upload`
        : "Open the vault and add your first document",
  };
}

/**
 * Move readiness — driven by which lifecycle stage the plan is in and
 * how far through the relevant task surface the user actually is.
 */
export function deriveMoveReadiness(inputs: ReadinessInputs): ReadinessSignal {
  const { profile, tasks, stage } = inputs;
  const arrivalDate = profile.arrival_date ? new Date(profile.arrival_date) : null;
  const arrivalKnown = Boolean(arrivalDate && !Number.isNaN(arrivalDate.getTime()));

  if (stage === "arrived") {
    const total = tasks.settlingTotal;
    const done = tasks.settlingCompleted;
    if (total === 0) {
      return {
        level: "medium",
        reasons: ["You're marked as arrived but settling-in tasks haven't been generated"],
        blockers: ["No settling-in DAG on file"],
        nextStep: "Confirm arrival again on the checklist to generate tasks",
      };
    }
    const ratio = pct(done, total);
    if (tasks.settlingOverdue > 0 && ratio < 0.7) {
      return {
        level: "low",
        reasons: [
          `${done} of ${total} settling-in tasks done`,
          `${tasks.settlingOverdue} overdue`,
        ],
        blockers: ["Overdue tasks accumulate fines or block dependent steps"],
        nextStep: "Open the checklist and clear overdue items first",
      };
    }
    if (ratio >= 0.7) {
      return {
        level: "high",
        reasons: [`${done} of ${total} settling-in tasks done`],
        blockers: [],
        nextStep: ratio < 1 ? "Wrap up the remaining items in the checklist" : null,
      };
    }
    return {
      level: "medium",
      reasons: [`${done} of ${total} settling-in tasks done`],
      blockers:
        tasks.settlingOverdue > 0
          ? [`${tasks.settlingOverdue} overdue items in your settling-in plan`]
          : [],
      nextStep: "Pick the highest-urgency task in your post-move checklist",
    };
  }

  if (stage === "pre_departure") {
    const total = tasks.preMoveTotal;
    const done = tasks.preMoveCompleted;
    if (!arrivalKnown) {
      return {
        level: "low",
        reasons: ["No arrival date on file"],
        blockers: ["Deadlines hang off the arrival date"],
        nextStep: "Set your move date in the profile",
      };
    }
    if (total === 0) {
      return {
        level: "medium",
        reasons: ["Pre-move plan not generated yet"],
        blockers: [],
        nextStep: "Generate your pre-move checklist",
      };
    }
    const ratio = pct(done, total);
    if (tasks.preMoveOverdue > 0) {
      return {
        level: "low",
        reasons: [
          `${done} of ${total} pre-move tasks done`,
          `${tasks.preMoveOverdue} overdue`,
        ],
        blockers: ["Overdue pre-move items can delay the move itself"],
        nextStep: "Clear the overdue items first — open the pre-move checklist",
      };
    }
    if (ratio >= 0.5) {
      return {
        level: "high",
        reasons: [`${done} of ${total} pre-move tasks done`],
        blockers: [],
        nextStep: ratio < 1 ? "Stay on top of remaining pre-move items" : null,
      };
    }
    return {
      level: "medium",
      reasons: [`${done} of ${total} pre-move tasks done`],
      blockers: [],
      nextStep: "Open the pre-move checklist and tackle the urgent items",
    };
  }

  if (stage === "ready_for_pre_departure" || stage === "complete") {
    return {
      level: "medium",
      reasons: ["Research complete — pre-move planning hasn't started"],
      blockers: ["Pre-move checklist not generated yet"],
      nextStep: "Generate your pre-move plan to start sequencing tasks",
    };
  }

  // Canonical early stages are "collecting" (onboarding intake) and
  // "generating" (research running). Anything else falls through here too.
  if (stage === "generating") {
    return {
      level: "low",
      reasons: ["Research is still running — your relocation plan isn't ready yet"],
      blockers: ["Visa research, pre-move plan, and settling-in plan haven't completed"],
      nextStep: "Wait for the research to finish, then refresh the dashboard",
    };
  }
  // collecting / null / unknown stage = onboarding intake phase.
  return {
    level: "low",
    reasons: ["You're still in the onboarding / intake phase"],
    blockers: ["No research results, no pre-move plan, no settling-in plan on file"],
    nextStep: "Finish onboarding so we can run visa research",
  };
}

// ---- Top-level composer ---------------------------------------------------

const PRIORITY_ORDER: ReadinessDomain[] = ["visa", "document", "money", "move"];

export function deriveReadiness(inputs: ReadinessInputs): ReadinessReport {
  const domains: Record<ReadinessDomain, ReadinessSignal> = {
    visa: deriveVisaReadiness(inputs),
    money: deriveMoneyReadiness(inputs),
    document: deriveDocumentReadiness(inputs),
    move: deriveMoveReadiness(inputs),
  };

  // Pick the single highest-priority next step. We surface the first
  // actionable one in fixed PRIORITY_ORDER, biased toward "low" levels.
  let topPriority: ReadinessReport["topPriority"] = null;
  const levelRank: Record<ReadinessLevel, number> = { low: 0, medium: 1, high: 2 };
  let bestRank = 99;
  for (const dom of PRIORITY_ORDER) {
    const sig = domains[dom];
    if (!sig.nextStep) continue;
    if (levelRank[sig.level] < bestRank) {
      bestRank = levelRank[sig.level];
      topPriority = { domain: dom, nextStep: sig.nextStep };
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    domains,
    topPriority,
  };
}

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

// ---- Free-movement detection ---------------------------------------------

const EU_EEA_NORMALISED = [
  "sweden",
  "germany",
  "france",
  "spain",
  "italy",
  "netherlands",
  "portugal",
  "finland",
  "denmark",
  "austria",
  "belgium",
  "ireland",
  "poland",
  "czech",
  "greece",
  "hungary",
  "romania",
  "bulgaria",
  "slovakia",
  "slovenia",
  "croatia",
  "estonia",
  "latvia",
  "lithuania",
  "cyprus",
  "malta",
  "luxembourg",
  "norway",
  "iceland",
  "liechtenstein",
];

const EU_EEA_CITIZENSHIPS = [
  "swedish",
  "german",
  "french",
  "spanish",
  "italian",
  "dutch",
  "portuguese",
  "finnish",
  "danish",
  "austrian",
  "belgian",
  "irish",
  "polish",
  "czech",
  "greek",
  "hungarian",
  "romanian",
  "bulgarian",
  "slovak",
  "slovenian",
  "croatian",
  "estonian",
  "latvian",
  "lithuanian",
  "cypriot",
  "maltese",
  "luxembourgish",
  "norwegian",
  "icelandic",
];

/**
 * Best-effort detection of EU/EEA freedom of movement based on
 * citizenship + destination strings. Caller is expected to pass the
 * profile values verbatim; we lower-case + substring-match.
 */
export function detectFreeMovement(
  citizenship: string | null | undefined,
  destination: string | null | undefined,
): boolean {
  if (!citizenship || !destination) return false;
  const c = citizenship.toLowerCase();
  const d = destination.toLowerCase();
  const isEUCitizen = EU_EEA_CITIZENSHIPS.some((n) => c.includes(n));
  const isEUDestination = EU_EEA_NORMALISED.some((n) => d.includes(n));
  return isEUCitizen && isEUDestination;
}
