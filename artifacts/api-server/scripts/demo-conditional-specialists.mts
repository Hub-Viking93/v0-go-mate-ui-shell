/**
 * Demo (Prompt 3.3): for each of the 3 buildathon sample profiles,
 * call decideDispatch → run every dispatched conditional specialist
 * in parallel via Promise.allSettled with a 60s master AbortSignal.
 *
 * Run with:
 *   pnpm --filter @workspace/api-server exec tsx scripts/demo-conditional-specialists.mts
 *
 * Confirms:
 *   * The right specialists fire for each profile (vs decideDispatch's
 *     rationale).
 *   * Each conditional specialist returns a SpecialistOutput with
 *     citations from official-sources whitelist OR successfully
 *     scraped URLs (no fabrication).
 *   * Audit rows fire start + synthesis + complete per specialist.
 *   * Quality drops to "partial"/"fallback" gracefully on scrape failure.
 */

import { decideDispatch } from "../src/lib/agents/coordinator";
import type { Profile } from "../src/lib/gomate/profile-schema-snapshot";
import {
  schoolsSpecialist,
  healthcareSpecialist,
  bankingSpecialist,
  petSpecialist,
  postedWorkerSpecialist,
  digitalNomadComplianceSpecialist,
  jobComplianceSpecialist,
  familyReunionSpecialist,
  departureTaxSpecialist,
  vehicleImportSpecialist,
  propertyPurchaseSpecialist,
  trailingSpouseCareerSpecialist,
  pensionContinuitySpecialist,
  type LogWriter,
  type SpecialistContext,
  type SpecialistOutput,
  type SpecialistProfile,
  type AgentAuditRow,
  type AgentRunLogRow,
} from "@workspace/agents";

// ---------------------------------------------------------------------------
// Coordinator-name → specialist function map
// ---------------------------------------------------------------------------
type SpecialistFn = (p: SpecialistProfile, ctx: SpecialistContext) => Promise<SpecialistOutput>;

const CONDITIONAL_SPECIALISTS: Record<string, SpecialistFn> = {
  schools_specialist: schoolsSpecialist,
  healthcare_navigator: healthcareSpecialist, // also dispatched as always-run
  banking_helper: bankingSpecialist, // also dispatched as always-run
  pet_specialist: petSpecialist,
  posted_worker_specialist: postedWorkerSpecialist,
  digital_nomad_compliance: digitalNomadComplianceSpecialist,
  job_compliance_specialist: jobComplianceSpecialist,
  family_reunion_specialist: familyReunionSpecialist,
  departure_tax_specialist: departureTaxSpecialist,
  vehicle_import_specialist: vehicleImportSpecialist,
  property_purchase_specialist: propertyPurchaseSpecialist,
  trailing_spouse_career_specialist: trailingSpouseCareerSpecialist,
  pension_continuity_specialist: pensionContinuitySpecialist,
};

// Always-run specialists per the coordinator's ALWAYS_RUN_SPECS list. We
// skip them here to keep this demo focused on truly conditional dispatch.
//
// Note: healthcare_navigator and banking_helper are *implemented* as
// conditional specialist files in lib/agents/src/specialists/, but the
// coordinator (artifacts/api-server/src/lib/agents/coordinator.ts) decided
// in Wave 2.x to dispatch them for every profile. They're already covered
// by demo-specialists.mts (the always-run demo); excluding them here keeps
// this demo's coverage numbers honest about which specialists were
// dispatched *because* of profile-specific triggers vs. as part of the
// always-run kernel.
const ALWAYS_RUN_NAMES = new Set([
  "visa_specialist",
  "tax_strategist",
  "cost_specialist",
  "housing_specialist",
  "cultural_adapter",
  "documents_specialist",
  "healthcare_navigator",
  "banking_helper",
]);

// ---------------------------------------------------------------------------
// 3 buildathon demo profiles (same shape as demo-coordinator.mts)
// ---------------------------------------------------------------------------
const profiles: { label: string; profile: Profile }[] = [
  {
    label:
      "1) Maria — Filipino fiancée → Sweden as dependent (family reunion), no kids/pets",
    profile: {
      name: "Maria",
      citizenship: "Philippines",
      current_location: "Manila, Philippines",
      destination: "Sweden",
      target_city: "Stockholm",
      purpose: "settle",
      visa_role: "dependent",
      partner_citizenship: "Sweden",
      partner_visa_status: "citizen",
      relationship_type: "fiance",
      settlement_reason: "family_reunion",
      duration: "permanent",
      timeline: "3-6_months",
      moving_alone: "yes",
      children_count: "0",
      pets: "none",
      healthcare_needs: "none",
      savings_available: "8000",
      monthly_budget: "1500",
    },
  },
  {
    label:
      "2) Hans — German engineer posted to Stockholm 18 months, family of 4 with 2 kids",
    profile: {
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
    },
  },
  {
    label:
      "3) Jordan — American digital nomad → Spain solo, chronic condition, bringing a dog",
    profile: {
      name: "Jordan",
      citizenship: "United States",
      current_location: "Austin, United States",
      destination: "Spain",
      target_city: "Valencia",
      purpose: "digital_nomad",
      visa_role: "primary",
      remote_income: "yes",
      income_source: "self_employed",
      monthly_income: "6500",
      income_consistency: "stable",
      income_history_months: "24",
      duration: "1_year",
      timeline: "1-3_months",
      moving_alone: "yes",
      children_count: "0",
      pets: "dog",
      pet_breed: "labrador",
      healthcare_needs: "chronic_condition",
      chronic_condition_description: "Type 1 diabetes",
      prescription_medications: "yes",
      english_speaking_doctor_required: "yes",
      savings_available: "30000",
      monthly_budget: "2500",
    },
  },
];

