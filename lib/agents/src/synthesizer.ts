// =============================================================
// @workspace/agents — Synthesizer (Wave 2.x Prompt 3.4)
// =============================================================
// Reads every specialist's SpecialistOutput and returns a single
// UnifiedGuide. The work splits in two:
//
//   1. ANALYSIS (LLM-driven, routed per AGENT_MODEL_ROUTING.synthesizer
//      — Sonnet 4.5; the buildathon prompt asked for Opus 4.7 but per
//      Wave 2.x Prompt 3.4 follow-up we override to Sonnet for ~3-4×
//      faster wall-clock since the work is identify-and-flag, not
//      rewrite-prose). The LLM is asked to compare paragraphs across
//      specialists for:
//        * Deadline alignment (visa weeks vs. posted-worker timeline).
//        * Cost alignment (cost specialist vs. tax specialist).
//        * Document-chain consistency (visa requirements vs. documents).
//        * Vocabulary consistency (personnummer not "Swedish ID number").
//        * Duplication across sections.
//        * Numeric/regulatory claims missing citations.
//      Output: { consistencyIssues[], unresolvedIssues[] }.
//
//   2. ASSEMBLY (deterministic, in this file). One section per input
//      specialist, paragraphs and citations passed through VERBATIM
//      from the specialist outputs. This guarantees citations are
//      never fabricated and avoids burning ~8K output tokens on
//      regenerating prose the specialists already wrote.
//
// Trade-off: the LLM does NOT silently rewrite prose to apply the
// consistencyIssues it finds — those fixes are surfaced to the user
// as resolved-issue notes, but the underlying paragraphs are unchanged.
// Future work (TODO[wave-2.x-rewrite-pass]) could add a per-section
// rewrite pass for any issue the LLM flagged as resolved.
//
// Audit: writes `synthesizer.complete` row on success/failure. The
// `ctx` parameter is optional so the canonical signature
// `synthesize(outputs)` still works (the buildathon prompt's spec).
// =============================================================

import { writeAuditRow } from "./audit.js";
import { callLLM } from "./router.js";
import type { Citation, SpecialistOutput } from "./specialists/types.js";
import type { LogWriter } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SynthesizerSection {
  /** Canonical section key — see SECTION_MAP. */
  key: string;
  /** Human-readable title for the UI. */
  title: string;
  /** One paragraph per element. UI renders as <p>s. */
  paragraphs: string[];
  /** Citations attached to this section's claims. */
  citations: Citation[];
}

export interface UnifiedGuide {
  sections: SynthesizerSection[];
  /**
   * Cross-section issues DETECTED by the Synthesizer that have a clear
   * fix the UI/user can apply (vocabulary normalisation, redundant
   * explanation, missing cross-reference).
   *
   * IMPORTANT: under the current analysis-only design these are
   * **detected, not auto-applied** — the section paragraphs are still
   * the verbatim specialist prose. A future deterministic rewrite pass
   * (TODO[wave-2.x-rewrite-pass]) could apply these fixes in-place;
   * until then the UI should surface them to the user as advisories.
   */
  consistencyIssues: string[];
  /** Contradictions the Synthesizer could NOT resolve — needs human/critic review. */
  unresolvedIssues: string[];
  /** Wall clock from start of synthesize() to return. */
  wallClockMs: number;
  /** Sum of LLM tokens consumed by the synthesis call. */
  tokensUsed: number;
  /** Model id actually used. */
  modelUsed: string;
}

export interface SynthesizerInput {
  /** Specialist name — matches the coordinator panel key. */
  name: string;
  output: SpecialistOutput;
}

export interface SynthesizerContext {
  profileId: string;
  logWriter: LogWriter;
}

// ---------------------------------------------------------------------------
// Specialist → canonical section mapping
// ---------------------------------------------------------------------------
// One section per specialist. The Synthesizer is told to keep this 1:1
// mapping (don't invent sections, don't drop sections); but it MAY merge
// content within a section (e.g. dedupe overlapping paragraphs).
//
// Specialists not in this map (e.g. a future specialist) fall back to
// `key: <name>, title: <name with underscores → spaces, title-cased>`.

