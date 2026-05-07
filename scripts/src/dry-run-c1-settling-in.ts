// =============================================================
// Dry-run harness — Phase C1a/b: settling-in adapter + composer
// =============================================================
// Pure offline. Builds hand-crafted ResearchedSteps fixtures for
// registration + banking, runs them through composeSettlingInTimeline,
// asserts:
//
//   • registration tasks come from research (taskKey starts with
//     "registration:")
//   • banking tasks come from research (taskKey starts with "banking:")
//   • housing/healthcare/employment etc. still come from the
//     deterministic DAG (taskKey from legacy short-form)
//   • cross-domain prerequisites flow through topoSort (banking step
//     gated by registration step appears AFTER it)
//   • when a researched bundle is fallback+empty, the composer
//     transparently falls back to the deterministic contributor for
//     that domain
//
// USAGE:
//   pnpm --filter @workspace/scripts dry-run-c1
// =============================================================

import {
  composeSettlingInTimeline,
  type ResearchedSteps,
  type SettlingInProfile,
  type SettlingTask,
} from "@workspace/agents";

function banner(label: string): void {
  const line = "─".repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}\n`);
}

const profile: SettlingInProfile = {
  destination: "Sweden",
  target_city: "Stockholm",
  citizenship: "Philippines",
  purpose: "settle",
  visa_role: "primary",
  posting_or_secondment: "no",
  pets: "none",
  bringing_vehicle: "no",
  children_count: 0,
  spouse_joining: "yes",
  prescription_medications: "no",
  driver_license_origin: "Philippines",
};

// ---- Fixture: registration researched output -------------------------

const registrationBundle: ResearchedSteps = {
  kind: "steps",
  domain: "registration",
  retrievedAt: new Date().toISOString(),
  quality: "full",
  sources: [
    {
      url: "https://www.skatteverket.se/servicelankar/otherlanguages/inenglish.4.12815e4f14a62bc048f4edc.html",
      domain: "skatteverket.se",
      retrievedAt: new Date().toISOString(),
      kind: "authority",
    },
    {
      url: "https://www.bankid.com/en",
      domain: "bankid.com",
      retrievedAt: new Date().toISOString(),
      kind: "institution",
    },
  ],
  summary: "Registration steps after arriving in Sweden.",
  steps: [
    {
      id: "registration:population-register",
      title: "Register at Skatteverket → personnummer",
      description:
        "Walk into a local Skatteverket office with passport, residence-permit decision, and your housing contract. You leave with a personnummer.",
      deadlineWindow: { phase: "first_30d", daysAfterArrival: 7, legalDeadlineDays: 7 },
      appliesWhen: { always: true },
      prerequisites: [],
      documentIds: ["registration:proof-of-address"],
      walkthrough: [
        "Book the appointment online if available",
        "Bring passport + residence permit + housing contract + employment letter",
        "Submit the SKV 7665 form",
        "Receive personnummer confirmation",
      ],
      bottleneck: "Showing up with photocopies — Skatteverket only accepts originals.",
      sources: [
        "https://www.skatteverket.se/servicelankar/otherlanguages/inenglish.4.12815e4f14a62bc048f4edc.html",
      ],
    },
    {
      id: "registration:id-card",
      title: "Apply for Swedish ID card",
      description:
        "Required for BankID enrolment. Walk into a Skatteverket office with personnummer + passport.",
      deadlineWindow: { phase: "first_30d", daysAfterArrival: 14 },
      appliesWhen: { always: true },
      prerequisites: ["registration:population-register"],
      documentIds: [],
      walkthrough: ["Book appointment", "Bring passport + personnummer", "Pay fee, get card 2-3 weeks later"],
      sources: [
        "https://www.skatteverket.se/servicelankar/otherlanguages/inenglish.4.12815e4f14a62bc048f4edc.html",
      ],
    },
  ],
  documents: [
    {
      id: "registration:proof-of-address",
      label: "Housing contract / sublet agreement",
      category: "housing",
      apostille: "not_needed",
      translation: "not_needed",
      leadTimeDays: 0,
      sources: [
        "https://www.skatteverket.se/servicelankar/otherlanguages/inenglish.4.12815e4f14a62bc048f4edc.html",
      ],
    },
  ],
};

// ---- Fixture: banking researched output ------------------------------

const bankingBundle: ResearchedSteps = {
  kind: "steps",
  domain: "banking",
  retrievedAt: new Date().toISOString(),
  quality: "full",
  sources: [
    {
      url: "https://www.fi.se/en/",
      domain: "fi.se",
      retrievedAt: new Date().toISOString(),
      kind: "authority",
    },
    {
      url: "https://www.bankid.com/en",
      domain: "bankid.com",
      retrievedAt: new Date().toISOString(),
      kind: "institution",
    },
  ],
  summary: "Banking setup for moving to Sweden.",
  steps: [
    {
      id: "banking:open-local-account",
      title: "Open a Swedish bank account",
      description:
        "Once you have personnummer, open an account at SEB, Swedbank, Handelsbanken, or Nordea.",
      deadlineWindow: { phase: "first_30d", daysAfterArrival: 14 },
      appliesWhen: { always: true },
      prerequisites: ["registration:population-register"],
      documentIds: ["banking:proof-of-residence"],
      walkthrough: [
        "Book branch appointment",
        "Bring passport + personnummer + housing contract",
        "Apply for debit card and online banking",
      ],
      bottleneck: "Some banks require an in-person visit; book early — slots are weeks out.",
      sources: ["https://www.fi.se/en/"],
    },
    {
      id: "banking:enrol-bankid",
      title: "Enrol BankID",
      description:
        "Apply via your bank's app once your account is active. BankID is the digital ID for nearly every Swedish service.",
      deadlineWindow: { phase: "first_30d", daysAfterArrival: 21 },
      appliesWhen: { always: true },
      prerequisites: ["banking:open-local-account"],
      documentIds: [],
      walkthrough: ["Open your bank's mobile app", "Apply for BankID", "Activate via 1-time code"],
      sources: ["https://www.bankid.com/en"],
    },
  ],
  documents: [
    {
      id: "banking:proof-of-residence",
      label: "Proof of residence (lease + personnummer letter)",
      category: "housing",
      apostille: "not_needed",
      translation: "not_needed",
      leadTimeDays: 0,
      sources: ["https://www.fi.se/en/"],
    },
  ],
};

// ---- Test runner -----------------------------------------------------

function findTask(tasks: SettlingTask[], taskKey: string): SettlingTask | undefined {
  return tasks.find((t) => t.taskKey === taskKey);
}

function check(label: string, ok: boolean, details = ""): boolean {
  console.log(`${ok ? "✅" : "❌"} ${label}${details ? ` — ${details}` : ""}`);
  return ok;
}

function runScenarioFullyResearched(): boolean {
  banner("Scenario A — registration + banking researched, others deterministic");
  const result = composeSettlingInTimeline({
    profile,
    arrivalDate: new Date("2028-05-17"),
    researchedByDomain: {
      registration: registrationBundle,
      banking: bankingBundle,
    },
  });

  let pass = true;
  console.log(`  total tasks: ${result.totalTasks}`);
  const popReg = findTask(result.tasks, "registration:population-register");
  const idCard = findTask(result.tasks, "registration:id-card");
  const openAcc = findTask(result.tasks, "banking:open-local-account");
  const bankid = findTask(result.tasks, "banking:enrol-bankid");

  pass = check("registration:population-register present (researched)", !!popReg) && pass;
  pass = check("registration:id-card present (researched)", !!idCard) && pass;
  pass = check("banking:open-local-account present (researched)", !!openAcc) && pass;
  pass = check("banking:enrol-bankid present (researched)", !!bankid) && pass;

  pass = check(
    'no legacy taskKey "reg-population" present when registration is researched',
    !findTask(result.tasks, "reg-population"),
  ) && pass;
  pass = check(
    'no legacy taskKey "bank-open-account" present when banking is researched',
    !findTask(result.tasks, "bank-open-account"),
  ) && pass;

  // Cross-domain prereq survives the topoSort.
  if (openAcc && popReg) {
    pass = check(
      "banking:open-local-account.dependsOn includes registration:population-register",
      openAcc.dependsOn.includes("registration:population-register"),
    ) && pass;
    pass = check(
      "registration:population-register sortOrder < banking:open-local-account sortOrder",
      popReg.sortOrder < openAcc.sortOrder,
      `pop=${popReg.sortOrder} acc=${openAcc.sortOrder}`,
    ) && pass;
  }

  // Other domains keep their deterministic shape.
  const housingFirst = result.tasks.find((t) => t.category === "housing");
  pass = check(
    'housing taskKey is legacy short form (e.g. "housing-*"), not "housing:*"',
    !!housingFirst && !housingFirst.taskKey.startsWith("housing:"),
    `first housing task: ${housingFirst?.taskKey}`,
  ) && pass;

  const healthcareFirst = result.tasks.find((t) => t.category === "healthcare");
  pass = check(
    "healthcare task category present",
    !!healthcareFirst,
    `first: ${healthcareFirst?.taskKey}`,
  ) && pass;

  // Researched task carries source attribution.
  if (popReg) {
    pass = check(
      "registration:population-register has officialLink set to Skatteverket",
      popReg.officialLink?.includes("skatteverket.se") ?? false,
      popReg.officialLink ?? "null",
    ) && pass;
    pass = check(
      "registration:population-register agentWhoAddedIt = registration_specialist",
      popReg.agentWhoAddedIt === "registration_specialist",
      popReg.agentWhoAddedIt,
    ) && pass;
    pass = check(
      "registration:population-register has legalDeadlineDays → isLegalRequirement = true",
      popReg.isLegalRequirement === true,
    ) && pass;
  }
  if (openAcc) {
    pass = check(
      "banking:open-local-account agentWhoAddedIt = banking_helper",
      openAcc.agentWhoAddedIt === "banking_helper",
      openAcc.agentWhoAddedIt,
    ) && pass;
    pass = check(
      "banking:open-local-account walkthrough.steps populated",
      (openAcc.walkthrough?.steps?.length ?? 0) > 0,
      `${openAcc.walkthrough?.steps?.length ?? 0} steps`,
    ) && pass;
  }

  return pass;
}

function runScenarioFallbackResearched(): boolean {
  banner("Scenario B — registration is fallback-empty → deterministic wins");
  const fallbackBundle: ResearchedSteps = {
    kind: "steps",
    domain: "registration",
    retrievedAt: new Date().toISOString(),
    quality: "fallback",
    fallbackReason: "scrape_failed",
    sources: [],
    summary: "fallback",
    steps: [],
    documents: [],
  };
  const result = composeSettlingInTimeline({
    profile,
    arrivalDate: new Date("2028-05-17"),
    researchedByDomain: { registration: fallbackBundle },
  });

  let pass = true;
  pass = check(
    'fallback registration → deterministic "reg-population" present',
    !!findTask(result.tasks, "reg-population"),
  ) && pass;
  pass = check(
    "fallback registration → no researched-id leaks through",
    !findTask(result.tasks, "registration:population-register"),
  ) && pass;
  return pass;
}

function runScenarioPartial(): boolean {
  banner("Scenario C — only banking researched, registration deterministic");
  const result = composeSettlingInTimeline({
    profile,
    arrivalDate: new Date("2028-05-17"),
    researchedByDomain: { banking: bankingBundle },
  });

  let pass = true;
  // Registration deterministic.
  pass = check('"reg-population" deterministic present', !!findTask(result.tasks, "reg-population")) && pass;
  // Banking researched.
  pass = check(
    '"banking:open-local-account" researched present',
    !!findTask(result.tasks, "banking:open-local-account"),
  ) && pass;

  // Cross-domain: banking_acc.dependsOn was ["registration:population-register"]
  // but registration is deterministic ("reg-population"). The dangling dep
  // gets dropped by topoSort. Banking still surfaces.
  const acc = findTask(result.tasks, "banking:open-local-account");
  pass = check(
    "banking:open-local-account survives despite dangling researched-prereq",
    !!acc,
  ) && pass;
  pass = check(
    "banking:open-local-account.dependsOn was filtered (registration:* dep dropped)",
    !!acc && !acc.dependsOn.includes("registration:population-register"),
    JSON.stringify(acc?.dependsOn ?? []),
  ) && pass;
  return pass;
}

function main(): void {
  banner("Phase C1a/b dry-run");
  const results = [
    runScenarioFullyResearched(),
    runScenarioFallbackResearched(),
    runScenarioPartial(),
  ];
  const pass = results.every(Boolean);
  banner(pass ? "✅ all scenarios passed" : "❌ scenario failure");
  if (!pass) process.exit(1);
}

main();
