// Country flag utilities - maps country names to ISO codes and flag images

// ISO country code mapping
export const countryISOCodes: Record<string, string> = {
  // Europe
  "germany": "DE",
  "france": "FR",
  "spain": "ES",
  "italy": "IT",
  "netherlands": "NL",
  "belgium": "BE",
  "austria": "AT",
  "switzerland": "CH",
  "sweden": "SE",
  "norway": "NO",
  "denmark": "DK",
  "finland": "FI",
  "ireland": "IE",
  "portugal": "PT",
  "greece": "GR",
  "poland": "PL",
  "czech republic": "CZ",
  "czechia": "CZ",
  "hungary": "HU",
  "romania": "RO",
  "bulgaria": "BG",
  "croatia": "HR",
  "slovakia": "SK",
  "slovenia": "SI",
  "estonia": "EE",
  "latvia": "LV",
  "lithuania": "LT",
  "luxembourg": "LU",
  "malta": "MT",
  "cyprus": "CY",
  "iceland": "IS",
  "united kingdom": "GB",
  "uk": "GB",
  
  // Americas
  "united states": "US",
  "usa": "US",
  "canada": "CA",
  "mexico": "MX",
  "brazil": "BR",
  "argentina": "AR",
  "chile": "CL",
  "colombia": "CO",
  "peru": "PE",
  "costa rica": "CR",
  "panama": "PA",
  
  // Asia Pacific
  "japan": "JP",
  "south korea": "KR",
  "korea": "KR",
  "china": "CN",
  "hong kong": "HK",
  "taiwan": "TW",
  "singapore": "SG",
  "thailand": "TH",
  "vietnam": "VN",
  "malaysia": "MY",
  "indonesia": "ID",
  "philippines": "PH",
  "india": "IN",
  "australia": "AU",
  "new zealand": "NZ",
  
  // Middle East & Africa
  "united arab emirates": "AE",
  "uae": "AE",
  "dubai": "AE",
  "saudi arabia": "SA",
  "israel": "IL",
  "turkey": "TR",
  "south africa": "ZA",
  "egypt": "EG",
  "morocco": "MA",
  "kenya": "KE",
  "nigeria": "NG",
}

// Get ISO code from country name
export function getCountryISOCode(country: string): string | null {
  const normalized = country.toLowerCase().trim()
  return countryISOCodes[normalized] || null
}

// Get flag emoji from ISO code
export function getFlagEmoji(isoCode: string): string {
  const codePoints = isoCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

// Get flag emoji from country name
export function getCountryFlagEmoji(country: string): string {
  const isoCode = getCountryISOCode(country)
  if (!isoCode) return "🌍" // Default globe if country not found
  return getFlagEmoji(isoCode)
}

// Get flag image URL from flagcdn.com
export function getFlagImageUrl(isoCode: string, size: "w20" | "w40" | "w80" | "w160" | "w320" = "w80"): string {
  return `https://flagcdn.com/${size}/${isoCode.toLowerCase()}.png`
}

// Get flag image URL from country name
export function getCountryFlagImageUrl(country: string, size: "w20" | "w40" | "w80" | "w160" | "w320" = "w80"): string | null {
  const isoCode = getCountryISOCode(country)
  if (!isoCode) return null
  return getFlagImageUrl(isoCode, size)
}

// React component helper - returns both emoji and image URL
export function getCountryFlag(country: string): {
  emoji: string
  imageUrl: string | null
  isoCode: string | null
} {
  const isoCode = getCountryISOCode(country)
  return {
    emoji: isoCode ? getFlagEmoji(isoCode) : "🌍",
    imageUrl: isoCode ? getFlagImageUrl(isoCode) : null,
    isoCode,
  }
}
