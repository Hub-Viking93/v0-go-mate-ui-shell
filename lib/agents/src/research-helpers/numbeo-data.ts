// =============================================================
// @workspace/agents — NumbeoData type + getGenericFallbackData
// =============================================================
// Subset port of .migration-backup/lib/gomate/numbeo-scraper.ts.
//
// Why a subset? The original file scraped Numbeo directly via
// Firecrawl, which violates Numbeo's ToS. We only need:
//   * NumbeoData type — used by web-research.ts to shape the
//     CostOfLivingData output for the cost specialist.
//   * getGenericFallbackData(city, country) — last-resort
//     placeholder so the cost path always has a defined shape
//     when Firecrawl fails or returns nothing parseable.
//
// Real cost-of-living estimates come from the cost_specialist
// LLM call (Sonnet 4.5) which receives the destination city +
// scraped official housing/employment URLs and produces a
// realistic local-currency budget. The generic fallback below
// is intentionally USD-magnitude defaults so callers can spot
// it via `source: "Estimated data (generic fallback)"`.
//
// TODO[wave-2.x-unify-schema]: promote into a shared package
// alongside the gomate-side numbeo-scraper.
// =============================================================

import { getCurrencyFromCountry } from "./currency.js";

export interface NumbeoData {
  city: string;
  country: string;
  currency: string;

  rent: {
    apartment1BedCity: number;
    apartment1BedOutside: number;
    apartment3BedCity: number;
    apartment3BedOutside: number;
  };

  utilities: {
    basic: number; // electricity, heating, cooling, water, garbage
    internet: number;
    mobile: number;
  };

  food: {
    mealInexpensive: number;
    mealMidRange: number;
    mcMeal: number;
    domesticBeer: number;
    importedBeer: number;
    cappuccino: number;
    water1_5L: number;
    milk1L: number;
    bread: number;
    eggs12: number;
    chicken1kg: number;
    rice1kg: number;
    apples1kg: number;
  };

  transportation: {
    monthlyPass: number;
    oneWayTicket: number;
    taxiStart: number;
    taxi1km: number;
    gasolinePerLiter: number;
  };

  healthcare: {
    doctorVisit: number;
    dentistVisit: number;
  };

  fitness: {
    gymMonthly: number;
    cinemaTicket: number;
  };

  childcare: {
    preschoolMonthly: number;
    primarySchoolYearly: number;
  };

  clothing: {
    jeans: number;
    summerDress: number;
    runningShoes: number;
    businessShoes: number;
  };

  costOfLivingIndex: number;
  rentIndex: number;
  groceriesIndex: number;
  restaurantPriceIndex: number;
  purchasingPowerIndex: number;

  estimatedMonthlyBudget: {
    single: { minimum: number; comfortable: number };
    couple: { minimum: number; comfortable: number };
    family4: { minimum: number; comfortable: number };
  };

  source: string;
  lastUpdated: string;
}

/**
 * Generic last-resort fallback used when no real data is available.
 * Numbers are USD-magnitude placeholders; the country's actual
 * currency is set via getCurrencyFromCountry so downstream code
 * doesn't break on `currency`. Consumers MUST surface an
 * "Estimated" UI state — the `source` string is the signal.
 */
export function getGenericFallbackData(city?: string, country?: string): NumbeoData {
  const resolvedCurrency = (country && getCurrencyFromCountry(country)) || "USD";
  return {
    city: city || "Unknown City",
    country: country || "Unknown Country",
    currency: resolvedCurrency,
    rent: { apartment1BedCity: 1200, apartment1BedOutside: 900, apartment3BedCity: 2200, apartment3BedOutside: 1600 },
    utilities: { basic: 150, internet: 50, mobile: 30 },
    food: { mealInexpensive: 15, mealMidRange: 40, mcMeal: 9, domesticBeer: 5, importedBeer: 6, cappuccino: 4, water1_5L: 1.5, milk1L: 1.5, bread: 2, eggs12: 3.5, chicken1kg: 10, rice1kg: 2, apples1kg: 3 },
    transportation: { monthlyPass: 70, oneWayTicket: 2.5, taxiStart: 3.5, taxi1km: 1.5, gasolinePerLiter: 1.5 },
    healthcare: { doctorVisit: 60, dentistVisit: 80 },
    fitness: { gymMonthly: 40, cinemaTicket: 12 },
    childcare: { preschoolMonthly: 800, primarySchoolYearly: 12000 },
    clothing: { jeans: 55, summerDress: 45, runningShoes: 90, businessShoes: 110 },
    costOfLivingIndex: 60,
    rentIndex: 40,
    groceriesIndex: 50,
    restaurantPriceIndex: 55,
    purchasingPowerIndex: 80,
    estimatedMonthlyBudget: {
      single: { minimum: 1800, comfortable: 3000 },
      couple: { minimum: 2800, comfortable: 4500 },
      family4: { minimum: 4500, comfortable: 7000 },
    },
    source: "Estimated data (generic fallback)",
    lastUpdated: new Date().toISOString().split("T")[0],
  };
}