const SECTION_MAP: Record<string, { key: string; title: string }> = {
  visa_specialist: { key: "visa", title: "Visa & Immigration" },
  tax_strategist: { key: "tax", title: "Tax Strategy" },
  cost_specialist: { key: "budget", title: "Cost & Budget" },
  housing_specialist: { key: "housing", title: "Housing" },
  cultural_adapter: { key: "culture", title: "Cultural Adaptation" },
  documents_specialist: { key: "documents", title: "Documents & Apostille" },
  schools_specialist: { key: "education", title: "Schools & Education" },
  healthcare_navigator: { key: "healthcare", title: "Healthcare" },
  banking_helper: { key: "banking", title: "Banking" },
  pet_specialist: { key: "pets", title: "Pet Import" },
  posted_worker_specialist: { key: "posted_worker", title: "EU Posted Worker (A1)" },
  digital_nomad_compliance: { key: "digital_nomad", title: "Digital Nomad Compliance" },
  job_compliance_specialist: { key: "job_compliance", title: "Work Authorization" },
  family_reunion_specialist: { key: "family_reunion", title: "Family Reunion Pathway" },
  departure_tax_specialist: { key: "departure_tax", title: "Departure / Exit Tax" },
  vehicle_import_specialist: { key: "vehicle_import", title: "Vehicle Import" },
  property_purchase_specialist: { key: "property_purchase", title: "Property Purchase" },
  trailing_spouse_career_specialist: { key: "spouse_career", title: "Spouse Career Continuity" },
  pension_continuity_specialist: { key: "pension", title: "Pension Continuity" },
};

