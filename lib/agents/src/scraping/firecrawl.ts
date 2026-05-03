// =============================================================
// @workspace/agents — Firecrawl scrape wrapper
// =============================================================
// Centralised wrapper around the Firecrawl v1 REST API. Used by
// every specialist that needs to scrape an official-source URL
// or run a search-and-scrape query. Reads FIRECRAWL_API_KEY
// from process.env at call time (so missing-key failures surface
// loudly, not at module load).
//
// PROMPT-vs-PROJECT NOTE: the user asked us to wire Firecrawl
// "via @mendable/firecrawl-js". The .migration-backup pattern
// uses direct fetch against api.firecrawl.dev/v1, not the SDK,
// and that pattern has been battle-tested in v1. Keeping the
// direct-fetch approach avoids adding a new dep and keeps the
// retry semantics consistent with fetchWithRetry. If the SDK
// becomes desirable later, this single file is the swap point.
//
// All errors are translated to `{ ok: false, reason }` so
// specialists can degrade to quality="partial" / "fallback"
// gracefully — they never throw for a scrape failure.
// =============================================================

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1";

/** Per-scrape timeout. Hard cap so a slow URL can't burn the specialist budget. */
const DEFAULT_SCRAPE_TIMEOUT_MS = 15_000;

/** How long to wait for client-rendered content before scraping. */
const DEFAULT_WAIT_FOR_MS = 3_000;

export interface ScrapeResult {
  ok: boolean;
  url: string;
  /** Markdown content if ok===true. */
  markdown?: string;
  /** ISO 8601 UTC. Present whether ok or not. */
  retrievedAt: string;
  /** Failure reason (network, http status, missing key, abort). */
  reason?: string;
}

export interface SearchAndScrapeResult {
  ok: boolean;
  query: string;
  /** Each item is the markdown of one search hit. */
  pages: { url?: string; markdown: string }[];
  retrievedAt: string;
  reason?: string;
}

interface ScrapeOptions {
  /** External AbortSignal that cancels the scrape (specialist-level budget). */
  signal?: AbortSignal;
  /** Override the per-call timeout. Default 15s. */
  timeoutMs?: number;
  /** Wait for client-side JS to settle. Default 3s. */
  waitForMs?: number;
}

interface SearchOptions extends ScrapeOptions {
  /** Max search hits to scrape. Default 3. */
  limit?: number;
}

/**
 * Scrape a single official-source URL.
 *
 * Specialists must look up the URL from
 * lib/agents/src/sources/official-sources.ts (or a slice exported
 * from it) — they MUST NOT pass a fabricated URL. The whitelist
 * is the moat; this wrapper is just the network boundary.
 */
export async function scrapeOfficialSource(
  url: string,
  options: ScrapeOptions = {},
): Promise<ScrapeResult> {
  const retrievedAt = new Date().toISOString();

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return { ok: false, url, retrievedAt, reason: "FIRECRAWL_API_KEY not configured" };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_SCRAPE_TIMEOUT_MS;
  const waitForMs = options.waitForMs ?? DEFAULT_WAIT_FOR_MS;

  // Combined abort: external signal (specialist budget) OR per-call timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("scrape-timeout")), timeoutMs);
  const onExternalAbort = () => controller.abort(new Error("external-abort"));
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer);
      return { ok: false, url, retrievedAt, reason: "external signal already aborted" };
    }
    options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: waitForMs,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        url,
        retrievedAt,
        reason: `Firecrawl HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      };
    }

    const data = (await response.json()) as { data?: { markdown?: string } };
    const markdown = data?.data?.markdown;
    if (!markdown || markdown.trim().length === 0) {
      return { ok: false, url, retrievedAt, reason: "Firecrawl returned empty markdown" };
    }
    return { ok: true, url, markdown, retrievedAt };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, url, retrievedAt, reason };
  } finally {
    clearTimeout(timer);
    if (options.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
  }
}

/**
 * Run a Firecrawl search query and scrape the top hits.
 *
 * Specialists should prefer scrapeOfficialSource against a known
 * whitelist URL when one exists. Use search-and-scrape only as a
 * supplement (e.g. visa specialist looking up "Sweden work permit
 * processing time") and treat the returned URLs as evidence of a
 * genuine scrape — never as fabricated citations.
 */
export async function searchAndScrape(
  query: string,
  options: SearchOptions = {},
): Promise<SearchAndScrapeResult> {
  const retrievedAt = new Date().toISOString();

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return { ok: false, query, pages: [], retrievedAt, reason: "FIRECRAWL_API_KEY not configured" };
  }

  const limit = Math.max(1, Math.min(options.limit ?? 3, 5));
  const timeoutMs = options.timeoutMs ?? DEFAULT_SCRAPE_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("search-timeout")), timeoutMs);
  const onExternalAbort = () => controller.abort(new Error("external-abort"));
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer);
      return { ok: false, query, pages: [], retrievedAt, reason: "external signal already aborted" };
    }
    options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        query,
        pages: [],
        retrievedAt,
        reason: `Firecrawl search HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      };
    }

    const data = (await response.json()) as { data?: { url?: string; markdown?: string }[] };
    const pages = (data?.data || [])
      .map((item) => ({ url: item.url, markdown: item.markdown || "" }))
      .filter((p) => p.markdown.trim().length > 0);

    if (pages.length === 0) {
      return { ok: false, query, pages: [], retrievedAt, reason: "Firecrawl search returned no usable pages" };
    }
    return { ok: true, query, pages, retrievedAt };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, query, pages: [], retrievedAt, reason };
  } finally {
    clearTimeout(timer);
    if (options.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
  }
}
