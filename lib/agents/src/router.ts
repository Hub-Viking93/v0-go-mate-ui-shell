// =============================================================
// @workspace/agents — Wave 1.5 model router
// =============================================================
// Defines AGENT_MODEL_ROUTING (one row per AgentName) and exposes
// callLLM(agentName, prompt, options) which:
//   1. Looks up the routed model.
//   2. Refuses to call deterministic agents (model === null).
//   3. Refuses to call models we cannot route yet (Gemini — see TODO below).
//   4. Routes Anthropic models through @workspace/integrations-anthropic-ai
//      (Replit AI Integrations proxy — no caller-managed API key).
//   5. Wraps the call in exponential-backoff retries.
//
// PROMPT-vs-PROJECT NOTES:
//   * The prompt asked for "OpenRouter (existing setup)". This project has
//     no OpenRouter integration; the only existing LLM setup is Anthropic
//     via @workspace/integrations-anthropic-ai. callLLM uses that.
//   * The prompt routes `schools_specialist` to "google/gemini-2.5-pro".
//     The Anthropic integration cannot serve Gemini. callLLM throws a clear
//     error tagged TODO[prompt-Wave2-gemini] so a future wave provisions a
//     Gemini integration rather than silently falling back.
//   * The prompt's routing list was truncated mid-`pre_departure_coordinator`.
//     Set to "claude-opus-4-7" to match every other coordinator entry.
// =============================================================

import { anthropic, isOpenRouter } from "@workspace/integrations-anthropic-ai";
import type { AgentName } from "./types.js";

// Map our internal model IDs (Replit-Anthropic-proxy naming, e.g. "claude-haiku-4-5")
// to the OpenRouter naming convention ("anthropic/claude-haiku-4.5").
function mapModelForOpenRouter(model: string): string {
  if (model.includes("/")) return model; // already provider-prefixed
  // claude-<family>-<major>-<minor> -> anthropic/claude-<family>-<major>.<minor>
  const m = model.match(/^claude-(haiku|sonnet|opus)-(\d+)-(\d+)$/);
  if (m) {
    const [, family, major, minor] = m;
    return `anthropic/claude-${family}-${major}.${minor}`;
  }
  // Fallback: assume Anthropic provider
  return `anthropic/${model}`;
}

// `null` means the agent is deterministic and must NEVER be routed through
// callLLM. Calling callLLM for such an agent throws a programming-error
// exception so the bug surfaces immediately.
export const AGENT_MODEL_ROUTING = {
  // foundation
  extractor: "claude-haiku-4-5",
  validator: null,
  profile_writer: null,
  question_director: "claude-sonnet-4-6",

  // coordinators — switched off Opus per cost-budget directive (2026-05-03).
  // Coordinator's job is dispatch logic over a small profile JSON;
  // Sonnet 4.6 handles it with no quality regression.
  coordinator: "claude-sonnet-4-6",
  settling_in_coordinator: "claude-sonnet-4-6",
  pre_departure_coordinator: "claude-sonnet-4-6",

  // domain specialists
  visa_specialist: "claude-sonnet-4-5",
  tax_strategist: "claude-sonnet-4-6",
  cost_specialist: "claude-sonnet-4-5",
  housing_specialist: "claude-sonnet-4-5",
  // schools_specialist was routed to google/gemini-2.5-pro but no Gemini
  // integration is provisioned. Switched to claude-sonnet-4-6 — same family
  // as every other specialist, no integration debt.
  schools_specialist: "claude-sonnet-4-6",
  study_program_specialist: "claude-sonnet-4-6",
  healthcare_navigator: "claude-sonnet-4-5",
  banking_helper: "claude-sonnet-4-5",
  documents_specialist: "claude-sonnet-4-5",
  cultural_adapter: "claude-sonnet-4-6",
  pet_specialist: "claude-sonnet-4-5",
  posted_worker_specialist: "claude-sonnet-4-5",
  digital_nomad_compliance: "claude-sonnet-4-5",
  job_compliance_specialist: "claude-sonnet-4-5",
  family_reunion_specialist: "claude-sonnet-4-5",
  departure_tax_specialist: "claude-sonnet-4-6",
  vehicle_import_specialist: "claude-sonnet-4-5",
  property_purchase_specialist: "claude-sonnet-4-5",
  trailing_spouse_career_specialist: "claude-sonnet-4-6",
  pension_continuity_specialist: "claude-sonnet-4-6",

  // composition
  synthesizer: "claude-sonnet-4-5",
  critic: "claude-sonnet-4-5",
  guide_composer: "claude-sonnet-4-6",

  // guide section writers
  section_writer_visa: "claude-sonnet-4-6",
  section_writer_budget: "claude-sonnet-4-6",
  section_writer_housing: "claude-sonnet-4-6",
  section_writer_banking: "claude-sonnet-4-6",
  section_writer_healthcare: "claude-sonnet-4-6",
  section_writer_culture: "claude-sonnet-4-6",
  section_writer_jobs: "claude-sonnet-4-6",
  section_writer_education: "claude-sonnet-4-6",
  section_writer_documents: "claude-sonnet-4-6",
  section_writer_posted_worker: "claude-sonnet-4-6",
  section_writer_pre_departure_overview: "claude-sonnet-4-6",
  section_writer_settling_in_overview: "claude-sonnet-4-6",

  // settling-in workers
  settling_in_registration: "claude-sonnet-4-5",
  settling_in_banking: "claude-sonnet-4-5",
  settling_in_housing: "claude-sonnet-4-5",
  settling_in_healthcare: "claude-sonnet-4-5",
  settling_in_employment: "claude-sonnet-4-5",
  settling_in_transport: "claude-sonnet-4-5",
  settling_in_family: "claude-sonnet-4-5",
  settling_in_tax: "claude-sonnet-4-5",
} as const satisfies Record<AgentName, string | null>;

