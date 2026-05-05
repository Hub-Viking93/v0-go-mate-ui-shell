import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CountryFlag } from "@/components/country-flag"
import { countryISOCodes } from "@/lib/gomate/country-flags"
import { cn } from "@/lib/utils"

const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w) => (w.length <= 3 && w !== w[0]?.toUpperCase() ? w.toUpperCase() : w[0]?.toUpperCase() + w.slice(1)))
    .join(" ")

const COUNTRY_OPTIONS: { value: string; label: string }[] = Array.from(
  new Set(Object.keys(countryISOCodes)),
)
  .map((key) => ({ value: key, label: titleCase(key) }))
  .sort((a, b) => a.label.localeCompare(b.label))

interface CountrySelectProps {
  value: string | null
  onChange: (country: string | null) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  ariaLabel?: string
}

export function CountrySelect({
  value,
  onChange,
  placeholder = "Select a country",
  disabled,
  id,
  ariaLabel,
}: CountrySelectProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? COUNTRY_OPTIONS.find((c) => c.value === value.toLowerCase()) : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-10 px-3 font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            {selected ? (
              <>
                <CountryFlag country={selected.label} size="sm" />
                <span className="truncate">{selected.label}</span>
              </>
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search countries…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRY_OPTIONS.map((country) => (
                <CommandItem
                  key={country.value}
                  value={country.label}
                  onSelect={() => {
                    onChange(country.label)
                    setOpen(false)
                  }}
                  className="gap-2"
                >
                  <CountryFlag country={country.label} size="sm" />
                  <span className="flex-1">{country.label}</span>
                  {selected?.value === country.value && (
                    <Check className="h-4 w-4 text-emerald-600" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
