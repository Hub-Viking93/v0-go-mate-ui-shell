import * as React from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CURRENCY_SYMBOLS } from "@/lib/gomate/currency"

const CURRENCY_OPTIONS = Object.keys(CURRENCY_SYMBOLS).sort()

interface CurrencyAmountInputProps {
  amount: string | null
  currency: string | null
  onAmountChange: (amount: string | null) => void
  onCurrencyChange: (currency: string) => void
  placeholder?: string
  id?: string
}

export function CurrencyAmountInput({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  placeholder,
  id,
}: CurrencyAmountInputProps) {
  return (
    <div className="flex gap-2">
      <Select value={currency ?? undefined} onValueChange={onCurrencyChange}>
        <SelectTrigger className="w-[110px] h-10" aria-label="Currency">
          <SelectValue placeholder="Currency" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {CURRENCY_OPTIONS.map((code) => (
            <SelectItem key={code} value={code}>
              <span className="font-medium">{code}</span>{" "}
              <span className="text-muted-foreground">· {CURRENCY_SYMBOLS[code]}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9 ,.]*"
        value={amount ?? ""}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d]/g, "")
          onAmountChange(cleaned || null)
        }}
        placeholder={placeholder ?? "Amount"}
        className="h-10 flex-1"
      />
    </div>
  )
}
