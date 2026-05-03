// Shared page hero — gradient banner used across /visa /guides /checklist
// /settling-in /pre-departure to match the dashboard's branded look.
//
// Same visual recipe as dashboard's at-a-glance card:
//   * Forest → Pulse Green gradient
//   * Subtle radial highlight top-right
//   * Serif heading, white text, eyebrow label, optional metadata strip
//   * Optional right-aligned action area (badges, buttons)

import type { ReactNode } from "react"

interface PageHeroProps {
  eyebrow?: string
  title: string
  subtitle?: string
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHero({ eyebrow, title, subtitle, meta, actions, className }: PageHeroProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl text-white p-6 sm:p-8 mb-6 ${className ?? ""}`}
      style={{
        background:
          "linear-gradient(135deg, #1B3A2D 0%, #234D3A 50%, #2D6A4F 100%)",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(94,232,156,0.25),transparent_60%)] pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-200/80 mb-2">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-emerald-100/80 mt-2 max-w-2xl leading-relaxed">{subtitle}</p>
          )}
          {meta && <div className="text-xs text-emerald-100/70 mt-3">{meta}</div>}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
