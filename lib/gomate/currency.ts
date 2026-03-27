// Shared currency utilities — used by cost-of-living-card, budget-plan-card, and dashboard

// Map citizenship/country to currency code
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // Asia
  philippines: "PHP", filipino: "PHP",
  japan: "JPY", japanese: "JPY",
  china: "CNY", chinese: "CNY",
  india: "INR", indian: "INR",
  south_korea: "KRW", korean: "KRW",
  thailand: "THB", thai: "THB",
  vietnam: "VND", vietnamese: "VND",
  indonesia: "IDR", indonesian: "IDR",
  malaysia: "MYR", malaysian: "MYR",
  singapore: "SGD", singaporean: "SGD",
  // Europe
  sweden: "SEK", swedish: "SEK",
  norway: "NOK", norwegian: "NOK",
  denmark: "DKK", danish: "DKK",
  uk: "GBP", british: "GBP", "united kingdom": "GBP",
  switzerland: "CHF", swiss: "CHF",
  poland: "PLN", polish: "PLN",
  czech: "CZK", "czech republic": "CZK", czechia: "CZK",
  hungary: "HUF", hungarian: "HUF",
  romania: "RON", romanian: "RON",
  bulgaria: "BGN", bulgarian: "BGN",
  croatia: "EUR", turkish: "TRY", turkey: "TRY",
  // Eurozone
  germany: "EUR", german: "EUR",
  france: "EUR", french: "EUR",
  italy: "EUR", italian: "EUR",
  spain: "EUR", spanish: "EUR",
  netherlands: "EUR", dutch: "EUR",
  belgium: "EUR", belgian: "EUR",
  austria: "EUR", austrian: "EUR",
  portugal: "EUR", portuguese: "EUR",
  ireland: "EUR", irish: "EUR",
  finland: "EUR", finnish: "EUR",
  greece: "EUR", greek: "EUR",
  // Americas
  usa: "USD", american: "USD", "united states": "USD",
  canada: "CAD", canadian: "CAD",
  brazil: "BRL", brazilian: "BRL",
  mexico: "MXN", mexican: "MXN",
  argentina: "ARS", argentinian: "ARS",
  colombia: "COP", colombian: "COP",
  chile: "CLP", chilean: "CLP",
  // Middle East & Africa
  uae: "AED", emirati: "AED", "united arab emirates": "AED",
  saudi: "SAR", "saudi arabia": "SAR",
  israel: "ILS", israeli: "ILS",
  south_africa: "ZAR", "south african": "ZAR",
  nigeria: "NGN", nigerian: "NGN",
  egypt: "EGP", egyptian: "EGP",
  // Oceania
  australia: "AUD", australian: "AUD",
  new_zealand: "NZD", "new zealander": "NZD",
}

// Currency symbols
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥",
  SEK: "kr", NOK: "kr", DKK: "kr", CHF: "CHF",
  PHP: "₱", INR: "₹", KRW: "₩", THB: "฿",
  AUD: "A$", CAD: "C$", SGD: "S$", NZD: "NZ$",
  BRL: "R$", MXN: "MX$", PLN: "zł", CZK: "Kč",
  HUF: "Ft", TRY: "₺", AED: "د.إ", SAR: "﷼",
  ZAR: "R", MYR: "RM", IDR: "Rp", VND: "₫",
  RON: "lei", BGN: "лв", ILS: "₪",
  NGN: "₦", EGP: "E£", ARS: "$", COP: "$", CLP: "$",
}

// Resolve a user's home currency from current_location or citizenship
export function getCurrencyFromCountry(country: string | undefined | null): string | null {
  if (!country) return null
  const normalized = country.toLowerCase().trim()
  return COUNTRY_TO_CURRENCY[normalized] || null
}

// Get display symbol for a currency code
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode
}
