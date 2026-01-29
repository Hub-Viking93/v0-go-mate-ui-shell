"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plane, Clock, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"

export interface BookingResult {
  id: string
  type: "flight" | "hotel"
  title: string
  subtitle: string
  price: string
  duration?: string
  stops?: string
  amenities?: string[]
  rating?: number
}

interface ResultCardProps {
  result: BookingResult
  onSelect?: (result: BookingResult) => void
  className?: string
}

export function ResultCard({ result, onSelect, className }: ResultCardProps) {
  const isFlight = result.type === "flight"

  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30",
      className
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="shrink-0 p-3 rounded-xl bg-secondary text-primary">
            {isFlight ? <Plane className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="font-semibold text-foreground">{result.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{result.subtitle}</p>
            
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {result.duration && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {result.duration}
                </span>
              )}
              {result.stops && (
                <Badge variant="secondary" className="text-xs">
                  {result.stops}
                </Badge>
              )}
              {result.rating && (
                <Badge variant="secondary" className="text-xs">
                  {result.rating}/5 rating
                </Badge>
              )}
            </div>
            
            {result.amenities && result.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {result.amenities.slice(0, 3).map((amenity) => (
                  <Badge key={amenity} variant="outline" className="text-xs">
                    {amenity}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2 shrink-0">
          <p className="text-2xl font-bold text-foreground">{result.price}</p>
          <Button onClick={() => onSelect?.(result)} className="rounded-xl">
            Select
          </Button>
        </div>
      </div>
    </div>
  )
}
