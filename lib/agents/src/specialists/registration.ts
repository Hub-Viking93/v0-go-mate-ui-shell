// =============================================================
// @workspace/agents — registration_specialist (Phase B1)
// =============================================================
// First post-arrival researched specialist. Returns ResearchedSteps
// covering destination-specific population register / address
// registration / national-ID issuance, plus the documents needed
// to complete each step. Proof-of-address (the originally proposed
// local_proof_specialist domain) lives here as a DocumentRequirement.
//
// Contract: see lib/agents/src/specialists/_contracts.ts.
// Sources: lib/agents/src/specialists/_sources.ts (domain="registration").
//
// Phase B1 hardening (2026-05-07 review):
//   - Strict enum + ProfilePredicate validation; drift drops items
//     and downgrades quality.
//   - Budget enforced end-to-end via withBudget() (covers scrape +
//     LLM synthesis), not just the scrape phase.
//   - Audit logging is wired: when input.profileId + input.logWriter
//     are both provided, writeResearchedAudit fires after synthesis.
//     Dry-run callers omit them and audit is silently skipped.
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

const DOMAIN = "registration" as const;
const AGENT_NAME = "registration_specialist" as const;

const SYSTEM_PROMPT = `You are a registration specialist for international relocations. Your output drives the Settling-in checklist for a real user moving to a specific destination.

Goal: enumerate every authority registration the user must complete after arrival to become legally resident — typically population register / address registration / national ID / fiscal ID. Be destination-specific. Cite official-source URLs from SOURCES. Do not invent steps.

Output a JSON object with this exact shape:
{
  "summary": "one-line section description (≤160 chars)",
  "steps": [
    {
      "id": "registration:<slug>",
      "title": "imperative, ≤80 chars",
      "description": "1-2 sentences, destination-specific",
      "deadlineWindow": {
        "phase": "first_72h" | "first_30d" | "first_90d" | "first_year_end" | "ongoing",
        "daysAfterArrival": <number|null>,
        "legalDeadlineDays": <number|null>
      },
      "appliesWhen": {"always": true} | {"eq": {"field": "<key>", "value": "<v>"}} | {"set": {...}} | ...,
      "prerequisites": ["registration:<slug>", "<other domain step id>"],
      "documentIds": ["registration:<doc-slug>", "..."],
      "walkthrough": ["short bullet 1", "..."],
      "bottleneck": "one-line common watch-out (optional)",
      "sources": ["https://..."]
    }
  ],
  "documents": [
    {
      "id": "registration:<doc-slug>",
      "label": "human label",
      "category": "civil_status" | "education" | "professional" | "criminal" | "medical" | "financial" | "identity" | "housing" | "other",
      "apostille": "needed" | "not_needed" | "varies",
      "translation": "needed" | "not_needed" | "destination_language_only" | "varies",
      "leadTimeDays": <number>,
      "sources": ["https://..."]
    }
  ],
  "structuredFacts": { "fee_local_currency": <number|null>, "...": "..." }
}

Style rules:
- Step ids: domain-prefixed ("registration:population-register", "registration:tax-id"). Lower-case slugs.
- Document ids: also "registration:<slug>" — proof-of-address goes here.
- prerequisites references step ids; cross-domain refs welcome ("visa:residence-permit-issued").
- deadlineWindow.phase is the bucket; legalDeadlineDays takes precedence when set.

${URL_GUARDRAIL_RESEARCHED}`;

interface LlmPayload {
  summary?: unknown;
  steps?: unknown;
  documents?: unknown;
  structuredFacts?: unknown;
}

export const registrationSpecialist: ResearchedSpecialistFn = async (input) => {
  const profile = input.profile;
  const country = profile.destination ? String(profile.destination) : null;

  function buildTimeoutFallback(): ResearchedSteps {
    return {
      kind: "steps",
      domain: DOMAIN,
      retrievedAt: new Date().toISOString(),
      quality: "fallback",
      fallbackReason: "timeout",
      sources: [],
      summary: country
        ? `Registration steps for ${country} could not be researched within budget.`
        : "Registration steps could not be researched within budget.",
      steps: [],
      documents: [],
    };
  }

  return withBudget({
    budgetMs: input.budgetMs,
    onTimeout: buildTimeoutFallback,
    work: async () => {
      // 1. Scrape canonical sources. AbortSignal.timeout caps the
      //    Firecrawl phase; the outer withBudget caps the entire run.
      const fetchSignal = AbortSignal.timeout(input.budgetMs);
      const fetchResult = await fetchRegisteredSources({
        country,
        domain: DOMAIN,
        signal: fetchSignal,
      });

      // 2. Build prompt.
      const userPrompt = `USER PROFILE (only fields the registration specialist needs):
${JSON.stringify(redactProfile(profile), null, 2)}

DESTINATION: ${country ?? "unknown"}

${renderResearchedSourcesBlock(fetchResult.fetched)}

Produce the JSON now.`;

      // 3. LLM synthesis.
      const synthesisStart = Date.now();
      const llm = await callLLM(AGENT_NAME, userPrompt, {
        system: SYSTEM_PROMPT,
        maxTokens: 8192,
      });
      const synthesisMs = Date.now() - synthesisStart;

      // 4. Parse + strict validation.
      const parsed = parseResearchedJsonResponse<LlmPayload>(llm.content);
      const parseFailed = !parsed || parsed.steps === undefined;
      const stepsResult = validateAndNormaliseSteps(parsed?.steps, DOMAIN);
      const docsResult = validateAndNormaliseDocuments(parsed?.documents, DOMAIN);

      const composed = composeQuality({
        fetchQuality: fetchResult.quality,
        fetchFallbackReason: fetchResult.fallbackReason,
        parseFailed,
        droppedSteps: stepsResult.dropped,
        droppedDocs: docsResult.dropped,
      });

      // 5. Audit logging — only when caller provided both fields.
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
            documents_count: docsResult.documents.length,
            documents_dropped: docsResult.dropped,
          },
        });
      }

      const summary =
        typeof parsed?.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : country
            ? `Registration steps after arriving in ${country}.`
            : "Registration steps after arriving in your destination.";

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
    "target_city",
    "citizenship",
    "current_location",
    "purpose",
    "visa_role",
    "moving_alone",
    "children_count",
    "settlement_reason",
    "partner_citizenship",
    "partner_visa_status",
    "relationship_type",
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (profile[k] !== undefined && profile[k] !== null) out[k] = profile[k];
  }
  return out;
}
