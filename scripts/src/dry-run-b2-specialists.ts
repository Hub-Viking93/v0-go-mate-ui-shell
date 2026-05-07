// =============================================================
// Dry-run harness — Phase B2 researched specialists
// =============================================================
// Validates that documentsSpecialistV2 + housingSpecialistV2:
//   1. compile against the new ResearchedSteps contract
//   2. fetch canonical sources from _sources.ts
//   3. produce parseable JSON output from the LLM
//   4. emit step + document ids that respect the namespace rule
//   5. attach per-step / per-document source URLs that map back
//      to the top-level sources[] block
//
// USAGE:
//   pnpm --filter @workspace/scripts dry-run-b2 [country] [purpose]
//
// REQUIRES (.env or env vars):
//   - ANTHROPIC_API_KEY  (router.ts)
//   - FIRECRAWL_API_KEY  (scrapeOfficialSource)
//
// COST: 2 LLM calls (sonnet-4-5) + ~6 Firecrawl scrapes. ≈ $0.10.
// =============================================================

import {
  documentsSpecialistV2,
  housingSpecialistV2,
  type ResearchedOutput,
  type ResearchedSpecialistInput,
  type ResearchedSteps,
  type SpecialistDomain,
} from "@workspace/agents";

const country = process.argv[2] ?? "Sweden";
const purpose = (process.argv[3] ?? "settle") as
  | "settle"
  | "work"
  | "study"
  | "digital_nomad";

const profile: ResearchedSpecialistInput["profile"] = {
  destination: country,
  target_city: country === "Sweden" ? "Stockholm" : null,
  citizenship: "Philippines",
  current_location: "Philippines",
  purpose,
  visa_role: "primary",
  moving_alone: "yes",
  settlement_reason: purpose === "settle" ? "family_reunion" : null,
  partner_citizenship: purpose === "settle" ? country : null,
  partner_visa_status: purpose === "settle" ? "citizen" : null,
  relationship_type: purpose === "settle" ? "fiance" : null,
  preferred_currency: "PHP",
  savings_available: "100000",
  monthly_budget: null,
  prior_visa: "yes",
  prior_visa_type: "Tourist Visa",
  criminal_record: "no",
  duration: "permanent",
  timeline: "2028-05-17",
  pets: "none",
};

const input: ResearchedSpecialistInput = {
  profile,
  budgetMs: 90_000,
};

