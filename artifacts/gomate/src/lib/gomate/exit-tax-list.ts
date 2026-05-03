/**
 * Frontend mirror of `artifacts/api-server/src/lib/gomate/exit-tax-list.ts`.
 *
 * Used by `computeVisibleCards` in `dashboard-state.ts` to decide whether the
 * dashboard should surface a Departure-Tax card. Kept as a deliberate copy
 * rather than a cross-package import so the gomate web bundle does not pull
 * in api-server code.
 *
 * Keep this list in sync with the backend version. If the backend list grows,
 * mirror the additions here.
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
] as const

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  america: "United States",
  holland: "Netherlands",
  nederland: "Netherlands",
  deutschland: "Germany",
  sverige: "Sweden",
  norge: "Norway",
  españa: "Spain",
  espana: "Spain",
}

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
}

function aliasRegex(alias: string): RegExp {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i")
}

/**
 * Returns true if the user's `current_location` (free-text city or
 * city/country) appears to fall inside an EXIT_TAX_COUNTRIES jurisdiction.
 * Tolerant: lowercased substring match against the country list, plus an
 * alias table and a major-city → country fallback.
 */
export function currentLocationLooksLikeExitTaxCountry(
  currentLocation: string | number | null | undefined,
): boolean {
  if (!currentLocation) return false
  const raw = String(currentLocation).toLowerCase().trim()
  if (raw === "") return false

  for (const country of EXIT_TAX_COUNTRIES) {
    if (raw.includes(country.toLowerCase())) return true
  }

  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    if (!EXIT_TAX_COUNTRIES.includes(canonical)) continue
    if (aliasRegex(alias).test(raw)) return true
  }

  for (const [city, country] of Object.entries(CITY_TO_COUNTRY)) {
    if (raw.includes(city) && EXIT_TAX_COUNTRIES.includes(country)) return true
  }

  return false
}
