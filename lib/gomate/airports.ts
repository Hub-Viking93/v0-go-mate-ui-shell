"use client"

// Airport interface matching the dataset structure
export interface Airport {
  id: number
  name: string
  city: string
  country: string
  iataCode: string | null
  icaoCode: string
  latitude: number
  longitude: number
  altitude: number
  timezone: string
  type: string
}

// Parse a single line from the airports dataset
function parseAirportLine(line: string): Airport | null {
  try {
    // CSV format: id,"name","city","country","iata","icao",lat,lon,alt,tz_offset,dst,tz_name,type,source
    const parts = line.split(",")
    if (parts.length < 14) return null
    
    const id = parseInt(parts[0])
    const name = parts[1]?.replace(/"/g, "") || ""
    const city = parts[2]?.replace(/"/g, "") || ""
    const country = parts[3]?.replace(/"/g, "") || ""
    const iataCode = parts[4]?.replace(/"/g, "").replace(/\\N/g, "") || null
    const icaoCode = parts[5]?.replace(/"/g, "") || ""
    const latitude = parseFloat(parts[6]) || 0
    const longitude = parseFloat(parts[7]) || 0
    const altitude = parseInt(parts[8]) || 0
    const timezone = parts[11]?.replace(/"/g, "") || ""
    const type = parts[12]?.replace(/"/g, "") || "airport"
    
    // Only include airports with valid IATA codes
    if (!iataCode || iataCode === "\\N" || iataCode.length !== 3) return null
    
    return {
      id,
      name,
      city,
      country,
      iataCode,
      icaoCode,
      latitude,
      longitude,
      altitude,
      timezone,
      type,
    }
  } catch {
    return null
  }
}

// Pre-parsed popular airports for quick access (major international hubs)
export const POPULAR_AIRPORTS: Airport[] = [
  { id: 1, name: "John F Kennedy International Airport", city: "New York", country: "United States", iataCode: "JFK", icaoCode: "KJFK", latitude: 40.6398, longitude: -73.7789, altitude: 13, timezone: "America/New_York", type: "airport" },
  { id: 2, name: "Los Angeles International Airport", city: "Los Angeles", country: "United States", iataCode: "LAX", icaoCode: "KLAX", latitude: 33.9425, longitude: -118.408, altitude: 125, timezone: "America/Los_Angeles", type: "airport" },
  { id: 3, name: "London Heathrow Airport", city: "London", country: "United Kingdom", iataCode: "LHR", icaoCode: "EGLL", latitude: 51.4706, longitude: -0.461941, altitude: 83, timezone: "Europe/London", type: "airport" },
  { id: 4, name: "Paris Charles de Gaulle Airport", city: "Paris", country: "France", iataCode: "CDG", icaoCode: "LFPG", latitude: 49.0128, longitude: 2.55, altitude: 392, timezone: "Europe/Paris", type: "airport" },
  { id: 5, name: "Frankfurt Airport", city: "Frankfurt", country: "Germany", iataCode: "FRA", icaoCode: "EDDF", latitude: 50.0333, longitude: 8.57046, altitude: 364, timezone: "Europe/Berlin", type: "airport" },
  { id: 6, name: "Berlin Brandenburg Airport", city: "Berlin", country: "Germany", iataCode: "BER", icaoCode: "EDDB", latitude: 52.366667, longitude: 13.503333, altitude: 157, timezone: "Europe/Berlin", type: "airport" },
  { id: 7, name: "Amsterdam Airport Schiphol", city: "Amsterdam", country: "Netherlands", iataCode: "AMS", icaoCode: "EHAM", latitude: 52.3086, longitude: 4.76389, altitude: -11, timezone: "Europe/Amsterdam", type: "airport" },
  { id: 8, name: "Madrid Barajas International Airport", city: "Madrid", country: "Spain", iataCode: "MAD", icaoCode: "LEMD", latitude: 40.4936, longitude: -3.56676, altitude: 1998, timezone: "Europe/Madrid", type: "airport" },
  { id: 9, name: "Barcelona El Prat Airport", city: "Barcelona", country: "Spain", iataCode: "BCN", icaoCode: "LEBL", latitude: 41.2971, longitude: 2.07846, altitude: 12, timezone: "Europe/Madrid", type: "airport" },
  { id: 10, name: "Lisbon Humberto Delgado Airport", city: "Lisbon", country: "Portugal", iataCode: "LIS", icaoCode: "LPPT", latitude: 38.7813, longitude: -9.13592, altitude: 374, timezone: "Europe/Lisbon", type: "airport" },
  { id: 11, name: "Tokyo Narita International Airport", city: "Tokyo", country: "Japan", iataCode: "NRT", icaoCode: "RJAA", latitude: 35.7647, longitude: 140.386, altitude: 141, timezone: "Asia/Tokyo", type: "airport" },
  { id: 12, name: "Tokyo Haneda Airport", city: "Tokyo", country: "Japan", iataCode: "HND", icaoCode: "RJTT", latitude: 35.5523, longitude: 139.78, altitude: 35, timezone: "Asia/Tokyo", type: "airport" },
  { id: 13, name: "Dubai International Airport", city: "Dubai", country: "United Arab Emirates", iataCode: "DXB", icaoCode: "OMDB", latitude: 25.2528, longitude: 55.3644, altitude: 62, timezone: "Asia/Dubai", type: "airport" },
  { id: 14, name: "Singapore Changi Airport", city: "Singapore", country: "Singapore", iataCode: "SIN", icaoCode: "WSSS", latitude: 1.35019, longitude: 103.994, altitude: 22, timezone: "Asia/Singapore", type: "airport" },
  { id: 15, name: "Sydney Kingsford Smith Airport", city: "Sydney", country: "Australia", iataCode: "SYD", icaoCode: "YSSY", latitude: -33.9461, longitude: 151.177, altitude: 21, timezone: "Australia/Sydney", type: "airport" },
  { id: 16, name: "Toronto Pearson International Airport", city: "Toronto", country: "Canada", iataCode: "YYZ", icaoCode: "CYYZ", latitude: 43.6772, longitude: -79.6306, altitude: 569, timezone: "America/Toronto", type: "airport" },
  { id: 17, name: "Munich Airport", city: "Munich", country: "Germany", iataCode: "MUC", icaoCode: "EDDM", latitude: 48.3538, longitude: 11.7861, altitude: 1487, timezone: "Europe/Berlin", type: "airport" },
  { id: 18, name: "Zurich Airport", city: "Zurich", country: "Switzerland", iataCode: "ZRH", icaoCode: "LSZH", latitude: 47.4647, longitude: 8.54917, altitude: 1416, timezone: "Europe/Zurich", type: "airport" },
  { id: 19, name: "Vienna International Airport", city: "Vienna", country: "Austria", iataCode: "VIE", icaoCode: "LOWW", latitude: 48.1103, longitude: 16.5697, altitude: 600, timezone: "Europe/Vienna", type: "airport" },
  { id: 20, name: "Copenhagen Airport", city: "Copenhagen", country: "Denmark", iataCode: "CPH", icaoCode: "EKCH", latitude: 55.618, longitude: 12.656, altitude: 17, timezone: "Europe/Copenhagen", type: "airport" },
  { id: 21, name: "Stockholm Arlanda Airport", city: "Stockholm", country: "Sweden", iataCode: "ARN", icaoCode: "ESSA", latitude: 59.6519, longitude: 17.9186, altitude: 137, timezone: "Europe/Stockholm", type: "airport" },
  { id: 22, name: "Oslo Gardermoen Airport", city: "Oslo", country: "Norway", iataCode: "OSL", icaoCode: "ENGM", latitude: 60.1939, longitude: 11.1004, altitude: 681, timezone: "Europe/Oslo", type: "airport" },
  { id: 23, name: "Helsinki Vantaa Airport", city: "Helsinki", country: "Finland", iataCode: "HEL", icaoCode: "EFHK", latitude: 60.3172, longitude: 24.9633, altitude: 179, timezone: "Europe/Helsinki", type: "airport" },
  { id: 24, name: "Rome Fiumicino Airport", city: "Rome", country: "Italy", iataCode: "FCO", icaoCode: "LIRF", latitude: 41.8003, longitude: 12.2389, altitude: 13, timezone: "Europe/Rome", type: "airport" },
  { id: 25, name: "Milan Malpensa Airport", city: "Milan", country: "Italy", iataCode: "MXP", icaoCode: "LIMC", latitude: 45.6306, longitude: 8.72811, altitude: 768, timezone: "Europe/Rome", type: "airport" },
  { id: 26, name: "Chicago O'Hare International Airport", city: "Chicago", country: "United States", iataCode: "ORD", icaoCode: "KORD", latitude: 41.9786, longitude: -87.9048, altitude: 672, timezone: "America/Chicago", type: "airport" },
  { id: 27, name: "San Francisco International Airport", city: "San Francisco", country: "United States", iataCode: "SFO", icaoCode: "KSFO", latitude: 37.619, longitude: -122.375, altitude: 13, timezone: "America/Los_Angeles", type: "airport" },
  { id: 28, name: "Miami International Airport", city: "Miami", country: "United States", iataCode: "MIA", icaoCode: "KMIA", latitude: 25.7932, longitude: -80.2906, altitude: 8, timezone: "America/New_York", type: "airport" },
  { id: 29, name: "Atlanta Hartsfield-Jackson International Airport", city: "Atlanta", country: "United States", iataCode: "ATL", icaoCode: "KATL", latitude: 33.6367, longitude: -84.428, altitude: 1026, timezone: "America/New_York", type: "airport" },
  { id: 30, name: "Hong Kong International Airport", city: "Hong Kong", country: "Hong Kong", iataCode: "HKG", icaoCode: "VHHH", latitude: 22.3089, longitude: 113.915, altitude: 28, timezone: "Asia/Hong_Kong", type: "airport" },
]

// Search airports by query (city, name, or IATA code)
export function searchAirports(query: string, limit = 10): Airport[] {
  if (!query || query.length < 2) return POPULAR_AIRPORTS.slice(0, limit)
  
  const q = query.toLowerCase().trim()
  
  // First, check for exact IATA code match
  const exactMatch = POPULAR_AIRPORTS.find(
    a => a.iataCode?.toLowerCase() === q
  )
  if (exactMatch) return [exactMatch]
  
  // Then search by city, name, or partial IATA code
  const matches = POPULAR_AIRPORTS.filter(a => 
    a.city.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.iataCode?.toLowerCase().includes(q) ||
    a.country.toLowerCase().includes(q)
  )
  
  // Sort by relevance (exact city match first, then partial matches)
  matches.sort((a, b) => {
    const aCity = a.city.toLowerCase()
    const bCity = b.city.toLowerCase()
    if (aCity === q) return -1
    if (bCity === q) return 1
    if (aCity.startsWith(q)) return -1
    if (bCity.startsWith(q)) return 1
    return 0
  })
  
  return matches.slice(0, limit)
}

// Get airport by IATA code
export function getAirportByCode(code: string): Airport | undefined {
  return POPULAR_AIRPORTS.find(a => a.iataCode?.toLowerCase() === code.toLowerCase())
}

// Format airport for display
export function formatAirportDisplay(airport: Airport): string {
  return `${airport.city} (${airport.iataCode})`
}

// Format full airport info
export function formatAirportFull(airport: Airport): string {
  return `${airport.name} - ${airport.city}, ${airport.country} (${airport.iataCode})`
}
