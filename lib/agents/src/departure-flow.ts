// =============================================================
// @workspace/agents — Phase 5B departure / repatriation flow
// =============================================================
// Practical decision support for SHUTTING DOWN the current life
// before the move. Mirror image of arrival flows: cancel, deregister,
// what to do with belongings, and timing.
//
// Phase 5B explicit non-goals:
//   • No mover/storage/resale marketplace.
//   • No shipment tracking.
//   • No contract-law engine.
//   • No pet-relocation deep dive (5C).
//   • No enterprise / global-mobility offboarding.
//   • Not just "remember to cancel internet" — structured, prioritised
//     and timing-aware decision support.
// =============================================================

// ---- Public types ---------------------------------------------------------

export type DepartureDirection =
  /** Closing down origin to move to destination — the dominant case. */
  | "leaving_origin"
  /** Closing down destination to return / move on — surfaces post-arrival. */
  | "leaving_destination";

export type WhenToAct =
  | "now"
  | "8w_before"
  | "4w_before"
  | "2w_before"
  | "1w_before"
  | "move_day"
  | "after_move";

export const WHEN_RANK: Record<WhenToAct, number> = {
  now: 0,
  "8w_before": 1,
  "4w_before": 2,
  "2w_before": 3,
  "1w_before": 4,
  move_day: 5,
  after_move: 6,
};

export type CancelCategory =
  | "lease"
  | "utilities"
  | "subscriptions"
  | "insurance_origin"
  | "memberships"
  | "phone";

export interface CancelItem {
  id: string;
  category: CancelCategory;
  title: string;
  description: string;
  /** Typical notice period the user needs to respect. */
  noticeWeeks: number;
  /** When the user should kick this off given their departure date. */
  whenToAct: WhenToAct;
  /** Common gotcha — surfaced as a warning under the item. */
  watchOut: string | null;
}

export type DeregisterCategory =
  | "population_register"
  | "tax_authority"
  | "social_insurance"
  | "voter_registration"
  | "vehicle"
  | "mail_forwarding"
  | "professional_register";

export interface DeregisterItem {
  id: string;
  category: DeregisterCategory;
  title: string;
  description: string;
  whenToAct: WhenToAct;
  legalConsequence: string;
  /** Some items aren't strictly "deregister" — e.g. mail forwarding is a
   *  forward-redirect setup, not a deregistration. Keep that distinction. */
  isDeregistration: boolean;
}

export type BelongingsAction = "take" | "sell" | "store" | "donate" | "dispose";

export interface BelongingsCategory {
  id: string;
  label: string;
  /** Author-recommended action ranking — first is the typical default. */
  recommendedActions: BelongingsAction[];
  guidance: string;
  /** Optional examples to ground the category. */
  examples: string[];
  watchOut: string | null;
}

export type DepartureUrgency =
  | "early"
  | "on_track"
  | "compressed"
  | "very_late"
  | "post_departure";

export interface TimingMilestone {
  weeksBefore: number;
  label: string;
}

export interface DepartureTiming {
  departureDate: string | null;
  weeksUntilDeparture: number | null;
  urgency: DepartureUrgency;
  message: string;
  nextStep: string;
  milestones: TimingMilestone[];
}

export interface DepartureFlowReport {
  generatedAt: string;
  direction: DepartureDirection;
  closingFrom: string | null;
  goingTo: string | null;
  stage: string | null;
  timing: DepartureTiming;
  cancelItems: CancelItem[];
  deregisterItems: DeregisterItem[];
  belongings: BelongingsCategory[];
  nextStep: string;
}

// ---- Inputs ---------------------------------------------------------------

export interface DepartureProfileInputs {
  current_location?: string | null;
  destination?: string | null;
  origin_lease_status?: string | null;
  origin_lease_termination_notice_days?: number | string | null;
  bringing_vehicle?: string | null;
  pets?: string | null;
  departure_tax_filing_required?: string | null;
  posting_or_secondment?: string | null;
}

