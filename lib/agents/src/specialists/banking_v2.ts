// =============================================================
// @workspace/agents — banking_specialist v2 (Phase B1)
// =============================================================
// New researched-contract banking specialist. Returns
// ResearchedSteps covering the full banking lifecycle: pre-arrival
// digital bridges, post-arrival local opening, BankID / digital-ID
// enrolment, payroll routing.
//
// Coexists with legacy banking.ts which still feeds the current
// orchestrator (and the existing /post-move setup-flows composer).
// Phase A/C will migrate the composers, after which legacy can be
// retired.
//
// Hardening (Phase B1 review):
//   - Strict enum + ProfilePredicate validation; drift drops items
//     and downgrades quality.
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

const DOMAIN = "banking" as const;
const AGENT_NAME = "banking_helper" as const;

const SYSTEM_PROMPT = `You are a banking specialist for international relocations. Your output drives the Setup-flows composer for a real user moving to a specific destination.

Goal: enumerate every banking step from the moment the user starts moving until they have a working destination salary account. Cover both:

- pre-arrival prep — digital bridges (Wise / Revolut / N26 / equivalents), origin-account adjustments
- post-arrival local opening — required documents, BankID / digital-ID enrolment, payroll routing

Be destination-specific. Cite official-source URLs from SOURCES (financial regulator, central bank, BankID-equivalent operator). Do not invent banks; if you list specific institutions in walkthrough[], they should appear in SOURCES too.

Output a JSON object with this exact shape:
{
  "summary": "one-line section description (≤160 chars)",
  "steps": [
    {
      "id": "banking:<slug>",
      "title": "imperative, ≤80 chars",
      "description": "1-2 sentences, destination-specific",
      "deadlineWindow": {
        "phase": "before_move" | "first_72h" | "first_30d" | "first_90d" | "ongoing",
        "weeksBeforeMove": <number|null>,
        "daysAfterArrival": <number|null>,
        "legalDeadlineDays": <number|null>
      },
      "appliesWhen": {"always": true} | {"eq": {"field": "<key>", "value": "<v>"}} | ...,
      "prerequisites": ["banking:<slug>", "registration:<slug>"],
      "documentIds": ["banking:<doc-slug>", "..."],
      "walkthrough": ["short bullet 1", "..."],
      "bottleneck": "common watch-out (optional)",
      "sources": ["https://..."]
    }
  ],
  "documents": [
    {
      "id": "banking:<doc-slug>",
      "label": "human label",
      "category": "civil_status" | "identity" | "professional" | "financial" | "housing" | "other",
      "apostille": "needed" | "not_needed" | "varies",
      "translation": "needed" | "not_needed" | "destination_language_only" | "varies",
      "leadTimeDays": <number>,
      "sources": ["https://..."]
    }
  ],
  "structuredFacts": {
    "typical_account_open_days": <number|null>,
    "monthly_fee_eur_range": "string|null",
    "english_service_typical": <boolean|null>
  }
}

Style rules:
- Step ids: "banking:<slug>". Lower-case slugs. Examples: "banking:open-digital-bridge", "banking:open-local-account", "banking:enrol-bankid", "banking:route-payroll".
- Document ids: "banking:<slug>". Examples: "banking:proof-of-residence", "banking:initial-deposit-proof".
- prerequisites can reference other domains: "registration:population-register" is the typical blocker for opening a local account.
- deadlineWindow.phase=before_move for digital bridges; first_30d for local account; ongoing for payroll routing.

${URL_GUARDRAIL_RESEARCHED}`;

interface LlmPayload {
  summary?: unknown;
  steps?: unknown;
  documents?: unknown;
  structuredFacts?: unknown;
}

export const bankingSpecialistV2: ResearchedSpecialistFn = async (input) => {
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
        ? `Banking research for ${country} did not complete within budget.`
        : "Banking research did not complete within budget.",
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

      const userPrompt = `USER PROFILE (only fields the banking specialist needs):
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
            ? `Banking setup for moving to ${country}.`
            : "Banking setup for your destination.";

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
    "highly_skilled",
    "monthly_budget",
    "savings_available",
    "preferred_currency",
    "settlement_support_source",
    "remote_income",
    "income_consistency",
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (profile[k] !== undefined && profile[k] !== null) out[k] = profile[k];
  }
  return out;
}
