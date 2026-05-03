// =============================================================
// @workspace/agents — vehicle_import_specialist
// (conditional: bringing_vehicle === "yes")
// =============================================================
// Import duty calculation, emissions compliance (Euro 6 etc),
// customs declaration, registration steps, license-plate process,
// technical inspection requirements.
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

const SPECIALIST = "vehicle_import_specialist";

function buildSystemPrompt(): string {
  return `You are a vehicle-import specialist. Map this user's vehicle (make/model/year, origin country, emission standard) to the destination's customs + emissions + registration rules.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: import duty + VAT outlook for this vehicle (used vs new, EU origin vs non-EU, returning resident exemptions).",
    "Paragraph 2: emissions compliance — does this vehicle meet destination requirements (e.g. Euro 6 for many EU destinations)?",
    "Paragraph 3: customs declaration process + registration steps (transit plates, technical inspection, conformity certificate).",
    "Paragraph 4: practical tips (cost-benefit vs selling and rebuying locally; deadlines after arrival)."
  ],
  "key_facts": {
    "import_duty_estimate_pct": <number|null>,
    "vat_applies": <boolean>,
    "vat_rate_pct": <number|null>,
    "emissions_compliant": <boolean>,
    "emissions_notes": "string",
    "customs_form": "string",
    "registration_authority": "string",
    "technical_inspection_required": <boolean>,
    "conformity_certificate_required": <boolean>,
    "deadline_after_arrival_days": <number|null>,
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function vehicleImportSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "vehicle_import_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const veh = profile.vehicle_make_model_year
        ? String(profile.vehicle_make_model_year)
        : "vehicle";
      const vehOrigin = profile.vehicle_origin_country
        ? String(profile.vehicle_origin_country)
        : "";

      const queries = [
        `${dest} vehicle import customs duty registration foreigner official`,
        `${dest} ${veh} emission standard import compliance`,
      ];
      if (vehOrigin) {
        queries.push(`${dest} vehicle import from ${vehOrigin} returning resident exemption`);
      }

      const sources: SourceContext[] = [];
      for (const q of queries) {
        const result = await searchAndScrape(q, { signal, limit: 2 });
        if (result.ok) {
          for (const page of result.pages) {
            if (page.url) {
              sources.push(
                makeSourceContext(`${dest} — vehicle import (search)`, page.url, {
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
      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

${renderSourcesBlock(resolved.sources)}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("vehicle_import_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "vehicle_import_specialist",
        sources: resolved.sources,
        successfulScrapes: resolved.successfulScrapes,
        confidence: resolved.confidence,
        userPrompt,
        llm,
        synthesisMs,
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
