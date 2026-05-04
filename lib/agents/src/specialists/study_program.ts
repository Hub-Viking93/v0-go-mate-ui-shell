// =============================================================
// @workspace/agents — study_program_specialist
//   conditional: profile.purpose === "study"
// =============================================================
// Researches the destination's study landscape for the user:
//   • language schools (when study_type === "language_school")
//   • universities / vocational programs (otherwise)
//   • student-visa enrollment requirements (must-attend lists,
//     MEXT-equivalent approval status, certificate of eligibility
//     pipelines)
//   • tuition + scholarship landscape
//
// Mirrors the structure of schools_specialist but is keyed on the
// adult learner rather than dependent children, so the prompts and
// key_facts schema are different. Routed to claude-sonnet-4-6 in
// AGENT_MODEL_ROUTING (same tier as schools).
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

const SPECIALIST = "study_program_specialist";

function buildSystemPrompt(): string {
  return `You are a study-program specialist for adults relocating to study abroad. Your job: surface the right institutions, the visa-linked enrollment rules, and the funding landscape so the user can pick a program that actually qualifies them for the student visa they need.

You will receive the user profile (purpose=study, with study_type / study_field / study_funding / target_city / destination / duration) and a SOURCES block scraped from the destination's official education ministry, accreditation lists, and reputable program directories.

Branch your recommendations on study_type:
- "language_school" — focus on accredited language institutes (e.g. MEXT-approved Japanese language schools, Goethe-Institut, Alliance Française, etc.). Highlight which institutions can sponsor a Certificate of Eligibility / student visa, intake months, course length, fees.
- "university" / "vocational" / "exchange" — focus on degree programs in the user's study_field, accredited institutions, application timelines (usually 6-12 months ahead), entrance requirements (language proficiency, test scores), tuition, and major scholarship pathways.

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: overview of the destination's study landscape relevant to study_type, plus how visa eligibility ties to enrollment at an approved institution.",
    "Paragraph 2: institution shortlist summary (do NOT list every program here — that goes in key_facts.programs).",
    "Paragraph 3: application timeline + key documents (transcripts, language tests, financial proof).",
    "Paragraph 4: tuition reality + funding pathways (national scholarships, institution-level aid, work-study limits on the visa)."
  ],
  "key_facts": {
    "system_overview": "1-line plain-English summary of how studying ${"${"}study_type${"}"} works in this country",
    "visa_link_summary": "1-line statement about which body certifies enrollment for visa purposes (e.g. 'MEXT lists approved Japanese language schools eligible to sponsor a CoE')",
    "approx_tuition_range_eur": { "low": <number|null>, "high": <number|null>, "per": "year|term|course" },
    "programs": [
      {
        "name": "string (institution / program name)",
        "type": "language_school|university|vocational|exchange",
        "city": "string|null",
        "language_of_instruction": "string",
        "approx_tuition_eur": <number|null>,
        "tuition_period": "year|term|course|null",
        "duration_months": <number|null>,
        "intake_months": ["e.g. 'April'", "'October'"],
        "application_lead_months": <number|null>,
        "visa_sponsor_capable": <boolean>,
        "url": "string-from-SOURCES-or-null"
      }
    ],
    "scholarships": [
      { "name": "string", "kind": "national|institution|private", "url": "string-from-SOURCES-or-null", "notes": "string" }
    ],
    "warnings": ["bullet 1 — e.g. 'Unaccredited language schools cannot sponsor your visa'"]
  }
}

${URL_GUARDRAIL}`;
}

export async function studyProgramSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "study_program_specialist",
    profile,
    ctx,
    body: async (profile, ctx, signal) => {
      const start = Date.now();
      const dest = profile.destination ? String(profile.destination) : "";
      const city = profile.target_city ? String(profile.target_city) : "";
      const studyType = profile.study_type ? String(profile.study_type) : "";
      const studyField = profile.study_field ? String(profile.study_field) : "";

      // Branch query strategy on study_type so we hit the right
      // authority. Language schools are always sourced from the
      // destination's education-ministry approved-institution list;
      // university/vocational searches lean on accreditation + program
      // directories.
      const isLanguage = studyType === "language_school";
      const queries = isLanguage
        ? [
            `${dest} ministry of education approved language schools student visa`,
            `${city || dest} accredited language school international students enrollment`,
          ]
        : [
            `${dest} accredited universities ${studyField || ""} international students`.trim(),
            `${dest} student visa enrollment requirements scholarships`,
          ];

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
      const sourcesBlock = renderSourcesBlock(resolved.sources);
      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}

STUDY_TYPE: ${studyType || "(unspecified)"}
STUDY_FIELD: ${studyField || "(unspecified)"}

${sourcesBlock}

Produce 3-5 entries in key_facts.programs that match the study_type and (if set) study_field. Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("study_program_specialist", userPrompt, {
        system: buildSystemPrompt(),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      await writeSynthesisAudit({
        ctx,
        specialist: SPECIALIST,
        agentName: "study_program_specialist",
        sources: resolved.sources,
        successfulScrapes: resolved.successfulScrapes,
        confidence: resolved.confidence,
        userPrompt,
        llm,
        synthesisMs,
        extra: { study_type: studyType, study_field: studyField },
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
