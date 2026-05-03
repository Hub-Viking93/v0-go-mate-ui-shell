/**
 * Countries that levy an exit tax / departure tax (or substantially
 * similar exit-time tax provisions) on emigrating residents. Used by
 * the Coordinator to decide whether a Departure-Tax Specialist agent
 * is needed for a given profile.
 *
 * Keep names in canonical English form — `currentLocationLooksLikeExitTaxCountry`
 * does case-insensitive substring matching plus an alias table for
 * common short forms ("USA" → "United States", etc).
 *
 * Sources (high-level — confirm specific rules per case):
 *   - Sweden       : 10-year tax-residency tail on capital gains
 *   - United States: §877A expatriation tax for covered expatriates
 *   - Norway       : §10-70 exit tax on unrealised gains
 *   - Eritrea      : 2% diaspora tax (pseudo-exit tax on citizens abroad)
 *   - France       : "exit tax" on unrealised gains > €800k threshold
 *   - Germany      : §6 AStG exit tax on substantial shareholdings
 *   - Netherlands  : protective assessment / "conserverende aanslag"
 *   - Canada       : "departure tax" / deemed disposition (Sec 128.1)
 *   - Australia    : CGT event I1 on ceasing to be resident
 *   - Denmark      : exit tax on shares > DKK 100k
 *   - Spain        : exit tax on shareholdings > €4m
 */
export const EXIT_TAX_COUNTRIES: readonly string[] = [
  "Sweden",
  "United States",
  "Norway",
  "Eritrea",
  "France",
  "Germany",
  "Netherlands",
  "Canada",
  "Australia",
  "Denmark",
  "Spain",
] as const;

/**
 * Common short forms / alternative spellings that should resolve to a
 * canonical entry in EXIT_TAX_COUNTRIES. Matched as standalone WORDS
 * (regex \b boundaries) — never raw substrings — so short aliases
 * like "us" don't accidentally match "Brussels".
 */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  america: "United States",
  uk: "United Kingdom", // not in list — included only for future expansion
  holland: "Netherlands",
  nederland: "Netherlands",
  deutschland: "Germany",
  sverige: "Sweden",
  norge: "Norway",
  españa: "Spain",
  espana: "Spain",
};

/** Build a word-boundary regex for an alias. Escapes regex metachars. */
function aliasRegex(alias: string): RegExp {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
}

/**
 * Returns true if the user's `current_location` (free-text city or
 * city/country) appears to fall inside an EXIT_TAX_COUNTRIES jurisdiction.
 * The match is tolerant: lowercased substring match against the country
 * list, with a small alias table for common short forms.
 *
 * Examples:
 *   "Stockholm"            → true  (substring "stockholm" alone wouldn't
 *                                   match; we ALSO check city → country
 *                                   for a small set of major cities)
 *   "Stockholm, Sweden"    → true
 *   "Berlin, Germany"      → true
 *   "USA"                  → true (alias)
 *   "Lisbon, Portugal"     → false
 *   ""                     → false
 */
export function currentLocationLooksLikeExitTaxCountry(
  currentLocation: string | number | null | undefined,
): boolean {
  if (!currentLocation) return false;
  const raw = String(currentLocation).toLowerCase().trim();
  if (raw === "") return false;

  for (const country of EXIT_TAX_COUNTRIES) {
    if (raw.includes(country.toLowerCase())) return true;
  }

  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    if (!EXIT_TAX_COUNTRIES.includes(canonical)) continue;
    if (aliasRegex(alias).test(raw)) return true;
  }

  // Major-city → exit-tax-country shortcuts so a user typing just
  // "Stockholm" or "Berlin" isn't missed. Conservative list — only
  // unambiguous capitals / major cities of countries already on the
  // exit-tax list.
  const CITY_TO_COUNTRY: Record<string, string> = {
    stockholm: "Sweden",
    gothenburg: "Sweden",
    malmö: "Sweden",
    malmo: "Sweden",
    oslo: "Norway",
    bergen: "Norway",
    copenhagen: "Denmark",
    aarhus: "Denmark",
    amsterdam: "Netherlands",
    rotterdam: "Netherlands",
    "the hague": "Netherlands",
    paris: "France",
    lyon: "France",
    marseille: "France",
    berlin: "Germany",
    munich: "Germany",
    münchen: "Germany",
    hamburg: "Germany",
    frankfurt: "Germany",
    madrid: "Spain",
    barcelona: "Spain",
    sevilla: "Spain",
    seville: "Spain",
    valencia: "Spain",
    toronto: "Canada",
    vancouver: "Canada",
    montreal: "Canada",
    sydney: "Australia",
    melbourne: "Australia",
    brisbane: "Australia",
    perth: "Australia",
    asmara: "Eritrea",
    "new york": "United States",
    "los angeles": "United States",
    "san francisco": "United States",
    chicago: "United States",
    boston: "United States",
    seattle: "United States",
    austin: "United States",
    miami: "United States",
  };
  for (const [city, country] of Object.entries(CITY_TO_COUNTRY)) {
    if (raw.includes(city) && EXIT_TAX_COUNTRIES.includes(country)) return true;
  }

  return false;
}
