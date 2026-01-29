import { NextResponse } from "next/server"
import { searchAirports, POPULAR_AIRPORTS, type Airport } from "@/lib/gomate/airports"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q") || ""
  const limit = parseInt(searchParams.get("limit") || "10")
  
  if (!query || query.length < 2) {
    // Return popular airports if no query
    return NextResponse.json({
      airports: POPULAR_AIRPORTS.slice(0, limit),
      total: POPULAR_AIRPORTS.length,
    })
  }
  
  const airports = searchAirports(query, limit)
  
  return NextResponse.json({
    airports,
    total: airports.length,
    query,
  })
}
