import Firecrawl from "@mendable/firecrawl-js"
import type { Airport } from "./airports"

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY || "" })

// Flight search sources
export const FLIGHT_SOURCES = [
  {
    id: "skyscanner",
    name: "Skyscanner",
    baseUrl: "https://www.skyscanner.com",
    searchPath: "/transport/flights",
    logo: "/logos/skyscanner.svg",
    color: "#00a698",
  },
  {
    id: "google",
    name: "Google Flights",
    baseUrl: "https://www.google.com",
    searchPath: "/travel/flights",
    logo: "/logos/google-flights.svg",
    color: "#4285f4",
  },
  {
    id: "momondo",
    name: "Momondo",
    baseUrl: "https://www.momondo.com",
    searchPath: "/flight-search",
    logo: "/logos/momondo.svg",
    color: "#ff6b00",
  },
  {
    id: "kayak",
    name: "Kayak",
    baseUrl: "https://www.kayak.com",
    searchPath: "/flights",
    logo: "/logos/kayak.svg",
    color: "#ff690f",
  },
  {
    id: "kiwi",
    name: "Kiwi.com",
    baseUrl: "https://www.kiwi.com",
    searchPath: "/search/tiles",
    logo: "/logos/kiwi.svg",
    color: "#00a991",
  },
] as const

export type FlightSource = typeof FLIGHT_SOURCES[number]["id"]

export interface FlightSearchParams {
  from: Airport
  to: Airport
  departDate: string // YYYY-MM-DD
  returnDate?: string // YYYY-MM-DD (optional for one-way)
  travelers: number
  cabinClass?: "economy" | "premium_economy" | "business" | "first"
}

export interface FlightResult {
  id: string
  source: FlightSource
  sourceUrl: string
  airline: string
  airlineLogo?: string
  price: number
  currency: string
  departureTime: string
  arrivalTime: string
  duration: string
  stops: number
  stopLocations?: string[]
  cabinClass: string
  bookingUrl: string
  amenities?: string[]
  baggageIncluded?: string
  scrapedAt: string
}

export interface FlightSearchResult {
  source: FlightSource
  sourceName: string
  flights: FlightResult[]
  searchUrl: string
  scrapedAt: string
  error?: string
}

export const MOCK_FLIGHT_SCRAPED_AT = "2026-01-01T00:00:00.000Z"

// Build search URLs for each provider
function buildSearchUrl(source: typeof FLIGHT_SOURCES[number], params: FlightSearchParams): string {
  const { from, to, departDate, returnDate, travelers, cabinClass } = params
  const fromCode = from.iataCode || ""
  const toCode = to.iataCode || ""
  
  switch (source.id) {
    case "skyscanner":
      // Format: /transport/flights/jfk/ber/240315/240322/?adults=1&cabinclass=economy
      const skyScannerDepartDate = departDate.replace(/-/g, "").slice(2) // YYMMDD
      const skyScannerReturnDate = returnDate ? returnDate.replace(/-/g, "").slice(2) : ""
      const skyScannerPath = returnDate 
        ? `${source.searchPath}/${fromCode.toLowerCase()}/${toCode.toLowerCase()}/${skyScannerDepartDate}/${skyScannerReturnDate}/`
        : `${source.searchPath}/${fromCode.toLowerCase()}/${toCode.toLowerCase()}/${skyScannerDepartDate}/`
      return `${source.baseUrl}${skyScannerPath}?adults=${travelers}&cabinclass=${cabinClass || "economy"}`
      
    case "google":
      // Format: /travel/flights/search?q=flights+from+JFK+to+BER+on+2026-03-15
      const googleQuery = `flights from ${fromCode} to ${toCode} on ${departDate}${returnDate ? ` return ${returnDate}` : ""}`
      return `${source.baseUrl}${source.searchPath}?hl=en&curr=USD&q=${encodeURIComponent(googleQuery)}`
      
    case "momondo":
      // Format: /flight-search/JFK-BER/2026-03-15/2026-03-22?sort=bestflight_a
      const momondoPath = returnDate
        ? `${source.searchPath}/${fromCode}-${toCode}/${departDate}/${returnDate}`
        : `${source.searchPath}/${fromCode}-${toCode}/${departDate}`
      return `${source.baseUrl}${momondoPath}?sort=bestflight_a&fs=stops=~0`
      
    case "kayak":
      // Format: /flights/JFK-BER/2026-03-15/2026-03-22?sort=bestflight_a
      const kayakPath = returnDate
        ? `${source.searchPath}/${fromCode}-${toCode}/${departDate}/${returnDate}`
        : `${source.searchPath}/${fromCode}-${toCode}/${departDate}`
      return `${source.baseUrl}${kayakPath}?sort=bestflight_a&fs=stops=~0`
      
    case "kiwi":
      // Format: /search/tiles/JFK-BER/anytime/anytime
      return `${source.baseUrl}${source.searchPath}/${fromCode.toLowerCase()}-${toCode.toLowerCase()}/${departDate}/${returnDate || "no-return"}`
  }

  const exhaustiveCheck: never = source
  return exhaustiveCheck
}

