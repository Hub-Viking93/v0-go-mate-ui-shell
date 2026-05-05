import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getCommonCities } from "@/lib/gomate/common-cities"
import { cn } from "@/lib/utils"

interface CityInputProps {
  value: string | null
  onChange: (city: string | null) => void
  /** Country whose common-cities list seeds the suggestion chips. */
  country: string | null
  placeholder?: string
  id?: string
}

export function CityInput({ value, onChange, country, placeholder, id }: CityInputProps) {
  const suggestions = React.useMemo(() => getCommonCities(country), [country])

  return (
    <div className="space-y-2">
      <Input
        id={id}
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder ?? (country ? `e.g. ${suggestions[0] ?? "City"}` : "Select country first")}
        disabled={!country}
        className="h-10"
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 8).map((city) => {
            const isSelected = value === city
            return (
              <Button
                key={city}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => onChange(isSelected ? null : city)}
                className={cn(
                  "h-7 px-2.5 text-xs font-normal rounded-full",
                  isSelected
                    ? "bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700"
                    : "border-stone-200 dark:border-stone-700 text-muted-foreground hover:text-foreground",
                )}
              >
                {city}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
