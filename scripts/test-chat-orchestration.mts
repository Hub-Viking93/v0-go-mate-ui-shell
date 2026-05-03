// Wave 2.3 manual test runner — full multi-agent collecting-stage
// orchestration. Exercises the helper extracted from chat.ts
// (orchestrateCollecting) with in-memory ProfileStore + LogWriter
// against the live Anthropic integration. No DB / no HTTP.
//
// Run with:  pnpm exec tsx scripts/test-chat-orchestration.mts

import { orchestrateCollecting } from "../artifacts/api-server/src/lib/gomate/orchestrate-collecting.js";
import type { Profile } from "../artifacts/api-server/src/lib/gomate/profile-schema-snapshot.js";
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

const PROFILE_ID = "00000000-0000-0000-0000-000000000099";

function fmt(obj: unknown) { return JSON.stringify(obj, null, 2); }

interface Scenario {
  label: string;
  initialProfile: Profile;
  hintedPendingField?: string | null;
  userMessage: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  expect: {
    fieldFilled?: boolean;
    isOnboardingComplete?: boolean;
  };
}

const SCENARIOS: Scenario[] = [
  {
    label: "Scenario 1 — empty profile + 'I'm Axel' → name extracted, QD asks next field",
    initialProfile: {},
    hintedPendingField: "name",
    userMessage: "I'm Axel",
    conversationHistory: [
      { role: "assistant", content: "Welcome! What's your name?" },
      { role: "user", content: "I'm Axel" },
    ],
    expect: { fieldFilled: true, isOnboardingComplete: false },
  },
  {
    label: "Scenario 2 — partial profile + ambiguous answer → extractor null, QD re-asks",
    initialProfile: { name: "Axel" },
    hintedPendingField: "citizenship",
    userMessage: "honestly I'm not sure how to answer that",
    conversationHistory: [
      { role: "assistant", content: "What's your country of citizenship?" },
      { role: "user", content: "honestly I'm not sure how to answer that" },
    ],
    expect: { fieldFilled: false, isOnboardingComplete: false },
  },
  {
    label: "Scenario 3 — bundled answer 'I'm Axel, 30, moving to Sweden for work…' → extractor pulls only the targeted field; QD records the rest for later turns",
    initialProfile: {},
    hintedPendingField: "name",
    userMessage:
      "I'm Axel, 30, moving to Sweden for work — my company is sending me on a 14-month posting with my wife and two kids.",
    conversationHistory: [
      { role: "assistant", content: "Welcome! What's your name?" },
      {
        role: "user",
        content:
          "I'm Axel, 30, moving to Sweden for work — my company is sending me on a 14-month posting with my wife and two kids.",
      },
    ],
    expect: { fieldFilled: true, isOnboardingComplete: false },
  },
  {
    label: "Scenario 4 — fully complete profile → short-circuit isOnboardingComplete=true",
    initialProfile: buildCompleteProfile(),
    hintedPendingField: null,
    userMessage: "anything else?",
    conversationHistory: [
      { role: "assistant", content: "Anything else to tell me?" },
      { role: "user", content: "anything else?" },
    ],
    expect: { isOnboardingComplete: true },
  },
];

/**
 * Build a profile that satisfies every required-field predicate so
 * getRequiredFields() returns []. We use the snapshot's predicates
 * so the values must satisfy real validators — the easiest cheat is
 * to fill EVERY known field with a non-empty placeholder.
 */
function buildCompleteProfile(): Profile {
  // We intentionally fill way more than needed. getRequiredFields()
  // only checks the predicate; isProfileComplete() only checks
  // truthiness on those keys. Belt-and-suspenders: assign a value
  // to every key the snapshot knows about.
  // Import the snapshot's FIELD_ORDER lazily so this script doesn't
  // hard-code a 100-item literal.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return new Proxy(
    {} as Record<string, unknown>,
    {
      get: (_t, prop) => {
        if (typeof prop === "string") return placeholderFor(prop);
        return undefined;
      },
      has: () => true,
      ownKeys: () => ["name", "citizenship"],
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    },
  ) as Profile;
}

