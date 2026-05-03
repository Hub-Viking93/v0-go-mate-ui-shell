// =============================================================
// @workspace/agents — tax_strategist
// =============================================================
// Maps the user's residency + remote-income + asset profile onto
// double-taxation, tax-residency triggers and exit-tax exposure.
// Routes to claude-opus-4-7 (the heaviest model in the routing
// table) because tax synthesis is the most consequential.
//
// Scrapes the destination tax authority AND, if the origin
// country is in the inline EXIT_TAX_HINT list, the origin tax
// authority too — so the LLM can compare both sides.
//
// PROFILE SLICE consumed:
//   citizenship, current_location, destination, duration, purpose,
//   monthly_income, savings_available, remote_income, income_source,
//   pre_existing_investments_to_migrate.
// =============================================================

import { callLLM } from "../router.js";
import { writeAuditRow } from "../audit.js";
import { scrapeOfficialSource } from "../scraping/firecrawl.js";
import { getAllSources } from "../sources/official-sources.js";
import { runSpecialist } from "./_base.js";
import {
  makeSourceContext,
  parseSpecialistResponse,
  renderSourcesBlock,
  URL_GUARDRAIL,
  type SourceContext,
} from "./_prompt-helpers.js";
import type { SpecialistContext, SpecialistOutput, SpecialistProfile } from "./types.js";

const SPECIALIST = "tax_strategist";

/**
 * Inline list of jurisdictions with non-trivial exit-tax / departure-tax
 * provisions. Mirrors api-server's exit-tax-list.ts EXIT_TAX_COUNTRIES.
 *
 * TODO[wave-2.x-unify-schema]: extract into a shared
 * `@workspace/jurisdictions` package so server-side coordinator and
 * lib/agents stay in sync (right now the api-server file is the
 * authoritative one for the coordinator decision; this is the
 * tax-specialist's local reference).
 */
const EXIT_TAX_HINT: ReadonlySet<string> = new Set([
  "Sweden",
  "United States",
  "Norway",
  "Eritrea",
  "France",
  "Germany",
  "Netherlands",
  "Canada",
  "Australia",
  "Denmark",
  "Spain",
]);

/** Loose match — origin string may be "Berlin, Germany" or just "Germany". */
function originLooksLikeExitTaxCountry(originRaw: string | undefined | null): string | null {
  if (!originRaw) return null;
  const lower = String(originRaw).toLowerCase();
  for (const country of EXIT_TAX_HINT) {
    if (lower.includes(country.toLowerCase())) return country;
  }
  // City shortcuts (subset of api-server's CITY_TO_COUNTRY).
  const CITY_TO_COUNTRY: Record<string, string> = {
    stockholm: "Sweden", oslo: "Norway", copenhagen: "Denmark",
    amsterdam: "Netherlands", berlin: "Germany", munich: "Germany",
    paris: "France", madrid: "Spain", barcelona: "Spain",
    sydney: "Australia", melbourne: "Australia",
    toronto: "Canada", vancouver: "Canada",
    "new york": "United States", "san francisco": "United States",
  };
  for (const [city, country] of Object.entries(CITY_TO_COUNTRY)) {
    if (lower.includes(city) && EXIT_TAX_HINT.has(country)) return country;
  }
  return null;
}

function resolveCandidateUrls(profile: SpecialistProfile): { label: string; url: string; side: "destination" | "origin" }[] {
  const out: { label: string; url: string; side: "destination" | "origin" }[] = [];
  const dest = profile.destination ? String(profile.destination) : null;
  if (dest) {
    const destSources = getAllSources(dest);
    if (destSources?.tax) {
      out.push({ label: `${dest} — Tax Authority`, url: destSources.tax, side: "destination" });
    } else if (destSources?.banking) {
      out.push({ label: `${dest} — Central Bank (tax fallback)`, url: destSources.banking, side: "destination" });
    }
  }
  const originCountry = originLooksLikeExitTaxCountry(profile.current_location ? String(profile.current_location) : null);
  if (originCountry) {
    const originSources = getAllSources(originCountry);
    if (originSources?.tax) {
      out.push({ label: `${originCountry} — Origin Tax Authority (exit-tax check)`, url: originSources.tax, side: "origin" });
    }
  }
  return out;
}

function buildSystemPrompt(): string {
  return `You are a cross-border tax strategist. Your job is to highlight the user's tax-residency exposure, double-taxation traps, and (if relevant) exit-tax obligations on emigrating from their current country. You are NOT a licensed tax advisor — always recommend a qualified accountant for filings.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: tax residency analysis (when does the destination start treating them as resident? cite SOURCE).",
    "Paragraph 2: double-taxation treatment for their income type (employed, remote, posting).",
    "Paragraph 3: exit-tax / departure-tax exposure on emigrating from their current country (if relevant).",
    "Paragraph 4: practical next steps (registrations, filing deadlines, professional advice triggers)."
  ],
  "key_facts": {
    "destination_residency_trigger_days": <number or null>,
    "double_taxation_treaty_exists": <boolean>,
    "origin_exit_tax_applies": <boolean>,
    "filing_deadlines": ["bullet 1"],
    "professional_advice_recommended": <boolean>,
    "warnings": ["specific red flags for this profile"]
  }
}

${URL_GUARDRAIL}`;
}

export async function taxSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "tax_strategist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const candidates = resolveCandidateUrls(profile);
      const scrapeResults = await Promise.all(
        candidates.map((c) => scrapeOfficialSource(c.url, { signal })),
      );
      const sources: SourceContext[] = candidates.map((c, i) =>
        makeSourceContext(c.label, c.url, scrapeResults[i]),
      );

      const successfulScrapes = sources.filter((s) => s.scraped);

      let quality: SpecialistOutput["quality"];
      let confidence: SpecialistOutput["confidence"];
      let fallbackReason: string | undefined;
      if (candidates.length === 0) {
        quality = "fallback"; confidence = "fallback";
        fallbackReason = `No tax-authority URL on file for destination "${profile.destination ?? "(missing)"}".`;
      } else if (successfulScrapes.length === 0) {
        quality = "fallback"; confidence = "fallback";
        fallbackReason = `All ${candidates.length} tax-authority scrape attempt(s) failed; synthesising from embedded knowledge.`;
      } else if (successfulScrapes.length < candidates.length) {
        quality = "partial"; confidence = "partial";
        fallbackReason = `${candidates.length - successfulScrapes.length}/${candidates.length} tax scrape(s) failed.`;
      } else {
        quality = "full"; confidence = "explicit";
      }

      const sourcesBlock = renderSourcesBlock(sources);
      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

${sourcesBlock}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("tax_strategist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      try {
        await writeAuditRow(ctx.logWriter, {
          profile_id: ctx.profileId,
          agent_name: "tax_strategist",
          model_used: llm.model_used,
          phase: "research",
          field_or_output_key: `${SPECIALIST}.synthesis`,
          value: { sources_scraped: successfulScrapes.length, sources_total: candidates.length, origin_exit_tax_country: originLooksLikeExitTaxCountry(profile.current_location ? String(profile.current_location) : null) },
          confidence,
          source_url: successfulScrapes[0]?.url ?? sources[0]?.url ?? null,
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
        citations: sources.map((s) => ({ url: s.url, label: s.label, scraped: s.scraped, note: s.scraped ? "Scraped this run" : "Whitelist reference" })),
        sourceUrlsUsed: successfulScrapes.map((s) => s.url),
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
