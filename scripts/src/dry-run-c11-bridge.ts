// =============================================================
// Dry-run — C1.1 completion bridge (β strategy: title similarity)
// =============================================================
// Pure offline. Asserts:
//   - normaliseTitle: lowercase + diacritic-fold + punct-strip
//   - distinctiveTokens: drops stop words + short tokens
//   - similarity: Jaccard over distinctive tokens
//   - bridgeCompletionsBySimilarTitle:
//       • happy path: legacy → confident researched match
//       • false-positive prevention: cross-category never bridges
//       • multi-claim: only one legacy can win a new slot
//       • ambiguous (top vs runner-up too close) → orphan
//       • low-confidence (score below threshold) → orphan
//       • no candidates in category → orphan
//       • default-state legacies skipped entirely (no carry-over needed)
// =============================================================

import {
  normaliseTitle,
  distinctiveTokens,
  similarity,
  bridgeCompletionsBySimilarTitle,
  BRIDGE_MIN_SCORE,
  BRIDGE_MIN_SHARED_TOKENS,
  BRIDGE_MIN_SEPARATION,
  type BridgeSnapshot,
  type BridgeNewTask,
} from "@workspace/agents";

let total = 0;
let passes = 0;
function expect(label: string, ok: boolean, detail = ""): void {
  total += 1;
  if (ok) passes += 1;
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
}
function banner(label: string): void {
  const line = "─".repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}\n`);
}

// ---- Normalisation ----------------------------------------------

banner("1/4  normaliseTitle");

expect(
  "Swedish diacritics fold",
  normaliseTitle("Skatteverket (folkbokföring) → personnummer") ===
    "skatteverket folkbokforing personnummer",
);
expect(
  "German umlauts fold",
  normaliseTitle("Bürgeramt für Anmeldung") === "burgeramt fur anmeldung",
);
expect(
  "punctuation stripped + collapsed",
  normaliseTitle("  Step:  do-this!  ") === "step do this",
);
expect(
  "empty input → empty",
  normaliseTitle("   ") === "",
);

// ---- Distinctive tokens ----------------------------------------

banner("2/4  distinctiveTokens");

expect(
  "stop words filtered",
  JSON.stringify(distinctiveTokens("Register at Skatteverket for the folkbokföring")) ===
    JSON.stringify(["register", "skatteverket", "folkbokforing"]),
);
expect(
  "short tokens dropped",
  JSON.stringify(distinctiveTokens("Pay 5 SEK to NBI")) ===
    JSON.stringify(["pay", "sek", "nbi"]),
);
expect(
  "swedish stop words also filtered",
  JSON.stringify(distinctiveTokens("Anmäl flytt till Sverige")) ===
    JSON.stringify(["anmal", "flytt", "sverige"]),
);

// ---- Similarity ------------------------------------------------

banner("3/4  similarity");

const sim1 = similarity(
  "Register at Skatteverket (folkbokföring) → personnummer",
  "Register with the Swedish Tax Agency (Skatteverket) for folkbokföring",
);
console.log(
  `  case A: score=${sim1.score.toFixed(2)} sharedTokens=${JSON.stringify(sim1.sharedTokens)}`,
);
expect(
  "high-overlap titles cross threshold",
  sim1.score >= BRIDGE_MIN_SCORE && sim1.sharedTokens.length >= BRIDGE_MIN_SHARED_TOKENS,
  `score=${sim1.score.toFixed(2)} (min ${BRIDGE_MIN_SCORE}); shared=${sim1.sharedTokens.length} (min ${BRIDGE_MIN_SHARED_TOKENS})`,
);

const sim2 = similarity(
  "Open a Swedish bank account",
  "Apply for Swedish ID card",
);
console.log(
  `  case B: score=${sim2.score.toFixed(2)} sharedTokens=${JSON.stringify(sim2.sharedTokens)}`,
);
expect(
  "loosely-related titles don't cross threshold",
  sim2.score < BRIDGE_MIN_SCORE,
  `score=${sim2.score.toFixed(2)} (must be < ${BRIDGE_MIN_SCORE})`,
);

const sim3 = similarity("apple banana cherry", "elderberry fig grape");
expect("zero overlap → 0", sim3.score === 0);

const sim4 = similarity("", "anything goes");
expect("empty input → 0", sim4.score === 0);

// ---- Bridge ----------------------------------------------------

banner("4/4  bridgeCompletionsBySimilarTitle");

// 4a. Happy path — clean legacy → researched match
const snapHappy: BridgeSnapshot[] = [
  {
    taskKey: "reg-population",
    title: "Register at Skatteverket (folkbokföring) → personnummer",
    category: "registration",
    status: "completed",
    completedAt: "2026-04-01T10:00:00Z",
    userNotes: null,
  },
];
const newHappy: BridgeNewTask[] = [
  {
    taskKey: "registration:population-register",
    title: "Register with the Swedish Tax Agency (Skatteverket) for folkbokföring",
    category: "registration",
  },
  {
    taskKey: "registration:id-card",
    title: "Apply for Swedish national ID card",
    category: "registration",
  },
  // Different category — should never compete.
  {
    taskKey: "banking:open-local-account",
    title: "Open a Swedish bank account at a local bank",
    category: "banking",
  },
];
const r1 = bridgeCompletionsBySimilarTitle(newHappy, snapHappy);
expect("happy path: 1 match returned", r1.matches.size === 1);
expect(
  "happy path: registration:population-register inherits status",
  r1.matches.get("registration:population-register")?.status === "completed",
);
expect(
  "happy path: completedAt carried",
  r1.matches.get("registration:population-register")?.completedAt === "2026-04-01T10:00:00Z",
);
expect("happy path: 0 orphans", r1.orphans.length === 0);

// 4b. Cross-category never bridges
const snapCrossCat: BridgeSnapshot[] = [
  {
    taskKey: "bank-open-account",
    title: "Open a Swedish bank account",
    category: "banking",
    status: "completed",
    completedAt: "2026-04-01T10:00:00Z",
    userNotes: null,
  },
];
const newCrossCat: BridgeNewTask[] = [
  // Same title, but registration category — must NOT match.
  {
    taskKey: "registration:open-account-clone",
    title: "Open a Swedish bank account",
    category: "registration",
  },
];
const r2 = bridgeCompletionsBySimilarTitle(newCrossCat, snapCrossCat);
expect(
  "cross-category never matches",
  r2.matches.size === 0 && r2.orphans.length === 1,
);
expect(
  "cross-category orphan logged as no_candidate",
  r2.log[0]?.decision === "orphan_no_candidate",
);

// 4c. Multi-claim: two legacy entries score above threshold for the
//     same single new task. Both fixtures have nearly-identical
//     titles to the new task, so both individually qualify, but
//     only one new slot exists.
const snapMulti: BridgeSnapshot[] = [
  {
    taskKey: "reg-pop-old",
    title: "Register Skatteverket folkbokföring personnummer Sweden",
    category: "registration",
    status: "completed",
    completedAt: "2026-04-01T10:00:00Z",
    userNotes: null,
  },
  {
    taskKey: "reg-pop-older",
    title: "Register Skatteverket folkbokföring personnummer Sweden duplicate",
    category: "registration",
    status: "in_progress",
    completedAt: null,
    userNotes: "started",
  },
];
const newMulti: BridgeNewTask[] = [
  {
    taskKey: "registration:population-register",
    title: "Register Skatteverket folkbokföring personnummer",
    category: "registration",
  },
];
const r3 = bridgeCompletionsBySimilarTitle(newMulti, snapMulti);
expect(
  "multi-claim: only first legacy wins",
  r3.matches.size === 1 && r3.matches.get("registration:population-register")?.legacyKey === "reg-pop-old",
);
expect(
  "multi-claim: second legacy becomes orphan",
  r3.orphans.length === 1 && r3.orphans[0]?.taskKey === "reg-pop-older",
);
expect(
  "multi-claim: orphan_already_claimed in log",
  r3.log.find((e) => e.legacyKey === "reg-pop-older")?.decision === "orphan_already_claimed",
);

// 4d. Ambiguous: top vs runner-up too close
const snapAmbig: BridgeSnapshot[] = [
  {
    taskKey: "bank-setup",
    title: "Open Swedish bank account",
    category: "banking",
    status: "completed",
    completedAt: "2026-04-01T10:00:00Z",
    userNotes: null,
  },
];
const newAmbig: BridgeNewTask[] = [
  {
    taskKey: "banking:open-account",
    title: "Open Swedish bank account institution",
    category: "banking",
  },
  {
    taskKey: "banking:open-account-second",
    title: "Open Swedish bank account at branch",
    category: "banking",
  },
];
const r4 = bridgeCompletionsBySimilarTitle(newAmbig, snapAmbig);
expect(
  "ambiguous → no match, orphan kept",
  r4.matches.size === 0 && r4.orphans.length === 1,
);
const ambigLog = r4.log[0];
expect(
  "ambiguous → orphan_ambiguous reason",
  ambigLog?.decision === "orphan_ambiguous",
);
console.log(`  ambiguous diagnostic: ${ambigLog?.reason}`);

// 4e. Low-confidence (loose words only) → orphan
const snapLow: BridgeSnapshot[] = [
  {
    taskKey: "bank-bank-bank",
    title: "Account",
    category: "banking",
    status: "completed",
    completedAt: "2026-04-01T10:00:00Z",
    userNotes: null,
  },
];
const newLow: BridgeNewTask[] = [
  {
    taskKey: "banking:open",
    title: "Open Swedish bank account at chosen institution",
    category: "banking",
  },
];
const r5 = bridgeCompletionsBySimilarTitle(newLow, snapLow);
expect(
  "low-confidence (only 1 shared token) → orphan",
  r5.matches.size === 0 && r5.orphans.length === 1,
);
expect(
  "low-confidence reason logged",
  r5.log[0]?.decision === "orphan_low_confidence" ||
    r5.log[0]?.decision === "orphan_no_candidate",
);

// 4f. Default-state legacy is skipped (nothing to carry)
const snapDefault: BridgeSnapshot[] = [
  {
    taskKey: "reg-default",
    title: "Register at Skatteverket folkbokföring",
    category: "registration",
    status: "available",
    completedAt: null,
    userNotes: null,
  },
];
const newDefault: BridgeNewTask[] = [
  {
    taskKey: "registration:population-register",
    title: "Register with the Swedish Tax Agency for folkbokföring",
    category: "registration",
  },
];
const r6 = bridgeCompletionsBySimilarTitle(newDefault, snapDefault);
expect(
  "default-state legacy skipped (no work to do)",
  r6.matches.size === 0 && r6.orphans.length === 0 && r6.log.length === 0,
);

// 4g. Realistic 3-task scenario from C1.1's intended use
const snapReal: BridgeSnapshot[] = [
  {
    taskKey: "reg-population",
    title: "Register at Skatteverket (folkbokföring) → personnummer",
    category: "registration",
    status: "completed",
    completedAt: "2026-04-01T10:00:00Z",
    userNotes: "Booked appointment 15 May",
  },
  {
    taskKey: "bank-open-account",
    title: "Open a Swedish bank account",
    category: "banking",
    status: "completed",
    completedAt: "2026-04-15T11:00:00Z",
    userNotes: null,
  },
  {
    taskKey: "reg-id-card",
    title: "Apply for Swedish ID card (Skatteverket)",
    category: "registration",
    status: "in_progress",
    completedAt: null,
    userNotes: null,
  },
  {
    taskKey: "health-card",
    title: "Get Försäkringskassan health card",
    category: "healthcare",
    status: "completed",
    completedAt: "2026-04-20T11:00:00Z",
    userNotes: null,
  },
];
const newReal: BridgeNewTask[] = [
  {
    taskKey: "registration:population-register",
    title: "Register with the Swedish Tax Agency (Skatteverket) for folkbokföring",
    category: "registration",
  },
  {
    taskKey: "registration:id-card",
    title: "Apply for Swedish national identity card at Skatteverket",
    category: "registration",
  },
  {
    taskKey: "banking:open-local-account",
    title: "Open a Swedish bank account at your chosen institution",
    category: "banking",
  },
  {
    taskKey: "banking:enrol-bankid",
    title: "Enrol for BankID digital identity",
    category: "banking",
  },
  {
    taskKey: "healthcare:health-card",
    title: "Receive Försäkringskassan health card",
    category: "healthcare",
  },
];
const r7 = bridgeCompletionsBySimilarTitle(newReal, snapReal);
console.log(
  `  realistic — matches=${r7.matches.size} orphans=${r7.orphans.length}`,
);
for (const e of r7.log) {
  console.log(`    ${e.decision.padEnd(28)} ${e.legacyKey}${
    e.bestMatch ? ` → ${e.bestMatch.newKey} (${e.bestMatch.score.toFixed(2)})` : ""
  }`);
}

expect(
  "realistic: registration:population-register inherits 'completed'",
  r7.matches.get("registration:population-register")?.status === "completed",
);
expect(
  "realistic: registration:population-register carries userNotes",
  r7.matches.get("registration:population-register")?.userNotes === "Booked appointment 15 May",
);
expect(
  "realistic: registration:id-card inherits 'in_progress'",
  r7.matches.get("registration:id-card")?.status === "in_progress",
);
expect(
  "realistic: banking:open-local-account inherits 'completed'",
  r7.matches.get("banking:open-local-account")?.status === "completed",
);
expect(
  "realistic: healthcare:health-card inherits 'completed'",
  r7.matches.get("healthcare:health-card")?.status === "completed",
);
expect(
  "realistic: 0 orphans (all 4 carry-worthy entries bridged)",
  r7.orphans.length === 0,
);

// ---- Summary ---------------------------------------------------

const line = "─".repeat(60);
console.log(`\n${line}\n  ${passes === total ? "✅" : "❌"} ${passes}/${total} passed\n${line}\n`);
if (passes !== total) process.exit(1);
