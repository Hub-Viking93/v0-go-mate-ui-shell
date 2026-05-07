// =============================================================
// @workspace/agents — Phase 7 settling-in task graph
// =============================================================
import type { DeadlineType } from "./deadline-model.js";
import type { TaskWalkthrough } from "./walkthrough.js";
import type { ResearchedSteps } from "./specialists/_contracts.js";
import { mapResearchedToSettlingTasks } from "./_settling-in-adapter.js";

// Pure code, no LLM. Same shape as pre-departure.ts: a set of
// domain-specific contributor functions produce tasks for the
// post-arrival period, then a DAG stitcher resolves cross-domain
// dependencies (banking blocked by registration, salary blocked by
// banking, in-person school enrolment blocked by address registration,
// etc.) and topo-sorts the result.
//
// The 8 domains follow the playbook 1:1:
//   registration / banking / housing / healthcare / employment /
//   transport / family / tax
//
// Tasks materialise into the existing `settling_in_tasks` table —
// schema is unchanged. This file ONLY generates the data; the
// api-server route handles persistence.
// =============================================================

export interface SettlingInProfile {
  destination?: string | null;
  target_city?: string | null;
  citizenship?: string | null;
  purpose?: string | null;
  visa_role?: string | null;
  posting_or_secondment?: string | null;
  pets?: string | null;
  bringing_vehicle?: string | null;
  children_count?: number | string | null;
  spouse_joining?: string | null;
  prescription_medications?: string | null;
  chronic_condition_description?: string | null;
  driver_license_origin?: string | null;
  [k: string]: unknown;
}

export type SettlingTaskStatus = "locked" | "available" | "in_progress" | "completed" | "skipped";

export type SettlingDomain =
  | "registration"
  | "banking"
  | "housing"
  | "healthcare"
  | "employment"
  | "transport"
  | "family"
  | "tax";

export interface SettlingTask {
  /** Stable key — matches across regenerations so progress survives. */
  taskKey: string;
  title: string;
  description: string;
  category: SettlingDomain;
  /** Other taskKeys that must reach `completed` before this becomes `available`. */
  dependsOn: string[];
  /** Days from arrival_date by which this should be done. */
  deadlineDays: number;
  isLegalRequirement: boolean;
  /**
   * Phase 1A — explicit deadline weight. `legal` ⇒ regulated penalty if
   * missed; `practical` ⇒ blocks downstream tasks but no fine; `recommended`
   * ⇒ best-practice / optional. When omitted, the topo-sorter back-fills
   * "legal" iff isLegalRequirement, else "practical".
   */
  deadlineType?: DeadlineType;
  steps: string[];
  documentsNeeded: string[];
  officialLink: string | null;
  estimatedTime: string;
  cost: string;
  agentWhoAddedIt: string;
  status: SettlingTaskStatus;
  sortOrder: number;
  /** True iff this task lies on the longest-deadline-aware critical path. */
  onCriticalPath?: boolean;
  /**
   * Phase 1B — long-form, structured walkthrough surfaced in the task
   * detail view. Hand-authored per task; missing fields are absent rather
   * than placeholder. UI must handle null gracefully (Phase 1B explicit
   * non-goal: do NOT generate fake step-by-step text).
   */
  walkthrough?: TaskWalkthrough;
}

export interface SettlingTaskGroup {
  domain: SettlingDomain;
  tasks: SettlingTask[];
  agentName: string;
}

export interface SettlingDAGResult {
  tasks: SettlingTask[];
  dagValid: boolean;
  urgentDeadlines: SettlingTask[];
  totalTasks: number;
  legalRequirementsCount: number;
}

// ---- Helpers ---------------------------------------------------------------

function isCountry(name: string | null | undefined, candidates: string[]): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return candidates.some((c) => n.includes(c));
}

const SE = (d: string | null | undefined) => isCountry(d, ["sweden", "sverige"]);
const DE = (d: string | null | undefined) => isCountry(d, ["germany", "deutschland"]);

function childrenAsNumber(p: SettlingInProfile): number {
  const c = p.children_count;
  if (typeof c === "number") return c;
  if (typeof c === "string") return Number.parseInt(c, 10) || 0;
  return 0;
}

// ---- Domain contributors ---------------------------------------------------

