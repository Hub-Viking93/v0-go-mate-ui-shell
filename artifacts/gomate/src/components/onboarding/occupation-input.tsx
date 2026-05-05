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

const DROPDOWN_MAX_HEIGHT_PX = 240 // matches max-h-60 below
const FOOTER_CLEARANCE_PX = 80 // sticky wizard footer height

export function OccupationInput({ value, onChange, placeholder, id }: OccupationInputProps) {
  const [focused, setFocused] = React.useState(false)
  const [flipUp, setFlipUp] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const blurTimeoutRef = React.useRef<number | null>(null)

  const matches = React.useMemo(() => {
    const q = (value ?? "").trim().toLowerCase()
    if (!q) return COMMON_OCCUPATIONS.slice(0, 8)
    return COMMON_OCCUPATIONS.filter((o) => o.toLowerCase().includes(q)).slice(0, 8)
  }, [value])

  const isExactMatch = matches.some((m) => m.toLowerCase() === (value ?? "").toLowerCase())
  const showDropdown = focused && matches.length > 0 && !isExactMatch

  // Decide whether the suggestion list should flip above the input. We do
  // this when there isn't enough room below before the sticky wizard
  // footer, but there is room above. Recomputed when the dropdown opens
  // and on viewport resize.
  React.useEffect(() => {
    if (!showDropdown || !wrapperRef.current) return
    const compute = () => {
      const el = wrapperRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom - FOOTER_CLEARANCE_PX
      const spaceAbove = rect.top
      setFlipUp(spaceBelow < DROPDOWN_MAX_HEIGHT_PX && spaceAbove > spaceBelow)
    }
    compute()
    window.addEventListener("resize", compute)
    window.addEventListener("scroll", compute, true)
    return () => {
      window.removeEventListener("resize", compute)
      window.removeEventListener("scroll", compute, true)
    }
  }, [showDropdown])

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
        <div
          className={cn(
            "absolute w-full rounded-md border border-stone-200 dark:border-stone-700 bg-popover shadow-md max-h-60 overflow-y-auto",
            // z-[60] keeps the suggestion list above the wizard's z-50
            // sticky footer.
            "z-[60]",
            flipUp ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
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
