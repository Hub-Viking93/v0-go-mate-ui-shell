"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Info, X } from "lucide-react"

/**
 * Onboarding disclaimer — shown once per user session in the chat.
 * Dismissable. Stores dismissal in localStorage.
 */
export function OnboardingDisclaimer() {
  const [dismissed, setDismissed] = useState(true) // hidden by default to avoid flash

  useEffect(() => {
    const stored = localStorage.getItem("gomate_disclaimer_accepted")
    if (!stored) setDismissed(false)
  }, [])

  if (dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem("gomate_disclaimer_accepted", "true")
    setDismissed(true)
  }

  return (
    <div className="mx-4 mb-4 p-3 rounded-lg bg-primary/5 border-l-4 border-primary text-sm text-muted-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p>
            GoMate helps you explore and organize information about relocating abroad.
            It is not a substitute for legal, immigration, or financial advice.
            Always verify with{" "}
            <Link href="/legal/disclaimer" className="underline hover:text-foreground">
              official sources
            </Link>{" "}
            before making decisions.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
          aria-label="Dismiss disclaimer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/**
 * Inline disclaimer — shown at the top of generated content (guides, research, tasks).
 * Not dismissable. Always visible.
 */
export function ContentDisclaimer() {
  return (
    <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground flex items-start gap-2.5">
      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <p>
        This content is generated from publicly available sources and AI analysis.
        It may contain inaccuracies. Verify all information with official authorities
        before acting on it.
      </p>
    </div>
  )
}

/**
 * Persistent footer — shown in the app shell on every page.
 */
export function LegalFooter() {
  return (
    <div className="text-center py-3 text-xs text-muted-foreground/60">
      <p>
        GoMate provides informational guidance only — not legal, immigration, or financial advice.
        Verify all information with official sources.{" "}
        <Link href="/legal/terms" className="underline hover:text-muted-foreground">
          Terms
        </Link>
        {" · "}
        <Link href="/legal/privacy" className="underline hover:text-muted-foreground">
          Privacy
        </Link>
        {" · "}
        <Link href="/legal/disclaimer" className="underline hover:text-muted-foreground">
          Disclaimer
        </Link>
      </p>
    </div>
  )
}
