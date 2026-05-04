// =============================================================
// @workspace/agents — Wave 2.0 Extractor agent
// =============================================================
// extractField reads ONE user message + the field we asked them
// about (the pending field) and returns either a typed value, a
// yes/no, a number, or null + an "I couldn't tell" reason. It
// also flags any OTHER fields the user volunteered so Question
// Director can plan follow-ups.
//
// Routing: uses callLLM with agentName="extractor" — model
// resolves to claude-haiku-4-5 (cheap, fast, deterministic).
//
// PROMPT-vs-PROJECT NOTES:
//   * The prompt asks for "OpenAI-compatible JSON mode". Anthropic
//     has no native JSON mode; we instruct the model to emit
//     ONLY a JSON object and parse defensively (strict parse, then
//     {...}-substring fallback). On parse failure we never throw
//     — we return the documented "I couldn't tell" shape.
//   * The prompt's signature is (userMessage, pendingField,
//     lastAIMessage?) — preserved exactly. An optional 4th
//     `options` parameter carries the LogWriter + profileId for
//     audit-row writes (writer is OPTIONAL so unit/manual tests
//     can call extractField without a database).
// =============================================================

import {
  ALL_FIELDS,
  FIELD_INFO,
  type AllFieldKey,
} from "./intake-fields.js";
import { callLLM } from "./router.js";
import { writeAuditRow } from "./audit.js";
import { getValidationRule } from "./validation-rules.js";
import { getDateContextLine } from "./date-context.js";
import type { ConfidenceLevel, LogWriter } from "./types.js";

export type ExtractionConfidence = Extract<
  ConfidenceLevel,
  "explicit" | "inferred" | "assumed"
>;

export interface ExtractionResult {
  /** Clean extracted value, or null when the user didn't answer / it was unclear. */
  value: string | number | "yes" | "no" | null;
  confidence: ExtractionConfidence;
  /** Exact user message — kept verbatim for the audit trail. */
  rawText: string;
  /** Other field keys the user volunteered but we didn't ask about. */
  additionalFieldsDetected: AllFieldKey[];
  /** Populated only when value is null. */
  uncertaintyReason?: string;
}

export interface ExtractFieldOptions {
  /** Optional audit sink. When omitted, no audit row is written (useful for tests). */
  writer?: LogWriter;
  /** Required when writer is provided — RLS keys audit rows by profile_id. */
  profileId?: string;
}

interface RawLLMShape {
  value: unknown;
  confidence: unknown;
  additionalFieldsDetected?: unknown;
  uncertaintyReason?: unknown;
}

const ALL_FIELD_KEY_SET = new Set<string>(ALL_FIELDS as readonly string[]);

const VALID_CONFIDENCE: ReadonlySet<ExtractionConfidence> = new Set([
  "explicit",
  "inferred",
  "assumed",
]);

function buildSystemPrompt(): string {
  return [
    "You extract a SINGLE field from a user's message in a relocation interview.",
    getDateContextLine(),
    "When the user gives a relative date phrase ('this year', 'next month', 'November this year', 'in two weeks', 'end of summer', etc.), NORMALIZE it to ISO YYYY-MM-DD anchored to today's date — never store the raw relative phrase. If only a month + year is implied, use the 1st of that month. If only a year is implied, use January 1st of that year.",
    "You output ONLY a JSON object — no prose, no markdown fences, no explanation.",
    "If the field is not clearly present, set value to null and provide a short uncertaintyReason.",
    "Never extract a field other than the one specified as pending. Other fields the user volunteered go in additionalFieldsDetected, NOT in value.",
  ].join(" ");
}

