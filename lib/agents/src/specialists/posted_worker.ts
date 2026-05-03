// =============================================================
// @workspace/agents — posted_worker_specialist
// (conditional: posting_or_secondment === "yes")
// =============================================================
// A1 / Certificate of Coverage application steps, Posted Worker
// Declaration filing with destination labour authority, employer
// registration + designated contact-person rule, social-security
// continuity (max 24 months for EU postings).
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

const SPECIALIST = "posted_worker_specialist";

function buildSystemPrompt(): string {
  return `You are a posted-worker compliance specialist. The user is on a corporate posting/secondment from origin to destination — they are NOT changing employer. Two separate filings are required:

1. **A1 certificate** (EU/EEA/Switzerland) or **Certificate of Coverage / CoC** (under bilateral SS treaty for non-EU origins like US-Sweden, India-Sweden, Japan-Germany, etc) — issued by the ORIGIN country's social-security agency. Keeps social-security in origin country for the duration of the posting.

2. **Posted Worker Declaration (PWD)** — filed with the DESTINATION labour authority by the home-country employer BEFORE the worker arrives. Some examples: Sweden = Arbetsmiljöverket Posting of Workers register; Germany = ZOLL; France = SIPSI.

The employer must designate a contact person resident in the destination.

Social-security continuity rules: A1 valid up to 24 months under standard EU rules (extendable under Article 16). Bilateral CoCs typically 5 years.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: which framework applies (EU A1 vs bilateral CoC) given the origin → destination corridor.",
    "Paragraph 2: A1/CoC application path — who applies (worker vs employer), where, lead time, validity.",
    "Paragraph 3: PWD filing path — exact destination authority, employer obligations, deadline relative to start date.",
    "Paragraph 4: contact-person requirement + social-security continuity duration + what happens if posting extends past the cap."
  ],
  "key_facts": {
    "framework": "EU_A1|bilateral_CoC|unclear",
    "a1_or_coc_path": { "issued_by": "string", "applied_by": "worker|employer", "lead_weeks": <number|null>, "max_validity_months": <number|null>, "url": "string-from-SOURCES-or-null" },
    "pwd_filing": { "destination_authority": "string", "deadline_relative_to_start": "string", "url": "string-from-SOURCES-or-null" },
    "employer_registration_required": <boolean>,
    "contact_person_requirement": { "required": <boolean>, "must_be_resident": <boolean> },
    "social_security_rules": { "duration_cap_months": <number|null>, "extension_possible": <boolean> },
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function postedWorkerSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "posted_worker_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const origin = profile.current_location
        ? String(profile.current_location).split(",").pop()?.trim() ?? String(profile.current_location)
        : "";

      // Destination labour authority (employment field) — whitelisted.
      const candidates: { label: string; url: string }[] = [];
      const destSources = getAllSources(dest);
      if (destSources?.employment) {
        candidates.push({
          label: `${dest} — Labour Authority (Posted Worker register)`,
          url: destSources.employment,
        });
      }
      const resolved = await scrapeCandidates(candidates, signal, dest);

      // Search-and-scrape: PWD specifics + origin A1/CoC.
      const queries = [
        `${dest} posted worker declaration PWD employer filing official`,
        `${origin || "EU"} A1 certificate posted worker social security`,
      ];
      for (const q of queries) {
        const result = await searchAndScrape(q, { signal, limit: 2 });
        if (result.ok) {
          for (const page of result.pages) {
            if (page.url) {
              resolved.sources.push(
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
      const merged = resolveQuality(resolved.sources, `${origin} → ${dest}`);

      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

${renderSourcesBlock(merged.sources)}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("posted_worker_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "posted_worker_specialist",
        sources: merged.sources,
        successfulScrapes: merged.successfulScrapes,
        confidence: merged.confidence,
        userPrompt,
        llm,
        synthesisMs,
        extra: { origin, destination: dest },
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