export interface DepartureFlowInputs {
  profile: DepartureProfileInputs;
  /** Date the user leaves origin (= arrival_date in our schema for the
   *  forward move). */
  departureDate: string | null;
  stage: string | null;
}

// ---- Helpers --------------------------------------------------------------

function asInt(v: number | string | null | undefined, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function weeksUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.parse(dateStr);
  if (!Number.isFinite(ms)) return null;
  return Math.round((ms - Date.now()) / (7 * 24 * 60 * 60 * 1000));
}

// ---- Cancel items (authored) ----------------------------------------------

interface AuthoredCancel extends CancelItem {
  applicableWhen?: (inputs: DepartureFlowInputs) => boolean;
}

const CANCEL_AUTHORED: AuthoredCancel[] = [
  // ---- Lease (renting) ---------------------------------------------------
  {
    id: "cancel:lease-rental",
    category: "lease",
    title: "Give notice on the rental",
    description:
      "Send written notice to your landlord. Notice runs from the next month-end in many EU countries — read the lease before sending.",
    noticeWeeks: 12,
    whenToAct: "now",
    watchOut:
      "Verbal notice is rarely enforceable. Always email AND post a signed letter; keep the postal receipt.",
    applicableWhen: (i) => i.profile.origin_lease_status === "renting",
  },
  // ---- Lease (owning) ----------------------------------------------------
  {
    id: "cancel:property-decision",
    category: "lease",
    title: "Decide what to do with the property",
    description:
      "Renting it out, selling it, or leaving it empty all have tax + insurance consequences. Book the conversation with whoever advises you on the property before the move.",
    noticeWeeks: 16,
    whenToAct: "now",
    watchOut:
      "Empty owned properties often need a vacancy notice on the home insurance — leaving without one can void cover.",
    applicableWhen: (i) => i.profile.origin_lease_status === "owning",
  },
  // ---- Utilities ---------------------------------------------------------
  {
    id: "cancel:electricity-gas",
    category: "utilities",
    title: "Schedule final electricity / gas reading",
    description:
      "Most utility providers want a final meter reading on or near your move-out date. Book the closure date in advance to avoid double-billing.",
    noticeWeeks: 4,
    whenToAct: "4w_before",
    watchOut:
      "Some providers auto-charge a final invoice + a service-end fee — confirm where the closing balance gets sent.",
  },
  {
    id: "cancel:internet",
    category: "utilities",
    title: "Cancel home internet + TV package",
    description:
      "Most providers require 30 days' notice. Bundles (internet + TV + phone) sometimes need to be cancelled separately.",
    noticeWeeks: 4,
    whenToAct: "4w_before",
    watchOut:
      "If you're under a binding term, ask if a `move abroad` clause waives the early-exit fee — often it does.",
  },
  {
    id: "cancel:water-municipal",
    category: "utilities",
    title: "Close the water / municipal accounts",
    description:
      "Where water + waste are billed by the municipality, closure runs through their portal — landlords don't usually do it for you.",
    noticeWeeks: 2,
    whenToAct: "2w_before",
    watchOut:
      "Final water bill can arrive months later. Update your forwarding address with the municipality, not just the post office.",
    applicableWhen: (i) => i.profile.origin_lease_status === "renting" || i.profile.origin_lease_status === "owning",
  },
  // ---- Phone -------------------------------------------------------------
  {
    id: "cancel:mobile-plan",
    category: "phone",
    title: "Switch the mobile plan to a portable / pay-as-you-go option",
    description:
      "If you don't need the local number long-term, switch to a SIM you can roam on cheaply, or port the number to a low-cost retainer.",
    noticeWeeks: 2,
    whenToAct: "2w_before",
    watchOut:
      "Number portability windows are tight (usually 30 days post-cancellation). Decide before you cancel if you want to keep the number.",
  },
  // ---- Subscriptions -----------------------------------------------------
  {
    id: "cancel:streaming-subscriptions",
    category: "subscriptions",
    title: "Cancel local-only subscriptions",
    description:
      "Streaming, food-delivery, car-share, e-bike, news subscriptions — some are geo-locked and become useless after the move.",
    noticeWeeks: 0,
    whenToAct: "1w_before",
    watchOut:
      "Annual prepays don't auto-refund — request the prorated refund in writing within the cancellation window.",
  },
  // ---- Memberships -------------------------------------------------------
  {
    id: "cancel:gym-club-memberships",
    category: "memberships",
    title: "Cancel gym, club + association memberships",
    description:
      "Most contracts have a 1-3 month notice window. Send notice as early as possible — they don't always honour `move abroad` waivers.",
    noticeWeeks: 4,
    whenToAct: "8w_before",
    watchOut:
      "`Frozen` membership plans are sometimes offered, but rarely worth it if you don't plan to return within the year.",
  },
  // ---- Insurance ---------------------------------------------------------
  {
    id: "cancel:home-contents-insurance",
    category: "insurance_origin",
    title: "Close or transfer home + contents insurance",
    description:
      "Don't cancel before move-out — your stuff is uninsured the moment you do. Schedule cancellation for the day after move-out.",
    noticeWeeks: 0,
    whenToAct: "move_day",
    watchOut:
      "Contents in transit may need a separate `goods in transit` rider — your home insurer can usually issue one.",
  },
  {
    id: "cancel:auto-insurance",
    category: "insurance_origin",
    title: "Close auto insurance / sell or export the car",
    description:
      "If selling: cancel cover the day after handover. If exporting: switch to an export-friendly policy that covers the road back.",
    noticeWeeks: 2,
    whenToAct: "2w_before",
    watchOut:
      "No-claims-bonus letters are gold — request one in writing before closing the policy; you'll need it to get a fair quote at destination.",
    applicableWhen: (i) =>
      i.profile.bringing_vehicle === "yes" || i.profile.bringing_vehicle === "selling",
  },
];