function banner(label: string): void {
  const line = "─".repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}\n`);
}

function checkContract(out: ResearchedOutput, expectedDomain: SpecialistDomain): string[] {
  const errors: string[] = [];
  if (out.kind !== "steps" && out.kind !== "advisory") {
    errors.push(`kind must be "steps" or "advisory" — got ${String((out as { kind?: unknown }).kind)}`);
  }
  if (out.domain !== expectedDomain) {
    errors.push(`domain must be "${expectedDomain}" — got "${out.domain}"`);
  }
  if (typeof out.retrievedAt !== "string" || Number.isNaN(Date.parse(out.retrievedAt))) {
    errors.push(`retrievedAt must be ISO 8601 string — got "${out.retrievedAt}"`);
  }
  if (out.quality !== "full" && out.quality !== "partial" && out.quality !== "fallback") {
    errors.push(`quality must be full | partial | fallback — got "${out.quality}"`);
  }
  if (!Array.isArray(out.sources)) {
    errors.push(`sources must be an array`);
  }
  if (typeof out.summary !== "string" || out.summary.trim().length === 0) {
    errors.push(`summary must be a non-empty string`);
  }
  if (out.kind === "steps") {
    const s = out as ResearchedSteps;
    if (!Array.isArray(s.steps)) {
      errors.push(`steps must be an array`);
    } else {
      for (const step of s.steps) {
        if (!step.id.startsWith(`${expectedDomain}:`)) {
          errors.push(`step.id "${step.id}" missing namespace prefix "${expectedDomain}:"`);
        }
      }
    }
    if (!Array.isArray(s.documents)) {
      errors.push(`documents must be an array`);
    } else {
      for (const doc of s.documents) {
        if (!doc.id.startsWith(`${expectedDomain}:`)) {
          errors.push(`document.id "${doc.id}" missing namespace prefix "${expectedDomain}:"`);
        }
      }
    }
  }
  return errors;
}

function checkSourceAttribution(out: ResearchedSteps): string[] {
  const errors: string[] = [];
  const allowedUrls = new Set(out.sources.map((s) => s.url));
  for (const step of out.steps) {
    for (const url of step.sources) {
      if (!allowedUrls.has(url)) {
        errors.push(`step ${step.id} cites URL not in sources[]: ${url}`);
      }
    }
  }
  for (const doc of out.documents) {
    for (const url of doc.sources) {
      if (!allowedUrls.has(url)) {
        errors.push(`document ${doc.id} cites URL not in sources[]: ${url}`);
      }
    }
  }
  return errors;
}

function summary(label: string, out: ResearchedOutput): void {
  banner(`${label} — output summary`);
  console.log(`domain:        ${out.domain}`);
  console.log(`kind:          ${out.kind}`);
  console.log(`quality:       ${out.quality}${out.fallbackReason ? ` (${out.fallbackReason})` : ""}`);
  console.log(`retrievedAt:   ${out.retrievedAt}`);
  console.log(`sources:       ${out.sources.length}`);
  for (const s of out.sources as ResearchedOutput["sources"]) {
    console.log(`  • ${s.kind.padEnd(11)} ${s.url}`);
  }
  console.log(`summary:       ${out.summary}`);
  if (out.kind === "steps") {
    const s = out as ResearchedSteps;
    console.log(`steps:         ${s.steps.length}`);
    for (const step of s.steps) {
      console.log(
        `  • ${step.id.padEnd(48)} phase=${step.deadlineWindow.phase} sources=${step.sources.length}`,
      );
    }
    console.log(`documents:     ${s.documents.length}`);
    for (const doc of s.documents) {
      console.log(`  • ${doc.id.padEnd(48)} ${doc.category} apostille=${doc.apostille} translation=${doc.translation}`);
    }
    if (s.structuredFacts) {
      console.log(`structuredFacts:`, s.structuredFacts);
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `Phase B2 dry-run\n  country = ${country}\n  purpose = ${purpose}\n  profile = Filipino citizen, ${country === "Sweden" ? "Stockholm" : "main city"}, ${purpose}`,
  );

  banner("1/2  documentsSpecialistV2");
  const docs = await documentsSpecialistV2(input);
  summary("documentsSpecialistV2", docs);
  const docErrors = [
    ...checkContract(docs, "documents"),
    ...(docs.kind === "steps" ? checkSourceAttribution(docs as ResearchedSteps) : []),
  ];
  if (docErrors.length > 0) {
    console.log("\n❌ contract violations:");
    for (const e of docErrors) console.log(`  • ${e}`);
  } else {
    console.log("\n✅ contract clean");
  }

  banner("2/2  housingSpecialistV2");
  const housing = await housingSpecialistV2(input);
  summary("housingSpecialistV2", housing);
  const housingErrors = [
    ...checkContract(housing, "housing"),
    ...(housing.kind === "steps" ? checkSourceAttribution(housing as ResearchedSteps) : []),
  ];
  if (housingErrors.length > 0) {
    console.log("\n❌ contract violations:");
    for (const e of housingErrors) console.log(`  • ${e}`);
  } else {
    console.log("\n✅ contract clean");
  }

  banner("done");
  const totalErrors = docErrors.length + housingErrors.length;
  if (totalErrors > 0) {
    console.log(`Total: ${totalErrors} issue(s).`);
    process.exit(1);
  } else {
    console.log("Both specialists conform to the contract.");
  }
}

main().catch((err) => {
  console.error("\n❌ dry-run threw:", err);
  process.exit(1);
});
