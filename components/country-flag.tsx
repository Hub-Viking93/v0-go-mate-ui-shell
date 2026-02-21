"use client"

import { getCountryFlag } from "@/lib/gomate/country-flags"

interface CountryFlagProps {
  country: string
  size?: "sm" | "md" | "lg"
  showEmoji?: boolean
  className?: string
}

const sizeMap = {
  sm: { width: 20, height: 15, emoji: "text-sm" },
  md: { width: 32, height: 24, emoji: "text-lg" },
  lg: { width: 48, height: 36, emoji: "text-2xl" },
}

export function CountryFlag({ 
  country, 
  size = "md", 
  showEmoji = false,
  className = "" 
}: CountryFlagProps) {
  if (!country) {
    return null
  }
  
  const flag = getCountryFlag(country)
  const dimensions = sizeMap[size] || sizeMap.md
  
  if (showEmoji || !flag.imageUrl) {
    return (
      <span className={`${dimensions.emoji} ${className}`} role="img" aria-label={`${country} flag`}>
        {flag.emoji}
      </span>
    )
  }
  
  return (
    <img
      src={flag.imageUrl || "/placeholder.svg"}
      alt={`${country} flag`}
      width={dimensions.width}
      height={dimensions.height}
      className={`rounded-sm object-cover ${className}`}
      style={{ width: dimensions.width, height: dimensions.height }}
    />
  )
}

// Display country name with flag
interface CountryWithFlagProps {
  country: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function CountryWithFlag({ country, size = "md", className = "" }: CountryWithFlagProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <CountryFlag country={country} size={size} />
      <span className="capitalize">{country}</span>
    </span>
  )
}
