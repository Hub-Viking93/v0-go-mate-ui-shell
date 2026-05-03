/**
 * Demo: run all 6 always-run specialists against the German posting
 * profile, in parallel via Promise.allSettled with a 60s master
 * AbortSignal.
 *
 * Run with:
 *   pnpm --filter @workspace/api-server exec tsx scripts/demo-specialists.mts
 *
 * Requires FIRECRAWL_API_KEY in env. ANTHROPIC_API_KEY is supplied
 * via the Replit AI Integrations proxy at the @workspace/integrations-anthropic-ai
 * layer — no caller-managed key needed.
 *
 * Wave 2.x — buildathon spec. Prints structured outputs + audit row
 * sequence so we can eyeball:
 *   * Each specialist returned a SpecialistOutput.
 *   * Citations come ONLY from the official-sources whitelist OR
 *     URLs we successfully scraped (no fabrication).
 *   * Audit rows fire at start + completion (and synthesis where the
 *     specialist runs an LLM call).
 *   * Quality drops to "partial" / "fallback" gracefully when scrapes
 *     fail, with a clear fallback_reason.
 */

import {
  visaSpecialist,
  taxSpecialist,
  costSpecialist,
  housingSpecialist,
  culturalSpecialist,
  documentsSpecialist,
  type LogWriter,
  type SpecialistContext,
  type SpecialistOutput,
  type SpecialistProfile,
  type AgentAuditRow,
  type AgentRunLogRow,
} from "@workspace/agents";

// ----- German posting demo profile (matches sample #2 in demo-coordinator) -----
const profile: SpecialistProfile = {
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
  posting_duration_months: 18,
  duration: "18_months",
  timeline: "1-3_months",
  moving_alone: "no",
  spouse_joining: "yes",
  children_count: 2,
  children_ages: "7, 11",
  monthly_budget: 5000,
  rental_budget_max: 2200,
  furnished_preference: "either",
  commute_tolerance_minutes: 45,
  preferred_currency: "EUR",
  monthly_income: 8500,
  savings_available: 60000,
  remote_income: "no",
  language_skill: "english_fluent_no_destination_lang",
  religious_practice_required: "no",
  birth_certificate_apostille_status: "in_progress",
  marriage_certificate_apostille_status: "not_started",
  diploma_apostille_status: "in_progress",
  police_clearance_status: "not_started",
  medical_exam_required: "unknown",
  education_level: "masters",
  years_experience: "12",
  pets: "none",
  healthcare_needs: "none",
};

// ----- In-memory LogWriter so the demo doesn't need Supabase ------------------
type Row = ({ kind: "run_log" } & AgentRunLogRow) | ({ kind: "audit" } & AgentAuditRow);
const auditLog: Row[] = [];
const inMemoryWriter: LogWriter = {
  async insertRunLog(row) { auditLog.push({ kind: "run_log", ...row }); },
  async insertAudit(row) { auditLog.push({ kind: "audit", ...row }); },
};

// ----- Master 60s budget for the entire dispatch -----------------------------
const masterController = new AbortController();
const masterTimer = setTimeout(() => masterController.abort(new Error("master-60s-budget")), 60_000);

const ctx: SpecialistContext = {
  profileId: "00000000-0000-0000-0000-000000000001", // dummy uuid for demo
  logWriter: inMemoryWriter,
  signal: masterController.signal,
};

// ---------------------------------------------------------------------------

