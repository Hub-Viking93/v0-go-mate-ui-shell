// =============================================================
// @workspace/agents — fetchWithRetry (snapshot)
// =============================================================
// Verbatim port of .migration-backup/lib/gomate/fetch-with-retry.ts.
// Pure utility — no transitive deps. Used by exchange-rate.ts
// and (transitively) by callers that hit Frankfurter, Numbeo
// fallback URLs, etc. Firecrawl uses its own retry inside
// scraping/firecrawl.ts.
// =============================================================

/**
 * Fetch with AbortController timeout and exponential backoff retry.
 *
 * @param url         Target URL
 * @param options     RequestInit (do not include signal — this function manages it)
 * @param timeoutMs   Per-attempt timeout in milliseconds (default 15_000)
 * @param maxAttempts Maximum number of attempts, including the first (default 3)
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15_000,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      // Don't retry 4xx responses — they indicate a client-side problem
      // Exception: 429 (rate limit) should be retried with backoff
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) return res;

      // 5xx: server error — retry
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      if (attempt < maxAttempts - 1) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }

  throw lastError;
}
