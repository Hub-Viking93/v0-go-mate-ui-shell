"use client"

import { useState } from "react"
import { BookingSearchForm, type FlightSearchData } from "@/components/booking/booking-search-form"
import { ResultCard, type BookingResult } from "@/components/booking/result-card"
import { DetailsDrawer } from "@/components/booking/details-drawer"
import { ResultCardSkeleton } from "@/components/skeletons"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Plane, 
  Building, 
  Search, 
  Filter, 
  Trophy, 
  Clock, 
  Sparkles,
  ExternalLink,
  AlertCircle
} from "lucide-react"
import type { FlightResult } from "@/lib/gomate/flight-search"
import { FullPageGate } from "@/components/tier-gate"
import { useTier } from "@/hooks/use-tier"
import { useRouter } from "next/navigation"

interface SearchResults {
  allFlights: FlightResult[]
  cheapest?: FlightResult
  fastest?: FlightResult
  bestValue?: FlightResult
  isMock?: boolean
}

const sourceColors: Record<string, string> = {
  skyscanner: "#00a698",
  google: "#4285f4",
  momondo: "#ff6b00",
  kayak: "#ff690f",
  kiwi: "#00a991",
}

export default function BookingPage() {
  const router = useRouter()
  const { tier } = useTier()
  const [searchMode, setSearchMode] = useState<"flights" | "hotels">("flights")
  const [hasSearched, setHasSearched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedResult, setSelectedResult] = useState<BookingResult | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  
  // Filters
  const [maxPrice, setMaxPrice] = useState(2000)
  const [stopFilters, setStopFilters] = useState<number[]>([])
  const [sourceFilters, setSourceFilters] = useState<string[]>([])

  const handleSearch = async (data: FlightSearchData) => {
    setIsLoading(true)
    setHasSearched(true)
    setSearchError(null)
    
    try {
      const response = await fetch("/api/flights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: data.from.iataCode,
          to: data.to.iataCode,
          departDate: data.departDate,
          returnDate: data.returnDate,
          travelers: data.travelers,
          cabinClass: data.cabinClass,
          // TODO v2: flight search uses Firecrawl scraping which is inherently fragile;
          // the API falls back to mock data when FIRECRAWL_API_KEY is not set
        }),
      })
      
      if (!response.ok) {
        throw new Error("Search failed")
      }
      
      const results = await response.json()
      setSearchResults(results)
    } catch (error) {
      console.error("Search error:", error)
      setSearchError("Failed to search for flights. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelect = (result: BookingResult) => {
    setSelectedResult(result)
    setDrawerOpen(true)
  }

  // Convert FlightResult to BookingResult
  const flightToBookingResult = (flight: FlightResult): BookingResult => ({
    id: flight.id,
    type: "flight",
    title: `${flight.airline}`,
    subtitle: `${flight.departureTime} - ${flight.arrivalTime} · ${flight.cabinClass}`,
    price: `$${flight.price}`,
    duration: flight.duration,
    stops: flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`,
    amenities: flight.amenities || [],
    source: flight.source,
    sourceUrl: flight.bookingUrl,
  })

  // Filter flights
  const filteredFlights = searchResults?.allFlights.filter(flight => {
    if (flight.price > maxPrice) return false
    if (stopFilters.length > 0 && !stopFilters.includes(flight.stops)) return false
    if (sourceFilters.length > 0 && !sourceFilters.includes(flight.source)) return false
    return true
  }) || []

  const toggleStopFilter = (stops: number) => {
    setStopFilters(prev => 
      prev.includes(stops) 
        ? prev.filter(s => s !== stops)
        : [...prev, stops]
    )
  }

  const toggleSourceFilter = (source: string) => {
    setSourceFilters(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source)
        : [...prev, source]
    )
  }

  return (
    <FullPageGate tier={tier} feature="booking" onUpgrade={() => router.push("/settings")}>
    <div className="p-6 md:p-8 lg:p-10">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1B3A2D] via-[#234D3A] to-[#2D6A4F] p-6 md:p-8 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(94,232,156,0.15),transparent_60%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <Plane className="w-7 h-7 text-[#5EE89C]" />
              Book Travel
            </h1>
            <p className="text-white/60 mt-1.5 text-sm md:text-base">
              Search and compare flights from Skyscanner, Google Flights, Momondo, Kayak, and Kiwi.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant={searchMode === "flights" ? "default" : "outline"}
              onClick={() => setSearchMode("flights")}
              className={searchMode === "flights"
                ? "gap-2 rounded-xl bg-white text-[#1B3A2D] hover:bg-white/90"
                : "gap-2 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              }
            >
              <Plane className="w-4 h-4" />
              Flights
            </Button>
            <Button
              variant="outline"
              onClick={() => setSearchMode("hotels")}
              className="gap-2 rounded-xl bg-white/10 border-white/20 text-white/50 cursor-not-allowed"
              disabled
            >
              <Building className="w-4 h-4" />
              Hotels (Coming Soon)
            </Button>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <BookingSearchForm onSearch={handleSearch} isSearching={isLoading} />

      {/* Results Section */}
      {hasSearched && (
        <div className="mt-8">
          {/* Error State */}
          {searchError && (
            <div className="p-4 rounded-xl bg-destructive/10 text-destructive flex items-center gap-3 mb-6">
              <AlertCircle className="w-5 h-5" />
              <p>{searchError}</p>
            </div>
          )}

          {/* Best Options Cards */}
          {searchResults && !isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {searchResults.cheapest && (
                <div className="gm-card p-5 bg-gradient-to-br from-emerald-500/8 to-emerald-600/4 border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="font-semibold text-emerald-600">Cheapest</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground font-mono">${searchResults.cheapest.price}</p>
                  <p className="text-sm text-muted-foreground mt-1">{searchResults.cheapest.airline}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {searchResults.cheapest.duration} · {searchResults.cheapest.stops === 0 ? "Nonstop" : `${searchResults.cheapest.stops} stop`}
                  </p>
                </div>
              )}

              {searchResults.fastest && (
                <div className="gm-card p-5 bg-gradient-to-br from-blue-500/8 to-blue-600/4 border-blue-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-blue-600">Fastest</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground font-mono">{searchResults.fastest.duration}</p>
                  <p className="text-sm text-muted-foreground mt-1">{searchResults.fastest.airline}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ${searchResults.fastest.price} · {searchResults.fastest.stops === 0 ? "Nonstop" : `${searchResults.fastest.stops} stop`}
                  </p>
                </div>
              )}

              {searchResults.bestValue && (
                <div className="gm-card p-5 bg-gradient-to-br from-purple-500/8 to-purple-600/4 border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="font-semibold text-purple-600">Best Value</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground font-mono">${searchResults.bestValue.price}</p>
                  <p className="text-sm text-muted-foreground mt-1">{searchResults.bestValue.airline}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {searchResults.bestValue.duration} · {searchResults.bestValue.stops === 0 ? "Nonstop" : `${searchResults.bestValue.stops} stop`}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filters Sidebar */}
            <div className="lg:w-64 shrink-0">
              <div className="lg:hidden mb-4">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="w-full gap-2"
                >
                  <Filter className="w-4 h-4" />
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </Button>
              </div>

              <div className={`${showFilters ? "block" : "hidden"} lg:block rounded-2xl border border-border bg-card p-5 space-y-6`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Filters</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => {
                      setStopFilters([])
                      setSourceFilters([])
                      setMaxPrice(2000)
                    }}
                  >
                    Clear all
                  </Button>
                </div>

                {/* Stops Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Stops</Label>
                  <div className="space-y-2">
                    {[
                      { value: 0, label: "Nonstop" },
                      { value: 1, label: "1 stop" },
                      { value: 2, label: "2+ stops" },
                    ].map((stop) => (
                      <div key={stop.value} className="flex items-center gap-2">
                        <Checkbox 
                          id={`stop-${stop.value}`}
                          checked={stopFilters.includes(stop.value)}
                          onCheckedChange={() => toggleStopFilter(stop.value)}
                        />
                        <Label htmlFor={`stop-${stop.value}`} className="text-sm font-normal cursor-pointer">
                          {stop.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sources Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Sources</Label>
                  <div className="space-y-2">
                    {[
                      { id: "skyscanner", name: "Skyscanner" },
                      { id: "google", name: "Google Flights" },
                      { id: "momondo", name: "Momondo" },
                      { id: "kayak", name: "Kayak" },
                      { id: "kiwi", name: "Kiwi" },
                    ].map((source) => (
                      <div key={source.id} className="flex items-center gap-2">
                        <Checkbox 
                          id={`source-${source.id}`}
                          checked={sourceFilters.includes(source.id)}
                          onCheckedChange={() => toggleSourceFilter(source.id)}
                        />
                        <Label htmlFor={`source-${source.id}`} className="text-sm font-normal cursor-pointer flex items-center gap-2">
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: sourceColors[source.id] }}
                          />
                          {source.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Max Price: ${maxPrice}</Label>
                  <Slider 
                    value={[maxPrice]} 
                    onValueChange={([v]) => setMaxPrice(v)}
                    max={3000} 
                    step={50} 
                    className="mt-2" 
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>$0</span>
                    <span>$3000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredFlights.length} flight{filteredFlights.length !== 1 ? "s" : ""} found
                  {searchResults?.isMock && (
                    <span className="ml-2 text-xs text-amber-600">(Demo data)</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Badge variant="outline" className="cursor-pointer">
                    Price
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer">
                    Duration
                  </Badge>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ResultCardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFlights.map((flight) => (
                    <div key={flight.id} className="rounded-2xl border border-border bg-card p-4 hover:border-primary/50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          {/* Airline Logo Placeholder */}
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: sourceColors[flight.source] || "#6b7280" }}
                          >
                            {flight.airline.slice(0, 2).toUpperCase()}
                          </div>
                          
                          <div>
                            <p className="font-semibold text-foreground">{flight.airline}</p>
                            <p className="text-sm text-muted-foreground">
                              {flight.departureTime} - {flight.arrivalTime}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="font-medium text-foreground">{flight.duration}</p>
                            <p className="text-xs text-muted-foreground">
                              {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-2xl font-bold text-foreground">${flight.price}</p>
                            <p className="text-xs text-muted-foreground">{flight.cabinClass}</p>
                          </div>
                          
                          <Button 
                            size="sm" 
                            className="gap-2"
                            onClick={() => window.open(flight.bookingUrl, "_blank")}
                          >
                            Book
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Source & Amenities */}
                      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
                        <span 
                          className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                          style={{ backgroundColor: sourceColors[flight.source] }}
                        >
                          {flight.source.charAt(0).toUpperCase() + flight.source.slice(1)}
                        </span>
                        {flight.amenities?.map((amenity) => (
                          <Badge key={amenity} variant="secondary" className="text-xs">
                            {amenity}
                          </Badge>
                        ))}
                        {flight.baggageIncluded && (
                          <Badge variant="outline" className="text-xs">
                            {flight.baggageIncluded}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasSearched && (
        <div className="mt-16">
          <EmptyState
            icon={<Search className="w-12 h-12" />}
            title="Search for flights"
            description="Enter your travel details above to compare prices from Skyscanner, Google Flights, Momondo, Kayak, and Kiwi."
          />
        </div>
      )}

      {/* Details Drawer */}
      <DetailsDrawer
        result={selectedResult}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
    </FullPageGate>
  )
}
