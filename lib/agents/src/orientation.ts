// =============================================================
// @workspace/agents — Phase 4D cultural orientation layer
// =============================================================
// Practical-systems orientation: not tourism content, not country-
// guide blob-text, not fluff. Six authored topics that help a new
// arrival understand HOW the everyday systems work, what's easy
// to misunderstand in the first weeks, and which categories of
// tools / apps locals rely on.
//
// Phase 4D explicit non-goals:
//   • No country-guide encyclopedia.
//   • No specific provider/app brand recommendations (no marketplace).
//   • No housing-support depth (Phase 5A territory).
//   • No social / community features.
//   • No tourism / "fun facts" content.
// =============================================================

export type OrientationCategory =
  | "systems"               // how authority systems chain together
  | "everyday_apps"         // categories of apps locals use daily
  | "address_logic"         // why address registration matters
  | "healthcare_practice"   // how to actually use the medical system
  | "housing_culture"       // renting / utilities norms
  | "common_pitfalls";      // easy first-week traps

export type OrientationPhase = "any_time" | "first_72h" | "first_30d" | "later";

export type TakeawayKind = "do" | "dont" | "neutral";

export interface OrientationTakeaway {
  text: string;
  kind: TakeawayKind;
}

export interface OrientationTopic {
  /** Stable id ("orient:address-logic"). */
  id: string;
  category: OrientationCategory;
  title: string;
  /** 1-2 sentence overview — readable in under 5 seconds. */
  summary: string;
  /** Why an outsider needs this; one sentence. */
  whyItMatters: string;
  /** 3-5 short bullets, each marked do/dont/neutral for visual emphasis. */
  practicalTakeaways: OrientationTakeaway[];
  /**
   * When this topic is most relevant. Drives ordering when sorted by
   * phase. "any_time" topics surface near the top because they apply
   * before/during/after arrival.
   */
  phase: OrientationPhase;
  /** Optional related settling-task ref to deep-link into. */
  relatedTaskRef?: string;
  /** Stable author-set ordinal within the same phase. Lower = earlier. */
  order: number;
}

export interface OrientationReport {
  generatedAt: string;
  destination: string | null;
  isFreeMovement: boolean;
  topics: OrientationTopic[];
}

// ---- Inputs ---------------------------------------------------------------

export interface OrientationProfileInputs {
  destination?: string | null;
  citizenship?: string | null;
  visa_role?: string | null;
  origin_lease_status?: string | null;
  children_count?: number | string | null;
  pets?: string | null;
  prescription_medications?: string | null;
}

export interface OrientationInputs {
  profile: OrientationProfileInputs;
  arrivalDate: string | null;
  stage: string | null;
  isFreeMovement: boolean;
}

// ---- Authored topics ------------------------------------------------------

interface AuthoredTopic extends Omit<OrientationTopic, "id"> {
  id: string;
  /**
   * When predicate returns false the topic is filtered out. Defaults to
   * "always include" when omitted.
   */
  applicableWhen?: (inputs: OrientationInputs) => boolean;
}