function registrationTasks(profile: SettlingInProfile): SettlingTaskGroup {
  const dest = profile.destination ?? "";
  const isSE = SE(dest);
  const isDE = DE(dest);
  const tasks: SettlingTask[] = [];

  tasks.push({
    taskKey: "reg-population",
    title: isSE
      ? "Register at Skatteverket (folkbokföring) → personnummer"
      : isDE
        ? "Anmeldung at Bürgeramt → Anmeldebestätigung"
        : "Register at the population authority",
    description: isSE
      ? "Walk into a local Skatteverket office with passport, residence-permit decision, and your housing contract. You leave with a personnummer — every other task here depends on it."
      : isDE
        ? "Book a Bürgeramt slot within 14 days. You leave with the Anmeldebestätigung needed for everything else."
        : "Register your address at the local population authority. Most countries have a hard deadline (7-14 days).",
    category: "registration",
    dependsOn: [],
    deadlineDays: isSE ? 7 : isDE ? 14 : 14,
    isLegalRequirement: true,
    steps: [
      "Book the appointment online if available",
      "Bring passport + residence permit + housing contract + employment letter",
      "Submit the SKV 7665 / Anmeldung form",
      "Receive personnummer / Anmeldebestätigung confirmation",
    ],
    documentsNeeded: ["Passport", "Residence permit (if non-EU)", "Housing contract", "Employment letter"],
    officialLink: isSE
      ? "https://www.skatteverket.se/privat/folkbokforing/inflyttningtillsverige.4.7be5268414bea064694c40c.html"
      : isDE
        ? "https://service.berlin.de/dienstleistung/120335/"
        : null,
    estimatedTime: "30-60 minutes (plus 2-4 weeks for personnummer/letter to arrive)",
    cost: "Free",
    agentWhoAddedIt: "settling_in_registration",
    status: "available",
    sortOrder: 0,
    walkthrough: isSE
      ? {
          whatThisIs:
            "Folkbokföring is your formal registration as a resident at Skatteverket. Once approved you receive a personnummer — the 10-digit ID that Sweden uses for everything from doctor visits to mobile contracts.",
          whyItMatters:
            "Without a personnummer you can't open a real Swedish bank account, can't enroll BankID, can't be paid through Swedish payroll, can't register at a vårdcentral, and can't sign a phone contract. Most other tasks in this checklist are blocked on it.",
          beforeYouStart: [
            "Passport (originals — no copies)",
            "Residence permit decision letter (if you're non-EU)",
            "Housing contract or sublet agreement showing your address",
            "Employment letter from your Swedish employer",
            "If married: marriage certificate, apostilled and translated",
            "If you have children moving with you: their birth certificates, apostilled",
          ],
          steps: [
            { text: "Go to skatteverket.se and book a 'flytt till Sverige' appointment at your nearest service office (Stockholm, Göteborg, Malmö all have walk-in slots)." },
            { text: "Print the SKV 7665 form ('Notification of move to Sweden') and fill it in before the visit — they have copies on-site but it saves time." },
            { text: "Walk into the office at your appointment. Bring every original document above." },
            { text: "Hand over the form + originals. The clerk verifies and scans them." },
            { text: "Sign the registration on-site. You'll get a printed receipt with your case number." },
            { text: "Wait 2-4 weeks for the personnummer letter to arrive at your registered address. Some applicants get it within a week, others wait six." },
          ],
          commonMistakes: [
            "Showing up with photocopies — Skatteverket only accepts originals.",
            "Registering an address you don't actually live at (sublets without landlord consent get rejected and the case stalls).",
            "Forgetting that the personnummer is mailed to your address — if you move during the wait, you have to start over.",
            "Assuming the residence permit card alone is enough proof of legal stay; you usually need the decision letter too.",
          ],
          whatHappensNext:
            "When the personnummer letter arrives, photograph it. Then unblock: ID-card application, bank account opening, BankID enrolment, vårdcentral registration. Several tasks below auto-flip to 'available' once the upstream is marked complete.",
          requiredDocumentCategories: ["passport_id", "visa_permit", "housing", "civil"],
          proofGuidance: {
            proofGoals: [
              {
                id: "identity",
                label: "Your identity",
                description:
                  "Skatteverket needs to verify who you are before assigning a personnummer. The passport is the primary anchor; the residence-permit links your identity to your right to stay.",
                acceptableEvidence: [
                  { category: "passport_id", description: "National passport (original)" },
                  { category: "visa_permit", description: "Residence-permit decision letter or card", note: "Required for non-EU citizens" },
                ],
              },
              {
                id: "swedish-residence",
                label: "Where you live in Sweden",
                description:
                  "Your address determines your skatte-tabell, kommun, and which vårdcentral you can list at. The lease is the canonical proof.",
                acceptableEvidence: [
                  { category: "housing", description: "Signed Swedish lease in your name" },
                  { category: "housing", description: "Sublet contract with landlord's consent + the master lease attached" },
                ],
                uncoveredHint:
                  "No Swedish housing contract uploaded yet — Skatteverket usually rejects 'staying with friends' arrangements without a host letter.",
              },
              {
                id: "civil-status",
                label: "Civil status (if registering family)",
                description:
                  "If a spouse or children are joining you, Skatteverket links them to your folkbokföring via your civil-status records.",
                acceptableEvidence: [
                  { category: "civil", description: "Apostilled marriage certificate", note: "Translated to Swedish or English" },
                  { category: "civil", description: "Apostilled birth certificate(s) for children" },
                ],
                uncoveredHint:
                  "Only required if you're registering a spouse / children at the same time. Skip if registering yourself only.",
              },
            ],
          },
          links: [
            {
              url: "https://www.skatteverket.se/servicekontor",
              label: "Book Skatteverket service-office visit",
              linkType: "booking",
              primary: true,
              description: "Book a 'flytt till Sverige' (move to Sweden) appointment at your nearest service office.",
              appointmentHint: "Pick the service code 'Flytt till Sverige' / 'Folkbokföring'. Walk-ins are accepted in major cities but slots fill same-day.",
              languageHint: "Swedish + English",
            },
            {
              url: "https://www.skatteverket.se/privat/folkbokforing/inflyttningtillsverige.4.7be5268414bea064694c40c.html",
              label: "Official folkbokföring info page",
              linkType: "official_info",
              description: "Eligibility rules, document checklist, and what your personnummer entitles you to.",
              languageHint: "Swedish + English",
            },
            {
              url: "https://www.skatteverket.se/privat/etjansterochblanketter/blanketter/blanketter/info/7665.4.39f16f103821c58f680007734.html",
              label: "SKV 7665 — notification of move (form)",
              linkType: "form",
              description: "Pre-fill at home — having it ready cuts the office visit by 20 minutes.",
              languageHint: "Swedish + English",
            },
          ],
        }
      : isDE
        ? {
            whatThisIs:
              "Anmeldung is the legal address registration in Germany. You complete it at the local Bürgeramt within 14 days of moving in and walk out with the Anmeldebestätigung — the slip every other authority will ask for.",
            whyItMatters:
              "Without the Anmeldebestätigung you can't get a Steuer-ID (tax ID), can't open a bank account at most banks, can't enroll in health insurance, can't sign a real mobile contract. Going past the 14-day window risks a fine, though it's often waived for new arrivals.",
            beforeYouStart: [
              "Passport (originals)",
              "Wohnungsgeberbestätigung — landlord confirmation form, signed and dated by your landlord",
              "Lease agreement",
              "Anmeldeformular — registration form, downloadable from your city's website",
              "Marriage certificate + spouse passport if registering as a couple",
              "Birth certificates if registering children",
            ],
            steps: [
              { text: "Find your Bürgeramt: search 'Bürgeramt termin <your city>' — Berlin uses service.berlin.de, Munich uses muenchen.de." },
              { text: "Book the earliest available slot — in big cities slots vanish fast; check at 7am for next-day cancellations." },
              { text: "Have the landlord sign the Wohnungsgeberbestätigung. They're legally required to provide this within 14 days of move-in." },
              { text: "Show up at the Bürgeramt 10 min early. Take a numbered ticket if needed." },
              { text: "Hand over passport, lease, landlord form, and the filled Anmeldeformular." },
              { text: "Sign the registration. The clerk prints + stamps your Anmeldebestätigung — keep it safe and scan a copy.", link: { url: "https://service.berlin.de/dienstleistung/120335/", label: "Berlin Bürgeramt booking" } },
            ],
            commonMistakes: [
              "Booking too late and going past the 14-day window — book a slot before you even fly in if possible.",
              "Forgetting the Wohnungsgeberbestätigung — it's the most-rejected reason. The landlord must sign, not you.",
              "Trying to register at the wrong Bürgeramt — most cities require your district office, not any one.",
              "Losing the Anmeldebestätigung — many later steps need the original. Photograph + scan it on day one.",
            ],
            whatHappensNext:
              "Within 2-3 weeks the Steuer-ID (tax ID) arrives by post — store it; you'll need it for payroll. Once you have the Anmeldebestätigung you can open a bank account (N26 + Commerzbank are most common for new arrivals), enroll in health insurance, and apply for the residence permit if non-EU.",
            requiredDocumentCategories: ["passport_id", "housing", "civil"],
            proofGuidance: {
              proofGoals: [
                {
                  id: "identity",
                  label: "Your identity",
                  description: "Anmeldung is the first time the German state has you on file — the passport anchors that.",
                  acceptableEvidence: [
                    { category: "passport_id", description: "National passport (original)" },
                  ],
                },
                {
                  id: "german-residence",
                  label: "Your residence at this address",
                  description:
                    "The Bürgeramt records your declared address. The Wohnungsgeberbestätigung from your landlord is the legally required confirmation that the address is real.",
                  acceptableEvidence: [
                    { category: "housing", description: "Signed German lease (Mietvertrag)" },
                    { category: "housing", description: "Wohnungsgeberbestätigung", note: "Landlord's confirmation form — separate document, mandatory" },
                  ],
                  uncoveredHint:
                    "No housing proof uploaded — the Wohnungsgeberbestätigung is the most-rejected-for-missing item, far ahead of any other document.",
                },
                {
                  id: "civil-status",
                  label: "Civil status (if registering family)",
                  description: "Joint registration of spouse / children needs civil-status documents.",
                  acceptableEvidence: [
                    { category: "civil", description: "Apostilled marriage certificate (with sworn German translation)" },
                    { category: "civil", description: "Apostilled birth certificates for any children" },
                  ],
                  uncoveredHint: "Only required if registering family at the same time.",
                },
              ],
            },
            links: [
              {
                url: "https://service.berlin.de/dienstleistung/120335/",
                label: "Book Bürgeramt Anmeldung (Berlin)",
                linkType: "booking",
                primary: true,
                description: "Berlin's central booking system. Other cities have their own portal — search 'Bürgeramt termin <city>'.",
                appointmentHint: "Choose 'Anmeldung einer Wohnung'. Pick your DISTRICT office, not just any one — wrong district = rejected on the day.",
                languageHint: "German + English",
              },
              {
                url: "https://www.berlin.de/buergeraemter/dienstleistungen/dienstleistung-120335.php",
                label: "Official Anmeldung info (Berlin)",
                linkType: "official_info",
                description: "What documents are required, the legal basis, and the fine schedule for late registration.",
                languageHint: "German",
              },
              {
                url: "https://www.berlin.de/formularserver/formular.php?273565",
                label: "Wohnungsgeberbestätigung (landlord form)",
                linkType: "form",
                description: "Hand this to your landlord. They're legally required to sign within 14 days of move-in.",
                languageHint: "German",
              },
            ],
          }
        : undefined,
  });

  tasks.push({
    taskKey: "reg-id-card",
    title: isSE ? "Apply for Swedish ID card (Skatteverket)" : "Apply for national ID card",
    description: isSE
      ? "Required for BankID enrolment. Walk into a Skatteverket office with personnummer + passport. Picked up in person 2-3 weeks later."
      : "Many destinations issue a separate national ID card after registration. Apply early — it unlocks digital services.",
    category: "registration",
    dependsOn: ["reg-population"],
    deadlineDays: 30,
    isLegalRequirement: false,
    steps: [
      "Pre-pay the fee online",
      "Book ID-card slot at a Skatteverket office",
      "Show up with passport, personnummer, and proof of payment",
      "Pick up card 2-3 weeks later",
    ],
    documentsNeeded: ["Passport", "Personnummer", "Receipt"],
    officialLink: isSE
      ? "https://www.skatteverket.se/privat/folkbokforing/idkort.4.18e1b10334ebe8bc80003504.html"
      : null,
    estimatedTime: "2-3 weeks total",
    cost: isSE ? "400 SEK" : "Varies",
    agentWhoAddedIt: "settling_in_registration",
    status: "locked",
    sortOrder: 1,
    deadlineType: "practical",
  });

  if (profile.visa_role === "primary" || profile.visa_role === "dependent") {
    tasks.push({
      taskKey: "reg-visa-pickup",
      title: "Collect physical residence-permit card",
      description:
        "If your visa was approved abroad you still need to pick up the physical card at a Migrationsverket / Ausländerbehörde office. Card = proof of legal status.",
      category: "registration",
      dependsOn: [],
      deadlineDays: 14,
      isLegalRequirement: true,
      steps: ["Book pickup appointment", "Bring decision letter + passport", "Receive physical card"],
      documentsNeeded: ["Decision letter", "Passport"],
      officialLink: null,
      estimatedTime: "20 minutes",
      cost: "Free",
      agentWhoAddedIt: "settling_in_registration",
      status: "available",
      sortOrder: 2,
      walkthrough: {
        whatThisIs:
          "Many countries approve the residence permit abroad and issue a paper decision, but you still need to collect a physical residence-permit card in-country. The card is your proof of legal status if you're stopped, want to leave + re-enter, or open accounts.",
        whyItMatters:
          "Without the physical card, border control on re-entry can stop you, banks may refuse to open accounts, and some employers won't run payroll. The card also has the biometric chip employers and authorities scan.",
        beforeYouStart: [
          "Decision letter from the immigration authority (printed)",
          "Passport with the visa sticker if one was issued",
          "Booking confirmation for the pickup appointment",
          "A passport-sized photo if the country requires it on-site (varies)",
        ],
        steps: [
          { text: "Confirm pickup location in the decision letter — usually Migrationsverket (SE) or your local Ausländerbehörde (DE)." },
          { text: "Book the earliest pickup slot online; in busy offices slots open 4-6 weeks out." },
          { text: "Show up with passport + decision letter. Card is handed over after biometric verification." },
          { text: "Photograph both sides of the card and store it digitally before you walk out." },
        ],
        commonMistakes: [
          "Booking pickup at the wrong office — the issuing office is named on the decision letter and is non-transferable.",
          "Letting the appointment lapse: in some countries the card is destroyed if not collected within 30 days.",
          "Travelling out of the country before pickup — re-entry can require a fresh visa application.",
        ],
        whatHappensNext:
          "Once you have the card, scan it. Add the card number to your profile so banks and HR can reference it without you re-typing.",
        requiredDocumentCategories: ["passport_id", "visa_permit"],
        links: [
          {
            url: "https://www.migrationsverket.se/Privatpersoner/Skydd-och-asyl-i-Sverige/Beslutet-fran-Migrationsverket/Hamta-uppehallstillstandskort.html",
            label: "Migrationsverket — collect permit card (SE)",
            linkType: "official_info",
            primary: true,
            description: "Where + how to collect the physical card after a Swedish residence-permit decision. Includes the office locator.",
            languageHint: "Swedish + English",
          },
        ],
      },
    });
  }

  return { domain: "registration", tasks, agentName: "settling_in_registration" };
}

