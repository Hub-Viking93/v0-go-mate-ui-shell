// Wave 2.0 manual test runner for the Extractor agent.
// Runs the three required test invocations against the live Anthropic
// integration, captures the audit rows in an in-memory LogWriter, and
// prints the results + audit rows in a readable shape.
//
// Usage:  pnpm exec tsx scripts/test-extractor.mts

import { extractField } from "../lib/agents/src/extractor.js";
import type {
  AgentAuditRow,
  AgentRunLogRow,
  LogWriter,
} from "../lib/agents/src/types.js";

class InMemoryLogWriter implements LogWriter {
  audits: AgentAuditRow[] = [];
  runs: AgentRunLogRow[] = [];
  async insertRunLog(row: AgentRunLogRow): Promise<void> {
    this.runs.push(row);
  }
  async insertAudit(row: AgentAuditRow): Promise<void> {
    this.audits.push(row);
  }
}

const writer = new InMemoryLogWriter();
const PROFILE_ID = "00000000-0000-0000-0000-000000000001"; // synthetic test id

interface TestCase {
  label: string;
  userMessage: string;
  pendingField: Parameters<typeof extractField>[1];
  lastAIMessage?: string;
}

const tests: TestCase[] = [
  {
    label: "T1 — pendingField=name, user volunteers age + destination",
    userMessage: "I'm 30 years old and moving to Spain",
    pendingField: "name",
    lastAIMessage: "Hi! What's your name?",
  },
  {
    label: "T2 — pendingField=name, explicit answer",
    userMessage: "My name is Axel",
    pendingField: "name",
    lastAIMessage: "What should I call you?",
  },
  {
    label: "T3 — pendingField=destination, yes/no field test (pets)",
    userMessage: "Madrid, Spain. Also bringing my dog Max.",
    pendingField: "destination",
    lastAIMessage: "Which country and city are you moving to?",
  },
];

function fmt(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

async function main() {
  console.log("=".repeat(72));
  console.log("Wave 2.0 Extractor agent — live test run");
  console.log("=".repeat(72));

  for (const t of tests) {
    console.log(`\n--- ${t.label} ---`);
    console.log(`userMessage:   "${t.userMessage}"`);
    console.log(`pendingField:  "${t.pendingField}"`);
    if (t.lastAIMessage) console.log(`lastAIMessage: "${t.lastAIMessage}"`);

    const start = Date.now();
    const result = await extractField(t.userMessage, t.pendingField, t.lastAIMessage, {
      writer,
      profileId: PROFILE_ID,
    });
    const ms = Date.now() - start;
    console.log(`\n  result (${ms}ms):`);
    console.log("  " + fmt(result).split("\n").join("\n  "));
  }

  console.log("\n" + "=".repeat(72));
  console.log(`Captured ${writer.audits.length} audit rows.`);
  console.log("=".repeat(72));
  for (const [i, row] of writer.audits.entries()) {
    console.log(`\n  audit[${i}]:`);
    console.log("  " + fmt({
      profile_id: row.profile_id,
      agent_name: row.agent_name,
      model_used: row.model_used,
      phase: row.phase,
      field_or_output_key: row.field_or_output_key,
      value: row.value,
      confidence: row.confidence,
      source_user_message: row.source_user_message,
      prompt_hash: row.prompt_hash,
      response_hash: row.response_hash,
      wall_clock_ms: row.wall_clock_ms,
      tokens_used: row.tokens_used,
    }).split("\n").join("\n  "));
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
