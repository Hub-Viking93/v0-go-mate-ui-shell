"use client"

import React from "react"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Plane, Loader2 } from "lucide-react"
import type { Airport } from "@/lib/gomate/airports"

interface AirportAutocompleteProps {
  value: Airport | null
  onChange: (airport: Airport | null) => void
  placeholder?: string
  id?: string
  name?: string
}

export function AirportAutocomplete({
  value,
  onChange,
  placeholder = "Search airports...",
  id,
  name,
}: AirportAutocompleteProps) {
  const [query, setQuery] = useState(value ? `${value.city} (${value.iataCode})` : "")
  const [suggestions, setSuggestions] = useState<Airport[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch suggestions when query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 2) {
        // Load popular airports
        setIsLoading(true)
        try {
          const res = await fetch("/api/airports?limit=8")
          if (!res.ok) { setSuggestions([]); setIsLoading(false); return }
          const data = await res.json()
          setSuggestions(data.airports || [])
        } catch (error) {
          console.error("Error fetching airports:", error)
          setSuggestions([])
        }
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const res = await fetch(`/api/airports?q=${encodeURIComponent(query)}&limit=8`)
        if (!res.ok) { setSuggestions([]); setIsLoading(false); return }
        const data = await res.json()
        setSuggestions(data.airports || [])
      } catch (error) {
        console.error("Error fetching airports:", error)
        setSuggestions([])
      }
      setIsLoading(false)
    }

    const debounce = setTimeout(fetchSuggestions, 200)
    return () => clearTimeout(debounce)
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (airport: Airport) => {
    setQuery(`${airport.city} (${airport.iataCode})`)
    onChange(airport)
    setIsOpen(false)
    setHighlightIndex(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightIndex(i => Math.min(i + 1, suggestions.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightIndex(i => Math.max(i - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (suggestions[highlightIndex]) {
          handleSelect(suggestions[highlightIndex])
        }
        break
      case "Escape":
        setIsOpen(false)
        break
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          name={name}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(null)
            setIsOpen(true)
            setHighlightIndex(0)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="rounded-xl pr-10"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plane className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((airport, index) => (
              <button
                key={airport.id}
                type="button"
                onClick={() => handleSelect(airport)}
                onMouseEnter={() => setHighlightIndex(index)}
                className={`w-full px-4 py-3 text-left flex items-start gap-3 transition-colors ${
                  index === highlightIndex 
                    ? "bg-accent text-accent-foreground" 
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">{airport.iataCode}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{airport.city}</p>
                  <p className="text-sm text-muted-foreground truncate">{airport.name}</p>
                  <p className="text-xs text-muted-foreground">{airport.country}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length >= 2 && suggestions.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg p-4 text-center text-sm text-muted-foreground">
          No airports found for "{query}"
        </div>
      )}
    </div>
  )
}
