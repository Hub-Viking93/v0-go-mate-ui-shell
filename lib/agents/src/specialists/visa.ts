// =============================================================
// @workspace/agents — visa_specialist
// =============================================================
// Maps the user's citizenship + purpose + posting status onto the
// destination's visa pathway. Scrapes the destination immigration
// authority (and a posted-worker / ICT URL when relevant) and
// synthesises with claude-sonnet-4-5.
//
// PROFILE SLICE consumed (from coordinator):
//   citizenship, other_citizenships, current_location, destination,
//   purpose, visa_role, duration, timeline, highly_skilled,
//   job_offer, employer_sponsorship, education_level,
//   years_experience, prior_visa, visa_rejections, posting_or_secondment,
//   posting_duration_months, name, birth_year.
// =============================================================

import { callLLM } from "../router.js";
import { writeAuditRow } from "../audit.js";
import { scrapeOfficialSource, searchAndScrape } from "../scraping/firecrawl.js";
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

const SPECIALIST = "visa_specialist";

function buildSystemPrompt(): string {
  return `You are a visa specialist for relocation. Your job is to map the user's citizenship + purpose to the destination country's correct visa pathway, citing official immigration authorities.

You will receive:
  * The user's profile (citizenship, destination, purpose, etc).
  * A SOURCES block with markdown excerpts from official immigration sites.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: which visa pathway fits this person and why (cite SOURCE).",
    "Paragraph 2: eligibility checks against this profile (job offer, posting, salary, qualifications).",
    "Paragraph 3: timeline + practical next steps (where to apply, processing weeks, fees if mentioned).",
    "Paragraph 4: gotchas or red flags for this specific person (prior rejections, posting nuances, dependents)."
  ],
  "key_facts": {
    "recommended_visa": "Short visa name (e.g. 'EU Blue Card' or 'Posted Worker A1')",
    "visa_category": "work | study | family | digital_nomad | tourist | residence",
    "estimated_processing_weeks": <number or null>,
    "primary_authority": "Name of the immigration authority",
    "primary_authority_url": "<single canonical URL from SOURCES that the user should bookmark for this visa — null if no source covers it>",
    "estimated_cost_summary": "<one short sentence about fees or null. Examples: 'JPY 3,000 application + JPY 4,000 issuance (paid at embassy)', 'Free for EU/EEA citizens'. Use the user's likely currency. NEVER invent figures — set to null if SOURCES don't mention fees.>",
    "validity_summary": "<one short sentence about how long the visa lasts and renewal terms, or null. Examples: 'Up to 4 years 3 months, renewable in-country', 'Tied to employment contract, max 4 years'. Set to null if SOURCES don't cover validity.>",
    "key_eligibility_checks": ["bullet 1", "bullet 2"],
    "warnings": ["any red flags specific to this profile"]
  }
}

CRITICAL: Never fabricate figures or URLs. If SOURCES don't cover cost or validity, set those fields to null. The UI surfaces "—" for null and prompts the user to consult the official authority directly.

${URL_GUARDRAIL}`;
}

function buildUserPrompt(profile: SpecialistProfile, sourcesBlock: string): string {
  return `USER PROFILE (only relevant fields — be careful not to confuse origin and destination):
${JSON.stringify(profile, null, 2)}

${sourcesBlock}

Produce the JSON now.`;
}

/** Look up candidate URLs to scrape for this destination. */
function resolveCandidateUrls(profile: SpecialistProfile): { label: string; url: string }[] {
  const dest = profile.destination ? String(profile.destination) : null;
  if (!dest) return [];
  const sources = getAllSources(dest);
  if (!sources) return [];
  const out: { label: string; url: string }[] = [];
  out.push({ label: `${dest} — Immigration Authority`, url: sources.immigration });
  if (sources.visa && sources.visa !== sources.immigration) {
    out.push({ label: `${dest} — Visa Portal`, url: sources.visa });
  }
  if (sources.employment) {
    out.push({ label: `${dest} — Labour / Employment Authority`, url: sources.employment });
  }
  return out;
}

export async function visaSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "visa_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const candidates = resolveCandidateUrls(profile);

      // Run scrapes in parallel (each capped at 15s by firecrawl wrapper).
      const scrapeResults = await Promise.all(
        candidates.map((c) => scrapeOfficialSource(c.url, { signal })),
      );

      const sources: SourceContext[] = candidates.map((c, i) =>
        makeSourceContext(c.label, c.url, scrapeResults[i]),
      );

      // Optional: if the user's purpose is work + posting and the destination
      // has a posted-worker portal, do a search-and-scrape to find it.
      const isPosting = String(profile.posting_or_secondment ?? "").toLowerCase() === "yes";
      if (isPosting && profile.destination) {
        const search = await searchAndScrape(
          `${profile.destination} posted worker A1 certificate official site`,
          { signal, limit: 2 },
        );
        if (search.ok) {
          for (const page of search.pages) {
            if (page.url) {
              sources.push(makeSourceContext(`${profile.destination} — Posted Worker (search)`, page.url, {
                ok: true, url: page.url, markdown: page.markdown, retrievedAt: search.retrievedAt,
              }));
            }
          }
        }
      }

      const successfulScrapes = sources.filter((s) => s.scraped);
      const totalCandidates = sources.length;

      // Determine quality.
      let quality: SpecialistOutput["quality"];
      let confidence: SpecialistOutput["confidence"];
      let fallbackReason: string | undefined;
      if (totalCandidates === 0) {
        quality = "fallback";
        confidence = "fallback";
        fallbackReason = `No official-sources URL on file for destination "${profile.destination ?? "(missing)"}".`;
      } else if (successfulScrapes.length === 0) {
        quality = "fallback";
        confidence = "fallback";
        fallbackReason = `All ${totalCandidates} scrape attempt(s) failed (Firecrawl). Synthesising from embedded knowledge; URLs cited are whitelist references only.`;
      } else if (successfulScrapes.length < totalCandidates) {
        quality = "partial";
        confidence = "partial";
        fallbackReason = `${totalCandidates - successfulScrapes.length}/${totalCandidates} scrape attempts failed; partial synthesis.`;
      } else {
        quality = "full";
        confidence = "explicit";
      }

      const sourcesBlock = renderSourcesBlock(sources);
      const userPrompt = buildUserPrompt(profile, sourcesBlock);

      // Audit the synthesis prompt separately so we can hash-verify later.
      const synthesisStart = Date.now();
      const llm = await callLLM("visa_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      // Audit the synthesis call (separate row from base start/complete).
      try {
        await writeAuditRow(ctx.logWriter, {
          profile_id: ctx.profileId,
          agent_name: "visa_specialist",
          model_used: llm.model_used,
          phase: "research",
          field_or_output_key: `${SPECIALIST}.synthesis`,
          value: { sources_scraped: successfulScrapes.length, sources_total: totalCandidates },
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
        citations: sources.map((s) => ({
          url: s.url,
          label: s.label,
          scraped: s.scraped,
          note: s.scraped ? "Scraped this run" : "Whitelist reference",
        })),
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