function bankingTasks(profile: SettlingInProfile): SettlingTaskGroup {
  void profile;
  const isSE = SE(profile.destination);
  const tasks: SettlingTask[] = [
    {
      taskKey: "bank-account-open",
      title: isSE ? "Open a Swedish bank account (SEB / Handelsbanken / Nordea)" : "Open a local bank account",
      description:
        "Walk into a branch with personnummer, passport, residence permit, employment contract, and proof of address. Most majors will open the account same-day for sponsored employees.",
      category: "banking",
      dependsOn: ["reg-population"],
      deadlineDays: 21,
      isLegalRequirement: false,
      steps: [
        "Choose bank (SEB / Handelsbanken / Nordea / SBAB / ICA Banken)",
        "Book appointment online",
        "Bring required documents",
        "Sign account opening forms",
      ],
      documentsNeeded: ["Personnummer", "Passport", "Residence permit", "Employment contract", "Housing contract"],
      officialLink: null,
      estimatedTime: "1-2 hours at the branch",
      cost: "Free / minor monthly fee",
      agentWhoAddedIt: "settling_in_banking",
      status: "locked",
      sortOrder: 0,
      walkthrough: isSE
        ? {
            whatThisIs:
              "A regular Swedish current account (lönekonto) at one of the four big banks. Major banks all accept new arrivals with a personnummer + employment contract; brokerage banks like Avanza require an existing Swedish bank ID first.",
            whyItMatters:
              "Your salary needs a Swedish IBAN, and BankID — the master key to every Swedish digital service — can only be issued by a Swedish bank. Without an account you can't enrol BankID, can't auto-pay rent, can't sign for an SL-card monthly pass, can't be reimbursed by Försäkringskassan.",
            beforeYouStart: [
              "Personnummer letter (or a personbevis printout from skatteverket.se)",
              "Passport",
              "Residence permit card (if non-EU)",
              "Employment contract — most banks ask to see it on first visit",
              "Housing contract or recent utility bill as proof of address",
            ],
            steps: [
              { text: "Pick a bank. SEB and Handelsbanken are the most foreign-friendly for first-time accounts; Nordea is the largest by branch count; ICA Banken and SBAB are online-first and faster but offer less hand-holding." },
              { text: "Book a 'new customer' appointment online. Walk-ins are accepted but appointments cut wait time." },
              { text: "Show up with documents. The bank scans them and runs a sanctions check (5-10 min)." },
              { text: "Sign the account opening forms. Account is usually live the same day; debit card arrives by mail in 5-7 days." },
              { text: "Ask for BankID activation in the same visit — you'll need a one-time code sent by mail or set up via the bank's app." },
            ],
            commonMistakes: [
              "Going before the personnummer letter has arrived — banks won't accept just the case-receipt from Skatteverket.",
              "Skipping the employment contract — most banks treat unemployed new arrivals as high-risk and decline.",
              "Choosing an online-only bank as your first account — most refuse new arrivals because they can't do in-person KYC.",
            ],
            whatHappensNext:
              "With the IBAN: send it to your employer for payroll (the next task), set up auto-pay for rent and utilities, and unblock BankID enrolment. BankID is the key everything else hangs on.",
            requiredDocumentCategories: ["passport_id", "visa_permit", "housing", "employment"],
            proofGuidance: {
              proofGoals: [
                {
                  id: "identity",
                  label: "Your identity",
                  description: "KYC: the bank verifies you against international sanctions databases before opening any account.",
                  acceptableEvidence: [
                    { category: "passport_id", description: "National passport (original)" },
                  ],
                },
                {
                  id: "right-to-stay",
                  label: "Your right to stay in Sweden",
                  description: "Banks confirm you're not a tourist before opening a salary account — without this the account can be limited or refused.",
                  acceptableEvidence: [
                    { category: "visa_permit", description: "Residence-permit card or decision letter", note: "Required for non-EU citizens" },
                  ],
                  uncoveredHint: "EU/EEA citizens can skip this. Non-EU should expect the bank to ask before completing onboarding.",
                },
                {
                  id: "swedish-address",
                  label: "Your Swedish address",
                  description: "Mail (debit card, BankID activation codes) needs to land somewhere. Address registration usually has to predate the bank visit.",
                  acceptableEvidence: [
                    { category: "housing", description: "Signed lease or housing contract" },
                  ],
                },
                {
                  id: "income-source",
                  label: "Where your income comes from",
                  description: "Most banks will only open salary accounts for foreign new arrivals once they see an executed employment contract — it satisfies the AML 'expected income' check.",
                  acceptableEvidence: [
                    { category: "employment", description: "Signed Swedish employment contract" },
                    { category: "employment", description: "HR letter on company letterhead", note: "Useful when the contract is in another language" },
                  ],
                  uncoveredHint: "Without an employment proof, most majors will decline — try a few branches before assuming you're stuck.",
                },
              ],
            },
            links: [
              {
                url: "https://seb.se/privat/bli-kund-i-seb/utlandsk-medborgare-flyttar-till-sverige",
                label: "SEB — new-arrival account opening",
                linkType: "booking",
                primary: true,
                description: "SEB's flow for foreign new arrivals. Walk-in friendly; book a slot or visit a branch.",
                appointmentHint: "Ask for a 'lönekonto' (salary account). They'll bundle BankID activation if your ID-card is in hand.",
                languageHint: "Swedish + English",
              },
              {
                url: "https://www.handelsbanken.se/sv/privat/start-i-sverige",
                label: "Handelsbanken — start in Sweden",
                linkType: "official_info",
                description: "Handelsbanken's branch-driven onboarding. More foreign-friendly than online-first banks.",
                languageHint: "Swedish + English",
              },
              {
                url: "https://www.swedishbankers.se/foer-bankkunder/the-bank-id-card-and-services/",
                label: "Banks accepting new-arrival accounts (overview)",
                linkType: "external_practical",
                description: "Swedish Bankers' Association overview — useful when comparing branches.",
                languageHint: "English",
              },
            ],
          }
        : undefined,
    },
    {
      taskKey: "bank-bankid",
      title: isSE ? "Enroll BankID (Mobile BankID)" : "Set up local digital ID",
      description:
        "BankID is the master key to every Swedish digital service: tax, healthcare, school logins, public transport apps, even Klarna. Issued by your bank after the account is open.",
      category: "banking",
      dependsOn: ["bank-account-open", "reg-id-card"],
      deadlineDays: 30,
      isLegalRequirement: false,
      steps: [
        "Inside your bank's app, request BankID",
        "Confirm with one-time code at the branch or via existing BankID",
        "Install Mobile BankID app on phone",
        "Test login at skatteverket.se",
      ],
      documentsNeeded: ["Bank account", "ID card"],
      officialLink: "https://www.bankid.com/en",
      estimatedTime: "30 minutes",
      cost: "Free",
      agentWhoAddedIt: "settling_in_banking",
      status: "locked",
      sortOrder: 1,
      walkthrough: isSE
        ? {
            whatThisIs:
              "BankID is Sweden's national digital identity — a tap-to-confirm app issued by your bank that authenticates you to every Swedish online service: Skatteverket, 1177 healthcare, Försäkringskassan, school logins, Klarna, Swish payments, even your gym contract.",
            whyItMatters:
              "Without BankID you cannot file taxes online, declare sick days, see your kids' school information, log in to 1177 to book doctor visits, or pay anyone with Swish (Sweden's default peer payment app). It is the single biggest unlock in the digital settling-in flow.",
            beforeYouStart: [
              "An open Swedish bank account",
              "A working Swedish phone number — needed for the mobile app verification",
              "A modern smartphone (iOS 13+ or Android 8+) — the BankID app doesn't work on older devices",
            ],
            steps: [
              { text: "Open your bank's mobile app. Look under 'Säkerhet' / 'Mina inställningar' for 'Aktivera BankID' or 'Mobilt BankID'." },
              { text: "Request activation. The bank either generates a one-time activation code in the app, mails it to you, or asks you to confirm at a branch." },
              { text: "Install the BankID app from the App Store / Google Play (publisher: Finansiell ID-Teknik)." },
              { text: "Open the BankID app and enter the activation code from the bank." },
              { text: "Set a 6-digit BankID PIN — write it down; resetting it requires a fresh trip to the branch." },
              { text: "Test it: log in to skatteverket.se with BankID; if it succeeds you're done.", link: { url: "https://www.bankid.com/en/foretag/anvand-bankid", label: "BankID activation guide" } },
            ],
            commonMistakes: [
              "Trying to activate before the bank account is fully live — the bank's activation flow won't find you.",
              "Using BankID on a borrowed phone — it's tied to your device. If you switch phones you must re-issue.",
              "Forgetting the PIN. Resets are in-branch only and usually take a week.",
              "Confusing BankID with the Swedish ID-card — they're separate; BankID is digital, the ID-card is physical and required for some BankID issuance flows.",
            ],
            whatHappensNext:
              "With BankID active, register at your local vårdcentral via 1177.se, claim Försäkringskassan benefits if eligible, declare your tax residency at Skatteverket, and download Swish for everyday payments. You'll also use BankID to confirm school enrolment for kids.",
            requiredDocumentCategories: ["passport_id"],
            links: [
              {
                url: "https://www.bankid.com/en/foretag/anvand-bankid",
                label: "BankID activation guide",
                linkType: "official_info",
                primary: true,
                description: "The official BankID activation walkthrough. Use this if your bank's flow is unclear.",
                languageHint: "English",
              },
              {
                url: "https://apps.apple.com/se/app/bankid-säkerhetsapp/id433151512",
                label: "BankID app (iOS)",
                linkType: "external_practical",
                description: "Install BEFORE going to the bank — saves a step.",
                languageHint: "Swedish + English",
              },
              {
                url: "https://play.google.com/store/apps/details?id=com.bankid.bus",
                label: "BankID app (Android)",
                linkType: "external_practical",
                languageHint: "Swedish + English",
              },
              {
                url: "https://www.skatteverket.se/",
                label: "Test BankID at Skatteverket",
                linkType: "portal",
                description: "Once activated, log in here to confirm everything works before you rely on it.",
                languageHint: "Swedish + English",
              },
            ],
          }
        : undefined,
    },
    {
      taskKey: "bank-salary-setup",
      title: "Give bank account number to employer for payroll",
      description:
        "Forward your IBAN/clearing+account number to HR so your first paycheck arrives. In Sweden this also triggers tax withholding setup.",
      category: "banking",
      dependsOn: ["bank-account-open"],
      deadlineDays: 25,
      isLegalRequirement: false,
      steps: ["Get account number from bank", "Email HR / payroll", "Confirm in next pay run"],
      documentsNeeded: ["Bank account number"],
      officialLink: null,
      estimatedTime: "10 minutes",
      cost: "Free",
      agentWhoAddedIt: "settling_in_banking",
      status: "locked",
      sortOrder: 2,
    },
  ];
  return { domain: "banking", tasks, agentName: "settling_in_banking" };
}

