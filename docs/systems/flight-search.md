# Flight Search — System Document

**Phase:** 4.4
**Status:** Reality-first (documents what exists)
**Primary sources:**
- `lib/gomate/flight-search.ts` (331 lines)
- `app/api/flights/route.ts` (88 lines)
- `lib/gomate/airports.ts` (140 lines — documented in Phase 3.5)
**Last audited:** 2026-03-14

---

## 1. Overview

The flight search system searches five travel platforms (Skyscanner, Google Flights, Momondo, Kayak, Kiwi.com) for flight options between two airports. All searches are performed via Firecrawl web scraping — there are no direct flight API integrations. The system surfaces booking links, not actual bookable flights.

**Critical limitation:** Flight data from web scraping is inherently unreliable. Flight availability and pricing are dynamic. A scraped result may be stale within minutes of retrieval. The system provides discovery links, not confirmed availability.

---

## 2. Data Structures

### 2.1 FlightSearchParams

```typescript
export interface FlightSearchParams {
  from: Airport           // full Airport object from airports.ts
  to: Airport
  departDate: string      // YYYY-MM-DD
  returnDate?: string     // optional — one-way if omitted
  travelers: number       // default 1
  cabinClass?: "economy" | "premium_economy" | "business" | "first"  // default "economy"
}
```

### 2.2 FlightResult

```typescript
export interface FlightResult {
  id: string              // "{source}-{timestamp}-{index}"
  source: FlightSource    // which platform this came from
  sourceUrl: string
  airline: string
  airlineLogo?: string    // not set by parseFlightData()
  price: number
  currency: string        // "EUR" or "USD" based on price symbol
  departureTime: string
  arrivalTime: string
  duration: string
  stops: number
  stopLocations?: string[]
  cabinClass: string      // always "Economy" from scraping
  bookingUrl: string
  amenities?: string[]    // not set by parseFlightData()
  baggageIncluded?: string  // not set by parseFlightData()
  scrapedAt: string
}
```

**Note:** `airlineLogo`, `amenities`, and `baggageIncluded` are only set by `generateMockFlights()`. `parseFlightData()` (the real scraping parser) never populates these fields.

### 2.3 FlightSearchResult

```typescript
export interface FlightSearchResult {
  source: FlightSource
  sourceName: string
  flights: FlightResult[]
  searchUrl: string
  scrapedAt: string
  error?: string
}
```

---

## 3. FLIGHT_SOURCES Registry

5 sources defined as a `const` tuple (typed as `readonly`):

| id | Name | Base URL |
|---|---|---|
| `skyscanner` | Skyscanner | skyscanner.com |
| `google` | Google Flights | google.com |
| `momondo` | Momondo | momondo.com |
| `kayak` | Kayak | kayak.com |
| `kiwi` | Kiwi.com | kiwi.com |

Each entry also has `searchPath`, `logo` path, and `color` hex.

---

## 4. Search URL Construction

`buildSearchUrl(source, params)` constructs a search URL for each provider using IATA codes and dates.

| Source | URL format |
|---|---|
| Skyscanner | `.../jfk/ber/260315/` with `?adults=1&cabinclass=economy` |
| Google Flights | Hardcoded base64 token — **not dynamic** |
| Momondo | `.../JFK-BER/2026-03-15/2026-03-22?sort=bestflight_a&fs=stops=~0` |
| Kayak | `.../JFK-BER/2026-03-15/2026-03-22?sort=bestflight_a&fs=stops=~0` |
| Kiwi | `.../jfk-ber/2026-03-15/no-return` (no-return for one-way) |

**Gap — Google Flights hardcoded URL:**

```typescript
case "google":
  return `${source.baseUrl}${source.searchPath}?hl=en&curr=USD&tfs=CBwQAhoqEgoyMDI2LTAzLTE1agwIA...`
```

The Google Flights case ignores `from`, `to`, `departDate`, and `returnDate`. It returns a hardcoded URL with a base64-encoded query that encodes a specific fixed search. Any flight search through the Google source returns the same URL regardless of the user's actual search parameters.

---

## 5. Flight Data Parsing

`parseFlightData(markdown, source, searchUrl)` extracts flight data from Firecrawl's markdown output using regex patterns:

```typescript
const pricePattern = /\$[\d,]+|\€[\d,]+|USD\s*[\d,]+|EUR\s*[\d,]+/gi
const timePattern  = /\d{1,2}:\d{2}\s*(AM|PM)?/gi
const durationPattern = /(\d+h\s*\d*m?|\d+\s*hr?\s*\d*\s*min?)/gi
const airlinePatterns = [/lufthansa/i, /united/i, /delta/i, /air france/i, ...]
```

**Processing logic:**
1. Extract all prices from markdown — skip prices outside $50–$10,000
2. Extract all timestamps → used as departure/arrival times by index pairing
3. Extract all duration strings
4. Scan for any of 20 hardcoded airline names
5. Detect `nonstop|non-stop|direct` or `1 stop|one stop` keywords

**Deterministic stop fallback:**

```typescript
const stops = hasNonstop && i === 0 ? 0 : hasOneStop ? 1 : i % 2
```

Stop count is now deterministic for unmatched cases, but still heuristic rather than provider-truthful. Flights that are neither explicitly nonstop nor 1-stop alternate between 0 and 1 stops based on result index.

**Output cap:** Maximum 5 results per source (`Math.min(prices.length, 5)`).

---

## 6. scrapeFlightSource()

Scrapes a single flight source using the Firecrawl JS SDK (same SDK as `checklist-generator.ts`):

