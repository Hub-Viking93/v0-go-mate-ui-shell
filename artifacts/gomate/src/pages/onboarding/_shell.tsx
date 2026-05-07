// =============================================================
// OnboardingShell — wizard chrome (sage stationery)
// =============================================================
// Page bg #EEF3EE. The wizard sits on top as a single elevated
// card (gm-surface). Section dividers are eyebrow + 1px sage rule
// — no zone-style colour bands. Footer stays sticky and clearly
// separated from the form via a soft top shadow.
//
// Pages compose their fields inside <main>; the shell handles
// header, progress, footer + primary/secondary CTAs. Each wizard
// page owns its data fetching, validation, and PATCH /api/profile
// call — the shell is purely presentational.
// =============================================================

import * as React from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

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
  const pct = Math.round((step / totalSteps) * 100)
  return (
    <div className="min-h-screen gm-canvas flex flex-col">
      {/* Thin top progress — single signal, replaces dot row + 1/5 counter */}
      <div className="sticky top-0 z-30 h-[3px] bg-[#DCE7DF]">
        <div
          className="h-full bg-[#3F6B53] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>

      {/* Centered wizard card on the canvas */}
      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-10 pb-32 lg:pb-28">
        <div className="max-w-2xl mx-auto w-full">
          <div
            className="gm-surface px-6 sm:px-8 py-6 sm:py-7"
            data-testid="onboarding-card"
          >
            <header className="flex items-baseline justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <span className="gm-eyebrow">{eyebrow}</span>
                <h1
                  className="font-sans tracking-tight text-[#1F2A24] mt-2"
                  style={{ fontSize: "22px", fontWeight: 600, lineHeight: 1.15 }}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-[12.5px] text-[#7E9088] mt-1.5 leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
              <span
                className="text-[11px] tabular-nums text-[#7E9088] font-medium shrink-0"
                aria-label={`Step ${step} of ${totalSteps}`}
              >
                {step} / {totalSteps}
              </span>
            </header>

            <div className="my-5 h-px bg-[#ECF1EC]" aria-hidden />

            {errorBanner && (
              <div
                className="mb-5 rounded-md px-3.5 py-2.5 text-[12.5px] text-[#8B2F38]"
                style={{ background: "#F5DDDF66", border: "1px solid #E8B8BD" }}
              >
                {errorBanner}
              </div>
            )}

            <div className="space-y-7">{children}</div>
          </div>
        </div>
      </main>

      {/* Sticky footer — solid white, soft shadow upwards */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-white"
        style={{
          borderTop: "1px solid #DCE7DF",
          boxShadow: "0 -4px 12px -8px rgba(31, 42, 36, 0.08)",
        }}
      >
        <div className="px-4 sm:px-6 py-3 max-w-2xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="text-[12.5px] text-[#7E9088] hover:text-[#1F2A24] transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.7} />
                Back
              </button>
            )}
            {onSecondary && (
              <button
                type="button"
                onClick={onSecondary}
                className="text-[12.5px] text-[#7E9088] hover:text-[#1F2A24] transition-colors"
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
            className="gap-2 rounded-md h-9 px-5 bg-[#24332C] text-white hover:bg-[#2D3E36] shadow-sm disabled:opacity-50 disabled:bg-[#DCE7DF] disabled:text-[#7E9088]"
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
      <span className="gm-eyebrow">{title}</span>
      <div className="space-y-4">{children}</div>
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
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[12.5px] font-semibold text-[#1F2A24] block"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11.5px] text-[#B5414C]">{error}</p>
      ) : helper ? (
        <p className="text-[11.5px] text-[#7E9088] leading-relaxed">{helper}</p>
      ) : null}
    </div>
  )
}