function housingTasks(profile: SettlingInProfile): SettlingTaskGroup {
  void profile;
  const tasks: SettlingTask[] = [
    {
      taskKey: "housing-utilities",
      title: "Set up electricity, internet, water utilities",
      description:
        "First-hand contracts often include some utilities; second-hand sublets rarely do. Confirm with landlord, then sign with the providers (Vattenfall / Stadtwerke / etc.).",
      category: "housing",
      dependsOn: ["reg-population"],
      deadlineDays: 14,
      isLegalRequirement: false,
      steps: ["Confirm what's included in rent", "Choose providers", "Sign online with personnummer"],
      documentsNeeded: ["Personnummer", "Housing contract"],
      officialLink: null,
      estimatedTime: "1 hour",
      cost: "1500-3000 SEK / month",
      agentWhoAddedIt: "settling_in_housing",
      status: "locked",
      sortOrder: 0,
    },
    {
      taskKey: "housing-insurance",
      title: "Buy home insurance (hemförsäkring / Hausratversicherung)",
      description:
        "Mandatory in many Swedish rental contracts; nice-to-have but cheap (~150-300 SEK/mo) elsewhere. Folksam, Trygg-Hansa, If, Länsförsäkringar all offer it.",
      category: "housing",
      dependsOn: ["reg-population"],
      deadlineDays: 14,
      isLegalRequirement: false,
      steps: ["Compare quotes", "Sign online with personnummer"],
      documentsNeeded: ["Personnummer", "Address"],
      officialLink: null,
      estimatedTime: "20 minutes",
      cost: "150-300 SEK / month",
      agentWhoAddedIt: "settling_in_housing",
      status: "locked",
      sortOrder: 1,
    },
    {
      taskKey: "housing-mail-arrival",
      title: "Confirm mail forwarding from origin landed",
      description:
        "The forwarding service you set up pre-departure should now route post to your new address. Test by sending yourself a postcard from origin.",
      category: "housing",
      dependsOn: [],
      deadlineDays: 7,
      isLegalRequirement: false,
      steps: ["Test with a postcard", "Update bank + employer addresses if not already done"],
      documentsNeeded: [],
      officialLink: null,
      estimatedTime: "5 minutes",
      cost: "Free",
      agentWhoAddedIt: "settling_in_housing",
      status: "available",
      sortOrder: 2,
      deadlineType: "recommended",
    },
  ];
  return { domain: "housing", tasks, agentName: "settling_in_housing" };
}

