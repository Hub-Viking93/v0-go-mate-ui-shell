"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { Plane, Briefcase, Clock, MapPin, CheckCircle2 } from "lucide-react"
import type { BookingResult } from "./result-card"

interface DetailsDrawerProps {
  result: BookingResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DetailsDrawer({ result, open, onOpenChange }: DetailsDrawerProps) {
  const { toast } = useToast()

  if (!result) return null

  const isFlight = result.type === "flight"

  const handleBook = () => {
    toast({
      title: "Demo UI only",
      description: "This is a non-functional demo. No actual booking was made.",
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-secondary text-primary">
              {isFlight ? <Plane className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
            </div>
            {result.title}
          </SheetTitle>
          <SheetDescription>{result.subtitle}</SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary">
            <span className="text-muted-foreground">Total Price</span>
            <span className="text-2xl font-bold text-foreground">{result.price}</span>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Details</h4>
            
            <div className="grid grid-cols-2 gap-4">
              {result.duration && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="text-foreground">{result.duration}</span>
                </div>
              )}
              {result.stops && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Stops:</span>
                  <span className="text-foreground">{result.stops}</span>
                </div>
              )}
            </div>

            {result.amenities && result.amenities.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-muted-foreground">Amenities</h5>
                <div className="space-y-2">
                  {result.amenities.map((amenity) => (
                    <div key={amenity} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-foreground">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 space-y-3">
            <Button onClick={handleBook} className="w-full rounded-xl" size="lg">
              Book Now
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              By clicking Book Now, you agree to our terms and conditions.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
