// =============================================================
// @workspace/agents — specialist shared types
// =============================================================
// SpecialistOutput is the contract every always-run specialist
// (visa, tax, cost, housing, cultural, documents) returns. The
// shape is intentionally narrow so the synthesizer + UI can
// render any specialist without specialist-specific glue.
//
// Audit/observability NOTE: every SpecialistOutput value is also
// the `value` column of two audit rows written by the _base.ts
// runSpecialist helper — one at start, one at completion. So
// avoid stuffing huge raw scraped markdown in here; that belongs
// in `domainSpecificData.scrapedExcerpts` (capped) or nowhere.
// =============================================================

import type { ConfidenceLevel, LogWriter } from "../types.js";

/**
 * Quality describes how trustworthy this output is.
 *  - "full": LLM synthesised from successfully scraped official sources.
 *  - "partial": At least one scrape succeeded but at least one failed,
 *               so the synthesis is partly from embedded knowledge.
 *  - "fallback": ALL scrapes failed (or Firecrawl key missing). LLM
 *                used embedded knowledge only; cited URLs are the
 *                whitelist URLs (advertised but NOT fetched this run).
 */
export type SpecialistQuality = "full" | "partial" | "fallback";

export interface Citation {
  /** URL — must be from official-sources whitelist or scraped this run. */
  url: string;
  /** Short label (≤60 chars) for the UI. */
  label: string;
  /** Optional one-liner explaining what this source contributed. */
  note?: string;
  /** True iff this URL was actually scraped this run (vs whitelist-only). */
  scraped: boolean;
}

export interface SpecialistOutput {
  /** Specialist identifier — matches the coordinator panel key. */
  specialist: string;
  /** Synthesized prose, one paragraph per element. UI renders as <p>s. */
  contentParagraphs: string[];
  /** Citations the user can click — one per source consulted. */
  citations: Citation[];
  /** URLs that were successfully scraped (subset of citations.url). */
  sourceUrlsUsed: string[];
  /** ISO 8601 UTC of the most recent scrape (or attempt). */
  retrievedAt: string;
  quality: SpecialistQuality;
  /** Per-AgentOutput confidence level — mirrors the audit row. */
  confidence: ConfidenceLevel;
  /**
   * Specialist-specific structured data (e.g. visa.recommendedVisa,
   * cost.monthlyBudget, documents.requiredDocs). Loosely typed because
   * each specialist defines its own shape. UIs that want richer
   * rendering should narrow on `specialist` first.
   */
  domainSpecificData: Record<string, unknown>;
  /** Wall clock from start of body to return. */
  wallClockMs: number;
  /** Sum of LLM tokens consumed (synthesis only — scrape not counted). */
  tokensUsed: number;
  /** Model id actually used for the synthesis call. */
  modelUsed: string;
  /** When quality !== "full", a 1-line plain-English reason. */
  fallbackReason?: string;
}

/** Subset of the user profile a specialist may read. */
export type SpecialistProfile = Record<string, string | number | null | undefined>;

export interface SpecialistContext {
  /** UUID of the relocation profile — joins to agent_audit. */
  profileId: string;
  /** Audit-row sink. Specialists write start + completion via runSpecialist. */
  logWriter: LogWriter;
  /**
   * External AbortSignal — typically the master 60s budget for the
   * whole research dispatch. Specialists wrap their own per-call
   * 25s budget on top of this so a slow LLM doesn't burn the whole
   * Promise.allSettled.
   */
  signal?: AbortSignal;
}

/** Outputs from prior specialists in the dispatch — used by documents. */
export interface PriorSpecialistOutputs {
  visa?: SpecialistOutput;
}
