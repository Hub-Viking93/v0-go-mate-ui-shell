// =============================================================
// @workspace/agents — banking_specialist v2 (Phase B1)
// =============================================================
// New researched-contract banking specialist. Returns
// ResearchedSteps covering the full lifecycle: pre-arrival
// digital bridges (Wise / Revolut / N26), post-arrival local
// account opening, BankID / digital-ID enrolment, payroll routing.
//
// Coexists with legacy banking.ts which still feeds the current
// orchestrator (and the existing /post-move setup-flows composer).
// Phase A/C will migrate the composers, after which legacy can be
// retired.
//
// Contract: see lib/agents/src/specialists/_contracts.ts.
// Sources: lib/agents/src/specialists/_sources.ts (domain="banking").
// =============================================================

import { callLLM } from "../router.js";
import type { LogWriter } from "../types.js";
import {
  fetchRegisteredSources,
  parseResearchedJsonResponse,
  renderResearchedSourcesBlock,
  URL_GUARDRAIL_RESEARCHED,
  writeResearchedAudit,
} from "./_researched-helpers.js";
import type {
  DocumentRequirement,
  ResearchedSpecialistFn,
  ResearchedStep,
  ResearchedSteps,
  SpecialistFallbackReason,
} from "./_contracts.js";

const DOMAIN = "banking" as const;

interface LlmPayload {
  summary: string;
  steps: Array<Omit<ResearchedStep, "appliesWhen"> & { appliesWhen?: unknown }>;
  documents: DocumentRequirement[];
  structuredFacts?: Record<string, unknown>;
}

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
- legalDeadlineDays only when there's a hard regulatory deadline (rare for banking — usually leave null).

${URL_GUARDRAIL_RESEARCHED}`;

export const bankingSpecialistV2: ResearchedSpecialistFn = async (input) => {
  const start = Date.now();
  const profile = input.profile;
  const country = profile.destination ? String(profile.destination) : null;

  const fetchSignal = input.budgetMs
    ? AbortSignal.timeout(input.budgetMs)
    : new AbortController().signal;
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
  const llm = await callLLM("banking_helper", userPrompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 8192,
  });
  const synthesisMs = Date.now() - synthesisStart;

  const parsed = parseResearchedJsonResponse<LlmPayload>(llm.content);
  let quality = fetchResult.quality;
  let fallbackReason: SpecialistFallbackReason | undefined = fetchResult.fallbackReason;
  if (!parsed || !Array.isArray(parsed.steps)) {
    quality = "fallback";
    fallbackReason = "llm_parse_failed";
  }

  const safeSteps: ResearchedStep[] = (parsed?.steps ?? [])
    .map((s) => normaliseStep(s))
    .filter((s): s is ResearchedStep => s !== null);
  const safeDocs: DocumentRequirement[] = Array.isArray(parsed?.documents)
    ? parsed!.documents.filter(isValidDocument)
    : [];

  void start;
  void synthesisMs;

  return {
    kind: "steps",
    domain: DOMAIN,
    retrievedAt: new Date().toISOString(),
    quality,
    ...(fallbackReason ? { fallbackReason } : {}),
    sources: fetchResult.asResearchedSources,
    summary:
      typeof parsed?.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : country
          ? `Banking setup for moving to ${country}.`
          : "Banking setup for your destination.",
    steps: safeSteps,
    documents: safeDocs,
    ...(parsed?.structuredFacts && typeof parsed.structuredFacts === "object"
      ? { structuredFacts: parsed.structuredFacts }
      : {}),
  };
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

function normaliseStep(raw: unknown): ResearchedStep | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id.startsWith(`${DOMAIN}:`)) return null;
  if (typeof r.title !== "string" || typeof r.description !== "string") return null;
  const dw = r.deadlineWindow as Record<string, unknown> | undefined;
  if (!dw || typeof dw.phase !== "string") return null;
  const appliesWhen = (r.appliesWhen ?? { always: true }) as ResearchedStep["appliesWhen"];
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    deadlineWindow: {
      phase: dw.phase as ResearchedStep["deadlineWindow"]["phase"],
      ...(typeof dw.weeksBeforeMove === "number"
        ? { weeksBeforeMove: dw.weeksBeforeMove }
        : {}),
      ...(typeof dw.daysAfterArrival === "number"
        ? { daysAfterArrival: dw.daysAfterArrival }
        : {}),
      ...(typeof dw.legalDeadlineDays === "number"
        ? { legalDeadlineDays: dw.legalDeadlineDays }
        : {}),
    },
    appliesWhen,
    prerequisites: Array.isArray(r.prerequisites)
      ? (r.prerequisites as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    documentIds: Array.isArray(r.documentIds)
      ? (r.documentIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    ...(Array.isArray(r.walkthrough)
      ? { walkthrough: (r.walkthrough as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 5) }
      : {}),
    ...(typeof r.bottleneck === "string" ? { bottleneck: r.bottleneck } : {}),
    sources: Array.isArray(r.sources)
      ? (r.sources as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
  };
}

function isValidDocument(raw: unknown): raw is DocumentRequirement {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    r.id.startsWith(`${DOMAIN}:`) &&
    typeof r.label === "string" &&
    typeof r.category === "string" &&
    typeof r.apostille === "string" &&
    typeof r.translation === "string" &&
    typeof r.leadTimeDays === "number"
  );
}

export async function writeBankingV2Audit(args: {
  profileId: string;
  logWriter: LogWriter;
  fetchResult: Awaited<ReturnType<typeof fetchRegisteredSources>>;
  userPrompt: string;
  llm: { content: string; tokens_used: number; model_used: string };
  synthesisMs: number;
  quality: ResearchedSteps["quality"];
  fallbackReason?: SpecialistFallbackReason;
  stepsCount: number;
  documentsCount: number;
}): Promise<void> {
  await writeResearchedAudit({
    profileId: args.profileId,
    logWriter: args.logWriter,
    agentName: "banking_helper",
    domain: DOMAIN,
    fetchResult: args.fetchResult,
    userPrompt: args.userPrompt,
    llm: args.llm,
    synthesisMs: args.synthesisMs,
    quality: args.quality,
    fallbackReason: args.fallbackReason,
    extra: {
      steps_count: args.stepsCount,
      documents_count: args.documentsCount,
    },
  });
}