function summariseOutput(label: string, out: SpecialistOutput) {
  const banner = "=".repeat(80);
  console.log(`\n${banner}\n${label} — ${out.specialist}\n${banner}`);
  console.log(`  quality:        ${out.quality}`);
  console.log(`  confidence:     ${out.confidence}`);
  console.log(`  model_used:     ${out.modelUsed}`);
  console.log(`  wall_clock:     ${out.wallClockMs}ms`);
  console.log(`  tokens_used:    ${out.tokensUsed}`);
  console.log(`  paragraphs:     ${out.contentParagraphs.length}`);
  console.log(`  citations:      ${out.citations.length}  (scraped=${out.sourceUrlsUsed.length})`);
  if (out.fallbackReason) console.log(`  fallbackReason: ${out.fallbackReason}`);
  console.log(`  --- citations ---`);
  for (const c of out.citations) {
    console.log(`    ${c.scraped ? "✓" : "·"} ${c.label}\n        ${c.url}`);
  }
  console.log(`  --- first paragraph ---`);
  console.log(`    ${(out.contentParagraphs[0] ?? "(empty)").slice(0, 280)}${(out.contentParagraphs[0] ?? "").length > 280 ? "…" : ""}`);
  if (Object.keys(out.domainSpecificData).length > 0) {
    console.log(`  --- domainSpecificData (truncated) ---`);
    const json = JSON.stringify(out.domainSpecificData, null, 2);
    console.log(json.length > 800 ? json.slice(0, 800) + "\n    …" : json);
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("GoMate v2 — 6 specialists demo (German posting → Stockholm)");
  console.log("=".repeat(80));
  console.log(`Profile: ${profile.name} (${profile.citizenship} → ${profile.destination}/${profile.target_city})`);
  console.log(`Purpose: ${profile.purpose} | Posting: ${profile.posting_or_secondment} (${profile.posting_duration_months}mo)`);
  console.log(`Children: ${profile.children_count} | Budget: ${profile.monthly_budget} ${profile.preferred_currency}`);
  console.log(`Master AbortSignal: 60s; per-specialist budget: 25s; per-scrape timeout: 15s.\n`);

  if (!process.env.FIRECRAWL_API_KEY) {
    console.warn("[demo] FIRECRAWL_API_KEY is not set in env. Specialists will report quality='fallback'.");
  } else {
    console.log("[demo] FIRECRAWL_API_KEY present — scrapes will run live.");
  }

  // Per-row progress hook — prints as each audit row gets written so the
  // demo log shows liveness during long Anthropic / Firecrawl waits.
  const origInsert = inMemoryWriter.insertAudit.bind(inMemoryWriter);
  inMemoryWriter.insertAudit = async (row) => {
    const v = row.value as { specialist?: string; status?: string; quality?: string; sources_scraped?: number; sources_total?: number } | null;
    process.stdout.write(`  · audit ${row.agent_name} | ${row.field_or_output_key ?? "(no key)"} | ${v?.status ?? v?.specialist ?? ""}${v?.quality ? ` quality=${v.quality}` : ""}${typeof v?.sources_scraped === "number" ? ` scraped=${v.sources_scraped}/${v.sources_total}` : ""}${row.tokens_used ? ` ${row.tokens_used}tok` : ""}\n`);
    await origInsert(row);
  };

  // Visa runs FIRST so documents can intersect its output.
  console.log("[1/2] Running visa specialist first (so documents can intersect)…");
  const visaStart = Date.now();
  const visaResult = await visaSpecialist(profile, ctx).catch((err) => ({
    error: err instanceof Error ? err.message : String(err),
  }));
  console.log(`  visa specialist returned in ${Date.now() - visaStart}ms`);
  if ("error" in visaResult) {
    console.error("Visa specialist threw (this should not happen — _base catches):", visaResult.error);
    clearTimeout(masterTimer);
    process.exit(1);
  }
  summariseOutput("STEP 1", visaResult);

  // Run the remaining 5 in parallel, with documents getting prior visa output.
  console.log("\n[2/2] Running remaining 5 specialists in parallel…");
  const startBatch = Date.now();
  const settled = await Promise.allSettled([
    taxSpecialist(profile, ctx).then((o) => ({ label: "tax", out: o })),
    costSpecialist(profile, ctx).then((o) => ({ label: "cost", out: o })),
    housingSpecialist(profile, ctx).then((o) => ({ label: "housing", out: o })),
    culturalSpecialist(profile, ctx).then((o) => ({ label: "cultural", out: o })),
    documentsSpecialist(profile, ctx, { visa: visaResult }).then((o) => ({ label: "documents", out: o })),
  ]);
  const batchMs = Date.now() - startBatch;

  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") {
      summariseOutput(`PARALLEL ${i + 1}/${settled.length}`, r.value.out);
    } else {
      console.error(`\nParallel slot ${i + 1} REJECTED (this should never happen — _base swallows errors):`, r.reason);
    }
  }

  // ----- Print audit-row sequence ------------------------------------------
  console.log("\n" + "=".repeat(80));
  console.log(`AUDIT ROW SEQUENCE (${auditLog.length} rows total; parallel batch took ${batchMs}ms)`);
  console.log("=".repeat(80));
  for (const row of auditLog) {
    if (row.kind === "audit") {
      const v = row.value as { specialist?: string; status?: string; quality?: string; sources_scraped?: number; sources_total?: number } | null;
      console.log(`  [audit] ${row.agent_name} | ${row.field_or_output_key ?? "(no key)"} | confidence=${row.confidence} | ${v?.status ?? v?.specialist ?? ""}${v?.quality ? ` quality=${v.quality}` : ""}${typeof v?.sources_scraped === "number" ? ` scraped=${v.sources_scraped}/${v.sources_total}` : ""} | ${row.wall_clock_ms ?? 0}ms${row.tokens_used ? ` | ${row.tokens_used} tok` : ""}`);
    } else {
      console.log(`  [run_log] ${row.agent_name} | ${row.status} | ${row.wall_clock_ms ?? 0}ms`);
    }
  }

  // ----- Final summary -----------------------------------------------------
  const allOutputs: SpecialistOutput[] = [
    visaResult,
    ...settled.flatMap((r) => (r.status === "fulfilled" ? [r.value.out] : [])),
  ];
  const qualityCounts = allOutputs.reduce<Record<string, number>>((acc, o) => {
    acc[o.quality] = (acc[o.quality] ?? 0) + 1;
    return acc;
  }, {});
  const totalTokens = allOutputs.reduce((s, o) => s + o.tokensUsed, 0);
  const totalScraped = allOutputs.reduce((s, o) => s + o.sourceUrlsUsed.length, 0);
  const totalCitations = allOutputs.reduce((s, o) => s + o.citations.length, 0);

  console.log("\n" + "=".repeat(80));
  console.log("DEMO SUMMARY");
  console.log("=".repeat(80));
  console.log(`  specialists run:     ${allOutputs.length}/6`);
  console.log(`  quality breakdown:   ${JSON.stringify(qualityCounts)}`);
  console.log(`  total citations:     ${totalCitations}`);
  console.log(`  total scraped URLs:  ${totalScraped}`);
  console.log(`  total tokens used:   ${totalTokens}`);
  console.log(`  total audit rows:    ${auditLog.length}`);

  clearTimeout(masterTimer);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("\nDemo crashed:", err);
    clearTimeout(masterTimer);
    process.exit(1);
  },
);
