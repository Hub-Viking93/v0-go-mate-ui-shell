// Shared page hero — clean, minimal banner used across /visa /guides /checklist
// /settling-in /pre-departure.
//
// Visual recipe:
//   * White background, thin top border accent
//   * Sans-serif heading, dark text
//   * Optional eyebrow label, optional metadata strip
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
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 border-b border-border/60 pb-4 ${className ?? ""}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">{subtitle}</p>
        )}
        {meta && <div className="text-xs text-muted-foreground mt-2">{meta}</div>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  )
}
