// =============================================================
// @workspace/agents — Phase 6D rule-change monitoring
// =============================================================
// Authored-feed of recent rule changes + a per-user relevance engine.
// Given the user's plan state, returns the SUBSET of the feed that
// likely affects this plan, with computed impact + recommended action.
//
// Phase 6D explicit non-goals:
//   • No real-time crawler / global monitoring infrastructure.
//   • No legal-advice product.
//   • No diff-engine of arbitrary government pages.
//   • No "all news in the world" feed — only changes that actually
//     map to a profile dimension we model.
//   • No family / dependents impact.
//   • No tax-bracket changes (Phase 6C is orientation, not calculator).
//
// Architecture principle:
//   • The feed is hand-authored — added via PR. Adding a new entry
//     means updating RULE_CHANGE_FEED below.
//   • Each entry has a predicate-based scope. The relevance engine runs
//     each predicate against the user's profile + a small derived state
//     bag. If the predicate returns true, the entry surfaces with a
//     per-user impact-summary + recommendedAction.
//   • Per-user state (reviewed / dismissed / research-requested) is the
//     caller's responsibility — we expose helpers to merge ack-state
//     into the relevance results.
// =============================================================

// ---- Public types ---------------------------------------------------------

export type RuleChangeSourceKind =
  | "official_government"
  | "treaty"
  | "regulator_notice"
  | "implementation_decree";

export type RuleChangeAreaKind =
  | "visa_immigration"
  | "border_entry"
  | "pet_import"
  | "housing_market"
  | "tax_residency"
  | "social_security";

export type RuleChangeImpactSeverity = "info" | "review" | "action_required";

export type RuleChangeRecommendedActionKind =
  | "review_pathway"
  | "review_documents"
  | "rerun_research"
  | "confirm_official_source"
  | "monitor";

export interface RuleChangeRecommendedAction {
  kind: RuleChangeRecommendedActionKind;
  title: string;
  body: string;
  /** Optional SPA route for deep-link, when applicable. */
  targetRoute: string | null;
}

export interface RuleChangeSource {
  name: string;
  kind: RuleChangeSourceKind;
  /** Optional canonical URL — orientation only, never affiliate. */
  url?: string | null;
}

export type RuleChangeAckStatus =
  | "new"
  | "reviewed"
  | "dismissed"
  | "research_requested";

export interface RuleChangeAck {
  status: RuleChangeAckStatus;
  /** ISO timestamp of the most recent user action. */
  at: string;
}

export interface RuleChange {
  id: string;
  title: string;
  area: RuleChangeAreaKind;
  source: RuleChangeSource;
  /** When the change officially took effect (or is scheduled to). */
  changedAt: string;
  /** When this entry was published into the feed. */
  publishedAt: string;
  summary: string;
  shouldTriggerResearch: boolean;
}

/** Per-user computed view of a rule-change. */
export interface RuleChangeRelevant extends RuleChange {
  isRelevant: true;
  relevanceReasons: string[];
  impactSummary: string;
  impactSeverity: RuleChangeImpactSeverity;
  recommendedAction: RuleChangeRecommendedAction;
  ack: RuleChangeAck;
}

export interface RuleChangeReport {
  generatedAt: string;
  /** Just the entries that were judged relevant for this user. */
  relevant: RuleChangeRelevant[];
  /** Total feed size — useful for transparency in the UI. */
  totalFeed: number;
  /** Counts by ack-status, for the badge / summary. */
  counts: {
    new: number;
    reviewed: number;
    dismissed: number;
    researchRequested: number;
    actionRequired: number;
  };
}

// ---- Inputs ---------------------------------------------------------------

export interface RuleChangeProfileInputs {
  destination?: string | null;
  current_location?: string | null;
  citizenship?: string | null;
  purpose?: string | null;
  pets?: string | null;
  origin_lease_status?: string | null;
  bringing_vehicle?: string | null;
  posting_or_secondment?: string | null;
}

export interface RuleChangeVisaInputs {
  /** When the user has selected a pathway. Used to scope visa-route
   *  changes to people actually following that route. */
  selectedVisaType?: string | null;
}

