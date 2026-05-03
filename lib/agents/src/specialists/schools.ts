// =============================================================
// @workspace/agents — schools_specialist (conditional: children_count > 0)
// =============================================================
// Recommends 3-5 schools per child by age, with application
// timelines, fees, language of instruction, waitlist info.
//
// Routing: spec asks for Gemini 2.5 for breadth. Gemini not wired
// in this project (router throws). We modelOverride to claude-
// sonnet-4-6 with TODO[prompt-Wave2-gemini].
// =============================================================

import { callLLM } from "../router.js";
import { searchAndScrape } from "../scraping/firecrawl.js";
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
  writeSynthesisAudit,
} from "./_scrape-helpers.js";
import type { SpecialistContext, SpecialistOutput, SpecialistProfile } from "./types.js";

const SPECIALIST = "schools_specialist";

function buildSystemPrompt(): string {
  return `You are a schools specialist for relocating families. Recommend 3-5 schools per child, matched to their age, language ability, and parents' preference type (international / public / bilingual / private).

You will receive the user profile and a SOURCES block with markdown excerpts from official education authorities and/or international school directories.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: overview of the destination school system + how international vs public schools differ for this family.",
    "Paragraph 2: per-child recommendation summary (do NOT list every school here — that goes in key_facts.children_recommendations).",
    "Paragraph 3: application timelines (international schools often need 6-12 month lead times) + fees overview.",
    "Paragraph 4: language-of-instruction strategy for this household, given children's destination-language skills."
  ],
  "key_facts": {
    "system_overview": "1-line plain-English summary",
    "average_intl_school_fee_range_eur": { "low": <number>, "high": <number> },
    "children_recommendations": [
      {
        "child_label": "Child age 7",
        "schools": [
          { "name": "string", "type": "international|bilingual|public|private", "language": "string", "approx_fee_eur_year": <number|null>, "application_lead_months": <number|null>, "waitlist_likely": <boolean>, "url": "string-from-SOURCES-or-null" }
        ]
      }
    ],
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

function parseChildrenAges(profile: SpecialistProfile): number[] {
  const raw = profile.children_ages;
  if (!raw) return [];
  return String(raw)
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function schoolsSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "schools_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const city = profile.target_city ? String(profile.target_city) : "";
      const ages = parseChildrenAges(profile);
      const pref = profile.children_school_type_preference
        ? String(profile.children_school_type_preference)
        : "international";

      // Education isn't a CountrySources field — use search-and-scrape against
      // the destination's official education authority + international-school
      // directories.
      const queries = [
        `${dest} ministry of education official site international schools`,
        `${city || dest} international schools ${pref} admissions english`,
      ];

      const sources: SourceContext[] = [];
      for (const q of queries) {
        const result = await searchAndScrape(q, { signal, limit: 2 });
        if (result.ok) {
          for (const page of result.pages) {
            if (page.url) {
              sources.push(
                makeSourceContext(`${dest} — ${q.slice(0, 60)}…`, page.url, {
                  ok: true,
                  url: page.url,
                  markdown: page.markdown,
                  retrievedAt: result.retrievedAt,
                }),
              );
            }
          }
        }
      }

      const resolved = resolveQuality(sources, dest);
      const sourcesBlock = renderSourcesBlock(resolved.sources);
      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

CHILDREN AGES PARSED: ${JSON.stringify(ages)}

${sourcesBlock}

Produce one entry in children_recommendations per child age listed above. Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("schools_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
        // TODO[prompt-Wave2-gemini]: Gemini not wired; fall back to Sonnet.
        modelOverride: "claude-sonnet-4-6",
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "schools_specialist",
        sources: resolved.sources,
        successfulScrapes: resolved.successfulScrapes,
        confidence: resolved.confidence,
        userPrompt,
        llm,
        synthesisMs,
        extra: { children_count: ages.length, preference: pref },
      });

      const parsed = parseSpecialistResponse(llm.content);
      return {
        specialist: SPECIALIST,
        contentParagraphs: parsed.paragraphs,
        citations: citationsFromSources(resolved.sources),
        sourceUrlsUsed: resolved.successfulScrapes.map((s) => s.url),
        retrievedAt: new Date().toISOString(),
        quality: resolved.quality,
        confidence: resolved.confidence,
        domainSpecificData: parsed.keyFacts,
        wallClockMs: Date.now() - start,
        tokensUsed: llm.tokens_used,
        modelUsed: llm.model_used,
        fallbackReason: resolved.fallbackReason,
      };
    },
  });
}
