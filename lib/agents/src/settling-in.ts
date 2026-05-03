// =============================================================
// @workspace/agents — Phase 7 settling-in task graph
// =============================================================
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

  return sorted.map((t, i) => ({ ...t, sortOrder: i }));
}

export function generateSettlingInDAG(
  profile: SettlingInProfile,
  arrivalDate: Date,
): SettlingDAGResult {
  void arrivalDate;
  const groups = [
    registrationTasks(profile),
    bankingTasks(profile),
    housingTasks(profile),
    healthcareTasks(profile),
    employmentTasks(profile),
    transportTasks(profile),
    familyTasks(profile),
    taxTasks(profile),
  ];
  const flat: SettlingTask[] = [];
  for (const g of groups) flat.push(...g.tasks);
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