function healthcareTasks(profile: SettlingInProfile): SettlingTaskGroup {
  const isSE = SE(profile.destination);
  const tasks: SettlingTask[] = [
    {
      taskKey: "health-card",
      title: isSE ? "Receive Försäkringskassan health card" : "Receive national health insurance card",
      description:
        "Once your personnummer lands, the regional healthcare authority auto-mails your insurance card within 2-4 weeks. Activate online if required.",
      category: "healthcare",
      dependsOn: ["reg-population"],
      deadlineDays: 30,
      isLegalRequirement: false,
      steps: ["Wait for card in the mail", "Activate online if needed"],
      documentsNeeded: ["Personnummer"],
      officialLink: isSE ? "https://www.forsakringskassan.se/" : null,
      estimatedTime: "10 minutes (after 2-4 week wait)",
      cost: "Free",
      agentWhoAddedIt: "settling_in_healthcare",
      status: "locked",
      sortOrder: 0,
    },
    {
      taskKey: "health-vardcentral",
      title: isSE ? "Register with a vårdcentral (primary care)" : "Register with a primary-care doctor",
      description:
        "Pick a clinic close to home, register via the regional health portal (1177.se in Sweden). All future GP visits, referrals, prescriptions go through this clinic.",
      category: "healthcare",
      dependsOn: ["reg-population"],
      deadlineDays: 30,
      isLegalRequirement: false,
      steps: ["Search for nearby clinics on 1177.se / Doctolib", "Complete registration online"],
      documentsNeeded: ["Personnummer", "BankID (helpful but not strictly required)"],
      officialLink: isSE ? "https://www.1177.se/" : null,
      estimatedTime: "20 minutes",
      cost: "Free",
      agentWhoAddedIt: "settling_in_healthcare",
      status: "locked",
      sortOrder: 1,
      walkthrough: isSE
        ? {
            whatThisIs:
              "Your vårdcentral is your assigned primary-care clinic — the first point of contact for non-emergency healthcare in Sweden. You list at one specific clinic; all referrals to specialists go through them.",
            whyItMatters:
              "Without a listed vårdcentral, every visit becomes 'akutmottagning' (emergency room) — wait times stretch into hours and the bill is higher. The clinic also coordinates child health (BVC), prescriptions, sick leave certificates, and chronic-condition care.",
            beforeYouStart: [
              "Personnummer",
              "BankID active on your phone (you authenticate the listing with it)",
              "Your home address — clinics are usually filtered by proximity",
            ],
            steps: [
              { text: "Open 1177.se and log in with BankID." },
              { text: "Search 'Lista vårdcentral' or 'Välj vårdcentral'. The portal lists clinics within ~5km of your address." },
              { text: "Compare ratings and waiting times. Some private clinics (Capio, Doktor.se) have shorter waits but charge a small per-visit fee on top of the regional cap." },
              { text: "Click 'Lista mig hos…' on your chosen clinic and confirm with BankID. Listing is instant.", link: { url: "https://www.1177.se/", label: "1177.se patient portal" } },
              { text: "Save the clinic's phone number — opening hours are usually 8-17 weekdays; same-day appointments are by phone." },
            ],
            commonMistakes: [
              "Listing far from home for ratings reasons — the visit cost is the same but the trip eats half a day. Pick within a 15-minute commute.",
              "Forgetting to re-list when you move — your old vårdcentral keeps your records but won't accept walk-ins from your new district.",
              "Treating private digital clinics (Doktor.se / Kry) as your vårdcentral — they're great for triage but most don't issue physical referrals or chronic-care plans.",
            ],
            whatHappensNext:
              "Once listed, book a 'hälsosamtal' (health check) — it's free, lets the clinic create your medical record, and is the cleanest way to get prescriptions transferred over. Add the clinic's number to your phone under 'Vårdcentral'.",
            links: [
              {
                url: "https://www.1177.se/Stockholm/sa-fungerar-varden/varden-i-sverige/lista-dig-pa-en-vardcentral/",
                label: "List me at a vårdcentral (1177)",
                linkType: "portal",
                primary: true,
                description: "The 1177 patient portal — log in with BankID and pick your clinic from the proximity-filtered list.",
                appointmentHint: "Filter by 'allmänmedicin' (general practice) within ~5km of home. Skip purely-private clinics if you have ongoing prescriptions — they don't always issue chronic-care plans.",
                languageHint: "Swedish + English",
              },
              {
                url: "https://www.1177.se/",
                label: "1177 — main patient portal",
                linkType: "official_info",
                description: "Hub for the entire Swedish public-healthcare experience: bookings, records, prescriptions, advice.",
                languageHint: "Swedish + English",
              },
            ],
          }
        : undefined,
    },
  ];

  if (profile.prescription_medications && profile.prescription_medications !== "no") {
    tasks.push({
      taskKey: "health-prescription",
      title: "Transfer prescriptions to a local pharmacy",
      description:
        "Bring the doctor's letter you carried in your day-1 bag. Apoteket / Pharmacy chain will issue local prescriptions linked to your personnummer.",
      category: "healthcare",
      dependsOn: ["reg-population"],
      deadlineDays: 21,
      isLegalRequirement: false,
      steps: ["Visit pharmacy with letter", "Get local prescriptions issued"],
      documentsNeeded: ["Doctor's letter", "Personnummer"],
      officialLink: null,
      estimatedTime: "30 minutes",
      cost: "Per medication",
      agentWhoAddedIt: "settling_in_healthcare",
      status: "locked",
      sortOrder: 2,
    });
  }

  if (childrenAsNumber(profile) > 0) {
    tasks.push({
      taskKey: "health-pediatrician",
      title: "Register children with BVC / pediatric clinic",
      description:
        "Children under 6 should be enrolled in barnavårdscentral (BVC). Auto-invitation usually arrives but you can self-register on 1177.se.",
      category: "healthcare",
      dependsOn: ["reg-population"],
      deadlineDays: 30,
      isLegalRequirement: false,
      steps: ["Find nearest BVC", "Register children", "Submit vaccination record from origin"],
      documentsNeeded: ["Children's personnummer", "Vaccination record"],
      officialLink: null,
      estimatedTime: "30 minutes",
      cost: "Free",
      agentWhoAddedIt: "settling_in_healthcare",
      status: "locked",
      sortOrder: 3,
    });
  }

  return { domain: "healthcare", tasks, agentName: "settling_in_healthcare" };
}

