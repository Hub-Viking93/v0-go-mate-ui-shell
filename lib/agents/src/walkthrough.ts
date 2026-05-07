// =============================================================
// @workspace/agents — task walkthroughs (Phase 1B)
// =============================================================
// A walkthrough is the long-form, structured "how do I actually do
// this" content surfaced when the user opens a task. It is hand-
// authored alongside the task contributors (settling-in.ts,
// pre-departure.ts) — NOT generated from an LLM prompt — so the
// shape stays predictable and the content can be reviewed.
//
// The list summary (title, deadline, urgency, category) lives on
// the task itself. The walkthrough is purely the inside of the
// drawer.
//
// Empty walkthrough = "no walkthrough yet"; the UI must handle that
// gracefully rather than showing fake step-by-step text.
// =============================================================

/**
 * Structured per-task walkthrough surfaced in the detail view.
 *
 * Every field is optional so partial walkthroughs are valid — a
 * `whatThisIs` + `steps[]` is still useful even without `commonMistakes`.
 * UIs render only the sections that are present.
 */
export interface TaskWalkthrough {
  /** 1-2 sentence definition. "What this thing actually is, in plain words." */
  whatThisIs?: string;
  /** Why missing this matters. Lead with the concrete consequence. */
  whyItMatters?: string;
  /** Bullet list of pre-requisites the user needs in hand before starting. */
  beforeYouStart?: string[];
  /**
   * Ordered, imperative steps. Each step is a short sentence the user can
   * actually act on. Avoid vague verbs ("handle", "deal with") — favour
   * "Open <portal>", "Bring <doc>", "Click <button>".
   */
  steps?: WalkthroughStep[];
  /** Pitfalls + tips from past relocations. Short, concrete. */
  commonMistakes?: string[];
  /** What's the immediate next thing once this is done. Closes the loop. */
  whatHappensNext?: string;
  /**
   * Phase 1C — the "next click" surface. Up to a handful of structured
   * action links the user should know about, ranked. The single primary
   * link is rendered as the main CTA; the rest as secondary chips.
   *
   * This is INTENTIONALLY separate from `WalkthroughStep.link` (which is
   * step-scoped, e.g. "open this URL on step 4"). Walkthrough-level links
   * are the high-impact "go here to actually start / book / file" links
   * surfaced near the top of the detail view.
   */
  links?: TaskActionLink[];
  /**
   * Phase 2B — document categories required to actually finish this task.
   * Drives the "required vs. uploaded vs. missing" surface in the detail
   * view, and binds tasks to the document vault. Authored alongside the
   * walkthrough; do NOT lean on the free-form `documentsNeeded` strings
   * the underlying task already carries — those are display-only.
   */
  requiredDocumentCategories?: DocumentCategory[];
  /**
   * Phase 2C — first real advisory layer on top of the document model.
   * Tells the user WHAT they're proving with this task and WHICH evidence
   * usually helps. Per-goal coverage analysis runs in the UI against the
   * vault.
   *
   * Phase 2C explicit non-goal: nothing here issues an "approved" or
   * "rejected" verdict. We surface preparation guidance and proof gaps
   * — not authority decisions.
   */
  proofGuidance?: ProofGuidance;
  /**
   * Free-form, low-priority extra notes. The UI puts this in a
   * collapsed footer rather than in the main flow.
   */
  notes?: string;
}

/**
 * Phase 2C — task-level proof guidance.
 *
 * `proofGoals` is the explicit list of "things you need to prove to clear
 * this task". Each goal carries acceptable-evidence hints (the categories
 * + descriptions of documents that usually help) so the UI can answer
 *
 *   "what am I trying to prove?" → goal title + description
 *   "what document covers this?" → evidence chips
 *   "is it covered yet?"          → derived from the user's vault
 *
 * `disclaimer` lets a task override the generic "preparation guidance, not
 * approval" line; default copy is supplied by the UI when omitted.
 */
export interface ProofGuidance {
  proofGoals: ProofGoal[];
  disclaimer?: string;
}

export interface ProofGoal {
  /**
   * Stable id ("identity", "legal-basis", "financial-means", etc.). Used
   * by the UI as a key + lets future analytics group goals across tasks
   * even when the human-readable label varies.
   */
  id: string;
  label: string;
  /** One-sentence "why this matters" copy. Optional but recommended. */
  description?: string;
  /** Document types that usually count toward this goal. */
  acceptableEvidence: AcceptableEvidence[];
  /**
   * Optional override for the gap copy when the user has nothing covering
   * this goal. Default: "Still uncertain — no matching document yet."
   */
  uncoveredHint?: string;
}

export interface AcceptableEvidence {
  /** Vault category this evidence belongs to. */
  category: DocumentCategory;
  /** "Passport (any nationality)" / "Recent payslips (3 months)". */
  description: string;
  /** Optional preparation note specific to this evidence ("must be apostilled"). */
  note?: string;
}

/**
 * Canonical document categories. Mirrors the CHECK constraint on
 * `relocation_documents.category` (Phase 2A migration); kept here so the
 * agents package owns the domain enum and frontend / api-server can
 * import it consistently.
 */
export type DocumentCategory =
  | "passport_id"
  | "visa_permit"
  | "education"
  | "employment"
  | "financial"
  | "housing"
  | "civil"
  | "health_insurance"
  | "pet"
  | "other";

