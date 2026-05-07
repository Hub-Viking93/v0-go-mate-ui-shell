// =============================================================
// @workspace/agents — researched-pipeline helpers
// =============================================================
// Shared utilities for specialists that implement the new
// _contracts.ts shapes (ResearchedSteps / ResearchedAdvisory).
// Old specialists keep using ./_scrape-helpers.ts +
// ./_prompt-helpers.ts; the two helper sets coexist while we
// migrate.
//
// What's here:
//   - fetchRegisteredSources(country, domain) — pull canonical
//     registry URLs, scrape each, return excerpts + per-source
//     ResearchedSource entries.
//   - parseResearchedJsonResponse() — forgiving JSON-extract for
//     LLM responses keyed against the new contract.
//   - writeResearchedAudit() — single audit row at synthesis
//     completion (mirrors writeSynthesisAudit but doesn't depend
//     on the legacy SourceContext shape).
//   - URL_GUARDRAIL_RESEARCHED — system-prompt rules tuned for
//     the structured output shape.
//
// =============================================================

import { writeAuditRow } from "../audit.js";
import { scrapeOfficialSource } from "../scraping/firecrawl.js";
import type { AgentName } from "../types.js";
import {
  getRegisteredSources,
  type RegisteredSource,
} from "./_sources.js";
import type {
  DeadlinePhase,
  DocumentApostilleNeed,
  DocumentCategory,
  DocumentRequirement,
  DocumentTranslationNeed,
  ProfilePredicate,
  ResearchedSource,
  ResearchedStep,
  SpecialistDomain,
  SpecialistFallbackReason,
  SpecialistQuality,
} from "./_contracts.js";

// ---- Source fetch ------------------------------------------------------

/** Per-source markdown cap (prompt-budget hygiene). */
const MAX_MARKDOWN_CHARS = 8_000;

export interface FetchedSource {
  /** The registry entry that produced this fetch. */
  registry: RegisteredSource;
  /** Markdown excerpt, or empty string when scrape failed. */
  excerpt: string;
  /** True iff Firecrawl returned content this run. */
  scraped: boolean;
  /** ISO 8601 UTC of the fetch attempt. */
  retrievedAt: string;
}

export interface FetchResult {
  /** Every source attempted, in registry priority order. */
  fetched: FetchedSource[];
  /** Subset that actually returned markdown. */
  successful: FetchedSource[];
  /** ResearchedSource[] payload to attach to the specialist's
   *  output.sources field. Built once, not derived per-step. */
  asResearchedSources: ResearchedSource[];
  /** Quality computed from successful / total. */
  quality: SpecialistQuality;
  /** When quality !== "full", a structured reason. */
  fallbackReason?: SpecialistFallbackReason;
}

function truncateMarkdown(md: string, maxChars: number): string {
  if (md.length <= maxChars) return md;
  return `${md.slice(0, maxChars)}\n\n…[truncated for prompt budget — see source URL for full text]`;
}

function inferHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Pull the canonical registry sources for (country, domain) and
 * scrape each one. Builds the ResearchedSource[] payload + a
 * structured FetchedSource[] callers use to render prompt context.
 *
 * Quality model:
 *   - 0 registered sources → fallback / no_sources_found
 *   - All scrape attempts fail → fallback / scrape_failed
 *   - Some succeed, some fail → partial (no fallbackReason —
 *     "partial" already signals it)
 *   - All succeed → full
 */
export async function fetchRegisteredSources(args: {
  country: string | null | undefined;
  domain: SpecialistDomain;
  signal: AbortSignal;
}): Promise<FetchResult> {
  const { country, domain, signal } = args;
  const registered = getRegisteredSources(country, domain);

  if (registered.length === 0) {
    return {
      fetched: [],
      successful: [],
      asResearchedSources: [],
      quality: "fallback",
      fallbackReason: "no_sources_found",
    };
  }

  const scrapes = await Promise.all(
    registered.map((r) => scrapeOfficialSource(r.url, { signal })),
  );

  const fetched: FetchedSource[] = registered.map((r, i) => {
    const s = scrapes[i];
    const ok = !!s && s.ok && !!s.markdown;
    return {
      registry: r,
      excerpt: ok ? truncateMarkdown(s.markdown!, MAX_MARKDOWN_CHARS) : "",
      scraped: ok,
      retrievedAt: s?.retrievedAt ?? new Date().toISOString(),
    };
  });

  const successful = fetched.filter((f) => f.scraped);
  let quality: SpecialistQuality;
  let fallbackReason: SpecialistFallbackReason | undefined;
  if (successful.length === 0) {
    quality = "fallback";
    fallbackReason = "scrape_failed";
  } else if (successful.length < fetched.length) {
    quality = "partial";
  } else {
    quality = "full";
  }

  const asResearchedSources: ResearchedSource[] = fetched.map((f) => ({
    url: f.registry.url,
    domain: f.registry.domain ?? inferHost(f.registry.url),
    title: f.registry.hint,
    retrievedAt: f.retrievedAt,
    kind: f.registry.kind,
  }));

  return { fetched, successful, asResearchedSources, quality, fallbackReason };
}

