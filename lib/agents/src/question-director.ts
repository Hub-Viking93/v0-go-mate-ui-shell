// =============================================================
// @workspace/agents — Wave 2.2 Question Director agent
// =============================================================
// askNext() is the deterministic "what do we ask next?" planner.
// It reads the current profile + conversation history, asks the
// caller-injected getRequiredFields() what's still missing, picks
// ONE field, and uses Sonnet 4.6 to phrase a warm question with
// an animation cue for the mascot UI.
//
// PROMPT-vs-PROJECT NOTES:
//   * The spec says Question Director "calls the deterministic
//     getRequiredFields(profile) from lib/gomate/state-machine.ts".
//     lib/agents/ cannot import from artifacts/gomate/ (would
//     invert the workspace dep direction), so the caller injects
//     getRequiredFields via options. The chat route at the call
//     site wires artifacts/gomate's real implementation in.
//   * The spec's signature is (profile, conversationHistory,
//     additionalFieldsDetected?). Preserved exactly. An additive
//     4th `options` parameter carries the injected dependency
//     plus the optional LogWriter + profileId for the audit row.
//   * Fallback safety: if the LLM omits questionText, returns
//     malformed JSON, or the call throws, we substitute a
//     templated "Tell me about your <label>" question and log a
//     run-log row with status="failed" + the reason. The user
//     never sees a blank screen.
// =============================================================

import { FIELD_INFO, type AllFieldKey } from "./intake-fields.js";
import { getValidationRule } from "./validation-rules.js";
import { callLLM } from "./router.js";
import { writeAuditRow } from "./audit.js";
import type { LogWriter } from "./types.js";

export type AnimationCue =
  | "idle"
  | "nodding"
  | "smiling"
  | "tilting_curious"
  | "thinking"
  | "celebrating";

const VALID_ANIMATION_CUES: ReadonlySet<AnimationCue> = new Set([
  "idle",
  "nodding",
  "smiling",
  "tilting_curious",
  "thinking",
  "celebrating",
]);

const FALLBACK_ANIMATION: AnimationCue = "tilting_curious";

/**
 * Loose profile shape — structurally compatible with artifacts/gomate's
 * Profile (z.infer<typeof ProfileSchema>) but kept independent here
 * to avoid the artifact -> lib dep inversion.
 */
export type Profile = Partial<Record<AllFieldKey, string | number | null>>;

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface QuestionDirectorOutput {
  /** True iff getRequiredFields(profile) returned an empty list. */
  isOnboardingComplete: boolean;
  /** undefined when isOnboardingComplete=true. */
  nextFieldKey?: AllFieldKey;
  /** The warm phrasing produced by the LLM (or a fallback template). */
  questionText?: string;
  /** Mascot animation cue (one of 7 states). */
  animationCue?: AnimationCue;
  /** True when nextFieldKey came from additionalFieldsDetected (user volunteered it). */
  shouldClarifyAdditional?: boolean;
  /** Optional softer follow-up phrasing when confirming a volunteered detail. */
  clarificationQuestion?: string;
}

export interface AskNextOptions {
  /**
   * Required. Returns the list of remaining required fields for the
   * given profile. Wire artifacts/gomate's getRequiredFields() here
   * at the call site — Question Director never reaches into
   * artifacts/gomate directly.
   */
  getRequiredFields: (profile: Profile) => AllFieldKey[];
  /** Optional audit sink. */
  writer?: LogWriter;
  /** Required when writer is provided — RLS keys audit rows by profile_id. */
  profileId?: string;
  /** Caps how many tail messages from history are included in the prompt (default 8). */
  maxHistoryMessages?: number;
}

interface RawLLMShape {
  questionText?: unknown;
  animationCue?: unknown;
  clarificationQuestion?: unknown;
}

