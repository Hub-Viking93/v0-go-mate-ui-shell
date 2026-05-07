// =============================================================
// Dry-run harness — Phase B3 healthcare specialist
// =============================================================
// Runs healthcareSpecialistV2 against the Filipino-Stockholm-settle
// fixture and asserts contract clean + source attribution. C2 will
// wire it into the post-move researched cache.
//
// USAGE:
//   pnpm --filter @workspace/scripts dry-run-b3 [country]
//
// REQUIRES (.env or env vars):
//   - ANTHROPIC_API_KEY (router.ts)
//   - FIRECRAWL_API_KEY (scrapeOfficialSource)
//
// COST: 1 LLM call (sonnet) + ~3 Firecrawl scrapes. ≈ $0.05.
// =============================================================

import {
  healthcareSpecialistV2,
  type ResearchedOutput,
  type ResearchedSpecialistInput,
  type ResearchedSteps,
  type SpecialistDomain,
} from "@workspace/agents";

const country = process.argv[2] ?? "Sweden";

const profile: ResearchedSpecialistInput["profile"] = {
  destination: country,
  target_city: country === "Sweden" ? "Stockholm" : null,
  citizenship: "Philippines",
  current_location: "Philippines",
  purpose: "settle",
  visa_role: "primary",
  moving_alone: "yes",
  children_count: 0,
  spouse_joining: "yes",
  healthcare_needs: "low",
  prescription_medications: "none",
  chronic_condition_description: null,
  duration: "permanent",
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
      console.log(`  • ${doc.id.padEnd(48)} ${doc.category} apostille=${doc.apostille}`);
    }
    if (s.structuredFacts) {
      console.log(`structuredFacts:`, s.structuredFacts);
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `Phase B3 dry-run\n  country = ${country}\n  profile = Filipino citizen, ${country === "Sweden" ? "Stockholm" : "main city"}, settle, low healthcare needs`,
  );

  banner("1/1  healthcareSpecialistV2");
  const hc = await healthcareSpecialistV2(input);
  summary("healthcareSpecialistV2", hc);
  const errs = [
    ...checkContract(hc, "healthcare"),
    ...(hc.kind === "steps" ? checkSourceAttribution(hc as ResearchedSteps) : []),
  ];
  if (errs.length > 0) {
    console.log("\n❌ contract violations:");
    for (const e of errs) console.log(`  • ${e}`);
    process.exit(1);
  }
  console.log("\n✅ contract clean");

  // Domain-specific sanity checks. These are descriptive, not blocking
  // — the LLM may emit different shapes per run, but a healthy
  // healthcare bundle should hit at least one of these:
  if (hc.kind === "steps") {
    const s = hc as ResearchedSteps;
    const titles = s.steps.map((x) => x.title.toLowerCase()).join(" | ");
    const checks: Array<[string, boolean]> = [
      ["mentions vårdcentral / primary care / GP", /vårdcentral|primary care|gp\b|family doctor/.test(titles)],
      ["mentions Försäkringskassan / health card / insurance", /försäkringskassan|health card|insurance/.test(titles)],
      ["has at least one prereq referencing registration:*", s.steps.some((x) => x.prerequisites.some((p) => p.startsWith("registration:")))],
      ["structuredFacts has system_type", typeof s.structuredFacts?.system_type === "string"],
    ];
    console.log("\nDomain sanity:");
    for (const [label, ok] of checks) console.log(`  ${ok ? "✓" : "·"} ${label}`);
  }
}

main().catch((err) => {
  console.error("\n❌ dry-run threw:", err);
  process.exit(1);
});
