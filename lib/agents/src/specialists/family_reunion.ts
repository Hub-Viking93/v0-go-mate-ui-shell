// =============================================================
// @workspace/agents — family_reunion_specialist
// (conditional: visa_role === "dependent" OR
//               settlement_reason === "family_reunion")
// =============================================================
// Sponsor-income thresholds, accommodation requirements, integration
// test if applicable, processing time, derivation of dependent's
// residency from primary's status.
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

const SPECIALIST = "family_reunion_specialist";

function buildSystemPrompt(): string {
  return `You are a family-reunion-visa specialist. The user is moving as a dependent (spouse / fiancé / child) of a primary residency holder, OR is the primary applying for family reunion. Map the destination's family-reunion requirements to this couple/family.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: which family-reunion route applies (citizen sponsor vs permit holder sponsor vs EU rights).",
    "Paragraph 2: sponsor-income / accommodation thresholds + relationship-evidence requirements (marriage cert, cohabitation proof, fiancé visa nuances).",
    "Paragraph 3: how the dependent's residency rights derive from the primary's status (independent right after N years etc).",
    "Paragraph 4: processing time + integration test (language, civics) if required."
  ],
  "key_facts": {
    "route_name": "string",
    "sponsor_income_threshold_eur_month": <number|null>,
    "accommodation_required": <boolean>,
    "marriage_certificate_required": <boolean>,
    "fiancé_route_available": <boolean>,
    "integration_test_required": <boolean>,
    "processing_weeks": <number|null>,
    "dependent_can_work": <boolean>,
    "independence_after_years": <number|null>,
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function familyReunionSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "family_reunion_specialist",
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
      const resolved = await scrapeCandidates(candidates, signal, dest);

      const relationship = String(profile.relationship_type ?? "");
      const search = await searchAndScrape(
        `${dest} family reunion ${relationship || "spouse"} visa sponsor income requirement official`,
        { signal, limit: 2 },
      );
      if (search.ok) {
        for (const page of search.pages) {
          if (page.url) {
            resolved.sources.push(
              makeSourceContext(`${dest} — family reunion (search)`, page.url, {
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
      const llm = await callLLM("family_reunion_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "family_reunion_specialist",
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