// ---- Deregister items (authored) -----------------------------------------

interface AuthoredDeregister extends DeregisterItem {
  applicableWhen?: (inputs: DepartureFlowInputs) => boolean;
}

const DEREGISTER_AUTHORED: AuthoredDeregister[] = [
  {
    id: "dereg:population-register",
    category: "population_register",
    title: "Deregister from the population register",
    description:
      "Notify the origin's national population / address registry that you're leaving. Most countries require this within 1-2 weeks of move-out.",
    whenToAct: "1w_before",
    legalConsequence:
      "Skipping this can keep you on the tax roll, civil-defence roll, and benefits register — generating bills and obligations after you've left.",
    isDeregistration: true,
  },
  {
    id: "dereg:tax-authority",
    category: "tax_authority",
    title: "File the departure / final tax return",
    description:
      "A final tax return for the origin year is usually mandatory. Some countries (Sweden, Norway, US) keep tax obligations beyond physical departure — confirm what applies.",
    whenToAct: "now",
    legalConsequence:
      "Late or missed departure returns trigger penalties + complicate residency-status changes you'll want for the destination's tax authority.",
    isDeregistration: false,
    applicableWhen: (i) => {
      const flag = (i.profile.departure_tax_filing_required ?? "").toString().toLowerCase();
      // Default to "yes" because most newcomers will need some form of
      // final-year tax handling.
      return flag !== "no";
    },
  },
  {
    id: "dereg:social-insurance",
    category: "social_insurance",
    title: "Notify social-insurance / healthcare authority",
    description:
      "Healthcare, unemployment, and pension authorities usually need a separate notification — population-register deregistration does NOT cascade automatically.",
    whenToAct: "1w_before",
    legalConsequence:
      "Continuing to be `insured` after you've left can result in clawbacks on your contributions and gaps in your destination coverage.",
    isDeregistration: true,
  },
  {
    id: "dereg:voter-registration",
    category: "voter_registration",
    title: "Update voter registration",
    description:
      "Most countries let citizens vote from abroad if registered as overseas voters; that's usually a separate registration from the local roll.",
    whenToAct: "after_move",
    legalConsequence:
      "Civil right rather than legal liability — but missing the next election cycle is a multi-year gap if you don't act.",
    isDeregistration: false,
  },
  {
    id: "dereg:vehicle",
    category: "vehicle",
    title: "Deregister vehicle / hand back plates",
    description:
      "Selling, exporting, or scrapping the car all generate paperwork at the origin's vehicle authority. Don't skip — registrations can keep generating road tax.",
    whenToAct: "2w_before",
    legalConsequence:
      "An undelivered deregistration keeps road tax + insurance obligations live, even when the car is gone.",
    isDeregistration: true,
    applicableWhen: (i) =>
      i.profile.bringing_vehicle === "yes" ||
      i.profile.bringing_vehicle === "selling" ||
      i.profile.bringing_vehicle === "exporting",
  },
  {
    id: "dereg:mail-forwarding",
    category: "mail_forwarding",
    title: "Set up postal mail forwarding",
    description:
      "Forward origin mail to a trusted address (a relative or a paid forwarding service) for 6-12 months. Authorities, insurers and old vendors will keep mailing for a while.",
    whenToAct: "2w_before",
    legalConsequence:
      "Not a deregistration — but missed mail is the most common way newcomers lose track of refunds, final bills, and renewal notices.",
    isDeregistration: false,
  },
  {
    id: "dereg:professional-register",
    category: "professional_register",
    title: "Notify professional / regulator register",
    description:
      "Doctors, lawyers, teachers and similar regulated professions sometimes need to notify their origin licensing body when leaving the jurisdiction.",
    whenToAct: "4w_before",
    legalConsequence:
      "Some regulators charge ongoing fees while you're listed; others suspend without notice if they detect inactivity abroad.",
    isDeregistration: false,
    applicableWhen: () => true,
  },
];

