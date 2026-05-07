// =============================================================
// @workspace/agents — documents_specialist v2 (Phase B2)
// =============================================================
// New researched-contract documents specialist. Returns
// ResearchedSteps covering the obtain → apostille → translate →
// submit lifecycle for every document the user needs to lodge a
// permit application + present at registration / banking on
// arrival.
//
// What this specialist owns vs. registration:
//   - registration:* documents are issued BY the destination
//     (proof-of-address, personnummer card, BankID).
//   - documents:* documents are issued BY the origin and need to
//     be authenticated for use abroad (birth/marriage cert, police
//     clearance, diplomas, employer letters, bank statements).
//
// Coexists with legacy documents.ts (which still feeds the
// orchestrator). Phase A2 swaps the pre-departure route to consume
// this output; legacy retires once the cutover is done.
//
// Hardening (mirrors B1 conventions):
//   - Strict enum + ProfilePredicate validation (drift drops items
//     and downgrades quality to "partial").
//   - Budget enforced end-to-end via withBudget().
//   - Audit logging wired when input.profileId + input.logWriter
//     are both provided.
// =============================================================

import { callLLM } from "../router.js";
import {
  composeQuality,
  fetchRegisteredSources,
  parseResearchedJsonResponse,
  renderResearchedSourcesBlock,
  URL_GUARDRAIL_RESEARCHED,
  validateAndNormaliseDocuments,
  validateAndNormaliseSteps,
  withBudget,
  writeResearchedAudit,
} from "./_researched-helpers.js";
import type {
  ResearchedSpecialistFn,
  ResearchedSteps,
} from "./_contracts.js";

const DOMAIN = "documents" as const;
const AGENT_NAME = "documents_specialist" as const;

const SYSTEM_PROMPT = `You are a documents specialist for international relocations. Your output drives the Documents section of the pre-departure checklist for a real user moving to a specific destination.

Goal: enumerate every origin-issued document the user needs to obtain → apostille / legalise → translate → present at the destination's permit / registration / banking offices. Be destination + origin specific. Cite official-source URLs from SOURCES (destination immigration authority, origin's apostille / legalisation authority, certified-translation registers). Do not invent steps.

Output a JSON object with this exact shape:
{
  "summary": "one-line section description (≤160 chars)",
  "steps": [
    {
      "id": "documents:<slug>",
      "title": "imperative, ≤80 chars",
      "description": "1-2 sentences, destination + origin specific",
      "deadlineWindow": {
        "phase": "before_move" | "first_72h" | "first_30d" | "ongoing",
        "weeksBeforeMove": <number|null>,
        "daysAfterArrival": <number|null>,
        "legalDeadlineDays": <number|null>
      },
      "appliesWhen": {"always": true} | {"eq": {"field": "<key>", "value": "<v>"}} | {"set": {...}} | ...,
      "prerequisites": ["documents:<slug>", "<other domain step id>"],
      "documentIds": ["documents:<doc-slug>", "..."],
      "walkthrough": ["short bullet 1", "..."],
      "bottleneck": "common watch-out (optional)",
      "sources": ["https://..."]
    }
  ],
  "documents": [
    {
      "id": "documents:<doc-slug>",
      "label": "human label",
      "category": "civil_status" | "education" | "professional" | "criminal" | "medical" | "financial" | "identity" | "housing" | "other",
      "apostille": "needed" | "not_needed" | "varies",
      "translation": "needed" | "not_needed" | "destination_language_only" | "varies",
      "leadTimeDays": <number>,
      "sources": ["https://..."]
    }
  ],
  "structuredFacts": {
    "apostille_typical_lead_days": <number|null>,
    "certified_translator_required": <boolean|null>
  }
}

Style rules:
- Step ids: "documents:<slug>". Lower-case slugs.
  Examples: "documents:obtain-birth-certificate", "documents:apostille-police-clearance", "documents:translate-diplomas".
- Document ids: also "documents:<slug>" — every step.documentIds[] entry should resolve to one of the documents[] you also emit.
- The lifecycle for ONE document is typically 3 steps: obtain → apostille → translate. Don't merge them into a single step unless the destination genuinely accepts the origin doc as-is.
- prerequisites can reference earlier documents:* steps (e.g. translate depends on apostille, which depends on obtain).
- Most steps are phase=before_move. Use first_30d only when a document is presented to the destination office on arrival (e.g. registering proof of marriage at the population register).
- Skip documents the user already has via prior_visa, dual citizenship, etc. — gate with appliesWhen.

${URL_GUARDRAIL_RESEARCHED}`;

