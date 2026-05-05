// =============================================================
// @workspace/agents — cultural_adapter
// =============================================================
// Flags etiquette, language, integration considerations + nightlife
// safety norms. Unlike the other specialists, this one does NOT
// scrape — the COUNTRY_DATA seed in lib/agents/src/sources/country-data.ts
// already has hand-curated culture/nightlife/safety/expat tables.
//
// Routes to claude-sonnet-4-6 to keep prose warm + opinionated.
//
// PROFILE SLICE consumed:
//   citizenship, current_location, destination, target_city,
//   duration, purpose, language_skill, religious_practice_required,
//   children_count.
//
// Quality semantics:
//   * "full"     — COUNTRY_DATA has an entry for the destination.
//   * "fallback" — no entry; LLM works from embedded knowledge only.
// "partial" doesn't apply (no scraping).
// =============================================================

import { callLLM } from "../router.js";
import { writeAuditRow } from "../audit.js";
import { COUNTRY_DATA } from "../sources/country-data.js";
import { runSpecialist } from "./_base.js";
import { parseSpecialistResponse, URL_GUARDRAIL } from "./_prompt-helpers.js";
import type { SpecialistContext, SpecialistOutput, SpecialistProfile } from "./types.js";

const SPECIALIST = "cultural_adapter";

function buildSystemPrompt(): string {
  return `You are a cultural adapter for relocating expats. Your job is to flag etiquette, language, workplace norms, and integration considerations the user should know about — adapted to their citizenship, family setup, and stay duration.

You will receive a CULTURE FACTSHEET (curated COUNTRY_DATA — treat as authoritative). You may NOT cite external URLs unless they are explicitly in the factsheet's rentalPlatforms / jobPlatforms / expatCommunities lists.

The frontend renders four DISTINCT cultural sub-tabs from your output. Each paragraph below MUST be unique and substantive — do not repeat content across paragraphs.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1 — CULTURAL OVERVIEW: 1 paragraph high-level orientation. The single biggest cultural shift this user will feel; the headline trait of the destination's culture; what they should mentally prepare for on day one.",
    "Paragraph 2 — CULTURAL DEEP DIVE: 1 paragraph on day-to-day social norms beyond the overview — specific etiquette around food, greetings, public behavior, queueing, tipping, gift-giving. Concrete examples, not generalities.",
    "Paragraph 3 — WORKPLACE CULTURE: 1 paragraph on workplace dynamics specifically — hierarchy / first-name basis, communication style, meeting norms, work-life balance expectations, vacation/parental-leave culture. Skip if user is not moving for work; cover briefly otherwise.",
    "Paragraph 4 — SOCIAL INTEGRATION: 1 paragraph on how to actually make friends and find community — expat hubs, local meetup channels, language exchanges, hobby clubs, what works and what doesn't for newcomers."
  ],
  "key_facts": {
    "language_difficulty": "low | medium | high",
    "english_workable": <boolean>,
    "dos": [
      "5 positive, specific 'do this' tips. Each tip is one sentence, max ~25 words. Examples: 'Participate in fika (coffee breaks) — declining repeatedly reads as antisocial.' / 'Use the queueing-number system at all service counters — never skip the line.' Be culture-specific, not generic."
    ],
    "donts": [
      "5 explicit 'avoid this' tips, each starting with a negative verb (Don't / Avoid / Never / Skip). One sentence, max ~25 words. Examples: 'Don't be late for meetings or social events — even five minutes is genuinely disrespectful.' / 'Avoid loud phone calls on public transit — silence is the norm, not rudeness.'"
    ],
    "integration_channels": [{ "name": "string", "url": "string (must be in factsheet)" }],
    "warnings": ["operational risks specific to children, religion, safety, lgbtq, or local hazards if relevant — these are 'watch out' items, NOT etiquette don'ts"]
  }
}

${URL_GUARDRAIL}`;
}

export async function culturalSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "cultural_adapter",
    profile,
    ctx,
    body: async (profile, ctx) => {
      const start = Date.now();
      const destination = profile.destination ? String(profile.destination) : "";
      const seed = COUNTRY_DATA[destination] ?? null;

      let quality: SpecialistOutput["quality"];
      let confidence: SpecialistOutput["confidence"];
      let fallbackReason: string | undefined;

      if (seed) {
        quality = "full";
        confidence = "explicit";
      } else {
        quality = "fallback";
        confidence = "fallback";
        fallbackReason = `No COUNTRY_DATA seed entry for destination "${destination || "(missing)"}". LLM working from embedded knowledge.`;
      }

      // Build allowable URLs from the seed (rentalPlatforms / jobPlatforms /
      // expatCommunities). These become the "citations" for the UI.
      const seedUrls: { url: string; label: string }[] = [];
      if (seed) {
        for (const p of seed.rentalPlatforms ?? []) seedUrls.push({ url: p.url, label: `${destination} — ${p.name} (rental)` });
        for (const p of seed.jobPlatforms ?? []) seedUrls.push({ url: p.url, label: `${destination} — ${p.name} (jobs)` });
        for (const c of seed.expatCommunity?.communities ?? []) {
          if (c.url) seedUrls.push({ url: c.url, label: `${destination} — ${c.name} (expat)` });
        }
      }

      const factsheet = seed
        ? JSON.stringify(seed, null, 2)
        : `(no factsheet — use embedded knowledge to describe ${destination || "the destination"})`;

      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

CULTURE FACTSHEET (authoritative — citations in your output may only point to URLs from this factsheet):
${factsheet}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("cultural_adapter", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      try {
        await writeAuditRow(ctx.logWriter, {
          profile_id: ctx.profileId,
          agent_name: "cultural_adapter",
          model_used: llm.model_used,
          phase: "research",
          field_or_output_key: `${SPECIALIST}.synthesis`,
          value: { seed_present: !!seed, seed_url_count: seedUrls.length },
          confidence,
          source_url: seedUrls[0]?.url ?? null,
          prompt: userPrompt,
          response: llm.content,
          wall_clock_ms: synthesisMs,
          tokens_used: llm.tokens_used,
        });
      } catch (err) {
        console.warn(`[${SPECIALIST}] synthesis-audit write failed:`, err instanceof Error ? err.message : err);
      }

      const parsed = parseSpecialistResponse(llm.content);
      return {
        specialist: SPECIALIST,
        contentParagraphs: parsed.paragraphs,
        citations: seedUrls.map((s) => ({ url: s.url, label: s.label, scraped: false, note: "From COUNTRY_DATA seed" })),
        sourceUrlsUsed: [], // we never scrape in this specialist
        retrievedAt: new Date().toISOString(),
        quality,
        confidence,
        domainSpecificData: parsed.keyFacts,
        wallClockMs: Date.now() - start,
        tokensUsed: llm.tokens_used,
        modelUsed: llm.model_used,
        fallbackReason,
      };
    },
  });
}