// ---- Belongings (authored) ------------------------------------------------

const BELONGINGS_AUTHORED: BelongingsCategory[] = [
  {
    id: "bel:furniture",
    label: "Furniture + bulky items",
    recommendedActions: ["sell", "donate", "dispose"],
    guidance:
      "Shipping bulky furniture rarely pays off unless it's irreplaceable or sentimental. Most newcomers come out ahead selling or donating and rebuying.",
    examples: ["Sofas", "Tables", "Bed frames", "Wardrobes", "Bookshelves"],
    watchOut:
      "Selling takes 2-4 weeks per piece in slow markets; start at 8 weeks before move-out, not 2.",
  },
  {
    id: "bel:kitchen",
    label: "Kitchen + small appliances",
    recommendedActions: ["sell", "donate", "take"],
    guidance:
      "Take quality knives, pans, and items you actually use. 220V vs 110V appliances may be useless at destination — check before packing.",
    examples: ["Knives", "Pots", "Coffee machines", "Mixers", "Toasters"],
    watchOut: "Most plug-in appliances are voltage-bound — don't ship them across plug standards.",
  },
  {
    id: "bel:clothes",
    label: "Clothes + textiles",
    recommendedActions: ["take", "donate"],
    guidance:
      "Take seasonal essentials and items you actually wear. Donate or resell anything unworn for 12 months — moving cost per kg is real.",
    examples: ["Coats", "Shoes", "Bedding", "Towels"],
    watchOut: "Climate at destination may invert the seasonal need — check before packing winter coats for the tropics.",
  },
  {
    id: "bel:documents",
    label: "Documents + records",
    recommendedActions: ["take"],
    guidance:
      "Take originals + scan everything before you fly. Originals: passport, birth/marriage certs, qualifications, vehicle title, medical records.",
    examples: ["Passport", "Birth certificates", "Diplomas", "Apostilled documents", "Medical records"],
    watchOut:
      "Apostilles and translations expire on usage in some countries — keep digital + physical originals separate during the move.",
  },
  {
    id: "bel:sentimental",
    label: "Sentimental + irreplaceable",
    recommendedActions: ["take", "store"],
    guidance:
      "Photos, journals, family heirlooms — these are the items shipping insurance can't actually replace. Take what fits, store what doesn't with a trusted person.",
    examples: ["Photo albums", "Letters", "Heirloom items", "Journals"],
    watchOut: "Self-storage costs add up — for items you'll retrieve in <2 years, take if you can; longer than that, store strategically or pass on.",
  },
  {
    id: "bel:electronics",
    label: "Electronics + chargers",
    recommendedActions: ["take", "sell"],
    guidance:
      "Phones, laptops and most modern adapters work globally. Older / region-locked devices are usually better sold than shipped.",
    examples: ["Laptops", "Phones", "Cameras", "Headphones"],
    watchOut: "Lithium batteries in checked baggage are restricted — fly them in carry-on only.",
  },
  {
    id: "bel:vehicles",
    label: "Vehicles",
    recommendedActions: ["sell"],
    guidance:
      "Selling at origin is usually simpler than exporting unless the car is unusually valuable or hard to source at destination.",
    examples: ["Cars", "Motorcycles", "Bicycles (often worth taking)"],
    watchOut:
      "Export VAT, destination customs duty + emissions standards can make import economics worse than people expect — model it before deciding.",
  },
];

