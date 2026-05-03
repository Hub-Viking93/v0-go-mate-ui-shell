/**
 * Wave 2.x Prompt 3.5 — manual-test multi-profile dispatch verifier.
 *
 * Runs the Coordinator's `decideDispatch(profile)` against three buildathon
 * profiles (Roselle, Hans, Mike) and diffs the actual dispatched-specialist
 * set against the expected set the user provided. This is the primary
 * "did the right specialists fire?" check — pure code, no LLMs, instant.
 *
 * With `--full=A|B|C` it ALSO runs the full pipeline (specialists →
 * Synthesizer → Critic) for that one profile and prints the Critic output
 * verbatim, so the manual-testing checklist can be ticked off.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx scripts/demo-research-multi-profile.mts            # dispatch only
 *   pnpm --filter @workspace/api-server exec tsx scripts/demo-research-multi-profile.mts --full=A   # also run full pipeline for Profile A
 */

import {
  decideDispatch,
  type DispatchDecision,
} from "../src/lib/agents/coordinator";
import {
  kickoffResearch,
  subscribeToRun,
  getRunState,
  type ResearchRunSnapshot,
} from "../src/lib/agents/research-orchestrator";
import type { Profile } from "../src/lib/gomate/profile-schema-snapshot";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// PROFILE A — Roselle (Filipino fiancée moving to Sweden)
// ---------------------------------------------------------------------------
const ROSELLE: Profile = {
  name: "Roselle",
  citizenship: "Philippines",
  current_location: "Manila, Philippines",
  destination: "Sweden",
  target_city: "Stockholm",
  purpose: "settle",
  visa_role: "dependent",
  partner_citizenship: "Sweden",
  partner_visa_status: "citizen",
  relationship_type: "fiancé",
  moving_alone: "yes",
  pets: "none",
  children_count: "0",
  healthcare_needs: "none",
  duration: "permanent",
  timeline: "1-3_months",
  monthly_budget: "3000",
  savings_available: "12000",
};
const EXPECTED_A = [
  "visa_specialist",
  "tax_strategist",
  "cost_specialist",
  "housing_specialist",
  "cultural_adapter",
  "documents_specialist",
  "healthcare_navigator",
  "banking_helper",
  "family_reunion_specialist",
];

// ---------------------------------------------------------------------------
// PROFILE B — Hans (German engineer, 18-month posting to Stockholm)
// ---------------------------------------------------------------------------
const HANS: Profile = {
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
  home_country_employer: "Berlin GmbH",
  posting_duration_months: "18",
  duration: "18_months",
  timeline: "1-3_months",
  moving_alone: "no",
  spouse_joining: "yes",
  spouse_career_field: "marketing",
  spouse_seeking_work: "yes",
  spouse_language_skills: "medium",
  children_count: "2",
  children_ages: "8 and 5",
  children_school_type_preference: "international",
  pets: "none",
  healthcare_needs: "none",
  monthly_budget: "5000",
  savings_available: "60000",
};
const EXPECTED_B = [
  "visa_specialist",
  "tax_strategist",
  "cost_specialist",
  "housing_specialist",
  "cultural_adapter",
  "documents_specialist",
  "healthcare_navigator",
  "banking_helper",
  "schools_specialist",
  "posted_worker_specialist",
  "trailing_spouse_career_specialist",
  "departure_tax_specialist",
];

// ---------------------------------------------------------------------------
// PROFILE C — Mike (American digital nomad → Spain, T1D, golden retriever)
// ---------------------------------------------------------------------------
const MIKE: Profile = {
  name: "Mike",
  citizenship: "United States",
  current_location: "Austin, USA",
  destination: "Spain",
  target_city: "Barcelona",
  purpose: "digital_nomad",
  visa_role: "primary",
  moving_alone: "yes",
  monthly_income: "6000",
  income_consistency: "stable",
  income_history_months: "24",
  remote_income: "yes",
  income_source: "freelance",
  pets: "dog",
  pet_breed: "Golden Retriever",
  pet_age: "5",
  pet_microchip_status: "yes",
  pet_vaccination_status: "current",
  healthcare_needs: "chronic_condition",
  chronic_condition_description: "Type 1 diabetes, daily insulin",
  prescription_medications: "yes",
  prescription_medications_list: "insulin (Lantus + Humalog), test strips",
  english_speaking_doctor_required: "yes",
  duration: "12_months",
  timeline: "1-3_months",
  monthly_budget: "3500",
  savings_available: "30000",
  children_count: "0",
};
const EXPECTED_C = [
  "visa_specialist",
  "tax_strategist",
  "cost_specialist",
  "housing_specialist",
  "cultural_adapter",
  "documents_specialist",
  "healthcare_navigator",
  "banking_helper",
  "pet_specialist",
  "digital_nomad_compliance",
  "departure_tax_specialist",
];

