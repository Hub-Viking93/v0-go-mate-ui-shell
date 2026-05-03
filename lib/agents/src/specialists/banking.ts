// =============================================================
// @workspace/agents — banking_helper (always runs; deeper when
// need_budget_help=yes — that flag isn't in the current schema so
// we treat banking as always-run)
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

const SPECIALIST = "banking_helper";

function buildSystemPrompt(): string {
  return `You are a banking helper for relocating expats. List 3-5 banks foreigners can open accounts at in the destination, with required documents, processing time, English service availability, and fees.

Always include digital bridges (Wise / Revolut / N26) the user can open BEFORE they arrive — these unblock initial salary deposits and rent payments while waiting on the local account.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: account-opening landscape for foreigners in the destination (residency permit needed first?).",
    "Paragraph 2: 3-5 recommended local banks tailored to this profile (high-income, posting, etc).",
    "Paragraph 3: digital bridges (Wise / Revolut / N26) to open before arrival.",
    "Paragraph 4: timeline + sequencing for this specific person's move."
  ],
  "key_facts": {
    "recommended_banks": [
      { "name": "string", "english_service": <boolean>, "required_docs": ["doc1", "doc2"], "processing_days": <number|null>, "monthly_fee_eur": <number|null>, "url": "string-from-SOURCES-or-null" }
    ],
    "required_docs_summary": ["passport", "residency permit", "..."],
    "digital_bridges": [{ "name": "Wise|Revolut|N26", "url": "https://...", "use_case": "string" }],
    "account_opening_steps": ["step 1", "step 2"],
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function bankingSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "banking_helper",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const sources = getAllSources(dest);

      // Whitelist: destination central bank / financial regulator if available.
      const candidates: { label: string; url: string }[] = [];
      if (sources?.banking) {
        candidates.push({ label: `${dest} — Banking Authority`, url: sources.banking });
      }

      const resolved = await scrapeCandidates(candidates, signal, dest);

      // Search-and-scrape: banks foreigners can open accounts at + their
      // requirements. Adds to existing sources, not replacing.
      const search = await searchAndScrape(
        `${dest} bank account opening for foreigners required documents`,
        { signal, limit: 2 },
      );
      if (search.ok) {
        for (const page of search.pages) {
          if (page.url) {
            resolved.sources.push(
              makeSourceContext(`${dest} — bank-account guide (search)`, page.url, {
                ok: true,
                url: page.url,
                markdown: page.markdown,
                retrievedAt: search.retrievedAt,
              }),
            );
          }
        }
      }
      // Recompute quality after potential search additions.
      const merged = resolveQuality(resolved.sources, dest);

      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

${renderSourcesBlock(merged.sources)}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("banking_helper", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "banking_helper",
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