// Parse flight data from scraped content
function parseFlightData(markdown: string, source: FlightSource, searchUrl: string): FlightResult[] {
  const flights: FlightResult[] = []
  
  // Common patterns to extract flight info from markdown
  const pricePattern = /\$[\d,]+|\€[\d,]+|USD\s*[\d,]+|EUR\s*[\d,]+/gi
  const timePattern = /\d{1,2}:\d{2}\s*(AM|PM)?/gi
  const durationPattern = /(\d+h\s*\d*m?|\d+\s*hr?\s*\d*\s*min?)/gi
  const airlinePatterns = [
    /lufthansa/i, /united/i, /delta/i, /american/i, /air france/i,
    /british airways/i, /klm/i, /emirates/i, /qatar/i, /singapore/i,
    /swiss/i, /austrian/i, /iberia/i, /tap/i, /sas/i, /finnair/i,
    /norwegian/i, /ryanair/i, /easyjet/i, /vueling/i, /eurowings/i,
  ]
  
  // Extract prices
  const prices = markdown.match(pricePattern) || []
  const times = markdown.match(timePattern) || []
  const durations = markdown.match(durationPattern) || []
  
  // Find airlines mentioned
  const airlines: string[] = []
  for (const pattern of airlinePatterns) {
    if (pattern.test(markdown)) {
      airlines.push(pattern.source.replace(/\\/g, "").replace(/i$/, ""))
    }
  }
  
  // Determine stop count from content
  const hasNonstop = /nonstop|non-stop|direct/i.test(markdown)
  const hasOneStop = /1\s*stop|one\s*stop/i.test(markdown)
  
  // Create flight results from parsed data
  const numFlights = Math.min(prices.length, 5) // Limit to 5 results per source
  const now = Date.now()

  for (let i = 0; i < numFlights; i++) {
    const priceStr = prices[i] || "$0"
    const priceNum = parseInt(priceStr.replace(/[^\d]/g, "")) || 0

    if (priceNum < 50 || priceNum > 15000) continue // Skip unrealistic prices

    const airline = airlines[i % airlines.length] || "Multiple Airlines"
    const duration = durations[i]?.replace(/[\n\r]/g, "").trim() || null // null = unknown, will be excluded by sanity check
    const stops = hasNonstop && i === 0 ? 0 : hasOneStop ? 1 : -1 // -1 = unknown

    flights.push({
      id: `${source}-${now}-${i}`,
      source,
      sourceUrl: searchUrl,
      airline: airline.charAt(0).toUpperCase() + airline.slice(1),
      price: priceNum,
      currency: priceStr.includes("€") ? "EUR" : "USD",
      departureTime: times[i * 2] || "09:00",
      arrivalTime: times[i * 2 + 1] || "18:00",
      duration: duration || "Unknown",
      stops: stops >= 0 ? stops : 1, // default to 1 stop when unknown
      stopLocations: (stops > 0 || stops < 0) ? ["Connection"] : undefined,
      cabinClass: "Economy",
      bookingUrl: searchUrl,
      scrapedAt: new Date().toISOString(),
    })
  }
  
  return flights
}

// Scrape a single flight source
async function scrapeFlightSource(
  source: typeof FLIGHT_SOURCES[number],
  params: FlightSearchParams
): Promise<FlightSearchResult> {
  const searchUrl = buildSearchUrl(source, params)
  
  try {
    const result = await firecrawl.scrape(searchUrl, {
      formats: ["markdown"],
      timeout: 30000,
    })
    
    if (!result.markdown) {
      return {
        source: source.id,
        sourceName: source.name,
        flights: [],
        searchUrl,
        scrapedAt: new Date().toISOString(),
        error: "Failed to scrape page",
      }
    }
    
    const flights = parseFlightData(result.markdown, source.id, searchUrl)
    
    return {
      source: source.id,
      sourceName: source.name,
      flights,
      searchUrl,
      scrapedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`[GoMate] Error scraping ${source.name}:`, error)
    return {
      source: source.id,
      sourceName: source.name,
      flights: [],
      searchUrl,
      scrapedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Scraping failed",
    }
  }
}

