// =============================================================
// @workspace/agents — Phase 5.1 pre-departure timeline lib
// =============================================================
// Pure code, no LLM. Takes the user profile + a chosen visa pathway
// + the move date + the in-memory specialist outputs and computes
// an ordered, dependency-aware timeline of pre-departure actions.
//
// What this module IS:
//   * Deterministic. Given the same inputs it ALWAYS returns the
//     same actions in the same order. No model calls, no randomness.
//   * Domain-aware. We know which specialists contribute which
//     classes of action (visa → application; documents → apostille
//     chain; pet → microchip + rabies wait; posted_worker → A1 +
//     PWD; tax → departure declaration; etc.). The contribution
//     table below is the source of truth.
//   * Dependency-aware. Actions express upstream dependencies via
//     `dependsOn`; the critical-path computation honours them.
//
// What this module is NOT:
//   * A persistence layer. Caller (api-server route) writes to DB.
//   * A narrative generator. Optional in 5.2 via a tiny LLM wrapper.
//
// SCALE NOTE: we cap the timeline at 25 actions max — beyond that
// the user's eyes glaze over and the dashboard view becomes noisy.
// We pick the highest-priority items first.
// =============================================================

import {
  inferDeadlineTypeFromConsequence,
  type DeadlineType,
} from "./deadline-model.js";
import type { TaskWalkthrough } from "./walkthrough.js";

export interface PreDepartureProfile {
  citizenship?: string | null;
  destination?: string | null;
  target_city?: string | null;
  purpose?: string | null;
  visa_role?: string | null;
  posting_or_secondment?: string | null;
  pets?: string | null;
  children_count?: number | string | null;
  bringing_vehicle?: string | null;
  prescription_medications?: string | null;
  birth_certificate_apostille_status?: string | null;
  marriage_certificate_apostille_status?: string | null;
  diploma_apostille_status?: string | null;
  police_clearance_status?: string | null;
  a1_certificate_status?: string | null;
  coc_status?: string | null;
  pwd_filed?: string | null;
  origin_lease_status?: string | null;
  origin_lease_termination_notice_days?: number | string | null;
  spouse_joining?: string | null;
  bringing_personal_effects?: string | null;
  [k: string]: unknown;
}

/** Tiny shape from research-orchestrator's SynthesizerInput[]. */
export interface PreDepartureSpecialistOutput {
  name: string;
  output?: { contentParagraphs?: string[]; citations?: Array<{ url: string; label?: string }> };
}

export interface VisaPathwayLite {
  name?: string;
  type?: string;
  estimatedProcessingWeeks?: number;
  officialUrl?: string;
}

export type ActionStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "blocked"
  | "skipped";

export interface PreDepartureAction {
  id: string;
  title: string;
  description: string;
  category:
    | "visa"
    | "documents"
    | "tax"
    | "banking"
    | "housing"
    | "health"
    | "pets"
    | "posted_worker"
    | "schools"
    | "vehicle"
    | "logistics"
    | "admin";
  weeksBeforeMoveStart: number;
  weeksBeforeMoveDeadline: number;
  estimatedDurationDays: number;
  dependsOn: string[];
  documentsNeeded: string[];
  officialSourceUrl: string | null;
  preFilledFormUrl: string | null;
  agentWhoAddedIt: string;
  legalConsequenceIfMissed: string;
  /**
   * Phase 1A — explicit deadline weight. Defaults are applied during
   * timeline generation: actions in `visa` / `posted_worker` always count
   * as "legal"; `admin` / `logistics` default to "practical"; the rest are
   * inferred from `legalConsequenceIfMissed` keywords. Authors can set
   * this explicitly on a draft to override.
   */
  deadlineType: DeadlineType;
  /**
   * Phase 1B — long-form, structured walkthrough rendered when the user
   * opens the action's detail view. Authored alongside the action; the UI
   * handles missing walkthroughs by showing only the summary.
   */
  walkthrough?: TaskWalkthrough;
  status: ActionStatus;
  sortOrder: number;
}

export interface PreDepartureTimeline {
  actions: PreDepartureAction[];
  totalActions: number;
  longestLeadTimeWeeks: number;
  criticalPath: PreDepartureAction[];
  moveDateIso: string;
  generatedAt: string;
}

const MAX_ACTIONS = 25;

interface ActionDraft
  extends Omit<PreDepartureAction, "sortOrder" | "status" | "deadlineType" | "walkthrough"> {
  /** Priority weight — lower = added first to the final list. */
  priority: number;
  /**
   * Optional override. When omitted, the materialisation step derives the
   * deadline type from the action's category + legal-consequence text so
   * existing contributors don't have to be touched.
   */
  deadlineType?: DeadlineType;
  /** Optional walkthrough; passed through verbatim to the action. */
  walkthrough?: TaskWalkthrough;
}

// ---- Contribution rules ---------------------------------------------------

