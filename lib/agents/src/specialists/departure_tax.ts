// =============================================================
// @workspace/agents — departure_tax_specialist
// (conditional: origin in EXIT_TAX_COUNTRIES — coordinator
// dispatches via currentLocationLooksLikeExitTaxCountry)
// =============================================================
// Exit-tax obligations specific to the user's origin, capital-gains
// implications, pension/retirement treatment, when to file departure
// declaration, treaties that may reduce double-taxation.
// =============================================================

import { callLLM } from "../router.js";
import { searchAndScrape } from "../scraping/firecrawl.js";
import { getAllSources } from "../sources/official-sources.js";
import { runSpecialist } from "./_base.js";
import {
  makeSourceContext,
  parseSpecialistResponse,
  renderSourcesBlock,
  URL_GUARDRAIL,
  type SourceContext,
} from "./_prompt-helpers.js";
import {
  citationsFromSources,
  resolveQuality,
  scrapeCandidates,
  writeSynthesisAudit,
} from "./_scrape-helpers.js";
import type { SpecialistContext, SpecialistOutput, SpecialistProfile } from "./types.js";

const SPECIALIST = "departure_tax_specialist";

/** Extract the country part of "City, Country" or "Country" current_location. */
function extractOriginCountry(current: unknown): string {
  if (!current) return "";
  const parts = String(current).split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

function buildSystemPrompt(): string {
  return `You are a departure-tax (exit-tax) specialist. The user's origin country imposes exit-tax obligations on emigrants. Map the rules to this person's specific situation: investments to migrate, capital gains exposure, pension treatment, and the destination's tax treaty.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: does the origin's exit tax bite for this user (asset thresholds, residency-years thresholds, citizenship implications)?",
    "Paragraph 2: capital-gains treatment on unrealised gains in shares / crypto / real estate.",
    "Paragraph 3: pension and retirement-account treatment when emigrating.",
    "Paragraph 4: filing timeline + key forms + treaty relief available between origin and destination."
  ],
  "key_facts": {
    "origin": "string",
    "exit_tax_applies": <boolean>,
    "asset_threshold_eur": <number|null>,
    "residency_years_threshold": <number|null>,
    "capital_gains_trigger": "deemed_disposal|defer_until_realised|none",
    "pension_treatment": "string",
    "filing_form": "string",
    "filing_deadline_relative_to_departure": "string",
    "treaty_with_destination_exists": <boolean>,
    "professional_advice_recommended": <boolean>,
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function departureTaxSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "departure_tax_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const origin = extractOriginCountry(profile.current_location);
      const dest = profile.destination ? String(profile.destination) : "";

      // Origin tax authority — whitelisted from official-sources.
      const candidates: { label: string; url: string }[] = [];
      const originSources = getAllSources(origin);
      if (originSources?.tax) {
        candidates.push({
          label: `${origin} — Origin Tax Authority (exit tax)`,
          url: originSources.tax,
        });
      }
      const resolved = await scrapeCandidates(candidates, signal, origin);

      const search = await searchAndScrape(
        `${origin} exit tax emigration unrealised capital gains official`,
        { signal, limit: 2 },
      );
      if (search.ok) {
        for (const page of search.pages) {
          if (page.url) {
            resolved.sources.push(
              makeSourceContext(`${origin} — exit tax (search)`, page.url, {
                ok: true,
                url: page.url,
                markdown: page.markdown,
                retrievedAt: search.retrievedAt,
              }),
            );
          }
        }
      }
      const merged = resolveQuality(resolved.sources, `${origin} → ${dest}`);

      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

ORIGIN PARSED: ${origin || "(unknown)"}

${renderSourcesBlock(merged.sources)}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("departure_tax_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "departure_tax_specialist",
        sources: merged.sources,
        successfulScrapes: merged.successfulScrapes,
        confidence: merged.confidence,
        userPrompt,
        llm,
        synthesisMs,
        extra: { origin, destination: dest },
      });

      const parsed = parseSpecialistResponse(llm.content);
      return {
        specialist: SPECIALIST,
        contentParagraphs: parsed.paragraphs,
        citations: citationsFromSources(merged.sources),
        sourceUrlsUsed: merged.successfulScrapes.map((s) => s.url),
        retrievedAt: new Date().toISOString(),
        quality: merged.quality,
        confidence: merged.confidence,
        domainSpecificData: parsed.keyFacts,
        wallClockMs: Date.now() - start,
        tokensUsed: llm.tokens_used,
        modelUsed: llm.model_used,
        fallbackReason: merged.fallbackReason,
      };
    },
  });
}
