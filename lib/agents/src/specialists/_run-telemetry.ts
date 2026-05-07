// =============================================================
// @workspace/agents — research-run telemetry + cost controls
// =============================================================
// Per-run accounting for the research orchestrator. Persisted to
// relocation_plans.research_meta.run_telemetry so we can:
//
//   • show "Updated 5 days ago · 3 sources · quality full" in UI
//   • monitor per-user 30-day cost
//   • spot when fallbacks spike (specialists scraping less /
//     LLM degrading)
//   • diff partial vs full re-research runs
//
// The hard limits below are the cost-control plane Codex called
// out as a Phase 0 requirement — concurrency cap + per-run
// specialist count + per-user 30-day spend + retry policy.
// =============================================================

import type {
  SpecialistDomain,
  SpecialistFallbackReason,
  SpecialistQuality,
} from "./_contracts.js";

// ---- Cost + rate limits ----------------------------------------------

export const RESEARCH_LIMITS = {
  /** Hard cap on specialists in a single orchestrator run. */
  maxSpecialistsPerRun: 12,
  /** Concurrency cap inside a run (LLM + Firecrawl rate-limit safety). */
  maxConcurrentSpecialists: 4,
  /** Per-specialist wall-clock budget. Above this the specialist must
   *  return partial + quality:"partial". */
  specialistBudgetMs: 90_000,
  /** Per-user 30-day spend cap (USD). Soft block beyond this — the
   *  trigger-research route should refuse with a "cooldown until X"
   *  message rather than firing the run. */
  perUser30dCostCapUsd: 5,
  /** Specialist failure retry cap before falling back. */
  specialistRetries: 3,
  /** Hard wall-clock cap for the whole orchestrator dispatch. */
  totalRunBudgetMs: 5 * 60_000,
} as const;

export type ResearchLimits = typeof RESEARCH_LIMITS;

// ---- Per-run telemetry shape -----------------------------------------

export interface RunTelemetry {
  /** Wall-clock millis from orchestrator start to last specialist return. */
  totalWallClockMs: number;
  /** Sum across every callLLM in this run. */
  totalTokens: number;
  /** Estimated USD using known per-token rates (router.ts).
   *  Calculated by the orchestrator after every specialist returns. */
  totalCostUsd: number;
  /** Domains that ran this round. */
  specialistsRun: SpecialistDomain[];
  /** Domains that returned partial / fallback. */
  fallbacks: { domain: SpecialistDomain; reason: SpecialistFallbackReason }[];
  /** Quality histogram across the run. */
  qualityDistribution: Record<SpecialistQuality, number>;
  /** Number of distinct sources actually fetched (deduped by URL). */
  sourceFetches: number;
  /** True if this run was a partial refresh (re-research subset). */
  partialRefresh: boolean;
  /** ISO 8601 UTC of run start — for "Updated X ago" UI. */
  startedAt: string;
}

// ---- Token → USD pricing ---------------------------------------------
//
// Per-million-token list rates as of 2026-04. These are deliberately
// approximate — exact billing happens at the integrations layer; this
// model just gives the orchestrator a per-run estimate and a basis
// for the 30-day soft cap.

const PRICING_PER_MTOK_USD: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-7": { input: 15, output: 75 },
};

/**
 * Estimate USD cost for a single LLM call. Defensive defaults on
 * unknown models (assume sonnet pricing) so we don't under-bill.
 */
export function estimateCallCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = PRICING_PER_MTOK_USD[model] ?? PRICING_PER_MTOK_USD["claude-sonnet-4-6"]!;
  return (
    (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output
  );
}

// ---- Telemetry accumulator -------------------------------------------
//
// Single mutable object the orchestrator holds for the lifetime of
// a run. Each specialist completion pumps into accumulate(); the
// orchestrator finalises with toTelemetry() before persisting.

export class RunTelemetryAccumulator {
  private startedAt: string;
  private startMs: number;
  private specialistsRun = new Set<SpecialistDomain>();
  private fallbacks: { domain: SpecialistDomain; reason: SpecialistFallbackReason }[] = [];
  private qualityHist: Record<SpecialistQuality, number> = { full: 0, partial: 0, fallback: 0 };
  private sourceUrls = new Set<string>();
  private totalTokens = 0;
  private totalCostUsd = 0;
  private partialRefresh: boolean;

  constructor(opts: { partialRefresh?: boolean } = {}) {
    this.startedAt = new Date().toISOString();
    this.startMs = Date.now();
    this.partialRefresh = Boolean(opts.partialRefresh);
  }

  /** Record a single LLM call's token / cost contribution. */
  recordCall(opts: { model: string; inputTokens: number; outputTokens: number }): void {
    this.totalTokens += opts.inputTokens + opts.outputTokens;
    this.totalCostUsd += estimateCallCostUsd(
      opts.model,
      opts.inputTokens,
      opts.outputTokens,
    );
  }

  /** Record a specialist's full output for telemetry (quality, sources, fallback). */
  recordSpecialistOutput(opts: {
    domain: SpecialistDomain;
    quality: SpecialistQuality;
    fallbackReason?: SpecialistFallbackReason;
    sourceUrls: Iterable<string>;
  }): void {
    this.specialistsRun.add(opts.domain);
    this.qualityHist[opts.quality] += 1;
    if (opts.fallbackReason) {
      this.fallbacks.push({ domain: opts.domain, reason: opts.fallbackReason });
    }
    for (const u of opts.sourceUrls) this.sourceUrls.add(u);
  }

  toTelemetry(): RunTelemetry {
    return {
      totalWallClockMs: Date.now() - this.startMs,
      totalTokens: this.totalTokens,
      totalCostUsd: Math.round(this.totalCostUsd * 10_000) / 10_000,
      specialistsRun: Array.from(this.specialistsRun),
      fallbacks: this.fallbacks,
      qualityDistribution: { ...this.qualityHist },
      sourceFetches: this.sourceUrls.size,
      partialRefresh: this.partialRefresh,
      startedAt: this.startedAt,
    };
  }
}
