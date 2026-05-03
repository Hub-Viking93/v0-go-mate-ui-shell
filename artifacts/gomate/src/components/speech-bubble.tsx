import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export interface SpeechBubbleProps {
  text: string
  align?: "left" | "right" | "top"
  className?: string
}

const TYPEWRITER_CHARS_PER_SECOND = 60

/**
 * Friendly speech bubble that pairs with the Mascot. Renders the
 * given text with a typewriter reveal and a tail pointing toward
 * the mascot (default: tail on the left, bubble sits to the right
 * of the mascot).
 *
 * Accessibility: the visible typewriter text is `aria-hidden` to
 * avoid noisy partial-text announcements; the FULL text is exposed
 * to screen readers via a separate sr-only live region that updates
 * exactly once when the typewriter finishes.
 */
export function SpeechBubble({ text, align = "left", className }: SpeechBubbleProps) {
  const [visibleChars, setVisibleChars] = useState(0)

  useEffect(() => {
    setVisibleChars(0)
    if (text.length === 0) return
    const intervalMs = Math.max(1000 / TYPEWRITER_CHARS_PER_SECOND, 8)
    let i = 0
    const id = setInterval(() => {
      i += 1
      setVisibleChars(i)
      if (i >= text.length) clearInterval(id)
    }, intervalMs)
    return () => clearInterval(id)
  }, [text])

  const visibleText = text.slice(0, visibleChars)
  const stillTyping = visibleChars < text.length

  return (
    <motion.div
      data-testid="speech-bubble"
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "relative inline-block max-w-md rounded-3xl bg-white px-5 py-4 text-[15px] leading-relaxed text-slate-800 shadow-[0_6px_24px_-8px_rgba(15,23,42,0.25)] ring-1 ring-slate-200",
        className,
      )}
    >
      {/* Tail */}
      <BubbleTail align={align} />

      {/* Visible typewriter — hidden from screen readers to avoid partial announcements */}
      <span aria-hidden="true" className="whitespace-pre-wrap">
        {visibleText}
        {stillTyping && (
          <motion.span
            className="ml-0.5 inline-block h-[1em] w-[2px] bg-slate-500 align-middle"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}
      </span>

      {/* Single, atomic announcement once typewriter completes */}
      <span
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="speech-bubble-text"
      >
        {!stillTyping ? text : ""}
      </span>
    </motion.div>
  )
}

function BubbleTail({ align }: { align: "left" | "right" | "top" }) {
  // Each tail is an SVG triangle in white with a matching ring border,
  // positioned so it visually appears to grow out of the bubble edge.
  if (align === "right") {
    return (
      <svg
        viewBox="0 0 16 20"
        className="absolute -right-2 top-6 h-5 w-4"
        aria-hidden
      >
        <path d="M 0 4 L 14 10 L 0 16 Z" fill="white" stroke="#e2e8f0" strokeWidth="1" strokeLinejoin="round" />
        <line x1="0" y1="4" x2="0" y2="16" stroke="white" strokeWidth="2" />
      </svg>
    )
  }
  if (align === "top") {
    return (
      <svg viewBox="0 0 20 16" className="absolute -bottom-2 left-8 h-4 w-5" aria-hidden>
        <path d="M 4 0 L 10 14 L 16 0 Z" fill="white" stroke="#e2e8f0" strokeWidth="1" strokeLinejoin="round" />
        <line x1="4" y1="0" x2="16" y2="0" stroke="white" strokeWidth="2" />
      </svg>
    )
  }
  // default: left — tail points left toward the mascot
  return (
    <svg viewBox="0 0 16 20" className="absolute -left-2 top-6 h-5 w-4" aria-hidden>
      <path d="M 16 4 L 2 10 L 16 16 Z" fill="white" stroke="#e2e8f0" strokeWidth="1" strokeLinejoin="round" />
      <line x1="16" y1="4" x2="16" y2="16" stroke="white" strokeWidth="2" />
    </svg>
  )
}
