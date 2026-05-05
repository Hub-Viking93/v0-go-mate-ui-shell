import * as React from "react"
import { addYears, format, parseISO, subYears } from "date-fns"
import {
  Calendar as CalendarIcon,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export const FLEXIBLE_VALUE = "flexible"

interface DatePickerInputProps {
  /**
   * Either an ISO date string ("2026-09-01"), the literal string "flexible",
   * or null if not yet set.
   */
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  flexibleLabel?: string
  /** Earliest date selectable. Defaults to today. */
  minDate?: Date
  id?: string
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = "Pick a date",
  flexibleLabel = "I haven't decided yet — I'm flexible",
  minDate,
  id,
}: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false)
  const isFlexible = value === FLEXIBLE_VALUE
  // Memoize so the parsed Date reference is stable across renders when
  // `value` hasn't changed. Without this, useEffect deps see a fresh
  // object every render and trigger an infinite setState loop.
  const date = React.useMemo<Date | undefined>(() => {
    if (!value || value === FLEXIBLE_VALUE) return undefined
    return safeParse(value)
  }, [value])

  const today = React.useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const min = minDate ?? today
  const startMonth = React.useMemo(
    () => new Date(min.getFullYear(), min.getMonth(), 1),
    [min],
  )
  const endMonth = React.useMemo(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 3)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  }, [])

  // Externalised view-month so the year-jump buttons (« / ») can move it
  // independently of the calendar's built-in month arrows. Re-syncs to the
  // selected date whenever the user picks a value.
  const [viewMonth, setViewMonth] = React.useState<Date>(date ?? startMonth)
  React.useEffect(() => {
    if (date) setViewMonth(date)
  }, [date])

  const canGoPrevYear = subYears(viewMonth, 1) >= startMonth
  const canGoNextYear = addYears(viewMonth, 1) <= endMonth

  const goPrevYear = () => {
    const next = subYears(viewMonth, 1)
    setViewMonth(next < startMonth ? startMonth : next)
  }
  const goNextYear = () => {
    const next = addYears(viewMonth, 1)
    setViewMonth(next > endMonth ? endMonth : next)
  }

  const toggleFlexible = (next: boolean) => {
    if (next) onChange(FLEXIBLE_VALUE)
    else onChange(null)
  }

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={isFlexible}
            className={cn(
              "w-full h-10 justify-start font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "MMMM d, yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goPrevYear}
              disabled={!canGoPrevYear}
              aria-label="Previous year"
              className="h-7 px-2 text-xs gap-1"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
              {format(subYears(viewMonth, 1), "yyyy")}
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              {format(viewMonth, "yyyy")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goNextYear}
              disabled={!canGoNextYear}
              aria-label="Next year"
              className="h-7 px-2 text-xs gap-1"
            >
              {format(addYears(viewMonth, 1), "yyyy")}
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, "yyyy-MM-dd"))
                setOpen(false)
              }
            }}
            disabled={{ before: min }}
            startMonth={startMonth}
            endMonth={endMonth}
            month={viewMonth}
            onMonthChange={setViewMonth}
          />
        </PopoverContent>
      </Popover>

      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isFlexible}
          onChange={(e) => toggleFlexible(e.target.checked)}
          className="h-4 w-4 rounded border-stone-300 dark:border-stone-700 text-emerald-700 focus:ring-emerald-500/40"
        />
        {flexibleLabel}
      </label>
    </div>
  )
}

function safeParse(s: string): Date | undefined {
  try {
    const d = parseISO(s)
    return Number.isNaN(d.getTime()) ? undefined : d
  } catch {
    return undefined
  }
}