function buildUserPrompt(args: {
  userMessage: string;
  pendingField: AllFieldKey;
  lastAIMessage?: string;
}): string {
  const cfg = FIELD_INFO[args.pendingField];
  const otherKeys = (ALL_FIELDS as readonly string[]).filter(
    (k) => k !== args.pendingField,
  );

  // Enum-aware extraction: when the validator constrains the field to a
  // closed list of values (e.g. income_consistency = stable|variable|new),
  // the extractor MUST map free-text intent to the closest allowed value
  // — otherwise the validator rejects the extraction and the field never
  // lands. Without this hint the extractor returns the user's literal
  // phrasing ("fixed salary") which doesn't match the enum.
  const validationRule = getValidationRule(args.pendingField);
  const enumHint =
    validationRule.kind === "enum" && validationRule.values.length > 0
      ? `\nALLOWED VALUES (CLOSED ENUM): ${validationRule.values.join(" | ")}.\nMap the user's intent to the closest allowed value verbatim. If the user says "fixed salary" → "stable"; "varies / freelance" → "variable"; "just started / new gig" → "new". Never invent a value outside this list — return null if no value fits.`
      : "";

  const typeInstruction =
    cfg.type === "yes_no"
      ? `This is a yes/no field — value must be exactly "yes", "no", or null.`
      : cfg.type === "number"
        ? `This is a numeric field — value must be a JSON number (no units, no quotes), or null.`
        : `Extract value as a concise string. For amounts include the currency. For locations use "City, Country" format. Or null if not present.${enumHint}`;

  const additionalHint =
    `Also detect if the user mentioned any of these OTHER fields and list their keys (and ONLY their keys — never your pending field) in additionalFieldsDetected:\n` +
    otherKeys.join(", ");

  const conversation =
    args.lastAIMessage && args.lastAIMessage.trim().length > 0
      ? `Previous assistant message: "${args.lastAIMessage}"\n`
      : "";

  return [
    `Pending field key: "${args.pendingField}"`,
    `Pending field label: "${cfg.label}"`,
    `Pending field intent: ${cfg.intent}`,
    typeInstruction,
    "",
    conversation + `User's response: "${args.userMessage}"`,
    "",
    additionalHint,
    "",
    'Return ONLY this JSON shape (no other keys, no prose):',
    `{`,
    `  "value": <string|number|"yes"|"no"|null>,`,
    `  "confidence": "explicit" | "inferred" | "assumed",`,
    `  "additionalFieldsDetected": [<field_key strings from the list above>],`,
    `  "uncertaintyReason": "<short string>"  // only when value is null`,
    `}`,
  ].join("\n");
}

function tryParseJSON(raw: string): RawLLMShape | null {
  const trimmed = raw.trim();
  // Strict parse first.
  try {
    return JSON.parse(trimmed) as RawLLMShape;
  } catch {
    // Fallback: extract the first {...} balanced-ish substring.
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1)) as RawLLMShape;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function coerceValue(
  raw: unknown,
  type: "string" | "number" | "yes_no",
): string | number | "yes" | "no" | null {
  if (raw === null || raw === undefined) return null;

  if (type === "yes_no") {
    if (raw === "yes" || raw === "no") return raw;
    if (typeof raw === "boolean") return raw ? "yes" : "no";
    if (typeof raw === "string") {
      const lower = raw.trim().toLowerCase();
      if (lower === "yes" || lower === "true") return "yes";
      if (lower === "no" || lower === "false") return "no";
    }
    return null;
  }

  if (type === "number") {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const cleaned = raw.replace(/[, ]/g, "");
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
      // Fall back: pull the first numeric token out of phrases like
      // "48 months of consistent income" or "about 12 mo".
      const m = raw.match(/-?\d+(?:\.\d+)?/);
      if (m) {
        const parsed = Number(m[0]);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return null;
  }

  // string
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof raw === "number") return String(raw);
  return null;
}

function coerceConfidence(raw: unknown): ExtractionConfidence {
  if (typeof raw === "string" && VALID_CONFIDENCE.has(raw as ExtractionConfidence)) {
    return raw as ExtractionConfidence;
  }
  // Conservative default — anything we can't classify is "assumed".
  return "assumed";
}

