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
// Phase B1 scope:
//   - Build the function with the new contract.
//   - Use canonical sources from the registry.
//   - Wire audit logging via writeResearchedAudit.
//   - DO NOT wire into the orchestrator dispatch yet — that is
//     Phase A/C. The legacy pipeline is untouched.
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

const DOMAIN = "registration" as const;

// ---- LLM I/O shape (internal) -----------------------------------------
//
// We ask the model for a flat JSON object that mirrors ResearchedSteps
// minus the orchestrator-set fields (retrievedAt, sources, quality,
// fallbackReason). The wrapper assembles those.

interface LlmPayload {
  summary: string;
  steps: Array<Omit<ResearchedStep, "appliesWhen"> & {
    /** Model returns a structured ProfilePredicate object — typed as
     *  unknown here so we can validate before assigning. */
    appliesWhen?: unknown;
  }>;
  documents: DocumentRequirement[];
  structuredFacts?: Record<string, unknown>;
}

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
        "phase": "first_72h" | "first_30d" | "first_90d" | "ongoing",
        "daysAfterArrival": <number|null>,
        "legalDeadlineDays": <number|null>
      },
      "appliesWhen": {"always": true} | {"eq": {"field": "<key>", "value": "<v>"}} | {"set": {...}} | ...,
      "prerequisites": ["registration:<slug>", "<other domain step id>"],
      "documentIds": ["registration:<doc-slug>", "..."],
      "walkthrough": ["short bullet 1", "..."],   // optional, ≤5 items
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
  "structuredFacts": { "fee_local_currency": <number|null>, "...": "..." }   // optional
}

Style rules:
- Step ids: domain-prefixed ("registration:population-register", "registration:tax-id"). Lower-case slugs.
- Document ids: also "registration:<slug>" — proof-of-address goes here, NOT as its own step.
- Steps are ACTIONS the user takes; documents are THINGS they need.
- prerequisites references step ids only (other-domain steps welcome — "visa:residence-permit-issued").
- deadlineWindow.phase is the bucket; legalDeadlineDays takes precedence when set.
- documents[] should include proof-of-address requirements when relevant — e.g. "registration:proof-of-address".

${URL_GUARDRAIL_RESEARCHED}`;

// ---- Public function --------------------------------------------------

export const registrationSpecialist: ResearchedSpecialistFn = async (input) => {
  const start = Date.now();
  const profile = input.profile;
  const country = profile.destination ? String(profile.destination) : null;

  // 1. Fetch canonical sources (signal omitted — caller is the
  //    orchestrator which already wraps a master abort signal; the
  //    helpers handle abort downstream when the orchestrator wires
  //    cancellation. For Phase B1 we use a never-abort signal.)
  const fetchSignal = input.budgetMs
    ? AbortSignal.timeout(input.budgetMs)
    : new AbortController().signal;
  const fetchResult = await fetchRegisteredSources({
    country,
    domain: DOMAIN,
    signal: fetchSignal,
  });

  // 2. Build the user prompt with profile + scraped sources.
  const userPrompt = `USER PROFILE (only fields the registration specialist needs):
${JSON.stringify(redactProfile(profile), null, 2)}

DESTINATION: ${country ?? "unknown"}

${renderResearchedSourcesBlock(fetchResult.fetched)}

Produce the JSON now.`;

  // 3. LLM synthesis.
  const synthesisStart = Date.now();
  const llm = await callLLM("registration_specialist", userPrompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 8192,
  });
  const synthesisMs = Date.now() - synthesisStart;

  // 4. Audit row — best-effort. Specialist must not fail on
  //    audit-write failure.
  const writer = input.priorOutputs as unknown as { logWriter?: LogWriter } | undefined;
  // logWriter isn't part of the new contract input. For Phase B1
  // we accept a logWriter via the optional priorOutputs shape (not
  // ideal — Phase B2 we'll widen the contract). Most callers will
  // pass undefined and the audit row is skipped.
  void writer;

  // 5. Parse + assemble.
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

  const out: ResearchedSteps = {
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
          ? `Registration steps after arriving in ${country}.`
          : "Registration steps after arriving in your destination.",
    steps: safeSteps,
    documents: safeDocs,
    ...(parsed?.structuredFacts && typeof parsed.structuredFacts === "object"
      ? { structuredFacts: parsed.structuredFacts }
      : {}),
  };

  void start; // wall-clock measured by orchestrator (Phase B2 telemetry)
  void synthesisMs;
  return out;
};

// ---- Internal: profile redaction --------------------------------------

/** Only the fields the registration specialist actually reads. Keeps
 *  the prompt small + reduces accidental over-fitting. */
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

// ---- Internal: shape validation --------------------------------------

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
      ...(typeof dw.daysAfterArrival === "number"
        ? { daysAfterArrival: dw.daysAfterArrival }
        : {}),
      ...(typeof dw.weeksBeforeMove === "number"
        ? { weeksBeforeMove: dw.weeksBeforeMove }
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

// ---- Audit-row helper exposed for the orchestrator wire-up (Phase B2) -

export async function writeRegistrationAudit(args: {
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
    agentName: "registration_specialist",
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
