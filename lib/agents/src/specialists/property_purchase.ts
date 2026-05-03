// =============================================================
// @workspace/agents — property_purchase_specialist
// (conditional: home_purchase_intent === "yes")
// =============================================================
// Foreign-buyer restrictions, mortgage availability for non-residents,
// transaction taxes (stamp duty, transfer tax), real-estate agents,
// purchase process timeline.
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

const SPECIALIST = "property_purchase_specialist";

function buildSystemPrompt(): string {
  return `You are a property-purchase specialist for relocating buyers. Some destinations restrict foreign property purchases (Switzerland, Denmark, parts of Australia, New Zealand, etc); others tax foreign buyers more heavily (UK, Canada). Map the destination's rules to this user's situation.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: foreigner-purchase rules in the destination (free / restricted / case-by-case + which permit if any).",
    "Paragraph 2: mortgage availability for non-residents (LTV caps, deposit %, currency-of-loan considerations).",
    "Paragraph 3: transaction taxes (stamp duty / IMT / land registry fees / notary fees) totalled as % of purchase price.",
    "Paragraph 4: purchase process timeline (offer → conveyancing → completion) + practical tips (recommended agent/notary types)."
  ],
  "key_facts": {
    "foreigner_purchase_rules": "free|restricted|permit_required",
    "permit_authority": "string|null",
    "mortgage_available_to_non_residents": <boolean>,
    "max_ltv_pct_non_resident": <number|null>,
    "transaction_tax_pct_total": <number|null>,
    "stamp_duty_pct": <number|null>,
    "transfer_tax_pct": <number|null>,
    "typical_process_weeks": <number|null>,
    "warnings": ["bullet 1"]
  }
}

${URL_GUARDRAIL}`;
}

export async function propertyPurchaseSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "property_purchase_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const sources = getAllSources(dest);

      const candidates: { label: string; url: string }[] = [];
      if (sources?.housing) {
        candidates.push({ label: `${dest} — Housing Portal`, url: sources.housing });
      }
      if (sources?.tax) {
        candidates.push({ label: `${dest} — Tax Authority (transfer tax)`, url: sources.tax });
      }
      const resolved = await scrapeCandidates(candidates, signal, dest);

      const search = await searchAndScrape(
        `${dest} foreigner buy property restrictions stamp duty official`,
        { signal, limit: 2 },
      );
      if (search.ok) {
        for (const page of search.pages) {
          if (page.url) {
            resolved.sources.push(
              makeSourceContext(`${dest} — foreigner property purchase (search)`, page.url, {
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
      const llm = await callLLM("property_purchase_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "property_purchase_specialist",
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
