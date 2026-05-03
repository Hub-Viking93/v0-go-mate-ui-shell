// =============================================================
// @workspace/agents — healthcare_navigator (always runs; deeper if
// healthcare_needs ≠ "none" or chronic_condition_description present)
// =============================================================
// Note: classified as "conditional" in this wave because the
// always-run kernel was wired in Wave 2.x with only 6 specialists.
// healthcare_navigator here covers the deep mode case.
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

const SPECIALIST = "healthcare_navigator";

function buildSystemPrompt(): string {
  return `You are a healthcare navigator for relocating expats. Map the destination's healthcare system to this user's specific needs (chronic conditions, prescription continuity, English-speaking provider preference, accessibility, family).

Always cover: registration steps for primary care, public/private insurance options, finding a family doctor.
For chronic conditions: specialist availability, prescription medication availability + restrictions, insurance coverage for ongoing treatment.
For users wanting English-speaking doctors: list known English-friendly medical centres in the target city.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: how the destination healthcare system is structured (public vs private, GP gatekeeper, etc).",
    "Paragraph 2: registration steps for this person's situation (residency permit needed first? insurance card?).",
    "Paragraph 3: chronic-condition / medication continuity notes (or 'no specific condition flagged' if none).",
    "Paragraph 4: practical tips for finding an English-speaking GP / specialist if relevant; family considerations."
  ],
  "key_facts": {
    "registration_steps": ["step 1", "step 2"],
    "insurance_options": [{ "name": "string", "type": "public|private|hybrid", "approx_monthly_eur": <number|null> }],
    "recommended_providers": [{ "name": "string", "city": "string", "english_speaking": <boolean>, "url": "string-from-SOURCES-or-null" }],
    "prescription_continuity": { "applicable": <boolean>, "notes": "string" },
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function healthcareSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "healthcare_navigator",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const city = profile.target_city ? String(profile.target_city) : "";
      const chronic = profile.chronic_condition_description
        ? String(profile.chronic_condition_description)
        : "";
      const englishWanted =
        String(profile.english_speaking_doctor_required ?? "").toLowerCase() === "yes";

      const queries: string[] = [
        `${dest} healthcare system foreigner registration official site`,
        `${dest} health insurance for residents official`,
      ];
      if (chronic) {
        queries.push(`${dest} ${chronic} prescription medication availability`);
      }
      if (englishWanted && city) {
        queries.push(`${city} english speaking doctor expat clinic`);
      }

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
      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

${renderSourcesBlock(resolved.sources)}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("healthcare_navigator", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "healthcare_navigator",
        sources: resolved.sources,
        successfulScrapes: resolved.successfulScrapes,
        confidence: resolved.confidence,
        userPrompt,
        llm,
        synthesisMs,
        extra: { chronic_present: !!chronic, english_wanted: englishWanted },
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
