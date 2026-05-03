// =============================================================
// @workspace/agents — digital_nomad_compliance
// (conditional: purpose === "digital_nomad")
// =============================================================
// Income threshold for the visa (compared against user's actual),
// tax-residency implications (183-day rule, etc), registration
// requirements, validity period.
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

const SPECIALIST = "digital_nomad_compliance";

function buildSystemPrompt(): string {
  return `You are a digital-nomad-visa compliance specialist. Compare the destination's digital nomad / remote-worker visa income threshold to the user's actual monthly income, then map the tax-residency consequences (most digital-nomad visas trigger destination tax residency after 183 days).

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: does the destination have a digital nomad visa? Name + authority + validity period.",
    "Paragraph 2: income threshold vs user's actual monthly income — does the user qualify?",
    "Paragraph 3: tax-residency implications (183-day rule, special non-dom regime if any, treaty considerations).",
    "Paragraph 4: registration / renewal steps + any income-source restrictions (e.g. cannot work for local employers)."
  ],
  "key_facts": {
    "visa_name": "string",
    "issuing_authority": "string",
    "income_threshold_eur_month": <number|null>,
    "user_income_eur_month": <number|null>,
    "income_qualifies": <boolean>,
    "tax_residency_implications": "string",
    "visa_validity_months": <number|null>,
    "renewal_possible": <boolean>,
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function digitalNomadComplianceSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "digital_nomad_compliance",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const sources = getAllSources(dest);

      const candidates: { label: string; url: string }[] = [];
      if (sources?.immigration) {
        candidates.push({ label: `${dest} — Immigration Authority`, url: sources.immigration });
      }
      if (sources?.visa && sources.visa !== sources.immigration) {
        candidates.push({ label: `${dest} — Visa Portal`, url: sources.visa });
      }
      if (sources?.tax) {
        candidates.push({ label: `${dest} — Tax Authority`, url: sources.tax });
      }
      const resolved = await scrapeCandidates(candidates, signal, dest);

      const search = await searchAndScrape(
        `${dest} digital nomad visa income requirement official`,
        { signal, limit: 2 },
      );
      if (search.ok) {
        for (const page of search.pages) {
          if (page.url) {
            resolved.sources.push(
              makeSourceContext(`${dest} — digital nomad visa (search)`, page.url, {
                ok: true,
                url: page.url,
                markdown: page.markdown,
                retrievedAt: search.retrievedAt,
              }),
            );
          }
        }
      }
      const merged = resolveQuality(resolved.sources, dest);

      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

${renderSourcesBlock(merged.sources)}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("digital_nomad_compliance", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "digital_nomad_compliance",
        sources: merged.sources,
        successfulScrapes: merged.successfulScrapes,
        confidence: merged.confidence,
        userPrompt,
        llm,
        synthesisMs,
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