// ---- Prompt rendering --------------------------------------------------

export const URL_GUARDRAIL_RESEARCHED = `
HARD RULES:
1. NEVER invent a URL. Cite ONLY from the SOURCES block. Use full URLs.
2. If a SOURCE is marked "WHITELIST URL ONLY", treat it as reference — don't paraphrase content.
3. If you don't have enough info, omit the step / document. Don't bluff.
4. Output a JSON object exactly matching the schema in the system prompt. No prose outside the JSON.
5. For every step.id and document.id, USE THE DOMAIN-PREFIX RULE: e.g. "registration:population-register" not "population-register".
6. step.appliesWhen MUST be a structured ProfilePredicate object — not a sentence.
   Examples: {"always": true} | {"eq": {"field": "purpose", "value": "settle"}} | {"set": {"field": "monthly_budget"}}
7. Every step.sources[] and document.sources[] entry MUST be a URL that appears in the top-level sources[] block.
`.trim();

/** Build the SOURCES preamble — same shape as the legacy
 *  renderSourcesBlock but typed against FetchedSource. */
export function renderResearchedSourcesBlock(fetched: FetchedSource[]): string {
  if (fetched.length === 0) {
    return "SOURCES:\n  (none — no registered source URL was available; rely on embedded knowledge but DO NOT fabricate URLs)\n";
  }
  const parts = fetched.map((f, i) => {
    const status = f.scraped
      ? "SCRAPED THIS RUN"
      : "WHITELIST URL ONLY (NOT scraped — do not paraphrase as if you fetched it)";
    const body = f.scraped
      ? f.excerpt
      : "(no content fetched — cite the URL only as a reference, do not invent details)";
    const hint = f.registry.hint ? ` — ${f.registry.hint}` : "";
    return `--- SOURCE ${i + 1} [${status}] ---\nKind: ${f.registry.kind}\nURL: ${f.registry.url}${hint}\n\n${body}\n`;
  });
  return `SOURCES (you may cite ONLY URLs from this list; you MUST NOT invent any URL):\n\n${parts.join("\n")}`;
}

// ---- LLM response parsing ----------------------------------------------

/**
 * Strip ```json fences + isolate {…}, then JSON.parse with the
 * caller's expected shape. Returns null on parse failure. Caller
 * decides how to fall back (typically: empty steps + quality
 * "fallback" + fallbackReason "llm_parse_failed").
 */
export function parseResearchedJsonResponse<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T;
  } catch {
    return null;
  }
}

// ---- Strict enum + predicate validation -------------------------------
//
// LLM output is JSON-shaped but enum values can drift. These whitelists
// + the recursive predicate validator drop offending items rather than
// pretending the contract held. Drops downgrade quality.

const VALID_DEADLINE_PHASES: ReadonlySet<DeadlinePhase> = new Set([
  "before_move",
  "move_day",
  "first_72h",
  "first_30d",
  "first_90d",
  "first_year_end",
  "ongoing",
]);

const VALID_DOC_CATEGORIES: ReadonlySet<DocumentCategory> = new Set([
  "civil_status",
  "education",
  "professional",
  "criminal",
  "medical",
  "financial",
  "identity",
  "housing",
  "other",
]);

const VALID_APOSTILLE: ReadonlySet<DocumentApostilleNeed> = new Set([
  "needed",
  "not_needed",
  "varies",
]);

const VALID_TRANSLATION: ReadonlySet<DocumentTranslationNeed> = new Set([
  "needed",
  "not_needed",
  "destination_language_only",
  "varies",
]);

/**
 * Recursive structural validator for ProfilePredicate. Accepts the
 * exact shapes the contract enumerates; rejects unknown operators,
 * missing fields, and wrong-type values. Predicates that fail
 * validation are replaced with `{always: true}` and the step is
 * counted as a drift in the validation result.
 */