// ---------------------------------------------------------------------------
// In-memory LogWriter so the demo doesn't need Supabase
// ---------------------------------------------------------------------------
type Row = ({ kind: "run_log" } & AgentRunLogRow) | ({ kind: "audit" } & AgentAuditRow);

function makeWriter(): { writer: LogWriter; rows: Row[] } {
  const rows: Row[] = [];
  const writer: LogWriter = {
    async insertRunLog(row) {
      rows.push({ kind: "run_log", ...row });
    },
    async insertAudit(row) {
      rows.push({ kind: "audit", ...row });
      const v = row.value as
        | {
            specialist?: string;
            status?: string;
            quality?: string;
            sources_scraped?: number;
            sources_total?: number;
          }
        | null;
      process.stdout.write(
        `      · audit ${row.agent_name} | ${row.field_or_output_key ?? "(no key)"} | ${v?.status ?? v?.specialist ?? ""}${
          v?.quality ? ` quality=${v.quality}` : ""
        }${
          typeof v?.sources_scraped === "number" ? ` scraped=${v.sources_scraped}/${v.sources_total}` : ""
        }${row.tokens_used ? ` ${row.tokens_used}tok` : ""}\n`,
      );
    },
  };
  return { writer, rows };
}

// ---------------------------------------------------------------------------
// Output rendering
// ---------------------------------------------------------------------------
function summariseOutput(label: string, out: SpecialistOutput) {
  const banner = "-".repeat(76);
  console.log(`\n${banner}\n  ${label} → ${out.specialist}\n${banner}`);
  console.log(`  quality:        ${out.quality}`);
  console.log(`  confidence:     ${out.confidence}`);
  console.log(`  model_used:     ${out.modelUsed}`);
  console.log(`  wall_clock:     ${out.wallClockMs}ms`);
  console.log(`  tokens_used:    ${out.tokensUsed}`);
  console.log(`  paragraphs:     ${out.contentParagraphs.length}`);
  console.log(`  citations:      ${out.citations.length}  (scraped=${out.sourceUrlsUsed.length})`);
  if (out.fallbackReason) console.log(`  fallbackReason: ${out.fallbackReason}`);
  for (const c of out.citations.slice(0, 5)) {
    console.log(`    ${c.scraped ? "✓" : "·"} ${c.label}`);
    console.log(`        ${c.url}`);
  }
  if (out.citations.length > 5) console.log(`    … +${out.citations.length - 5} more`);
  const first = out.contentParagraphs[0] ?? "(empty)";
  console.log(`  --- first paragraph (truncated) ---`);
  console.log(`    ${first.slice(0, 280)}${first.length > 280 ? "…" : ""}`);
  if (Object.keys(out.domainSpecificData).length > 0) {
    const json = JSON.stringify(out.domainSpecificData, null, 2);
    console.log(`  --- domainSpecificData (truncated) ---`);
    console.log(`    ${json.length > 600 ? json.slice(0, 600) + "\n    …" : json.replace(/\n/g, "\n    ")}`);
  }
}

