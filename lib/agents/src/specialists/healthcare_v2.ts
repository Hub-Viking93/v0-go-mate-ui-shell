// =============================================================
// @workspace/agents — healthcare_specialist v2 (Phase B3)
// =============================================================
// New researched-contract healthcare specialist. Returns
// ResearchedSteps covering the post-arrival healthcare onboarding
// path: registering at the public-care entry point, getting the
// official health card, transferring prescriptions, enrolling
// dental, and (for non-EU) settling EHIC-equivalent coverage.
//
// What this specialist owns vs. registration:
//   - registration:* covers folkbokföring / personnummer / address
//     registration. Healthcare's first step depends on those.
//   - healthcare:* covers everything specifically about getting
//     access to + onboarding into the destination's medical system.
//
// Coexists with legacy healthcare.ts (which still feeds the
// orchestrator). Phase C2 will switch the post-move route to consume
// this output via the existing settling-in researched path.
//
// Hardening (mirrors B1/B2 conventions):
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

const DOMAIN = "healthcare" as const;
const AGENT_NAME = "healthcare_navigator" as const;

const SYSTEM_PROMPT = `You are a healthcare specialist for international relocations. Your output drives the Healthcare section of the post-arrival checklist for a real user moving to a specific destination.

Goal: enumerate every step the user must take after arrival to get reliable access to the destination's medical system. Be destination + citizenship aware (EU/EEA vs. non-EU has different rules; some systems are insurance-based, others are tax-funded). Cite official-source URLs from SOURCES (national health service, social-insurance authority, dental authority, prescription registries). Do not invent providers.

Output a JSON object with this exact shape:
{
  "summary": "one-line section description (≤160 chars)",
  "steps": [
    {
      "id": "healthcare:<slug>",
      "title": "imperative, ≤80 chars",
      "description": "1-2 sentences, destination-specific",
      "deadlineWindow": {
        "phase": "first_72h" | "first_30d" | "first_90d" | "first_year_end" | "ongoing",
        "daysAfterArrival": <number|null>,
        "legalDeadlineDays": <number|null>
      },
      "appliesWhen": {"always": true} | {"eq": {"field": "<key>", "value": "<v>"}} | {"set": {...}} | ...,
      "prerequisites": ["healthcare:<slug>", "registration:<slug>"],
      "documentIds": ["healthcare:<doc-slug>", "..."],
      "walkthrough": ["short bullet 1", "..."],
      "bottleneck": "common watch-out (optional)",
      "sources": ["https://..."]
    }
  ],
  "documents": [
    {
      "id": "healthcare:<doc-slug>",
      "label": "human label",
      "category": "medical" | "identity" | "civil_status" | "other",
      "apostille": "needed" | "not_needed" | "varies",
      "translation": "needed" | "not_needed" | "destination_language_only" | "varies",
      "leadTimeDays": <number>,
      "sources": ["https://..."]
    }
  ],
  "structuredFacts": {
    "system_type": "tax_funded" | "insurance_based" | "mixed" | null,
    "patient_fee_local_currency": <number|null>,
    "high_cost_protection_threshold_local_currency": <number|null>
  }
}

Style rules:
- Step ids: "healthcare:<slug>". Lower-case slugs.
  Examples: "healthcare:register-vardcentral", "healthcare:receive-health-card",
  "healthcare:transfer-prescriptions", "healthcare:enrol-dental",
  "healthcare:apply-ehic-equivalent".
- Document ids: "healthcare:<slug>". Examples:
  "healthcare:vaccination-records", "healthcare:prescription-list",
  "healthcare:health-insurance-confirmation".
- prerequisites can reference other domains:
  "registration:population-register" is the typical blocker for
  enrolling in tax-funded systems; "banking:open-local-account" can
  block dental subscription payments.
- Use first_72h ONLY for genuinely-urgent items (acute prescription
  refills); most steps belong to first_30d (registration, card) or
  first_90d (elective dental, optional add-ons).

${URL_GUARDRAIL_RESEARCHED}`;

interface LlmPayload {
  summary?: unknown;
  steps?: unknown;
  documents?: unknown;
  structuredFacts?: unknown;
}

export const healthcareSpecialistV2: ResearchedSpecialistFn = async (input) => {
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
        ? `Healthcare research for ${country} did not complete within budget.`
        : "Healthcare research did not complete within budget.",
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

      const userPrompt = `USER PROFILE (only fields the healthcare specialist needs):
${JSON.stringify(redactProfile(profile), null, 2)}

DESTINATION: ${country ?? "unknown"}

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
            ? `Healthcare onboarding after arriving in ${country}.`
            : "Healthcare onboarding after arrival.";

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
    "spouse_joining",
    "healthcare_needs",
    "prescription_medications",
    "chronic_condition_description",
    "duration",
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (profile[k] !== undefined && profile[k] !== null) out[k] = profile[k];
  }
  return out;
}
