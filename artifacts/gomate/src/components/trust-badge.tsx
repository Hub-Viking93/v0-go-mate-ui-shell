// =============================================================
// TrustBadge — visible "Verified by N official sources" indicator
// =============================================================
// Source provenance moat: every fact GoMate states is grounded in a
// scraped official-source URL. Earlier the proof was buried inside
// the Guide tab citation panel. TrustBadge surfaces it inline next
// to the fact itself — visible on dashboard, visa cards, cost-of-
// living, pre-departure actions.
//
// Two visual modes:
//   * "pill" (default) — compact "✓ Verified by N sources" badge
//     that opens a popover with the source list when clicked
//   * "subtitle" — single-line text "Grounded in N official sources,
//     last verified <date>" suitable for hero cards
//
// Click → Popover lists each source with name, click-through URL,
// optional excerpt, and authority level (government / semi-official
// / community). The button itself is a real link so source URLs are
// always one click away — no modal-trap UX.

import { useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import {
  ShieldCheck,
  ExternalLink,
  Landmark,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type SourceAuthority = "official" | "semi_official" | "community"

export interface TrustSource {
  name: string
  url: string
  excerpt?: string
  authority?: SourceAuthority
  /** YYYY-MM-DD or ISO. */
  lastVerified?: string
}

interface TrustBadgeProps {
  sources: TrustSource[]
  /** Default "pill". */
  variant?: "pill" | "subtitle"
  /** Override label noun ("sources", "citations", "references"). */
  noun?: string
  className?: string
  /** When variant="subtitle", forces the white-on-dark style for hero cards. */
  onDark?: boolean
}

const AUTHORITY_LABEL: Record<SourceAuthority, string> = {
  official: "Government",
  semi_official: "Semi-official",
  community: "Community",
}

const AUTHORITY_TINT: Record<SourceAuthority, string> = {
  official: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  semi_official: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  community: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
}

function extractDomain(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return url
  }
}

function dedupeBySourceUrl(sources: TrustSource[]): TrustSource[] {
  const seen = new Map<string, TrustSource>()
  for (const s of sources) {
    if (!s.url) continue
    if (seen.has(s.url)) continue
    seen.set(s.url, s)
  }
  return Array.from(seen.values())
}

function lastVerifiedString(sources: TrustSource[]): string | null {
  const dates = sources.map((s) => s.lastVerified).filter((d): d is string => !!d)
  if (dates.length === 0) return null
  const max = dates.sort().at(-1)
  if (!max) return null
  // Friendly formatting (today / yesterday / N days ago / YYYY-MM-DD).
  try {
    const d = new Date(max)
    const dayMs = 24 * 60 * 60 * 1000
    const days = Math.floor((Date.now() - d.getTime()) / dayMs)
    if (days <= 0) return "today"
    if (days === 1) return "yesterday"
    if (days < 30) return `${days} days ago`
    return d.toISOString().split("T")[0]
  } catch {
    return max
  }
}

export function TrustBadge({
  sources,
  variant = "pill",
  noun = "official sources",
  className,
  onDark = false,
}: TrustBadgeProps) {
  const [open, setOpen] = useState(false)
  const deduped = dedupeBySourceUrl(sources)
  const count = deduped.length
  if (count === 0) return null
  const lastVerified = lastVerifiedString(deduped)

  if (variant === "subtitle") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-colors",
              onDark
                ? "bg-white/10 text-emerald-200 hover:bg-white/20 border border-white/15"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 border border-emerald-500/20",
              className,
            )}
            data-testid="trust-badge-subtitle"
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>
              Grounded in {count} {noun}
              {lastVerified ? `, last verified ${lastVerified}` : ""}
            </span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
          </button>
        </PopoverTrigger>
        <SourceList sources={deduped} />
      </Popover>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2 py-0.5 transition-colors",
            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 border border-emerald-500/30",
            className,
          )}
          data-testid="trust-badge-pill"
        >
          <ShieldCheck className="w-3 h-3 shrink-0" />
          <span>
            Verified by {count} {noun.includes("source") ? `source${count === 1 ? "" : "s"}` : noun}
          </span>
        </button>
      </PopoverTrigger>
      <SourceList sources={deduped} />
    </Popover>
  )
}

function SourceList({ sources }: { sources: TrustSource[] }) {
  return (
    <PopoverContent align="start" className="w-[400px] p-0 overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-stone-200/80 dark:border-stone-800 bg-emerald-50/60 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2">
          <Landmark className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-emerald-700 dark:text-emerald-400">
            Official sources
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          Every fact GoMate states is grounded in a real, scraped source. Click any to verify yourself.
        </p>
      </div>
      <ol className="max-h-[420px] overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
        {sources.map((s, i) => {
          const authority = s.authority ?? "official"
          return (
            <li key={s.url + i} className="px-4 py-3 hover:bg-stone-50/60 dark:hover:bg-stone-900/30 transition-colors">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-mono font-semibold text-stone-500 mt-0.5 shrink-0">
                  [{i + 1}]
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight text-foreground">{s.name}</p>
                    <Badge
                      variant="outline"
                      className={cn("text-[9px] py-0 px-1.5 shrink-0 border", AUTHORITY_TINT[authority])}
                    >
                      {AUTHORITY_LABEL[authority]}
                    </Badge>
                  </div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline mt-1 font-mono break-all"
                  >
                    {extractDomain(s.url)}
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                  {s.excerpt && (
                    <blockquote className="mt-2 text-xs text-muted-foreground italic border-l-2 border-stone-300 dark:border-stone-700 pl-2 leading-relaxed">
                      "{s.excerpt}"
                    </blockquote>
                  )}
                  {s.lastVerified && (
                    <p className="text-[10px] text-stone-500 mt-1.5">
                      Verified: {s.lastVerified}
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </PopoverContent>
  )
}
