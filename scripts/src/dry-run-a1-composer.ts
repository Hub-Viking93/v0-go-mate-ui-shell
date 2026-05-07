// =============================================================
// Dry-run harness — Phase A1 pre-departure composer
// =============================================================
// Validates that:
//   1. The legacy → researched adapter can read the persisted
//      visa_research + local_requirements_research shapes and emit
//      ResearchedSteps the composer accepts.
//   2. composePreDepartureTimeline produces ActionView-shaped
//      output where research-derived actions carry per-item
//      sourceUrl and domains without research fall back to the
//      legacy hardcoded contributions cleanly.
//   3. No exception escapes when the adapter is fed empty / missing
//      input.
//
// USAGE:
//   pnpm --filter @workspace/scripts dry-run-a1
//
// Pure offline — no LLM, no Firecrawl, no Supabase. Calls the
// composer with hand-built fixtures so we can assert exact
// downstream behaviour.
// =============================================================

import {
  adaptVisaResearchToSteps,
  adaptLocalRequirementsToSteps,
  composePreDepartureTimeline,
  type PreDepartureProfile,
  type ResearchedStepsLite,
  type VisaPathwayLite,
} from "@workspace/agents";

function banner(label: string): void {
  const line = "─".repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}\n`);
}

const profile: PreDepartureProfile = {
  destination: "Sweden",
  target_city: "Stockholm",
  citizenship: "Philippines",
  current_location: "Philippines",
  purpose: "settle",
  visa_role: "primary",
  moving_alone: "yes",
  pets: "none",
  bringing_vehicle: "no",
  origin_lease_status: "renting",
  posting_or_secondment: "no",
  prescription_medications: null,
};
const moveDate = new Date("2028-05-17");
const visa: VisaPathwayLite = {
  name: "Family-reunification residence permit",
  type: "family",
  estimatedProcessingWeeks: 12,
  officialUrl: "https://www.migrationsverket.se/English/",
};

// ---- Fixture: persisted visa_research column --------------------------
//
// Mirrors the shape research-persistence.ts emits today.

const visaResearchFixture = {
  destination: "Sweden",
  citizenship: "Philippines",
  purpose: "settle",
  researchedAt: "2026-05-07T10:13:00Z",
  summary: "Family-reunification permit via Migrationsverket.",
  visaOptions: [
    {
      name: "Residence permit — family reunification",
      type: "family",
      recommended: true,
      processingTime: "12 weeks",
      officialLink: "https://www.migrationsverket.se/English/",
      sourceUrls: [
        "https://www.migrationsverket.se/English/",
        "https://www.swedenabroad.se/en/about-sweden-non-swedish-citizens/",
      ],
      applicationSteps: [
        "Apply online via Migrationsverket's portal once relationship + cohabitation evidence is ready.",
        "Submit biometrics at the Swedish embassy or application centre in your origin country.",
        "Provide proof of relationship: photos, correspondence, joint travel records, witness statements.",
        "Demonstrate self-sufficiency or sponsor support — savings statement counts as evidence.",
      ],
      requirements: [
        "Genuine, durable relationship with the Swedish citizen partner",
        "Self-sufficiency or sponsor support",
      ],
    },
  ],
};

// ---- Fixture: persisted local_requirements_research column ------------

const localReqFixture = {
  destination: "Sweden",
  researchedAt: "2026-05-07T10:13:00Z",
  summary: "11 local requirements across 3 categories.",
  categories: [
    {
      category: "Documents",
      icon: "FileText",
      items: [
        {
          title: "Apostilled birth certificate",
          description: "Issued by the Philippine Statistics Authority. Required for Migrationsverket family-reunification application.",
          steps: [
            "Request from the Philippine Statistics Authority.",
            "Get apostille certification from the Department of Foreign Affairs.",
            "Get certified translation into Swedish or English.",
          ],
          documents: ["Birth certificate apostille"],
          estimatedTime: "Complete before departure",
          officialLink: "https://www.migrationsverket.se/English/",
          tips: ["Apostille older than 6 months may be rejected — re-issue close to filing."],
        },
        {
          title: "Police clearance certificate",
          description: "Required for primary applicants on family-reunification + work + study permits.",
          steps: ["Apply at NBI Manila or local equivalent.", "Apostille via DFA.", "Translate."],
          documents: ["Police clearance"],
          estimatedTime: "Complete before departure",
          officialLink: "https://www.migrationsverket.se/English/",
        },
      ],
    },
    {
      category: "Housing",
      icon: "Home",
      items: [
        {
          title: "Secure first-hand or sub-let in Stockholm",
          description: "Stockholm rental market is tight; first-hand contracts via Bostadsförmedlingen take years on the queue.",
          steps: [
            "Register with Bostadsförmedlingen as soon as possible.",
            "Use Blocket Bostad / Qasa / Samtrygg for sub-let listings.",
            "Plan for 1-3 month deposit + first month upfront.",
          ],
          documents: ["Lease agreement"],
          estimatedTime: "Complete before departure",
          officialLink: "https://bostad.stockholm.se/",
        },
      ],
    },
    {
      category: "Banking",
      icon: "CreditCard",
      items: [
        {
          title: "Open Wise / Revolut account before move",
          description: "Bridge account for first 30-60 days while waiting on Swedish account.",
          steps: ["Sign up online with passport.", "Order multi-currency card.", "Fund with starter SEK balance."],
          documents: ["Passport"],
          estimatedTime: "Complete before departure",
          officialLink: "https://wise.com/",
        },
      ],
    },
  ],
};

// ---- Adapter sanity checks --------------------------------------------

function assertContains(label: string, list: string[], substr: string): boolean {
  const ok = list.some((x) => x.toLowerCase().includes(substr.toLowerCase()));
  console.log(`  ${ok ? "✅" : "❌"} ${label}: list contains "${substr}"`);
  return ok;
}

async function main(): Promise<void> {
  let allPass = true;
  banner("Phase A1 dry-run · pre-departure composer");

  // ---- 1. Visa adapter --------------------------------------------------
  banner("1/4  adaptVisaResearchToSteps");
  const visaSteps = adaptVisaResearchToSteps(visaResearchFixture);
  console.log(`domain:   ${visaSteps.domain}`);
  console.log(`quality:  ${visaSteps.quality}`);
  console.log(`steps:    ${visaSteps.steps.length}`);
  console.log(`sources:  ${visaSteps.sources.length}`);
  for (const s of visaSteps.steps) {
    console.log(`  • ${s.id.padEnd(50)} sourceCount=${s.sources.length}`);
  }
  if (visaSteps.domain !== "visa") { allPass = false; console.log("  ❌ wrong domain"); }
  if (visaSteps.quality !== "full") { allPass = false; console.log("  ❌ expected quality=full"); }
  if (visaSteps.steps.length !== 4) { allPass = false; console.log(`  ❌ expected 4 steps, got ${visaSteps.steps.length}`); }
  for (const step of visaSteps.steps) {
    if (!step.id.startsWith("visa:")) { allPass = false; console.log(`  ❌ step.id missing namespace: ${step.id}`); }
    if (step.sources.length === 0) { allPass = false; console.log(`  ❌ step ${step.id} has no source attribution`); }
  }

  // ---- 2. Local-requirements adapter -----------------------------------
  banner("2/4  adaptLocalRequirementsToSteps");
  const localAdapted = adaptLocalRequirementsToSteps(localReqFixture);
  for (const [domain, bundle] of Object.entries(localAdapted)) {
    console.log(`${domain}:    quality=${bundle.quality} steps=${bundle.steps.length} sources=${bundle.sources.length}`);
  }
  if (!localAdapted.documents) { allPass = false; console.log("  ❌ missing documents bundle"); }
  if (!localAdapted.housing)   { allPass = false; console.log("  ❌ missing housing bundle"); }
  if (!localAdapted.banking)   { allPass = false; console.log("  ❌ missing banking bundle"); }

  // ---- 3. Composer wires research-derived drafts ------------------------
  banner("3/4  composePreDepartureTimeline (with research)");
  const researchedByDomain: Record<string, ResearchedStepsLite> = {};
  if (visaSteps.steps.length > 0) researchedByDomain.visa = visaSteps;
  for (const [domain, bundle] of Object.entries(localAdapted)) {
    if (bundle.steps.length > 0) researchedByDomain[domain] = bundle;
  }
  const researchedTimeline = composePreDepartureTimeline({
    profile,
    visa,
    moveDate,
    researchedByDomain,
  });
  console.log(`actions:           ${researchedTimeline.actions.length}`);
  console.log(`longestLeadWeeks:  ${researchedTimeline.longestLeadTimeWeeks}`);

  const visaActions = researchedTimeline.actions.filter((a) => a.id.startsWith("visa:"));
  const docsActions = researchedTimeline.actions.filter((a) => a.id.startsWith("documents:"));
  const housingActions = researchedTimeline.actions.filter((a) => a.id.startsWith("housing:"));
  const bankingActions = researchedTimeline.actions.filter((a) => a.id.startsWith("banking:"));
  console.log(`research-derived:  visa=${visaActions.length} docs=${docsActions.length} housing=${housingActions.length} banking=${bankingActions.length}`);

  // Per-item source attribution sanity
  const withSource = researchedTimeline.actions.filter((a) => a.officialSourceUrl !== null && a.id.includes(":"));
  console.log(`actions with sourceUrl: ${withSource.length} / ${researchedTimeline.actions.length}`);

  // Spot-check that a known migrationsverket-attributed action came through
  if (!visaActions.some((a) => a.officialSourceUrl?.includes("migrationsverket.se"))) {
    allPass = false;
    console.log("  ❌ no visa action carries migrationsverket source URL");
  }
  if (!housingActions.some((a) => a.officialSourceUrl?.includes("bostad.stockholm.se"))) {
    allPass = false;
    console.log("  ❌ no housing action carries bostad.stockholm.se source URL");
  }

  // Categories present in titles (sanity that titles match research, not generic templates)
  const titles = researchedTimeline.actions.map((a) => a.title.toLowerCase());
  assertContains("visa narrative migrated", titles, "migrationsverket");
  assertContains("housing narrative migrated", titles, "stockholm");
  if (!titles.some((t) => t.includes("apostille"))) {
    allPass = false;
    console.log("  ❌ apostille document title not surfaced from research");
  }

  // Legacy domains still flow (pet/posted-worker/health/vehicle/lease/shipping
  // wouldn't apply to this profile, but alwaysApplicable should).
  const alwaysAction = researchedTimeline.actions.find((a) => a.id.startsWith("always-"));
  if (!alwaysAction) {
    allPass = false;
    console.log("  ❌ alwaysApplicable contributions disappeared");
  } else {
    console.log(`  ✅ alwaysApplicable still present (${alwaysAction.id})`);
  }

  // ---- 4. Empty-input safety -------------------------------------------
  banner("4/4  empty-input safety");
  const emptyVisa = adaptVisaResearchToSteps(null);
  const emptyLocal = adaptLocalRequirementsToSteps(null);
  console.log(`adaptVisaResearchToSteps(null): quality=${emptyVisa.quality} steps=${emptyVisa.steps.length}`);
  console.log(`adaptLocalRequirementsToSteps(null): keys=${Object.keys(emptyLocal).length}`);
  if (emptyVisa.quality !== "fallback") { allPass = false; console.log("  ❌ expected fallback on null visa input"); }
  if (Object.keys(emptyLocal).length !== 0) { allPass = false; console.log("  ❌ expected empty map on null local input"); }

  // Composer with NO researched input — pure legacy fallback path
  const legacyTimeline = composePreDepartureTimeline({
    profile,
    visa,
    moveDate,
    researchedByDomain: {},
  });
  console.log(`legacy-only timeline: ${legacyTimeline.actions.length} actions (no research)`);
  if (legacyTimeline.actions.length === 0) {
    allPass = false;
    console.log("  ❌ legacy composer produced 0 actions");
  }

  // Compare counts
  console.log(`\nresearched timeline: ${researchedTimeline.actions.length} actions`);
  console.log(`legacy timeline:     ${legacyTimeline.actions.length} actions`);

  banner("done");
  if (allPass) {
    console.log("✅ All assertions passed. Composer accepts adapter output cleanly + falls back when research is missing.");
  } else {
    console.log("❌ Some assertions failed (see above).");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ dry-run threw:", err);
  process.exit(1);
});