// ---- Composer -------------------------------------------------------------

function filterCancel(inputs: DepartureFlowInputs): CancelItem[] {
  const items = CANCEL_AUTHORED.filter(
    (it) => !it.applicableWhen || it.applicableWhen(inputs),
  ).map(({ applicableWhen: _omit, ...rest }) => {
    void _omit;
    return rest as CancelItem;
  });
  // Sort by whenToAct, then by category for stable rendering.
  return items.sort((a, b) => {
    const r = WHEN_RANK[a.whenToAct] - WHEN_RANK[b.whenToAct];
    if (r !== 0) return r;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.id.localeCompare(b.id);
  });
}

function filterDeregister(inputs: DepartureFlowInputs): DeregisterItem[] {
  const items = DEREGISTER_AUTHORED.filter(
    (it) => !it.applicableWhen || it.applicableWhen(inputs),
  ).map(({ applicableWhen: _omit, ...rest }) => {
    void _omit;
    return rest as DeregisterItem;
  });
  return items.sort((a, b) => {
    const r = WHEN_RANK[a.whenToAct] - WHEN_RANK[b.whenToAct];
    if (r !== 0) return r;
    return a.id.localeCompare(b.id);
  });
}

function buildBelongings(inputs: DepartureFlowInputs): BelongingsCategory[] {
  // Vehicles only when the user has flagged a vehicle.
  const list = BELONGINGS_AUTHORED.filter((c) => {
    if (c.id === "bel:vehicles") {
      const v = (inputs.profile.bringing_vehicle ?? "").toString().toLowerCase();
      return v && v !== "no" && v !== "none";
    }
    return true;
  });
  return list;
}