interface LlmPayload {
  summary?: unknown;
  steps?: unknown;
  documents?: unknown;
  structuredFacts?: unknown;
}

export const documentsSpecialistV2: ResearchedSpecialistFn = async (input) => {
  const profile = input.profile;
  const country = profile.destination ? String(profile.destination) : null;
  const origin = profile.current_location ? String(profile.current_location) : null;

  function buildTimeoutFallback(): ResearchedSteps {
    return {
      kind: "steps",
      domain: DOMAIN,
      retrievedAt: new Date().toISOString(),
      quality: "fallback",
      fallbackReason: "timeout",
      sources: [],
      summary: country
        ? `Documents research for ${country} did not complete within budget.`
        : "Documents research did not complete within budget.",
      steps: [],
      documents: [],
    };
  }

  return withBudget({
    budgetMs: input.budgetMs,
    onTimeout: buildTimeoutFallback,
    work: async () => {
      const fetchSignal = AbortSignal.timeout(input.budgetMs);
      const fetchResult = await fetchRegisteredSources({
        country,
        domain: DOMAIN,
        signal: fetchSignal,
      });

      const userPrompt = `USER PROFILE (only fields the documents specialist needs):
${JSON.stringify(redactProfile(profile), null, 2)}

DESTINATION: ${country ?? "unknown"}
ORIGIN: ${origin ?? "unknown"}

${renderResearchedSourcesBlock(fetchResult.fetched)}

Produce the JSON now.`;

      const synthesisStart = Date.now();
      const llm = await callLLM(AGENT_NAME, userPrompt, {
        system: SYSTEM_PROMPT,
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      const allowedUrls = new Set(fetchResult.asResearchedSources.map((s) => s.url));
      const parsed = parseResearchedJsonResponse<LlmPayload>(llm.content);
      const parseFailed = !parsed || parsed.steps === undefined;
      const stepsResult = validateAndNormaliseSteps(parsed?.steps, DOMAIN, allowedUrls);
      const docsResult = validateAndNormaliseDocuments(parsed?.documents, DOMAIN, allowedUrls);

      const composed = composeQuality({
        fetchQuality: fetchResult.quality,
        fetchFallbackReason: fetchResult.fallbackReason,
        parseFailed,
        droppedSteps: stepsResult.dropped,
        droppedDocs: docsResult.dropped,
        droppedSourceRefs:
          stepsResult.sourceRefsDropped + docsResult.sourceRefsDropped,
      });

      if (input.profileId && input.logWriter) {
        await writeResearchedAudit({
          profileId: input.profileId,
          logWriter: input.logWriter,
          agentName: AGENT_NAME,
          domain: DOMAIN,
          fetchResult,
          userPrompt,
          llm,
          synthesisMs,
          quality: composed.quality,
          fallbackReason: composed.fallbackReason,
          extra: {
            steps_count: stepsResult.steps.length,
            steps_dropped: stepsResult.dropped,
            steps_predicates_reset: stepsResult.predicatesReset,
            steps_source_refs_dropped: stepsResult.sourceRefsDropped,
            documents_count: docsResult.documents.length,
            documents_dropped: docsResult.dropped,
            documents_source_refs_dropped: docsResult.sourceRefsDropped,
          },
        });
      }

      const summary =
        typeof parsed?.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : country
            ? `Documents to obtain, authenticate and translate for moving to ${country}.`
            : "Documents to obtain, authenticate and translate before moving.";

      const out: ResearchedSteps = {
        kind: "steps",
        domain: DOMAIN,
        retrievedAt: new Date().toISOString(),
        quality: composed.quality,
        ...(composed.fallbackReason ? { fallbackReason: composed.fallbackReason } : {}),
        sources: fetchResult.asResearchedSources,
        summary,
        steps: stepsResult.steps,
        documents: docsResult.documents,
        ...(parsed?.structuredFacts && typeof parsed.structuredFacts === "object" && !Array.isArray(parsed.structuredFacts)
          ? { structuredFacts: parsed.structuredFacts as Record<string, unknown> }
          : {}),
      };
      return out;
    },
  });
};

function redactProfile(profile: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "destination",
    "current_location",
    "citizenship",
    "purpose",
    "visa_role",
    "moving_alone",
    "children_count",
    "settlement_reason",
    "partner_citizenship",
    "partner_visa_status",
    "relationship_type",
    "prior_visa",
    "prior_visa_type",
    "criminal_record",
    "highly_skilled",
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (profile[k] !== undefined && profile[k] !== null) out[k] = profile[k];
  }
  return out;
}
