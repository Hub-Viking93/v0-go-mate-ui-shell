// =====================================================================
// End-to-end multi-agent onboarding pipeline test (7 scenarios)
// =====================================================================
// Mirrors the spec at attached_assets/Pasted-Test-the-multi-agent-…
// Hits the live Anthropic integration via @workspace/agents. Uses
// in-memory ProfileStore + LogWriter so no DB/HTTP is involved.
//
// Run with:  pnpm exec tsx scripts/test-onboarding-pipeline.mts
//
// Each scenario:
//   1. Seeds an in-memory profile (and optionally a hinted pending field)
//   2. Calls orchestrateCollecting() — the same helper the chat route uses
//   3. Asserts on the structured result (attemptedField, fieldFilled,
//      additionalFieldsDetected, isOnboardingComplete, etc.)
//   4. Prints the full audit-row trail so failures are debuggable
//
// Exits 1 if any scenario fails (so it can gate Phase 3).
// =====================================================================

import { orchestrateCollecting } from "../artifacts/api-server/src/lib/gomate/orchestrate-collecting.js";
import {
  getRequiredFields,
  isProfileComplete,
  type AllFieldKey,
  type Profile,
} from "../artifacts/api-server/src/lib/gomate/profile-schema-snapshot.js";
import type { ProfileStore } from "../lib/agents/src/profile-store.js";
import type {
  AgentAuditRow,
  AgentRunLogRow,
  LogWriter,
} from "../lib/agents/src/types.js";

// ---------- in-memory dependencies -----------------------------------

class InMemoryLogWriter implements LogWriter {
  audits: AgentAuditRow[] = [];
  runs: AgentRunLogRow[] = [];
  async insertRunLog(row: AgentRunLogRow) { this.runs.push(row); }
  async insertAudit(row: AgentAuditRow)   { this.audits.push(row); }
}

class InMemoryProfileStore implements ProfileStore {
  store = new Map<string, Record<string, unknown>>();
  seed(profileId: string, initial: Record<string, unknown> = {}) {
    this.store.set(profileId, initial);
  }
  async getProfileData(profileId: string) {
    return this.store.get(profileId) ?? null;
  }
  async applyFieldPatch(profileId: string, patch: Record<string, unknown>) {
    const current = this.store.get(profileId);
    if (current === undefined) {
      throw new Error(`[in-memory] no row for ${profileId}`);
    }
    const merged = { ...current, ...patch };
    this.store.set(profileId, merged);
    return merged;
  }
}

// ---------- profile fixtures ----------------------------------------

/**
 * A digital-nomad profile that satisfies EVERY required predicate
 * without triggering posting/spouse/children/healthcare/pets cascades.
 * 19 keys; chosen specifically so we can prove "all required filled"
 * without a 100-key fixture.
 */
function buildCompleteDigitalNomadProfile(): Profile {
  return {
    name: "Axel",
    citizenship: "German",
    current_location: "Berlin, Germany",
    destination: "Portugal",
    target_city: "Lisbon",
    purpose: "digital_nomad",
    visa_role: "primary",
    duration: "1-3_years",
    timeline: "Q3 2026",
    moving_alone: "yes",
    savings_available: "50000",
    monthly_budget: "3000",
    healthcare_needs: "none",
    pets: "none",
    // digital_nomad cascade
    remote_income: "yes",
    income_source: "freelance",
    monthly_income: "5000",
    income_consistency: "stable",
    income_history_months: "24",
  };
}

/**
 * A work-posting profile primed up to (but not including) job_offer,
 * so hintedPendingField="job_offer" naturally lines up with what
 * getNextPendingField would compute.
 */
function buildPartialWorkProfile(): Profile {
  return {
    name: "Axel",
    citizenship: "German",
    current_location: "Berlin, Germany",
    destination: "Sweden",
    target_city: "Stockholm",
    purpose: "work",
    visa_role: "primary",
    duration: "1-3_years",
    timeline: "Q3 2026",
    moving_alone: "yes",
  };
}

// ---------- scenarios -----------------------------------------------

const PROFILE_ID = "00000000-0000-0000-0000-000000000099";

interface Scenario {
  num: number;
  label: string;
  initialProfile: Profile;
  hintedPendingField: AllFieldKey | null;
  lastAssistantMessage: string;
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  /**
   * Returns array of {ok, msg} assertions. ok=false marks the scenario
   * as failing but we still print the full audit trail.
   */
  assert: (
    result: Awaited<ReturnType<typeof orchestrateCollecting>>,
    finalProfile: Record<string, unknown>,
  ) => Array<{ ok: boolean; msg: string }>;
}

