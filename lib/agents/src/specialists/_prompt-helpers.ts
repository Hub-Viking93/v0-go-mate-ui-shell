// =============================================================
// @workspace/agents — specialist prompt helpers
// =============================================================
// Shared utilities used by every specialist body:
//   * Truncate scraped markdown to a token-budget-friendly size.
//   * Build a "SOURCES" preamble that the LLM is told to cite from
//     (and forbidden to invent beyond).
//   * Parse the LLM's JSON-ish response into paragraphs +
//     domainSpecificData, with a forgiving fallback when the model
//     doesn't strictly follow the schema.
//   * Build the standard "you must not fabricate URLs" guardrail.
// =============================================================

import type { ScrapeResult } from "../scraping/firecrawl.js";

/** Per-source markdown cap. Keeps the multi-source prompt under ~30k chars. */
const MAX_MARKDOWN_CHARS = 8_000;

export interface SourceContext {
  url: string;
  /** Short human label, e.g. "Migrationsverket — Work Permit". */
  label: string;
  /** Markdown excerpt (auto-truncated). Empty string if scrape failed. */
  excerpt: string;
  /** True if Firecrawl actually returned content this run. */
  scraped: boolean;
}

export function makeSourceContext(
  label: string,
  url: string,
  scrape: ScrapeResult | null,
): SourceContext {
  const scraped = !!scrape && scrape.ok && !!scrape.markdown;
  const excerpt = scraped
    ? truncateMarkdown(scrape!.markdown!, MAX_MARKDOWN_CHARS)
    : "";
  return { url, label, excerpt, scraped };
}

export function truncateMarkdown(md: string, maxChars: number): string {
  if (md.length <= maxChars) return md;
  return `${md.slice(0, maxChars)}\n\n…[truncated for prompt budget — see source URL for full text]`;
}

/** Build the SOURCES section the LLM is told to cite from. */
export function renderSourcesBlock(sources: SourceContext[]): string {
  if (sources.length === 0) {
    return "SOURCES:\n  (none — no whitelist URL was available; rely on embedded knowledge but DO NOT fabricate URLs)\n";
  }
  const parts = sources.map((s, i) => {
    const status = s.scraped ? "SCRAPED THIS RUN" : "WHITELIST URL ONLY (NOT scraped — do not paraphrase as if you fetched it)";
    const body = s.scraped ? s.excerpt : "(no content fetched — cite the URL only as a reference, do not invent details)";
    return `--- SOURCE ${i + 1} [${status}] ---\nLabel: ${s.label}\nURL: ${s.url}\n\n${body}\n`;
  });
  return `SOURCES (you may cite ONLY URLs from this list; you MUST NOT invent any URL):\n\n${parts.join("\n")}`;
}

/** Standard guardrail every specialist appends to its system prompt. */
export const URL_GUARDRAIL = `
HARD RULES:
1. NEVER invent a URL. If you cite a source, it MUST appear verbatim in the SOURCES block above.
2. If a SOURCE is marked "WHITELIST URL ONLY", treat it as a reference link only — do not pretend to know its content.
3. If you don't have enough info to answer a question, say so plainly. Do not bluff.
4. Output a JSON object exactly matching the schema requested. No prose outside the JSON.
5. PARAGRAPH LENGTH: Each paragraph in "paragraphs" MUST be 120-180 words. Hard ceiling 180. Pick the 2-3 most important facts and stop. Long-winded paragraphs are truncated server-side mid-sentence — write tight or get cut.
`.trim();

/**
 * Server-side word cap. Trims any paragraph longer than `maxWords` to
 * the last full sentence boundary that fits within the cap. Prevents
 * the LLM from blowing past the 180-word target without breaking the
 * user-visible output mid-sentence.
 *
 * Strategy:
 * - Split on sentence terminators (. ! ?) keeping the terminator.
 * - Accumulate sentences until the next would exceed maxWords.
 * - If the very first sentence already exceeds maxWords, fall back to
 *   a hard word slice (rare — most LLMs honour the rule, this is just
 *   a safety net).
 */
export function trimParagraphToWordCap(paragraph: string, maxWords = 200): string {
  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount(paragraph) <= maxWords) return paragraph;

  // Split on sentence boundaries while keeping the terminator + any
  // trailing whitespace attached to the previous sentence.
  const sentences = paragraph.match(/[^.!?]+[.!?]+\s*/g) ?? [paragraph];
  let acc = "";
  for (const sentence of sentences) {
    const candidate = acc + sentence;
    if (wordCount(candidate) > maxWords) break;
    acc = candidate;
  }
  if (acc.trim().length === 0) {
    // First sentence is already over the cap — hard slice as fallback.
    const words = paragraph.trim().split(/\s+/);
    return words.slice(0, maxWords).join(" ") + "…";
  }
  return acc.trim();
}

/** Apply the word cap to every paragraph in an array. */
export function trimParagraphsToWordCap(paragraphs: string[], maxWords = 200): string[] {
  return paragraphs.map((p) => trimParagraphToWordCap(p, maxWords));
}

export interface ParsedSpecialistResponse {
  paragraphs: string[];
  keyFacts: Record<string, unknown>;
}

/**
 * Parse the LLM's response. We ask for a JSON object with
 * { paragraphs: string[], key_facts: Record<string, unknown> }.
 * On parse failure (e.g. model wrapped JSON in prose), fall back to
 * splitting the raw text on blank lines so the user still sees something.
 */
export function parseSpecialistResponse(raw: string): ParsedSpecialistResponse {
  const trimmed = raw.trim();
  // Strip ```json fences if present.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  // Find first { ... last } to isolate JSON when wrapped in prose.
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = candidate.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(slice) as { paragraphs?: unknown; key_facts?: unknown };
      const paragraphs = Array.isArray(parsed.paragraphs)
        ? parsed.paragraphs.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        : [];
      const keyFacts = parsed.key_facts && typeof parsed.key_facts === "object" && !Array.isArray(parsed.key_facts)
        ? (parsed.key_facts as Record<string, unknown>)
        : {};
      if (paragraphs.length > 0) return { paragraphs, keyFacts };
    } catch {
      // fall through to plain-text fallback
    }
  }

  // Plain text fallback — split on double newlines.
  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith("```"));
  return { paragraphs: paragraphs.length > 0 ? paragraphs : [trimmed], keyFacts: {} };
}
