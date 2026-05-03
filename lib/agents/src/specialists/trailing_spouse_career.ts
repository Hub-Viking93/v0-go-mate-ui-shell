// =============================================================
// @workspace/agents — trailing_spouse_career_specialist
// (conditional: spouse_joining === "yes" AND
//               spouse_seeking_work === "yes")
// =============================================================
// Labour-market overview for spouse's field, networking platforms,
// professional associations, language requirements per industry,
// dependent-visa work-permit considerations.
//
// Routes to claude-sonnet-4-6 for warmer tone — career disruption
// is emotionally significant.
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

const SPECIALIST = "trailing_spouse_career_specialist";

function buildSystemPrompt(): string {
  return `You are a trailing-spouse career specialist. The accompanying spouse plans to seek work in the destination. Address career disruption with warmth — not bureaucratic detachment. Include both the practical (work-permit rules under dependent visa, in-demand industries, networking) AND the emotional (this is hard, here's how others adapted).

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: warm acknowledgement of the spouse's career situation + the destination's labour market for their field (in-demand vs saturated).",
    "Paragraph 2: networking / job-platform recommendations specific to the destination + the spouse's field.",
    "Paragraph 3: professional associations + credential recognition (does the spouse's qualification need re-certification?).",
    "Paragraph 4: dependent-visa work-permit rules — does the spouse need a separate permit before working?"
  ],
  "key_facts": {
    "field_demand_assessment": "high|moderate|low",
    "dependent_can_work": <boolean>,
    "separate_work_permit_required": <boolean>,
    "language_requirement_for_field": "string",
    "credential_recognition_needed": <boolean>,
    "credential_recognition_authority": "string|null",
    "top_job_platforms": [{ "name": "string", "url": "string-from-SOURCES-or-null" }],
    "professional_associations": [{ "name": "string", "url": "string-from-SOURCES-or-null" }],
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function trailingSpouseCareerSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "trailing_spouse_career_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const field = profile.spouse_career_field
        ? String(profile.spouse_career_field)
        : "professional";
      const sources = getAllSources(dest);

      const candidates: { label: string; url: string }[] = [];
      if (sources?.employment) {
        candidates.push({ label: `${dest} — Labour / Job Portal`, url: sources.employment });
      }
      const resolved = await scrapeCandidates(candidates, signal, dest);

      const search = await searchAndScrape(
        `${dest} ${field} jobs hiring expat language requirement`,
        { signal, limit: 2 },
      );
      if (search.ok) {
        for (const page of search.pages) {
          if (page.url) {
            resolved.sources.push(
              makeSourceContext(`${dest} — ${field} careers (search)`, page.url, {
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
      const llm = await callLLM("trailing_spouse_career_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "trailing_spouse_career_specialist",
        sources: merged.sources,
        successfulScrapes: merged.successfulScrapes,
        confidence: merged.confidence,
        userPrompt,
        llm,
        synthesisMs,
        extra: { field },
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
