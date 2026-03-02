# Country / Destination Data — System Document

**Phase:** 3.5
**Status:** Reality-first (documents what exists)
**Primary sources:**
- `lib/gomate/country-flags.ts` — ISO code + flag utilities
- `lib/gomate/official-sources.ts` — official government URL registry
- `lib/gomate/airports.ts` — airport data
- `lib/data/airports.txt` — airport dataset (7,698 entries, not loaded at runtime)
- `lib/gomate/visa-recommendations.ts` — pre-compiled country notes (documented in Phase 2.3)
- `lib/gomate/web-research.ts` — pre-compiled cost estimates (documented in Phase 3.2)
**Last audited:** 2026-02-25

---

## 1. Overview

GoMate's country and destination data layer consists of **four independent pre-compiled datasets** that provide reference data for countries and airports. None of these datasets are fetched at runtime — they are all static, embedded in source code or in a bundled text file.

| Module | Purpose | Data scope | Size |
|---|---|---|---|
| `country-flags.ts` | ISO codes + flag display | ~60 countries | 131 lines |
| `official-sources.ts` | Official government URLs per category | ~50 countries × 6 categories | >25,000 tokens |
| `airports.ts` | Airport search and lookup | 30 airports (hardcoded) | 140 lines |
| `lib/data/airports.txt` | Full airport dataset | 7,698 airports | Not loaded at runtime |

**Key finding:** The codebase has a comprehensive 7,698-entry airport dataset (`airports.txt`) and a parser function (`parseAirportLine()`) that is never called. All actual airport lookups use a 30-entry hardcoded list instead.

---

## 2. country-flags.ts

### 2.1 Purpose

Provides ISO 2-letter country codes and flag display utilities. Used to display flag emoji and flag images throughout the UI.

### 2.2 countryISOCodes — ~60 Countries

A static `Record<string, string>` mapping lowercase country name → ISO 2-letter code:

```typescript
const countryISOCodes: Record<string, string> = {
  "germany": "DE",
  "france": "FR",
  "netherlands": "NL",
  "united kingdom": "GB",
  // ... ~60 total entries
}
```

**Coverage includes:** European destinations (Germany, France, Netherlands, UK, Spain, Portugal, Italy, Sweden, Norway, Denmark, Finland, Austria, Switzerland, Belgium, Ireland, Poland, Czech Republic, Hungary, Romania, Bulgaria, Croatia, Slovakia, Slovenia, Estonia, Latvia, Lithuania, Luxembourg, Malta, Cyprus, Greece), Asian/Pacific destinations (Japan, Singapore, Australia, New Zealand, China, South Korea, Taiwan, Thailand, Indonesia, Malaysia, Philippines, Vietnam, India), American destinations (USA, Canada, Mexico, Brazil, Argentina, Chile, Colombia), Middle Eastern destinations (UAE, Saudi Arabia, Qatar, Bahrain, Kuwait, Israel, Turkey), African destinations (South Africa, Egypt, Morocco, Nigeria, Kenya, Ghana, Tanzania, Uganda, Rwanda, Ethiopia, Senegal).

### 2.3 Exported Functions

| Function | Input | Output | Notes |
|---|---|---|---|
| `getCountryISOCode(country)` | Country name (any case) | ISO code or `null` | Lowercases input before lookup |
| `getFlagEmoji(isoCode)` | ISO 2-letter code | Flag emoji string | Computes from Unicode regional indicators |
| `getCountryFlagEmoji(country)` | Country name | Flag emoji or `"🌍"` | Fallback globe if country not found |
| `getFlagImageUrl(isoCode)` | ISO 2-letter code | flagcdn.com URL | `https://flagcdn.com/24x18/{code}.png` |
| `getCountryFlagImageUrl(country)` | Country name | flagcdn.com URL or `null` | `null` if country not found |
| `getCountryFlag(country)` | Country name | `{ emoji, imageUrl, isoCode }` or `null` | Returns all three together |

### 2.4 Flag Display Mechanism

Flag emojis are computed at runtime from ISO codes using Unicode regional indicator symbols:

```typescript
// A = U+1F1E6, B = U+1F1E7, ... Z = U+1F1FF
const codePoints = code.toUpperCase().split("").map(
  char => 0x1F1E6 + char.charCodeAt(0) - 65
)
return String.fromCodePoint(...codePoints)
```

Flag images use `flagcdn.com` at 24×18px resolution. No API key required — public CDN.

**Gap:** If `flagcdn.com` is unavailable, flag images throughout the UI silently break with no fallback. The emoji path remains functional (pure client-side computation).

### 2.5 Consumers

- `lib/gomate/index.ts` re-exports all functions via `export * from "./country-flags"`
- The two destination UI components and any component importing from `@/lib/gomate` can access these functions

---

## 3. official-sources.ts

### 3.1 Purpose

A centralized registry of official government URLs for immigration, visa, housing, banking, employment, and safety information — one set of URLs per destination country. Used by the research layer to determine which official URLs to scrape first (instead of relying solely on Firecrawl search).

### 3.2 Data Structure

```typescript
interface OfficialSourceEntry {
  name: string        // Country name
  immigration: string // Official immigration authority URL
  visa: string        // Visa application/information URL
  housing: string     // Government housing information URL
  banking: string     // Financial regulator or banking info URL
  employment: string  // Labor authority / work permit URL
  safety: string      // Foreign affairs / travel advisory URL
}
```

### 3.3 OFFICIAL_SOURCES — ~50 Countries, 6 Categories Each

The registry covers approximately 50+ countries with complete 6-URL entries. Countries include all major relocation destinations:

**EU/EEA:** Germany, France, Netherlands, Spain, Portugal, Italy, Sweden, Norway, Denmark, Finland, Austria, Switzerland, Belgium, Ireland, Poland, Czech Republic, Hungary, Romania, Bulgaria, Croatia, Slovakia, Slovenia, Estonia, Latvia, Lithuania, Luxembourg, Malta, Cyprus, Greece

**Non-EU European:** United Kingdom, Switzerland

**Asia-Pacific:** Japan, Singapore, Australia, New Zealand, South Korea, Taiwan, Thailand, Indonesia, Malaysia, Philippines, Vietnam, India, China

**Americas:** United States, Canada, Mexico, Brazil, Argentina, Chile, Colombia

**Middle East:** UAE, Saudi Arabia, Qatar, Bahrain, Kuwait, Israel, Turkey

**Africa:** South Africa, Egypt, Morocco, Nigeria, Kenya, Ghana, Tanzania, Uganda, Rwanda, Ethiopia, Senegal

**Key finding:** The 6-category URL set matches exactly the 6 search categories used by the local requirements research route (Section 5.2 of Phase 3.1). The registry was designed to be the authoritative source for research scraping targets.

### 3.4 EMBASSY_PATTERNS — 25 Countries

A secondary registry providing embassy finder URL templates for ~25 countries. Used to generate dynamic embassy URLs based on the user's citizenship:

```typescript
interface EmbassyPattern {
  country: string
  pattern: string   // URL template, may contain {citizenship} placeholder
  type: "directory" | "search" | "static"
}
```

**Pattern types:**
- `"directory"` — Embassyfinder-style URL
- `"search"` — Search-based embassy locator with substitutable query
- `"static"` — Fixed URL for embassy information

### 3.5 Exported Functions

| Function | Description |
|---|---|
| `getSourceUrl(destination, category)` | Returns single URL for destination + category |
| `getAllSources(destination)` | Returns all 6 category URLs for a destination |
| `hasCategory(destination, category)` | Checks if destination has a specific category URL |
| `getSupportedCountries()` | Returns array of all destination country names in registry |
| `hasOfficialSource(destination)` | Checks if destination exists in registry at all |
| `getEmbassyFinderUrl(destination, citizenship)` | Builds embassy URL from EMBASSY_PATTERNS |
| `getEmbassyInfo(destination, citizenship)` | Returns full embassy finder info object |
| `detectCategoriesToScrape(destination, purpose)` | Returns prioritized category list based on profile purpose |
| `formatSourcesForDisplay(destination)` | Returns formatted source list for UI display |
| `getRegistryStats()` | Returns `{ countries, categories, totalUrls }` statistics |
| `getOfficialSources(destination)` | Returns the full OfficialSourceEntry for a destination |
| `getOfficialSourcesArray()` | Returns all entries as an array |