export interface RuleChangeInputs {
  profile: RuleChangeProfileInputs;
  visa: RuleChangeVisaInputs;
  arrivalDate: string | null;
  stage: string | null;
  /** Per-rule-change ack state on file (id → RuleChangeAck). */
  acks: Record<string, RuleChangeAck>;
  /** Override clock for tests. */
  now?: Date;
}

// ---- Helpers --------------------------------------------------------------

function lower(v: string | null | undefined): string {
  return (v ?? "").toString().trim().toLowerCase();
}

function hasPets(p: RuleChangeProfileInputs | null | undefined): boolean {
  const v = lower(p?.pets);
  return v.length > 0 && v !== "none" && v !== "no";
}

const EU_COUNTRIES = new Set([
  "sweden", "germany", "france", "spain", "italy", "netherlands", "belgium",
  "austria", "denmark", "finland", "ireland", "portugal", "greece", "poland",
  "czech", "czechia", "slovakia", "hungary", "luxembourg", "estonia",
  "latvia", "lithuania", "slovenia", "croatia", "bulgaria", "romania",
  "malta", "cyprus",
]);
const SCHENGEN_PEERS = new Set([...EU_COUNTRIES, "iceland", "norway", "switzerland", "liechtenstein"]);

function destBucket(d: string | null | undefined): { eu: boolean; schengen: boolean; uk: boolean; usa: boolean; australia: boolean; raw: string | null } {
  const norm = lower(d);
  if (!norm) return { eu: false, schengen: false, uk: false, usa: false, australia: false, raw: null };
  return {
    eu: EU_COUNTRIES.has(norm),
    schengen: SCHENGEN_PEERS.has(norm),
    uk:
      norm === "united kingdom" || norm === "uk" || norm === "great britain" ||
      norm === "england" || norm === "scotland" || norm === "wales" || norm === "northern ireland",
    usa: norm === "united states" || norm === "usa" || norm === "us" || norm === "america",
    australia: norm === "australia",
    raw: norm,
  };
}

function isUSCitizen(c: string | null | undefined): boolean {
  const v = lower(c);
  return v === "us" || v === "usa" || v.includes("united states") || v.includes("american");
}

function isEUCitizen(c: string | null | undefined): boolean {
  // Crude — the citizenship field is free-form. We check for common
  // adjective forms of EU member-state nationalities.
  const v = lower(c);
  if (!v) return false;
  const adjs = [
    "swedish", "german", "french", "spanish", "italian", "dutch", "belgian",
    "austrian", "danish", "finnish", "irish", "portuguese", "greek", "polish",
    "czech", "slovak", "hungarian", "luxembourgish", "estonian", "latvian",
    "lithuanian", "slovenian", "croatian", "bulgarian", "romanian", "maltese",
    "cypriot",
  ];
  return adjs.some((a) => v.includes(a));
}

// ---- Authored feed --------------------------------------------------------

interface AuthoredRuleChange extends RuleChange {
  /** Predicate is run with the full inputs bag — true means "this user
   *  is in scope". */
  scope: (inputs: RuleChangeInputs) => boolean;
  /** How to compose the impact text + severity for an in-scope user. */
  impact: (inputs: RuleChangeInputs) => { reasons: string[]; summary: string; severity: RuleChangeImpactSeverity };
  /** Recommended action for an in-scope user. */
  action: (inputs: RuleChangeInputs) => RuleChangeRecommendedAction;
}

