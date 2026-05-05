import * as React from "react"
import { Input } from "@/components/ui/input"
import { COMMON_OCCUPATIONS } from "@/lib/gomate/common-occupations"
import { cn } from "@/lib/utils"

interface OccupationInputProps {
  value: string | null
  onChange: (occupation: string | null) => void
  placeholder?: string
  id?: string
}

export function OccupationInput({ value, onChange, placeholder, id }: OccupationInputProps) {
  const [focused, setFocused] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const blurTimeoutRef = React.useRef<number | null>(null)

  const matches = React.useMemo(() => {
    const q = (value ?? "").trim().toLowerCase()
    if (!q) return COMMON_OCCUPATIONS.slice(0, 8)
    return COMMON_OCCUPATIONS.filter((o) => o.toLowerCase().includes(q)).slice(0, 8)
  }, [value])

  const isExactMatch = matches.some((m) => m.toLowerCase() === (value ?? "").toLowerCase())
  const showDropdown = focused && matches.length > 0 && !isExactMatch

  React.useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current)
    }
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Delay so click on suggestion fires before blur closes the list.
          blurTimeoutRef.current = window.setTimeout(() => setFocused(false), 120)
        }}
        placeholder={placeholder ?? "e.g. Software engineer"}
        className="h-10"
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-popover shadow-md max-h-60 overflow-y-auto">
          {matches.map((occ) => (
            <button
              key={occ}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(occ)
                setFocused(false)
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors",
              )}
            >
              {occ}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