**Gap:** `lib/gomate/web-research.ts` does not use `official-sources.ts` at all when performing its `fetchVisaInfo()` and `fetchHousingInfo()` calls. It builds ad-hoc Firecrawl search queries instead. The official sources registry is used by 3 of the 4 research systems (visa, local requirements, checklist) but not by the web-research module.

### 3.6 Registry Usage by Research Routes

| Consumer | Function called |
|---|---|
| `app/api/research/local-requirements/route.ts` | `getAllSources(destination)` — all 6 category URLs |
| `app/api/research/visa/route.ts` | `getSourceUrl(dest, "immigration")`, `getSourceUrl(dest, "visa")` |
| `lib/gomate/checklist-generator.ts` | `getSourceUrl(dest, "immigration")`, `getSourceUrl(dest, "visa")` |
| `lib/gomate/web-research.ts` | **Not used** — builds own ad-hoc queries |

### 3.7 Source Staleness

The official-sources.ts registry is static code. Government URLs change frequently (department restructuring, website overhauls). There is no mechanism to detect when a registry URL has gone stale or returns 404. The research layer would silently scrape a broken URL and receive empty content, falling through to search-based results.

---

## 4. airports.ts + airports.txt

### 4.1 Purpose

Provides airport search and lookup functionality used by the flight search feature. Supports the `GET /api/airports` and `GET /api/flights` endpoints.

### 4.2 Airport Interface

```typescript
interface Airport {
  id: number
  name: string
  city: string
  country: string
  iataCode: string | null
  icaoCode: string
  latitude: number
  longitude: number
  altitude: number
  timezone: string   // IANA timezone name (e.g. "Europe/Berlin")
  type: string       // Usually "airport"
}
```

### 4.3 POPULAR_AIRPORTS — 30 Hardcoded Airports

The only data actually used at runtime. All 30 are major international hubs:

| # | Airport | City | Country | IATA |
|---|---|---|---|---|
| 1 | JFK International | New York | United States | JFK |
| 2 | Los Angeles International | Los Angeles | United States | LAX |
| 3 | London Heathrow | London | United Kingdom | LHR |
| 4 | Paris Charles de Gaulle | Paris | France | CDG |
| 5 | Frankfurt Airport | Frankfurt | Germany | FRA |
| 6 | Berlin Brandenburg | Berlin | Germany | BER |
| 7 | Amsterdam Schiphol | Amsterdam | Netherlands | AMS |
| 8 | Madrid Barajas | Madrid | Spain | MAD |
| 9 | Barcelona El Prat | Barcelona | Spain | BCN |
| 10 | Lisbon Humberto Delgado | Lisbon | Portugal | LIS |
| 11 | Tokyo Narita | Tokyo | Japan | NRT |
| 12 | Tokyo Haneda | Tokyo | Japan | HND |
| 13 | Dubai International | Dubai | UAE | DXB |
| 14 | Singapore Changi | Singapore | Singapore | SIN |
| 15 | Sydney Kingsford Smith | Sydney | Australia | SYD |
| 16 | Toronto Pearson | Toronto | Canada | YYZ |
| 17 | Munich Airport | Munich | Germany | MUC |
| 18 | Zurich Airport | Zurich | Switzerland | ZRH |
| 19 | Vienna International | Vienna | Austria | VIE |
| 20 | Copenhagen Airport | Copenhagen | Denmark | CPH |
| 21 | Stockholm Arlanda | Stockholm | Sweden | ARN |
| 22 | Oslo Gardermoen | Oslo | Norway | OSL |
| 23 | Helsinki Vantaa | Helsinki | Finland | HEL |
| 24 | Rome Fiumicino | Rome | Italy | FCO |
| 25 | Milan Malpensa | Milan | Italy | MXP |
| 26 | Chicago O'Hare | Chicago | United States | ORD |
| 27 | San Francisco International | San Francisco | United States | SFO |
| 28 | Miami International | Miami | United States | MIA |
| 29 | Atlanta Hartsfield-Jackson | Atlanta | United States | ATL |
| 30 | Hong Kong International | Hong Kong | Hong Kong | HKG |