const RULE_CHANGE_FEED: AuthoredRuleChange[] = [
  // ---- 1. Schengen ETIAS go-live --------------------------------------------
  {
    id: "rc:schengen-etias",
    title: "Schengen ETIAS pre-travel authorisation rolling out",
    area: "border_entry",
    source: {
      name: "European Commission — ETIAS",
      kind: "official_government",
      url: "https://travel-europe.europa.eu/etias_en",
    },
    changedAt: "2026-01-15",
    publishedAt: "2026-01-20",
    summary:
      "Visa-exempt travellers heading to Schengen-area countries will need an ETIAS travel authorisation before boarding. The system is being rolled out by Member State; rules apply at the first Schengen entry.",
    shouldTriggerResearch: true,
    scope: (inputs) => {
      const d = destBucket(inputs.profile.destination);
      if (!d.schengen) return false;
      // EU citizens don't need ETIAS.
      if (isEUCitizen(inputs.profile.citizenship)) return false;
      // Anyone else who doesn't need a Schengen visa needs ETIAS — we
      // surface broadly because the citizenship field is free-form.
      return true;
    },
    impact: (inputs) => {
      const reasons: string[] = [
        `Your destination (${inputs.profile.destination}) is inside the Schengen area.`,
        `As a non-EU citizen, this likely applies the next time you cross the Schengen border.`,
      ];
      const arrivalSoon = inputs.arrivalDate
        ? Date.parse(inputs.arrivalDate) - Date.now() <= 90 * 24 * 60 * 60 * 1000
        : false;
      const severity: RuleChangeImpactSeverity = arrivalSoon ? "action_required" : "review";
      const summary = arrivalSoon
        ? "Your arrival is within ~90 days. Make sure your travel authorisation is on file before you board — without it, airlines can deny boarding."
        : "When you finalise travel dates, apply for ETIAS as part of pre-departure. Treat it as a passport-side prerequisite, not a visa.";
      return { reasons, summary, severity };
    },
    action: () => ({
      kind: "review_pathway",
      title: "Confirm ETIAS applicability before booking flights",
      body:
        "Re-check your visa pathway: even a multi-year residence permit doesn't always exempt you from a one-time ETIAS application. Most applications are processed in minutes; allow a few days as a buffer.",
      targetRoute: "/visa",
    }),
  },

  // ---- 2. UK eVisa migration -----------------------------------------------
  {
    id: "rc:uk-evisa-migration",
    title: "UK migration to eVisa — physical BRPs being phased out",
    area: "visa_immigration",
    source: {
      name: "UK Home Office — eVisa programme",
      kind: "official_government",
      url: "https://www.gov.uk/evisa",
    },
    changedAt: "2025-12-31",
    publishedAt: "2026-01-05",
    summary:
      "The UK is moving from physical Biometric Residence Permits (BRPs) to digital eVisas. Holders need to create a UKVI account and link it to their immigration status before BRP expiry.",
    shouldTriggerResearch: true,
    scope: (inputs) => {
      const d = destBucket(inputs.profile.destination);
      return d.uk;
    },
    impact: () => ({
      reasons: [
        "Your destination is the UK.",
        "Anyone holding a UK visa or arriving on one needs a UKVI account to access their immigration status.",
      ],
      summary:
        "Without a linked UKVI account, you may not be able to prove your immigration status to landlords, employers or border officers. Set this up before any move-in or hire decisions.",
      severity: "action_required",
    }),
    action: () => ({
      kind: "review_documents",
      title: "Create your UKVI account + link your status",
      body:
        "Open the GOV.UK eVisa setup flow with the email tied to your visa application. The link must be made BEFORE your BRP expires; later corrections require a separate process.",
      targetRoute: "/checklist?tab=pre-move",
    }),
  },

  // ---- 3. EU pet imports — high-risk-rabies country tightening -------------
  {
    id: "rc:eu-pet-rabies-tightening",
    title: "EU stricter rabies-titer enforcement for high-risk-country origins",
    area: "pet_import",
    source: {
      name: "EU DG SANTE — Pet movement",
      kind: "implementation_decree",
      url: "https://food.ec.europa.eu/animals/movement-pets",
    },
    changedAt: "2025-11-01",
    publishedAt: "2026-01-12",
    summary:
      "Some EU member states are stepping up enforcement of the rabies-titer requirement for pets arriving from non-listed (high-risk) origin countries — checks at border + non-compliant entries refused.",
    shouldTriggerResearch: true,
    scope: (inputs) => {
      const d = destBucket(inputs.profile.destination);
      return d.eu && hasPets(inputs.profile);
    },
    impact: (inputs) => {
      const origin = inputs.profile.current_location ?? "your origin";
      const reasons: string[] = [
        "You're moving with a pet.",
        `Your destination (${inputs.profile.destination}) is in the EU.`,
        `Confirm whether ${origin} is on the EU's listed-third-country list — if not, the rabies-titer cycle applies.`,
      ];
      return {
        reasons,
        summary:
          "If your origin isn't on the EU's listed-third-country list, the rabies-titer test cycle adds 30+ days to the timeline. Don't book the flight before verifying.",
        severity: "review",
      };
    },
    action: () => ({
      kind: "rerun_research",
      title: "Re-verify pet-import rules for your origin↔destination pair",
      body:
        "Re-check the current EU pet-import requirements with the destination's veterinary authority. Listed-third-country status changes occasionally; what was true a year ago may not hold.",
      targetRoute: "/dashboard",
    }),
  },

  // ---- 4. US CDC dog-import rules effective 2024 ----------------------------
  {
    id: "rc:us-cdc-dog-import",
    title: "US CDC dog-import rules — high-risk-country list + microchip + serology",
    area: "pet_import",
    source: {
      name: "US CDC — Bringing animals to the U.S.",
      kind: "official_government",
      url: "https://www.cdc.gov/importation",
    },
    changedAt: "2024-08-01",
    publishedAt: "2026-01-10",
    summary:
      "The CDC's revised dog-import rules require all dogs entering the US to have an ISO microchip + valid rabies serology if the origin is on the high-risk-rabies list. Non-compliant dogs are turned away at the border.",
    shouldTriggerResearch: true,
    scope: (inputs) => {
      const d = destBucket(inputs.profile.destination);
      const pets = lower(inputs.profile.pets);
      return d.usa && pets.includes("dog");
    },
    impact: () => ({
      reasons: [
        "You're moving a dog to the United States.",
        "The CDC keeps a high-risk-rabies-country list — origin status determines whether the serology+permit cycle applies.",
      ],
      summary:
        "If your origin is on the high-risk list, the CDC import permit + serology cycle can take months. Verify your origin's CDC status BEFORE booking.",
      severity: "action_required",
    }),
    action: () => ({
      kind: "rerun_research",
      title: "Verify CDC origin-country status + permit requirements",
      body:
        "Open the CDC Bringing Animals page and check whether your origin country is currently on the high-risk-rabies list. Don't rely on year-old guidance — the list updates.",
      targetRoute: "/dashboard",
    }),
  },

  // ---- 5. Sweden first-hand rental queue tightening -------------------------
  {
    id: "rc:sweden-rental-bostadsbrist",
    title: "Sweden — first-hand rental queues tightening in major metros",
    area: "housing_market",
    source: {
      name: "Boverket / Hyresgästföreningen reporting",
      kind: "regulator_notice",
      url: null,
    },
    changedAt: "2025-09-01",
    publishedAt: "2026-01-08",
    summary:
      "The Stockholm and Göteborg first-hand (förstahand) queues continue to lengthen; second-hand (andrahand) leases are increasingly the only practical short-term option for newcomers.",
    shouldTriggerResearch: false,
    scope: (inputs) => {
      const d = destBucket(inputs.profile.destination);
      return d.raw === "sweden";
    },
    impact: () => ({
      reasons: [
        "Your destination is Sweden.",
        "Most newcomers can't realistically use the first-hand queue for the first 6-12 months.",
      ],
      summary:
        "Plan for a second-hand (andrahand) lease as the realistic first-step. Verify the lease is sanctioned by the head landlord — unsanctioned sublets can end with eviction.",
      severity: "info",
    }),
    action: () => ({
      kind: "monitor",
      title: "Lean on second-hand listings for the first months",
      body:
        "Re-read the Phase 5A housing-support orientation — the search-source list is your starting set. Set listing alerts on the second-hand-friendly platforms.",
      targetRoute: "/dashboard",
    }),
  },

  // ---- 6. France Visale guarantor scheme update -----------------------------
  {
    id: "rc:france-visale-guarantor",
    title: "France — Visale guarantor scheme broadened to mid-career newcomers",
    area: "housing_market",
    source: {
      name: "Action Logement — Visale",
      kind: "implementation_decree",
      url: "https://www.visale.fr",
    },
    changedAt: "2025-10-15",
    publishedAt: "2026-01-15",
    summary:
      "Action Logement's Visale guarantor scheme has been broadened beyond the traditional under-30 category to cover mid-career arrivals on certain pathways — Visale acts as a free guarantor for landlords.",
    shouldTriggerResearch: false,
    scope: (inputs) => {
      const d = destBucket(inputs.profile.destination);
      return d.raw === "france";
    },
    impact: () => ({
      reasons: [
        "Your destination is France.",
        "The Visale guarantor scheme is one of the few ways to satisfy a French landlord without a French guarantor.",
      ],
      summary:
        "Apply for Visale BEFORE you start serious rental applications — landlords expect you to arrive with a guarantor lined up.",
      severity: "review",
    }),
    action: () => ({
      kind: "review_documents",
      title: "Apply for Visale before viewing apartments",
      body:
        "Visale applications take a few business days. Without a guarantor (Visale or French personal), most listings stop responding. Treat this as a pre-search step.",
      targetRoute: "/dashboard",
    }),
  },
];

