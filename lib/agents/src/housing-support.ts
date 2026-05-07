// =============================================================
// @workspace/agents — Phase 5A housing-support layer
// =============================================================
// Practical decision support for finding & securing housing in the
// destination. NOT a listings marketplace, NOT affiliate logic, NOT
// agent booking, NOT a lease-review engine.
//
// Five blocks:
//   1. Where to search (search-source categories with destination-
//      typical examples — orientation, not recommendations)
//   2. Price / budget expectations (compare user budget vs realistic
//      destination band)
//   3. Process (generic rental process the user can mentally walk)
//   4. Scam / risk warnings (universal red flags)
//   5. Timing (when to start; urgency derived from arrival_date)
//
// Phase 5A explicit non-goals:
//   • No live inventory.
//   • No partner/affiliate links.
//   • No housing-culture deep dive (that's 4D).
//   • No temporary-accommodation deep dive (that's a future slice).
//   • No employer/B2B housing.
// =============================================================

// ---- Public types ---------------------------------------------------------

export type SearchSourceCategory =
  | "national_aggregator"
  | "local_aggregator"
  | "tenant_union"
  | "expat_board"
  | "social_marketplace"
  | "agency_or_broker"
  | "student_specific"
  | "subletting";

export interface SearchGuidance {
  id: string;
  category: SearchSourceCategory;
  label: string;
  whyUseful: string;
  watchOuts: string;
  /** Destination-typical names — orientation only, no affiliate links. */
  examples: string[];
  applicability: "primary" | "secondary";
}

export type Currency = "EUR" | "USD" | "GBP" | "SEK" | "DKK" | "NOK" | "CHF" | "CAD" | "AUD";

export interface BudgetAmount {
  amount: number;
  currency: Currency;
}

export interface PriceBand {
  /** What kind of housing the band describes. */
  kind: "shared_room" | "studio" | "one_bed" | "two_bed";
  min: number;
  max: number;
  currency: Currency;
  /** Whether this is the destination's most-common search target. */
  primary: boolean;
}

export type BudgetVerdict =
  | "comfortable"
  | "tight"
  | "unrealistic"
  | "no_data"
  | "no_user_budget";

export interface PriceExpectations {
  hasUserBudget: boolean;
  userBudget: BudgetAmount | null;
  destination: string | null;
  /** Empty when destination is not in the lookup. */
  realisticBands: PriceBand[];
  /** EUR-equivalent of the user's budget for cross-currency comparison. */
  userBudgetEurEquivalent: number | null;
  budgetVerdict: BudgetVerdict;
  verdictReasoning: string[];
  notes: string[];
}

export interface ProcessStep {
  id: string;
  order: number;
  title: string;
  whatHappens: string;
  whatYouNeed: string[];
  commonBottleneck: string | null;
}

export type ScamSeverity = "high" | "medium";

export interface ScamWarning {
  id: string;
  severity: ScamSeverity;
  signal: string;
  whyDangerous: string;
  whatToDo: string;
}

export type TimingUrgency = "ahead" | "on_track" | "start_now" | "behind" | "post_arrival";

export interface TimingMilestone {
  weeksBefore: number;
  label: string;
}

export interface TimingGuidance {
  arrivalDate: string | null;
  weeksUntilArrival: number | null;
  /** What we'd recommend ideally — destination-typical lead time. */
  recommendedStartWeeksBefore: number;
  urgency: TimingUrgency;
  /** One sentence; renderable as the headline of the timing block. */
  message: string;
  milestones: TimingMilestone[];
  /** Practical takeaway given the current state — single line. */
  nextStep: string;
}

export interface HousingSupportReport {
  generatedAt: string;
  destination: string | null;
  targetCity: string | null;
  searchGuidance: SearchGuidance[];
  priceExpectations: PriceExpectations;
  processSteps: ProcessStep[];
  scamWarnings: ScamWarning[];
  timingGuidance: TimingGuidance;
}

// ---- Inputs ---------------------------------------------------------------

