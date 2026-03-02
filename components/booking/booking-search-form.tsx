"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AirportAutocomplete } from "./airport-autocomplete"
import { Plane, Calendar, Users, Search, ArrowLeftRight, Loader2 } from "lucide-react"
import type { Airport } from "@/lib/gomate/airports"

export interface FlightSearchData {
  from: Airport
  to: Airport
  departDate: string
  returnDate?: string
  travelers: number
  cabinClass: "economy" | "premium_economy" | "business" | "first"
  tripType: "roundtrip" | "oneway"
}

interface BookingSearchFormProps {
  onSearch?: (data: FlightSearchData) => void
  isSearching?: boolean
}

export function BookingSearchForm({ onSearch, isSearching }: BookingSearchFormProps) {
  const [fromAirport, setFromAirport] = useState<Airport | null>(null)
  const [toAirport, setToAirport] = useState<Airport | null>(null)
  const [tripType, setTripType] = useState<"roundtrip" | "oneway">("roundtrip")
  const [cabinClass, setCabinClass] = useState<"economy" | "premium_economy" | "business" | "first">("economy")
  const [departDate, setDepartDate] = useState("")
  const [returnDate, setReturnDate] = useState("")
  const [travelers, setTravelers] = useState(1)

  const handleSwapAirports = () => {
    const temp = fromAirport
    setFromAirport(toAirport)
    setToAirport(temp)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!fromAirport || !toAirport || !departDate) {
      alert("Please fill in all required fields")
      return
    }

    if (tripType === "roundtrip" && !returnDate) {
      alert("Please select a return date for round trip")
      return
    }

    onSearch?.({
      from: fromAirport,
      to: toAirport,
      departDate,
      returnDate: tripType === "roundtrip" ? returnDate : undefined,
      travelers,
      cabinClass,
      tripType,
    })
  }

  // Set minimum date to today
  const today = new Date().toISOString().split("T")[0]

  return (
    <form onSubmit={handleSubmit} className="gm-card-static p-6">
      {/* Trip Type & Class */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={tripType === "roundtrip" ? "default" : "outline"}
            size="sm"
            onClick={() => setTripType("roundtrip")}
            className="rounded-lg"
          >
            Round Trip
          </Button>
          <Button
            type="button"
            variant={tripType === "oneway" ? "default" : "outline"}
            size="sm"
            onClick={() => setTripType("oneway")}
            className="rounded-lg"
          >
            One Way
          </Button>
        </div>
        
        <Select value={cabinClass} onValueChange={(v) => setCabinClass(v as typeof cabinClass)}>
          <SelectTrigger className="w-40 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="economy">Economy</SelectItem>
            <SelectItem value="premium_economy">Premium Economy</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="first">First Class</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Search Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        {/* From */}
        <div className="lg:col-span-2 space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Plane className="w-4 h-4 text-primary" />
            From
          </Label>
          <AirportAutocomplete
            value={fromAirport}
            onChange={setFromAirport}
            placeholder="Departure city or airport"
          />
        </div>
        
        {/* Swap Button */}
        <div className="hidden lg:flex items-end justify-center pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSwapAirports}
            className="rounded-full hover:bg-primary/10"
          >
            <ArrowLeftRight className="w-4 h-4 text-primary" />
          </Button>
        </div>
        
        {/* To */}
        <div className="lg:col-span-2 space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Plane className="w-4 h-4 text-primary rotate-90" />
            To
          </Label>
          <AirportAutocomplete
            value={toAirport}
            onChange={setToAirport}
            placeholder="Arrival city or airport"
          />
        </div>
        
        {/* Mobile Swap */}
        <div className="lg:hidden flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSwapAirports}
            className="gap-2 rounded-lg bg-transparent"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Swap
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Depart Date */}
        <div className="space-y-2">
          <Label htmlFor="departDate" className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Depart
          </Label>
          <Input 
            id="departDate" 
            name="departDate" 
            type="date"
            min={today}
            value={departDate}
            onChange={(e) => setDepartDate(e.target.value)}
            className="rounded-xl"
            required
          />
        </div>
        
        {/* Return Date */}
        <div className="space-y-2">
          <Label htmlFor="returnDate" className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Return
          </Label>
          <Input 
            id="returnDate" 
            name="returnDate" 
            type="date"
            min={departDate || today}
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className="rounded-xl"
            disabled={tripType === "oneway"}
            required={tripType === "roundtrip"}
          />
        </div>
        
        {/* Travelers */}
        <div className="space-y-2">
          <Label htmlFor="travelers" className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Travelers
          </Label>
          <Input 
            id="travelers" 
            name="travelers" 
            type="number" 
            min={1} 
            max={9}
            value={travelers}
            onChange={(e) => setTravelers(parseInt(e.target.value) || 1)}
            className="rounded-xl"
          />
        </div>
        
        {/* Search Button */}
        <div className="flex items-end">
          <Button 
            type="submit" 
            className="w-full gap-2 rounded-xl h-10"
            disabled={isSearching || !fromAirport || !toAirport || !departDate}
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search Flights
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Source badges */}
      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border">
        <span className="text-xs text-muted-foreground">Comparing prices from:</span>
        {[
          { name: "Skyscanner", color: "#00a698" },
          { name: "Google Flights", color: "#4285f4" },
          { name: "Momondo", color: "#ff6b00" },
          { name: "Kayak", color: "#ff690f" },
          { name: "Kiwi", color: "#00a991" },
        ].map((source) => (
          <span
            key={source.name}
            className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
            style={{ backgroundColor: source.color }}
          >
            {source.name}
          </span>
        ))}
      </div>
    </form>
  )
}
