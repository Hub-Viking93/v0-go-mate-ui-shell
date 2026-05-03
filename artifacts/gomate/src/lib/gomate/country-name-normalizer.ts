/**
 * Canonical country and city name normalization.
 *
 * Profile extraction sometimes stores destination/city values in the user's
 * native language (e.g. "Japão", "Tóquio", "Italia", "Roma"). Many downstream
 * systems — currency lookup, COUNTRY_DATA in guide-generator, COUNTRY_TO_CURRENCY
 * in currency.ts, country-flags, official-sources — are keyed by canonical
 * English names. Storing non-English names breaks every one of those lookups
 * and the user sees: missing country flag, generic visa info, EUR currency
 * for non-EUR destinations, and a dashboard that disagrees with the chat.
 *
 * This module maps common foreign-language names to canonical English forms.
 */

const COUNTRY_ALIASES: Record<string, string> = {
  // Japan
  japão: "Japan",
  japon: "Japan",
  japao: "Japan",
  // Italy
  italia: "Italy",
  italie: "Italy",
  italien: "Italy",
  // Spain
  españa: "Spain",
  espana: "Spain",
  espagne: "Spain",
  // Germany
  deutschland: "Germany",
  alemania: "Germany",
  alemanha: "Germany",
  allemagne: "Germany",
  // France
  francia: "France",
  frança: "France",
  franca: "France",
  frankreich: "France",
  // United Kingdom
  uk: "United Kingdom",
  britain: "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  "the united kingdom": "United Kingdom",
  reinounido: "United Kingdom",
  "reino unido": "United Kingdom",
  "royaume-uni": "United Kingdom",
  // United States
  usa: "United States",
  "u.s.a.": "United States",
  "u.s.": "United States",
  "the states": "United States",
  "the us": "United States",
  america: "United States",
  estadosunidos: "United States",
  "estados unidos": "United States",
  // Netherlands
  holland: "Netherlands",
  "the netherlands": "Netherlands",
  nederland: "Netherlands",
  "países bajos": "Netherlands",
  "paises bajos": "Netherlands",
  // Portugal
  // already English; left for completeness
  // Brazil
  brasil: "Brazil",
  brésil: "Brazil",
  // Mexico
  méxico: "Mexico",
  mexique: "Mexico",
  // Argentina
  argentine: "Argentina",
  // China
  chine: "China",
  // Egypt
  مصر: "Egypt",
  "el-misr": "Egypt",
  // Australia
  australie: "Australia",
  // South Korea
  "south korea": "South Korea",
  korea: "South Korea",
  "republic of korea": "South Korea",
  // UAE
  "u.a.e.": "United Arab Emirates",
  uae: "United Arab Emirates",
  "the uae": "United Arab Emirates",
  // Pakistan
  پاکستان: "Pakistan",
  // Nigeria
  // already English
  // Saudi Arabia
  ksa: "Saudi Arabia",
  // Turkey
  türkiye: "Turkey",
  turkiye: "Turkey",
}

const CITY_ALIASES: Record<string, string> = {
  tóquio: "Tokyo",
  toquio: "Tokyo",
  tokio: "Tokyo",
  roma: "Rome",
  rom: "Rome",
  milano: "Milan",
  firenze: "Florence",
  napoli: "Naples",
  venezia: "Venice",
  torino: "Turin",
  genova: "Genoa",
  ciudaddeméxico: "Mexico City",
  "ciudad de méxico": "Mexico City",
  "ciudad de mexico": "Mexico City",
  méxicodf: "Mexico City",
  "méxico df": "Mexico City",
  "mexico df": "Mexico City",
  cdmx: "Mexico City",
  lisboa: "Lisbon",
  oporto: "Porto",
  munich: "Munich",
  münchen: "Munich",
  muenchen: "Munich",
  cologne: "Cologne",
  köln: "Cologne",
  vienna: "Vienna",
  wien: "Vienna",
  prag: "Prague",
  praha: "Prague",
  warszawa: "Warsaw",
  moskva: "Moscow",
  athina: "Athens",
  athínai: "Athens",
  "saint-pétersbourg": "Saint Petersburg",
  "são paulo": "São Paulo",
  "sao paulo": "São Paulo",
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Normalize a country name to canonical English form.
 * Returns the original input when no mapping matches.
 */
export function normalizeCountryName(input: string | null | undefined): string {
  if (!input) return ""
  const trimmed = String(input).trim()
  if (!trimmed) return ""

  const folded = fold(trimmed)
  if (COUNTRY_ALIASES[folded]) return COUNTRY_ALIASES[folded]

  // Already canonical — map known canonical English names back to themselves
  // so case is normalized (e.g. "japan" → "Japan").
  const knownCanonical = new Set([
    "afghanistan",
    "argentina",
    "australia",
    "austria",
    "belgium",
    "brazil",
    "canada",
    "chile",
    "china",
    "colombia",
    "czechia",
    "czech republic",
    "denmark",
    "egypt",
    "finland",
    "france",
    "germany",
    "greece",
    "hungary",
    "india",
    "indonesia",
    "ireland",
    "israel",
    "italy",
    "japan",
    "malaysia",
    "mexico",
    "morocco",
    "nepal",
    "netherlands",
    "new zealand",
    "nigeria",
    "norway",
    "pakistan",
    "philippines",
    "poland",
    "portugal",
    "romania",
    "russia",
    "saudi arabia",
    "singapore",
    "south africa",
    "south korea",
    "spain",
    "sri lanka",
    "sweden",
    "switzerland",
    "thailand",
    "turkey",
    "uganda",
    "ukraine",
    "united arab emirates",
    "united kingdom",
    "united states",
    "vietnam",
  ])
  if (knownCanonical.has(folded)) {
    return folded
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  }

  return trimmed
}

/**
 * Normalize a city name to canonical English form when possible.
 * Returns the original input when no mapping matches.
 */
export function normalizeCityName(input: string | null | undefined): string {
  if (!input) return ""
  const trimmed = String(input).trim()
  if (!trimmed) return ""
  const folded = fold(trimmed)
  if (CITY_ALIASES[folded]) return CITY_ALIASES[folded]
  // Title-case ASCII names so "tokyo" → "Tokyo"
  if (/^[a-z\s'-]+$/.test(folded)) {
    return folded
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  }
  return trimmed
}