```typescript
const result = await firecrawl.scrapeUrl(searchUrl, {
  formats: ["markdown"],
  timeout: 30000,
})
```

30-second timeout. On failure, returns `FlightSearchResult` with `flights: []` and `error` message. Errors do not throw — all 5 sources complete even if some fail.

---

## 7. searchFlights() — Main Search Function

```
searchFlights(params)
│
├── Fire all 5 sources in parallel: Promise.all(FLIGHT_SOURCES.map(scrapeFlightSource))
├── Flatten all flights into allFlights[]
│
├── cheapest  = allFlights sorted by price ascending [0]
├── fastest   = allFlights sorted by parseDuration() ascending [0]
└── bestValue = allFlights sorted by (price + duration_minutes × 10) ascending [0]
```

`parseDuration()` converts duration strings like `"8h 30m"` to total minutes.

**bestValue scoring:** `price + (duration_minutes × 10)`. A 1-hour shorter flight is worth $600 less in this formula (60 × 10 = 600). This is an arbitrary weighting with no documented justification.

---

## 8. generateMockFlights()

Produces 6 hardcoded mock flight results for development and demo use:

```typescript
const airlines = ["Lufthansa", "United Airlines", "Delta", "Air France", "KLM", "British Airways"]
const basePrices = [450, 520, 580, 620, 750, 890]
```

Prices are deterministic (`basePrices[i] + (i * 17) % 100`). Mock flights still include `airlineLogo`, `amenities`, and `baggageIncluded` fields that real scraping does not produce.

---

## 9. API Endpoints

### 9.1 POST /api/flights

Performs a flight search.

```
POST /api/flights
{
  from: string (IATA) | Airport,
  to: string (IATA) | Airport,
  departDate: string,
  returnDate?: string,
  travelers?: number,
  cabinClass?: string,
  useMock?: boolean
}
│
├── Validate from, to, departDate are present
├── Resolve IATA codes to Airport objects via getAirportByCode()
│   └── If code not in POPULAR_AIRPORTS (30 entries) → 400 "Invalid airport codes"
│
├── If useMock=true OR FIRECRAWL_API_KEY not set:
│   └── Return generateMockFlights() with isMock=true
│
└── searchFlights(params)
    → Return { results, allFlights, cheapest, fastest, bestValue, isMock: false }
```

**No authentication required.** The flights API is publicly accessible.

**Gap — airport code resolution:** `getAirportByCode()` only searches the 30-entry `POPULAR_AIRPORTS` list. If a user searches for a valid IATA code that is not in the 30-entry list (e.g., `"MAN"` for Manchester), the route returns `400 "Invalid airport codes"`, even though the airport is perfectly valid.

**Mock fallback:** If `FIRECRAWL_API_KEY` is not set in the environment, the system silently falls back to mock data without indicating to the caller why. `isMock: true` is included in the response, but this fallback is silent.

### 9.2 GET /api/flights

Returns available flight sources and popular airports for UI initialization:

```typescript
Response: {
  sources: Array<{ id, name, color }>
  popularAirports: POPULAR_AIRPORTS.slice(0, 20)  // first 20 of 30
}
```

---

## 10. Gap Analysis — Critical Findings

### G-4.4-A: Google Flights URL is hardcoded and non-dynamic

The Google Flights search URL construction ignores all search parameters (`from`, `to`, `departDate`, `returnDate`). It returns a static URL encoding a specific past search. Users searching Google Flights via GoMate always get results for the same hardcoded route, regardless of their actual search.

### G-4.4-B: Stop count remains heuristic even after deterministic fallback

`parseFlightData()` no longer uses `Math.random()`, but unmatched stop data is still assigned heuristically via `i % 2`. That removes non-determinism, but the stop count can still be wrong because it is not parsed from structured provider data.

### G-4.4-C: Airport resolution limited to 30 airports

`getAirportByCode()` only resolves the 30 pre-compiled popular airports. Valid IATA codes outside this set return `400 "Invalid airport codes"`. This makes the flight search useless for any origin or destination not in the 30-entry hardcoded list (see Phase 3.5, G-3.5-A).

### G-4.4-D: No real flight API integration

All flight data comes from web scraping via Firecrawl. Flight search engines actively block scrapers. The results are unreliable, may be incomplete, and return booking page URLs rather than actual flight data. This is discovery-only, not a booking system.

### G-4.4-E: Real parsed flights lack key fields

`parseFlightData()` never sets `airlineLogo`, `amenities`, or `baggageIncluded`. These fields are only present in mock data. A client that renders these fields will see them for mock data but never for real scraped results.

### G-4.4-F: No authentication on flight endpoint

`POST /api/flights` and `GET /api/flights` require no authentication. Any unauthenticated request can trigger Firecrawl scraping of all 5 flight sources, consuming Firecrawl credits without any user validation.

---

## 11. Target State

| Item | Current | Target |
|---|---|---|
| Google Flights URL | Hardcoded static | Properly constructed dynamic URL |
| Stop count | Deterministic but heuristic (`i % 2` fallback) | Structured provider parsing or trustworthy stop extraction |
| Airport resolution | 30 hardcoded airports | Full airports.txt dataset (7,698 entries) |
| Flight data source | Firecrawl web scraping | Real flight API (Skyscanner API, Amadeus, etc.) |
| Booking capability | Links only | Direct booking integration |
| Missing fields (logo, amenities) | Only in mock data | Populate from structured API response |
| Authentication | None | Require auth for Firecrawl-consuming endpoints |