export interface HousingProfileInputs {
  destination?: string | null;
  target_city?: string | null;
  citizenship?: string | null;
  monthly_budget?: string | null;
  rental_budget_max?: string | null;
  furnished_preference?: string | null;
  children_count?: number | string | null;
  pets?: string | null;
  home_purchase_intent?: string | null;
}

export interface HousingSupportInputs {
  profile: HousingProfileInputs;
  arrivalDate: string | null;
  stage: string | null;
}

// ---- Destination data -----------------------------------------------------

interface DestinationProfile {
  /** Lowercased country name keys. */
  country: string;
  /** Typical lead time before move-in — weeks. */
  recommendedStartWeeksBefore: number;
  /** Realistic 1-bed-equivalent capital-city rental band, EUR/month. */
  bands: PriceBand[];
  /** Destination-typical search-source examples by category. */
  examples: Partial<Record<SearchSourceCategory, string[]>>;
  /** Notes that should appear in priceExpectations.notes for this market. */
  marketNotes: string[];
  /** Bottlenecks specific to the destination's rental process. */
  processBottlenecks: Partial<Record<string, string>>;
}

const DESTINATIONS: DestinationProfile[] = [
  {
    country: "sweden",
    recommendedStartWeeksBefore: 10,
    bands: [
      { kind: "shared_room", min: 600, max: 950, currency: "EUR", primary: false },
      { kind: "studio", min: 950, max: 1500, currency: "EUR", primary: false },
      { kind: "one_bed", min: 1300, max: 2000, currency: "EUR", primary: true },
      { kind: "two_bed", min: 1700, max: 2800, currency: "EUR", primary: false },
    ],
    examples: {
      national_aggregator: ["Hemnet", "Blocket Bostad", "Qasa", "BostadDirekt"],
      local_aggregator: ["Bostadsförmedlingen (Stockholm)"],
      tenant_union: ["Hyresgästföreningen"],
      social_marketplace: ["Facebook groups (`Bostad i Stockholm`, etc.)"],
      subletting: ["Qasa", "Blocket Bostad (Andrahand)"],
      student_specific: ["SSSB (Stockholm)", "Studentbostäder.se"],
    },
    marketNotes: [
      "First-hand contracts are queue-based and rarely available short-term — most newcomers use second-hand (`andrahand`) leases.",
      "Stockholm/Göteborg/Malmö are the most competitive markets; secondary cities are easier.",
    ],
    processBottlenecks: {
      "search-and-shortlist": "First-hand queues take years; budget for second-hand from day one.",
      "background-check": "Landlords usually require employment + Swedish personnummer; a guarantor sometimes substitutes.",
    },
  },
  {
    country: "germany",
    recommendedStartWeeksBefore: 8,
    bands: [
      { kind: "shared_room", min: 450, max: 750, currency: "EUR", primary: false },
      { kind: "studio", min: 800, max: 1300, currency: "EUR", primary: false },
      { kind: "one_bed", min: 1100, max: 1800, currency: "EUR", primary: true },
      { kind: "two_bed", min: 1400, max: 2500, currency: "EUR", primary: false },
    ],
    examples: {
      national_aggregator: ["ImmobilienScout24", "Immowelt", "Kleinanzeigen Wohnen"],
      local_aggregator: ["WG-Gesucht (shared)", "Immobilien.de"],
      tenant_union: ["Deutscher Mieterbund"],
      social_marketplace: ["Facebook groups", "expat-focused subreddits"],
      subletting: ["WG-Gesucht (Zwischenmiete)"],
      agency_or_broker: ["Maklerwohnungen — Bestellerprinzip means landlord pays"],
    },
    marketNotes: [
      "SCHUFA report (credit check) is usually required — order one early.",
      "Anmeldung (address registration) requires a signed Wohnungsgeberbestätigung from the landlord.",
    ],
    processBottlenecks: {
      "background-check": "SCHUFA + last 3 payslips + Mietschuldenfreiheitsbescheinigung is the standard packet.",
      "contract-signing": "Wohnungsgeberbestätigung is mandatory for Anmeldung — confirm landlord will sign one.",
    },
  },
  {
    country: "netherlands",
    recommendedStartWeeksBefore: 8,
    bands: [
      { kind: "shared_room", min: 600, max: 900, currency: "EUR", primary: false },
      { kind: "studio", min: 1100, max: 1700, currency: "EUR", primary: false },
      { kind: "one_bed", min: 1500, max: 2300, currency: "EUR", primary: true },
      { kind: "two_bed", min: 1900, max: 3000, currency: "EUR", primary: false },
    ],
    examples: {
      national_aggregator: ["Funda Huur", "Pararius", "Kamernet"],
      local_aggregator: ["HousingAnywhere (mid-term)"],
      tenant_union: ["!WOON (Amsterdam)", "Huurteam"],
      social_marketplace: ["Facebook groups"],
      agency_or_broker: ["Erkende Verhuur Makelaar — registered agencies"],
      student_specific: ["DUWO", "SSH"],
    },
    marketNotes: [
      "Many landlords charge unlawful agency fees for tenants — illegal under Dutch law since 2015.",
      "Rent-controlled (`sociale huur`) housing is queue-based; most newcomers use the free sector.",
    ],
    processBottlenecks: {
      "search-and-shortlist": "Listings disappear within hours in Amsterdam/Utrecht — set alerts immediately.",
    },
  },
  {
    country: "france",
    recommendedStartWeeksBefore: 8,
    bands: [
      { kind: "shared_room", min: 500, max: 850, currency: "EUR", primary: false },
      { kind: "studio", min: 800, max: 1400, currency: "EUR", primary: false },
      { kind: "one_bed", min: 1100, max: 2000, currency: "EUR", primary: true },
      { kind: "two_bed", min: 1500, max: 2800, currency: "EUR", primary: false },
    ],
    examples: {
      national_aggregator: ["SeLoger", "Leboncoin Immobilier", "PAP.fr"],
      local_aggregator: ["Bien'ici"],
      agency_or_broker: ["Foncia, Century 21 — agency fees apply"],
      student_specific: ["CROUS", "Studapart"],
      tenant_union: ["ADIL (free legal advice)"],
    },
    marketNotes: [
      "A French guarantor (`garant`) or Visale is usually required — start the Visale application before searching.",
      "Dossier de location: payslips, ID, tax notice, employment contract — assemble in advance.",
    ],
    processBottlenecks: {
      "background-check": "Visale guarantor scheme is free for under-30 / new-arrivals — apply ahead of search.",
    },
  },
  {
    country: "spain",
    recommendedStartWeeksBefore: 6,
    bands: [
      { kind: "shared_room", min: 400, max: 700, currency: "EUR", primary: false },
      { kind: "studio", min: 700, max: 1200, currency: "EUR", primary: false },
      { kind: "one_bed", min: 950, max: 1700, currency: "EUR", primary: true },
      { kind: "two_bed", min: 1200, max: 2200, currency: "EUR", primary: false },
    ],
    examples: {
      national_aggregator: ["Idealista", "Fotocasa", "Habitaclia"],
      agency_or_broker: ["Neighbourhood inmobiliarias"],
      social_marketplace: ["Facebook groups (Pisos compartidos)"],
      tenant_union: ["Sindicato de Inquilinos"],
    },
    marketNotes: [
      "NIE is usually required to sign a lease — start NIE/empadronamiento before serious viewings.",
      "Madrid/Barcelona are tightening; secondary cities (Valencia, Sevilla, Bilbao) more relaxed.",
    ],
    processBottlenecks: {},
  },
  {
    country: "united kingdom",
    recommendedStartWeeksBefore: 6,
    bands: [
      { kind: "shared_room", min: 700, max: 1100, currency: "EUR", primary: false },
      { kind: "studio", min: 1100, max: 1800, currency: "EUR", primary: false },
      { kind: "one_bed", min: 1500, max: 2500, currency: "EUR", primary: true },
      { kind: "two_bed", min: 2000, max: 3500, currency: "EUR", primary: false },
    ],
    examples: {
      national_aggregator: ["Rightmove", "Zoopla", "OpenRent", "SpareRoom (shared)"],
      agency_or_broker: ["High-street letting agents"],
      tenant_union: ["Shelter (advice + advocacy)", "Citizens Advice"],
    },
    marketNotes: [
      "Right-to-Rent immigration check is mandatory — landlord will request your visa/BRP.",
      "Holding deposits are capped at 1 week's rent; security deposits at 5 weeks (England).",
    ],
    processBottlenecks: {
      "background-check": "Right-to-Rent + UK guarantor or 6 months' rent up-front is the typical ask for newcomers.",
    },
  },
  {
    country: "ireland",
    recommendedStartWeeksBefore: 8,
    bands: [
      { kind: "shared_room", min: 800, max: 1200, currency: "EUR", primary: false },
      { kind: "studio", min: 1400, max: 2000, currency: "EUR", primary: false },
      { kind: "one_bed", min: 1800, max: 2600, currency: "EUR", primary: true },
      { kind: "two_bed", min: 2200, max: 3500, currency: "EUR", primary: false },
    ],
    examples: {
      national_aggregator: ["Daft.ie", "MyHome.ie", "Rent.ie"],
      tenant_union: ["Threshold (advice + advocacy)"],
      social_marketplace: ["Facebook groups (Dublin Rent Pals etc.)"],
    },
    marketNotes: [
      "Dublin is one of Europe's tightest markets — listings get hundreds of viewing requests within hours.",
      "Rent Pressure Zones cap annual increases; check whether your area is one.",
    ],
    processBottlenecks: {
      "search-and-shortlist": "Schedule viewings the moment a listing appears — slots fill within the day.",
    },
  },
  {
    country: "denmark",
    recommendedStartWeeksBefore: 8,
    bands: [
      { kind: "shared_room", min: 550, max: 900, currency: "EUR", primary: false },
      { kind: "studio", min: 1100, max: 1600, currency: "EUR", primary: false },
      { kind: "one_bed", min: 1400, max: 2100, currency: "EUR", primary: true },
      { kind: "two_bed", min: 1700, max: 2700, currency: "EUR", primary: false },
    ],
    examples: {
      national_aggregator: ["BoligPortal", "DBA Bolig", "Lejebolig.dk"],
      tenant_union: ["LLO (Lejernes Landsorganisation)"],
      student_specific: ["KKIK (Copenhagen)"],
    },
    marketNotes: [
      "Many leases require a 3-month deposit + 3 months prepaid rent — budget 6× monthly rent for upfront cost.",
      "First-hand municipal housing is queue-based; most newcomers use private market.",
    ],
    processBottlenecks: {},
  },
];

