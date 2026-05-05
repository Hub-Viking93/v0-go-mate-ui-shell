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
              "inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[13px] transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
              selected
                ? "bg-emerald-700 text-white border border-emerald-700 shadow-sm"
                : "bg-card border border-stone-200 dark:border-stone-700 text-foreground hover:border-stone-300 dark:hover:border-stone-600",
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
