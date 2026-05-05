// =============================================================
// OnboardingShell — visual wrapper for the multi-step wizard.
// =============================================================
// Mirrors the editorial forest-gradient hero used on /chat and
// /dashboard, but trades the "Next question" hint for a 1-of-5
// step indicator. Pages compose their fields inside <main>; the
// shell provides header, sticky footer, and primary/secondary
// CTA wiring. Each wizard page is responsible for its own data
// fetching, validation, and PATCH /api/profile call — the shell
// is purely presentational.
// =============================================================

import * as React from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface OnboardingShellProps {
  step: number
  totalSteps: number
  eyebrow: string
  title: string
  subtitle?: string
  children: React.ReactNode
  primaryLabel?: string
  primaryDisabled?: boolean
  primaryLoading?: boolean
  onPrimary?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  /**
   * If provided, renders a Back button on the left of the footer that
   * fires this callback. Pages should pass an explicit nav handler that
   * routes to the previous wizard step (no save).
   */
  onBack?: () => void
  errorBanner?: string | null
}

export function OnboardingShell({
  step,
  totalSteps,
  eyebrow,
  title,
  subtitle,
  children,
  primaryLabel = "Save & continue",
  primaryDisabled,
  primaryLoading,
  onPrimary,
  secondaryLabel = "Save & exit",
  onSecondary,
  onBack,
  errorBanner,
}: OnboardingShellProps) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-2rem)] bg-gradient-to-b from-background to-emerald-50/30 dark:to-emerald-950/10">
      <div
        className="flex-shrink-0 relative overflow-hidden text-white"
        style={{
          background:
            "linear-gradient(135deg, #14302A 0%, #1B3A2D 38%, #234D3A 72%, #2D6A4F 100%)",
          boxShadow:
            "0 2px 8px rgba(20,48,42,0.18), 0 12px 32px rgba(20,48,42,0.20)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 100% 0%, rgba(94,232,156,0.18) 0%, transparent 60%)",
          }}
        />
        <div className="relative px-5 sm:px-8 py-4 max-w-3xl mx-auto w-full">
          <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-emerald-200/80">
            {eyebrow}
          </p>
          <h1
            className="font-serif tracking-tight text-white mt-0.5"
            style={{ fontSize: "18px", fontWeight: 600, lineHeight: 1.2 }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-emerald-100/75 mt-0.5">{subtitle}</p>
          )}

          {/* Dot-style step indicator */}
          <div className="flex items-center gap-1.5 mt-3" aria-label={`Step ${step} of ${totalSteps}`}>
            {Array.from({ length: totalSteps }, (_, i) => {
              const idx = i + 1
              const state =
                idx < step ? "done" : idx === step ? "current" : "future"
              return (
                <span
                  key={idx}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    state === "current" ? "w-7 bg-emerald-300" : "w-3",
                    state === "done" && "bg-emerald-400/80",
                    state === "future" && "bg-white/15",
                  )}
                />
              )
            })}
            <span className="text-[10px] text-emerald-100/60 ml-2 font-medium">
              {step} / {totalSteps}
            </span>
          </div>
        </div>
      </div>

      <main className="flex-1 px-5 sm:px-8 py-5 sm:py-6 max-w-3xl mx-auto w-full pb-32 lg:pb-24">
        {errorBanner && (
          <div className="mb-4 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {errorBanner}
          </div>
        )}
        {children}
      </main>

      {/* lg:left-60 stops the footer at the AppShell sidebar's right
          edge so it doesn't cover the sidebar's "Sign out" / "Country
          Guides" entries. On mobile/tablet the sidebar is hidden so we
          fall back to full-width minus the bottom mobile-nav. */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 lg:left-60 right-0 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 z-50">
        <div className="px-5 sm:px-8 py-3 max-w-3xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            {onSecondary && (
              <button
                type="button"
                onClick={onSecondary}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {secondaryLabel}
              </button>
            )}
            {!onBack && !onSecondary && <span />}
          </div>
          <Button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled || primaryLoading}
            className="gap-2 rounded-full bg-gradient-to-r from-[#1B3A2D] to-[#2D6A4F] text-white hover:opacity-95 shadow-md disabled:opacity-50 disabled:bg-stone-200 disabled:from-stone-200 disabled:to-stone-200 disabled:text-stone-400 px-6"
          >
            {primaryLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              primaryLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface OnboardingSectionProps {
  title: string
  children: React.ReactNode
}

export function OnboardingSection({ title, children }: OnboardingSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground/80">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

interface OnboardingFieldProps {
  label: string
  htmlFor?: string
  helper?: string
  error?: string
  children: React.ReactNode
}

export function OnboardingField({
  label,
  htmlFor,
  helper,
  error,
  children,
}: OnboardingFieldProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium text-foreground block"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>
      ) : helper ? (
        <p className="text-[11px] text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  )
}
