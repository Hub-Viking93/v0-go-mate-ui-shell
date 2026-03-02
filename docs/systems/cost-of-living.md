# Cost of Living System — System Document

**Phase:** 3.2
**Status:** Reality-first (documents what exists)
**Primary sources:**
- `lib/gomate/numbeo-scraper.ts` (801 lines)
- `lib/gomate/web-research.ts` (714 lines)
- `app/api/cost-of-living/route.ts` (106 lines)
**Last audited:** 2026-02-25

---

## 1. Overview

The cost of living system provides monthly budget estimates for relocation destinations. It operates across two separate modules with different interfaces and data shapes, serving different callers:

| Module | Consumer | Data shape | Source priority |
|---|---|---|---|
| `numbeo-scraper.ts` | `app/api/cost-of-living/route.ts` (UI requests) | `NumbeoData` (granular, 40+ fields) | Cache → Fallback DB → Live Firecrawl scrape → Generic fallback |
| `web-research.ts` | `app/api/chat/route.ts` (metadata) | `CostOfLivingData` (simplified, 10 fields) | Fallback only (no live fetch in this path) |

Both modules cover approximately the same destinations but with different levels of granularity. There is no shared source of truth between them.

---

## 2. numbeo-scraper.ts

### 2.1 Purpose

Fetches granular cost of living data from Numbeo.com for a specific city/country. Provides city-level comparison capabilities. Used by the `/api/cost-of-living` API endpoint.

### 2.2 NumbeoData Interface

```typescript
interface NumbeoData {
  city: string
  country: string
  currency: string
  rent: {
    apartment1BedCity: number
    apartment1BedOutside: number
    apartment3BedCity: number
    apartment3BedOutside: number
  }
  utilities: { basic, internet, mobile }
  food: { mealInexpensive, mealMidRange, mcMeal, domesticBeer, importedBeer,
          cappuccino, water1_5L, milk1L, bread, eggs12, chicken1kg, rice1kg, apples1kg }
  transportation: { monthlyPass, oneWayTicket, taxiStart, taxi1km, gasolinePerLiter }
  healthcare: { doctorVisit, dentistVisit }
  fitness: { gymMonthly, cinemaTicket }
  childcare: { preschoolMonthly, primarySchoolYearly }
  clothing: { jeans, summerDress, runningShoes, businessShoes }
  costOfLivingIndex: number
  rentIndex: number
  groceriesIndex: number
  restaurantPriceIndex: number
  purchasingPowerIndex: number
  estimatedMonthlyBudget: {
    single: { minimum, comfortable }
    couple: { minimum, comfortable }
    family4: { minimum, comfortable }
  }
  source: string
  lastUpdated: string
}
```

### 2.3 Data Resolution Priority

`getCostOfLivingFromNumbeo()` follows a strict priority order designed to minimize Firecrawl API calls:

```
1. In-memory cache (24-hour TTL, Map<string, {data, timestamp}>)
   │
2. Fallback DB match (FALLBACK_DATA by city name)
   │ ← NOTE: If fallback data exists, Firecrawl is SKIPPED
   │   Comment: "skip Firecrawl to avoid 402 errors"
   │
3. Firecrawl live scrape (only if no fallback AND FIRECRAWL_API_KEY present)
   │ ├── Try city URL: numbeo.com/cost-of-living/in/{City}
   │ └── If fails: try country URL: numbeo.com/cost-of-living/country_result.jsp?country={Country}
   │
4. Generic fallback (always returns valid data — never returns null)
```

**Implication:** For the 10 cities in `FALLBACK_DATA` (Tokyo, Berlin, Amsterdam, Lisbon, Barcelona, London, Paris, Dubai, Singapore, Sydney), Firecrawl is never called. Live data is only attempted for unknown cities.

### 2.4 FALLBACK_DATA — Pre-compiled City Data

10 cities with complete NumbeoData snapshots (all amounts in USD):

| City | Country | Currency | 1-bed city rent | Single min budget |
|---|---|---|---|---|
| Tokyo | Japan | JPY | $1,200 | $1,800 |
| Berlin | Germany | EUR | $1,100 | $1,600 |
| Amsterdam | Netherlands | EUR | $1,800 | $2,200 |
| Lisbon | Portugal | EUR | $1,200 | $1,400 |
| Barcelona | Spain | EUR | $1,100 | $1,500 |
| London | United Kingdom | GBP | $2,200 | $2,800 |
| Paris | France | EUR | $1,400 | $2,000 |
| Dubai | United Arab Emirates | AED | $1,800 | $2,200 |
| Singapore | Singapore | SGD | $2,500 | $2,800 |
| Sydney | Australia | AUD | $2,200 | $2,600 |

**Gap:** Data is listed in "USD" but labeled with local currency codes. The amounts are actually in the local currency (EUR for Berlin, GBP for London, etc.) since Numbeo reports in local currency. The currency field and the amounts are mismatched in their semantics.

