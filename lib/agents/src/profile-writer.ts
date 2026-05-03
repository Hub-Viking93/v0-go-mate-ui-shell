// =============================================================
// @workspace/agents — Wave 2.1 Profile Writer agent
// =============================================================
// Pure code, no LLM. Persists a single validated field to
// public.relocation_plans.profile_data and writes a matching
// audit row.
//
// Routing: AGENT_MODEL_ROUTING["profile_writer"] === null —
// callLLM refuses to invoke it. This is correct: profile_writer
// is deterministic and does not consult any model.
//
// SPEC NOTE — additive options parameter:
//   The spec signature is
//     writeProfileField(profile_id, fieldKey, validatedValue,
//                       confidence, sourceUserMessage,
//                       validationRulesApplied)
//   We add an optional 7th `options` parameter carrying the
//   ProfileStore + LogWriter (DI). Without DI we'd need a
//   module-level singleton, which fights the orchestrator design.
//   When `options.store` is omitted no DB write happens (useful
//   for unit tests). When `options.writer` is omitted no audit row
//   is written (also useful for tests). In production both are
//   provided.
//
// Fail-loud invariants:
//   * Unknown fieldKey → throws BEFORE any IO. profile_data is
//     a closed schema; spurious keys would silently leak through
//     the JSONB column otherwise.
//   * Profile row missing → throws AFTER the read (no UPSERT —
//     the row should exist by the time Extractor → Validator →
//     Profile Writer fires).
// =============================================================

import { ALL_FIELDS, type AllFieldKey } from "./intake-fields.js";
import { writeAuditRow } from "./audit.js";
import type { ConfidenceLevel, LogWriter } from "./types.js";
import { singleFieldPatch, type ProfileStore } from "./profile-store.js";

const ALL_FIELD_KEY_SET = new Set<string>(ALL_FIELDS as readonly string[]);

export interface WriteProfileFieldOptions {
  /** When provided, profile_data is read+merged+written. Omit in unit tests. */
  store?: ProfileStore;
  /** When provided, an audit row is appended. Omit in unit tests. */
  writer?: LogWriter;
}

export interface WriteProfileFieldResult {
  written: boolean;
  fieldKey: AllFieldKey;
  value: unknown;
  /** profile_data after the merge (same object that was persisted). */
  profileData?: Record<string, unknown>;
}

export async function writeProfileField(
  profile_id: string,
  fieldKey: AllFieldKey,
  validatedValue: unknown,
  confidence: ConfidenceLevel,
  sourceUserMessage: string,
  validationRulesApplied: Record<string, unknown>,
  options: WriteProfileFieldOptions = {},
): Promise<WriteProfileFieldResult> {
  // Fail loudly on unknown fields — happens BEFORE any IO so a buggy
  // caller never corrupts profile_data.
  if (!ALL_FIELD_KEY_SET.has(fieldKey)) {
    throw new Error(
      `[profile-writer] unknown fieldKey "${fieldKey}" — refusing to write. profile_data is a closed schema; add the key to ALL_FIELDS first.`,
    );
  }

  const start = Date.now();

  let mergedProfileData: Record<string, unknown> | undefined;

  if (options.store) {
    // Atomic JSONB-merge update — see ProfileStore.applyFieldPatch
    // contract. Eliminates the lost-update race that a naive
    // read-modify-write would have when two extraction chains race
    // against the same relocation_plans row.
    mergedProfileData = await options.store.applyFieldPatch(
      profile_id,
      singleFieldPatch(fieldKey, validatedValue),
    );
  }

  if (options.writer) {
    await writeAuditRow(options.writer, {
      profile_id,
      agent_name: "profile_writer",
      model_used: null, // pure code agent — no LLM
      phase: "extraction",
      field_or_output_key: fieldKey,
      value: validatedValue,
      confidence,
      source_user_message: sourceUserMessage,
      validation_rules: validationRulesApplied,
      wall_clock_ms: Date.now() - start,
      // prompt + response intentionally omitted — pure-code agent has
      // no LLM round-trip; prompt_hash and response_hash will be null.
    });
  }

  return {
    written: Boolean(options.store),
    fieldKey,
    value: validatedValue,
    ...(mergedProfileData ? { profileData: mergedProfileData } : {}),
  };
}