function buildTiming(inputs: DepartureFlowInputs): DepartureTiming {
  const weeks = weeksUntil(inputs.departureDate);
  const noticeOverride = asInt(inputs.profile.origin_lease_termination_notice_days, 0);
  // The hardest constraint is usually the lease notice — promote it as the
  // default "you-must-be-acting-by-now" anchor.
  const leaseNoticeWeeks = Math.max(8, Math.ceil(noticeOverride / 7));
  const milestones: TimingMilestone[] = [
    { weeksBefore: leaseNoticeWeeks, label: "Send written lease notice; cancel long-notice memberships" },
    { weeksBefore: 4, label: "Schedule utility close-outs; book movers / shipping if any" },
    { weeksBefore: 2, label: "Start population-register / social-insurance deregistration paperwork" },
    { weeksBefore: 1, label: "Run final readings; schedule mail forwarding" },
    { weeksBefore: 0, label: "Hand over keys; submit deregistration; close insurance" },
  ];

  let urgency: DepartureUrgency = "on_track";
  let message =
    "Departure date isn't set yet. Pin a date in your profile to get a personalised closing-down call.";
  let nextStep = "Set your departure / arrival date in the profile.";

  if (weeks !== null) {
    if (weeks < 0) {
      urgency = "post_departure";
      message =
        "You've already left. Focus the remaining items on tax filing, mail forwarding, and any deregistrations that still need to be done from abroad.";
      nextStep = "Confirm population-register + tax-authority deregistration are complete.";
    } else if (weeks > leaseNoticeWeeks + 4) {
      urgency = "early";
      message = `~${weeks} weeks until departure — plenty of time. Use the runway to handle the long-notice cancellations first.`;
      nextStep = "Map out lease + memberships notices now; everything else can wait.";
    } else if (weeks >= leaseNoticeWeeks) {
      urgency = "on_track";
      message = `~${weeks} weeks until departure — right inside the typical closing-down curve.`;
      nextStep = "Send any lease + long-notice membership notices this week.";
    } else if (weeks >= 4) {
      urgency = "compressed";
      message = `Only ~${weeks} weeks — past the typical lease-notice window. Send any outstanding notices today; expect to pay an overlap month.`;
      nextStep = "Send all outstanding notices today and confirm utility close-outs are scheduled.";
    } else {
      urgency = "very_late";
      message = `~${weeks} weeks — very compressed. Triage to deregistrations + utilities; some long-notice cancellations will roll over a month.`;
      nextStep = "Triage: population-register paperwork, utility close-outs, and final mail-forwarding setup.";
    }
  }

  return {
    departureDate: inputs.departureDate,
    weeksUntilDeparture: weeks,
    urgency,
    message,
    nextStep,
    milestones,
  };
}

function detectDirection(inputs: DepartureFlowInputs): DepartureDirection {
  // Phase 5B v1: forward move = leaving origin to arrive at destination.
  // We keep the type around so the model is extensible to repatriation
  // ("leaving_destination") later without breaking consumers.
  const stage = (inputs.stage ?? "").toString().toLowerCase();
  if (stage === "arrived" || stage === "settling_in") {
    // User is at destination — we still surface origin-direction if the
    // departure_date is in the future (rare). Otherwise the post_departure
    // urgency state handles the "already left" case.
    return "leaving_origin";
  }
  return "leaving_origin";
}

function pickHeadlineNextStep(
  cancel: CancelItem[],
  dereg: DeregisterItem[],
  timing: DepartureTiming,
): string {
  // Highest-priority "now" or "8w_before" cancel/deregister item, falling
  // back to timing.nextStep.
  const candidates: { whenToAct: WhenToAct; text: string }[] = [];
  for (const c of cancel) {
    if (c.whenToAct === "now" || c.whenToAct === "8w_before") {
      candidates.push({ whenToAct: c.whenToAct, text: c.title });
    }
  }
  for (const d of dereg) {
    if (d.whenToAct === "now" || d.whenToAct === "8w_before") {
      candidates.push({ whenToAct: d.whenToAct, text: d.title });
    }
  }
  if (candidates.length === 0) return timing.nextStep;
  candidates.sort((a, b) => WHEN_RANK[a.whenToAct] - WHEN_RANK[b.whenToAct]);
  return candidates[0].text;
}

export function deriveDepartureFlow(inputs: DepartureFlowInputs): DepartureFlowReport {
  const direction = detectDirection(inputs);
  const cancelItems = filterCancel(inputs);
  const deregisterItems = filterDeregister(inputs);
  const belongings = buildBelongings(inputs);
  const timing = buildTiming(inputs);
  const nextStep = pickHeadlineNextStep(cancelItems, deregisterItems, timing);

  return {
    generatedAt: new Date().toISOString(),
    direction,
    closingFrom: inputs.profile.current_location ?? null,
    goingTo: inputs.profile.destination ?? null,
    stage: inputs.stage,
    timing,
    cancelItems,
    deregisterItems,
    belongings,
    nextStep,
  };
}
