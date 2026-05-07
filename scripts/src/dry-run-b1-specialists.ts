// =============================================================
// Dry-run harness — Phase B1 researched specialists
// =============================================================
// Validates that registration_specialist + bankingSpecialistV2:
//   1. compile against the new ResearchedSteps contract
//   2. fetch canonical sources from _sources.ts
//   3. produce parseable JSON output from the LLM
//   4. emit step + document ids that respect the namespace rule
//   5. attach per-step / per-document source URLs that map back
//      to the top-level sources[] block
//
// USAGE:
//   pnpm --filter @workspace/scripts dry-run-b1 [country] [purpose]
//
//   country  — full English name ("Sweden", "Germany", "Japan").
//              Defaults to "Sweden".
//   purpose  — "settle" | "work" | "study" | "digital_nomad".
//              Defaults to "settle".
//
// REQUIRES (.env or env vars):
//   - ANTHROPIC_API_KEY  (or whatever the integrations layer routes
//                         to — see lib/agents/src/router.ts)
//   - FIRECRAWL_API_KEY  (for scrapeOfficialSource)
//
// COST: 2 LLM calls (sonnet-4-5) + ~6 Firecrawl scrapes. ≈ $0.10.
//
// This run does NOT touch Supabase, NOT write audit rows, NOT
// trigger the orchestrator. It's a pure shape-validation pass.
// =============================================================

import {
  registrationSpecialist,
  bankingSpecialistV2,
  composeQuality,
  validateAndNormaliseDocuments,
  validateAndNormaliseSteps,
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

// Fixture profile mirrors the Filipino-citizen-moves-to-Sweden test
// case we ran the orchestrator against in the refinement work. Keep
// it minimal — only the fields specialists actually read.
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
        `  • ${step.id.padEnd(40)} phase=${step.deadlineWindow.phase} sources=${step.sources.length}`,
      );
    }
    console.log(`documents:     ${s.documents.length}`);
    for (const doc of s.documents) {
      console.log(`  • ${doc.id.padEnd(40)} ${doc.category} apostille=${doc.apostille}`);
    }
    if (s.structuredFacts) {
      console.log(`structuredFacts:`, s.structuredFacts);
    }
  }
}

// ---- Synthetic-drift validation ---------------------------------------
//
// The two specialists below exercise the happy path. The defenses
// added in B1-hardening (source-ref filter + negative-deadline
// rejection + quality downgrade on drift) only trigger when the LLM
// produces drift — which the URL_GUARDRAIL system prompt makes
// rare. To prove the defense is actually wired we feed a synthetic
// "bad" payload directly through the validators here.