function includesAny(haystack: readonly string[], needles: readonly string[]): string[] {
  return needles.filter((n) => haystack.includes(n));
}

const SCENARIOS: Scenario[] = [
  // ---------------------------------------------------------------
  // Scenario 1 — bundled answer, pending=name
  // ---------------------------------------------------------------
  {
    num: 1,
    label: "Bundled answer — extracts name, flags additionals",
    initialProfile: {},
    hintedPendingField: "name",
    lastAssistantMessage: "Welcome! What's your name?",
    userMessage: "I'm Axel, 30 years old, moving to Sweden for work next year",
    history: [
      { role: "assistant", content: "Welcome! What's your name?" },
      { role: "user", content: "I'm Axel, 30 years old, moving to Sweden for work next year" },
    ],
    assert: (r, p) => {
      const additionals = r.mascotEvents
        .filter((e) => e.kind === "extraction_complete")
        .map((e) => e.field)
        .filter(Boolean) as string[];
      // Pull additionalFieldsDetected from the audit row (extractor row #0)
      // by reaching into the profileAfter check + raw audit value.
      return [
        { ok: r.attemptedField === "name", msg: `attemptedField=name (got ${r.attemptedField})` },
        { ok: r.fieldFilled === true, msg: `fieldFilled=true (got ${r.fieldFilled})` },
        { ok: p.name === "Axel", msg: `profile.name="Axel" (got ${JSON.stringify(p.name)})` },
        { ok: r.isOnboardingComplete === false, msg: "isOnboardingComplete=false" },
        { ok: r.nextPendingField !== null, msg: `nextPendingField is set (got ${r.nextPendingField})` },
      ];
    },
  },
  // ---------------------------------------------------------------
  // Scenario 2 — yes/no normalization with inferred birth_year
  // ---------------------------------------------------------------
  {
    num: 2,
    label: "Yes/no confirmation infers birth_year from prior age context",
    initialProfile: { name: "Axel" },
    hintedPendingField: "birth_year",
    lastAssistantMessage:
      "Just to confirm — you're 30 years old, so you were born around 1995, correct?",
    userMessage: "Yeah that's right",
    history: [
      { role: "assistant", content: "Welcome! What's your name?" },
      { role: "user", content: "I'm Axel, 30 years old, moving to Sweden for work next year" },
      {
        role: "assistant",
        content:
          "Just to confirm — you're 30 years old, so you were born around 1995, correct?",
      },
      { role: "user", content: "Yeah that's right" },
    ],
    assert: (r, p) => {
      // We want EITHER (a) extractor inferred 1995 (ideal) OR (b) extractor
      // returned null and QD re-asks (acceptable — extractor is honest).
      // We FAIL if extractor extracted some other random year.
      const filledYear = p.birth_year;
      const inferredOk =
        r.fieldFilled &&
        typeof filledYear !== "undefined" &&
        Number(filledYear) >= 1990 &&
        Number(filledYear) <= 2000;
      const reAskOk = !r.fieldFilled && r.attemptedField === "birth_year";
      return [
        { ok: r.attemptedField === "birth_year", msg: `attemptedField=birth_year (got ${r.attemptedField})` },
        {
          ok: inferredOk || reAskOk,
          msg: inferredOk
            ? `inferred birth_year=${filledYear} from age context ✓`
            : reAskOk
              ? `extractor returned null (honest "couldn't tell"), QD re-asks ✓`
              : `expected inferred 1990–2000 OR null re-ask, got fieldFilled=${r.fieldFilled} year=${filledYear}`,
        },
      ];
    },
  },
  // ---------------------------------------------------------------
  // Scenario 3 — invalid answer ("somewhere warm")
  // ---------------------------------------------------------------
  {
    num: 3,
    label: "Vague answer 'somewhere warm' for destination → null + clarify",
    initialProfile: { name: "Axel" },
    hintedPendingField: "destination",
    lastAssistantMessage: "Which country are you moving to?",
    userMessage: "I want to live somewhere warm",
    history: [
      { role: "assistant", content: "Which country are you moving to?" },
      { role: "user", content: "I want to live somewhere warm" },
    ],
    assert: (r, p) => [
      { ok: r.attemptedField === "destination", msg: `attemptedField=destination (got ${r.attemptedField})` },
      { ok: r.fieldFilled === false, msg: `fieldFilled=false (got ${r.fieldFilled})` },
      { ok: typeof p.destination === "undefined" || p.destination === null,
        msg: `profile.destination NOT written (got ${JSON.stringify(p.destination)})` },
      { ok: r.questionText.length > 0, msg: `QD asked a clarification (length ${r.questionText.length})` },
    ],
  },
  // ---------------------------------------------------------------
  // Scenario 4 — posting detected from job_offer answer
  // ---------------------------------------------------------------
  {
    num: 4,
    label: "Job-offer answer also reveals posting + posting_duration_months",
    initialProfile: buildPartialWorkProfile(),
    hintedPendingField: "job_offer",
    lastAssistantMessage:
      "Do you already have a job offer in Sweden, or are you still job hunting?",
    userMessage:
      "Yes, my company is sending me — it's a 14-month posting.",
    history: [
      {
        role: "assistant",
        content:
          "Do you already have a job offer in Sweden, or are you still job hunting?",
      },
      { role: "user", content: "Yes, my company is sending me — it's a 14-month posting." },
    ],
    assert: (r, p) => {
      // Extractor's additionalFieldsDetected is captured on the extractor
      // audit row (row 0). Pull it for assertion.
      return [
        { ok: r.attemptedField === "job_offer", msg: `attemptedField=job_offer (got ${r.attemptedField})` },
        { ok: r.fieldFilled === true, msg: `fieldFilled=true (got ${r.fieldFilled})` },
        { ok: p.job_offer === "yes", msg: `profile.job_offer="yes" (got ${JSON.stringify(p.job_offer)})` },
        // Note: orchestrator only WRITES the pending field. Additional
        // fields appear in the extractor audit row's additionalFieldsDetected
        // (we assert on that via the captured audit rows, see runScenario).
      ];
    },
  },
  // ---------------------------------------------------------------
  // Scenario 5 — schema bounding (one missing required field)
  // ---------------------------------------------------------------
  {
    num: 5,
    label: "Schema bounding — QD asks the one remaining required field",
    initialProfile: (() => {
      const p = buildCompleteDigitalNomadProfile();
      delete (p as Record<string, unknown>).monthly_income;
      return p;
    })(),
    hintedPendingField: null, // force orchestrator to compute via getNextPendingField
    lastAssistantMessage: "Got it. One more thing —",
    userMessage: "anything else you need to know?",
    history: [
      { role: "assistant", content: "Got it. One more thing —" },
      { role: "user", content: "anything else you need to know?" },
    ],
    assert: (r) => [
      {
        ok: r.attemptedField === "monthly_income",
        msg: `attemptedField=monthly_income — QD picked the one missing required field (got ${r.attemptedField})`,
      },
      {
        ok: r.isOnboardingComplete === false,
        msg: `isOnboardingComplete=false (one field still missing)`,
      },
      {
        // QD must pick a real schema field — never invent a non-schema topic
        ok: r.nextPendingField === null || r.nextPendingField === "monthly_income",
        msg: `nextPendingField is null OR monthly_income (got ${r.nextPendingField}) — never an invented topic`,
      },
    ],
  },
  // ---------------------------------------------------------------
  // Scenario 6 — completion (all required filled)
  // ---------------------------------------------------------------
  {
    num: 6,
    label: "Completion — fully complete profile short-circuits",
    initialProfile: buildCompleteDigitalNomadProfile(),
    hintedPendingField: null,
    lastAssistantMessage: "All set?",
    userMessage: "Anything else?",
    history: [
      { role: "assistant", content: "All set?" },
      { role: "user", content: "Anything else?" },
    ],
    assert: (r) => [
      { ok: r.isOnboardingComplete === true, msg: `isOnboardingComplete=true (got ${r.isOnboardingComplete})` },
      { ok: r.animationCue === "celebrating", msg: `animationCue="celebrating" (got ${r.animationCue})` },
      { ok: r.nextPendingField === null, msg: `nextPendingField=null` },
      {
        ok: r.mascotEvents.some((e) => e.kind === "onboarding_complete"),
        msg: `mascot stream emits onboarding_complete event`,
      },
    ],
  },
  // ---------------------------------------------------------------
  // Scenario 7 — heavy bundled extraction (the Spine test)
  // ---------------------------------------------------------------
  {
    num: 7,
    label:
      "Spine test — single bundled message; extracts pending + flags many additionals",
    initialProfile: {},
    hintedPendingField: "name",
    lastAssistantMessage: "Welcome! What's your name?",
    userMessage:
      "My name is Axel, I'm 30, moving from Germany to Sweden for a 14-month work posting with my wife and two kids.",
    history: [
      { role: "assistant", content: "Welcome! What's your name?" },
      {
        role: "user",
        content:
          "My name is Axel, I'm 30, moving from Germany to Sweden for a 14-month work posting with my wife and two kids.",
      },
    ],
    assert: (r, p) => [
      { ok: r.attemptedField === "name", msg: `attemptedField=name (got ${r.attemptedField})` },
      { ok: r.fieldFilled === true, msg: `fieldFilled=true (name written)` },
      { ok: p.name === "Axel", msg: `profile.name="Axel" (got ${JSON.stringify(p.name)})` },
      { ok: r.isOnboardingComplete === false, msg: `isOnboardingComplete=false` },
      { ok: r.nextPendingField !== null, msg: `nextPendingField is set` },
      // additionalFieldsDetected is asserted in runScenario from the audit row
    ],
  },
];