**Gap:** Data has no update mechanism. `lastUpdated` is set to `new Date().toISOString().split("T")[0]` at module load time — it shows today's date regardless of when the data was actually collected. The data is frozen in code.

### 2.5 URL Construction

`getNumbeoUrl()` builds city-specific Numbeo URLs:

```
Major cities (46 recognized) → https://www.numbeo.com/cost-of-living/in/{City}
Other cities → https://www.numbeo.com/cost-of-living/in/{City}-{Country}
```

`getNumbeoCountryUrl()` builds country fallback URLs:
```
https://www.numbeo.com/cost-of-living/country_result.jsp?country={encoded country}
```

### 2.6 parseNumbeoContent()

Regex-based parser that extracts costs from Firecrawl's markdown output. Uses a helper `extractPrice()` that tries multiple regex patterns per data point.

**Fragility:** Regex parsing of Numbeo's HTML-to-markdown conversion is inherently brittle. Numbeo can change their page structure, and the regex patterns would silently stop matching, returning `0` or `null` for affected fields (with hardcoded defaults as fallback).

### 2.7 scrapeNumbeo()

Has a 15-second `AbortController` timeout — the only Firecrawl call in the system with an explicit client-side timeout. Uses `waitFor: 3000` (3-second page render wait).

### 2.8 compareCostOfLiving()

Compares two cities by fetching both via `getCostOfLivingFromNumbeo()` in parallel. Returns rent difference %, overall budget difference %, and a descriptive summary string.

### 2.9 getGenericFallbackData()

Always returns valid NumbeoData — never null. Used as the last resort. Returns "Estimated data (generic fallback)" as source. This ensures the API always returns something even for completely unknown destinations.

---

## 3. web-research.ts — Simplified Cost System

### 3.1 Purpose

Provides a simpler cost of living interface used exclusively by `chat/route.ts` for metadata assembly. Uses pre-compiled country-level estimates rather than city-level scraping.

### 3.2 CostOfLivingData Interface

```typescript
interface CostOfLivingData {
  city: string
  country: string
  monthlyRent1Bed: { city: number; outside: number }
  monthlyRent3Bed: { city: number; outside: number }
  utilities: number
  internet: number
  mealInexpensive: number
  mealMidRange: number
  groceries: number
  transportation: number
  overallIndex: number
  source: string
  lastUpdated: string
}
```

This is a different and simpler interface than `NumbeoData` from `numbeo-scraper.ts`.

### 3.3 COST_OF_LIVING_ESTIMATES — 12 Countries

Pre-compiled **country-level** estimates (no city granularity, keyed by lowercase country name):

| Country | 1-bed city rent | Overall index |
|---|---|---|
| germany | $900 | 65 |
| netherlands | $1,400 | 75 |
| sweden | $1,100 | 70 |
| spain | $850 | 55 |
| portugal | $900 | 50 |
| france | $1,100 | 70 |
| italy | $800 | 60 |
| japan | $700 | 75 |
| canada | $1,500 | 72 |
| australia | $1,600 | 78 |
| united kingdom | $1,500 | 72 |
| united states | $1,800 | 75 |

**Gap:** The city and country cost estimates in this file use different values than the FALLBACK_DATA in `numbeo-scraper.ts` for the same destinations. For example, `web-research.ts` gives Germany rent as $900 but `numbeo-scraper.ts` gives Berlin as $1,100. These are inconsistent estimates from two independent tables.

### 3.4 getCostOfLivingData()

Synchronous lookup into `COST_OF_LIVING_ESTIMATES` by normalized lowercase country name. Returns `null` if country not found (unlike `numbeo-scraper.ts` which always returns something). This is called synchronously in `chat/route.ts` — no async fetch.

### 3.5 calculateMonthlyBudget()

Computes a monthly budget breakdown from `CostOfLivingData` and profile:

```
Rent multiplier: isFamily ? 1.5 : 1.0
Food multiplier: isFamily ? (hasKids ? 2.5 : 2.0) : 1.0

minimum = rent + utilities + groceries + transportation + internet + misc($200)
comfortable = minimum × 1.3

Returns: { minimum, comfortable, breakdown: { rent, utilities, groceries, transportation, internet, miscellaneous } }
```

**Note:** `profile.number_of_children` (line 524) is used to check `hasKids`, but the actual profile schema field is `children_count` (a name mismatch — `number_of_children` does not exist in the Profile type).

### 3.6 calculateSavingsTarget()

Computes pre-move savings requirement:

```
emergencyFund = monthlyBudget × 3
movingCosts = $2,000 (hardcoded flat)
initialSetup = monthlyBudget × 2
visaFees: hardcoded per destination:
  - United States: $1,500
  - Canada: $800
  - Australia: $1,200
  - United Kingdom: $1,000
  - Japan: $400
  - Germany/Netherlands: $300
  - All others: $500

total = emergencyFund + movingCosts + initialSetup + visaFees

timeline: string advice based on profile.timeline keyword matching
```

### 3.7 generateResearchReport()

Produces a markdown report string combining cost summary, purpose-specific tips (study/work/digital_nomad), and a generic "General Relocation Checklist" section. Sent to the client in `metadata.researchReport` when the profile is complete.

### 3.8 fetchLiveCostOfLiving()

An async function that searches Numbeo via Firecrawl and attempts regex extraction. Has 24-hour in-memory cache. However, this function is **not called by `chat/route.ts`** — `chat/route.ts` calls `getCostOfLivingData()` (the synchronous fallback-only function), not `fetchLiveCostOfLiving()`. The live fetch capability in `web-research.ts` exists but goes unused in the main chat flow.

---

## 4. app/api/cost-of-living/route.ts

### 4.1 GET Handler

Single endpoint for UI cost of living requests.

```typescript
GET /api/cost-of-living?country=Germany&city=Berlin
GET /api/cost-of-living?country=Germany&city=Berlin&compareFrom=Tokyo&compareFromCountry=Japan
```

| Mode | Action |
|---|---|
| Single lookup | `getCostOfLivingFromNumbeo(country, city)` from numbeo-scraper.ts |
| Comparison | `compareCostOfLiving(fromCity, fromCountry, toCity, toCountry)` |

**Never returns error:** On `!data` or exception, returns `getGenericFallbackData()` with `isFallback: true`. The API always returns 200.

### 4.2 POST Handler

Saves user cost preferences to `profile_data.cost_preferences` JSONB:
```typescript
{ lifestyleLevel: "minimum" | "comfortable" | "luxury", includeItems: {...} }
```

This is a write to the profile JSONB blob, not a structured column. The `cost_preferences` shape is not validated.

---

## 5. Gap Analysis — Critical Findings

### G-3.2-A: Two parallel cost systems with inconsistent data

`numbeo-scraper.ts` (used by API) and `web-research.ts` (used by chat metadata) maintain separate cost estimates for the same countries. The values differ. A user who looks at the chat response and the cost-of-living dashboard will see different numbers for the same destination.

### G-3.2-B: number_of_children field name mismatch

`calculateMonthlyBudget()` references `profile.number_of_children` (line 524 of web-research.ts) but the schema field is `children_count`. The `hasKids` variable will always be falsy (property doesn't exist), so family multipliers for food costs will always use the non-kids multiplier.

### G-3.2-C: FALLBACK_DATA currency labels are misleading

`numbeo-scraper.ts` FALLBACK_DATA sets `currency: "EUR"` for European cities and `currency: "JPY"` for Tokyo, but the actual amounts are stored in USD (or are meant to be USD equivalents). The `currency` field is inconsistently used.

### G-3.2-D: No data staleness contract

`lastUpdated` in FALLBACK_DATA is computed as `new Date().toISOString().split("T")[0]` at module load — it reflects today's date, not when the data was actually collected. There is no mechanism to detect or signal stale data.

### G-3.2-E: Live Firecrawl path is effectively disabled for known destinations

The `getCostOfLivingFromNumbeo()` function returns fallback data if a city/country match is found in FALLBACK_DATA, **before** attempting a live scrape. Since all 10 FALLBACK_DATA cities are the most common destinations, live scraping is almost never triggered in practice.

### G-3.2-F: fetchLiveCostOfLiving() in web-research.ts is unused

This async function exists and has a 24-hour cache, but `chat/route.ts` calls `getCostOfLivingData()` (synchronous, fallback-only) instead. The live fetch path in `web-research.ts` is dead code.

### G-3.2-G: Savings target uses hardcoded flat moving cost

`movingCosts = $2,000` is hardcoded regardless of distance, number of family members, or amount of belongings. This is a rough estimate that is never adjusted for profile context.

---

## 6. Target State

| Item | Current | Target |
|---|---|---|
| Two separate cost modules | `numbeo-scraper.ts` + `web-research.ts` | Consolidate to single source; one interface |
| FALLBACK_DATA | Frozen code snapshots | External data store with versioning + staleness tracking |
| number_of_children field name | Wrong field name in calculateMonthlyBudget | Fix to `children_count` |
| Live scraping disabled for known cities | Fallback always preferred | Explicit TTL: if fallback data age > 30 days, attempt live refresh |
| Currency labels | Inconsistent | Clarify all amounts as USD equivalents or use actual local currency |
| fetchLiveCostOfLiving() | Dead code | Either remove or wire it into the chat metadata flow |
| Cost preferences | Unvalidated blob in JSONB | Add validation schema for lifestyleLevel + includeItems |
