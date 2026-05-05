// =============================================================
// Server-side FX helper — single source for Frankfurter (ECB)
// rate lookups. Used by /api/exchange-rate, /api/cost-of-living
// (currency conversion), and the research orchestrator's FX-bake
// step. Module-scoped 1h TTL cache keeps Frankfurter calls minimal.
// =============================================================

import { logger } from "./logger";

const TTL_MS = 60 * 60 * 1000; // 1h
type CachedRate = { rate: number | null; fetchedAt: number };
const cache = new Map<string, CachedRate>();

function key(from: string, to: string): string {
  return `${from.toUpperCase()}:${to.toUpperCase()}`;
}

export async function getFxRate(from: string, to: string): Promise<number | null> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return 1;

  const k = key(f, t);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.rate;

  try {
    const ctl = new AbortController();
    const timeout = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`,
      { signal: ctl.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) {
      logger.warn({ from: f, to: t, status: res.status }, "[fx] non-200");
      cache.set(k, { rate: null, fetchedAt: Date.now() });
      return null;
    }
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data?.rates?.[t];
    const value = typeof rate === "number" ? rate : null;
    cache.set(k, { rate: value, fetchedAt: Date.now() });
    return value;
  } catch (err) {
    logger.warn({ from: f, to: t, err }, "[fx] fetch failed");
    cache.set(k, { rate: null, fetchedAt: Date.now() });
    return null;
  }
}
