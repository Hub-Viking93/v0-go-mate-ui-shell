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
  ResearchedSource,
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
