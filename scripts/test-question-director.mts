// Wave 2.2 manual test runner — Question Director planning logic.
// Runs the three scenarios from the spec against the live Anthropic
// integration with an in-memory LogWriter (no DB needed).
//
// Run with:  pnpm exec tsx scripts/test-question-director.mts

import {
  askNext,
  type Profile as QDProfile,
} from "../lib/agents/src/question-director.js";
import type {
  AgentAuditRow,
  AgentRunLogRow,
  LogWriter,
} from "../lib/agents/src/types.js";
import {
  getRequiredFields,
  EMPTY_PROFILE,
  type Profile as RealProfile,
} from "../artifacts/gomate/src/lib/gomate/profile-schema.js";

class InMemoryLogWriter implements LogWriter {
  audits: AgentAuditRow[] = [];
  runs: AgentRunLogRow[] = [];
  async insertRunLog(row: AgentRunLogRow) {
    this.runs.push(row);
  }
  async insertAudit(row: AgentAuditRow) {
    this.audits.push(row);
  }
}

const PROFILE_ID = "00000000-0000-0000-0000-000000000002";

function fmt(obj: unknown) {
  return JSON.stringify(obj, null, 2);
}

// Bridge: artifacts/gomate's getRequiredFields takes the strict Profile
// type; askNext() receives the loose QDProfile. Both shapes share the
// same key set, so this is a safe widening cast at the call site (which
// is exactly where the chat route will perform it in production).
function getRequiredFieldsBridge(profile: QDProfile) {
  return getRequiredFields({ ...EMPTY_PROFILE, ...profile } as RealProfile);
}

async function scenario(
  label: string,
  profile: QDProfile,
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  additional?: ReturnType<typeof getRequiredFields>,
) {
  console.log(`\n=================  ${label}  =================`);
  console.log("PROFILE:", fmt(profile));
  console.log("HISTORY:", fmt(history));
  if (additional) console.log("additionalFieldsDetected:", fmt(additional));

  const writer = new InMemoryLogWriter();
  const result = await askNext(profile, history, additional, {
    getRequiredFields: getRequiredFieldsBridge,
    writer,
    profileId: PROFILE_ID,
  });

  console.log("\nRESULT:", fmt(result));
  console.log("\nAUDIT ROW (truncated):", fmt({
    agent_name: writer.audits[0]?.agent_name,
    model_used: writer.audits[0]?.model_used,
    phase: writer.audits[0]?.phase,
    field_or_output_key: writer.audits[0]?.field_or_output_key,
    confidence: writer.audits[0]?.confidence,
    value: writer.audits[0]?.value,
    wall_clock_ms: writer.audits[0]?.wall_clock_ms,
    tokens_used: writer.audits[0]?.tokens_used,
  }));
  if (writer.runs.length > 0) {
    console.log("RUN-LOG (fallback path triggered):", fmt(writer.runs));
  }
}

// ---- SCENARIO 1: empty profile → should ask for "name" first ----
await scenario("Scenario 1 — empty profile", {}, []);

// ---- SCENARIO 2: name + destination + purpose=work + posting=yes + 14 mo
//                  → should ask home_country_employer or a1_certificate_status next ----
const partialProfile: QDProfile = {
  name: "Axel",
  destination: "Sweden",
  purpose: "work",
  posting_or_secondment: "yes",
  posting_duration_months: "14",
  visa_role: "primary",
  current_location: "Germany",
  citizenship: "German",
  target_city: "Stockholm",
  timeline: "Q3 2026",
  moving_alone: "no",
  job_offer: "yes",
  job_field: "Software engineering",
};
await scenario(
  "Scenario 2 — partially-filled (Axel, Sweden, posted worker)",
  partialProfile,
  [
    { role: "assistant", content: "Welcome. What's your name?" },
    { role: "user", content: "I'm Axel" },
    { role: "assistant", content: "Where are you moving to?" },
    {
      role: "user",
      content:
        "From Germany to Sweden, 14-month posting from my current employer.",
    },
  ],
);

// ---- SCENARIO 3: profile complete → isOnboardingComplete=true, no question ----
// Stub `getRequiredFields` to return [] for this scenario — guarantees the
// terminal branch runs without us having to hand-fill 80+ conditional fields.
const writer3 = new InMemoryLogWriter();
console.log(`\n=================  Scenario 3 — profile complete  =================`);
const completeResult = await askNext(
  partialProfile,
  [],
  undefined,
  {
    getRequiredFields: () => [],
    writer: writer3,
    profileId: PROFILE_ID,
  },
);
console.log("RESULT:", fmt(completeResult));
console.log(
  "AUDIT ROWS (should be empty — no LLM call when complete):",
  fmt(writer3.audits),
);

console.log("\n--- Done ---");
