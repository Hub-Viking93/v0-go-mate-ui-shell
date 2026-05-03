// =============================================================
// GET /api/cost-of-living — minimal v0 endpoint
// =============================================================
// The frontend cost-of-living-card and affordability-card both call
// `GET /api/cost-of-living?country=...&city=...&compareFrom=...&compareFromCountry=...`
// expecting a NumbeoData-shaped JSON. We don't yet have a Numbeo
// scraper (and Numbeo's ToS prohibits direct scraping), so this
// endpoint returns the deterministic fallback shipped with the
// agents package (`getGenericFallbackData`) plus a comparison block
// when both ends of the move are supplied.
//
// Fallback values are USD-magnitude defaults; the endpoint sets the
// `currency` field to the destination country's currency via
// `getCurrencyFromCountry`, and the response includes
// `source: "Estimated data (generic fallback)"` so the UI can label
// it appropriately. Real per-city data will replace this once we
// land the cost specialist's output → DB persistence path.
//
// Auth-required to keep the same surface as every other /api route.
// =============================================================

import { Router, type IRouter } from "express";
import { getGenericFallbackData } from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";

const router: IRouter = Router();

router.get("/cost-of-living", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;

  const country =
    typeof req.query.country === "string" ? req.query.country : null;
  const city = typeof req.query.city === "string" ? req.query.city : null;
  const compareFromCountry =
    typeof req.query.compareFromCountry === "string"
      ? req.query.compareFromCountry
      : null;
  const compareFromCity =
    typeof req.query.compareFrom === "string" ? req.query.compareFrom : null;

  if (!country) {
    res.status(400).json({ error: "country query param is required" });
    return;
  }

  // The fallback function sets the field `currency` to the country's
  // local currency, but the numeric values are USD-magnitude placeholders.
  // Force currency back to USD so the displayed magnitudes match the
  // currency label — otherwise Stockholm rent reads "1200 SEK" which is
  // wildly off. The UI labels these as "Estimated" via `source`, so this
  // is honest about what we're showing until real per-city data lands.
  const to = { ...getGenericFallbackData(city ?? undefined, country), currency: "USD" };

  if (compareFromCountry) {
    const from = {
      ...getGenericFallbackData(compareFromCity ?? undefined, compareFromCountry),
      currency: "USD",
    };
    // The shape the comparison frontend expects:
    //   { from: NumbeoData|null, to: NumbeoData|null, comparison: {...}|null }
    // We compute a coarse comparison from the index numbers — good enough
    // for the v0 affordability card.
    const overallDifference =
      to.costOfLivingIndex - from.costOfLivingIndex;
    const rentDifference = to.rentIndex - from.rentIndex;
    const summary =
      overallDifference > 0
        ? `${to.city} is ~${overallDifference}% more expensive overall than ${from.city}`
        : overallDifference < 0
          ? `${to.city} is ~${Math.abs(overallDifference)}% cheaper overall than ${from.city}`
          : `${to.city} and ${from.city} have similar overall costs`;
    res.json({ from, to, comparison: { overallDifference, rentDifference, summary } });
    return;
  }

  res.json(to);
});

export default router;