// ---------- runner --------------------------------------------------

function fmt(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

interface ScenarioOutcome {
  num: number;
  label: string;
  pass: boolean;
  failures: string[];
  additionalFieldsDetected?: string[];
}

async function runScenario(s: Scenario): Promise<ScenarioOutcome> {
  console.log("\n" + "=".repeat(78));
  console.log(`SCENARIO ${s.num} — ${s.label}`);
  console.log("=".repeat(78));
  console.log("initialProfile keys:", Object.keys(s.initialProfile).join(", ") || "(empty)");
  console.log("hintedPendingField:", s.hintedPendingField ?? "(none — recompute)");
  console.log("lastAssistantMessage:", JSON.stringify(s.lastAssistantMessage));
  console.log("userMessage:        ", JSON.stringify(s.userMessage));

  const writer = new InMemoryLogWriter();
  const store = new InMemoryProfileStore();
  store.seed(PROFILE_ID, { ...s.initialProfile } as Record<string, unknown>);

  const startedAt = Date.now();
  let result: Awaited<ReturnType<typeof orchestrateCollecting>>;
  try {
    result = await orchestrateCollecting({
      profileId: PROFILE_ID,
      profile: s.initialProfile,
      hintedPendingField: s.hintedPendingField,
      userMessage: s.userMessage,
      conversationHistory: s.history,
      lastAssistantMessage: s.lastAssistantMessage,
      store,
      writer,
    });
  } catch (err) {
    console.error("\n  EXCEPTION:", err instanceof Error ? err.message : err);
    return { num: s.num, label: s.label, pass: false, failures: ["EXCEPTION: " + String(err)] };
  }

  const elapsedMs = Date.now() - startedAt;
  const finalProfile = (await store.getProfileData(PROFILE_ID)) ?? {};

  // Pretty-print result summary
  console.log(`\nResult (${elapsedMs}ms):`);
  console.log("  attemptedField:      ", result.attemptedField);
  console.log("  fieldFilled:         ", result.fieldFilled);
  console.log("  isOnboardingComplete:", result.isOnboardingComplete);
  console.log("  nextPendingField:    ", result.nextPendingField);
  console.log("  animationCue:        ", result.animationCue);
  console.log("  questionText:        ", JSON.stringify(result.questionText));
  if (result.retryHint) console.log("  retryHint:           ", result.retryHint);
  console.log("  mascot stream:       ", result.mascotEvents.map((e) => e.kind).join(" → "));

  // additionalFieldsDetected is now surfaced on the orchestrator result.
  const additionalFieldsDetected: string[] = result.extractorAdditionalFieldsDetected.map(String);
  console.log("  additionalFieldsDetected:", additionalFieldsDetected.join(", ") || "(none)");

  // Audit trail
  console.log(`\nAudit rows captured (${writer.audits.length}):`);
  for (const [i, row] of writer.audits.entries()) {
    console.log(
      `  [${i}] ${row.agent_name.padEnd(16)} field=${String(row.field_or_output_key ?? "—").padEnd(22)}` +
        ` confidence=${String(row.confidence ?? "—").padEnd(10)} model=${row.model_used ?? "(none)"} ${row.wall_clock_ms ?? "?"}ms`,
    );
  }
  if (writer.runs.length > 0) {
    console.log(`Run-log rows: ${writer.runs.length} (${writer.runs.map((r) => `${r.agent_name}=${r.status}`).join(", ")})`);
  }

  // Final profile
  console.log("\nFinal in-memory profile:");
  console.log("  " + fmt(finalProfile).split("\n").join("\n  "));

  // ---------- assertions ----------
  const checks = s.assert(result, finalProfile as Record<string, unknown>);

  // For scenarios 1, 4, 7 — also assert on additionalFieldsDetected richness
  let extraChecks: { ok: boolean; msg: string }[] = [];
  if (s.num === 1) {
    const matches = includesAny(additionalFieldsDetected, [
      "birth_year",
      "destination",
      "purpose",
      "timeline",
    ]);
    extraChecks.push({
      ok: matches.length >= 2,
      msg: `additionalFieldsDetected ⊇ ≥2 of [birth_year, destination, purpose, timeline] — got [${matches.join(", ")}]`,
    });
  }
  if (s.num === 4) {
    const matches = includesAny(additionalFieldsDetected, [
      "posting_or_secondment",
      "posting_duration_months",
    ]);
    extraChecks.push({
      ok: matches.length >= 1,
      msg: `additionalFieldsDetected ⊇ ≥1 of [posting_or_secondment, posting_duration_months] — got [${matches.join(", ")}]`,
    });
  }
  if (s.num === 7) {
    const matches = includesAny(additionalFieldsDetected, [
      "birth_year",
      "current_location",
      "destination",
      "purpose",
      "posting_or_secondment",
      "posting_duration_months",
      "moving_alone",
      "spouse_joining",
      "children_count",
    ]);
    extraChecks.push({
      ok: matches.length >= 4,
      msg:
        `additionalFieldsDetected ⊇ ≥4 of {birth_year, current_location, destination, purpose, ` +
        `posting_or_secondment, posting_duration_months, moving_alone, spouse_joining, children_count} — ` +
        `got [${matches.join(", ")}]`,
    });
  }

  const allChecks = [...checks, ...extraChecks];
  console.log("\nAssertions:");
  const failures: string[] = [];
  for (const c of allChecks) {
    const mark = c.ok ? "  ✓" : "  ✗";
    console.log(`${mark} ${c.msg}`);
    if (!c.ok) failures.push(c.msg);
  }
  const pass = failures.length === 0;
  console.log(pass ? "\n  ➜ PASS" : `\n  ➜ FAIL (${failures.length} assertion${failures.length === 1 ? "" : "s"})`);

  return { num: s.num, label: s.label, pass, failures, additionalFieldsDetected };
}

async function main() {
  console.log("=".repeat(78));
  console.log("Multi-agent onboarding pipeline — end-to-end test (7 scenarios)");
  console.log("=".repeat(78));

  // Sanity: confirm the snapshot's complete-profile fixture really IS complete.
  const completeFixture = buildCompleteDigitalNomadProfile();
  const stillRequired = getRequiredFields(completeFixture).filter(
    (k) => !(k in completeFixture) || completeFixture[k] === undefined || completeFixture[k] === "",
  );
  if (stillRequired.length > 0) {
    console.error(
      `\n⚠️  buildCompleteDigitalNomadProfile() is MISSING required fields: ${stillRequired.join(", ")}` +
      `\n    Scenarios 5 & 6 will be invalid until this is fixed.`,
    );
  } else if (!isProfileComplete(completeFixture)) {
    console.error(`\n⚠️  isProfileComplete() returned false for the complete fixture.`);
  } else {
    console.log("\n[fixture check] buildCompleteDigitalNomadProfile() satisfies isProfileComplete() ✓");
  }

  const outcomes: ScenarioOutcome[] = [];
  for (const s of SCENARIOS) {
    outcomes.push(await runScenario(s));
  }

  // Final summary
  console.log("\n" + "=".repeat(78));
  console.log("FINAL SUMMARY");
  console.log("=".repeat(78));
  for (const o of outcomes) {
    const mark = o.pass ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${mark}  Scenario ${o.num} — ${o.label}`);
    if (!o.pass) {
      for (const f of o.failures) console.log(`         · ${f}`);
    }
  }
  const passed = outcomes.filter((o) => o.pass).length;
  console.log("-".repeat(78));
  console.log(`  ${passed}/${outcomes.length} scenarios passed`);
  console.log("=".repeat(78));

  if (passed !== outcomes.length) process.exit(1);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
