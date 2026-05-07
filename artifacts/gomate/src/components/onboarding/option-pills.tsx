import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PillOption {
  value: string
  label: string
  /** Optional secondary text shown beneath the label, only on selected. */
  hint?: string
}

interface OptionPillsProps {
  options: readonly PillOption[]
  value: string | null
  onChange: (value: string) => void
  /** Show small check icon on the selected pill. Default true. */
  showCheck?: boolean
  ariaLabel?: string
}

/**
 * Single-select chip group. Wraps to multiple lines on narrow viewports.
 * Selected state uses an emerald accent matching the rest of the wizard.
 */
export function OptionPills({
  options,
  value,
  onChange,
  showCheck = true,
  ariaLabel,
}: OptionPillsProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 h-8 text-[12.5px] font-medium",
              "transition-all duration-[150ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F6B53]/30 focus-visible:ring-offset-1",
              selected
                ? "bg-[#1B7A40] text-white border border-[#1B7A40] shadow-sm"
                : "bg-white border border-[#DCE7DF] text-[#1F2A24] hover:border-[#B5D2BC] hover:bg-[#F7FAF7]",
            )}
          >
            {showCheck && selected && <Check className="w-3 h-3" strokeWidth={3} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