function asInt(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const TOPICS: AuthoredTopic[] = [
  // ---- 1. Systems cascade ------------------------------------------------
  {
    id: "orient:systems-cascade",
    category: "systems",
    title: "Local authority systems chain together",
    summary:
      "Most destinations key every later system off a single national ID issued at population registration. Skip step one and the rest stalls.",
    whyItMatters:
      "Banks, payroll, healthcare and tax all depend on the registration ID — knowing the order saves a week of bouncing between offices.",
    practicalTakeaways: [
      { text: "Population registration unlocks the bank → digital ID → healthcare cascade.", kind: "do" },
      { text: "Don't try to open a bank account before the registration ID is issued.", kind: "dont" },
      { text: "Once issued, the ID number lives on every later form — keep it on your phone.", kind: "neutral" },
    ],
    phase: "first_72h",
    relatedTaskRef: "settling-in:reg-population",
    order: 0,
  },

  // ---- 2. Everyday apps --------------------------------------------------
  {
    id: "orient:everyday-apps",
    category: "everyday_apps",
    title: "Categories of apps locals use daily",
    summary:
      "Most destinations have a national digital-ID app, a public-services portal, a transit app, and a peer-payment app. The brands vary; the categories don't.",
    whyItMatters:
      "Knowing the categories means you can ask the right colleague for the right name — and recognise the right app from the official-source pages, not the App Store top results.",
    practicalTakeaways: [
      { text: "Install the digital-ID app first — it gates everything else.", kind: "do" },
      { text: "Use the official transport-authority site to find the right transit app, not random search results.", kind: "do" },
      { text: "Don't pay for 'visa / arrival' apps — official services are free.", kind: "dont" },
      { text: "Peer-payment apps (Swish / Tikkie / equivalent) are how locals split bills — ask before assuming cash works.", kind: "neutral" },
    ],
    phase: "first_30d",
    order: 0,
  },

  // ---- 3. Address logic --------------------------------------------------
  {
    id: "orient:address-logic",
    category: "address_logic",
    title: "Address is more than where you sleep",
    summary:
      "Your registered address triggers tax residency, healthcare assignment, and where authority mail routes to. Mail forwarding does NOT replace registration.",
    whyItMatters:
      "Many newcomers register late or use a friend's address — both create traceable problems with tax + benefits months later.",
    practicalTakeaways: [
      { text: "Register at the address you actually live at — match it to the lease exactly.", kind: "do" },
      { text: "Set up postal forwarding from your origin address for 6-12 months as a safety net.", kind: "do" },
      { text: "Don't register at a friend's place to 'save time' — most authorities cross-check.", kind: "dont" },
      { text: "If you move within the destination, you re-register — the old address goes stale immediately.", kind: "neutral" },
    ],
    phase: "first_72h",
    relatedTaskRef: "settling-in:reg-population",
    order: 1,
  },

  // ---- 4. Healthcare practice -------------------------------------------
  {
    id: "orient:healthcare-practice",
    category: "healthcare_practice",
    title: "How to actually use the medical system",
    summary:
      "Primary care is the gatekeeper for everything non-emergency. Skipping it and going to the ER costs more, takes longer, and produces a worse referral path.",
    whyItMatters:
      "Newcomers default to ER for things that should be a phone call. Understanding the routing saves money + time + your specialist queue position.",
    practicalTakeaways: [
      { text: "List with a primary-care clinic in week one — same-day phone bookings depend on it.", kind: "do" },
      { text: "Save the out-of-hours line separately from 112/911. They handle different triage tiers.", kind: "do" },
      { text: "Don't go to the ER for a cold or refill — you'll be billed full price.", kind: "dont" },
      { text: "Most destinations charge a visit fee even with public coverage — budget €15-30/visit.", kind: "neutral" },
    ],
    phase: "first_30d",
    relatedTaskRef: "settling-in:health-vardcentral",
    order: 0,
  },

  // ---- 5. Housing culture (only when renting) ---------------------------
  {
    id: "orient:housing-culture",
    category: "housing_culture",
    title: "Rental culture basics",
    summary:
      "Lease norms vary: notice periods, deposits, what's included. First-hand vs second-hand contracts are treated very differently legally.",
    whyItMatters:
      "Misreading the contract type is one of the most expensive first-month mistakes — a sublet without consent can end with eviction at month three.",
    practicalTakeaways: [
      { text: "Confirm in writing whether your lease is first-hand or sublet — they have different legal protections.", kind: "do" },
      { text: "Notice periods range 1-3 months in most destinations — check yours before signing.", kind: "do" },
      { text: "Don't pay cash deposits; always wire to a verifiable account with a written receipt.", kind: "dont" },
      { text: "Utilities included or not? Confirm electricity, internet, water, building fees individually.", kind: "neutral" },
    ],
    phase: "first_30d",
    order: 0,
    applicableWhen: (i) => i.profile.origin_lease_status === "renting",
  },

  // ---- 6. Common first-week pitfalls ------------------------------------
  {
    id: "orient:common-pitfalls",
    category: "common_pitfalls",
    title: "Easy traps in the first weeks",
    summary:
      "Patterns that show up across destinations: assuming things work like at origin, skipping the boring booking, paying for the wrong thing.",
    whyItMatters:
      "These aren't catastrophic mistakes — they just consume time you don't have when you're also trying to settle in.",
    practicalTakeaways: [
      { text: "Assume your origin phone plan won't work long-term — get a local SIM in week one.", kind: "do" },
      { text: "Book the population-authority slot before flying, not after — slots disappear.", kind: "do" },
      { text: "Don't sign a long-term phone contract before you have local ID + bank account.", kind: "dont" },
      { text: "Don't buy major appliances in the first week — they'll usually be cheaper second-hand once you know the local marketplaces.", kind: "dont" },
    ],
    phase: "any_time",
    order: 0,
  },

  // ---- Family-specific add-on (children) --------------------------------
  {
    id: "orient:family-school-cadence",
    category: "systems",
    title: "School + childcare cadence",
    summary:
      "School slots fill in the same week you arrive, and after-school care (fritids / Hort / equivalent) is a separate application. Plan in parallel.",
    whyItMatters:
      "Missing the slot window means a longer commute or a temporary placement at a school 30+ minutes away.",
    practicalTakeaways: [
      { text: "Walk past the school in week one to confirm registration hours.", kind: "do" },
      { text: "Apply for after-school care the same day you confirm school enrolment — slots fill fast.", kind: "do" },
      { text: "Don't assume one application covers both school + after-school — they're separate municipal portals.", kind: "dont" },
    ],
    phase: "first_30d",
    relatedTaskRef: "settling-in:family-school-confirm",
    order: 1,
    applicableWhen: (i) => asInt(i.profile.children_count) > 0,
  },

  // ---- Pet-specific add-on ----------------------------------------------
  {
    id: "orient:pet-everyday",
    category: "common_pitfalls",
    title: "Pets in the new country",
    summary:
      "Pet ownership norms shift across borders: leash laws, dog-license registers, vet visit costs, public-transport rules.",
    whyItMatters:
      "Day-one fines for off-leash dogs or unregistered pets are common in EU cities — easy to dodge if you check the local rule.",
    practicalTakeaways: [
      { text: "Register the pet with the local municipality if required (e.g. Hundeskatt in DE / hundregister in SE).", kind: "do" },
      { text: "Confirm whether public transit allows pets and whether a muzzle is required.", kind: "do" },
      { text: "Don't assume off-leash beach / park rules carry across the border.", kind: "dont" },
    ],
    phase: "first_30d",
    order: 1,
    applicableWhen: (i) =>
      typeof i.profile.pets === "string" &&
      i.profile.pets.length > 0 &&
      i.profile.pets !== "none" &&
      i.profile.pets !== "no",
  },
];

// ---- Composer -------------------------------------------------------------

const PHASE_RANK: Record<OrientationPhase, number> = {
  first_72h: 0,
  any_time: 1,
  first_30d: 2,
  later: 3,
};

export function deriveOrientation(inputs: OrientationInputs): OrientationReport {
  const applicable = TOPICS.filter((t) => !t.applicableWhen || t.applicableWhen(inputs));

  // Sort: phase rank asc, then author order, then id alpha (stable).
  applicable.sort((a, b) => {
    const r = PHASE_RANK[a.phase] - PHASE_RANK[b.phase];
    if (r !== 0) return r;
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });

  // Strip the predicate before exposing.
  const topics: OrientationTopic[] = applicable.map(({ applicableWhen: _, ...rest }) => {
    void _;
    return rest;
  });

  return {
    generatedAt: new Date().toISOString(),
    destination: inputs.profile.destination ?? null,
    isFreeMovement: inputs.isFreeMovement,
    topics,
  };
}
