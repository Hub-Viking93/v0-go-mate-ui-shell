// =============================================================
// @workspace/agents — documents_specialist
// =============================================================
// Enumerates apostilles, translations, certificates the user must
// gather before/at the move. INTERSECTS with the visa specialist's
// recommendation when available — e.g. a posting visa needs an A1
// certificate, an EU Blue Card needs degree apostille, etc.
//
// Scrapes the destination immigration AND embassy/consulate URLs
// so the document checklist is grounded in what the actual
// authorities ask for. Routes to claude-sonnet-4-5.
//
// PROFILE SLICE consumed:
//   citizenship, destination, purpose, visa_role, relationship_type,
//   highly_skilled, education_level, study_type, *_apostille_status,
//   police_clearance_status, medical_exam_required.
//
// Optionally accepts priorOutputs.visa for cross-reference.
// =============================================================

import { callLLM } from "../router.js";
import { writeAuditRow } from "../audit.js";
import { scrapeOfficialSource } from "../scraping/firecrawl.js";
import { getAllSources, EMBASSY_PATTERNS } from "../sources/official-sources.js";
import { runSpecialist } from "./_base.js";
import {
  makeSourceContext,
  parseSpecialistResponse,
  renderSourcesBlock,
  URL_GUARDRAIL,
  type SourceContext,
} from "./_prompt-helpers.js";
import type {
  PriorSpecialistOutputs,
  SpecialistContext,
  SpecialistOutput,
  SpecialistProfile,
} from "./types.js";

const SPECIALIST = "documents_specialist";

function buildSystemPrompt(profile: SpecialistProfile): string {
  // Profile-driven conditional triggers — only include domains that apply.
  const p = profile as Record<string, unknown>;
  const relType = typeof p.relationship_type === "string" ? p.relationship_type : "";
  const hasFamily = Boolean(
    (relType && relType !== "single" && relType !== "none") ||
    p.partner_citizenship ||
    p.spouse_joining === "yes" ||
    p.spouse_joining === true,
  );
  const childrenCount = Number(p.children_count ?? 0);
  const hasChildren = childrenCount > 0
    || Boolean(p.children_ages)
    || Boolean(p.children_birth_certificate_apostille_status);
  const purposeStr = typeof p.purpose === "string" ? p.purpose : "";
  const isWork = purposeStr === "work" || purposeStr === "job" || Boolean(p.home_country_employer) || Boolean(p.highly_skilled);
  const hasPosting = p.posting_or_secondment === "yes" || Boolean(p.posting_duration_months) || Boolean(p.home_country_employer);
  const petsVal = p.pets;
  const hasPet = (typeof petsVal === "string" && petsVal && petsVal !== "no" && petsVal !== "none")
    || (typeof petsVal === "number" && petsVal > 0)
    || Boolean(p.pet_microchip_status)
    || Boolean(p.pet_vaccination_status)
    || Boolean(p.pet_breed);
  const hasVehicle = p.bringing_vehicle === "yes"
    || Boolean(p.vehicle_make_model_year)
    || Boolean(p.vehicle_origin_country);

  const domainList = [
    `"personal" — always: passport, birth certificate, civil status, police clearance, medical exam`,
    hasFamily ? `"family" — partner/spouse: marriage cert, sambo registration, partner's passport/police/medical` : null,
    hasChildren ? `"school" — children: birth certs, school records, vaccination records, custody papers` : null,
    isWork ? `"work" — employment: employment contract, degree apostille, professional licences, CV, references` : null,
    hasPosting ? `"posted_worker" — posting/secondment: A1 certificate, posting notification, host-country compliance` : null,
    hasPet ? `"pet" — pets: EU pet passport, microchip cert, rabies titre test, health certificate, import permit` : null,
    hasVehicle ? `"vehicle" — vehicles: title, registration, insurance, customs declaration, emissions cert` : null,
    `"departure_side" — origin-country exits: deregistration, tax exit, pension transfer, address change`,
  ].filter(Boolean).join("\n  - ");

  return `You are a documents specialist for international relocations. Enumerate every document this user must gather, **grouped by domain**, with full lead-time, sourcing, apostille/translation, and submission guidance. Where a prior visa specialist's recommendation is provided, USE IT — your checklist must align with that visa pathway.

DOMAINS APPLICABLE TO THIS USER (only emit documents in these domains):
  - ${domainList}

Produce a JSON object with this exact schema:
{
  "paragraphs": [
    "Paragraph 1: high-priority documents to gather BEFORE moving (apostilles, translations, degree certificates).",
    "Paragraph 2: documents needed AT the visa appointment (cite SOURCES).",
    "Paragraph 3: documents needed in the FIRST FEW WEEKS after arrival (registration, tax ID, healthcare).",
    "Paragraph 4: cross-cutting paperwork warnings (apostille validity, sworn translation requirements, expiry windows)."
  ],
  "key_facts": {
    "documents": [
      {
        "name": "string (e.g. 'Birth certificate apostille')",
        "domain": "personal | family | school | work | posted_worker | pet | vehicle | departure_side",
        "phase": "before_move | visa_appointment | first_weeks | first_months",
        "why_needed": "short string — what this document proves / unlocks",
        "where_to_obtain": "specific authority / website / agency, with city if relevant",
        "needs_apostille": <boolean>,
        "needs_translation": <boolean>,
        "submission_destination": "where this document is ultimately handed over (e.g. 'Swedish embassy in Manila', 'Skatteverket Sundbyberg', 'Carry on arrival')",
        "lead_time_days": <integer — typical days to obtain end-to-end>,
        "issuing_authority": "string",
        "applies_when": "short string describing the conditional trigger if any (e.g. 'Only if bringing children'), or empty string if always applies"
      }
    ],
    "warnings": ["e.g. 'Apostille older than 6 months may be rejected by Migrationsverket'"]
  }
}

CRITICAL RULES:
- Emit at least one document per applicable domain when the official sources mention any.
- "lead_time_days" must be a realistic integer (e.g. 7 for police clearance, 30 for apostille, 90 for medical+rabies titre).
- "where_to_obtain" must be specific enough that the user can act (name the agency, not "the government").
- "submission_destination" tells the user where the document ENDS UP (embassy, town hall, employer HR, carry-on).
- Do not invent documents that the cited sources do not mention.

${URL_GUARDRAIL}`;
}