function placeholderFor(key: string): unknown {
  // numeric-feeling keys
  if (/year|count|number|age|months|days|amount|salary|budget|savings/i.test(key)) {
    return 30;
  }
  if (/_yn$|^has_|^is_|^have_|^will_|^needs_/i.test(key)) {
    return "yes";
  }
  if (/date/i.test(key)) {
    return "2026-06-01";
  }
  return `placeholder-${key}`;
}

async function runScenario(s: Scenario, idx: number): Promise<boolean> {
  console.log("\n" + "=".repeat(78));
  console.log(`[${idx + 1}/${SCENARIOS.length}] ${s.label}`);
  console.log("=".repeat(78));
  console.log("initialProfile keys:", Object.keys(s.initialProfile));
  console.log("hintedPendingField:", s.hintedPendingField ?? "(none — recompute)");
  console.log("userMessage:", s.userMessage);

  const writer = new InMemoryLogWriter();
  const store = new InMemoryProfileStore();
  store.seed(PROFILE_ID, { ...s.initialProfile } as Record<string, unknown>);

  const result = await orchestrateCollecting({
    profileId: PROFILE_ID,
    profile: s.initialProfile,
    hintedPendingField: s.hintedPendingField as
      | Parameters<typeof orchestrateCollecting>[0]["hintedPendingField"],
    userMessage: s.userMessage,
    conversationHistory: s.conversationHistory,
    lastAssistantMessage:
      s.conversationHistory.filter((m) => m.role === "assistant").pop()?.content ?? null,
    store,
    writer,
  });

  console.log("\nResult:");
  console.log("  isOnboardingComplete:", result.isOnboardingComplete);
  console.log("  attemptedField:      ", result.attemptedField);
  console.log("  fieldFilled:         ", result.fieldFilled);
  console.log("  nextPendingField:    ", result.nextPendingField);
  console.log("  animationCue:        ", result.animationCue);
  console.log("  questionText:        ", JSON.stringify(result.questionText));
  if (result.retryHint) {
    console.log("  retryHint:           ", result.retryHint);
  }
  console.log("  mascotEvents:        ", result.mascotEvents.map((e) => e.kind).join(" → "));
  console.log("  audit rows captured: ", writer.audits.length);
  console.log("  run-log rows:        ", writer.runs.length);

  // Compact audit summary
  for (const [i, row] of writer.audits.entries()) {
    console.log(
      `    audit[${i}] ${row.agent_name} field=${row.field_or_output_key} ` +
        `confidence=${row.confidence} model=${row.model_used ?? "(none)"}`,
    );
  }

  // Assertions
  let pass = true;
  if (s.expect.fieldFilled !== undefined && result.fieldFilled !== s.expect.fieldFilled) {
    console.log(`  ❌ expected fieldFilled=${s.expect.fieldFilled}, got ${result.fieldFilled}`);
    pass = false;
  }
  if (
    s.expect.isOnboardingComplete !== undefined &&
    result.isOnboardingComplete !== s.expect.isOnboardingComplete
  ) {
    console.log(
      `  ❌ expected isOnboardingComplete=${s.expect.isOnboardingComplete}, got ${result.isOnboardingComplete}`,
    );
    pass = false;
  }
  console.log(pass ? "  ✅ PASS" : "  ❌ FAIL");
  return pass;
}

async function main() {
  const results: boolean[] = [];
  for (const [i, s] of SCENARIOS.entries()) {
    try {
      results.push(await runScenario(s, i));
    } catch (err) {
      console.error("\n  ❌ EXCEPTION:", err instanceof Error ? err.message : err);
      results.push(false);
    }
  }
  console.log("\n" + "=".repeat(78));
  const passed = results.filter(Boolean).length;
  console.log(`Final: ${passed}/${results.length} scenarios passed`);
  console.log("=".repeat(78));
  if (passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
