import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type ExpectedAnswerType =
  | "text"
  | "yes_no"
  | "number"
  | "currency"
  | "country"
  | "free"

export interface OnboardingInputProps {
  expectedAnswerType: ExpectedAnswerType
  pendingFieldLabel: string
  onSubmit: (text: string) => void
  disabled?: boolean
}

const SOFT_CHAR_CAP = 280

const PLACEHOLDERS: Record<ExpectedAnswerType, (label: string) => string> = {
  text: (label) => `Type your ${label.toLowerCase()}…`,
  yes_no: () => `Type "yes" or "no" (you can expand if you want)`,
  number: (label) => `Enter a number for your ${label.toLowerCase()}`,
  currency: () => `Amount + currency, e.g. "5000 USD" or "€4500"`,
  country: () => `Country name, e.g. "Sweden", "United Kingdom"`,
  free: (label) => `Tell me about your ${label.toLowerCase()}…`,
}

/**
 * Single-question answer input, paired with the Mascot + SpeechBubble
 * for the onboarding flow. Distinct from the chat composer — this is
 * scoped to the SINGLE pending field.
 */
export function OnboardingInput({
  expectedAnswerType,
  pendingFieldLabel,
  onSubmit,
  disabled = false,
}: OnboardingInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`
  }, [value])

  // Focus when re-enabled (next question is ready)
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus()
    }
  }, [disabled, pendingFieldLabel])

  const placeholder = PLACEHOLDERS[expectedAnswerType](pendingFieldLabel)
  const trimmed = value.trim()
  const canSubmit = !disabled && trimmed.length > 0

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit(trimmed)
    setValue("")
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const overCap = value.length > SOFT_CHAR_CAP

  return (
    <div
      className={cn(
        "relative flex w-full max-w-xl flex-col gap-2 rounded-2xl bg-white p-3 shadow-[0_4px_18px_-6px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition-shadow focus-within:ring-2 focus-within:ring-[#334155]/40",
        disabled && "opacity-70",
      )}
      data-testid="onboarding-input"
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-label={`Answer for ${pendingFieldLabel}`}
          className="min-h-[56px] flex-1 resize-none border-none bg-transparent px-3 py-3 text-[16px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          style={{ maxHeight: 240 }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label="Submit answer"
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all",
            canSubmit
              ? "bg-[#334155] text-white shadow-md hover:bg-[#1E293B] active:scale-95"
              : "bg-slate-100 text-slate-400",
          )}
        >
          {disabled ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between px-2 text-[11px] text-slate-400">
        <span>
          Press <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-500">Enter</kbd> to send,{" "}
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-500">Shift+Enter</kbd> for new line
        </span>
        <span className={cn(overCap ? "text-amber-600" : "text-slate-400")}>
          {value.length}/{SOFT_CHAR_CAP}
        </span>
      </div>
    </div>
  )
}