// ---- Per-user impact engine ----------------------------------------------

function severityRank(s: RuleChangeImpactSeverity): number {
  if (s === "action_required") return 0;
  if (s === "review") return 1;
  return 2;
}

export function deriveRuleChanges(inputs: RuleChangeInputs): RuleChangeReport {
  const at = (inputs.now ?? new Date()).toISOString();
  const acks = inputs.acks ?? {};

  const relevant: RuleChangeRelevant[] = [];

  for (const entry of RULE_CHANGE_FEED) {
    const inScope = entry.scope(inputs);
    if (!inScope) continue;
    const { reasons, summary, severity } = entry.impact(inputs);
    const action = entry.action(inputs);
    const ack = acks[entry.id] ?? { status: "new" as RuleChangeAckStatus, at };
    const view: RuleChangeRelevant = {
      id: entry.id,
      title: entry.title,
      area: entry.area,
      source: entry.source,
      changedAt: entry.changedAt,
      publishedAt: entry.publishedAt,
      summary: entry.summary,
      shouldTriggerResearch: entry.shouldTriggerResearch,
      isRelevant: true,
      relevanceReasons: reasons,
      impactSummary: summary,
      impactSeverity: severity,
      recommendedAction: action,
      ack,
    };
    relevant.push(view);
  }

  // Sort: dismissed last, then severity, then changedAt desc, then id alpha.
  relevant.sort((a, b) => {
    const aDismissed = a.ack.status === "dismissed" ? 1 : 0;
    const bDismissed = b.ack.status === "dismissed" ? 1 : 0;
    if (aDismissed !== bDismissed) return aDismissed - bDismissed;
    const sr = severityRank(a.impactSeverity) - severityRank(b.impactSeverity);
    if (sr !== 0) return sr;
    if (a.changedAt !== b.changedAt) return b.changedAt.localeCompare(a.changedAt);
    return a.id.localeCompare(b.id);
  });

  let nNew = 0;
  let nReviewed = 0;
  let nDismissed = 0;
  let nResearch = 0;
  let nActionRequired = 0;
  for (const r of relevant) {
    switch (r.ack.status) {
      case "new":
        nNew += 1;
        break;
      case "reviewed":
        nReviewed += 1;
        break;
      case "dismissed":
        nDismissed += 1;
        break;
      case "research_requested":
        nResearch += 1;
        break;
    }
    if (r.ack.status !== "dismissed" && r.impactSeverity === "action_required") {
      nActionRequired += 1;
    }
  }

  return {
    generatedAt: at,
    relevant,
    totalFeed: RULE_CHANGE_FEED.length,
    counts: {
      new: nNew,
      reviewed: nReviewed,
      dismissed: nDismissed,
      researchRequested: nResearch,
      actionRequired: nActionRequired,
    },
  };
}

/**
 * Read the entire authored feed (no relevance filtering). Mostly useful
 * for tests + a hypothetical "see all" admin view; the user-facing UI
 * always goes through `deriveRuleChanges`.
 */
export function listAuthoredRuleChanges(): RuleChange[] {
  return RULE_CHANGE_FEED.map((e) => ({
    id: e.id,
    title: e.title,
    area: e.area,
    source: e.source,
    changedAt: e.changedAt,
    publishedAt: e.publishedAt,
    summary: e.summary,
    shouldTriggerResearch: e.shouldTriggerResearch,
  }));
}
