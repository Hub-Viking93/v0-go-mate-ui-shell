// =============================================================
// @workspace/agents — job_compliance_specialist
// (conditional: purpose === "work" AND job_offer === "yes"
//                AND posting_or_secondment !== "yes")
// =============================================================
// Local-hire work permit pathway, sponsor process, salary thresholds
// (e.g. EU Blue Card), processing timelines.
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

const SPECIALIST = "job_compliance_specialist";

function buildSystemPrompt(): string {
  return `You are a job-compliance specialist for a local-hire work move (NOT a posting). The user has a job offer with a destination employer and needs to obtain a work permit / residence permit for work.

Map the user's qualifications (highly skilled flag, education level, years of experience) to the most-applicable permit pathway (e.g. EU Blue Card, ICT permit, national work permit, salary-thresholded fast-track).

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: which work permit pathway applies (Blue Card vs national permit vs other) and why.",
    "Paragraph 2: employer sponsorship process — what the employer files, when, and what the user files.",
    "Paragraph 3: salary thresholds and how this user's offer compares; education / experience requirements.",
    "Paragraph 4: processing timelines + practical sequencing tips."
  ],
  "key_facts": {
    "permit_recommended": "string (e.g. EU Blue Card)",
    "permit_authority": "string",
    "salary_threshold_eur_year": <number|null>,
    "minimum_education_level": "bachelor|master|none",
    "minimum_experience_years": <number|null>,
    "sponsorship_required": <boolean>,
    "processing_weeks": <number|null>,
    "application_url": "string-from-SOURCES-or-null",
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function jobComplianceSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "job_compliance_specialist",
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
      if (sources?.employment) {
        candidates.push({ label: `${dest} — Labour / Work Permit`, url: sources.employment });
      }
      const resolved = await scrapeCandidates(candidates, signal, dest);

      const search = await searchAndScrape(
        `${dest} EU Blue Card work permit salary threshold official`,
        { signal, limit: 2 },
      );
      if (search.ok) {
        for (const page of search.pages) {
          if (page.url) {
            resolved.sources.push(
              makeSourceContext(`${dest} — Blue Card / work permit (search)`, page.url, {
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
      const llm = await callLLM("job_compliance_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "job_compliance_specialist",
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
