// Wave 2.1 manual test runner — Extractor → Validator → Profile Writer chain.
// Runs the two scenarios called out in the spec against the live Anthropic
// integration with in-memory ProfileStore + LogWriter (no DB needed).
//
// Run with:  pnpm exec tsx scripts/test-extractor-chain.mts

import { extractField } from "../lib/agents/src/extractor.js";
import { validate } from "../lib/agents/src/validator.js";
import { writeProfileField } from "../lib/agents/src/profile-writer.js";
import type { ProfileStore } from "../lib/agents/src/profile-store.js";
import type {
  AgentAuditRow,
  AgentRunLogRow,
  LogWriter,
} from "../lib/agents/src/types.js";

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

const PROFILE_ID = "00000000-0000-0000-0000-000000000001";
const USER_MESSAGE = "I'm 30 years old, moving to Sweden";

const writer = new InMemoryLogWriter();
const store = new InMemoryProfileStore();
store.seed(PROFILE_ID, { /* empty starting profile */ });

function fmt(obj: unknown) { return JSON.stringify(obj, null, 2); }

async function runChain(label: string, pendingField: "name" | "birth_year") {
  console.log("\n" + "=".repeat(72));
  console.log(label);
  console.log("=".repeat(72));
  console.log(`userMessage:  "${USER_MESSAGE}"`);
  console.log(`pendingField: "${pendingField}"`);

  // 1) Extractor
  const ex = await extractField(USER_MESSAGE, pendingField, undefined, {
    writer,
    profileId: PROFILE_ID,
  });
  console.log("\n[1] Extractor result:");
  console.log("    " + fmt(ex).split("\n").join("\n    "));

  // 2) Validator (pure code)
  if (ex.value === null) {
    console.log("\n[2] Validator: SKIPPED (extractor returned null).");
    console.log("    additionalFieldsDetected →", ex.additionalFieldsDetected);
    console.log("\n[3] Profile Writer: SKIPPED (no validated value).");
    return;
  }
  const v = validate(ex.value, pendingField);
  console.log("\n[2] Validator result:");
  console.log("    " + fmt(v).split("\n").join("\n    "));

  if (!v.valid) {
    console.log("\n[3] Profile Writer: SKIPPED (validation failed).");
    return;
  }

  // 3) Profile Writer (pure code)
  const wr = await writeProfileField(
    PROFILE_ID,
    pendingField,
    v.normalizedValue,
    ex.confidence,
    USER_MESSAGE,
    v.rulesApplied,
    { store, writer },
  );
  console.log("\n[3] Profile Writer result:");
  console.log("    " + fmt(wr).split("\n").join("\n    "));
}

async function main() {
  await runChain("Scenario A — pendingField=birth_year (full chain runs)", "birth_year");
  await runChain("Scenario B — pendingField=name (extractor null → chain stops)", "name");

  console.log("\n" + "=".repeat(72));
  console.log("Final in-memory profile_data:");
  console.log("=".repeat(72));
  console.log(fmt(await store.getProfileData(PROFILE_ID)));

  console.log("\n" + "=".repeat(72));
  console.log(`Captured ${writer.audits.length} audit rows:`);
  console.log("=".repeat(72));
  for (const [i, row] of writer.audits.entries()) {
    console.log(`\n  audit[${i}]:`);
    const trimmed = {
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
      validation_rules_applied: row.validation_rules_applied,
      wall_clock_ms: row.wall_clock_ms,
      tokens_used: row.tokens_used,
    };
    console.log("  " + fmt(trimmed).split("\n").join("\n  "));
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