/**
 * Phase 2B — origin namespaces for task-reference keys.
 *
 * Settling-in tasks carry a stable `taskKey` ("reg-population", "bank-bankid"
 * etc.); pre-departure actions carry a stable `id` ("visa-submit",
 * "always-mail-forwarding" etc.). Both live in their own namespaces and a
 * collision is theoretically possible — so we PREFIX every reference key
 * with its origin to keep the linkage unambiguous when the same vault
 * document is attached to tasks from both flows.
 */
export type TaskOrigin = "settling-in" | "pre-departure";

/**
 * Build the canonical reference key used in
 * `relocation_documents.linked_task_keys[]`. Format:
 *   "settling-in:reg-population"
 *   "pre-departure:visa-submit"
 */
export function taskRefKey(origin: TaskOrigin, key: string): string {
  return `${origin}:${key}`;
}

/**
 * Parse a reference key back into its components. Returns null when the
 * input doesn't match the canonical "<origin>:<key>" shape.
 */
export function parseTaskRefKey(
  ref: string,
): { origin: TaskOrigin; key: string } | null {
  const idx = ref.indexOf(":");
  if (idx <= 0) return null;
  const origin = ref.slice(0, idx);
  const key = ref.slice(idx + 1);
  if (origin !== "settling-in" && origin !== "pre-departure") return null;
  if (!key) return null;
  return { origin, key };
}

/**
 * The kind of an action link, used by the UI to pick presentation +
 * iconography. Authors keep authority + booking distinct so the user can
 * see "this is the official source vs. this is where I actually click".
 *
 *   official_info     — government / authority info page (overview, eligibility,
 *                       legal text). Read-only.
 *   booking           — appointment / slot-booking flow that ends with a
 *                       confirmed visit time.
 *   form              — a downloadable PDF or an online form to fill in
 *                       (e.g. SKV 7665, Anmeldeformular).
 *   portal            — authenticated dashboard (Skatteverket, 1177, ELSTER)
 *                       — the user logs in here to file or check status.
 *   external_practical — non-government but practically required (postal
 *                       service forwarding, transit operator, BankID app
 *                       publisher). Used sparingly.
 */
export type TaskActionLinkType =
  | "official_info"
  | "booking"
  | "form"
  | "portal"
  | "external_practical";

/**
 * A structured link surfaced in the detail view's "Take action" panel.
 *
 * The data here is ranked by what the user *needs to know* before clicking,
 * not by the URL itself: WHY this link, WHAT to choose on the page, WHICH
 * appointment-type to pick. That's how the UI moves from "here are some
 * URLs, good luck" to "your consultant points you to the exact page".
 */
export interface TaskActionLink {
  /** Destination URL. Must be absolute and reachable from a browser. */
  url: string;
  /** Short label rendered on the link itself (max ~40 chars). */
  label: string;
  /** Category — controls icon + presentation in the UI. */
  linkType: TaskActionLinkType;
  /** Optional one-line "why this link / what you do here" descriptor. */
  description?: string;
  /**
   * Optional appointment-type / category guidance for cryptic booking
   * systems. Examples:
   *   • "Choose category: Asignación de NIE"
   *   • "Filter by 'allmänmedicin' (general practice) within ~5km"
   *   • "Pick the 'flytt till Sverige' service code"
   * The UI surfaces this verbatim next to the link.
   */
  appointmentHint?: string;
  /**
   * Optional language hint — surfaced as a small pill so the user knows
   * the destination page is e.g. Swedish-only. Keep short (e.g. "Swedish",
   * "German + English", "Spanish only").
   */
  languageHint?: string;
  /**
   * When true, this is the single most important link on the task. The UI
   * renders it as the primary CTA. At most one link should be flagged
   * primary per walkthrough.
   */
  primary?: boolean;
}

/**
 * A single walkthrough step. Most steps are just text; some carry a
 * companion link (booking page, official portal, downloadable form).
 *
 * NOTE for Phase 1C: `link` is intentionally minimal here — the booking-
 * link logic with appointment-type guidance lives in Phase 1C and will
 * extend this with `linkType` ("booking" | "form" | "portal") + an
 * appointment hint. For now we just carry through any link the existing
 * task already provides.
 */
export interface WalkthroughStep {
  text: string;
  link?: { url: string; label?: string };
}

/** True when the walkthrough has at least one substantive section. */
export function hasWalkthroughContent(w: TaskWalkthrough | null | undefined): boolean {
  if (!w) return false;
  if (w.whatThisIs && w.whatThisIs.trim()) return true;
  if (w.whyItMatters && w.whyItMatters.trim()) return true;
  if (w.beforeYouStart && w.beforeYouStart.length > 0) return true;
  if (w.steps && w.steps.length > 0) return true;
  if (w.commonMistakes && w.commonMistakes.length > 0) return true;
  if (w.whatHappensNext && w.whatHappensNext.trim()) return true;
  if (w.links && w.links.length > 0) return true;
  return false;
}

/**
 * Returns the single primary link from a walkthrough, if any. Only one
 * link should be flagged `primary` — if multiple are, the first wins.
 */
export function pickPrimaryLink(
  w: TaskWalkthrough | null | undefined,
): TaskActionLink | null {
  if (!w?.links) return null;
  return w.links.find((l) => l.primary) ?? null;
}
