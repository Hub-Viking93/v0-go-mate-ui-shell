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
import { getFxRate } from "../lib/fx";

const router: IRouter = Router();

type EstimatedBudget = { single?: number; couple?: number; family4?: number };
type Numbeo = {
  city?: string;
  country?: string;
  currency: string;
  costOfLivingIndex: number;
  rentIndex: number;
  estimatedMonthlyBudget?: {
    single: { minimum: number; comfortable: number };
    couple: { minimum: number; comfortable: number };
    family4: { minimum: number; comfortable: number };
  };
  [k: string]: unknown;
};

/**
 * Multiply every numeric monthly-budget figure in a Numbeo-shaped
 * payload by `rate` and update the currency label. Index fields
 * (cost-of-living, rent, etc.) are relative — they do NOT scale with
 * FX. Only the absolute monthly-budget amounts move.
 */
function applyFxToNumbeo(data: Numbeo, rate: number, toCurrency: string): Numbeo {
  if (!data.estimatedMonthlyBudget) {
    return { ...data, currency: toCurrency };
  }
  const scale = (n: number) => Math.round(n * rate);
  return {
    ...data,
    currency: toCurrency,
    estimatedMonthlyBudget: {
      single: {
        minimum: scale(data.estimatedMonthlyBudget.single.minimum),
        comfortable: scale(data.estimatedMonthlyBudget.single.comfortable),
      },
      couple: {
        minimum: scale(data.estimatedMonthlyBudget.couple.minimum),
        comfortable: scale(data.estimatedMonthlyBudget.couple.comfortable),
      },
      family4: {
        minimum: scale(data.estimatedMonthlyBudget.family4.minimum),
        comfortable: scale(data.estimatedMonthlyBudget.family4.comfortable),
      },
    },
  };
}

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
  // Optional: if the frontend passes `?to=PHP` we convert the
  // monthly-budget figures from the source USD baseline into the
  // user's preferred currency before responding. Frontend stays
  // currency-naive — it just renders whatever the API sent.
  const userCurrency =
    typeof req.query.to === "string" ? req.query.to.toUpperCase() : null;

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
  let to: Numbeo = {
    ...getGenericFallbackData(city ?? undefined, country),
    currency: "USD",
  } as unknown as Numbeo;

  if (compareFromCountry) {
    let from: Numbeo = {
      ...getGenericFallbackData(compareFromCity ?? undefined, compareFromCountry),
      currency: "USD",
    } as unknown as Numbeo;
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

    if (userCurrency && userCurrency !== "USD") {
      const rate = await getFxRate("USD", userCurrency);
      if (rate !== null) {
        to = applyFxToNumbeo(to, rate, userCurrency);
        from = applyFxToNumbeo(from, rate, userCurrency);
      }
    }

    res.json({ from, to, comparison: { overallDifference, rentDifference, summary } });
    return;
  }

  if (userCurrency && userCurrency !== "USD") {
    const rate = await getFxRate("USD", userCurrency);
    if (rate !== null) {
      to = applyFxToNumbeo(to, rate, userCurrency);
    }
  }

  res.json(to);
});

export default router;