function syntheticDriftCheck(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  let passed = true;

  const allowedUrls = new Set(["https://allowed.example/a", "https://allowed.example/b"]);

  // 1. Steps with: fabricated URL, negative deadline, bad enum, bad
  //    predicate. Expect: URL dropped, negatives stripped, bad-enum
  //    step entirely dropped, predicate reset.
  const fakeSteps = [
    {
      id: "registration:good",
      title: "Good step",
      description: "Conforms to contract.",
      deadlineWindow: { phase: "first_30d", daysAfterArrival: 14, weeksBeforeMove: -1 }, // -1 should be stripped
      appliesWhen: { always: true },
      prerequisites: [],
      documentIds: [],
      sources: [
        "https://allowed.example/a",       // ok
        "https://fabricated.example/zzz",  // should be dropped
      ],
    },
    {
      id: "registration:bad-phase",
      title: "Bad phase",
      description: "Should be dropped — phase not in whitelist.",
      deadlineWindow: { phase: "first_69h" }, // not a valid phase
      appliesWhen: { always: true },
      prerequisites: [],
      documentIds: [],
      sources: ["https://allowed.example/a"],
    },
    {
      id: "wrongdomain:bad",
      title: "Wrong namespace",
      description: "Should be dropped — id not registration:* prefixed.",
      deadlineWindow: { phase: "first_30d" },
      appliesWhen: { always: true },
      prerequisites: [],
      documentIds: [],
      sources: [],
    },
    {
      id: "registration:bad-predicate",
      title: "Bad predicate",
      description: "Predicate is structurally invalid; specialist should reset to {always:true} but keep the step.",
      deadlineWindow: { phase: "ongoing" },
      appliesWhen: { weirdOp: { foo: "bar" } }, // not a valid ProfilePredicate
      prerequisites: [],
      documentIds: [],
      sources: ["https://allowed.example/b"],
    },
  ];

  const stepsResult = validateAndNormaliseSteps(fakeSteps, "registration", allowedUrls);
  // Expectations:
  //   • good + bad-predicate kept → 2 steps
  //   • bad-phase + wrongdomain dropped → dropped = 2
  //   • predicatesReset = 1 (bad-predicate)
  //   • sourceRefsDropped = 1 (the fabricated URL on the good step)
  //   • good step's deadlineWindow has no weeksBeforeMove (-1 stripped)
  if (stepsResult.steps.length !== 2) {
    passed = false;
    messages.push(`expected 2 surviving steps, got ${stepsResult.steps.length}`);
  }
  if (stepsResult.dropped !== 2) {
    passed = false;
    messages.push(`expected dropped=2, got ${stepsResult.dropped}`);
  }
  if (stepsResult.predicatesReset !== 1) {
    passed = false;
    messages.push(`expected predicatesReset=1, got ${stepsResult.predicatesReset}`);
  }
  if (stepsResult.sourceRefsDropped !== 1) {
    passed = false;
    messages.push(`expected sourceRefsDropped=1, got ${stepsResult.sourceRefsDropped}`);
  }
  const good = stepsResult.steps.find((s) => s.id === "registration:good");
  if (good) {
    if ("weeksBeforeMove" in good.deadlineWindow) {
      passed = false;
      messages.push(`expected weeksBeforeMove=-1 to be stripped from "registration:good"`);
    }
    if (good.sources.length !== 1 || good.sources[0] !== "https://allowed.example/a") {
      passed = false;
      messages.push(
        `expected "registration:good".sources to be exactly [allowed.example/a], got ${JSON.stringify(good.sources)}`,
      );
    }
  } else {
    passed = false;
    messages.push(`"registration:good" did not survive validation`);
  }
  const badPred = stepsResult.steps.find((s) => s.id === "registration:bad-predicate");
  if (badPred) {
    const aw = badPred.appliesWhen as { always?: boolean };
    if (!aw.always) {
      passed = false;
      messages.push(`expected bad-predicate.appliesWhen to reset to {always:true}`);
    }
  }

  // 2. Documents with bad category, negative leadTimeDays, fabricated URL.
  const fakeDocs = [
    {
      id: "registration:passport",
      label: "Passport",
      category: "identity",
      apostille: "not_needed",
      translation: "not_needed",
      leadTimeDays: 14,
      sources: ["https://allowed.example/a", "https://fabricated.example/x"],
    },
    {
      id: "registration:bad-cat",
      label: "Bad category",
      category: "personal", // not in whitelist
      apostille: "not_needed",
      translation: "not_needed",
      leadTimeDays: 7,
      sources: [],
    },
    {
      id: "registration:negative-lead",
      label: "Negative lead time",
      category: "identity",
      apostille: "not_needed",
      translation: "not_needed",
      leadTimeDays: -3,
      sources: [],
    },
  ];
  const docsResult = validateAndNormaliseDocuments(fakeDocs, "registration", allowedUrls);
  if (docsResult.documents.length !== 1) {
    passed = false;
    messages.push(`expected 1 surviving document, got ${docsResult.documents.length}`);
  }
  if (docsResult.dropped !== 2) {
    passed = false;
    messages.push(`expected docs dropped=2, got ${docsResult.dropped}`);
  }
  if (docsResult.sourceRefsDropped !== 1) {
    passed = false;
    messages.push(`expected docs sourceRefsDropped=1, got ${docsResult.sourceRefsDropped}`);
  }

  // 3. composeQuality — drift downgrades full → partial.
  const composed = composeQuality({
    fetchQuality: "full",
    parseFailed: false,
    droppedSteps: 2,
    droppedDocs: 2,
    droppedSourceRefs: 2,
  });
  if (composed.quality !== "partial") {
    passed = false;
    messages.push(`composeQuality(drift, full) → expected "partial", got "${composed.quality}"`);
  }

  // 4. composeQuality — only source-ref drift also triggers partial.
  const composedRefsOnly = composeQuality({
    fetchQuality: "full",
    parseFailed: false,
    droppedSteps: 0,
    droppedDocs: 0,
    droppedSourceRefs: 1,
  });
  if (composedRefsOnly.quality !== "partial") {
    passed = false;
    messages.push(
      `composeQuality(only source-ref drift, full) → expected "partial", got "${composedRefsOnly.quality}"`,
    );
  }

  return { passed, messages };
}

async function main(): Promise<void> {
  console.log(
    `Phase B1 dry-run\n  country = ${country}\n  purpose = ${purpose}\n  profile = Filipino citizen, ${country === "Sweden" ? "Stockholm" : "main city"}, ${purpose}`,
  );

  banner("0/3  synthetic-drift validation (offline)");
  const drift = syntheticDriftCheck();
  if (drift.passed) {
    console.log("✅ source-ref filter, negative-deadline rejection, predicate reset + quality downgrade all wired.");
  } else {
    console.log("❌ defense gaps:");
    for (const m of drift.messages) console.log(`  • ${m}`);
  }

  banner("1/3  registration_specialist");
  const reg = await registrationSpecialist(input);
  summary("registration_specialist", reg);
  const regErrors = [
    ...checkContract(reg, "registration"),
    ...(reg.kind === "steps" ? checkSourceAttribution(reg as ResearchedSteps) : []),
  ];
  if (regErrors.length > 0) {
    console.log("\n❌ contract violations:");
    for (const e of regErrors) console.log(`  • ${e}`);
  } else {
    console.log("\n✅ contract clean");
  }

  banner("2/3  bankingSpecialistV2");
  const bank = await bankingSpecialistV2(input);
  summary("bankingSpecialistV2", bank);
  const bankErrors = [
    ...checkContract(bank, "banking"),
    ...(bank.kind === "steps" ? checkSourceAttribution(bank as ResearchedSteps) : []),
  ];
  if (bankErrors.length > 0) {
    console.log("\n❌ contract violations:");
    for (const e of bankErrors) console.log(`  • ${e}`);
  } else {
    console.log("\n✅ contract clean");
  }

  banner("done");
  const totalErrors = regErrors.length + bankErrors.length + (drift.passed ? 0 : 1);
  if (totalErrors > 0) {
    console.log(`Total: ${totalErrors} issue(s).`);
    process.exit(1);
  } else {
    console.log("Defenses verified + both specialists conform to the contract.");
  }
}

main().catch((err) => {
  console.error("\n❌ dry-run threw:", err);
  process.exit(1);
});