// Main flight search function - searches all sources in parallel
export async function searchFlights(params: FlightSearchParams): Promise<{
  results: FlightSearchResult[]
  allFlights: FlightResult[]
  cheapest?: FlightResult
  fastest?: FlightResult
  bestValue?: FlightResult
}> {
  // Search all sources in parallel
  const searchPromises = FLIGHT_SOURCES.map(source => scrapeFlightSource(source, params))
  const results = await Promise.all(searchPromises)

  // Combine all flights from all sources and filter implausible results
  const rawFlights = results.flatMap(r => r.flights)
  const allFlights = rawFlights.filter(f => isPlausibleFlight(f, params.from, params.to))

  // Sort by price
  allFlights.sort((a, b) => a.price - b.price)
  
  // Find best options
  const cheapest = allFlights[0]
  const fastest = [...allFlights].sort((a, b) => {
    const aDur = parseDuration(a.duration)
    const bDur = parseDuration(b.duration)
    return aDur - bDur
  })[0]
  
  // Best value = balance of price and duration
  const bestValue = [...allFlights].sort((a, b) => {
    const aScore = a.price + parseDuration(a.duration) * 10
    const bScore = b.price + parseDuration(b.duration) * 10
    return aScore - bScore
  })[0]
  
  return {
    results,
    allFlights,
    cheapest,
    fastest,
    bestValue,
  }
}

// Parse duration string to minutes
function parseDuration(duration: string): number {
  const hours = duration.match(/(\d+)\s*h/i)?.[1] || "0"
  const minutes = duration.match(/(\d+)\s*m/i)?.[1] || "0"
  return parseInt(hours) * 60 + parseInt(minutes)
}

// Compute great-circle distance between two airports in km (Haversine formula)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Minimum plausible flight duration in minutes based on distance
// Uses ~900 km/h cruise speed + 30min for takeoff/landing overhead
function minimumPlausibleDuration(fromAirport: Airport, toAirport: Airport): number {
  const distKm = haversineDistance(
    fromAirport.latitude, fromAirport.longitude,
    toAirport.latitude, toAirport.longitude
  )
  const cruiseMinutes = (distKm / 900) * 60
  return Math.max(45, Math.round(cruiseMinutes + 30)) // At least 45 min for any flight
}

// Validate a parsed flight result for plausibility
function isPlausibleFlight(
  flight: FlightResult,
  fromAirport: Airport,
  toAirport: Airport
): boolean {
  const durationMinutes = parseDuration(flight.duration)
  const minDuration = minimumPlausibleDuration(fromAirport, toAirport)

  // Reject if duration could not be parsed (e.g. "Unknown") — untrustworthy result
  if (durationMinutes === 0) {
    return false
  }
  // Reject if duration is less than 60% of minimum plausible (allows for some parsing imprecision)
  if (durationMinutes < minDuration * 0.6) {
    return false
  }
  // Reject absurdly long durations (>36 hours — likely scrape artifact)
  if (durationMinutes > 36 * 60) {
    return false
  }
  // Reject implausible prices
  if (flight.price < 30 || flight.price > 25000) {
    return false
  }
  return true
}

// Generate mock flight data for development/demo
export function generateMockFlights(_params: FlightSearchParams): FlightResult[] {
  const airlines = [
    { name: "Lufthansa", logo: "LH" },
    { name: "United Airlines", logo: "UA" },
    { name: "Delta", logo: "DL" },
    { name: "Air France", logo: "AF" },
    { name: "KLM", logo: "KL" },
    { name: "British Airways", logo: "BA" },
  ]
  
  const basePrices = [450, 520, 580, 620, 750, 890]
  const durations = ["8h 30m", "9h 15m", "10h 45m", "11h 20m", "12h 00m", "14h 30m"]
  const stopOptions = [0, 0, 1, 1, 1, 2]
  
  return airlines.map((airline, i) => ({
    id: `mock-${i}`,
    source: FLIGHT_SOURCES[i % FLIGHT_SOURCES.length].id,
    sourceUrl: FLIGHT_SOURCES[i % FLIGHT_SOURCES.length].baseUrl,
    airline: airline.name,
    airlineLogo: airline.logo,
    price: basePrices[i] + (i * 17) % 100,
    currency: "USD",
    departureTime: `${8 + i}:${i % 2 === 0 ? "00" : "30"} AM`,
    arrivalTime: `${4 + i}:${i % 2 === 0 ? "30" : "00"} PM`,
    duration: durations[i],
    stops: stopOptions[i],
    stopLocations: stopOptions[i] > 0 ? ["FRA", "LHR"].slice(0, stopOptions[i]) : undefined,
    cabinClass: "Economy",
    bookingUrl: `https://example.com/book/${i}`,
    amenities: ["Wi-Fi", "Meals", i < 3 ? "Entertainment" : "USB charging"].filter(Boolean),
    baggageIncluded: i < 2 ? "1 checked bag" : "Carry-on only",
    scrapedAt: MOCK_FLIGHT_SCRAPED_AT,
  }))
}
