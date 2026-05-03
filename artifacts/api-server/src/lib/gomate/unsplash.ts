// =============================================================
// Unsplash hero-image lookup
// =============================================================
// Picks a city/country hero image for a generated guide. Pure REST
// against api.unsplash.com — no SDK. Failure is non-fatal: callers
// should `.catch(() => null)` and fall back to no hero image.
//
// Env: UNSPLASH_ACCESS_KEY (free tier — 50 req/h is plenty for the
// volumes we hit during the buildathon).
// =============================================================

import { logger } from "../logger";

export interface HeroImage {
  id: string;
  url: string;
  photographerName: string;
  photographerUrl: string;
}

const UNSPLASH_BASE = "https://api.unsplash.com";

export async function resolveHeroImage(query: string): Promise<HeroImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    logger.warn("[unsplash] UNSPLASH_ACCESS_KEY not set — skipping hero image");
    return null;
  }
  if (!query || query.trim().length === 0) return null;

  // Bias the query toward editorial cityscapes — cleaner thumbnails.
  const refined = `${query} cityscape`;
  const url = `${UNSPLASH_BASE}/search/photos?query=${encodeURIComponent(refined)}&per_page=5&orientation=landscape&content_filter=high`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
    });
    if (!res.ok) {
      logger.warn({ status: res.status, query }, "[unsplash] non-OK response");
      return null;
    }
    const json = (await res.json()) as {
      results?: Array<{
        id: string;
        urls: { regular: string; full: string };
        user: { name: string; links: { html: string } };
      }>;
    };
    const first = json.results?.[0];
    if (!first) return null;
    return {
      id: first.id,
      url: first.urls.regular,
      photographerName: first.user.name,
      photographerUrl: `${first.user.links.html}?utm_source=gomate&utm_medium=referral`,
    };
  } catch (err) {
    logger.warn({ err, query }, "[unsplash] fetch threw");
    return null;
  }
}
