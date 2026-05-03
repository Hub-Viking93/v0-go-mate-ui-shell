// =============================================================
// @workspace/agents — Wave 1.5 audit writer
// =============================================================
// writeAuditRow hashes prompt + response (SHA-256) before persisting
// so we keep a tamper-detectable trail without storing full prompt
// bodies in the audit table. Insert is wrapped in exponential-backoff
// retries; logging failures are surfaced (not swallowed) so the
// caller can decide whether to retry the wider operation.
// =============================================================

import { createHash } from "node:crypto";
import type {
  AgentAuditRow,
  AgentName,
  AgentPhase,
  ConfidenceLevel,
  LogWriter,
} from "./types.js";

function sha256Hex(input: string | undefined | null): string | null {
  if (input === undefined || input === null) return null;
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export interface WriteAuditRowArgs {
  profile_id: string;
  agent_name: AgentName;
  model_used?: string | null;
  phase: AgentPhase;
  field_or_output_key?: string | null;
  value: unknown;
  confidence: ConfidenceLevel;
  source_user_message?: string | null;
  source_url?: string | null;
  /**
   * Full prompt; hashed (SHA-256 hex) before insert. Never stored verbatim.
   * Optional — pure-code agents (validator, profile_writer) have no LLM
   * prompt to hash; pass undefined / omit and prompt_hash will be null.
   */
  prompt?: string;
  /**
   * Full response; hashed (SHA-256 hex) before insert. Never stored verbatim.
   * Optional — same rationale as `prompt`.
   */
  response?: string;
  validation_rules?: unknown | null;
  wall_clock_ms: number;
  tokens_used?: number | null;
}

export interface WriteAuditRowOptions {
  /** Max retries on insert failure (default 2). */
  retries?: number;
  /** Initial backoff in ms; doubled per attempt (default 250). */
  initialBackoffMs?: number;
}

export async function writeAuditRow(
  writer: LogWriter,
  args: WriteAuditRowArgs,
  options: WriteAuditRowOptions = {},
): Promise<void> {
  const retries = options.retries ?? 2;
  const initialBackoffMs = options.initialBackoffMs ?? 250;

  const row: AgentAuditRow = {
    profile_id: args.profile_id,
    agent_name: args.agent_name,
    model_used: args.model_used ?? null,
    phase: args.phase,
    field_or_output_key: args.field_or_output_key ?? null,
    value: args.value,
    confidence: args.confidence,
    source_user_message: args.source_user_message ?? null,
    source_url: args.source_url ?? null,
    prompt_hash: sha256Hex(args.prompt),
    response_hash: sha256Hex(args.response),
    validation_rules_applied: args.validation_rules ?? null,
    wall_clock_ms: args.wall_clock_ms,
    tokens_used: args.tokens_used ?? null,
  };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await writer.insertAudit(row);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const ms =
          initialBackoffMs * 2 ** attempt + Math.floor(Math.random() * 50);
        await new Promise<void>((res) => setTimeout(res, ms));
        continue;
      }
      break;
    }
  }

  throw new Error(
    `[audit] writeAuditRow failed after ${retries + 1} attempts for agent "${args.agent_name}" (phase "${args.phase}"): ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}