function alwaysApplicable(profile: PreDepartureProfile): ActionDraft[] {
  const dest = profile.destination ?? "your destination";
  return [
    {
      id: "always-confirm-eligibility",
      title: "Confirm visa pathway and eligibility",
      description: `Re-read the visa decision in your dashboard and confirm the pathway still matches your situation. If anything has changed (job offer, relationship status, dependents), pause here and update your profile before any documents are filed.`,
      category: "visa",
      weeksBeforeMoveStart: 12,
      weeksBeforeMoveDeadline: 11,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: [],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "departure_coordinator",
      legalConsequenceIfMissed: "Wrong visa pathway = re-application from scratch and 8-12 weeks lost.",
      priority: 0,
    },
    {
      id: "always-mail-forwarding",
      title: "Set up mail forwarding from origin address",
      description: `Set up a forwarding service so post sent to your origin address reaches you in ${dest}. In Germany this is Nachsendeservice via Deutsche Post; equivalents exist in every EU country.`,
      category: "admin",
      weeksBeforeMoveStart: 3,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: ["Origin address", "New destination address"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "departure_coordinator",
      legalConsequenceIfMissed: "Missed tax notices, missed bank correspondence, account freezes.",
      priority: 95,
      walkthrough: {
        whatThisIs:
          "A postal-service forwarding subscription that intercepts mail addressed to your origin address and re-mails it to the new one. In Germany it's Deutsche Post Nachsendeservice; Sweden uses PostNord Eftersändning; the UK has Royal Mail Redirection.",
        whyItMatters:
          "Tax notices, court summons, and bank correspondence still go to the old address for years. Missed letters cause frozen accounts, late fees, and in worst cases default judgements. Forwarding for 6-12 months covers the long tail.",
        beforeYouStart: [
          "Old address (exact spelling)",
          "New destination address",
          "A working bank card for the subscription fee",
          "Government ID for the postal service's identity check",
        ],
        steps: [
          { text: "Open the postal service's online forwarding form (Deutsche Post: 'Nachsendeservice'; PostNord: 'Eftersändning')." },
          { text: "Pick a duration — 6 months is the cheapest unit; 12 months is recommended for slow-moving institutions." },
          { text: "Pay the subscription. Keep the confirmation email." },
          { text: "Test it: ask a friend to send you a postcard at the old address. If it arrives at the new one within 5 days, you're set." },
        ],
        commonMistakes: [
          "Booking forwarding to start on move-day — start it 1-2 weeks before so any in-flight mail catches up.",
          "Forgetting to update banks separately — many banks bypass forwarding and require a direct change-of-address form.",
          "Booking only 3 months — refunds and tax letters often arrive months later.",
        ],
        whatHappensNext:
          "Once forwarding is live, walk through your most-used services (bank, employer, insurance, utilities) and send each a change-of-address note so they update at source. Forwarding is the safety net, not the primary fix.",
        links: [
          {
            url: "https://www.deutschepost.de/en/n/nachsendeservice.html",
            label: "Deutsche Post Nachsendeservice (DE)",
            linkType: "booking",
            primary: true,
            description: "Forward post from a German address to your new destination. 6 / 12 months options.",
            appointmentHint: "Pick 'Nachsendeservice International' if your new address is outside Germany. The 12-month plan is best value for relocations.",
            languageHint: "German + English",
          },
          {
            url: "https://www.postnord.se/vara-verktyg/eftersand-din-post",
            label: "PostNord Eftersändning (SE)",
            linkType: "booking",
            description: "Sweden's equivalent. Folkbokföring change updates this automatically; this form is for the gap before personnummer arrives.",
            languageHint: "Swedish",
          },
          {
            url: "https://www.royalmail.com/personal/receiving-mail/redirection",
            label: "Royal Mail Redirection (UK)",
            linkType: "booking",
            description: "UK forwarding service. International redirection up to 12 months.",
            languageHint: "English",
          },
        ],
      },
    },
    {
      id: "always-day1-bag",
      title: "Pack day-1 carry-on (originals + receipts)",
      description: `Print and pack: passports, visa stickers, A1 certificates if any, all apostilled originals, employment contract, accommodation booking, insurance proofs. Carry-on only — never check this bag.`,
      category: "logistics",
      weeksBeforeMoveStart: 1,
      weeksBeforeMoveDeadline: 0,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: ["All originals + apostilles + visa documents"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "departure_coordinator",
      legalConsequenceIfMissed: "Lost / checked = sometimes a new visa application.",
      priority: 99,
      walkthrough: {
        whatThisIs:
          "A small carry-on bag holding only original documents — passport(s), visa stickers, A1, apostilled originals, signed employment contract, accommodation booking, insurance proofs. It never goes in the hold.",
        whyItMatters:
          "Lost-luggage rates run 5-10 per 1,000 bags on intercontinental routes. Losing your apostilled originals can mean a 4-12 week re-issuance from the origin country — and you can't enter / sign a lease / open a bank account during that wait.",
        beforeYouStart: [
          "All originals + apostilles for visa / family reunion",
          "Employment contract (printed)",
          "Accommodation booking + landlord contact",
          "Insurance proof",
          "Spare passport photos (2-3) — saves a stop on day-3",
          "USB stick with scans of everything as a backup",
        ],
        steps: [
          { text: "Pack the bag the night before; do NOT delegate this." },
          { text: "Photograph each document and store in a secure cloud folder before sealing." },
          { text: "At check-in, refuse to gate-check — the bag must fit under the seat in front of you." },
          { text: "On arrival, leave the bag in your accommodation safe; only the visa + passport leave the property." },
        ],
        commonMistakes: [
          "Splitting originals between hand-luggage and checked bags — keep all originals together; if customs detains the bag, you lose everything in one place but can prove ownership.",
          "Forgetting spare passport photos — many countries need them for the residence-permit pickup.",
          "Skipping the cloud backup — phones get stolen at airports more than people expect.",
        ],
        whatHappensNext:
          "On arrival, before anything else, scan the contents into your destination cloud (different account from origin) and email the link to yourself. Then add the apostilled documents to your evidence vault.",
      },
    },
  ];
}

function visaContributions(
  profile: PreDepartureProfile,
  visa: VisaPathwayLite | null,
): ActionDraft[] {
  if (profile.visa_role !== "primary" && profile.visa_role !== "dependent") return [];
  // EU/EEA citizens to EU destinations don't need a permit — skip the visa block entirely.
  const isFreeMovement =
    typeof profile.citizenship === "string" &&
    (profile.citizenship.toLowerCase() === "swedish" ||
      profile.citizenship.toLowerCase() === "german" ||
      profile.citizenship.toLowerCase() === "french") &&
    typeof profile.destination === "string" &&
    /sweden|germany|france|spain|italy|netherlands|portugal|finland|denmark|austria/i.test(
      profile.destination,
    );
  if (isFreeMovement) return [];

  const procWeeks = visa?.estimatedProcessingWeeks ?? 8;
  const officialUrl = visa?.officialUrl ?? null;
  const visaName = visa?.name ?? "the recommended residence permit";
  return [
    {
      id: "visa-gather-docs",
      title: `Gather documentation for ${visaName}`,
      description: `Pull together every supporting document the destination immigration authority lists for this pathway. Cross-check the official checklist before filing.`,
      category: "documents",
      weeksBeforeMoveStart: procWeeks + 4,
      weeksBeforeMoveDeadline: procWeeks + 1,
      estimatedDurationDays: 14,
      dependsOn: ["docs-birth-apostille"],
      documentsNeeded: ["Passport", "Application form", "Photos", "Supporting docs per checklist"],
      officialSourceUrl: officialUrl,
      preFilledFormUrl: null,
      agentWhoAddedIt: "visa_specialist",
      legalConsequenceIfMissed: "Application rejected for incomplete documentation; re-file from scratch.",
      priority: 10,
    },
    {
      id: "visa-submit",
      title: `Submit ${visaName} application`,
      description: `Submit via the official portal or in person at the embassy / consulate. Keep a stamped receipt — it's your proof of pending status.`,
      category: "visa",
      weeksBeforeMoveStart: procWeeks,
      weeksBeforeMoveDeadline: Math.max(1, procWeeks - 2),
      estimatedDurationDays: 1,
      dependsOn: ["visa-gather-docs"],
      documentsNeeded: ["All gathered docs", "Application fee"],
      officialSourceUrl: officialUrl,
      preFilledFormUrl: null,
      agentWhoAddedIt: "visa_specialist",
      legalConsequenceIfMissed: "Cannot legally enter / work in destination on the planned date.",
      priority: 11,
      walkthrough: {
        whatThisIs:
          "Filing the residence-permit application with the destination's immigration authority. Most filings happen on an online portal; some still require an embassy / consulate visit.",
        whyItMatters:
          "If the application is filed late or with missing documents, you cannot legally enter the destination on your planned date — and starting work without permit triggers fines for both you and the employer.",
        beforeYouStart: [
          "Every document on the visa pathway's checklist (apostille chain done first)",
          "Application fee — usually paid by card or bank transfer at submission",
          "Passport-sized digital photos (most portals ask for them)",
          "Working email — confirmation + interview letters arrive only there",
          "Calendar slot for the embassy / VFS appointment if the pathway requires it",
        ],
        steps: [
          { text: "Re-read the official checklist from the destination authority. Check every line item — missing one is the most common rejection reason." },
          { text: "Open the official portal (NOT a third-party visa-services site) and start the application." },
          { text: "Upload documents in the requested order; take a screenshot of every confirmation page." },
          { text: "Pay the fee on the portal; print + save the receipt." },
          { text: "If an embassy / VFS biometric appointment is required, book it the same day — slots disappear within hours in busy markets." },
          { text: "Keep the case-number email — every status check uses it." },
        ],
        commonMistakes: [
          "Filing through a third-party site that promises 'fast-track' — usually adds nothing and risks fraud.",
          "Uploading photos that fail biometric checks (background tint, glasses glare) — the system rejects silently and the case stalls.",
          "Forgetting to file a parallel dependent application — spouse + children often need their own filings linked by case number.",
          "Travelling on tourist status while the work-permit application is pending — entering on a tourist stamp can void the pending case in some countries.",
        ],
        whatHappensNext:
          "Track the case via the official portal weekly. Decision typically arrives by email; the visa sticker / decision letter is then collected at the consulate or printed by the destination employer's HR. Once approved, schedule the in-country card pickup task.",
        requiredDocumentCategories: [
          "passport_id",
          "visa_permit",
          "civil",
          "education",
          "financial",
          "employment",
        ],
        proofGuidance: {
          proofGoals: [
            {
              id: "identity",
              label: "Your identity",
              description: "Every visa application starts with the passport. The decision letter from any prior pre-approval also slots in here.",
              acceptableEvidence: [
                { category: "passport_id", description: "National passport (valid 6+ months past planned exit)" },
                { category: "visa_permit", description: "Prior visa decision letter or approval", note: "If you've been pre-approved abroad" },
              ],
            },
            {
              id: "legal-basis",
              label: "The legal basis for this visa",
              description: "Why you qualify under this specific pathway — work, study, family reunion, etc. Different documents satisfy different pathways.",
              acceptableEvidence: [
                { category: "employment", description: "Signed employment contract", note: "For work/skilled-worker visas" },
                { category: "education", description: "University admission letter", note: "For study visas" },
                { category: "civil", description: "Apostilled marriage certificate", note: "For family-reunion / spouse visas" },
              ],
              uncoveredHint:
                "The legal basis is the most-rejected proof category — visas refused most often because the supporting basis was unclear or missing.",
            },
            {
              id: "financial-means",
              label: "Your financial means",
              description: "Proof you can support yourself (and dependents) without becoming a public charge. Most pathways have a numeric threshold.",
              acceptableEvidence: [
                { category: "financial", description: "Recent bank statements (last 3-6 months)" },
                { category: "financial", description: "Sponsor letter + sponsor's bank statement", note: "If a third party is sponsoring you" },
                { category: "financial", description: "Blocked-account confirmation (e.g. Sperrkonto)", note: "For German student visas" },
              ],
            },
            {
              id: "civil-status",
              label: "Civil status (if relevant)",
              description: "If you're bringing a spouse, dependents, or applying as a spouse-of-citizen, civil-status documents close the loop.",
              acceptableEvidence: [
                { category: "civil", description: "Apostilled birth certificate" },
                { category: "civil", description: "Apostilled marriage certificate" },
              ],
              uncoveredHint: "Skip if applying solo with no dependents.",
            },
          ],
        },
        links: officialUrl
          ? [
              {
                url: officialUrl,
                label: `Official ${visaName} portal`,
                linkType: "portal" as const,
                primary: true,
                description: "The destination authority's portal — start the application here and use the case-number for every later status check.",
                appointmentHint: "Use ONLY the official portal — third-party 'fast-track' services don't add anything and can compromise the application.",
              },
              {
                url: officialUrl,
                label: "Official eligibility + checklist",
                linkType: "official_info" as const,
                description: "Re-read every checklist line item before filing — missing one is the most common rejection reason.",
              },
            ]
          : undefined,
      },
    },
    {
      id: "visa-pickup",
      title: "Pick up visa sticker / decision letter",
      description: `Most consulates require an in-person pickup. Schedule the appointment as soon as the decision lands. Carry passport.`,
      category: "visa",
      weeksBeforeMoveStart: 2,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 1,
      dependsOn: ["visa-submit"],
      documentsNeeded: ["Passport", "Decision notice email"],
      officialSourceUrl: officialUrl,
      preFilledFormUrl: null,
      agentWhoAddedIt: "visa_specialist",
      legalConsequenceIfMissed: "No physical proof of permit at border — entry refused.",
      priority: 12,
    },
  ];
}

function documentContributions(profile: PreDepartureProfile): ActionDraft[] {
  const out: ActionDraft[] = [];
  if (profile.birth_certificate_apostille_status !== "obtained" && profile.birth_certificate_apostille_status !== "not_needed") {
    out.push({
      id: "docs-birth-apostille",
      title: "Apostille birth certificate",
      description: `Order an apostilled copy from your origin country's apostille authority. Lead time runs 2-6 weeks depending on country (Germany: 2-3 weeks via Bundesjustizamt; Philippines: 4-6 weeks via DFA).`,
      category: "documents",
      weeksBeforeMoveStart: 12,
      weeksBeforeMoveDeadline: 8,
      estimatedDurationDays: 21,
      dependsOn: [],
      documentsNeeded: ["Original birth certificate", "Application form", "Apostille fee"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "documents_specialist",
      legalConsequenceIfMissed: "Visa application rejected — birth-cert apostille is mandatory for most family-reunification + dependent permits.",
      priority: 5,
      walkthrough: {
        whatThisIs:
          "An apostille is an internationally-recognised stamp from your origin country's apostille authority that authenticates a public document for use abroad. Without it, a Swedish Bürgeramt or Anmeldebehörde won't accept your birth certificate as proof.",
        whyItMatters:
          "Family-reunion permits, dependent visas, marriage registration abroad, school enrolment for non-EU children — all hinge on an apostilled birth certificate. Lead times are 2-6 weeks and usually cannot be expedited; missing it = visa rejected.",
        beforeYouStart: [
          "Original birth certificate (not a notarised copy in many countries)",
          "Application form for the apostille authority",
          "Application fee + return postage",
          "If document is in a non-Hague-Convention country: a legalisation chain (notary → ministry → embassy) instead of an apostille",
        ],
        steps: [
          { text: "Identify your origin country's apostille authority (Germany: Bundesjustizamt; Philippines: DFA; US: each state's Secretary of State; UK: FCDO Legalisation Office)." },
          { text: "Request a fresh certified copy of your birth certificate if your existing copy is older than 6 months — many destinations require recent issuance." },
          { text: "File the apostille application by post or online. Include return-shipping with tracking." },
          { text: "Wait 2-6 weeks. Status check via the authority's portal or by phone." },
          { text: "When it arrives, scan + store it. Bring the original on the move; never check it in luggage." },
        ],
        commonMistakes: [
          "Apostilling a copy instead of the original — in many countries the apostille is only valid on the original certificate.",
          "Assuming an English-language certificate is enough — many destinations also require a sworn translation, sometimes apostilled too.",
          "Starting the chain too late — the post-time alone in some countries (Philippines, India) is 3 weeks each direction.",
        ],
        whatHappensNext:
          "Once the apostilled certificate is in hand, parallel-process any other apostilles (marriage, diploma) from the same authority — they're often cheaper as a bundle. Then submit the full visa application.",
        requiredDocumentCategories: ["civil"],
        proofGuidance: {
          proofGoals: [
            {
              id: "authentic-civil-record",
              label: "An authenticated civil record",
              description:
                "The destination authority needs proof that the certificate was actually issued by your origin country's civil registry — that's exactly what the apostille (or full legalisation chain for non-Hague countries) provides.",
              acceptableEvidence: [
                { category: "civil", description: "Original birth certificate", note: "Copy is rarely accepted; the apostille goes on the original" },
                { category: "civil", description: "Sworn translation", note: "Required if the certificate isn't in the destination language or English" },
              ],
              uncoveredHint:
                "Without the apostilled original, family-reunion + dependent permits will be returned to you. Allow 2-6 weeks for the apostille round-trip.",
            },
          ],
        },
        links: [
          {
            url: "https://www.hcch.net/en/instruments/conventions/authorities1/?cid=41",
            label: "Hague Apostille — competent authorities",
            linkType: "official_info",
            primary: true,
            description: "Locate your origin country's competent authority. Each Hague-Convention country has one or more designated apostille issuers.",
            languageHint: "English + French",
          },
          {
            url: "https://www.bundesjustizamt.de/DE/Themen/Buergerdienste/IZH/Apostillen/Apostillen_node.html",
            label: "Bundesjustizamt — apostilles (DE)",
            linkType: "form",
            description: "Germany's federal apostille issuer. Postal application; 2-3 weeks turnaround.",
            languageHint: "German",
          },
          {
            url: "https://www.gov.uk/get-document-legalised",
            label: "FCDO Legalisation Office (UK)",
            linkType: "form",
            description: "UK apostille service. Online or post; standard 2 weeks, premium 1 day.",
            languageHint: "English",
          },
        ],
      },
    });
  }
  if (profile.marriage_certificate_apostille_status === "in_progress" || profile.marriage_certificate_apostille_status === "applied" || profile.marriage_certificate_apostille_status === "not_started") {
    out.push({
      id: "docs-marriage-apostille",
      title: "Apostille marriage certificate",
      description: `Same authority as the birth certificate, parallel-process to save time. Mandatory for spouse-of-citizen and family-reunion permits.`,
      category: "documents",
      weeksBeforeMoveStart: 12,
      weeksBeforeMoveDeadline: 8,
      estimatedDurationDays: 21,
      dependsOn: [],
      documentsNeeded: ["Original marriage certificate", "Application form"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "documents_specialist",
      legalConsequenceIfMissed: "Spouse-of-citizen permit cannot be filed without it.",
      priority: 6,
    });
  }
  if (profile.diploma_apostille_status === "in_progress" || profile.diploma_apostille_status === "not_started") {
    out.push({
      id: "docs-diploma-apostille",
      title: "Apostille academic diploma",
      description: `Required for skilled-worker visa categories and many regulated professions. Some authorities require notarisation first, then apostille — confirm both steps.`,
      category: "documents",
      weeksBeforeMoveStart: 11,
      weeksBeforeMoveDeadline: 8,
      estimatedDurationDays: 21,
      dependsOn: [],
      documentsNeeded: ["Diploma original", "Notarised copy if required"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "documents_specialist",
      legalConsequenceIfMissed: "Skilled-worker visa application rejected for missing qualification proof.",
      priority: 7,
    });
  }
  if (profile.police_clearance_status === "applied" || profile.police_clearance_status === "not_started") {
    out.push({
      id: "docs-police-clearance",
      title: "Obtain police clearance certificate",
      description: `Apply at the origin-country police authority (Germany: Führungszeugnis via Bundesamt für Justiz; Philippines: NBI clearance). Typically 4-6 weeks. Many destinations require it apostilled too.`,
      category: "documents",
      weeksBeforeMoveStart: 10,
      weeksBeforeMoveDeadline: 6,
      estimatedDurationDays: 28,
      dependsOn: [],
      documentsNeeded: ["Passport", "Application form", "Fee"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "documents_specialist",
      legalConsequenceIfMissed: "Visa application held / rejected without clearance.",
      priority: 8,
    });
  }
  return out;
}

function postedWorkerContributions(profile: PreDepartureProfile): ActionDraft[] {
  if (profile.posting_or_secondment !== "yes") return [];
  const out: ActionDraft[] = [];
  if (profile.a1_certificate_status !== "obtained") {
    out.push({
      id: "pw-a1-certificate",
      title: "Apply for A1 social-security certificate",
      description: `The A1 proves your home-country social security continues during the EU posting (Regulation 883/2004). Apply via origin social-security agency: Deutsche Rentenversicherung (DE), URSSAF (FR), Försäkringskassan (SE). Issuance: 4-6 weeks. Mandatory for EU postings under 24 months.`,
      category: "posted_worker",
      weeksBeforeMoveStart: 10,
      weeksBeforeMoveDeadline: 4,
      estimatedDurationDays: 35,
      dependsOn: [],
      documentsNeeded: ["Posting contract", "Employer details origin + destination", "Posting duration"],
      officialSourceUrl: "https://ec.europa.eu/social/main.jsp?catId=471",
      preFilledFormUrl: null,
      agentWhoAddedIt: "posted_worker_specialist",
      legalConsequenceIfMissed: "Double social-security contributions in both countries; €5k-50k risk.",
      priority: 4,
      walkthrough: {
        whatThisIs:
          "The A1 (Form A1, Regulation 883/2004) is the EU certificate that says 'this person remains insured in their home country's social security during this posting'. Issued by your origin country's social-security authority before the move starts.",
        whyItMatters:
          "Without an A1, your destination country can — and increasingly does — assess full destination social charges (~25-40% of gross). Your origin country also keeps charging. Audits in Germany and France routinely fine employers €10k-50k per missing A1.",
        beforeYouStart: [
          "Posting contract or assignment letter with start + end dates",
          "Origin and destination employer details (name, registration number, address)",
          "Total posting duration — A1 is capped at 24 months (extendable in special cases)",
          "Your origin social-security number",
        ],
        steps: [
          { text: "Identify the issuing authority: Sweden → Försäkringskassan; Germany → Deutsche Rentenversicherung; France → URSSAF / CLEISS." },
          { text: "Open the A1 application portal (most authorities now have an online form)." },
          { text: "Fill in personal + employer + posting details. The system asks for the destination country and start date." },
          { text: "Submit. Most issue digitally within 4-6 weeks; some still mail a paper certificate." },
          { text: "When it arrives, save 3 copies: digital, your day-1 bag, and one for HR at destination." },
        ],
        commonMistakes: [
          "Filing too late — most authorities won't backdate, so any work done before the start date is uncovered.",
          "Confusing A1 (EU postings) with the bilateral CoC (non-EU treaty postings, e.g. US-Sweden) — they're separate forms with separate processing times.",
          "Letting the A1 lapse — extensions must be filed before the original end-date, not after.",
          "Forgetting that posted-worker rules also require a separate Posted Worker Declaration in the destination — that's the next task in this checklist.",
        ],
        whatHappensNext:
          "Once issued, the destination employer files the Posted Worker Declaration referencing the A1 number. Bring the printed A1 in your day-1 bag — labour inspectors at construction sites and major hubs can ask for it on the spot.",
        requiredDocumentCategories: ["employment", "civil"],
        proofGuidance: {
          proofGoals: [
            {
              id: "active-employment",
              label: "An active home-country employment",
              description: "A1 only applies to people who continue to be employed by their origin-country employer during the posting.",
              acceptableEvidence: [
                { category: "employment", description: "Origin-country employment contract" },
                { category: "employment", description: "Posting / assignment letter with start + end dates", note: "Must show ≤24 months for standard A1" },
              ],
            },
            {
              id: "social-security-history",
              label: "Your social-security history in origin",
              description: "The issuing authority cross-checks your origin SSN to make sure you're already registered before the posting starts.",
              acceptableEvidence: [
                { category: "civil", description: "Origin social-security number / record", note: "Usually verified via the agency's portal — a printed SSN card is rarely needed" },
              ],
              uncoveredHint: "Most authorities pull this internally; you usually don't have to upload anything explicit. Keep your SSN handy on the application form.",
            },
          ],
        },
        links: [
          {
            url: "https://ec.europa.eu/social/main.jsp?catId=471",
            label: "EU posted-workers — A1 information",
            linkType: "official_info",
            primary: true,
            description: "European Commission's overview of A1 + posted-worker rules. Confirms which postings are eligible.",
            languageHint: "English + 23 EU languages",
          },
          {
            url: "https://www.forsakringskassan.se/arbetsgivare/sjukloen-och-sjukpenning/anstalld-som-arbetar-utomlands",
            label: "Försäkringskassan — A1 application (SE)",
            linkType: "form",
            description: "Sweden's A1 application. Filed by the EMPLOYER, not the employee — but you can verify status here.",
            languageHint: "Swedish",
          },
          {
            url: "https://www.deutsche-rentenversicherung.de/DRV/EN/Pension/Working-abroad/working-abroad_node.html",
            label: "Deutsche Rentenversicherung — A1 (DE)",
            linkType: "form",
            description: "Germany's A1 issuance flow. Online application via the rentenversicherung portal.",
            languageHint: "German + English",
          },
        ],
      },
    });
  }
  if (profile.coc_status !== "obtained" && profile.coc_status !== "not_applicable") {
    out.push({
      id: "pw-coc",
      title: "Obtain Certificate of Coverage (CoC) — non-EU bilateral treaty",
      description: `For postings under bilateral social-security treaties (US-Sweden, India-Sweden, Korea-Germany, etc.). Same purpose as A1 but covers non-EU corridors. Apply via origin's social security authority.`,
      category: "posted_worker",
      weeksBeforeMoveStart: 12,
      weeksBeforeMoveDeadline: 6,
      estimatedDurationDays: 42,
      dependsOn: [],
      documentsNeeded: ["Posting contract", "Treaty reference"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "posted_worker_specialist",
      legalConsequenceIfMissed: "Double taxation + double social charges.",
      priority: 4,
    });
  }
  if (profile.pwd_filed !== "yes") {
    out.push({
      id: "pw-pwd-filing",
      title: "File Posted Worker Declaration with destination labour authority",
      description: `MUST be filed before work starts. Destinations: Sweden → Arbetsmiljöverket; Germany → ZOLL Mindestlohn-Meldeportal; France → SIPSI. Failure = fines from €1k upward and immediate work stoppage.`,
      category: "posted_worker",
      weeksBeforeMoveStart: 4,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 3,
      dependsOn: ["pw-a1-certificate"],
      documentsNeeded: ["A1 certificate", "Posting contract", "Destination contact person"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "posted_worker_specialist",
      legalConsequenceIfMissed: "Up to €500k fine for the employer; work stoppage; possible ban.",
      priority: 5,
    });
  }
  return out;
}

function petContributions(profile: PreDepartureProfile): ActionDraft[] {
  if (!profile.pets || profile.pets === "none" || profile.pets === "no") return [];
  return [
    {
      id: "pets-microchip-rabies",
      title: "Verify pet microchip + rabies vaccination",
      description: `EU travel requires ISO 11784/11785-compliant microchip implanted BEFORE the rabies vaccine, plus a 21-day post-vaccination wait before the pet may travel. Plan from this constraint backward.`,
      category: "pets",
      weeksBeforeMoveStart: 10,
      weeksBeforeMoveDeadline: 4,
      estimatedDurationDays: 21,
      dependsOn: [],
      documentsNeeded: ["Vet records", "Microchip ID number"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "pet_specialist",
      legalConsequenceIfMissed: "Pet quarantined or denied entry at border.",
      priority: 15,
      walkthrough: {
        whatThisIs:
          "The non-negotiable EU pet-import sequence: ISO-standard microchip implanted FIRST, then the rabies vaccination, then a 21-day waiting period before the pet may travel. The order matters — re-doing it costs another 21 days.",
        whyItMatters:
          "EU border vets check the microchip-rabies sequence on every animal crossing from a third country. Wrong order = pet refused entry or held at the border. UK + EU airports have detained pets; the cost of the alternate flight + boarding runs €1k-3k.",
        beforeYouStart: [
          "Vet records from origin showing prior vaccinations",
          "Pet's date of birth + breed (for the EU pet passport)",
          "Microchip ID from the implanting vet (record it before leaving the clinic)",
          "Rabies titer test result if travelling from a high-risk third country",
        ],
        steps: [
          { text: "Book a vet appointment for the microchip first. Confirm the chip is ISO 11784/11785 compliant — non-ISO chips can't be read at EU borders." },
          { text: "After implant, wait at least one day (most vets prefer one week) before the rabies shot — the chip ID must be on the rabies certificate." },
          { text: "Receive the rabies vaccine. Get the certificate stamped with the microchip ID." },
          { text: "Wait 21 days. The animal must NOT travel during this window — it's a hard EU rule." },
          { text: "10 days before travel, get the EU pet passport (if EU origin) or a USDA / equivalent endorsed certificate.", link: { url: "https://ec.europa.eu/food/animals/movement-pets/eu-legislation_en", label: "EU pet movement rules" } },
        ],
        commonMistakes: [
          "Vaccinating before microchipping — the rabies certificate without a chip ID is invalid for EU travel.",
          "Booking the flight before the 21-day wait completes — many airlines won't carry a pet until they see the certificate dates.",
          "Forgetting that some breeds (XL Bullies in UK, certain mastiffs in DE) have additional restrictions or breed certificates.",
          "Travelling from a high-risk rabies country without the titer test — the animal is held in quarantine on arrival.",
        ],
        whatHappensNext:
          "Once the 21-day wait passes, finalise the carrier booking (most airlines need 30-day notice for pets in cabin). Keep the EU pet passport / health certificate in your day-1 bag, NOT the pet's carrier.",
        requiredDocumentCategories: ["pet"],
        proofGuidance: {
          proofGoals: [
            {
              id: "animal-identity",
              label: "Your pet's identity",
              description: "Border vets verify the chip ID against the rabies certificate. The chip is the canonical identifier.",
              acceptableEvidence: [
                { category: "pet", description: "Vet record showing ISO-compliant microchip ID" },
              ],
            },
            {
              id: "rabies-coverage",
              label: "Active rabies coverage",
              description: "EU + most other markets require a rabies vaccine administered AFTER the chip and at least 21 days before travel.",
              acceptableEvidence: [
                { category: "pet", description: "Rabies certificate stamped with the chip ID" },
                { category: "pet", description: "EU pet passport (if EU origin)" },
                { category: "pet", description: "USDA / equivalent endorsed health certificate (if non-EU origin)" },
              ],
              uncoveredHint:
                "Without the chip-ID-on-rabies-cert combo, the animal can be refused at the gate. Re-issue is fast at any vet who has the chip ID on file.",
            },
          ],
        },
        links: [
          {
            url: "https://food.ec.europa.eu/animals/movement-pets/eu-legislation_en",
            label: "EU pet movement — legislation",
            linkType: "official_info",
            primary: true,
            description: "Authoritative EU rules for moving cats / dogs / ferrets across borders. The chip-then-rabies-then-21d order is mandatory.",
            languageHint: "English + EU languages",
          },
          {
            url: "https://food.ec.europa.eu/animals/movement-pets/eu-pet-passport_en",
            label: "EU pet passport info",
            linkType: "official_info",
            description: "What an EU pet passport contains, who issues it, and when you need it vs. a separate health certificate.",
            languageHint: "English + EU languages",
          },
          {
            url: "https://www.gov.uk/take-pet-abroad",
            label: "UK → abroad pet travel",
            linkType: "official_info",
            description: "Post-Brexit guidance — UK now uses Animal Health Certificates instead of EU pet passports.",
            languageHint: "English",
          },
        ],
      },
    },
    {
      id: "pets-export-permit",
      title: "Pre-flight vet check + EU pet passport / health certificate",
      description: `10 days before travel, get the official EU pet passport (if EU origin) or USDA-endorsed health certificate (US, etc.). Carrier may require it earlier.`,
      category: "pets",
      weeksBeforeMoveStart: 2,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 2,
      dependsOn: ["pets-microchip-rabies"],
      documentsNeeded: ["Microchip + rabies records"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "pet_specialist",
      legalConsequenceIfMissed: "Animal denied at the gate.",
      priority: 16,
    },
  ];
}

function bankingContributions(profile: PreDepartureProfile): ActionDraft[] {
  void profile;
  return [
    {
      id: "bank-bridge-account",
      title: "Set up Wise / Revolut bridge account",
      description: `Open a multi-currency account NOW so you can receive your final origin paycheck and send funds to a destination account once you have a personnummer / steuerliche-IdNr / NIE. Free, takes ~10 minutes.`,
      category: "banking",
      weeksBeforeMoveStart: 8,
      weeksBeforeMoveDeadline: 6,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: ["Passport", "Selfie"],
      officialSourceUrl: "https://wise.com",
      preFilledFormUrl: null,
      agentWhoAddedIt: "banking_helper",
      legalConsequenceIfMissed: "1-3 months of no banking access in destination during onboarding gap.",
      priority: 25,
    },
    {
      id: "bank-notify-origin",
      title: "Notify origin bank of move + update tax residency",
      description: `Most banks require a residency declaration (FATCA / CRS rules). Update before move so account isn't frozen.`,
      category: "banking",
      weeksBeforeMoveStart: 3,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 2,
      dependsOn: [],
      documentsNeeded: ["Move date", "Destination address"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "banking_helper",
      legalConsequenceIfMissed: "Account frozen mid-move with funds inaccessible.",
      priority: 26,
    },
  ];
}

function healthContributions(profile: PreDepartureProfile): ActionDraft[] {
  const out: ActionDraft[] = [
    {
      id: "health-travel-insurance",
      title: "Buy travel + interim health insurance",
      description: `Bridge between origin coverage end and destination coverage start. SafetyWing, Cigna Global, or any local insurer. 90-day minimum coverage recommended.`,
      category: "health",
      weeksBeforeMoveStart: 4,
      weeksBeforeMoveDeadline: 2,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: ["Travel dates", "Destination address"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "healthcare_navigator",
      legalConsequenceIfMissed: "Uninsured medical bills can run €5k-50k for a single ER visit.",
      priority: 30,
    },
  ];
  if (profile.prescription_medications === "yes" || (typeof profile.prescription_medications === "string" && profile.prescription_medications.length > 3)) {
    out.push({
      id: "health-medication-supply",
      title: "Stock 90-day supply of prescription medications",
      description: `Some medications widely used in origin are restricted in destination (Adderall in JP/SE, certain CBD in UAE, codeine in many countries). Get a doctor's letter listing each medication, dose, and reason — carry with you.`,
      category: "health",
      weeksBeforeMoveStart: 4,
      weeksBeforeMoveDeadline: 1,
      estimatedDurationDays: 7,
      dependsOn: [],
      documentsNeeded: ["Prescriptions", "Doctor's letter"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "healthcare_navigator",
      legalConsequenceIfMissed: "Possession charge if medication restricted; worst case detention.",
      priority: 31,
    });
  }
  return out;
}

function vehicleContributions(profile: PreDepartureProfile): ActionDraft[] {
  if (profile.bringing_vehicle !== "yes") return [];
  return [
    {
      id: "vehicle-emissions",
      title: "Verify vehicle emissions compliance for destination",
      description: `EU destinations require Euro 5/6 standard for new registration. Check destination customs portal before shipping; some vehicles cannot be re-registered.`,
      category: "vehicle",
      weeksBeforeMoveStart: 8,
      weeksBeforeMoveDeadline: 6,
      estimatedDurationDays: 7,
      dependsOn: [],
      documentsNeeded: ["Vehicle registration", "Emissions certificate"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "vehicle_import_specialist",
      legalConsequenceIfMissed: "Cannot register vehicle in destination — forced sale or ship-back.",
      priority: 40,
    },
  ];
}

function leaseContributions(profile: PreDepartureProfile): ActionDraft[] {
  const noticeDaysRaw = profile.origin_lease_termination_notice_days;
  const noticeDays =
    typeof noticeDaysRaw === "number"
      ? noticeDaysRaw
      : typeof noticeDaysRaw === "string"
        ? Number.parseInt(noticeDaysRaw, 10) || 90
        : 90;
  if (profile.origin_lease_status !== "renting") return [];
  const noticeWeeks = Math.ceil(noticeDays / 7);
  return [
    {
      id: "lease-terminate",
      title: "Send written termination notice to origin landlord",
      description: `Statutory notice in your origin country is ${noticeDays} days. Send registered mail with proof of receipt. Include desired handover date and forwarding address.`,
      category: "logistics",
      weeksBeforeMoveStart: noticeWeeks + 1,
      weeksBeforeMoveDeadline: noticeWeeks,
      estimatedDurationDays: 1,
      dependsOn: [],
      documentsNeeded: ["Lease agreement", "Move date"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "departure_coordinator",
      legalConsequenceIfMissed: "Pay an extra month's rent for every week you're late.",
      priority: 50,
    },
  ];
}

function shippingContributions(profile: PreDepartureProfile): ActionDraft[] {
  if (profile.bringing_personal_effects !== "yes") return [];
  return [
    {
      id: "ship-quote",
      title: "Get 3 international shipping quotes",
      description: `Container vs groupage vs air. Sea: 6-10 weeks transit Europe→Asia. Air: 5-10 days but 5x cost. Get 3 quotes with insurance.`,
      category: "logistics",
      weeksBeforeMoveStart: 6,
      weeksBeforeMoveDeadline: 4,
      estimatedDurationDays: 5,
      dependsOn: [],
      documentsNeeded: ["Inventory list", "Origin + destination addresses"],
      officialSourceUrl: null,
      preFilledFormUrl: null,
      agentWhoAddedIt: "departure_coordinator",
      legalConsequenceIfMissed: "Last-minute booking is 2-3x cost; you may not have your stuff for 3 months after arrival.",
      priority: 55,
    },
  ];
}

/**
 * Default `deadlineType` for a pre-departure action based on its category
 * and the free-form `legalConsequenceIfMissed` string. Categories with a
 * universal legal weight (visa, posted_worker, vehicle imports) override
 * the consequence-based heuristic; the rest fall through to keyword
 * inference. Pure code, deterministic.
 */
function defaultDeadlineTypeFor(
  category: PreDepartureAction["category"],
  consequence: string,
): DeadlineType {
  if (category === "visa" || category === "posted_worker" || category === "vehicle") {
    return "legal";
  }
  if (category === "admin" || category === "logistics") {
    // Admin/logistics defaults to practical unless the consequence text is
    // explicit about a regulatory penalty.
    const inferred = inferDeadlineTypeFromConsequence(consequence);
    return inferred === "legal" ? "legal" : "practical";
  }
  return inferDeadlineTypeFromConsequence(consequence);
}

// Topological sort with critical-path computation. Cycles are
// defensively broken (we trust our own inputs) — but the loop
// detection is here so a future contributor cannot accidentally
// create a deadlock.
function computeCriticalPath(actions: PreDepartureAction[]): PreDepartureAction[] {
  const byId = new Map<string, PreDepartureAction>();
  for (const a of actions) byId.set(a.id, a);

  // Earliest-finish in DAYS from "now" (= MAX_LEAD * 7 days).
  const efDays = new Map<string, number>();
  function ef(id: string, depth = 0): number {
    if (depth > actions.length + 5) return 0; // cycle guard
    const cached = efDays.get(id);
    if (cached !== undefined) return cached;
    const a = byId.get(id);
    if (!a) return 0;
    let maxDep = 0;
    for (const dep of a.dependsOn) {
      const d = ef(dep, depth + 1);
      if (d > maxDep) maxDep = d;
    }
    const ownDuration = a.estimatedDurationDays;
    const ownStartDay = Math.max(0, (efDays.get("__moveDay") ?? actions.reduce((m, x) => Math.max(m, x.weeksBeforeMoveStart), 0) * 7) - a.weeksBeforeMoveStart * 7);
    const fin = Math.max(maxDep, ownStartDay) + ownDuration;
    efDays.set(id, fin);
    return fin;
  }
  let latestFinish = 0;
  let latestId: string | null = null;
  for (const a of actions) {
    const f = ef(a.id);
    if (f >= latestFinish) {
      latestFinish = f;
      latestId = a.id;
    }
  }
  if (!latestId) return [];

  // Walk back along the dependency chain whose finish equals the predecessor finish.
  const path: PreDepartureAction[] = [];
  const seen = new Set<string>();
  let cur: string | null = latestId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const a = byId.get(cur);
    if (!a) break;
    path.unshift(a);
    let next: string | null = null;
    let bestFin = -1;
    for (const dep of a.dependsOn) {
      const f = efDays.get(dep) ?? 0;
      if (f > bestFin) {
        bestFin = f;
        next = dep;
      }
    }
    cur = next;
  }
  return path;
}

/**
 * Generate the pre-departure timeline.
 *
 * @param profile           Plan profile (read-only).
 * @param visa              Selected visa pathway (or null if free movement).
 * @param moveDate          Desired arrival date in destination.
 * @param specialistOutputs Specialist outputs from the research run (used only for citation enrichment in 5.2 narrative wrapper).
 */
export function generatePreDepartureTimeline(
  profile: PreDepartureProfile,
  visa: VisaPathwayLite | null,
  moveDate: Date,
  specialistOutputs: PreDepartureSpecialistOutput[] = [],
): PreDepartureTimeline {
  void specialistOutputs; // 5.2 narrative wrapper consumes this.

  const drafts: ActionDraft[] = [
    ...alwaysApplicable(profile),
    ...visaContributions(profile, visa),
    ...documentContributions(profile),
    ...postedWorkerContributions(profile),
    ...petContributions(profile),
    ...bankingContributions(profile),
    ...healthContributions(profile),
    ...vehicleContributions(profile),
    ...leaseContributions(profile),
    ...shippingContributions(profile),
  ];

  // Sort by priority then earliest-start.
  drafts.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.weeksBeforeMoveStart - a.weeksBeforeMoveStart;
  });
  const trimmed = drafts.slice(0, MAX_ACTIONS);

  // Materialize into final actions sorted earliest-start first.
  const actions: PreDepartureAction[] = trimmed
    .map((d, i) => {
      const { priority, deadlineType: explicit, walkthrough, ...rest } = d;
      void priority;
      const deadlineType: DeadlineType =
        explicit ?? defaultDeadlineTypeFor(rest.category, rest.legalConsequenceIfMissed);
      return {
        ...rest,
        deadlineType,
        ...(walkthrough ? { walkthrough } : {}),
        status: "not_started" as ActionStatus,
        sortOrder: i,
      };
    })
    .sort((a, b) => b.weeksBeforeMoveStart - a.weeksBeforeMoveStart)
    .map((a, i) => ({ ...a, sortOrder: i }));

  const criticalPath = computeCriticalPath(actions);
  const longestLeadTimeWeeks = actions.reduce((m, a) => Math.max(m, a.weeksBeforeMoveStart), 0);

  return {
    actions,
    totalActions: actions.length,
    longestLeadTimeWeeks,
    criticalPath,
    moveDateIso: moveDate.toISOString(),
    generatedAt: new Date().toISOString(),
  };
}
