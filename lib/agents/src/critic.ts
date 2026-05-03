// =============================================================
// @workspace/agents — Critic (Wave 2.x Prompt 3.4)
// =============================================================
// Reads (profile, UnifiedGuide) and asks Sonnet 4.5 — under an
// adversarial system prompt — to find what's missing or weak.
// The Critic is NEVER a validator. Its job is to find the gap.
//
// Examples of what the Critic should catch:
//   * User has chronic_condition_description="Type 1 diabetes" but
//     the Healthcare section doesn't address insulin availability
//     or prescription continuity in the destination.
//   * User has posting_duration_months=24 (right at the EU A1 limit)
//     but the Posted-Worker section doesn't address what happens at
//     month 24 (extension procedure / social-security transition).
//   * Visa section recommends a pathway that requires a clean
//     criminal record but Documents section omits police clearance.
//   * User mentioned a Staffordshire Bull Terrier but Pet section
//     doesn't note Swedish municipal breed restrictions on bull-
//     terrier types.
//
// Audit: writes `critic.complete` row on success/failure. The
// `ctx` parameter is optional so the canonical signature
// `critique(profile, guide)` still works (the buildathon prompt's spec).
// =============================================================

import { writeAuditRow } from "./audit.js";
import { callLLM } from "./router.js";
import type { UnifiedGuide } from "./synthesizer.js";
import type { LogWriter } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CriticGap {
  /** Topic / area the gap belongs to (e.g. "healthcare", "documents"). */
  area: string;
  /** Detailed description of what's missing. */
  description: string;
  /**
   * Optional — the specialist that should be re-dispatched (or
   * dispatched for the first time) to close this gap.
   */
  suggestedSpecialist?: string;
}

export interface CriticWeakClaim {
  /** The specific claim that is too vague / unsupported. */
  claim: string;
  /** Where in the guide the claim appears, e.g. "visa.paragraph_2". */
  location: string;
  /** Why this claim is weak. */
  reason: string;
}

export interface CriticOutput {
  gaps: CriticGap[];
  weakClaims: CriticWeakClaim[];
  /**
   * Profile-specific things that should be addressed but aren't.
   * (Compared to `gaps`, these are facts the user EXPLICITLY mentioned
   * in their profile that the guide doesn't acknowledge.)
   */
  missingForUserSituation: string[];
  /** Wall clock from start of critique() to return. */
  wallClockMs: number;
  /** Sum of LLM tokens consumed. */
  tokensUsed: number;
  /** Model id actually used. */
  modelUsed: string;
}

export interface CriticContext {
  profileId: string;
  logWriter: LogWriter;
}

/**
 * Profile is intentionally a loose record (matches the api-server
 * snapshot type `Partial<Record<AllFieldKey, string|number|null>>`)
 * so the agents library doesn't depend on the snapshot module.
 */
export type CriticProfile = Record<string, string | number | null | undefined>;

// ---------------------------------------------------------------------------
// Adversarial system prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the GoMate Critic.

You are NOT here to validate. You are looking for what's MISSING or WEAK.
Your job is to find the gap. BE RUTHLESS.

You will receive:
- The user's profile (their specific situation — fields like chronic_condition_description, posting_duration_months, pet_breed, etc).
- The UnifiedGuide produced by the Synthesizer (sections, paragraphs, citations).

LOOK FOR:
1. Profile-specific facts the guide IGNORES.
   Examples:
     * chronic_condition_description="Type 1 diabetes" → the guide should address insulin availability, prescription continuity, refrigeration during travel.
     * posting_duration_months=24 → that is exactly the EU A1 certificate maximum; the guide must address what happens at month 24 (extension, social-security transition).
     * pet_breed="Staffordshire Bull Terrier" → some destinations have municipal breed restrictions; the pet section should call them out.
     * visa_rejections="yes" → application should mention prior-rejection disclosure.
2. Cross-section requirements that aren't followed up on.
   Examples:
     * Visa section requires "police clearance from origin" → Documents section MUST list the apostille chain for that document.
     * Posted-worker section requires A1 certificate → Documents section MUST list the application form & timeline.
