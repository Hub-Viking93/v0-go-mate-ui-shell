// =============================================================
// @workspace/agents — pension_continuity_specialist
// (conditional: pension_continuity_required === "yes")
// =============================================================
// Pension fund continuity rules + treaty implications, when
// contributions transfer vs accumulate separately, retirement-age
// implications, withdrawal rules from origin pension upon emigration.
//
// Routes to claude-opus-4-7 for depth.
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

const SPECIALIST = "pension_continuity_specialist";

function extractOriginCountry(current: unknown): string {
  if (!current) return "";
  const parts = String(current).split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

function buildSystemPrompt(): string {
  return `You are a pension-continuity specialist. The user has flagged that pension continuity matters to them. Address: how origin and destination pension systems interact (treaty? aggregation rule? totalisation agreement?), whether contributions can keep flowing into the origin scheme during the move, what happens to accumulated pension on emigration, and retirement-age implications.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: how the origin pension system treats emigrants (frozen pot vs continued contributions vs lump-sum option).",
    "Paragraph 2: treaty / totalisation agreement between origin and destination — does service in one count toward the other?",
    "Paragraph 3: practical contribution path during the stay (continue origin via voluntary contributions vs join destination pension).",
    "Paragraph 4: retirement-age + withdrawal mechanics + flag if professional advice is recommended."
  ],
  "key_facts": {
    "totalisation_agreement_exists": <boolean>,
    "treaty_name": "string|null",
    "origin_contributions_can_continue": <boolean>,
    "voluntary_contribution_mechanism": "string|null",
    "destination_pension_join_required": <boolean>,
    "retirement_age_origin": <number|null>,
    "retirement_age_destination": <number|null>,
    "lump_sum_option_on_emigration": <boolean>,
    "professional_advice_recommended": <boolean>,
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function pensionContinuitySpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "pension_continuity_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const origin = extractOriginCountry(profile.current_location);

      const queries = [
        `${origin} pension authority emigration continuity rules official`,
        `${dest} pension authority foreign worker totalisation agreement official`,
      ];
      if (origin && dest) {
        queries.push(`${origin} ${dest} social security totalisation pension agreement`);
      }

      const sources: SourceContext[] = [];
      for (const q of queries) {
        const result = await searchAndScrape(q, { signal, limit: 2 });
        if (result.ok) {
          for (const page of result.pages) {
            if (page.url) {
              sources.push(
                makeSourceContext(`${q.slice(0, 60)}…`, page.url, {
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

      const resolved = resolveQuality(sources, `${origin} → ${dest}`);
      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

ORIGIN PARSED: ${origin || "(unknown)"}

${renderSourcesBlock(resolved.sources)}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("pension_continuity_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "pension_continuity_specialist",
        sources: resolved.sources,
        successfulScrapes: resolved.successfulScrapes,
        confidence: resolved.confidence,
        userPrompt,
        llm,
        synthesisMs,
        extra: { origin, destination: dest },
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