function lookupDestination(input: string | null | undefined): DestinationProfile | null {
  if (!input) return null;
  const norm = input.trim().toLowerCase();
  if (!norm) return null;
  const aliases: Record<string, string> = {
    uk: "united kingdom",
    "great britain": "united kingdom",
    england: "united kingdom",
    holland: "netherlands",
    nl: "netherlands",
    "the netherlands": "netherlands",
    deutschland: "germany",
    de: "germany",
    espana: "spain",
    españa: "spain",
    sverige: "sweden",
    se: "sweden",
    danmark: "denmark",
    dk: "denmark",
    eire: "ireland",
    ie: "ireland",
    fr: "france",
    es: "spain",
  };
  const key = aliases[norm] ?? norm;
  return DESTINATIONS.find((d) => d.country === key) ?? null;
}

// Cross-currency conversion ratios → EUR (rough orientation; updated rarely).
// These are intentionally coarse — we only use them to detect "obviously
// unrealistic" budgets, not to quote precise rents.
const TO_EUR: Record<Currency, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  SEK: 0.087,
  DKK: 0.134,
  NOK: 0.086,
  CHF: 1.04,
  CAD: 0.68,
  AUD: 0.61,
};

function parseBudget(raw: string | null | undefined): BudgetAmount | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Accept "2500 EUR", "EUR 2500", "$2500", "2,500 SEK", "1500".
  const numMatch = trimmed.match(/[\d.,]+/);
  if (!numMatch) return null;
  const amount = Number.parseFloat(numMatch[0].replace(/[,_]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const upper = trimmed.toUpperCase();
  const symbolMap: Record<string, Currency> = {
    "€": "EUR",
    "$": "USD",
    "£": "GBP",
    KR: "SEK",
  };
  let currency: Currency = "EUR";
  for (const code of ["EUR", "USD", "GBP", "SEK", "DKK", "NOK", "CHF", "CAD", "AUD"] as Currency[]) {
    if (upper.includes(code)) {
      currency = code;
      return { amount, currency };
    }
  }
  for (const sym of Object.keys(symbolMap)) {
    if (trimmed.includes(sym)) {
      currency = symbolMap[sym];
      return { amount, currency };
    }
  }
  return { amount, currency };
}

// ---- Search guidance ------------------------------------------------------

const GENERIC_GUIDANCE: SearchGuidance[] = [
  {
    id: "search:national-aggregator",
    category: "national_aggregator",
    label: "National rental aggregators",
    whyUseful: "Largest pool of listings, easy to filter by city, budget, size.",
    watchOuts: "Mix of agency + private listings; quality varies — verify the landlord, not the platform.",
    examples: ["Search the destination's largest rental aggregator (varies by country)."],
    applicability: "primary",
  },
  {
    id: "search:tenant-union",
    category: "tenant_union",
    label: "Tenant-rights unions / advice services",
    whyUseful: "Free or low-cost advice on contracts, deposit norms, illegal clauses.",
    watchOuts: "Most are local — use early to understand legal floor before signing anything.",
    examples: ["Look up the country's national tenant union or rent-advice non-profit."],
    applicability: "primary",
  },
  {
    id: "search:expat-board",
    category: "expat_board",
    label: "Expat / newcomer-focused communities",
    whyUseful: "Real anecdata about neighborhoods, landlord patterns, scams in the destination.",
    watchOuts: "Treat individual stories as data points, not policy. Bias toward English speakers.",
    examples: ["Subreddits, Facebook groups, Slack workspaces for newcomers in your destination."],
    applicability: "secondary",
  },
  {
    id: "search:subletting",
    category: "subletting",
    label: "Subletting / short-to-mid-term platforms",
    whyUseful: "Bridges the gap between arrival and a permanent lease — common 1–6-month rentals.",
    watchOuts: "Higher per-month price; verify whether the head landlord allows the sublet.",
    examples: ["Platforms that specialise in 1–6-month furnished stays for newcomers."],
    applicability: "secondary",
  },
];

const STUDENT_TOPIC: SearchGuidance = {
  id: "search:student-specific",
  category: "student_specific",
  label: "Student housing services",
  whyUseful: "Cheaper, semester-aligned, often closer to campus.",
  watchOuts: "Eligibility depends on your enrolment status; queues exist in tight markets.",
  examples: ["Your university's housing office is the canonical first stop."],
  applicability: "primary",
};

function buildSearchGuidance(
  destProfile: DestinationProfile | null,
  isStudent: boolean,
): SearchGuidance[] {
  const out: SearchGuidance[] = [];
  for (const g of GENERIC_GUIDANCE) {
    const examples =
      destProfile && destProfile.examples[g.category]
        ? destProfile.examples[g.category]!
        : g.examples;
    out.push({ ...g, examples });
  }
  // Local-aggregator card if the destination has one distinct from the
  // national one (e.g. Bostadsförmedlingen in Stockholm).
  if (destProfile && destProfile.examples.local_aggregator) {
    out.push({
      id: "search:local-aggregator",
      category: "local_aggregator",
      label: "City- or region-specific aggregators",
      whyUseful: "Captures listings the national platforms miss; often municipal.",
      watchOuts: "Some require local registration / a national ID before you can apply.",
      examples: destProfile.examples.local_aggregator,
      applicability: "secondary",
    });
  }
  // Agency block if relevant.
  if (destProfile && destProfile.examples.agency_or_broker) {
    out.push({
      id: "search:agency-broker",
      category: "agency_or_broker",
      label: "Letting agents / brokers",
      whyUseful: "More hand-holding, viewings batched, often the only path to certain inventory.",
      watchOuts:
        "Fee responsibility varies by country — confirm before signing anything that you owe nothing illegal.",
      examples: destProfile.examples.agency_or_broker,
      applicability: "secondary",
    });
  }
  if (isStudent) {
    const examples =
      destProfile && destProfile.examples.student_specific
        ? destProfile.examples.student_specific
        : STUDENT_TOPIC.examples;
    out.unshift({ ...STUDENT_TOPIC, examples });
  }
  return out;
}

// ---- Price expectations ---------------------------------------------------

function buildPriceExpectations(
  inputs: HousingSupportInputs,
  destProfile: DestinationProfile | null,
): PriceExpectations {
  const userBudget =
    parseBudget(inputs.profile.rental_budget_max ?? null) ??
    parseBudget(inputs.profile.monthly_budget ?? null);
  const userBudgetEur = userBudget ? userBudget.amount * TO_EUR[userBudget.currency] : null;

  const bands = destProfile?.bands ?? [];
  const notes: string[] = [];
  notes.push("Ranges are rough orientation, not quotes — actual rent depends on neighborhood, condition and timing.");
  if (destProfile) {
    notes.push(...destProfile.marketNotes);
  } else if (inputs.profile.destination) {
    notes.push("We don't have a price band for this destination yet — use the search-source list to triangulate from real listings.");
  }

  let verdict: BudgetVerdict = "no_data";
  const reasoning: string[] = [];

  if (!userBudget) {
    verdict = "no_user_budget";
    reasoning.push("Add a monthly budget in your profile to get a budget reasonableness check.");
  } else if (bands.length === 0) {
    verdict = "no_data";
    reasoning.push(
      `Got your budget (${userBudget.amount} ${userBudget.currency}) but no destination band on file — we can't yet say if it's realistic.`,
    );
  } else {
    const primary = bands.find((b) => b.primary) ?? bands[1] ?? bands[0];
    const eur = userBudgetEur!;
    const destName = destProfile?.country ?? "the destination";
    if (eur < primary.min * 0.7) {
      verdict = "unrealistic";
      reasoning.push(
        `Your budget (~€${Math.round(eur)}) is well below the typical ${primary.kind.replace("_", " ")} range of €${primary.min}-${primary.max} in ${destName}.`,
      );
      reasoning.push("Realistic options: shared rooms, secondary cities, or revisit the budget.");
    } else if (eur < primary.min) {
      verdict = "tight";
      reasoning.push(
        `Your budget (~€${Math.round(eur)}) is just under the typical ${primary.kind.replace("_", " ")} range of €${primary.min}-${primary.max}.`,
      );
      reasoning.push("Doable, but expect to compromise on neighbourhood, size, or furnishing.");
    } else if (eur <= primary.max) {
      verdict = "comfortable";
      reasoning.push(
        `Your budget (~€${Math.round(eur)}) sits inside the typical ${primary.kind.replace("_", " ")} range of €${primary.min}-${primary.max}.`,
      );
    } else {
      verdict = "comfortable";
      reasoning.push(
        `Your budget (~€${Math.round(eur)}) is above the typical ${primary.kind.replace("_", " ")} range — you have room to choose by neighbourhood / quality rather than price.`,
      );
    }
  }

  return {
    hasUserBudget: userBudget !== null,
    userBudget,
    destination: destProfile?.country ?? inputs.profile.destination ?? null,
    realisticBands: bands,
    userBudgetEurEquivalent: userBudgetEur ? Math.round(userBudgetEur) : null,
    budgetVerdict: verdict,
    verdictReasoning: reasoning,
    notes,
  };
}

// ---- Process steps --------------------------------------------------------

function buildProcessSteps(destProfile: DestinationProfile | null): ProcessStep[] {
  const base: ProcessStep[] = [
    {
      id: "search-and-shortlist",
      order: 0,
      title: "Search + shortlist",
      whatHappens: "Set alerts on the main aggregators, screen ~10-30 listings, request viewings on 5-8.",
      whatYouNeed: ["A short bio in the local language if possible", "Budget + commute boundaries", "Move-in date window"],
      commonBottleneck: "Listings disappear within hours in tight markets — react the day they appear, not the week.",
    },
    {
      id: "viewings",
      order: 1,
      title: "Viewings",
      whatHappens: "Visit 3-6 places (or join virtual tours). Photograph defects, ask about utilities and deposit terms.",
      whatYouNeed: ["A short list of questions", "Camera/phone for photos", "Decision criteria you've pre-agreed with anyone moving with you"],
      commonBottleneck: "Skipping a viewing because a landlord insists is the most common scam pattern — don't skip.",
    },
    {
      id: "background-check",
      order: 2,
      title: "Application + background check",
      whatHappens: "Landlord runs an ID + income check; many countries require a guarantor or proof of funds.",
      whatYouNeed: ["Passport / residence document", "Last 3 months of payslips or proof of funds", "Employer letter or contract"],
      commonBottleneck: "Newcomers without local credit history need a guarantor, larger deposit, or rent-up-front.",
    },
    {
      id: "contract-signing",
      order: 3,
      title: "Contract signing",
      whatHappens: "Read the lease end-to-end before signing. Confirm length, notice period, who pays utilities, what's furnished.",
      whatYouNeed: ["Photo ID", "Bank account or proof you'll get one", "Time — never sign on first viewing"],
      commonBottleneck: "Verbal promises that aren't in the written contract are not enforceable later.",
    },
    {
      id: "deposit-and-payment",
      order: 4,
      title: "Deposit + first payment",
      whatHappens: "Deposit is held in escrow or in a designated account in many EU countries — confirm where it sits.",
      whatYouNeed: ["Bank wire access", "Written receipt with both parties' names + property address"],
      commonBottleneck: "Wiring a deposit before signing or before viewing is the highest-loss scam pattern.",
    },
    {
      id: "move-in-inspection",
      order: 5,
      title: "Move-in inspection",
      whatHappens: "Walk through the property with the landlord. Document every defect with photos and a signed handover protocol.",
      whatYouNeed: ["Camera", "A printed inspection checklist", "The landlord's signature on the protocol"],
      commonBottleneck: "Pre-existing damage you don't document gets billed to you on move-out.",
    },
  ];
  if (destProfile) {
    return base.map((s) => {
      const override = destProfile.processBottlenecks[s.id];
      return override ? { ...s, commonBottleneck: override } : s;
    });
  }
  return base;
}

// ---- Scam warnings --------------------------------------------------------

const SCAM_WARNINGS: ScamWarning[] = [
  {
    id: "scam:no-viewing",
    severity: "high",
    signal: "Landlord refuses an in-person or live video viewing.",
    whyDangerous: "The single strongest predictor of a fake listing — there is no real apartment behind it.",
    whatToDo: "Walk away. No viewing = no signature, no deposit, no payment.",
  },
  {
    id: "scam:owner-abroad",
    severity: "high",
    signal: "Owner is `currently abroad` and asks you to wire the deposit before meeting.",
    whyDangerous: "Classic absentee-owner scam. Money goes; keys never arrive.",
    whatToDo: "Insist on meeting (in person or video) before any payment, and verify identity against ID.",
  },
  {
    id: "scam:price-too-low",
    severity: "high",
    signal: "Price is well below the destination's typical range for that size and neighborhood.",
    whyDangerous: "Bait-and-switch: the listing is fake, or the apartment isn't what was advertised.",
    whatToDo: "Sanity-check the price against your destination's realistic band before responding.",
  },
  {
    id: "scam:wire-pressure",
    severity: "high",
    signal: "Pressure to wire money via Western Union, crypto, or to an account whose name doesn't match the listed owner.",
    whyDangerous: "Untraceable rails, mismatched recipient = irrecoverable funds.",
    whatToDo: "Pay only after a written contract, to an account whose name matches the contract counterparty.",
  },
  {
    id: "scam:duplicate-listing",
    severity: "medium",
    signal: "The listing photos appear on multiple sites with different prices, owners or addresses.",
    whyDangerous: "Photo theft is a common fake-listing vector — the apartment may not exist or may not be theirs to rent.",
    whatToDo: "Reverse-image-search the photos before contacting the lister.",
  },
  {
    id: "scam:cash-only",
    severity: "medium",
    signal: "Owner insists on cash for the deposit, or refuses to provide a written receipt.",
    whyDangerous: "Leaves you with no proof you ever paid — and no path to recover the deposit on move-out.",
    whatToDo: "Wire to a verifiable account; demand a signed receipt naming the property + amount.",
  },
];

// ---- Timing ---------------------------------------------------------------

function buildTiming(
  inputs: HousingSupportInputs,
  destProfile: DestinationProfile | null,
): TimingGuidance {
  const recommended = destProfile?.recommendedStartWeeksBefore ?? 8;
  const arrival = inputs.arrivalDate;
  let weeks: number | null = null;
  if (arrival) {
    const arrivalMs = Date.parse(arrival);
    if (Number.isFinite(arrivalMs)) {
      weeks = Math.round((arrivalMs - Date.now()) / (7 * 24 * 60 * 60 * 1000));
    }
  }

  let urgency: TimingUrgency = "on_track";
  let message = `Most people start ${recommended} weeks before move-in. You haven't set an arrival yet — set one to get a personalised timing call.`;
  let nextStep = "Set your arrival date in the profile.";

  if (weeks !== null) {
    if (weeks < 0) {
      urgency = "post_arrival";
      message = "You've already arrived. If housing isn't sorted, focus on a 1–3 month furnished sublet while you search.";
      nextStep = "Look at short-to-mid-term sublet platforms first; permanent search runs in parallel.";
    } else if (weeks > recommended + 4) {
      urgency = "ahead";
      message = `You have ~${weeks} weeks until arrival — ahead of the typical ${recommended}-week curve.`;
      nextStep = "Start scoping budget and neighborhoods now; serious applications closer to arrival.";
    } else if (weeks >= recommended) {
      urgency = "on_track";
      message = `You have ~${weeks} weeks until arrival — right inside the typical ${recommended}-week curve.`;
      nextStep = "Set listing alerts on the main aggregators this week.";
    } else if (weeks >= 3) {
      urgency = "start_now";
      message = `Only ~${weeks} weeks until arrival — below the typical ${recommended}-week curve. Start applying now.`;
      nextStep = "Apply to listings the day they appear, and line up a 1-month sublet as a fallback.";
    } else {
      urgency = "behind";
      message = `Only ~${weeks} weeks until arrival — behind the typical curve. Mid-term sublet first, permanent search after landing.`;
      nextStep = "Book a 1–3 month sublet now to give yourself a base; permanent search continues post-arrival.";
    }
  }

  const milestones: TimingMilestone[] = [
    { weeksBefore: recommended + 4, label: "Scope budget + neighbourhoods" },
    { weeksBefore: recommended, label: "Set listing alerts; start serious applications" },
    { weeksBefore: Math.max(2, recommended - 4), label: "Viewings + shortlist" },
    { weeksBefore: 1, label: "Sign + arrange move-in inspection" },
  ];

  return {
    arrivalDate: arrival,
    weeksUntilArrival: weeks,
    recommendedStartWeeksBefore: recommended,
    urgency,
    message,
    milestones,
    nextStep,
  };
}

// ---- Composer -------------------------------------------------------------

function isStudentPurpose(_inputs: HousingSupportInputs): boolean {
  // Phase 5A scope: student-specific guidance is surfaced if the profile
  // mentions a study purpose. Conservative — we don't want to misclassify.
  // (Caller passes purpose via profile if needed.)
  return false;
}

export function deriveHousingSupport(inputs: HousingSupportInputs): HousingSupportReport {
  const destProfile = lookupDestination(inputs.profile.destination ?? null);
  const searchGuidance = buildSearchGuidance(destProfile, isStudentPurpose(inputs));
  const priceExpectations = buildPriceExpectations(inputs, destProfile);
  const processSteps = buildProcessSteps(destProfile);
  const scamWarnings = SCAM_WARNINGS.slice();
  const timingGuidance = buildTiming(inputs, destProfile);

  return {
    generatedAt: new Date().toISOString(),
    destination: destProfile?.country ?? inputs.profile.destination ?? null,
    targetCity: inputs.profile.target_city ?? null,
    searchGuidance,
    priceExpectations,
    processSteps,
    scamWarnings,
    timingGuidance,
  };
}