// ---------------------------------------------------------------------------
// Pretty-printing helpers
// ---------------------------------------------------------------------------
function bar(ch = "=", n = 78): string { return ch.repeat(n); }

function diffSets(actual: string[], expected: string[]): {
  matched: string[];
  unexpected: string[];
  missing: string[];
} {
  const a = new Set(actual);
  const e = new Set(expected);
  return {
    matched: [...a].filter((x) => e.has(x)).sort(),
    unexpected: [...a].filter((x) => !e.has(x)).sort(),
    missing: [...e].filter((x) => !a.has(x)).sort(),
  };
}

interface ProfileCase {
  id: "A" | "B" | "C";
  name: string;
  oneLiner: string;
  profile: Profile;
  expected: string[];
}
const CASES: ProfileCase[] = [
  {
    id: "A",
    name: "Roselle",
    oneLiner: "Filipino fiancée → Sweden (settle, dependent)",
    profile: ROSELLE,
    expected: EXPECTED_A,
  },
  {
    id: "B",
    name: "Hans",
    oneLiner: "German engineer → Stockholm (18-mo posting, family of 4)",
    profile: HANS,
    expected: EXPECTED_B,
  },
  {
    id: "C",
    name: "Mike",
    oneLiner: "US digital nomad → Barcelona (T1D, dog)",
    profile: MIKE,
    expected: EXPECTED_C,
  },
];

function runDispatchPhase(): { passed: boolean; failed: string[] } {
  const failed: string[] = [];
  for (const c of CASES) {
    console.log(`\n${bar("=")}`);
    console.log(`PROFILE ${c.id} — ${c.name}: ${c.oneLiner}`);
    console.log(bar("="));

    const decision: DispatchDecision = decideDispatch(c.profile);
    const dispatched = decision.specialists.map((s) => s.name);

    const { matched, unexpected, missing } = diffSets(dispatched, c.expected);

    console.log(`\n  Dispatched (${dispatched.length}):`);
    for (const r of decision.rationale) {
      const ok = matched.includes(r.specialist) ? "✓" : "✗";
      console.log(`    ${ok} ${r.specialist.padEnd(36)} — ${r.reason}`);
    }

    console.log(`\n  Expected (${c.expected.length}): ${c.expected.join(", ")}`);

    if (unexpected.length === 0 && missing.length === 0) {
      console.log(`\n  ✅ DISPATCH MATCHES EXPECTATION (${matched.length}/${c.expected.length})`);
    } else {
      console.log(`\n  ❌ DISPATCH MISMATCH:`);
      if (missing.length) {
        console.log(`     MISSING (expected, not fired): ${missing.join(", ")}`);
      }
      if (unexpected.length) {
        console.log(`     UNEXPECTED (fired, not expected): ${unexpected.join(", ")}`);
      }
      failed.push(c.id);
    }

    // Inputs sanity check: confirm slices aren't empty for any dispatched
    // specialist (an empty slice would force fallback quality at runtime).
    const emptySlices = decision.specialists.filter(
      (s) => Object.keys(s.inputs).length === 0,
    );
    if (emptySlices.length) {
      console.log(`\n  ⚠️  WARN: empty input slices for: ${emptySlices.map((s) => s.name).join(", ")}`);
    }
  }
  return { passed: failed.length === 0, failed };
}

// ---------------------------------------------------------------------------
// Optional --full=<A|B|C> phase: run the full pipeline for one profile and
// print Synth + Critic output verbatim.
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
  return { from: () => stubBuilder } as unknown as SupabaseClient;
}