### 4.4 parseAirportLine() — Dead Code

```typescript
function parseAirportLine(line: string): Airport | null {
  // Parses 14-field CSV: id,"name","city","country","iata","icao",lat,lon,alt,tz_offset,dst,tz_name,type,source
  // Returns null if fewer than 14 parts or if iataCode is missing/invalid
}
```

**This function is defined but never called anywhere in the codebase.** It is the only bridge between the full `airports.txt` dataset and the `Airport` interface. Since it is not called, `airports.txt` is effectively a dormant data file bundled with the project.

**Evidence:** No import, require, or `fs.readFile` call references `airports.txt` in any `.ts` or `.tsx` file. The `parseAirportLine()` function signature exists only in `airports.ts` and is not exported.

### 4.5 airports.txt — Dormant Dataset

- **Format:** OpenFlights CSV — 14 fields per line
- **Size:** 7,698 entries
- **Sample:**
  ```
  1,"Goroka Airport","Goroka","Papua New Guinea","GKA","AYGA",-6.081689834590001,145.391998291,5282,10,"U","Pacific/Port_Moresby","airport","OurAirports"
  ```
- **Coverage:** Worldwide airports with valid IATA codes (subset of 7,698 total lines, since rows without IATA codes are filtered by `parseAirportLine()`)
- **Status:** Not loaded at runtime. Data is never parsed or used.

### 4.6 Exported Functions

| Function | Operates on | Notes |
|---|---|---|
| `searchAirports(query, limit=10)` | `POPULAR_AIRPORTS` (30 entries) | Returns popular airports if `query.length < 2`; then exact IATA match, then city/name/country partial match |
| `getAirportByCode(code)` | `POPULAR_AIRPORTS` (30 entries) | Case-insensitive IATA lookup |
| `formatAirportDisplay(airport)` | — | Returns `"City (IATA)"` |
| `formatAirportFull(airport)` | — | Returns `"Name - City, Country (IATA)"` |

### 4.7 API Endpoints

**`GET /api/airports`** (`app/api/airports/route.ts`):
- No auth required
- `?q=<query>&limit=<n>` — calls `searchAirports(query, limit)`
- No `q` (or `q.length < 2`) → returns `POPULAR_AIRPORTS.slice(0, limit)` with `total: 30`
- No error handling — any exception propagates uncaught

**Used by:** `app/api/flights/route.ts` imports `getAirportByCode` and `POPULAR_AIRPORTS` for origin/destination lookup and as fallback data.

### 4.8 "use client" Directive

`airports.ts` has `"use client"` at the top. This marks the module as a client component in Next.js App Router. However, `airports.ts` is also imported by `app/api/airports/route.ts` which is a server-side route handler.

**Gap:** Using `"use client"` on a module imported by both server routes and client code may cause bundling inconsistencies. In practice, `airports.ts` has no browser-only APIs, so this likely works, but the directive is semantically incorrect for a shared utility module. The correct pattern would be to omit `"use client"` from utility libraries.

---

## 5. Cross-Module Consistency Analysis

### 5.1 Country Coverage Overlap

Different modules cover different subsets of countries with no unified master list:

| Module | Country coverage |
|---|---|
| `country-flags.ts` | ~60 countries (ISO codes) |
| `official-sources.ts` | ~50 countries (official URLs) |
| `numbeo-scraper.ts` FALLBACK_DATA | 10 cities (cost data) |
| `web-research.ts` COST_OF_LIVING_ESTIMATES | 12 countries (cost data) |
| `visa-recommendations.ts` country notes | 36 countries |
| `POPULAR_AIRPORTS` | 30 airports / ~18 distinct countries |

