// =============================================================
// @workspace/agents — web-research helpers (subset)
// =============================================================
// Subset port of .migration-backup/lib/gomate/web-research.ts.
//
// Includes ONLY the pure budget-math helpers needed by the cost
// specialist:
//   * CostOfLivingData type
//   * getCostOfLivingData(country, city)  — falls back to Numbeo placeholder
//   * calculateMonthlyBudget(profile, costData)
//   * calculateSavingsTarget(profile, monthlyBudget)
//
// EXCLUDED from this port:
//   * scrapeUrl / searchAndScrape — replaced by the centralised
//     scraping/firecrawl.ts wrapper.
//   * fetchLiveCostOfLiving / fetchVisaInfo / fetchHousingInfo /
//     performComprehensiveResearch — replaced by individual
//     specialists in lib/agents/src/specialists/.
//   * formatResearchSummary / generateResearchReport — markdown
//     rendering belongs in the gomate UI / guide-composer, not
//     here.
// =============================================================

import { getGenericFallbackData, type NumbeoData } from "./numbeo-data.js";

export interface CostOfLivingData {
  city: string;
  country: string;
  currency: string;
  monthlyRent1Bed: { city: number; outside: number };
  monthlyRent3Bed: { city: number; outside: number };
  utilities: number;
  internet: number;
  mealInexpensive: number;
  mealMidRange: number;
  groceries: number;
  transportation: number;
  overallIndex: number;
  source: string;
  lastUpdated: string;
}

/**
 * Profile shape used by the budget helpers. Subset of the full
 * intake profile — only fields these helpers actually read. Kept
 * loose (`string | number | null | undefined`) because intake
 * stores most values as strings.
 */
export interface BudgetProfile {
  destination?: string | null;
  target_city?: string | null;
  moving_alone?: string | null;
  number_of_children?: string | number | null;
  children_count?: string | number | null;
  timeline?: string | null;
}

function numbeoToCostOfLiving(data: NumbeoData): CostOfLivingData {
  return {
    city: data.city,
    country: data.country,
    currency: data.currency || "USD",
    monthlyRent1Bed: {
      city: data.rent?.apartment1BedCity || 1000,
      outside: data.rent?.apartment1BedOutside || 700,
    },
    monthlyRent3Bed: {
      city: data.rent?.apartment3BedCity || 1800,
      outside: data.rent?.apartment3BedOutside || 1200,
    },
    utilities: data.utilities?.basic || 150,
    internet: data.utilities?.internet || 40,
    mealInexpensive: data.food?.mealInexpensive || 12,
    mealMidRange: data.food?.mealMidRange || 45,
    groceries: (data.food?.mealInexpensive || 12) * 20,
    transportation: data.transportation?.monthlyPass || 75,
    overallIndex: data.costOfLivingIndex || 65,
    source: data.source,
    lastUpdated: data.lastUpdated,
  };
}

/** Get a baseline cost-of-living shape for a country/city. */
export function getCostOfLivingData(country: string, city?: string): CostOfLivingData | null {
  const numbeoData = getGenericFallbackData(city, country);
  return numbeoToCostOfLiving(numbeoData);
}

function readChildrenCount(profile: BudgetProfile): number {
  const raw = profile.children_count ?? profile.number_of_children;
  if (raw === undefined || raw === null) return 0;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Calculate monthly budget based on profile and cost-of-living baseline. */
export function calculateMonthlyBudget(
  profile: BudgetProfile,
  costData: CostOfLivingData,
): {
  minimum: number;
  comfortable: number;
  breakdown: Record<string, number>;
} {
  const isFamily = profile.moving_alone === "no";
  const hasKids = readChildrenCount(profile) > 0;
  const rentMultiplier = isFamily ? 1.5 : 1;
  const foodMultiplier = isFamily ? (hasKids ? 2.5 : 2) : 1;

  const rent = costData.monthlyRent1Bed.city * rentMultiplier;
  const utilities = costData.utilities * (isFamily ? 1.3 : 1);
  const groceries = costData.groceries * foodMultiplier;
  const transportation = costData.transportation * (isFamily ? 1.5 : 1);
  const internet = costData.internet;
  const misc = 200 * (isFamily ? 1.5 : 1);

  const minimum = rent + utilities + groceries + transportation + internet + misc;
  const comfortable = minimum * 1.3;

  return {
    minimum: Math.round(minimum),
    comfortable: Math.round(comfortable),
    breakdown: {
      rent: Math.round(rent),
      utilities: Math.round(utilities),
      groceries: Math.round(groceries),
      transportation: Math.round(transportation),
      internet: Math.round(internet),
      miscellaneous: Math.round(misc),
    },
  };
}

/** Calculate savings target before moving based on profile + monthly budget. */
export function calculateSavingsTarget(
  profile: BudgetProfile,
  monthlyBudget: number,
): {
  emergencyFund: number;
  movingCosts: number;
  initialSetup: number;
  visaFees: number;
  total: number;
  timeline: string;
} {
  const destination = profile.destination?.toLowerCase() || "";

  const emergencyFund = monthlyBudget * 3;
  const movingCosts = 2000;
  const initialSetup = monthlyBudget * 2;

  let visaFees = 500;
  if (destination.includes("united states")) visaFees = 1500;
  else if (destination.includes("canada")) visaFees = 800;
  else if (destination.includes("australia")) visaFees = 1200;
  else if (destination.includes("united kingdom")) visaFees = 1000;
  else if (destination.includes("japan")) visaFees = 400;
  else if (destination.includes("germany") || destination.includes("netherlands")) visaFees = 300;

  const total = emergencyFund + movingCosts + initialSetup + visaFees;

  let timeline = "Start saving now";
  const timelineStr = profile.timeline?.toLowerCase() || "";
  if (timelineStr.includes("asap") || timelineStr.includes("soon")) {
    timeline = "Aim to save within 2-3 months";
  } else if (timelineStr.includes("6 month") || timelineStr.includes("half")) {
    timeline = "Save steadily over 4-5 months";
  } else if (timelineStr.includes("year") || timelineStr.includes("12 month")) {
    timeline = "You have time - save a consistent amount monthly";
  }

  return {
    emergencyFund: Math.round(emergencyFund),
    movingCosts: Math.round(movingCosts),
    initialSetup: Math.round(initialSetup),
    visaFees: Math.round(visaFees),
    total: Math.round(total),
    timeline,
  };
}
