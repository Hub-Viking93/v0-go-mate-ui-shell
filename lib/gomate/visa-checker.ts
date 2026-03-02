// Visa checker - determines if visa is required based on citizenship and destination

// EU/EEA countries with freedom of movement
const euEeaCountries = new Set([
  "austria",
  "belgium",
  "bulgaria",
  "croatia",
  "cyprus",
  "czech republic",
  "czechia",
  "denmark",
  "estonia",
  "finland",
  "france",
  "germany",
  "greece",
  "hungary",
  "iceland",
  "ireland",
  "italy",
  "latvia",
  "liechtenstein",
  "lithuania",
  "luxembourg",
  "malta",
  "netherlands",
  "norway",
  "poland",
  "portugal",
  "romania",
  "slovakia",
  "slovenia",
  "spain",
  "sweden",
])

// Swiss nationals also have EU freedom of movement
const swissCountries = new Set(["switzerland"])

// Normalize country name
function normalizeCountry(country: string): string {
  const normalized = country.toLowerCase().trim()
  
  const aliases: Record<string, string> = {
    "uk": "united kingdom",
    "usa": "united states",
    "uae": "united arab emirates",
    "holland": "netherlands",
    "the netherlands": "netherlands",
  }
  
  return aliases[normalized] || normalized
}

// Check if country is in EU/EEA
export function isEuEea(country: string): boolean {
  return euEeaCountries.has(normalizeCountry(country))
}

// Check if user has freedom of movement (no visa required)
export function hasFreedomOfMovement(
  citizenship: string,
  destination: string
): boolean {
  const normalizedCitizenship = normalizeCountry(citizenship)
  const normalizedDestination = normalizeCountry(destination)
  
  // Same country - no visa needed
  if (normalizedCitizenship === normalizedDestination) {
    return true
  }
  
  // EU/EEA citizen moving to EU/EEA country
  const citizenIsEuEea = euEeaCountries.has(normalizedCitizenship)
  const destIsEuEea = euEeaCountries.has(normalizedDestination)
  
  if (citizenIsEuEea && destIsEuEea) {
    return true
  }
  
  // Swiss citizen moving to EU/EEA (and vice versa)
  const citizenIsSwiss = swissCountries.has(normalizedCitizenship)
  
  if (citizenIsSwiss && destIsEuEea) {
    return true
  }
  
  if (citizenIsEuEea && normalizedDestination === "switzerland") {
    return true
  }
  
  return false
}

// Get visa status with explanation
export function getVisaStatus(
  citizenship: string,
  destination: string
): {
  visaFree: boolean
  reason: string
  badge: "visa-free" | "visa-required" | "check-required"
} {
  const normalizedCitizenship = normalizeCountry(citizenship)
  const normalizedDestination = normalizeCountry(destination)
  
  if (normalizedCitizenship === normalizedDestination) {
    return {
      visaFree: true,
      reason: "You are a citizen of this country",
      badge: "visa-free",
    }
  }
  
  if (hasFreedomOfMovement(citizenship, destination)) {
    const citizenIsEuEea = euEeaCountries.has(normalizedCitizenship)
    const citizenIsSwiss = swissCountries.has(normalizedCitizenship)
    
    return {
      visaFree: true,
      reason: citizenIsEuEea 
        ? "EU/EEA freedom of movement applies" 
        : citizenIsSwiss 
          ? "Swiss bilateral agreements apply"
          : "Freedom of movement applies",
      badge: "visa-free",
    }
  }
  
  // For non-EU cases, we can't determine automatically
  return {
    visaFree: false,
    reason: "Visa requirements depend on your specific situation. Check official sources.",
    badge: "check-required",
  }
}

// Quick check for UI badges
export type VisaBadgeType = "visa-free" | "visa-required" | "check-required"

export function getVisaBadge(
  citizenship: string | null,
  destination: string | null
): VisaBadgeType | null {
  if (!citizenship || !destination) return null
  return getVisaStatus(citizenship, destination).badge
}