export function isValidProfilePredicate(p: unknown): p is ProfilePredicate {
  if (typeof p !== "object" || p === null) return false;
  const r = p as Record<string, unknown>;
  if (r.always === true && Object.keys(r).length === 1) return true;
  if (r.eq && typeof r.eq === "object" && r.eq !== null) {
    const e = r.eq as Record<string, unknown>;
    return (
      typeof e.field === "string" &&
      (typeof e.value === "string" ||
        typeof e.value === "number" ||
        typeof e.value === "boolean")
    );
  }
  if (r.in && typeof r.in === "object" && r.in !== null) {
    const i = r.in as Record<string, unknown>;
    return (
      typeof i.field === "string" &&
      Array.isArray(i.values) &&
      i.values.every((v) => typeof v === "string" || typeof v === "number")
    );
  }
  if (r.set && typeof r.set === "object" && r.set !== null) {
    return typeof (r.set as Record<string, unknown>).field === "string";
  }
  if (r.unset && typeof r.unset === "object" && r.unset !== null) {
    return typeof (r.unset as Record<string, unknown>).field === "string";
  }
  if (Array.isArray(r.all)) return r.all.every(isValidProfilePredicate);
  if (Array.isArray(r.any)) return r.any.every(isValidProfilePredicate);
  if (r.not !== undefined) return isValidProfilePredicate(r.not);
  return false;
}

export interface ValidatedSteps {
  steps: ResearchedStep[];
  /** Steps the LLM returned but we dropped because of contract drift. */
  dropped: number;
  /** Steps where appliesWhen drifted; we reset to {always: true}. */
  predicatesReset: number;
}

/**
 * Strict step validator. Returns only steps that conform to the
 * contract; drops everything else (with a count). Steps with
 * structurally-invalid `appliesWhen` keep their other fields but
 * have the predicate reset to `{always: true}` (rather than dropping
 * the whole step over a faulty gate).
 */
export function validateAndNormaliseSteps(
  raw: unknown,
  domain: SpecialistDomain,
): ValidatedSteps {
  if (!Array.isArray(raw)) return { steps: [], dropped: 0, predicatesReset: 0 };
  const steps: ResearchedStep[] = [];
  let dropped = 0;
  let predicatesReset = 0;
  const prefix = `${domain}:`;
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      dropped += 1;
      continue;
    }
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id.startsWith(prefix)) {
      dropped += 1;
      continue;
    }
    if (typeof r.title !== "string" || typeof r.description !== "string") {
      dropped += 1;
      continue;
    }
    const dw = r.deadlineWindow as Record<string, unknown> | undefined;
    if (!dw || typeof dw.phase !== "string" || !VALID_DEADLINE_PHASES.has(dw.phase as DeadlinePhase)) {
      dropped += 1;
      continue;
    }
    let appliesWhen: ProfilePredicate;
    if (isValidProfilePredicate(r.appliesWhen)) {
      appliesWhen = r.appliesWhen;
    } else {
      appliesWhen = { always: true };
      predicatesReset += 1;
    }
    steps.push({
      id: r.id,
      title: r.title,
      description: r.description,
      deadlineWindow: {
        phase: dw.phase as DeadlinePhase,
        ...(typeof dw.weeksBeforeMove === "number" ? { weeksBeforeMove: dw.weeksBeforeMove } : {}),
        ...(typeof dw.daysAfterArrival === "number" ? { daysAfterArrival: dw.daysAfterArrival } : {}),
        ...(typeof dw.legalDeadlineDays === "number" ? { legalDeadlineDays: dw.legalDeadlineDays } : {}),
      },
      appliesWhen,
      prerequisites: Array.isArray(r.prerequisites)
        ? (r.prerequisites as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
      documentIds: Array.isArray(r.documentIds)
        ? (r.documentIds as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
      ...(Array.isArray(r.walkthrough)
        ? { walkthrough: (r.walkthrough as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 5) }
        : {}),
      ...(typeof r.bottleneck === "string" ? { bottleneck: r.bottleneck } : {}),
      sources: Array.isArray(r.sources)
        ? (r.sources as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
    });
  }
  return { steps, dropped, predicatesReset };
}

export interface ValidatedDocuments {
  documents: DocumentRequirement[];
  dropped: number;
}

export function validateAndNormaliseDocuments(
  raw: unknown,
  domain: SpecialistDomain,
): ValidatedDocuments {
  if (!Array.isArray(raw)) return { documents: [], dropped: 0 };
  const documents: DocumentRequirement[] = [];
  let dropped = 0;
  const prefix = `${domain}:`;
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      dropped += 1;
      continue;
    }
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id.startsWith(prefix)) {
      dropped += 1;
      continue;
    }
    if (typeof r.label !== "string") {
      dropped += 1;
      continue;
    }
    if (typeof r.category !== "string" || !VALID_DOC_CATEGORIES.has(r.category as DocumentCategory)) {
      dropped += 1;
      continue;
    }
    if (typeof r.apostille !== "string" || !VALID_APOSTILLE.has(r.apostille as DocumentApostilleNeed)) {
      dropped += 1;
      continue;
    }
    if (typeof r.translation !== "string" || !VALID_TRANSLATION.has(r.translation as DocumentTranslationNeed)) {
      dropped += 1;
      continue;
    }
    if (typeof r.leadTimeDays !== "number" || !Number.isFinite(r.leadTimeDays) || r.leadTimeDays < 0) {
      dropped += 1;
      continue;
    }
    documents.push({
      id: r.id,
      label: r.label,
      category: r.category as DocumentCategory,
      apostille: r.apostille as DocumentApostilleNeed,
      translation: r.translation as DocumentTranslationNeed,
      leadTimeDays: r.leadTimeDays,
      sources: Array.isArray(r.sources)
        ? (r.sources as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
    });
  }
  return { documents, dropped };
}