// ---------------------------------------------------------------------------
// Run one profile
// ---------------------------------------------------------------------------
async function runProfile(label: string, profile: Profile) {
  const banner = "=".repeat(80);
  console.log(`\n\n${banner}\n${label}\n${banner}`);

  const dispatch = decideDispatch(profile);

  // Filter to conditional specialists only (skip the always-run kernel).
  const conditional = dispatch.specialists.filter((s) => !ALWAYS_RUN_NAMES.has(s.name));

  console.log(`\nDispatched specialists: ${dispatch.specialists.length} total (${conditional.length} conditional, ${dispatch.specialists.length - conditional.length} always-run)`);
  console.log(`Conditional specialists firing for this profile:`);
  for (const s of conditional) {
    const inFn = CONDITIONAL_SPECIALISTS[s.name] ? "✓" : "✗ NO IMPLEMENTATION";
    console.log(`  ${inFn} ${s.name}  (${Object.keys(s.inputs).length} input fields)`);
  }
  console.log(`Rationale (conditional only):`);
  for (const r of dispatch.rationale) {
    if (ALWAYS_RUN_NAMES.has(r.specialist)) continue;
    console.log(`  • ${r.specialist}`);
    console.log(`      ${r.reason}`);
  }

  if (conditional.length === 0) {
    console.log("\n(no conditional specialists for this profile)");
    return { rows: [] as Row[], outputs: [] as SpecialistOutput[] };
  }

  // ---- Master 60s budget for this profile's dispatch ----------------------
  const masterController = new AbortController();
  const masterTimer = setTimeout(
    () => masterController.abort(new Error("master-60s-budget")),
    60_000,
  );

  const { writer, rows } = makeWriter();
  const ctx: SpecialistContext = {
    profileId: `00000000-0000-0000-0000-${String(Math.floor(Math.random() * 1e12)).padStart(12, "0")}`,
    logWriter: writer,
    signal: masterController.signal,
  };

  console.log(`\nRunning ${conditional.length} conditional specialists in parallel (60s master budget)…\n`);
  const startBatch = Date.now();
  const settled = await Promise.allSettled(
    conditional.map(async (s) => {
      const fn = CONDITIONAL_SPECIALISTS[s.name];
      if (!fn) {
        throw new Error(`No specialist implementation for ${s.name}`);
      }
      // Each specialist receives only the input slice the coordinator picked.
      const sliceProfile = s.inputs as SpecialistProfile;
      const out = await fn(sliceProfile, ctx);
      return { name: s.name, out };
    }),
  );
  const batchMs = Date.now() - startBatch;
  clearTimeout(masterTimer);

  const outputs: SpecialistOutput[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      summariseOutput(r.value.name, r.value.out);
      outputs.push(r.value.out);
    } else {
      console.error(`\n  REJECTED slot:`, r.reason);
    }
  }

  console.log(`\n  >>> Profile batch took ${batchMs}ms; ${outputs.length}/${conditional.length} succeeded.`);
  return { rows, outputs };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // When stdout is redirected to a file, Node uses block buffering by
  // default — that hides progress audits until the buffer fills. Force
  // blocking writes so each audit row reaches the log immediately.
  // (No-op when stdout is a TTY.)
  type Blockable = { _handle?: { setBlocking?: (b: boolean) => void } };
  (process.stdout as unknown as Blockable)._handle?.setBlocking?.(true);
  (process.stderr as unknown as Blockable)._handle?.setBlocking?.(true);

  // Optional --profile=N (1-based) to run only one profile per invocation,
  // so each tool-call stays inside the 2-minute timeout budget.
  const arg = process.argv.find((a) => a.startsWith("--profile="));
  const profileIndex = arg ? Number(arg.split("=")[1]) - 1 : -1;
  const targets =
    profileIndex >= 0 && profileIndex < profiles.length
      ? [profiles[profileIndex]]
      : profiles;

  console.log("=".repeat(80));
  console.log("GoMate v2 — Prompt 3.3 conditional specialists demo");
  console.log("=".repeat(80));
  if (profileIndex >= 0) {
    console.log(`[demo] Running only profile #${profileIndex + 1} (--profile flag).`);
  }
  if (!process.env.FIRECRAWL_API_KEY) {
    console.warn("[demo] FIRECRAWL_API_KEY is not set — specialists will report quality='fallback'.");
  } else {
    console.log("[demo] FIRECRAWL_API_KEY present — scrapes will run live.");
  }
  console.log("[demo] Per-specialist budget: 25s; per-scrape timeout: 15s; master per-profile budget: 60s.");

  const allOutputs: SpecialistOutput[] = [];
  let allRows = 0;
  for (const { label, profile } of targets) {
    const { outputs, rows } = await runProfile(label, profile);
    allOutputs.push(...outputs);
    allRows += rows.length;
  }

  // Aggregate summary
  console.log("\n\n" + "=".repeat(80));
  console.log("OVERALL DEMO SUMMARY");
  console.log("=".repeat(80));
  const qualityCounts = allOutputs.reduce<Record<string, number>>((acc, o) => {
    acc[o.quality] = (acc[o.quality] ?? 0) + 1;
    return acc;
  }, {});
  const totalTokens = allOutputs.reduce((s, o) => s + o.tokensUsed, 0);
  const totalScraped = allOutputs.reduce((s, o) => s + o.sourceUrlsUsed.length, 0);
  const totalCitations = allOutputs.reduce((s, o) => s + o.citations.length, 0);

  console.log(`  conditional specialists run: ${allOutputs.length}`);
  console.log(`  quality breakdown:           ${JSON.stringify(qualityCounts)}`);
  console.log(`  total citations:             ${totalCitations}`);
  console.log(`  total scraped URLs:          ${totalScraped}`);
  console.log(`  total tokens used:           ${totalTokens}`);
  console.log(`  total audit rows:            ${allRows}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("\nDemo crashed:", err);
    process.exit(1);
  },
);