function defaultSectionFor(name: string): { key: string; title: string } {
  const mapped = SECTION_MAP[name];
  if (mapped) return mapped;
  const title = name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { key: name, title };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the GoMate Synthesizer.

You will be given N independent specialist outputs about a single user's
relocation plan. Each output is one section's worth of prose + citations.

YOUR JOB: scan ALL sections side-by-side and return a list of
cross-section issues. You do NOT rewrite the prose. You do NOT pick
a single recommendation when sources disagree. You report what you find.

CHECKS TO RUN (in priority order):
1. Deadline alignment — visa processing weeks vs. timeline references in posted-worker, schools, banking, etc. If two sections imply different durations for the same step, flag it.
2. Cost alignment — cost specialist's monthly budget vs. tax specialist's net-income / take-home figures. Flag math that doesn't add up.
3. Document-chain consistency — if the visa section requires "police clearance from origin", the documents section MUST list the apostille chain for that exact document. Flag missing follow-up.
4. Vocabulary consistency — flag mixed terminology like "personnummer" vs "Swedish ID number", or "A1 certificate" vs "A1 form" / "A1 paperwork".
5. Duplication — if two sections explain the same concept (e.g. personnummer registration), flag the one that's redundant.
6. Citation gaps — flag any numeric/regulatory claim in a section's paragraphs that lacks a citation in that section.

CLASSIFY EACH FINDING:
- "consistencyIssues" — issues that have a clear fix the user/UI can apply
  (vocabulary normalisation, redundant explanation, missing cross-reference).
- "unresolvedIssues" — genuine contradictions where you CANNOT tell which
  source is correct (e.g. visa section says 8 weeks, posted-worker says 4
  weeks for what looks like the same step). DO NOT pick a side.

When referring to a section in your finding text, use its key
(e.g. "visa", "documents", "tax").

OUTPUT FORMAT — STRICT JSON only, no markdown fences, no commentary:
{
  "consistencyIssues": ["<one-line description>", …],
  "unresolvedIssues":  ["<one-line description>", …]
}

If no issues found, return both arrays empty: {"consistencyIssues":[],"unresolvedIssues":[]}.
A polite "looks good" with no findings is acceptable ONLY if you genuinely
checked all 6 categories above and found nothing.`;

/**
 * Build the LLM payload — one compact entry per specialist with just
 * the section key/title, paragraphs (verbatim), and citation labels +
 * scraped flags (no URLs — the LLM doesn't need them for analysis,
 * and keeping the payload small is what makes Sonnet finish in 15-25s
 * instead of 90s+).
 */
function buildUserMessage(specialistOutputs: SynthesizerInput[]): string {
  const payload = specialistOutputs.map(({ name, output }) => {
    const section = defaultSectionFor(name);
    return {
      key: section.key,
      title: section.title,
      from_specialist: name,
      quality: output.quality,
      paragraphs: output.contentParagraphs,
      citation_labels: output.citations.map((c) => ({
        label: c.label,
        scraped: c.scraped,
      })),
    };
  });

  return [
    `Here are ${specialistOutputs.length} specialist sections to analyse for cross-section consistency.`,
    "",
    "Apply the 6 checks from the system prompt and return the JSON.",
    "",
    "SECTIONS_JSON:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Tolerant JSON extraction
// ---------------------------------------------------------------------------

function extractJSON(raw: string): unknown {
  const trimmed = raw.trim();
  // 1. Try as-is.
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fallthrough */
  }
  // 2. Strip ```json … ``` or ``` … ``` fences.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      /* fallthrough */
    }
  }
  // 3. First-{ to last-} slice.
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const slice = trimmed.slice(first, last + 1);
    return JSON.parse(slice);
  }
  throw new Error("synthesizer: could not extract JSON from LLM response");
}

// ---------------------------------------------------------------------------
// Validate + normalise the parsed JSON
// ---------------------------------------------------------------------------

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function normaliseFindings(parsed: unknown): {
  consistencyIssues: string[];
  unresolvedIssues: string[];
} {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("synthesizer: parsed JSON is not an object");
  }
  const o = parsed as Record<string, unknown>;
  return {
    consistencyIssues: asStringArray(o.consistencyIssues),
    unresolvedIssues: asStringArray(o.unresolvedIssues),
  };
}

// ---------------------------------------------------------------------------
// Build the deterministic UnifiedGuide assembly from inputs.
// One section per input specialist, paragraphs + citations passthrough.
// ---------------------------------------------------------------------------

function assembleSections(
  specialistOutputs: SynthesizerInput[],
): SynthesizerSection[] {
  return specialistOutputs.map(({ name, output }) => {
    const sec = defaultSectionFor(name);
    return {
      key: sec.key,
      title: sec.title,
      paragraphs: output.contentParagraphs,
      // Citations come straight from the specialist — already validated
      // upstream against the official-sources whitelist or scraped this run.
      // Synthesizer never sees URLs in its prompt → cannot fabricate.
      citations: output.citations.map((c) => ({ ...c })),
    };
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Synthesise N specialist outputs into a single UnifiedGuide.
 *
 * Two-phase: the LLM analyses cross-section consistency (Sonnet 4.5,
 * see header note on the Opus 4.7 → Sonnet override); paragraphs and
 * citations are assembled deterministically from the inputs (passthrough,
 * no rewrite). If the LLM call fails, we still return a valid guide —
 * the failure is surfaced in `unresolvedIssues` so the critic can see it.
 *
 * @param specialistOutputs each with `{ name, output }`.
 * @param ctx optional — when provided, `synthesizer.complete` audit row is written.
 */
export async function synthesize(
  specialistOutputs: SynthesizerInput[],
  ctx?: SynthesizerContext,
): Promise<UnifiedGuide> {
  const start = Date.now();

  if (specialistOutputs.length === 0) {
    throw new Error("synthesizer: specialistOutputs is empty");
  }

  const sections = assembleSections(specialistOutputs);
  const userMessage = buildUserMessage(specialistOutputs);

  let consistencyIssues: string[] = [];
  let unresolvedIssues: string[] = [];
  let modelUsed = "(no llm call)";
  let tokensUsed = 0;
  let llmContent = "";
  let llmFailureReason: string | null = null;

  try {
    const llm = await callLLM("synthesizer", userMessage, {
      system: SYSTEM_PROMPT,
      // Output is just two short string arrays — 2K is plenty.
      maxTokens: 2048,
    });
    modelUsed = llm.model_used;
    tokensUsed = llm.tokens_used;
    llmContent = llm.content;
    try {
      const parsed = extractJSON(llm.content);
      const findings = normaliseFindings(parsed);
      consistencyIssues = findings.consistencyIssues;
      unresolvedIssues = findings.unresolvedIssues;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      unresolvedIssues = [
        `Synthesizer LLM output could not be parsed (${reason}). Manual cross-section review recommended.`,
      ];
    }
  } catch (err) {
    llmFailureReason = err instanceof Error ? err.message : String(err);
    unresolvedIssues = [
      `Synthesizer LLM call failed (${llmFailureReason}). Manual cross-section review recommended — sections passed through verbatim.`,
    ];
  }

  const guide: UnifiedGuide = {
    sections,
    consistencyIssues,
    unresolvedIssues,
    wallClockMs: Date.now() - start,
    tokensUsed,
    modelUsed,
  };

  // Audit row on completion — covers both success and llm-failure paths
  // (we still produced a valid guide either way).
  if (ctx) {
    const totalCitations = guide.sections.reduce((s, sec) => s + sec.citations.length, 0);
    await writeAuditRow(ctx.logWriter, {
      profile_id: ctx.profileId,
      agent_name: "synthesizer",
      model_used: guide.modelUsed,
      phase: "research",
      field_or_output_key: "synthesizer.complete",
      value: {
        status: llmFailureReason ? "completed_with_llm_failure" : "completed",
        input_specialists: specialistOutputs.length,
        sections_count: guide.sections.length,
        consistency_issues: guide.consistencyIssues.length,
        unresolved_issues: guide.unresolvedIssues.length,
        total_citations: totalCitations,
        llm_failure_reason: llmFailureReason,
      },
      confidence: llmFailureReason ? "fallback" : "explicit",
      prompt: SYSTEM_PROMPT + "\n\n" + userMessage,
      response: llmContent,
      wall_clock_ms: guide.wallClockMs,
      tokens_used: guide.tokensUsed,
    }).catch((auditErr) => {
      console.warn("[synthesizer] complete-audit write failed:", auditErr);
    });
  }

  return guide;
}
