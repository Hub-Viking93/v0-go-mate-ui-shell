/**
 * Offline demo (Wave 2.x Prompt 3.5): exercise the research orchestrator
 * end-to-end against Hans's profile WITHOUT touching Supabase or HTTP.
 *
 * What this proves:
 *   - kickoffResearch() returns immediately with a snapshot.
 *   - subscribeToRun() receives live `change` events as specialists
 *     transition through researching → drafting → complete.
 *   - The synthesizer + critic phases fire and update run-level status.
 *   - Final state is `completed` (or `partial` if any specialist failed)
 *     with all panels at `complete` / `failed`.
 *   - Per-spec source counts (source_count + citation_count) and quality
 *     are pulled from the audit-row stream.
 *
 * What this does NOT prove (out of scope for the offline demo):
 *   - The HTTP trigger route (covered by tsc + manual curl in dev).
 *   - The SSE wire format (covered by tsc + the use-research-stream hook
 *     parsing the same JSON shape that this demo logs).
 *   - The Supabase finalize update (a no-op stub here; logger warns).
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx scripts/demo-research-orchestrator.mts
 *
 * Make sure FIRECRAWL_API_KEY is set or specialists will return
 * quality="fallback".
 */

import {
  kickoffResearch,
  subscribeToRun,
  type ResearchRunSnapshot,
} from "../src/lib/agents/research-orchestrator";
import type { Profile } from "../src/lib/gomate/profile-schema-snapshot";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Hans — German engineer posted to Stockholm 18 months (matches Wave 1 demo)
// ---------------------------------------------------------------------------
const HANS_PROFILE: Profile = {
  name: "Hans",
  citizenship: "Germany",
  current_location: "Berlin, Germany",
  destination: "Sweden",
  target_city: "Stockholm",
  purpose: "work",
  visa_role: "primary",
  job_offer: "yes",
  employer_sponsorship: "yes",
  highly_skilled: "yes",
  posting_or_secondment: "yes",
  home_country_employer: "Siemens AG",
  posting_duration_months: "18",
  duration: "18_months",
  timeline: "1-3_months",
  moving_alone: "no",
  spouse_joining: "yes",
  spouse_career_field: "marketing",
  spouse_seeking_work: "no",
  children_count: "2",
  children_ages: "7, 11",
  healthcare_needs: "none",
  pets: "none",
  savings_available: "60000",
  monthly_budget: "5000",
};

const PROFILE_ID = "00000000-0000-0000-0000-000000000hans";

// ---------------------------------------------------------------------------
// Stub Supabase client — every method returns success without doing
// anything. The orchestrator persists audit rows + finalize updates via
// supabase, but this demo doesn't need them. createSupabaseLogWriter
// will swallow failures cleanly because we wrap it in `makeLiveLogWriter`
// which logs warnings instead of crashing.
// ---------------------------------------------------------------------------
function makeStubSupabase(): SupabaseClient {
  const ok = { data: null, error: null };
  const stubBuilder = {
    insert: async () => ok,
    update: () => stubBuilder,
    eq: () => stubBuilder,
    select: () => stubBuilder,
    maybeSingle: async () => ok,
    then: (resolve: (v: typeof ok) => unknown) => resolve(ok),
  };
  return {
    from: () => stubBuilder,
  } as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Pretty-print snapshot deltas (only show what changed)
// ---------------------------------------------------------------------------
function bar(ch = "=", n = 80): string {
  return ch.repeat(n);
}

function snapshotSummary(s: ResearchRunSnapshot): string {
  const counts: Record<string, number> = {};
  for (const a of Object.values(s.agents)) counts[a.status] = (counts[a.status] ?? 0) + 1;
  const parts = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" ");
  return `runStatus=${s.runStatus} | agents: ${parts}`;
}

let prevSerialized = "";
let eventCount = 0;

function logEvent(snap: ResearchRunSnapshot): void {
  eventCount += 1;
  const summary = snapshotSummary(snap);
  if (summary === prevSerialized) return; // de-dup noise
  prevSerialized = summary;
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stdout.write(`  [+${elapsed}s] event#${eventCount}  ${summary}\n`);
  // When run-level phase changes, dump the active panel detail.
  if (snap.runStatus === "synthesizing" && !synthLogged) {
    synthLogged = true;
    process.stdout.write(`           → Specialists done; calling Synthesizer (Opus 4.7)…\n`);
  }
  if (snap.runStatus === "critiquing" && !critiqueLogged) {
    critiqueLogged = true;
    if (snap.synth) {
      process.stdout.write(
        `           → Synth: ${snap.synth.sectionCount} sections, ${snap.synth.consistencyIssues.length} consistency issues, ${snap.synth.unresolvedIssues.length} unresolved (${snap.synth.tokensUsed} tok, ${(snap.synth.wallClockMs / 1000).toFixed(1)}s).\n`,
      );
    }
    process.stdout.write(`           → Calling Critic (Sonnet 4.5)…\n`);
  }
  if (snap.runStatus === "redispatching" && !redispatchLogged) {
    redispatchLogged = true;
    process.stdout.write(`           → Critic identified gaps — re-dispatching follow-up specialists.\n`);
  }
}

