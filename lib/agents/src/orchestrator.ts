// =============================================================
// @workspace/agents — Wave 1.5 orchestrator
// =============================================================
// runAgentPipeline consumes a list of AgentGroups (sequential or
// parallel), runs each invocation with timing + exponential-backoff
// retries, writes one agent_run_log row per state transition
// (started / retry / completed / failed), and falls back to
// invocation.fallback() when all retries are exhausted.
//
// The orchestrator NEVER throws on logging failure — agent execution
// is the priority; logging is best-effort. Agent execution failures
// are returned in the AgentInvocationResult, not thrown, so a
// pipeline of N agents always produces N results.
// =============================================================

import type {
  AgentGroup,
  AgentInvocation,
  AgentInvocationResult,
  AgentPipelineResult,
  AgentRunContext,
  LogWriter,
} from "./types.js";

export interface RunAgentPipelineArgs {
  profileId: string;
  groups: AgentGroup[];
  writer: LogWriter;
  /** Extra fields merged into AgentRunContext alongside profile_id. */
  context?: Record<string, unknown>;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_INITIAL_BACKOFF_MS = 500;

async function backoff(attempt: number): Promise<void> {
  const ms =
    DEFAULT_INITIAL_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 200);
  await new Promise<void>((res) => setTimeout(res, ms));
}

function summarize(value: unknown, max = 200): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : safeStringify(value);
  return s.length > max ? s.slice(0, max) : s;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function safeLog(
  writer: LogWriter,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch {
    // Logging is best-effort; never block agent execution on it.
  }
}

async function runOne(
  invocation: AgentInvocation,
  ctx: AgentRunContext,
  writer: LogWriter,
): Promise<AgentInvocationResult> {
  const profile_id = ctx.profile_id;
  const maxRetries = invocation.retries ?? DEFAULT_RETRIES;
  const startAll = Date.now();

  await safeLog(writer, () =>
    writer.insertRunLog({
      profile_id,
      agent_name: invocation.name,
      phase: invocation.phase,
      status: "started",
      prompt_summary: summarize(ctx),
      retry_count: 0,
    }),
  );

  let attempt = 0;
  let lastErr: unknown = null;

  while (attempt <= maxRetries) {
    const startAttempt = Date.now();
    try {
      const output = await invocation.run(ctx);
      const wall_clock_ms = Date.now() - startAttempt;

      await safeLog(writer, () =>
        writer.insertRunLog({
          profile_id,
          agent_name: invocation.name,
          phase: invocation.phase,
          status: "completed",
          prompt_summary: summarize(ctx),
          response_summary: summarize(output.content),
          retry_count: attempt,
          tokens_used: output.tokens_used ?? null,
          wall_clock_ms,
        }),
      );

      return {
        name: invocation.name,
        phase: invocation.phase,
        status: "completed",
        output,
        retries: attempt,
        wall_clock_ms: Date.now() - startAll,
      };
    } catch (err) {
      lastErr = err;
      const wall_clock_ms = Date.now() - startAttempt;
      const isLastAttempt = attempt >= maxRetries;

      await safeLog(writer, () =>
        writer.insertRunLog({
          profile_id,
          agent_name: invocation.name,
          phase: invocation.phase,
          status: isLastAttempt ? "failed" : "retry",
          prompt_summary: summarize(ctx),
          retry_count: attempt,
          wall_clock_ms,
          error_message:
            err instanceof Error
              ? err.message.slice(0, 1000)
              : String(err).slice(0, 1000),
        }),
      );

      if (!isLastAttempt) {
        await backoff(attempt);
        attempt++;
        continue;
      }
      break;
    }
  }

  // All retries exhausted — try fallback.
  if (invocation.fallback) {
    try {
      const output = invocation.fallback();
      return {
        name: invocation.name,
        phase: invocation.phase,
        status: "fallback",
        output,
        retries: attempt,
        wall_clock_ms: Date.now() - startAll,
      };
    } catch (fbErr) {
      return {
        name: invocation.name,
        phase: invocation.phase,
        status: "failed",
        error: `run failed; fallback also threw: ${
          fbErr instanceof Error ? fbErr.message : String(fbErr)
        }`,
        retries: attempt,
        wall_clock_ms: Date.now() - startAll,
      };
    }
  }

  return {
    name: invocation.name,
    phase: invocation.phase,
    status: "failed",
    error: lastErr instanceof Error ? lastErr.message : String(lastErr),
    retries: attempt,
    wall_clock_ms: Date.now() - startAll,
  };
}

export async function runAgentPipeline(
  args: RunAgentPipelineArgs,
): Promise<AgentPipelineResult> {
  const { profileId, groups, writer, context = {} } = args;
  const ctx: AgentRunContext = { profile_id: profileId, ...context };
  const start = Date.now();
  const results: AgentInvocationResult[] = [];

  for (const group of groups) {
    if (group.mode === "sequential") {
      for (const inv of group.invocations) {
        results.push(await runOne(inv, ctx, writer));
      }
    } else {
      const groupResults = await Promise.all(
        group.invocations.map((inv) => runOne(inv, ctx, writer)),
      );
      results.push(...groupResults);
    }
  }

  return {
    results,
    total_wall_clock_ms: Date.now() - start,
  };
}