There is no canonical list of "supported destinations." Each module independently defines its own coverage. A destination can appear in `official-sources.ts` but have no flag ISO code in `country-flags.ts`, no cost estimate, and no pre-compiled visa notes.

### 5.2 Country Name Normalization

Country names are not normalized consistently across modules:

| Representation | Used in |
|---|---|
| `"germany"` (lowercase) | `country-flags.ts` key lookup |
| `"Germany"` (title case) | `official-sources.ts` key, `POPULAR_AIRPORTS.country` |
| `"United Kingdom"` | `country-flags.ts`, `official-sources.ts`, `POPULAR_AIRPORTS` |
| `"united kingdom"` | `web-research.ts` COST_OF_LIVING_ESTIMATES key |

Each module independently lowercases (or doesn't) before lookup. A country name that works in one module is not guaranteed to work in another without transformation.

### 5.3 Cost Data Inconsistency (Cross-reference)

As documented in Phase 3.2, two cost modules cover some of the same countries with different values. This is a known inconsistency — the country-destination data layer has no shared source of truth.

---

## 6. Gap Analysis — Critical Findings

### G-3.5-A: airports.txt is bundled but never loaded

7,698 airport entries exist in `lib/data/airports.txt`, and a parser function `parseAirportLine()` is correctly defined in `airports.ts`. However, nothing ever reads the file or calls the parser. The system operates with 30 hardcoded airports. Any airport search for a non-popular airport returns no results.

### G-3.5-B: "use client" directive on a server-imported module

`airports.ts` declares `"use client"` but is imported by `app/api/airports/route.ts` (server route). This is semantically incorrect. The directive has no harmful effect here since `airports.ts` uses no browser APIs, but it introduces confusion about module boundaries.

### G-3.5-C: No canonical destination list

No single module or data structure enumerates the set of destinations GoMate supports. Each module (flags, official-sources, cost, airports, visa-recommendations) independently defines its own coverage, with different sets of countries and no programmatic way to determine intersection or union.

### G-3.5-D: Official-sources registry has no staleness detection

`official-sources.ts` is static code. Government website URLs change without notice. There is no mechanism to validate that registered URLs are still live, no update schedule, and no fallback when a URL returns 404 or moves. The research scraping layer silently receives empty content for broken URLs.

### G-3.5-E: Country name format inconsistency across modules

`country-flags.ts` keys are lowercase; `official-sources.ts` keys are title-case; `POPULAR_AIRPORTS.country` is title-case; `web-research.ts` COST_OF_LIVING_ESTIMATES keys are lowercase. Cross-module lookup requires per-call normalization, which is not consistently applied.

### G-3.5-F: web-research.ts ignores official-sources.ts

The `web-research.ts` module (used for visa/housing research in the chat metadata path) does not use `official-sources.ts` to find authoritative URLs. It constructs ad-hoc Firecrawl search queries instead. This means the official registry's curated government URLs are bypassed in the main chat flow.

### G-3.5-G: Airport search scoped to 30 entries with no indication to caller

`searchAirports()` returns an empty array for any airport not in the 30-entry list. The API response returns `total: airports.length` (the matched count) not `total: 30`. A caller could not distinguish between "no airports match" and "database has no more airports."

---

## 7. Target State

| Item | Current | Target |
|---|---|---|
| Airport dataset | 30 hardcoded + 7,698 unused | Load airports.txt at startup or build time; `parseAirportLine()` to be wired in |
| "use client" on airports.ts | Semantically incorrect | Remove directive; mark as shared utility |
| Canonical destination list | None | Single `SUPPORTED_DESTINATIONS` constant used by all modules |
| Country name normalization | Per-module conventions | Shared `normalizeCountryName()` utility |
| Official-sources staleness | No detection | Periodic URL health check; `lastVerified` field per entry |
| web-research.ts + official-sources | Not integrated | `fetchVisaInfo()` to use `getSourceUrl(dest, "visa")` as primary URL |
| Airport search coverage | 30 entries | Full airports.txt integration; searchAirports() returns from full dataset |
