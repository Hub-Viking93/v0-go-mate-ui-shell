// =============================================================
// @workspace/agents — pet_specialist (conditional: pets ≠ "none")
// =============================================================
// Import requirements, microchip + vaccination timeline (rabies has
// 21-day post-vaccination wait for EU travel), banned-breed list,
// import permit application, quarantine rules.
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

const SPECIALIST = "pet_specialist";

function buildSystemPrompt(): string {
  return `You are a pet relocation specialist. Map this user's pet (species, breed, age, current vaccination status) to the destination country's veterinary import requirements. Critical detail: rabies vaccine must be ≥21 days old and ≤1 year old for most EU entries; some breeds are restricted.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: import pathway summary for this species + destination (commercial vs non-commercial movement).",
    "Paragraph 2: vaccination + microchip timeline calibrated to user's existing status (e.g. 'must vaccinate ≥21 days before travel').",
    "Paragraph 3: breed restrictions or weight rules that apply to this pet.",
    "Paragraph 4: paperwork (import permit, EU pet passport, USDA APHIS endorsement etc) + quarantine rules."
  ],
  "key_facts": {
    "import_requirements": ["microchip ISO 11784/11785", "rabies vaccine ≥21 days", "..."],
    "vaccination_timeline": [
      { "step": "Microchip", "lead_days": <number>, "notes": "string" },
      { "step": "Rabies vaccine", "lead_days": <number>, "notes": "string" }
    ],
    "breed_restrictions": { "applies_to_user_pet": <boolean>, "restricted_breeds": ["bull terrier", "..."] },
    "import_permit": { "required": <boolean>, "authority": "string", "url": "string-from-SOURCES-or-null", "lead_days": <number|null> },
    "quarantine_rules": { "required": <boolean>, "duration_days": <number|null>, "notes": "string" },
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function petSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "pet_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const pet = profile.pets ? String(profile.pets) : "pet";
      const breed = profile.pet_breed ? String(profile.pet_breed) : "";

      // No "veterinary" field in CountrySources — search-and-scrape against
      // the destination's veterinary import authority.
      const queries = [
        `${dest} pet import veterinary authority requirements ${pet} official`,
        `${dest} ${pet} ${breed} breed restriction quarantine import`,
      ];

      const sources: SourceContext[] = [];
      for (const q of queries) {
        const result = await searchAndScrape(q, { signal, limit: 2 });
        if (result.ok) {
          for (const page of result.pages) {
            if (page.url) {
              sources.push(
                makeSourceContext(`${dest} — pet import (search)`, page.url, {
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
      const llm = await callLLM("pet_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "pet_specialist",
        sources: resolved.sources,
        successfulScrapes: resolved.successfulScrapes,
        confidence: resolved.confidence,
        userPrompt,
        llm,
        synthesisMs,
        extra: { pet, breed: breed || null },
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