function employmentTasks(profile: SettlingInProfile): SettlingTaskGroup {
  if (profile.purpose !== "work") return { domain: "employment", tasks: [], agentName: "settling_in_employment" };
  const tasks: SettlingTask[] = [
    {
      taskKey: "emp-payroll",
      title: "Confirm payroll setup with employer",
      description:
        "Hand HR your bank account, personnummer, and tax-withholding info. First paycheck typically arrives 4-6 weeks after start.",
      category: "employment",
      dependsOn: ["bank-account-open", "reg-population"],
      deadlineDays: 21,
      isLegalRequirement: false,
      steps: ["Send bank + personnummer to HR", "Confirm tax form is on file"],
      documentsNeeded: ["Bank account number", "Personnummer"],
      officialLink: null,
      estimatedTime: "30 minutes",
      cost: "Free",
      agentWhoAddedIt: "settling_in_employment",
      status: "locked",
      sortOrder: 0,
      walkthrough: {
        requiredDocumentCategories: ["employment", "financial"],
        whatThisIs:
          "The administrative handshake between you and your employer's HR/payroll system: handing over your bank account number, personnummer / national ID, and tax-withholding info so the first salary actually lands.",
        whyItMatters:
          "Until payroll is set up, your salary either doesn't pay or pays to the wrong account. Many destinations also require a tax form on file in the first month — without it you're taxed at the highest emergency rate and have to claim the difference back later.",
        beforeYouStart: [
          "Bank account IBAN (or clearing + account number in Sweden)",
          "Personnummer / Steuer-ID / NIE (whichever the destination uses)",
          "Signed employment contract",
          "If country uses tax-card or A-skatt: your Skatteverket / Finanzamt registration",
        ],
        steps: [
          { text: "Email HR your full name, IBAN, personnummer, and start date in one message — saves three back-and-forths." },
          { text: "Confirm whether you're on A-skatt (employer withholds) or F-skatt (you invoice) — Sweden defaults to A-skatt for employees." },
          { text: "Upload any required tax form: Sweden's Skatteverket pulls this automatically once you're registered; Germany's ELStAM is fetched by your employer with your Steuer-ID." },
          { text: "Confirm with HR by email that the first pay run is scheduled. Ask for the exact date — most employers run on the 25th of the month." },
        ],
        commonMistakes: [
          "Sending only the bank account but no personnummer — payroll will sit in 'pending' until the ID is on file.",
          "Skipping the tax-card setup — you'll be taxed at the high default rate (~57% in Sweden) for the first 1-3 months until it's corrected.",
          "Forgetting that Sweden's Skatteverket auto-sets the tax table — you don't fill in a separate W-4, you just exist in the system.",
        ],
        whatHappensNext:
          "Watch for the first pay slip (lönespecifikation) — verify the tax rate matches your bracket. Once the first salary lands, set up auto-pay for rent and an emergency-buffer transfer.",
      },
    },
  ];
  if (profile.posting_or_secondment === "yes") {
    tasks.push({
      taskKey: "emp-a1-on-file",
      title: "File A1 / CoC certificate copy with destination employer",
      description:
        "The A1 certificate proves you stay covered by origin-country social security. Hand a copy to the destination HR and the destination labour authority.",
      category: "employment",
      dependsOn: [],
      deadlineDays: 14,
      isLegalRequirement: true,
      steps: ["Print A1", "Hand to destination HR", "File copy with Arbetsmiljöverket / ZOLL"],
      documentsNeeded: ["A1 certificate"],
      officialLink: "https://www.av.se/en/work-environment-work-and-inspections/posted-workers/",
      estimatedTime: "1 hour",
      cost: "Free",
      agentWhoAddedIt: "settling_in_employment",
      status: "available",
      sortOrder: 1,
      walkthrough: {
        requiredDocumentCategories: ["employment"],
        proofGuidance: {
          proofGoals: [
            {
              id: "social-security-coverage",
              label: "That origin social security still covers you",
              description: "The A1 / CoC is the only acceptable proof that you're not on the destination's social-security books during this posting.",
              acceptableEvidence: [
                { category: "employment", description: "A1 certificate (EU postings)" },
                { category: "employment", description: "Bilateral Certificate of Coverage (non-EU treaty postings)" },
              ],
              uncoveredHint:
                "Without the A1 / CoC on file you risk being assessed for full destination social charges (~25-30% of gross). Get it before the first paycheck runs.",
            },
            {
              id: "posting-structure",
              label: "The structure of your posting",
              description: "The destination employer files the Posted Worker Declaration referencing the A1 — they need the assignment letter to do that correctly.",
              acceptableEvidence: [
                { category: "employment", description: "Signed posting / assignment contract", note: "Origin employer issues; destination HR keeps a copy" },
              ],
            },
          ],
        },
        whatThisIs:
          "Handing the destination employer + the destination labour authority a copy of your A1 (or bilateral CoC) certificate. The A1 was issued in your origin country before the move; in-country you confirm it's on file so social-security contributions stay in origin and don't double-bill.",
        whyItMatters:
          "Without the A1 on file in the destination, you risk being assessed for both origin and destination social charges — that's typically 25-30% of gross pay paid twice. Some destinations also fine the employer if a posted worker is found without the paperwork.",
        beforeYouStart: [
          "A1 certificate (or bilateral CoC for non-EU postings) — printed",
          "Posting contract / assignment letter",
          "Destination HR contact",
          "Destination labour authority filing reference (Sweden: Arbetsmiljöverket; Germany: Zoll; France: SIPSI)",
        ],
        steps: [
          { text: "Print 2 copies of the A1: one for HR, one to keep." },
          { text: "Email a scanned copy to destination HR with subject 'Posted-worker A1 — <your name> — for HR file'." },
          { text: "Confirm the employer has registered the posting with the destination labour authority (it's their obligation, not yours, but verify)." },
          { text: "Keep your original A1 in your day-1 documents folder — labour inspections can ask to see it on-site.", link: { url: "https://ec.europa.eu/social/main.jsp?catId=471", label: "EU posted-workers info" } },
        ],
        commonMistakes: [
          "Assuming the A1 'just covers everything' — many destinations require a separate posted-worker declaration (Phase: pre-departure 'pw-pwd-filing') in addition to the A1.",
          "Letting the A1 expire mid-posting — they're issued for a fixed period (max 24 months EU). Renewals must be filed before expiry.",
          "Storing only a digital copy — bring the printed original on the first day of work; some companies keep it in the personnel file.",
        ],
        whatHappensNext:
          "Confirm with payroll that no destination social charges are being deducted. If you see them on the first slip, escalate to HR immediately with the A1 reference.",
        links: [
          {
            url: "https://www.av.se/en/work-environment-work-and-inspections/posted-workers/",
            label: "Arbetsmiljöverket — posted workers (SE)",
            linkType: "official_info",
            primary: true,
            description: "Sweden's labour authority page on posted-worker rules. Use this to confirm your posting is correctly registered.",
            languageHint: "Swedish + English",
          },
          {
            url: "https://www.av.se/en/work-environment-work-and-inspections/posted-workers/notification/",
            label: "Posted-worker notification status (SE)",
            linkType: "portal",
            description: "Check whether the destination employer has filed the posted-worker declaration referencing your A1.",
            languageHint: "Swedish + English",
          },
        ],
      },
    });
  }
  if (SE(profile.destination)) {
    tasks.push({
      taskKey: "emp-union",
      title: "Consider trade-union enrolment (Unionen / Akademikerförbundet)",
      description:
        "Sweden's labour market is union-driven. Membership unlocks income-loss insurance and collective bargaining cover. Optional but the norm in many sectors.",
      category: "employment",
      dependsOn: [],
      deadlineDays: 60,
      isLegalRequirement: false,
      steps: ["Identify the union that covers your sector", "Sign up online with personnummer"],
      documentsNeeded: ["Personnummer"],
      officialLink: "https://www.unionen.se/",
      estimatedTime: "20 minutes",
      cost: "200-300 SEK / month",
      agentWhoAddedIt: "settling_in_employment",
      status: "available",
      sortOrder: 2,
      deadlineType: "recommended",
    });
  }
  return { domain: "employment", tasks, agentName: "settling_in_employment" };
}

function transportTasks(profile: SettlingInProfile): SettlingTaskGroup {
  const tasks: SettlingTask[] = [
    {
      taskKey: "transit-pass",
      title: SE(profile.destination)
        ? "Buy SL-card (monthly transit pass for Stockholm)"
        : "Get monthly public-transit pass",
      description:
        "Set up at the city's transit authority site. Auto-renew via direct debit once your bank account is live.",
      category: "transport",
      dependsOn: [],
      deadlineDays: 7,
      isLegalRequirement: false,
      steps: ["Buy at any metro station or via app", "Link to bank account for auto-renewal"],
      documentsNeeded: ["Photo ID for personalised cards"],
      officialLink: SE(profile.destination) ? "https://sl.se/" : null,
      estimatedTime: "10 minutes",
      cost: "~970 SEK / month (Stockholm)",
      agentWhoAddedIt: "settling_in_transport",
      status: "available",
      sortOrder: 0,
      deadlineType: "recommended",
    },
  ];
  if (profile.driver_license_origin === "yes" || profile.bringing_vehicle === "yes") {
    tasks.push({
      taskKey: "transit-license",
      title: "Convert / exchange driver's licence",
      description:
        "EU/EEA licences are mutually recognised — keep your origin card. Non-EU licences must be exchanged at Transportstyrelsen / KBA within 12 months of registration.",
      category: "transport",
      dependsOn: ["reg-population"],
      deadlineDays: 90,
      isLegalRequirement: false,
      steps: ["Check exchange eligibility online", "Submit application + origin licence"],
      documentsNeeded: ["Origin driver's licence", "Personnummer"],
      officialLink: null,
      estimatedTime: "30 minutes + 4-6 weeks processing",
      cost: "~150-250 SEK",
      agentWhoAddedIt: "settling_in_transport",
      status: "locked",
      sortOrder: 1,
      deadlineType: "legal",
      walkthrough: {
        whatThisIs:
          "If you hold a non-EU/EEA driver's licence, most destinations require you to convert it to a local one within 6-12 months of registering as a resident. EU/EEA licences are mutually recognised and don't need conversion — keep your origin card.",
        whyItMatters:
          "Driving on an unconverted licence past the deadline makes you uninsured in an accident. Insurers can refuse to pay out and the police can fine you on the spot. After 12 months Sweden treats your origin licence as expired for driving purposes.",
        beforeYouStart: [
          "Original driver's licence (origin country)",
          "Personnummer / national ID",
          "Passport",
          "Translation of the licence if it's not in a Latin script",
          "Proof of residence",
        ],
        steps: [
          { text: "Check eligibility on the destination's transport authority site (Sweden: Transportstyrelsen; Germany: Führerscheinstelle). Some countries are direct-exchange; others require a written test." },
          { text: "Submit the application online or by post. Include your origin licence — it's surrendered during processing." },
          { text: "If a test is required, book it within the first 6 months — slots fill fast in summer." },
          { text: "Wait 4-6 weeks for the new card. If you fail to receive it, follow up by phone, not email — phone gets answers same-week." },
        ],
        commonMistakes: [
          "Driving with the origin licence past the conversion deadline — your insurance is void.",
          "Surrendering your origin licence without scanning it first — for some categories you need the original number on record.",
          "Assuming the EU/EEA card extends to the UK or Norway — UK is post-Brexit, separate rules apply; Norway is EEA, standard rules.",
        ],
        whatHappensNext:
          "Once the new card lands, update your auto insurance with the new licence number and notify your employer if you have a company car or driving allowance.",
        requiredDocumentCategories: ["passport_id"],
        links: [
          {
            url: "https://www.transportstyrelsen.se/en/road/Driving-licences/Foreign-driving-licence-holder/Exchange-a-foreign-driving-licence/",
            label: "Transportstyrelsen — licence exchange (SE)",
            linkType: "official_info",
            primary: true,
            description: "Official guidance on which non-EU/EEA licences are eligible for direct exchange in Sweden.",
            languageHint: "English",
          },
          {
            url: "https://www.transportstyrelsen.se/sv/vagtrafik/Korkort/Korkortsutbyte/",
            label: "Apply for licence exchange (SE)",
            linkType: "form",
            description: "The application form. Submitted by post; the original licence is surrendered during processing.",
            appointmentHint: "Scan your origin licence before mailing it — for some categories you'll need the original number on record again later.",
            languageHint: "Swedish",
          },
        ],
      },
    });
  }
  return { domain: "transport", tasks, agentName: "settling_in_transport" };
}