// ---- Quality + fallback computation -----------------------------------

/**
 * Compose quality + fallbackReason from (a) source-fetch quality,
 * (b) LLM parse success, (c) post-validation drift counts.
 *
 * Precedence (worst wins):
 *   no LLM parse                → fallback / llm_parse_failed
 *   ≥1 step / doc dropped       → downgrade to partial (or keep
 *                                 fallback if already there)
 *   else                        → keep fetch quality
 */
export function composeQuality(args: {
  fetchQuality: SpecialistQuality;
  fetchFallbackReason?: SpecialistFallbackReason;
  parseFailed: boolean;
  droppedSteps: number;
  droppedDocs: number;
}): { quality: SpecialistQuality; fallbackReason?: SpecialistFallbackReason } {
  if (args.parseFailed) {
    return { quality: "fallback", fallbackReason: "llm_parse_failed" };
  }
  const drift = args.droppedSteps + args.droppedDocs > 0;
  if (args.fetchQuality === "fallback") {
    return {
      quality: "fallback",
      ...(args.fetchFallbackReason ? { fallbackReason: args.fetchFallbackReason } : {}),
    };
  }
  if (drift && args.fetchQuality === "full") {
    return { quality: "partial" };
  }
  return {
    quality: args.fetchQuality,
    ...(args.fetchFallbackReason ? { fallbackReason: args.fetchFallbackReason } : {}),
  };
}

// ---- Budget enforcement -----------------------------------------------

/**
 * Wrap a specialist body in a hard budget. When budgetMs elapses
 * before the body resolves, returns the caller-supplied fallback
 * output (typically quality:"fallback" + fallbackReason:"timeout").
 *
 * Note: callLLM does not currently accept an AbortSignal, so the
 * underlying LLM request continues to run after timeout (its tokens
 * are still billed). The race only stops US from waiting. When
 * router.ts grows signal support we can thread it through and
 * actually cancel.
 */
export async function withBudget<T>(args: {
  budgetMs: number;
  work: () => Promise<T>;
  onTimeout: () => T;
}): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(args.onTimeout()), args.budgetMs);
  });
  try {
    const result = await Promise.race([args.work(), timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---- Audit row write ---------------------------------------------------

export interface WriteResearchedAuditArgs {
  profileId: string;
  logWriter: import("../types.js").LogWriter;
  agentName: AgentName;
  domain: SpecialistDomain;
  fetchResult: FetchResult;
  userPrompt: string;
  llm: { content: string; tokens_used: number; model_used: string };
  synthesisMs: number;
  quality: SpecialistQuality;
  fallbackReason?: SpecialistFallbackReason;
  /** Extra structured payload to attach (step count, doc count, etc.) */
  extra?: Record<string, unknown>;
}

/** Single synthesis-completion audit row for researched specialists. */
export async function writeResearchedAudit(
  args: WriteResearchedAuditArgs,
): Promise<void> {
  try {
    await writeAuditRow(args.logWriter, {
      profile_id: args.profileId,
      agent_name: args.agentName,
      model_used: args.llm.model_used,
      phase: "research",
      field_or_output_key: `${args.domain}.researched_synthesis`,
      value: {
        sources_total: args.fetchResult.fetched.length,
        sources_scraped: args.fetchResult.successful.length,
        quality: args.quality,
        fallback_reason: args.fallbackReason ?? null,
        ...(args.extra ?? {}),
      },
      confidence:
        args.quality === "full"
          ? "explicit"
          : args.quality === "partial"
            ? "partial"
            : "fallback",
      source_url:
        args.fetchResult.successful[0]?.registry.url ??
        args.fetchResult.fetched[0]?.registry.url ??
        null,
      prompt: args.userPrompt,
      response: args.llm.content,
      wall_clock_ms: args.synthesisMs,
      tokens_used: args.llm.tokens_used,
    });
  } catch (err) {
    console.warn(
      `[${args.domain}] researched-audit write failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}