function coerceAdditional(
  raw: unknown,
  pendingField: AllFieldKey,
): AllFieldKey[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<AllFieldKey>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (item === pendingField) continue; // never include the pending field
    if (ALL_FIELD_KEY_SET.has(item)) seen.add(item as AllFieldKey);
  }
  return [...seen];
}

/**
 * Extract a single field from a user message in a relocation interview.
 *
 * @param userMessage     The exact text the user typed.
 * @param pendingField    The field we're currently asking about.
 * @param lastAIMessage   Optional — the last assistant message (extra context).
 * @param options         Optional — { writer, profileId } to persist an audit row.
 */
export async function extractField(
  userMessage: string,
  pendingField: AllFieldKey,
  lastAIMessage?: string,
  options: ExtractFieldOptions = {},
): Promise<ExtractionResult> {
  const cfg = FIELD_INFO[pendingField];
  if (!cfg) {
    // Programmer error — pendingField wasn't in our registry.
    return {
      value: null,
      confidence: "assumed",
      rawText: userMessage,
      additionalFieldsDetected: [],
      uncertaintyReason: `unknown_field:${pendingField}`,
    };
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ userMessage, pendingField, lastAIMessage });

  let llmResponseText = "";
  let modelUsed: string | null = null;
  let wallClockMs = 0;
  let tokensUsed: number | null = null;
  let result: ExtractionResult;

  try {
    const llm = await callLLM("extractor", userPrompt, {
      system: systemPrompt,
    });
    llmResponseText = llm.content;
    modelUsed = llm.model_used;
    wallClockMs = llm.wall_clock_ms;
    tokensUsed = llm.tokens_used;

    const parsed = tryParseJSON(llm.content);
    if (parsed === null) {
      result = {
        value: null,
        confidence: "assumed",
        rawText: userMessage,
        additionalFieldsDetected: [],
        uncertaintyReason: "extractor_parse_failed",
      };
    } else {
      const value = coerceValue(parsed.value, cfg.type);
      const confidence = coerceConfidence(parsed.confidence);
      const additional = coerceAdditional(parsed.additionalFieldsDetected, pendingField);
      const uncertainty =
        value === null
          ? typeof parsed.uncertaintyReason === "string" && parsed.uncertaintyReason.trim().length > 0
            ? parsed.uncertaintyReason.trim()
            : "value_not_present"
          : undefined;
      result = {
        value,
        confidence: value === null ? "assumed" : confidence,
        rawText: userMessage,
        additionalFieldsDetected: additional,
        ...(uncertainty ? { uncertaintyReason: uncertainty } : {}),
      };
    }
  } catch (err) {
    // LLM call exhausted retries — degrade gracefully.
    // eslint-disable-next-line no-console
    console.error(
      `[extractor] LLM call failed for field "${pendingField}": ${
        err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      }`,
    );
    result = {
      value: null,
      confidence: "assumed",
      rawText: userMessage,
      additionalFieldsDetected: [],
      uncertaintyReason: "extractor_failed",
    };
  }

  // Audit-row write — best effort. If the writer throws, we surface the
  // error to the caller (so they can decide whether to retry the wider
  // operation), but only AFTER returning a fully-formed result is
  // computed. Keep audit failures from masking the extraction itself by
  // wrapping in try/catch and re-throwing only if explicitly requested
  // — for Wave 2.0 we let writeAuditRow's own retry handle transient
  // failures; if it still fails we let it throw upward.
  if (options.writer) {
    if (!options.profileId) {
      throw new Error(
        "[extractor] options.profileId is required when options.writer is provided (audit rows are RLS-keyed by profile_id).",
      );
    }
    await writeAuditRow(options.writer, {
      profile_id: options.profileId,
      agent_name: "extractor",
      model_used: modelUsed,
      phase: "extraction",
      field_or_output_key: pendingField,
      value: result.value,
      confidence: result.confidence,
      source_user_message: userMessage,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      response: llmResponseText,
      wall_clock_ms: wallClockMs,
      tokens_used: tokensUsed,
    });
  }

  return result;
}
