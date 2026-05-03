/**
 * Demo (Prompt 3.4): run Synthesizer + Critic on the German posting
 * profile (Hans → Stockholm).
 *
 * Flow:
 *   1. Load Hans's specialist outputs from disk cache, OR run all
 *      dispatched specialists (8 always-run + 3 conditional) and cache.
 *   2. Call synthesize() → UnifiedGuide (Opus 4.7).
 *   3. Call critique(profile, guide) → CriticOutput (Sonnet 4.5).
 *   4. Pretty-print the Critic's findings.
 *
 * Caching keeps synth+critic cheap to re-run while the scrape pipeline
 * is the slow / costly part. Pass `--no-cache` to force re-scrape.
 *
 *   pnpm --filter @workspace/api-server exec tsx scripts/demo-synth-critic.mts
 *   pnpm --filter @workspace/api-server exec tsx scripts/demo-synth-critic.mts --no-cache
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

import { decideDispatch } from "../src/lib/agents/coordinator";
import type { Profile } from "../src/lib/gomate/profile-schema-snapshot";
import {
  // Always-run
  visaSpecialist,
  taxSpecialist,
  costSpecialist,
  housingSpecialist,
  culturalSpecialist,
  documentsSpecialist,
  healthcareSpecialist,
  bankingSpecialist,
  // Conditional
  schoolsSpecialist,
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
  // Synth + critic
  synthesize,
  critique,
  // Types
  type LogWriter,
  type SpecialistContext,
  type SpecialistOutput,
  type SpecialistProfile,
  type AgentAuditRow,
  type AgentRunLogRow,
  type SynthesizerInput,
} from "@workspace/agents";

// ---------------------------------------------------------------------------
// Hans — German engineer posted to Stockholm 18 months
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

// ---------------------------------------------------------------------------
// Specialist registry — one entry per coordinator panel key.
// ---------------------------------------------------------------------------
type SpecialistFn = (p: SpecialistProfile, ctx: SpecialistContext) => Promise<SpecialistOutput>;

const SPECIALIST_FNS: Record<string, SpecialistFn> = {
  visa_specialist: visaSpecialist,
  tax_strategist: taxSpecialist,
  cost_specialist: costSpecialist,
  housing_specialist: housingSpecialist,
  cultural_adapter: culturalSpecialist,
  documents_specialist: documentsSpecialist,
  healthcare_navigator: healthcareSpecialist,
  banking_helper: bankingSpecialist,
  schools_specialist: schoolsSpecialist,
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

// ---------------------------------------------------------------------------
// In-memory LogWriter (no Supabase needed for the demo)
// ---------------------------------------------------------------------------
type Row = ({ kind: "run_log" } & AgentRunLogRow) | ({ kind: "audit" } & AgentAuditRow);

function makeWriter(label: string): { writer: LogWriter; rows: Row[] } {
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
            sections_count?: number;
            gaps_count?: number;
            unresolved_issues?: number;
          }
        | null;
      const tail = [
        v?.quality ? ` quality=${v.quality}` : "",
        typeof v?.sections_count === "number" ? ` sections=${v.sections_count}` : "",
        typeof v?.gaps_count === "number" ? ` gaps=${v.gaps_count}` : "",
        typeof v?.unresolved_issues === "number" ? ` unresolved=${v.unresolved_issues}` : "",
        row.tokens_used ? ` ${row.tokens_used}tok` : "",
      ].join("");
      process.stdout.write(
        `      · audit [${label}] ${row.agent_name} | ${row.field_or_output_key ?? "(no key)"} | ${
          v?.status ?? v?.specialist ?? ""
        }${tail}\n`,
      );
    },
  };
  return { writer, rows };
}

// ---------------------------------------------------------------------------
// Cache I/O — store specialist outputs as JSON so synth+critic re-runs fast.
// ---------------------------------------------------------------------------
const CACHE_PATH = "/tmp/gomate-demo-cache/hans-specialists.json";
const GUIDE_CACHE_PATH = "/tmp/gomate-demo-cache/hans-guide.json";

interface CacheFile {
  cachedAt: string;
  profileKey: string;
  outputs: { name: string; output: SpecialistOutput }[];
}

interface GuideCacheFile {
  cachedAt: string;
  profileKey: string;
  guide: Awaited<ReturnType<typeof synthesize>>;
}

function profileCacheKey(profile: Profile): string {
  return JSON.stringify(profile);
}

function loadCache(profile: Profile): SynthesizerInput[] | null {
  if (!existsSync(CACHE_PATH)) return null;
  try {
    const raw = readFileSync(CACHE_PATH, "utf8");
    const parsed: CacheFile = JSON.parse(raw);
    if (parsed.profileKey !== profileCacheKey(profile)) {
      console.log("[demo] Cache profile mismatch — ignoring stale cache.");
      return null;
    }
    return parsed.outputs;
  } catch (err) {
    console.warn("[demo] Cache read failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

function saveCache(profile: Profile, outputs: SynthesizerInput[]): void {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  const file: CacheFile = {
    cachedAt: new Date().toISOString(),
    profileKey: profileCacheKey(profile),
    outputs,
  };
  writeFileSync(CACHE_PATH, JSON.stringify(file, null, 2), "utf8");
}

function loadGuideCache(profile: Profile): GuideCacheFile["guide"] | null {
  if (!existsSync(GUIDE_CACHE_PATH)) return null;
  try {
    const raw = readFileSync(GUIDE_CACHE_PATH, "utf8");
    const parsed: GuideCacheFile = JSON.parse(raw);
    if (parsed.profileKey !== profileCacheKey(profile)) return null;
    return parsed.guide;
  } catch {
    return null;
  }
}

function saveGuideCache(profile: Profile, guide: GuideCacheFile["guide"]): void {
  mkdirSync(dirname(GUIDE_CACHE_PATH), { recursive: true });
  const file: GuideCacheFile = {
    cachedAt: new Date().toISOString(),
    profileKey: profileCacheKey(profile),
    guide,
  };
  writeFileSync(GUIDE_CACHE_PATH, JSON.stringify(file, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Run all dispatched specialists for Hans
// ---------------------------------------------------------------------------
async function runAllSpecialists(profile: Profile): Promise<SynthesizerInput[]> {
  const dispatch = decideDispatch(profile);
  console.log(`\n[demo] Dispatching ${dispatch.specialists.length} specialists for Hans:`);
  for (const s of dispatch.specialists) {
    console.log(`        - ${s.name}`);
  }

  const { writer } = makeWriter("specialists");
  const masterController = new AbortController();
  const masterTimer = setTimeout(
    () => masterController.abort(new Error("master-90s-budget")),
    90_000,
  );
  const ctx: SpecialistContext = {
    profileId: "00000000-0000-0000-0000-000000000hans",
    logWriter: writer,
    signal: masterController.signal,
  };

  const start = Date.now();
  const settled = await Promise.allSettled(
    dispatch.specialists.map(async (s) => {
      const fn = SPECIALIST_FNS[s.name];
      if (!fn) throw new Error(`No specialist implementation for ${s.name}`);
      const out = await fn(s.inputs as SpecialistProfile, ctx);
      return { name: s.name, output: out };
    }),
  );
  const elapsed = Date.now() - start;
  clearTimeout(masterTimer);

  const outputs: SynthesizerInput[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      outputs.push(r.value);
    } else {
      console.error("[demo] specialist REJECTED:", r.reason);
    }
  }
  console.log(`[demo] Specialists batch took ${elapsed}ms; ${outputs.length}/${dispatch.specialists.length} succeeded.\n`);
  return outputs;
}

// ---------------------------------------------------------------------------
// Pretty-printers
// ---------------------------------------------------------------------------
function bar(ch = "=", n = 80): string {
  return ch.repeat(n);
}

function printGuideSummary(guide: { sections: { key: string; title: string; paragraphs: string[]; citations: { url: string; scraped: boolean }[] }[]; consistencyIssues: string[]; unresolvedIssues: string[]; wallClockMs: number; tokensUsed: number; modelUsed: string }) {
  console.log(`\n${bar("=")}\nUNIFIED GUIDE (Synthesizer output)\n${bar("=")}`);
  console.log(`  model:                ${guide.modelUsed}`);
  console.log(`  wall_clock:           ${guide.wallClockMs}ms`);
  console.log(`  tokens_used:          ${guide.tokensUsed}`);
  console.log(`  sections:             ${guide.sections.length}`);
  console.log(`  consistency_issues:   ${guide.consistencyIssues.length} (DETECTED — not auto-applied to prose)`);
  console.log(`  unresolved_issues:    ${guide.unresolvedIssues.length}`);
  console.log();
  for (const sec of guide.sections) {
    const scraped = sec.citations.filter((c) => c.scraped).length;
    console.log(`  • [${sec.key}] ${sec.title} — ${sec.paragraphs.length} paragraphs, ${sec.citations.length} citations (${scraped} scraped)`);
  }
  if (guide.consistencyIssues.length > 0) {
    console.log(`\n  Consistency issues (DETECTED by synthesizer — UI should surface as advisories):`);
    for (const i of guide.consistencyIssues) console.log(`    ✓ ${i}`);
  }
  if (guide.unresolvedIssues.length > 0) {
    console.log(`\n  Unresolved issues (FORWARDED to critic / user):`);
    for (const i of guide.unresolvedIssues) console.log(`    ! ${i}`);
  }
}

function printCritique(c: { gaps: { area: string; description: string; suggestedSpecialist?: string }[]; weakClaims: { claim: string; location: string; reason: string }[]; missingForUserSituation: string[]; wallClockMs: number; tokensUsed: number; modelUsed: string }) {
  console.log(`\n${bar("=")}\nCRITIC FINDINGS (adversarial pass)\n${bar("=")}`);
  console.log(`  model:                ${c.modelUsed}`);
  console.log(`  wall_clock:           ${c.wallClockMs}ms`);
  console.log(`  tokens_used:          ${c.tokensUsed}`);
  console.log(`  gaps:                 ${c.gaps.length}`);
  console.log(`  weak_claims:          ${c.weakClaims.length}`);
  console.log(`  missing_for_user:     ${c.missingForUserSituation.length}`);

  if (c.gaps.length > 0) {
    console.log(`\n  ${bar("-", 76)}\n  GAPS\n  ${bar("-", 76)}`);
    c.gaps.forEach((g, i) => {
      console.log(`\n  ${i + 1}. [${g.area}] ${g.suggestedSpecialist ? `→ ${g.suggestedSpecialist}` : ""}`);
      console.log(`     ${g.description}`);
    });
  }

  if (c.weakClaims.length > 0) {
    console.log(`\n  ${bar("-", 76)}\n  WEAK CLAIMS\n  ${bar("-", 76)}`);
    c.weakClaims.forEach((w, i) => {
      console.log(`\n  ${i + 1}. at ${w.location}`);
      console.log(`     claim:  "${w.claim}"`);
      console.log(`     reason: ${w.reason}`);
    });
  }

  if (c.missingForUserSituation.length > 0) {
    console.log(`\n  ${bar("-", 76)}\n  MISSING FOR USER SITUATION\n  ${bar("-", 76)}`);
    c.missingForUserSituation.forEach((m, i) => {
      console.log(`\n  ${i + 1}. ${m}`);
    });
  }

  if (c.gaps.length === 0 && c.weakClaims.length === 0 && c.missingForUserSituation.length === 0) {
    console.log(`\n  (Critic returned no findings — verify the adversarial prompt is firing.)`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  type Blockable = { _handle?: { setBlocking?: (b: boolean) => void } };
  (process.stdout as unknown as Blockable)._handle?.setBlocking?.(true);
  (process.stderr as unknown as Blockable)._handle?.setBlocking?.(true);

  const noCache = process.argv.includes("--no-cache");
  const noSynthCache = process.argv.includes("--no-synth-cache") || noCache;
  const criticOnly = process.argv.includes("--critic-only");

  console.log(bar("="));
  console.log("GoMate v2 — Prompt 3.4 Synthesizer + Critic demo");
  console.log("Profile: Hans — German engineer posted to Stockholm, 18 months, 2 kids");
  console.log(bar("="));

  if (!process.env.FIRECRAWL_API_KEY) {
    console.warn("[demo] FIRECRAWL_API_KEY not set — specialists may report quality='fallback'.");
  }

  // ---- 1. Load or build specialist outputs ---------------------------------
  let outputs: SynthesizerInput[] | null = noCache ? null : loadCache(HANS_PROFILE);
  if (outputs) {
    console.log(`[demo] Loaded ${outputs.length} cached specialist outputs from ${CACHE_PATH}.`);
  } else {
    outputs = await runAllSpecialists(HANS_PROFILE);
    if (outputs.length === 0) {
      console.error("[demo] No specialist outputs produced — aborting.");
      process.exit(1);
    }
    saveCache(HANS_PROFILE, outputs);
    console.log(`[demo] Cached ${outputs.length} specialist outputs to ${CACHE_PATH}.`);
  }

  // Quality breakdown of the inputs
  const qCounts = outputs.reduce<Record<string, number>>((acc, o) => {
    acc[o.output.quality] = (acc[o.output.quality] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`[demo] Specialist input quality: ${JSON.stringify(qCounts)}`);

  // ---- 2. Synthesize -------------------------------------------------------
  let guide = noSynthCache ? null : loadGuideCache(HANS_PROFILE);
  if (guide && !criticOnly) {
    console.log(`\n[demo] Loaded cached UnifiedGuide from ${GUIDE_CACHE_PATH}.`);
  } else if (criticOnly && !guide) {
    console.error("[demo] --critic-only requires a cached guide — none found.");
    process.exit(1);
  }
  if (!guide) {
    const synthCtx = { profileId: "00000000-0000-0000-0000-000000000hans", logWriter: makeWriter("synth").writer };
    console.log(`\n[demo] Calling synthesize() with ${outputs.length} specialist outputs…`);
    guide = await synthesize(outputs, synthCtx);
    saveGuideCache(HANS_PROFILE, guide);
    console.log(`[demo] Cached UnifiedGuide to ${GUIDE_CACHE_PATH}.`);
  }
  printGuideSummary(guide);

  // ---- 3. Critique ---------------------------------------------------------
  const critCtx = { profileId: "00000000-0000-0000-0000-000000000hans", logWriter: makeWriter("critic").writer };
  console.log(`\n[demo] Calling critique(profile, guide) (Sonnet 4.5, adversarial)…`);
  const findings = await critique(HANS_PROFILE as Record<string, string | number | null | undefined>, guide, critCtx);
  printCritique(findings);

  console.log(`\n${bar("=")}\nDONE — Synthesizer + Critic both succeeded.\n${bar("=")}\n`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("\nDemo crashed:", err);
    process.exit(1);
  },
);