function familyTasks(profile: SettlingInProfile): SettlingTaskGroup {
  if (childrenAsNumber(profile) === 0) return { domain: "family", tasks: [], agentName: "settling_in_family" };
  const tasks: SettlingTask[] = [
    {
      taskKey: "family-school-confirm",
      title: "Confirm school placement in person",
      description:
        "If you secured a slot pre-departure, walk in to confirm with the address-registration paperwork. School cannot finalise enrolment without proof of address.",
      category: "family",
      dependsOn: ["reg-population"],
      deadlineDays: 14,
      isLegalRequirement: true,
      steps: ["Bring Anmeldebestätigung / personbevis", "Sign confirmation"],
      documentsNeeded: ["Address confirmation", "Children's documents"],
      officialLink: null,
      estimatedTime: "1 hour",
      cost: "Free",
      agentWhoAddedIt: "settling_in_family",
      status: "locked",
      sortOrder: 0,
      walkthrough: {
        requiredDocumentCategories: ["passport_id", "civil", "housing", "education"],
        whatThisIs:
          "If you secured a school slot before the move, the school usually requires an in-person confirmation visit once you have proof of address. That visit moves your child from 'pending placement' to enrolled.",
        whyItMatters:
          "Without confirmation by the start of the term, the slot is released to the waiting list. In Sweden + Germany this can mean your child is offered a school 30+ minutes from home or has to wait for the next term.",
        beforeYouStart: [
          "Personbevis / Anmeldebestätigung — the address-registration receipt",
          "Children's passports + birth certificates",
          "Vaccination records translated to English or destination language",
          "Custody documentation if both parents aren't on the registration",
        ],
        steps: [
          { text: "Email the school office to schedule the confirmation visit. Most schools have a designated 'mottagning' day each week." },
          { text: "Bring all originals plus a translated vaccination record." },
          { text: "Sign the enrolment forms on-site. Ask for the school year start date + uniform/material list in the same visit." },
          { text: "If the school offers a tour, take it — kids who tour before day-one have a smoother first week." },
        ],
        commonMistakes: [
          "Bringing only digital copies — schools want originals for the file copy.",
          "Forgetting the vaccination record — Sweden checks against the national schedule and asks for boosters if missing.",
          "Skipping the after-school care application (next task) — fritids slots fill in the same window as enrolment.",
        ],
        whatHappensNext:
          "Apply for fritidshem (after-school care) in the next task. Add the school's address + emergency contact to your phone and forward the term schedule to your employer for any school-meeting time-off requests.",
      },
    },
    {
      taskKey: "family-after-school",
      title: SE(profile.destination)
        ? "Apply for fritidshem (after-school care)"
        : "Apply for after-school care (Hort / equivalent)",
      description:
        "Fritids is municipal and applied for via your kommun's portal. Slots fill quickly — file the same day you confirm school.",
      category: "family",
      dependsOn: ["family-school-confirm"],
      deadlineDays: 21,
      isLegalRequirement: false,
      steps: ["Find your kommun's e-tjänst portal", "Submit application"],
      documentsNeeded: ["Personnummer", "Employment proof"],
      officialLink: null,
      estimatedTime: "30 minutes",
      cost: "Income-scaled fee",
      agentWhoAddedIt: "settling_in_family",
      status: "locked",
      sortOrder: 1,
    },
  ];
  return { domain: "family", tasks, agentName: "settling_in_family" };
}

function taxTasks(profile: SettlingInProfile): SettlingTaskGroup {
  const isSE = SE(profile.destination);
  const tasks: SettlingTask[] = [
    {
      taskKey: "tax-residency-declaration",
      title: isSE
        ? "Set Swedish tax residency at Skatteverket"
        : "Declare destination tax residency",
      description:
        "Folkbokföring already triggers tax residency in Sweden. Confirm in your Skatteverket account (via BankID) and review the auto-set tax table. In Germany you submit ELStAM via your employer.",
      category: "tax",
      dependsOn: ["reg-population", "bank-bankid"],
      deadlineDays: 60,
      isLegalRequirement: true,
      steps: [
        "Log into Skatteverket / Finanzamt portal",
        "Confirm tax-residency status",
        "Review tax-table assignment",
      ],
      documentsNeeded: ["Personnummer", "BankID"],
      officialLink: isSE ? "https://www.skatteverket.se/" : null,
      estimatedTime: "30 minutes",
      cost: "Free",
      agentWhoAddedIt: "settling_in_tax",
      status: "locked",
      sortOrder: 0,
      walkthrough: isSE
        ? {
            whatThisIs:
              "Confirming your Swedish tax residency at Skatteverket and reviewing the tax-table assignment that determines how much income tax is withheld each month. Folkbokföring already sets you as resident; this step is the verification + tweak.",
            whyItMatters:
              "If the wrong tax-table is applied (e.g. the high default), you over-pay 10-15% of gross income for months and only get it back at the next annual reconciliation in May. Pension contributions and welfare benefits also key off this status.",
            beforeYouStart: [
              "Personnummer + BankID",
              "Estimate of annual Swedish income (your employment contract has it)",
              "Tax-residency status in your origin country (still resident? exit-tax filed?)",
            ],
            steps: [
              { text: "Log in to skatteverket.se with BankID." },
              { text: "Open 'Mina sidor' → 'Skatter och deklaration' → 'Skattetabell'." },
              { text: "Verify the tax-table number assigned (e.g. 33, 34) matches your municipality. Compare with the rate in your contract." },
              { text: "If it's wrong, file a 'jämkningsansökan' (adjustment request) to fix the withholding. Approval is usually 1-2 weeks." },
              { text: "If you still have origin-country income, declare it under 'utländsk inkomst' so the tax treaty is applied correctly." },
            ],
            commonMistakes: [
              "Forgetting that Skatteverket sets the table automatically — you don't apply for it; you only adjust if it's wrong.",
              "Not declaring origin-country income — Sweden taxes worldwide income for residents, but treaties usually credit foreign tax. Hide it and it's a problem.",
              "Filing the jämkning request late — it kicks in from the next pay run, not retroactively for the year.",
            ],
            whatHappensNext:
              "Watch your next pay slip for the corrected withholding. Set a calendar note for early May next year to file the annual return (deklaration) — most employees just tap 'godkänn' in the BankID app.",
            requiredDocumentCategories: ["passport_id", "employment"],
            proofGuidance: {
              proofGoals: [
                {
                  id: "tax-residency",
                  label: "That you're a Swedish tax resident",
                  description: "Folkbokföring already triggers tax residency — this step is the verification + tweak. Skatteverket uses your passport + employment as the source of truth.",
                  acceptableEvidence: [
                    { category: "passport_id", description: "National passport" },
                  ],
                },
                {
                  id: "income-source",
                  label: "Your annual income source",
                  description: "Skatteverket assigns a tax table based on declared income — a contract gets the right table on file from the start.",
                  acceptableEvidence: [
                    { category: "employment", description: "Signed Swedish employment contract" },
                    { category: "employment", description: "Last 2-3 payslips (lönespecifikation)", note: "Available once the first payroll runs" },
                  ],
                },
              ],
            },
            links: [
              {
                url: "https://www.skatteverket.se/",
                label: "Skatteverket — Mina sidor",
                linkType: "portal",
                primary: true,
                description: "Log in with BankID, then go to 'Skatter och deklaration' → 'Skattetabell' to verify your tax-table assignment.",
                appointmentHint: "On the dashboard, look under 'Mina sidor' → 'Min skatt' → 'Skattetabell'. Compare the table number with your contract's bracket.",
                languageHint: "Swedish + English",
              },
              {
                url: "https://www.skatteverket.se/privat/skatter/arbeteochinkomst/jamkning.4.7afdf8a313b6e96e91530b.html",
                label: "Jämkning — adjust withholding (info)",
                linkType: "official_info",
                description: "When + how to file an adjustment if Skatteverket assigned the wrong tax-table.",
                languageHint: "Swedish + English",
              },
            ],
          }
        : undefined,
    },
  ];
  return { domain: "tax", tasks, agentName: "settling_in_tax" };
}