function resolveCandidateUrls(profile: SpecialistProfile): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const dest = profile.destination ? String(profile.destination) : null;
  if (dest) {
    const sources = getAllSources(dest);
    if (sources?.immigration) out.push({ label: `${dest} — Immigration Authority`, url: sources.immigration });
    if (sources?.visa && sources.visa !== sources?.immigration) {
      out.push({ label: `${dest} — Visa Portal`, url: sources.visa });
    }
  }
  // Embassy of destination in user's CURRENT country (where they apply).
  // EMBASSY_PATTERNS is keyed by destination — this is where users find
  // application paperwork lists.
  if (dest && EMBASSY_PATTERNS[dest]) {
    out.push({
      label: `${dest} — Embassy / Visa Application Centre`,
      url: EMBASSY_PATTERNS[dest].finder,
    });
  }
  return out;
}

export async function documentsSpecialist(
  profile: SpecialistProfile,
  ctx: SpecialistContext,
  priorOutputs: PriorSpecialistOutputs = {},
): Promise<SpecialistOutput> {
  return runSpecialist({
    specialist: SPECIALIST,
    agentName: "documents_specialist",
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
        fallbackReason = `No immigration/embassy URL on file for destination "${profile.destination ?? "(missing)"}".`;
      } else if (successfulScrapes.length === 0) {
        quality = "fallback"; confidence = "fallback";
        fallbackReason = `All ${candidates.length} document-source scrape(s) failed.`;
      } else if (successfulScrapes.length < candidates.length) {
        quality = "partial"; confidence = "partial";
        fallbackReason = `${candidates.length - successfulScrapes.length}/${candidates.length} scrape(s) failed.`;
      } else {
        quality = "full"; confidence = "explicit";
      }

      // Build prior-visa cross-reference block.
      let priorVisaBlock = "";
      if (priorOutputs.visa) {
        const v = priorOutputs.visa;
        priorVisaBlock = `\n\nPRIOR VISA RECOMMENDATION (cross-reference your checklist with this):
- Recommended visa: ${v.domainSpecificData?.recommended_visa ?? "(not specified)"}
- Visa category: ${v.domainSpecificData?.visa_category ?? "(not specified)"}
- Key eligibility checks: ${JSON.stringify(v.domainSpecificData?.key_eligibility_checks ?? [])}
- Visa specialist quality: ${v.quality}
`;
      }

      const sourcesBlock = renderSourcesBlock(sources);
      const userPrompt = `USER PROFILE:
${JSON.stringify(profile, null, 2)}
${priorVisaBlock}
${sourcesBlock}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM("documents_specialist", userPrompt, {
        system: buildSystemPrompt(profile),
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      try {
        await writeAuditRow(ctx.logWriter, {
          profile_id: ctx.profileId,
          agent_name: "documents_specialist",
          model_used: llm.model_used,
          phase: "research",
          field_or_output_key: `${SPECIALIST}.synthesis`,
          value: { sources_scraped: successfulScrapes.length, sources_total: candidates.length, prior_visa_quality: priorOutputs.visa?.quality ?? null },
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