let startedAt = Date.now();
let synthLogged = false;
let critiqueLogged = false;
let redispatchLogged = false;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  if (!process.env.FIRECRAWL_API_KEY) {
    console.warn("[demo] FIRECRAWL_API_KEY not set — specialists will mostly return quality='fallback'.\n");
  }

  console.log(bar("="));
  console.log("GoMate v2 — Wave 2.x Prompt 3.5");
  console.log("Research Orchestrator end-to-end (offline) — Hans → Stockholm");
  console.log(bar("="));

  // Subscribe BEFORE kickoff so we don't miss the initial pending → researching transition.
  const unsubscribe = subscribeToRun(PROFILE_ID, logEvent);

  const supabase = makeStubSupabase();

  startedAt = Date.now();
  console.log("\n[demo] Calling kickoffResearch() …");
  const { snapshot, runPromise, alreadyRunning } = kickoffResearch({
    profileId: PROFILE_ID,
    planId: PROFILE_ID,
    profile: HANS_PROFILE,
    supabase,
    specialistBudgetMs: 90_000,
  });

  console.log(`[demo] alreadyRunning=${alreadyRunning}`);
  console.log(`[demo] Initial snapshot: runStatus=${snapshot.runStatus}, ${Object.keys(snapshot.agents).length} agents dispatched`);
  console.log(`[demo] Coordinator rationale (${snapshot.rationale.length} entries):`);
  for (const r of snapshot.rationale) {
    console.log(`         • ${r.specialist}: ${r.reason}`);
  }

  console.log("\n[demo] Waiting for the run to reach a terminal state (events stream below)…\n");

  await runPromise;
  unsubscribe();

  // Print the final state.
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n${bar("=")}\nFINAL STATE (after ${elapsed}s, ${eventCount} live events)\n${bar("=")}`);
  // Use the in-memory snapshot exposed via subscribe (the last one we saw).
  const final = await getFinalSnapshot();
  if (!final) {
    console.error("[demo] No final snapshot available — orchestrator state was evicted before read.");
    process.exit(1);
  }
  console.log(`runStatus:         ${final.runStatus}`);
  console.log(`startedAt:         ${final.startedAt}`);
  console.log(`completedAt:       ${final.completedAt ?? "(unset)"}`);
  console.log(`redispatchRounds:  ${final.redispatchRoundsRun}`);
  if (final.synth) {
    console.log(`synth:             ${final.synth.sectionCount} sections, ${final.synth.consistencyIssues.length} consistency issues, ${final.synth.unresolvedIssues.length} unresolved | model=${final.synth.modelUsed} tokens=${final.synth.tokensUsed} ${(final.synth.wallClockMs / 1000).toFixed(1)}s`);
  }
  if (final.critic) {
    console.log(`critic:            ${final.critic.gapCount} gaps, ${final.critic.weakClaimCount} weak claims, ${final.critic.missingForUserCount} missing-for-user | model=${final.critic.modelUsed} tokens=${final.critic.tokensUsed} ${(final.critic.wallClockMs / 1000).toFixed(1)}s`);
  }
  console.log(`\nPer-agent terminal state:`);
  for (const a of Object.values(final.agents)) {
    const src = a.sourcesScraped !== undefined ? `${a.sourcesScraped}/${a.sourcesTotal} sources` : "(no source counts)";
    const q = a.quality ? `quality=${a.quality}` : "";
    console.log(`  • ${a.name.padEnd(40)} ${a.status.padEnd(12)} ${src.padEnd(22)} ${q}`);
    if (a.errorMessage) console.log(`      ↳ error: ${a.errorMessage}`);
  }

  console.log(`\n${bar("=")}\nDONE — ${final.runStatus.toUpperCase()}\n${bar("=")}\n`);
  process.exit(final.runStatus === "failed" ? 1 : 0);
}

async function getFinalSnapshot(): Promise<ResearchRunSnapshot | null> {
  // The state has a 5-min eviction TTL after terminal status, so it's
  // still in memory here. Re-import getRunState lazily to avoid a circular
  // top-level dependency.
  const { getRunState } = await import("../src/lib/agents/research-orchestrator");
  return getRunState(PROFILE_ID);
}

main().catch((err) => {
  console.error("\n[demo] crashed:", err);
  process.exit(1);
});
