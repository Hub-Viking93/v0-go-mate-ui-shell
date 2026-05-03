// =============================================================
// @workspace/agents — cost_specialist
// =============================================================
// Sizes a realistic monthly budget for the destination city. We
// seed the LLM with a deterministic baseline from
// research-helpers/web-research.ts (calculateMonthlyBudget +
// calculateSavingsTarget), then ask claude-sonnet-4-5 to refine
// using the destination's official housing/employment portals
// (where rents are advertised in real life).
//
// PROFILE SLICE consumed:
//   destination, target_city, duration, monthly_budget,
//   savings_available, preferred_currency, moving_alone,
//   spouse_joining, children_count.
// =============================================================

import { callLLM } from "../router.js";
import { writeAuditRow } from "../audit.js";
import { scrapeOfficialSource } from "../scraping/firecrawl.js";
import { getAllSources } from "../sources/official-sources.js";
import {
  calculateMonthlyBudget,
  calculateSavingsTarget,
  getCostOfLivingData,
} from "../research-helpers/web-research.js";
import { resolveUserCurrency } from "../research-helpers/currency.js";
import { runSpecialist } from "./_base.js";
import {
  makeSourceContext,
  parseSpecialistResponse,
  renderSourcesBlock,
  URL_GUARDRAIL,
  type SourceContext,
} from "./_prompt-helpers.js";
import type { SpecialistContext, SpecialistOutput, SpecialistProfile } from "./types.js";

const SPECIALIST = "cost_specialist";

function buildSystemPrompt(): string {
  return `You are a cost-of-living specialist. You will receive a deterministic baseline budget AND scraped excerpts from the destination's official housing/employment portals. Your job: refine the baseline using the scraped real-rent context and adapt it to the user's household size + budget targets.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: how realistic the baseline rent looks vs scraped rentals; suggest a range.",
    "Paragraph 2: total monthly budget (minimum and comfortable) with key categories broken out.",
    "Paragraph 3: savings target before move + breakdown (emergency fund, moving costs, deposits, visa fees).",
    "Paragraph 4: practical advice (where rents are advertised, common deposit norms, currency to use)."
  ],
  "key_facts": {
    "currency": "ISO code",
    "monthly_minimum": <number>,
    "monthly_comfortable": <number>,
    "rent_estimate_range": { "low": <number>, "high": <number> },
    "savings_target_total": <number>,
    "key_breakdown": { "rent": <number>, "utilities": <number>, "groceries": <number>, "transportation": <number> },
    "warnings": ["budget red flags for this profile"]
  }
}

${URL_GUARDRAIL}`;
}

function resolveCandidateUrls(profile: SpecialistProfile): { label: string; url: string }[] {
  const dest = profile.destination ? String(profile.destination) : null;
  if (!dest) return [];
  const sources = getAllSources(dest);
  if (!sources) return [];
  const out: { label: string; url: string }[] = [];
  if (sources.housing) out.push({ label: `${dest} — Housing Portal`, url: sources.housing });
  if (sources.employment) out.push({ label: `${dest} — Labour Authority`, url: sources.employment });
  return out;
}

export async function costSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "cost_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const destination = profile.destination ? String(profile.destination) : "";
      const targetCity = profile.target_city ? String(profile.target_city) : undefined;
      const currency = resolveUserCurrency({
        preferred_currency: profile.preferred_currency ? String(profile.preferred_currency) : null,
        current_location: profile.current_location ? String(profile.current_location) : null,
        citizenship: profile.citizenship ? String(profile.citizenship) : null,
      });

      // Deterministic baseline from web-research helpers.
      const costData = getCostOfLivingData(destination, targetCity);
      const baselineBudget = costData ? calculateMonthlyBudget(profile, costData) : null;
      const baselineSavings = costData && baselineBudget
        ? calculateSavingsTarget(profile, baselineBudget.minimum)
        : null;

      const candidates = resolveCandidateUrls(profile);
      const scrapeResults = await Promise.all(
        candidates.map((c) => scrapeOfficialSource(c.url, { signal })),
      );
      const sources: SourceContext[] = candidates.map((c, i) =>
        makeSourceContext(c.label, c.url, scrapeResults[i]),
      );

      const successfulScrapes = sources.filter((s) => s.scraped);

      let quality: SpecialistOutput["quality"];
      let confidence: SpecialistOutput["confidence"];
      let fallbackReason: string | undefined;
      if (candidates.length === 0) {
        quality = "fallback"; confidence = "fallback";
        fallbackReason = `No housing/employment URL on file for destination "${destination || "(missing)"}". Baseline budget is generic.`;
      } else if (successfulScrapes.length === 0) {
        quality = "fallback"; confidence = "fallback";
        fallbackReason = `All ${candidates.length} housing/employment scrape(s) failed; baseline budget only.`;
      } else if (successfulScrapes.length < candidates.length) {
        quality = "partial"; confidence = "partial";
        fallbackReason = `${candidates.length - successfulScrapes.length}/${candidates.length} scrape(s) failed.`;
      } else {
        quality = "full"; confidence = "explicit";
      }

      const sourcesBlock = renderSourcesBlock(sources);
      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

DETERMINISTIC BASELINE (from generic cost-of-living tables — refine using SOURCES):
- Currency to report in: ${currency}
- Generic baseline budget (USD-magnitude defaults — adjust for ${destination}/${targetCity ?? "country average"}):
${baselineBudget ? JSON.stringify(baselineBudget, null, 2) : "  (none — destination unknown)"}
- Baseline savings target:
${baselineSavings ? JSON.stringify(baselineSavings, null, 2) : "  (none)"}

${sourcesBlock}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("cost_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      try {
        await writeAuditRow(ctx.logWriter, {
          profile_id: ctx.profileId,
          agent_name: "cost_specialist",
          model_used: llm.model_used,
          phase: "research",
          field_or_output_key: `${SPECIALIST}.synthesis`,
          value: { sources_scraped: successfulScrapes.length, sources_total: candidates.length, baseline_budget: baselineBudget, baseline_savings: baselineSavings, currency },
          confidence,
          source_url: successfulScrapes[0]?.url ?? sources[0]?.url ?? null,
          prompt: userPrompt,
          response: llm.content,
          wall_clock_ms: synthesisMs,
          tokens_used: llm.tokens_used,
        });
      } catch (err) {
        console.warn(`[${SPECIALIST}] synthesis-audit write failed:`, err instanceof Error ? err.message : err);
      }

      const parsed = parseSpecialistResponse(llm.content);
      return {
        specialist: SPECIALIST,
        contentParagraphs: parsed.paragraphs,
        citations: sources.map((s) => ({ url: s.url, label: s.label, scraped: s.scraped, note: s.scraped ? "Scraped this run" : "Whitelist reference" })),
        sourceUrlsUsed: successfulScrapes.map((s) => s.url),
        retrievedAt: new Date().toISOString(),
        quality,
        confidence,
        domainSpecificData: { ...parsed.keyFacts, baseline_budget: baselineBudget, baseline_savings: baselineSavings, baseline_currency: currency },
        wallClockMs: Date.now() - start,
        tokensUsed: llm.tokens_used,
        modelUsed: llm.model_used,
        fallbackReason,
      };
    },
  });
}
