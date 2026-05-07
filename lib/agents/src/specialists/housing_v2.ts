// =============================================================
// @workspace/agents — housing_specialist v2 (Phase B2)
// =============================================================
// New researched-contract housing specialist. Returns
// ResearchedSteps for the housing journey end-to-end:
//
//   - before_move    queue registrations / sublet platforms /
//                    deposit prep
//   - move_day       temporary accommodation handover
//   - first_30d      permanent contract + utilities + tenancy
//                    registration
//
// What this specialist owns vs. registration:
//   - housing:* covers SECURING accommodation (queue, sublet,
//     contract, utilities).
//   - registration:* covers LEGAL ADDRESS REGISTRATION at the
//     authority (folkbokföring / Anmeldung / empadronamiento) —
//     which uses the lease emitted here as a documentId.
//
// Coexists with legacy housing.ts. Phase A2 will switch the
// pre-departure route to consume this output.
//
// Hardening (mirrors B1 conventions):
//   - Strict enum + ProfilePredicate validation; drift drops items
//     and downgrades quality to "partial".
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

const DOMAIN = "housing" as const;
const AGENT_NAME = "housing_specialist" as const;

const SYSTEM_PROMPT = `You are a housing specialist for international relocations. Your output drives the Housing section of the pre-departure + first-30-days checklist for a real user moving to a specific destination city.

Goal: enumerate every step the user must take to secure a place to live — from pre-arrival queue / platform registrations to signing the permanent contract on arrival. Be city-specific where possible (rental markets vary dramatically by city). Cite official-source URLs from SOURCES (city housing authority, tenants' union, queue operator). Do not invent platforms; if you mention a specific marketplace, it must appear in SOURCES.

Output a JSON object with this exact shape:
{
  "summary": "one-line section description (≤160 chars)",
  "steps": [
    {
      "id": "housing:<slug>",
      "title": "imperative, ≤80 chars",
      "description": "1-2 sentences, city-specific",
      "deadlineWindow": {
        "phase": "before_move" | "move_day" | "first_72h" | "first_30d" | "ongoing",
        "weeksBeforeMove": <number|null>,
        "daysAfterArrival": <number|null>,
        "legalDeadlineDays": <number|null>
      },
      "appliesWhen": {"always": true} | {"eq": {"field": "<key>", "value": "<v>"}} | ...,
      "prerequisites": ["housing:<slug>", "<other domain step id>"],
      "documentIds": ["housing:<doc-slug>", "..."],
      "walkthrough": ["short bullet 1", "..."],
      "bottleneck": "common watch-out (optional)",
      "sources": ["https://..."]
    }
  ],
  "documents": [
    {
      "id": "housing:<doc-slug>",
      "label": "human label",
      "category": "housing" | "financial" | "identity" | "other",
      "apostille": "needed" | "not_needed" | "varies",
      "translation": "needed" | "not_needed" | "destination_language_only" | "varies",
      "leadTimeDays": <number>,
      "sources": ["https://..."]
    }
  ],
  "structuredFacts": {
    "typical_deposit_months": <number|null>,
    "first_hand_queue_years": <number|null>,
    "median_studio_rent_local_currency": <number|null>
  }
}

Style rules:
- Step ids: "housing:<slug>". Lower-case slugs.
  Examples: "housing:register-rental-queue", "housing:secure-temporary-accommodation",
  "housing:sign-permanent-lease", "housing:set-up-utilities".
- Document ids: "housing:<slug>". Examples: "housing:lease-agreement",
  "housing:proof-of-deposit", "housing:utility-account-confirmation".
- Most steps belong to phase=before_move (search + apply) or first_30d
  (sign + utilities). move_day for short-term accommodation handover.
- prerequisites can reference other domains:
  "registration:population-register" usually requires housing:lease-agreement first.

${URL_GUARDRAIL_RESEARCHED}`;

interface LlmPayload {
  summary?: unknown;
  steps?: unknown;
  documents?: unknown;
  structuredFacts?: unknown;
}

export const housingSpecialistV2: ResearchedSpecialistFn = async (input) => {
  const profile = input.profile;
  const country = profile.destination ? String(profile.destination) : null;
  const city = profile.target_city ? String(profile.target_city) : null;

  function buildTimeoutFallback(): ResearchedSteps {
    return {
      kind: "steps",
      domain: DOMAIN,
      retrievedAt: new Date().toISOString(),
      quality: "fallback",
      fallbackReason: "timeout",
      sources: [],
      summary: country
        ? `Housing research for ${country} did not complete within budget.`
        : "Housing research did not complete within budget.",
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

      const userPrompt = `USER PROFILE (only fields the housing specialist needs):
${JSON.stringify(redactProfile(profile), null, 2)}

DESTINATION: ${country ?? "unknown"}
TARGET CITY: ${city ?? "unknown"}

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
          : city
            ? `Housing journey for moving to ${city}.`
            : country
              ? `Housing journey for moving to ${country}.`
              : "Housing journey for your destination.";

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
    "purpose",
    "visa_role",
    "moving_alone",
    "children_count",
    "monthly_budget",
    "savings_available",
    "preferred_currency",
    "settlement_support_source",
    "remote_income",
    "duration",
    "timeline",
    "pets",
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (profile[k] !== undefined && profile[k] !== null) out[k] = profile[k];
  }
  return out;
}
