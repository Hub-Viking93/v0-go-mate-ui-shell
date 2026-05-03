// =============================================================
// @workspace/agents — housing_specialist
// =============================================================
// Surfaces neighbourhood + rental-platform recommendations for
// the destination city, sized to the user's budget and household.
// Routes to claude-sonnet-4-5.
//
// PROFILE SLICE consumed:
//   destination, target_city, duration, monthly_budget,
//   rental_budget_max, furnished_preference,
//   commute_tolerance_minutes, moving_alone, children_count, pets.
// =============================================================

import { callLLM } from "../router.js";
import { writeAuditRow } from "../audit.js";
import { scrapeOfficialSource, searchAndScrape } from "../scraping/firecrawl.js";
import { getAllSources } from "../sources/official-sources.js";
import { runSpecialist } from "./_base.js";
import {
  makeSourceContext,
  parseSpecialistResponse,
  renderSourcesBlock,
  URL_GUARDRAIL,
  type SourceContext,
} from "./_prompt-helpers.js";
import type { SpecialistContext, SpecialistOutput, SpecialistProfile } from "./types.js";

const SPECIALIST = "housing_specialist";

function buildSystemPrompt(): string {
  return `You are a housing specialist for relocating expats. Your job is to recommend 2-4 neighbourhoods that fit the user's budget, household size and commute tolerance, and to point at the official / dominant rental platforms in the destination.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: how this user's budget maps to the city's rent ranges (1-bed vs 3-bed vs shared).",
    "Paragraph 2: 2-4 neighbourhood recommendations with vibe + commute notes.",
    "Paragraph 3: rental platforms + viewing process (cite SOURCES).",
    "Paragraph 4: deposit / paperwork norms + landlord requirements (referee letters, salary multiples, pet policies)."
  ],
  "key_facts": {
    "recommended_neighbourhoods": [{ "name": "string", "vibe": "string", "approx_rent_eur": <number or null> }],
    "rental_platforms": [{ "name": "string", "url": "string (must be from SOURCES)" }],
    "typical_deposit_months": <number or null>,
    "warnings": ["red flags like 'pets often refused' or 'Schufa required'"]
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
  // Fall back to immigration portal — many countries' immigration sites
  // include 'finding accommodation' guidance.
  if (sources.immigration && !sources.housing) {
    out.push({ label: `${dest} — Immigration (housing guidance)`, url: sources.immigration });
  }
  return out;
}

export async function housingSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "housing_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const candidates = resolveCandidateUrls(profile);

      const scrapeResults = await Promise.all(
        candidates.map((c) => scrapeOfficialSource(c.url, { signal })),
      );
      const sources: SourceContext[] = candidates.map((c, i) =>
        makeSourceContext(c.label, c.url, scrapeResults[i]),
      );

      // Augment with a search for the city-specific rental-platform query.
      const city = profile.target_city ? String(profile.target_city) : null;
      if (city && profile.destination) {
        const search = await searchAndScrape(
          `${city} ${profile.destination} apartment rental official site`,
          { signal, limit: 2 },
        );
        if (search.ok) {
          for (const page of search.pages) {
            if (page.url) {
              sources.push(makeSourceContext(`${city} — Rental search`, page.url, {
                ok: true, url: page.url, markdown: page.markdown, retrievedAt: search.retrievedAt,
              }));
            }
          }
        }
      }

      const successfulScrapes = sources.filter((s) => s.scraped);

      let quality: SpecialistOutput["quality"];
      let confidence: SpecialistOutput["confidence"];
      let fallbackReason: string | undefined;
      if (sources.length === 0) {
        quality = "fallback"; confidence = "fallback";
        fallbackReason = `No housing URL on file for destination "${profile.destination ?? "(missing)"}".`;
      } else if (successfulScrapes.length === 0) {
        quality = "fallback"; confidence = "fallback";
        fallbackReason = `All ${sources.length} housing scrape(s) failed; embedded knowledge only.`;
      } else if (successfulScrapes.length < sources.length) {
        quality = "partial"; confidence = "partial";
        fallbackReason = `${sources.length - successfulScrapes.length}/${sources.length} scrape(s) failed.`;
      } else {
        quality = "full"; confidence = "explicit";
      }

      const sourcesBlock = renderSourcesBlock(sources);
      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

${sourcesBlock}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("housing_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      try {
        await writeAuditRow(ctx.logWriter, {
          profile_id: ctx.profileId,
          agent_name: "housing_specialist",
          model_used: llm.model_used,
          phase: "research",
          field_or_output_key: `${SPECIALIST}.synthesis`,
          value: { sources_scraped: successfulScrapes.length, sources_total: sources.length },
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
        domainSpecificData: parsed.keyFacts,
        wallClockMs: Date.now() - start,
        tokensUsed: llm.tokens_used,
        modelUsed: llm.model_used,
        fallbackReason,
      };
    },
  });
}