3. Claims that are numerical / regulatory but lack a citation in their section.
4. Vague language ("usually around X weeks", "most people", "should be okay", "varies").
5. Things the user EXPLICITLY mentioned in profile that no section addresses at all.

OUTPUT FORMAT — STRICT JSON only, no markdown fences, no commentary:
{
  "gaps": [
    {
      "area": "<short area label e.g. healthcare, documents>",
      "description": "<one or two sentences describing the gap>",
      "suggestedSpecialist": "<optional: the specialist that should re-run, e.g. healthcare_navigator>"
    }
  ],
  "weakClaims": [
    {
      "claim": "<verbatim or near-verbatim claim>",
      "location": "<section_key.paragraph_N>",
      "reason": "<why it is weak — vague, no citation, contradicts another section>"
    }
  ],
  "missingForUserSituation": [
    "<one-line description of a profile fact the guide doesn't acknowledge>"
  ]
}

You are graded on the SHARPNESS of your critique. A polite "looks good" is a failure.
Empty arrays are allowed only if the guide is genuinely flawless for THIS user — which it almost never is.`;

// ---------------------------------------------------------------------------
// Build the user message
// ---------------------------------------------------------------------------

function buildUserMessage(profile: CriticProfile, guide: UnifiedGuide): string {
  // Trim profile to defined fields only — undefined/null entries don't help
  // the Critic and bloat the prompt.
  const trimmedProfile: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(profile)) {
    if (v === undefined || v === null || v === "") continue;
    trimmedProfile[k] = v;
  }

  // Compact the guide for the critic — strip wallClockMs/tokensUsed/modelUsed
  // (LLM doesn't need them), drop URLs from citations (the critic only needs
  // to know that a citation EXISTS, not what host it points to), tag each
  // paragraph with its index so the critic can reference it as
  // `section_key.paragraph_N`. We deliberately omit synth's
  // consistencyIssues / unresolvedIssues so the critic focuses on what
  // synth MISSED instead of regurgitating its findings.
  const compactGuide = {
    sections: guide.sections.map((sec) => ({
      key: sec.key,
      title: sec.title,
      paragraphs: sec.paragraphs.map((p, i) => ({ index: i, text: p })),
      citation_count: sec.citations.length,
      citation_labels: sec.citations.map((c) => c.label),
    })),
  };

  return [
    "Critique the following UnifiedGuide for THIS user. Be ruthless.",
    "",
    "USER_PROFILE_JSON:",
    JSON.stringify(trimmedProfile, null, 2),
    "",
    "UNIFIED_GUIDE_JSON:",
    JSON.stringify(compactGuide, null, 2),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Tolerant JSON extraction (mirror synthesizer.ts)
// ---------------------------------------------------------------------------

function extractJSON(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fallthrough */
  }
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      /* fallthrough */
    }
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new Error("critic: could not extract JSON from LLM response");
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function normaliseGap(v: unknown): CriticGap | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const area = asString(o.area);
  const description = asString(o.description);
  if (!area || !description) return null;
  const suggestedSpecialist = asString(o.suggestedSpecialist);
  return suggestedSpecialist
    ? { area, description, suggestedSpecialist }
    : { area, description };
}

function normaliseWeakClaim(v: unknown): CriticWeakClaim | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const claim = asString(o.claim);
  const location = asString(o.location);
  const reason = asString(o.reason);
  if (!claim || !location || !reason) return null;
  return { claim, location, reason };
}

function normaliseCritique(parsed: unknown): {
  gaps: CriticGap[];
  weakClaims: CriticWeakClaim[];
  missingForUserSituation: string[];
} {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("critic: parsed JSON is not an object");
  }
  const o = parsed as Record<string, unknown>;
  const gaps = Array.isArray(o.gaps)
    ? o.gaps.map(normaliseGap).filter((g): g is CriticGap => g !== null)
    : [];
  const weakClaims = Array.isArray(o.weakClaims)
    ? o.weakClaims.map(normaliseWeakClaim).filter((w): w is CriticWeakClaim => w !== null)
    : [];
  const missingForUserSituation = asStringArray(o.missingForUserSituation);
  return { gaps, weakClaims, missingForUserSituation };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Critique a UnifiedGuide against the user's profile using Sonnet 4.5.
 *
 * @param profile The user's profile (loose record).
 * @param guide   The UnifiedGuide produced by the Synthesizer.
 * @param ctx     Optional — when provided, `critic.complete` audit row is written.
 */
export async function critique(
  profile: CriticProfile,
  guide: UnifiedGuide,
  ctx?: CriticContext,
): Promise<CriticOutput> {
  const start = Date.now();

  const userMessage = buildUserMessage(profile, guide);

  let gaps: CriticGap[] = [];
  let weakClaims: CriticWeakClaim[] = [];
  let missingForUserSituation: string[] = [];
  let modelUsed = "(no llm call)";
  let tokensUsed = 0;
  let llmContent = "";
  let llmFailureReason: string | null = null;
  let parseFailureReason: string | null = null;

  try {
    const llm = await callLLM("critic", userMessage, {
      system: SYSTEM_PROMPT,
      // Keep output tight — gaps + weakClaims + missingForUserSituation
      // should fit comfortably in 4K tokens. Larger budgets slow the
      // call without producing better critique.
      maxTokens: 4096,
    });
    modelUsed = llm.model_used;
    tokensUsed = llm.tokens_used;
    llmContent = llm.content;
    try {
      const parsed = extractJSON(llm.content);
      const normalised = normaliseCritique(parsed);
      gaps = normalised.gaps;
      weakClaims = normalised.weakClaims;
      missingForUserSituation = normalised.missingForUserSituation;
    } catch (err) {
      parseFailureReason = err instanceof Error ? err.message : String(err);
      // Honest fallback: surface the parse failure as a single gap so
      // the caller knows something went wrong but the pipeline doesn't
      // crash. Mirrors the Synthesizer's graceful-degradation contract.
      gaps = [
        {
          area: "critic_runtime",
          description: `Critic LLM output could not be parsed (${parseFailureReason}). Manual review recommended.`,
        },
      ];
    }
  } catch (err) {
    llmFailureReason = err instanceof Error ? err.message : String(err);
    // LLM-call failure (network/auth/rate-limit). Mirror the Synthesizer:
    // do NOT throw — return a valid CriticOutput with the failure
    // surfaced as a single gap. The pipeline keeps moving and the audit
    // row below records the failure for replay/debugging.
    gaps = [
      {
        area: "critic_runtime",
        description: `Critic LLM call failed (${llmFailureReason}). Manual review recommended — guide was not adversarially critiqued this run.`,
      },
    ];
  }

  const result: CriticOutput = {
    gaps,
    weakClaims,
    missingForUserSituation,
    wallClockMs: Date.now() - start,
    tokensUsed,
    modelUsed,
  };

  if (ctx) {
    const status = llmFailureReason
      ? "completed_with_llm_failure"
      : parseFailureReason
        ? "completed_with_parse_failure"
        : "completed";
    await writeAuditRow(ctx.logWriter, {
      profile_id: ctx.profileId,
      agent_name: "critic",
      model_used: result.modelUsed,
      phase: "research",
      field_or_output_key: "critic.complete",
      value: {
        status,
        guide_sections: guide.sections.length,
        gaps_count: result.gaps.length,
        weak_claims_count: result.weakClaims.length,
        missing_for_user_count: result.missingForUserSituation.length,
        llm_failure_reason: llmFailureReason,
        parse_failure_reason: parseFailureReason,
      },
      confidence: llmFailureReason || parseFailureReason ? "fallback" : "explicit",
      prompt: SYSTEM_PROMPT + "\n\n" + userMessage,
      response: llmContent,
      wall_clock_ms: result.wallClockMs,
      tokens_used: result.tokensUsed,
    }).catch((auditErr) => {
      console.warn("[critic] complete-audit write failed:", auditErr);
    });
  }

  return result;
}