function tryParseJSON(raw: string): RawLLMShape | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as RawLLMShape;
  } catch {
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

function pickNextField(
  requiredFields: AllFieldKey[],
  additionalFieldsDetected: AllFieldKey[] | undefined,
): { key: AllFieldKey; isAdditional: boolean } {
  // Priority 1 — a field the user already volunteered that's still required.
  if (additionalFieldsDetected && additionalFieldsDetected.length > 0) {
    const requiredSet = new Set<AllFieldKey>(requiredFields);
    for (const k of additionalFieldsDetected) {
      if (requiredSet.has(k)) {
        return { key: k, isAdditional: true };
      }
    }
  }
  // Priority 2 — schema's logical ordering (FIELD_CONFIG insertion order,
  // preserved by getRequiredFields()).
  return { key: requiredFields[0]!, isAdditional: false };
}

function buildSystemPrompt(args: {
  requiredFields: AllFieldKey[];
  nextFieldKey: AllFieldKey;
  isAdditional: boolean;
  userName: string | null;
  destination: string | null;
}): string {
  const constrained = args.requiredFields.map((k) => ({
    key: k,
    label: FIELD_INFO[k].label,
    intent: FIELD_INFO[k].intent,
  }));

  const personalization = [
    args.userName ? `User's name: ${args.userName}.` : null,
    args.destination ? `Destination: ${args.destination}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  // EXACT constraint string the spec mandates (verbatim).
  const constraint =
    `You can ONLY ask about fields from this list: ${JSON.stringify(constrained)}. ` +
    `You CANNOT invent topics. You CANNOT ask about hobbies, opinions, personal preferences, or anything not on this list. ` +
    `If the list is empty, set isOnboardingComplete=true and do not ask another question. ` +
    `If a user has volunteered information about a field already on the list (additionalFieldsDetected), prioritize confirming that field next. ` +
    `You phrase the question warmly and conversationally; never robotically.`;

  const examples = [
    `Examples of how to phrase tricky fields:`,
    `- posting_or_secondment: "Quick clarification — is this a temporary assignment from your current employer, or are you taking a new role with a Swedish company?"`,
    `- a1_certificate_status: "For EU postings under 24 months, you'll typically apply for an A1 certificate to keep your home-country social security. Have you started that, or is it something we should help you understand?"`,
    `- pet_breed: "You mentioned bringing a dog — what's the breed? Some destinations have restrictions, so it's worth checking now."`,
  ].join("\n");

  const targetCfg = FIELD_INFO[args.nextFieldKey];
  // Enum-aware question phrasing: when the target field is a closed
  // enum (e.g. income_consistency = stable|variable|new), surface the
  // allowed values to the LLM so it asks a question that elicits one
  // of them — instead of creatively bridging to a different topic.
  const targetRule = getValidationRule(args.nextFieldKey);
  const enumLine =
    targetRule.kind === "enum" && targetRule.values.length > 0
      ? `\nThe answer MUST map to one of these closed values: ${targetRule.values.join(" | ")}. Phrase the question so the user's reply naturally lands on one of them. Don't ask a follow-up that targets a DIFFERENT field — stay on "${targetCfg.label}" until the user answers it.`
      : "";
  const targetLine =
    `The next field to ask about is "${args.nextFieldKey}" (label: "${targetCfg.label}", intent: "${targetCfg.intent}").` +
    (args.isAdditional
      ? ` The user already volunteered this; phrase it as a soft confirmation rather than a fresh question.`
      : ``) +
    enumLine;

  const outputLines = [
    `Return ONLY a JSON object — no prose, no markdown fences:`,
    `{`,
    `  "questionText": "<the warm, conversational question>",`,
    `  "animationCue": "idle" | "nodding" | "smiling" | "tilting_curious" | "thinking" | "celebrating"`,
  ];
  if (args.isAdditional) {
    outputLines.push(
      `  , "clarificationQuestion": "<optional softer follow-up phrasing if confirming a volunteered detail>"`,
    );
  }
  outputLines.push(`}`);
  const outputShape = outputLines.join("\n");

  return [
    `You are GoMate's Question Director. Your job is to ask the next onboarding question.`,
    `Tone: warm, calm, professional.`,
    personalization,
    constraint,
    examples,
    targetLine,
    outputShape,
  ]
    .filter((s) => s.length > 0)
    .join("\n\n");
}

function buildUserPrompt(args: {
  conversationHistory: Message[];
  maxHistoryMessages: number;
}): string {
  const tail = args.conversationHistory.slice(-args.maxHistoryMessages);
  if (tail.length === 0) {
    return `(No prior conversation — this is the start of the interview.) Generate the next question now.`;
  }
  const transcript = tail
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
  return `Conversation so far:\n${transcript}\n\nGenerate the next question now.`;
}

function templatedFallback(field: AllFieldKey): string {
  return `Tell me about your ${FIELD_INFO[field].label.toLowerCase()}.`;
}

/**
 * Plan the next onboarding question for the given profile.
 *
 * @param profile                  Current profile state.
 * @param conversationHistory      Prior interview turns (capped at last N).
 * @param additionalFieldsDetected Fields the user volunteered in their last
 *                                 message but we hadn't asked about. Prioritized
 *                                 over the schema's logical ordering.
 * @param options                  Required: { getRequiredFields }. Optional
 *                                 audit-row sink via { writer, profileId }.
 */
export async function askNext(
  profile: Profile,
  conversationHistory: Message[],
  additionalFieldsDetected?: AllFieldKey[],
  options?: AskNextOptions,
): Promise<QuestionDirectorOutput> {
  if (!options || typeof options.getRequiredFields !== "function") {
    throw new Error(
      "[question-director] askNext() requires options.getRequiredFields — wire artifacts/gomate's getRequiredFields() in at the call site.",
    );
  }

  const requiredFields = options.getRequiredFields(profile);
  // getRequiredFields returns every field whose `required` predicate is
  // true for this profile — it does NOT filter out already-filled
  // fields. The Question Director's job is to ask what's STILL needed,
  // so filter to fields whose current value is null / undefined / blank.
  // (Blank/whitespace strings shouldn't reach here in production — the
  // Wave 2.1 validator rejects empty/whitespace at write time, so the
  // length-0 branch below is defensive belt-and-suspenders against
  // legacy rows or bypassed writes.)
  const skippedFieldsRaw = (profile as Record<string, unknown>)["_skipped_fields"];
  const skippedFieldSet = new Set<AllFieldKey>(
    Array.isArray(skippedFieldsRaw)
      ? (skippedFieldsRaw.filter((k): k is AllFieldKey => typeof k === "string") as AllFieldKey[])
      : [],
  );
  const stillNeeded = requiredFields.filter((k) => {
    if (skippedFieldSet.has(k)) return false;
    const v = profile[k];
    if (v === null || v === undefined) return true;
    if (typeof v === "string" && v.trim().length === 0) return true;
    return false;
  });
  if (stillNeeded.length === 0) {
    return { isOnboardingComplete: true };
  }

  // Hard ceiling — safety net only. We aim to collect EVERY required
  // field a Relocation Consultant would cover (often 25-35 fields for
  // family + work + pets + healthcare cascades). The ceiling is a
  // safety net against runaway interviews where a user genuinely
  // disengages — it must NOT trip while a cooperative user is still
  // answering.
  //
  // Previously this fired at HARD_CEILING_FIELDS_ASKED = 8 with
  // MIN_VIABLE_FILLED = 6, which guaranteed onboarding ended after
  // ~8 fields and silently truncated the profile (visa research then
  // ran on a half-built picture). Removed the fields-asked ceiling
  // entirely; the only sensible early-exit signal is genuine user
  // disengagement, which is already captured by `_skipped_fields`
  // (those drop out of stillNeeded above) and by the turn ceiling
  // below kicking in only after ~50 turns of back-and-forth.
  const assistantTurnCount = conversationHistory.filter(
    (m) => m.role === "assistant",
  ).length;
  const filledRequiredCount = requiredFields.length - stillNeeded.length;
  const HARD_CEILING_TURNS = 60;
  // Raised from 6 → 12 so a runaway/disengaged interview cannot bail
  // out with a half-built profile that downstream research agents
  // cannot meaningfully act on. With 12 fields we're guaranteed at
  // least name + citizenship + destination + target_city + purpose
  // + visa_role + duration + timeline + moving_alone + savings +
  // budget + one purpose-specific field.
  const MIN_VIABLE_FILLED = 15;
  if (
    assistantTurnCount >= HARD_CEILING_TURNS &&
    filledRequiredCount >= MIN_VIABLE_FILLED
  ) {
    return { isOnboardingComplete: true };
  }

  const { key: nextFieldKey, isAdditional } = pickNextField(
    stillNeeded,
    additionalFieldsDetected,
  );

  const userName =
    typeof profile.name === "string" && profile.name.trim().length > 0
      ? profile.name
      : null;
  const destination =
    typeof profile.destination === "string" &&
    profile.destination.trim().length > 0
      ? profile.destination
      : null;

  const systemPrompt = buildSystemPrompt({
    requiredFields: stillNeeded,
    nextFieldKey,
    isAdditional,
    userName,
    destination,
  });
  const maxHistoryMessages = options.maxHistoryMessages ?? 8;
  const userPrompt = buildUserPrompt({
    conversationHistory,
    maxHistoryMessages,
  });

  let llmResponseText = "";
  let modelUsed: string | null = null;
  let wallClockMs = 0;
  let tokensUsed: number | null = null;
  let questionText: string | null = null;
  let animationCue: AnimationCue = FALLBACK_ANIMATION;
  let clarificationQuestion: string | undefined;
  let usedFallback = false;
  let fallbackReason: string | null = null;

  try {
    const llm = await callLLM("question_director", userPrompt, {
      system: systemPrompt,
    });
    llmResponseText = llm.content;
    modelUsed = llm.model_used;
    wallClockMs = llm.wall_clock_ms;
    tokensUsed = llm.tokens_used;

    const parsed = tryParseJSON(llm.content);
    if (parsed === null) {
      usedFallback = true;
      fallbackReason = "question_director_parse_failed";
    } else {
      const qt =
        typeof parsed.questionText === "string"
          ? parsed.questionText.trim()
          : "";
      if (qt.length === 0) {
        usedFallback = true;
        fallbackReason = "question_director_empty_question";
      } else {
        questionText = qt;
      }
      if (
        typeof parsed.animationCue === "string" &&
        VALID_ANIMATION_CUES.has(parsed.animationCue as AnimationCue)
      ) {
        animationCue = parsed.animationCue as AnimationCue;
      }
      if (
        typeof parsed.clarificationQuestion === "string" &&
        parsed.clarificationQuestion.trim().length > 0
      ) {
        clarificationQuestion = parsed.clarificationQuestion.trim();
      }
    }
  } catch (err) {
    usedFallback = true;
    const msg = err instanceof Error ? err.message : "unknown";
    fallbackReason = `question_director_llm_failed:${msg}`;
  }

  if (usedFallback) {
    questionText = templatedFallback(nextFieldKey);
  }
  const finalQuestionText = questionText ?? templatedFallback(nextFieldKey);

  // Audit-row write — best effort, throws upward only on writer failure.
  if (options.writer) {
    if (!options.profileId) {
      throw new Error(
        "[question-director] options.profileId is required when options.writer is provided (audit rows are RLS-keyed by profile_id).",
      );
    }
    await writeAuditRow(options.writer, {
      profile_id: options.profileId,
      agent_name: "question_director",
      model_used: modelUsed,
      phase: "extraction",
      field_or_output_key: nextFieldKey,
      value: {
        questionText: finalQuestionText,
        animationCue,
        clarificationQuestion: clarificationQuestion ?? null,
        isAdditional,
      },
      confidence: usedFallback ? "fallback" : "explicit",
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      response: llmResponseText,
      wall_clock_ms: wallClockMs,
      tokens_used: tokensUsed,
    });
    if (usedFallback) {
      // Best-effort run-log entry. Don't let a logging failure surface.
      try {
        await options.writer.insertRunLog({
          profile_id: options.profileId,
          agent_name: "question_director",
          phase: "extraction",
          status: "failed",
          error_message: fallbackReason ?? "unknown_fallback",
          wall_clock_ms: wallClockMs,
          tokens_used: tokensUsed,
        });
      } catch {
        // swallow — audit row already captured the issue
      }
    }
  }

  return {
    isOnboardingComplete: false,
    nextFieldKey,
    questionText: finalQuestionText,
    animationCue,
    shouldClarifyAdditional: isAdditional,
    ...(clarificationQuestion ? { clarificationQuestion } : {}),
  };
}