// ---- DAG stitching --------------------------------------------------------

/**
 * Topologically sort + critical-path mark the combined task list.
 *
 * Cycle protection: defensive — if any cycle slips through (e.g. a future
 * contributor introduces one), we fall back to ordering by deadlineDays so
 * the user still sees a sensible ordering.
 */
function topoSortWithCriticalPath(all: SettlingTask[]): SettlingTask[] {
  const byKey = new Map<string, SettlingTask>();
  for (const t of all) byKey.set(t.taskKey, t);

  // Drop dangling deps so a task referencing a non-existent prereq still
  // sorts (avoids permanent block from typo).
  for (const t of all) {
    t.dependsOn = t.dependsOn.filter((d) => byKey.has(d));
  }

  // Kahn's algorithm.
  const indeg = new Map<string, number>();
  for (const t of all) indeg.set(t.taskKey, 0);
  for (const t of all) {
    for (const dep of t.dependsOn) {
      indeg.set(t.taskKey, (indeg.get(t.taskKey) ?? 0) + 1);
      void dep;
    }
  }
  const ready: string[] = [];
  for (const [k, v] of indeg) if (v === 0) ready.push(k);
  ready.sort((a, b) => (byKey.get(a)!.deadlineDays - byKey.get(b)!.deadlineDays));

  const sorted: SettlingTask[] = [];
  while (ready.length) {
    const k = ready.shift()!;
    const t = byKey.get(k)!;
    sorted.push(t);
    for (const other of all) {
      if (other.dependsOn.includes(k)) {
        indeg.set(other.taskKey, (indeg.get(other.taskKey) ?? 1) - 1);
        if ((indeg.get(other.taskKey) ?? 0) === 0) {
          let inserted = false;
          for (let i = 0; i < ready.length; i++) {
            if (byKey.get(ready[i])!.deadlineDays > other.deadlineDays) {
              ready.splice(i, 0, other.taskKey);
              inserted = true;
              break;
            }
          }
          if (!inserted) ready.push(other.taskKey);
        }
      }
    }
  }

  if (sorted.length < all.length) {
    return [...all].sort((a, b) => a.deadlineDays - b.deadlineDays);
  }

  // Critical-path = legal requirement OR longest dependency chain ending in
  // the latest deadline. Cheap heuristic: any legal-requirement task or any
  // task that other tasks depend on.
  const isPrereq = new Set<string>();
  for (const t of all) for (const d of t.dependsOn) isPrereq.add(d);
  for (const t of sorted) {
    t.onCriticalPath = t.isLegalRequirement || isPrereq.has(t.taskKey);
  }

  // Re-flow status: if all deps are completed/skipped → available, else locked.
  for (const t of sorted) {
    if (t.dependsOn.length === 0) {
      if (t.status === "locked") t.status = "available";
    }
  }

  // Phase 1A — back-fill deadlineType so downstream consumers can rely on it
  // being present. Legal-requirement tasks default to "legal", everything
  // else to "practical". Authors who set the field explicitly win.
  for (const t of sorted) {
    if (!t.deadlineType) {
      t.deadlineType = t.isLegalRequirement ? "legal" : "practical";
    }
  }

  return sorted.map((t, i) => ({ ...t, sortOrder: i }));
}

export function generateSettlingInDAG(
  profile: SettlingInProfile,
  arrivalDate: Date,
): SettlingDAGResult {
  return composeSettlingInTimeline({
    profile,
    arrivalDate,
    researchedByDomain: {},
  });
}

// =============================================================
// Phase C1b — researched-aware composer entry point
// =============================================================
// Same SettlingDAGResult shape as generateSettlingInDAG above, but
// accepts a per-domain researched-output map. For each domain present
// in `researchedByDomain` whose bundle is usable (quality !== fallback
// AND emits at least one step), the deterministic *Tasks contributor
// is replaced with mapResearchedToSettlingTasks(bundle).
//
// PRECEDENCE RULE
// ---------------
//   researchedByDomain[domain] (usable)  →  WINS for that domain
//   else                                  →  legacy *Tasks(profile)
//
// "Usable" means quality !== "fallback" OR at least one step survived
// the post-arrival phase filter. A pure-fallback bundle is treated as
// missing — the deterministic DAG produces a better baseline than an
// empty list.
//
// What this composer does NOT do
// ------------------------------
//   - It does NOT auto-rewire legacy `dependsOn` references when a
//     domain migrates to research. Banking's deterministic
//     ["reg-population"] dep becomes dangling when registration is
//     researched (new keys are domain-prefixed). topoSort drops
//     dangling deps so the dependent surfaces earlier than legacy —
//     C1c will revisit if the regression bites in practice.
//   - It does NOT re-emit a stable taskKey for migrated domains; the
//     adapter intentionally uses the researched step.id as the key so
//     cross-specialist references chain naturally. Existing
//     completion-history rows on legacy keys won't auto-link.

export interface ComposeSettlingInArgs {
  profile: SettlingInProfile;
  arrivalDate: Date;
  /**
   * Per-domain researched output. Domains absent fall back to the
   * deterministic contributor. Today only "registration" + "banking"
   * are wired — other domains are silently ignored even if provided.
   */
  researchedByDomain: Partial<Record<SettlingDomain, ResearchedSteps>>;
}

const RESEARCHED_DOMAINS_C1: ReadonlySet<SettlingDomain> = new Set([
  "registration",
  "banking",
]);

function isUsableResearched(bundle: ResearchedSteps | undefined): bundle is ResearchedSteps {
  if (!bundle) return false;
  if (bundle.kind !== "steps") return false;
  if (bundle.quality === "fallback" && bundle.steps.length === 0) return false;
  return Array.isArray(bundle.steps);
}

export function composeSettlingInTimeline(
  args: ComposeSettlingInArgs,
): SettlingDAGResult {
  const { profile, arrivalDate, researchedByDomain } = args;
  void arrivalDate;

  const flat: SettlingTask[] = [];

  // Registration — researched first, deterministic otherwise.
  const regBundle = researchedByDomain.registration;
  if (RESEARCHED_DOMAINS_C1.has("registration") && isUsableResearched(regBundle)) {
    const mapped = mapResearchedToSettlingTasks(regBundle);
    if (mapped.length > 0) {
      flat.push(...mapped);
    } else {
      flat.push(...registrationTasks(profile).tasks);
    }
  } else {
    flat.push(...registrationTasks(profile).tasks);
  }

  // Banking — same shape.
  const bankBundle = researchedByDomain.banking;
  if (RESEARCHED_DOMAINS_C1.has("banking") && isUsableResearched(bankBundle)) {
    const mapped = mapResearchedToSettlingTasks(bankBundle);
    if (mapped.length > 0) {
      flat.push(...mapped);
    } else {
      flat.push(...bankingTasks(profile).tasks);
    }
  } else {
    flat.push(...bankingTasks(profile).tasks);
  }

  // Everything else stays deterministic in C1.
  flat.push(...housingTasks(profile).tasks);
  flat.push(...healthcareTasks(profile).tasks);
  flat.push(...employmentTasks(profile).tasks);
  flat.push(...transportTasks(profile).tasks);
  flat.push(...familyTasks(profile).tasks);
  flat.push(...taxTasks(profile).tasks);

  const sorted = topoSortWithCriticalPath(flat);
  const urgentDeadlines = sorted.filter((t) => t.isLegalRequirement && t.deadlineDays <= 14);
  return {
    tasks: sorted,
    dagValid: true,
    urgentDeadlines,
    totalTasks: sorted.length,
    legalRequirementsCount: sorted.filter((t) => t.isLegalRequirement).length,
  };
}