export type ModelId = NonNullable<(typeof AGENT_MODEL_ROUTING)[AgentName]>;

export interface CallLLMOptions {
  /** Defaults to 8192 per Anthropic skill guidance. Never set below 8192 unless asked. */
  maxTokens?: number;
  system?: string;
  /** Emergency override; bypasses the routing table. */
  modelOverride?: string;
  /** Max retries on network/transient errors (default 3). */
  retries?: number;
  /** Initial backoff in ms; doubled per attempt (default 500). */
  initialBackoffMs?: number;
}

export interface CallLLMResult {
  content: string;
  tokens_used: number;
  wall_clock_ms: number;
  model_used: string;
}

const DEFAULT_MAX_TOKENS = 8192;

async function backoffSleep(attempt: number, base: number): Promise<void> {
  const ms = base * 2 ** attempt + Math.floor(Math.random() * 100);
  await new Promise<void>((res) => setTimeout(res, ms));
}

export async function callLLM(
  agentName: AgentName,
  prompt: string,
  options: CallLLMOptions = {},
): Promise<CallLLMResult> {
  const routed = options.modelOverride ?? AGENT_MODEL_ROUTING[agentName];

  if (routed === null) {
    throw new Error(
      `[router] Agent "${agentName}" is configured with no LLM (null in AGENT_MODEL_ROUTING). ` +
        `Do not call callLLM for deterministic agents — invoke their pure logic directly.`,
    );
  }
  if (typeof routed !== "string") {
    throw new Error(`[router] Unknown agent: "${agentName}"`);
  }

  // Defensive: no Gemini integration provisioned. We removed all google/*
  // routes from AGENT_MODEL_ROUTING but keep this guard in case a future
  // edit reintroduces one.
  if (routed.startsWith("google/")) {
    throw new Error(
      `[router] Model "${routed}" requested for agent "${agentName}", but no Gemini AI integration is provisioned. ` +
        `Use an Anthropic model in AGENT_MODEL_ROUTING or pass options.modelOverride.`,
    );
  }

  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  // Default 2 retries (3 total attempts). Lowered from 3 retries (4 attempts)
  // per cost-budget directive — failed LLM calls were running 4× per failure
  // and inflating spend during dev. Callers can still override per-call.
  const retries = options.retries ?? 2;
  const initialBackoffMs = options.initialBackoffMs ?? 500;

  const start = Date.now();
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const modelToCall = isOpenRouter ? mapModelForOpenRouter(routed) : routed;
      const message = await anthropic.messages.create({
        model: modelToCall,
        max_tokens: maxTokens,
        ...(options.system ? { system: options.system } : {}),
        messages: [{ role: "user", content: prompt }],
      });

      // Defensive shape parsing — SDK + OpenRouter combo can return
      // unexpected shapes when an upstream error is wrapped or when the
      // SDK is updated. Surface the actual shape so the failure is
      // diagnosable instead of a cryptic "undefined.map".
      if (!message || !Array.isArray((message as { content?: unknown }).content)) {
        // eslint-disable-next-line no-console
        console.error(
          `[router][${agentName}] unexpected response shape (no content array). keys=${
            message ? Object.keys(message as object).join(",") : "null"
          } sample=${JSON.stringify(message).slice(0, 400)}`,
        );
        throw new Error(
          `LLM response missing content array (got keys: ${
            message ? Object.keys(message as object).join(",") : "null"
          })`,
        );
      }
      const content = (message.content as Array<{ type: string; text?: string }>)
        .map((block) => (block.type === "text" ? block.text ?? "" : ""))
        .join("");

      const tokens_used =
        (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0);

      return {
        content,
        tokens_used,
        wall_clock_ms: Date.now() - start,
        model_used: routed,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await backoffSleep(attempt, initialBackoffMs);
        continue;
      }
      break;
    }
  }

  throw new Error(
    `[router] callLLM failed after ${retries + 1} attempts for agent "${agentName}" (model "${routed}"): ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}