async function runFullPhase(c: ProfileCase): Promise<void> {
  console.log(`\n${bar("=")}`);
  console.log(`FULL PIPELINE — Profile ${c.id} (${c.name})`);
  console.log(bar("="));
  if (!process.env.FIRECRAWL_API_KEY) {
    console.warn("[demo] FIRECRAWL_API_KEY not set — specialists will mostly return quality='fallback'.");
  }

  const profileId = `00000000-0000-0000-0000-000000000${c.id.toLowerCase().padStart(3, "0")}`;
  const startedAt = Date.now();
  let evCount = 0;
  let lastSummary = "";
  const unsubscribe = subscribeToRun(profileId, (snap: ResearchRunSnapshot) => {
    evCount++;
    const counts: Record<string, number> = {};
    for (const a of Object.values(snap.agents)) counts[a.status] = (counts[a.status] ?? 0) + 1;
    const summary = `runStatus=${snap.runStatus} | ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" ")}`;
    if (summary === lastSummary) return;
    lastSummary = summary;
    const t = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`  [+${t}s] ev#${evCount}  ${summary}`);
  });

  const { runPromise, snapshot } = kickoffResearch({
    profileId,
    planId: profileId,
    profile: c.profile,
    supabase: makeStubSupabase(),
    specialistBudgetMs: 90_000,
  });
  console.log(`\n  Initial: ${Object.keys(snapshot.agents).length} agents dispatched\n`);

  await runPromise;
  unsubscribe();

  const final = getRunState(profileId);
  if (!final) {
    console.error("  [demo] Final state was evicted before read.");
    return;
  }
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n  Terminal state after ${elapsed}s, ${evCount} live events`);
  console.log(`  runStatus:        ${final.runStatus}`);
  console.log(`  redispatchRounds: ${final.redispatchRoundsRun}`);

  console.log(`\n  PER-AGENT TERMINAL STATE:`);
  for (const a of Object.values(final.agents)) {
    const src = a.sourceCount !== undefined
      ? `${a.sourceCount} sources / ${a.citationCount ?? 0} cites`
      : "(no source counts)";
    const q = a.quality ? `quality=${a.quality}` : "";
    console.log(`    • ${a.name.padEnd(36)} ${a.status.padEnd(10)} ${src.padEnd(28)} ${q}`);
    if (a.errorMessage) console.log(`        ↳ error: ${a.errorMessage}`);
  }

  if (final.synth) {
    console.log(`\n  SYNTH:  ${final.synth.sectionCount} sections, ${final.synth.consistencyIssues.length} consistency issues, ${final.synth.unresolvedIssues.length} unresolved | model=${final.synth.modelUsed} tokens=${final.synth.tokensUsed} ${(final.synth.wallClockMs / 1000).toFixed(1)}s`);
  }
  if (final.critic) {
    console.log(`\n  CRITIC: ${final.critic.gapCount} gaps, ${final.critic.weakClaimCount} weak claims, ${final.critic.missingForUserCount} missing-for-user | model=${final.critic.modelUsed} tokens=${final.critic.tokensUsed} ${(final.critic.wallClockMs / 1000).toFixed(1)}s`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(bar("="));
  console.log("GoMate v2 — Wave 2.x Prompt 3.5 multi-profile manual test");
  console.log(bar("="));
  console.log("\nPHASE 1 — Coordinator dispatch verification (instant, no LLM)");

  const { passed, failed } = runDispatchPhase();

  console.log(`\n${bar("=")}`);
  console.log(`DISPATCH SUMMARY`);
  console.log(bar("="));
  if (passed) {
    console.log("✅ All 3 profiles dispatch the EXACT expected set of specialists.");
  } else {
    console.log(`❌ ${failed.length} profile(s) failed: ${failed.join(", ")}`);
  }

  // Optional full-pipeline phase
  const fullArg = process.argv.find((a) => a.startsWith("--full="));
  if (fullArg) {
    const id = fullArg.split("=")[1].toUpperCase() as "A" | "B" | "C";
    const c = CASES.find((x) => x.id === id);
    if (!c) {
      console.error(`\n[demo] Unknown profile id '${id}' — must be A, B, or C`);
      process.exit(2);
    }
    await runFullPhase(c);
  } else {
    console.log("\n(Skipping full-pipeline phase — pass --full=A|B|C to run one profile end-to-end.)");
  }

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error("\n[demo] crashed:", err);
  process.exit(1);
});
