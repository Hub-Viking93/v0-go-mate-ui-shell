// =============================================================
// @workspace/agents — runSpecialist (base helper)
// =============================================================
// Wraps a specialist's body in the audit + abort + per-specialist
// budget contract every always-run specialist must obey:
//
//   1. Write an audit row at start (phase="research", value={status:"started"}).
//   2. Compose a child AbortSignal that aborts on EITHER the
//      external master signal OR the per-specialist 25s budget.
//   3. Call the body inside a try/catch.
//   4. Write an audit row at completion / failure / abort with
//      quality, sourceCount, model, tokens, wallClock and the
//      primary citation URL (first scraped, else first whitelist).
//   5. On failure return a quality="fallback" SpecialistOutput so
//      callers using Promise.allSettled never see a thrown error
//      from this layer.
// =============================================================

import { writeAuditRow } from "../audit.js";
import type { AgentName } from "../types.js";
import type {
  SpecialistContext,
  SpecialistOutput,
  SpecialistProfile,
  SpecialistQuality,
} from "./types.js";

/** Per-specialist hard budget. Master signal may abort sooner. */
export const SPECIALIST_BUDGET_MS = 25_000;

export interface RunSpecialistArgs {
  /** Specialist label — matches coordinator panel key (snake_case). */
  specialist: string;
  /** AgentName for routing (visa_specialist, tax_strategist, etc). */
  agentName: AgentName;
  /** Profile slice — passed straight to body. */
  profile: SpecialistProfile;
  /** Run context (logWriter + master signal + profileId). */
  ctx: SpecialistContext;
  /** Body — receives a child signal honoring both master + budget. */
  body: (profile: SpecialistProfile, ctx: SpecialistContext, signal: AbortSignal) => Promise<SpecialistOutput>;
}

function quality(q: SpecialistQuality): "full" | "partial" | "fallback" {
  return q;
}

/**
 * Compose two abort signals. The returned signal aborts when EITHER
 * input aborts. Returns the controller so the caller can clear the
 * timeout when done.
 */
function composeAbort(external: AbortSignal | undefined, budgetMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("specialist-budget-exceeded")), budgetMs);
  let onExternalAbort: (() => void) | null = null;

  if (external) {
    if (external.aborted) {
      controller.abort(new Error("master-signal-aborted"));
    } else {
      onExternalAbort = () => controller.abort(new Error("master-signal-aborted"));
      external.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (external && onExternalAbort) external.removeEventListener("abort", onExternalAbort);
    },
  };
}

/** Build the audit-row `value` payload — kept compact (no scraped content). */
function summaryValue(output: Pick<SpecialistOutput, "specialist" | "quality" | "sourceUrlsUsed" | "citations" | "fallbackReason" | "modelUsed" | "tokensUsed">) {
  return {
    specialist: output.specialist,
    status: output.quality === "fallback" ? "failed" : "completed",
    quality: output.quality,
    source_count: output.sourceUrlsUsed.length,
    citation_count: output.citations.length,
    model_used: output.modelUsed,
    tokens_used: output.tokensUsed,
    fallback_reason: output.fallbackReason ?? null,
  };
}

export async function runSpecialist(args: RunSpecialistArgs): Promise<SpecialistOutput> {
  const { specialist, agentName, profile, ctx, body } = args;
  const start = Date.now();
  const retrievedAtStart = new Date().toISOString();

  // ---- audit: started -------------------------------------------------
  // We don't await this on the critical path strictly, but we DO await
  // it so that a writer-failure surfaces before the LLM call runs (saves
  // tokens). Failure to write the start row is non-fatal — log + continue.
  try {
    await writeAuditRow(ctx.logWriter, {
      profile_id: ctx.profileId,
      agent_name: agentName,
      phase: "research",
      field_or_output_key: `${specialist}.start`,
      value: { specialist, status: "started", started_at: retrievedAtStart },
      confidence: "inferred",
      wall_clock_ms: 0,
    });
  } catch (err) {
    console.warn(`[${specialist}] start-audit write failed (continuing):`, err instanceof Error ? err.message : err);
  }

  const composed = composeAbort(ctx.signal, SPECIALIST_BUDGET_MS);
  const childCtx: SpecialistContext = { ...ctx, signal: composed.signal };

  let output: SpecialistOutput;
  let auditError: string | null = null;

  try {
    output = await body(profile, childCtx, composed.signal);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    output = {
      specialist,
      contentParagraphs: [
        `The ${specialist.replace(/_/g, " ")} run failed before producing a response (${reason}). Please retry from the dashboard.`,
      ],
      citations: [],
      sourceUrlsUsed: [],
      retrievedAt: new Date().toISOString(),
      quality: quality("fallback"),
      confidence: "fallback",
      domainSpecificData: {},
      wallClockMs: Date.now() - start,
      tokensUsed: 0,
      modelUsed: "(no llm call)",
      fallbackReason: reason,
    };
    auditError = reason;
  } finally {
    composed.cleanup();
  }

  // Always set wallClockMs from the base — body may set it but this is the
  // outer wall clock that includes audit overhead.
  output.wallClockMs = Date.now() - start;

  // ---- audit: completed ----------------------------------------------
  const primaryCitationUrl =
    output.sourceUrlsUsed[0] ??
    output.citations.find((c) => !c.scraped)?.url ??
    null;

  try {
    await writeAuditRow(ctx.logWriter, {
      profile_id: ctx.profileId,
      agent_name: agentName,
      model_used: output.modelUsed,
      phase: "research",
      field_or_output_key: `${specialist}.complete`,
      value: summaryValue(output),
      confidence: output.confidence,
      source_url: primaryCitationUrl,
      // Hash the joined paragraphs as the response artifact. We don't have
      // the original prompt at this layer (it lives inside body) so leave
      // prompt undefined — prompt_hash will be null in the row.
      response: output.contentParagraphs.join("\n\n"),
      wall_clock_ms: output.wallClockMs,
      tokens_used: output.tokensUsed,
    });
  } catch (err) {
    console.warn(`[${specialist}] complete-audit write failed:`, err instanceof Error ? err.message : err);
  }

  if (auditError) {
    console.warn(`[${specialist}] failed: ${auditError}`);
  }

  return output;
}
