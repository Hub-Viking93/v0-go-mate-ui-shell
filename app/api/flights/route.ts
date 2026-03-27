import { NextResponse } from "next/server"
import {
  searchFlights,
  generateMockFlights,
  FLIGHT_SOURCES,
  MOCK_FLIGHT_SCRAPED_AT,
  type FlightSearchParams,
} from "@/lib/gomate/flight-search"
import { getAirportByCode, POPULAR_AIRPORTS } from "@/lib/gomate/airports"
import { createClient } from "@/lib/supabase/server"
import { getUserTier } from "@/lib/gomate/tier"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (tier !== "pro_single" && tier !== "pro_plus") {
    return NextResponse.json({ error: "Flight search requires Pro or Pro+ plan" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { from, to, departDate, returnDate, travelers, cabinClass, useMock } = body

    // Validate required fields
    if (!from || !to || !departDate) {
      return NextResponse.json(
        { error: "Missing required fields: from, to, departDate" },
        { status: 400 }
      )
    }
    
    // Get airport objects from IATA codes
    const fromAirport = typeof from === "string" 
      ? getAirportByCode(from) 
      : from
    const toAirport = typeof to === "string" 
      ? getAirportByCode(to) 
      : to
    
    if (!fromAirport || !toAirport) {
      return NextResponse.json(
        { error: "Invalid airport codes" },
        { status: 400 }
      )
    }
    
    const searchParams: FlightSearchParams = {
      from: fromAirport,
      to: toAirport,
      departDate,
      returnDate,
      travelers: travelers || 1,
      cabinClass: cabinClass || "economy",
    }
    
    // Use mock data for development or if explicitly requested
    if (useMock || !process.env.FIRECRAWL_API_KEY) {
      const mockFlights = generateMockFlights(searchParams)
      
      return NextResponse.json({
        results: FLIGHT_SOURCES.map(source => ({
          source: source.id,
          sourceName: source.name,
          flights: mockFlights.filter(f => f.source === source.id),
          searchUrl: source.baseUrl,
          scrapedAt: MOCK_FLIGHT_SCRAPED_AT,
        })),
        allFlights: mockFlights,
        cheapest: mockFlights[0],
        fastest: mockFlights.find(f => f.stops === 0) || mockFlights[0],
        bestValue: mockFlights[1],
        isMock: true,
      })
    }
    
    // Real search with Firecrawl
    const results = await searchFlights(searchParams)
    
    return NextResponse.json({
      ...results,
      isMock: false,
    })
  } catch (error) {
    console.error("[GoMate] Flight search error:", error)
    return NextResponse.json(
      { error: "Failed to search flights" },
      { status: 500 }
    )
  }
}

// GET - Return available sources and popular airports
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    sources: FLIGHT_SOURCES.map(s => ({
      id: s.id,
      name: s.name,
      color: s.color,
    })),
    popularAirports: POPULAR_AIRPORTS.slice(0, 20),
  })
}
