// =============================================================
// ResearchProvenanceBadge — Phase D-A
// =============================================================
// Per-section chip indicating where the section's content came from:
//
//   Researched · full      → green pill, click for source list
//   Researched · partial   → amber pill, click shows what was dropped
//   Researched · fallback  → red pill (researcher fell back to a
//                            timeout/empty result; UI still shows
//                            generic content under it but the user
//                            should know)
//   Generic                → muted gray pill, no popover
//
// Honesty over polish: a pill that just says "Researched" without
// disclosing partial / fallback would be worse than no pill at all
// because users would over-trust the generic fallback content.
// =============================================================

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  ExternalLink,
  FlaskConical,
  Sparkles,
  AlertTriangle,
  Archive,
  RefreshCw,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type ResearchProvenance =
  | {
      kind: "researched"
      quality: "full" | "partial" | "fallback"
      fallbackReason?: string
      retrievedAt: string
      // Phase E1b — server-computed staleness signals. UI only
      // reads these; thresholds + day math live on the backend.
      stale?: boolean
      daysOld?: number | null
      sources: ReadonlyArray<{
        url: string
        domain: string
        kind: "authority" | "institution" | "reference"
        title?: string
      }>
    }
  | {
      // "Real research, but from the older pipeline (pre-contract).
      // Sources persisted but not run through the new validators
      // (strict enum + ProfilePredicate + URL ref integrity).
      // Visible on /pre-move's visa domain until that specialist
      // migrates to the new contract.
      kind: "legacy_research"
      retrievedAt: string
      stale?: boolean
      daysOld?: number | null
      sources: ReadonlyArray<{
        url: string
        domain: string
        // Legacy persistence didn't tag source kind; we default to
        // "authority" since the producing specialist was meant to
        // scrape official sites only. Honest fallback.
        kind: "authority" | "institution" | "reference"
        title?: string
      }>
    }
  | { kind: "generic" }

interface Props {
  provenance: ResearchProvenance
  /** Compact: chip-only (small contexts). Default false → full label. */
  compact?: boolean
  /** SpecialistDomain this badge represents. Required for the refresh
   *  affordance — the popover hides the button when domain is omitted. */
  domain?: string
  /** Called after a successful refresh so the parent surface can re-
   *  fetch its provenance map (the popover's own state would otherwise
   *  show stale numbers — e.g. daysOld stays at the pre-refresh value
   *  until the parent re-fetches). */
  onRefreshed?: () => void
}

// =============================================================
// useRefresh — Phase E2
// =============================================================
// Local hook for the refresh button. Calls POST /api/research/refresh
// with a single domain, surfaces idle / pending / success / skipped /
// error states in the popover. The success copy explicitly mentions
// Regenerate so users understand the cache→checklist boundary.
type RefreshState =
  | { tag: "idle" }
  | { tag: "pending" }
  | { tag: "success"; refreshedAt: string; sourcesCount: number; stepsCount: number }
  | { tag: "skipped"; reason: string }
  | { tag: "error"; message: string }

function useRefresh(domain: string | undefined, onRefreshed?: () => void) {
  const [state, setState] = useState<RefreshState>({ tag: "idle" })
  async function trigger(): Promise<void> {
    if (!domain) return
    setState({ tag: "pending" })
    try {
      const r = await fetch("/api/research/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: [domain] }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => null)
        setState({ tag: "error", message: body?.error ?? `HTTP ${r.status}` })
        return
      }
      const body = (await r.json()) as {
        refreshed: Array<{ domain: string; retrievedAt: string; sourcesCount: number; stepsCount: number }>
        skipped: Array<{ domain: string; reason: string }>
      }
      const refreshed = body.refreshed.find((x) => x.domain === domain)
      const skipped = body.skipped.find((x) => x.domain === domain)
      if (refreshed) {
        setState({
          tag: "success",
          refreshedAt: refreshed.retrievedAt,
          sourcesCount: refreshed.sourcesCount,
          stepsCount: refreshed.stepsCount,
        })
        onRefreshed?.()
      } else if (skipped) {
        setState({ tag: "skipped", reason: skipped.reason })
      } else {
        setState({ tag: "error", message: "No result for this domain" })
      }
    } catch (err) {
      setState({
        tag: "error",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return { state, trigger }
}

// Small inner component so the hook lives at the right scope (each
// popover instance has its own state — opening another popover doesn't
// reset this one's). Used by both researched + legacy_research arms.
function RefreshControls({
  domain,
  isLegacy,
  onRefreshed,
}: {
  domain: string | undefined
  isLegacy: boolean
  onRefreshed?: () => void
}) {
  const { state, trigger } = useRefresh(domain, onRefreshed)

  // Legacy_research isn't refreshable via the new pipe — visa hasn't
  // migrated yet. Be honest about that rather than hiding the button.
  if (isLegacy) {
    return (
      <div
        data-testid="provenance-refresh-disabled"
        className="text-[11px] text-muted-foreground leading-snug border-t pt-2 mt-1"
      >
        Manual refresh isn't available yet — this domain hasn't been migrated to the current research pipeline.
      </div>
    )
  }
  if (!domain) return null

  if (state.tag === "success") {
    return (
      <div
        data-testid="provenance-refresh-success"
        className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-snug border-t pt-2 mt-1 space-y-1"
      >
        <div className="inline-flex items-center gap-1 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
          Refreshed just now ({state.stepsCount} steps · {state.sourcesCount} sources)
        </div>
        <p className="text-muted-foreground">
          The research cache is updated. Click <strong>Regenerate</strong> on the page above to apply it to your
          checklist.
        </p>
      </div>
    )
  }
  if (state.tag === "skipped") {
    return (
      <div
        data-testid="provenance-refresh-skipped"
        className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug border-t pt-2 mt-1"
      >
        Skipped: {state.reason.replaceAll("_", " ")}
      </div>
    )
  }
  if (state.tag === "error") {
    return (
      <div
        data-testid="provenance-refresh-error"
        className="text-[11px] text-rose-700 dark:text-rose-400 leading-snug border-t pt-2 mt-1"
      >
        Refresh failed: {state.message}
      </div>
    )
  }
  return (
    <div className="border-t pt-2 mt-1">
      <button
        type="button"
        data-testid="provenance-refresh-trigger"
        onClick={(e) => {
          e.stopPropagation()
          void trigger()
        }}
        disabled={state.tag === "pending"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
          "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
          "hover:brightness-95 transition-colors",
          state.tag === "pending" && "opacity-60 cursor-not-allowed",
        )}
      >
        {state.tag === "pending" ? (
          <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
        ) : (
          <RefreshCw className="w-3 h-3" strokeWidth={2} />
        )}
        {state.tag === "pending" ? "Refreshing…" : "Refresh research"}
      </button>
      <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
        Refresh fetches new research for this section. To apply the result to your checklist, click Regenerate
        afterwards.
      </p>
    </div>
  )
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return "just now"
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  // Fall back to ISO date for older.
  return new Date(iso).toISOString().split("T")[0]
}

function qualityClass(quality: "full" | "partial" | "fallback"): { bg: string; text: string; border: string; label: string } {
  switch (quality) {
    case "full":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-700 dark:text-emerald-400",
        border: "border-emerald-500/30",
        label: "full",
      }
    case "partial":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-700 dark:text-amber-400",
        border: "border-amber-500/30",
        label: "partial",
      }
    case "fallback":
      return {
        bg: "bg-rose-500/10",
        text: "text-rose-700 dark:text-rose-400",
        border: "border-rose-500/30",
        label: "fallback",
      }
  }
}

// Visual treatment for the legacy_research kind. Distinct from the
// new-pipe palette (emerald/amber/rose) — slate/blue, with an Archive
// icon that signals "older but still real research".
const LEGACY_CLASS = {
  bg: "bg-slate-500/10",
  text: "text-slate-700 dark:text-slate-300",
  border: "border-slate-500/30",
} as const

export function ResearchProvenanceBadge({
  provenance,
  compact = false,
  domain,
  onRefreshed,
}: Props) {
  if (provenance.kind === "generic") {
    return (
      <span
        data-testid="provenance-badge"
        data-provenance-kind="generic"
        className={cn(
          "inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5",
          "text-[10px] uppercase tracking-wide text-muted-foreground border-muted-foreground/20",
        )}
        title="Generic checklist content — not researched per destination."
      >
        <Sparkles className="w-3 h-3 opacity-60" />
        Generic
      </span>
    )
  }

  if (provenance.kind === "legacy_research") {
    const legacyLabel = compact ? "Researched · legacy" : "Researched · legacy"
    const isStale = provenance.stale === true
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="provenance-badge"
            data-provenance-kind="legacy_research"
            data-stale={isStale ? "true" : "false"}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
              "text-[10px] uppercase tracking-wide font-medium transition-colors",
              "hover:brightness-95",
              LEGACY_CLASS.bg,
              LEGACY_CLASS.text,
              LEGACY_CLASS.border,
            )}
            aria-label={`${legacyLabel} — click for sources${isStale ? " (older than 14 days)" : ""}`}
          >
            <Archive className="w-3 h-3" strokeWidth={2} />
            {legacyLabel}
            {isStale && <span data-testid="provenance-stale-dot" className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3 text-[12px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn("inline-flex items-center gap-1 font-medium", LEGACY_CLASS.text)}>
                <Archive className="w-3.5 h-3.5" strokeWidth={2} />
                Researched · legacy
              </span>
              <span className="text-[11px] text-muted-foreground">{formatRelative(provenance.retrievedAt)}</span>
            </div>
            {isStale && (
              <p
                data-testid="provenance-stale-line"
                className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug"
              >
                Last refreshed {provenance.daysOld ?? "?"} day{provenance.daysOld === 1 ? "" : "s"} ago — consider refreshing.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground leading-snug">
              This section came from the older research pipeline. It was researched per destination, but isn't yet
              upgraded to the current validation standard (strict source-URL integrity, predicate validation, quality
              grading). Future migrations will move it onto the same pipeline as the rest.
            </p>
            {provenance.sources.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Sources ({provenance.sources.length})
                </div>
                <ul className="space-y-1">
                  {provenance.sources.slice(0, 6).map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-foreground hover:underline"
                      >
                        <span className="text-[10px] uppercase text-muted-foreground tabular-nums w-[64px] shrink-0">
                          {s.kind}
                        </span>
                        <span className="truncate">{s.title ?? s.domain}</span>
                        <ExternalLink className="w-3 h-3 opacity-60 shrink-0" strokeWidth={2} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">No source URLs persisted from the legacy run.</p>
            )}
            <RefreshControls domain={domain} isLegacy={true} onRefreshed={onRefreshed} />
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  const q = qualityClass(provenance.quality)
  const quickLabel = compact ? "Researched" : `Researched · ${q.label}`
  const isLowConfidence = provenance.quality === "fallback"
  const isStale = provenance.stale === true
  const Icon = isLowConfidence ? AlertTriangle : FlaskConical

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="provenance-badge"
          data-provenance-kind="researched"
          data-provenance-quality={provenance.quality}
          data-stale={isStale ? "true" : "false"}
          // The badge often sits inside a parent click target (the
          // category-collapse button on /post-move/checklist). Stop
          // bubbling so opening the popover doesn't also toggle the
          // section.
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
            "text-[10px] uppercase tracking-wide font-medium transition-colors",
            "hover:brightness-95",
            q.bg,
            q.text,
            q.border,
          )}
          aria-label={`${quickLabel} — click for sources${isStale ? " (older than 14 days)" : ""}`}
        >
          <Icon className="w-3 h-3" strokeWidth={2} />
          {quickLabel}
          {isStale && <span data-testid="provenance-stale-dot" className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 text-[12px]">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={cn("inline-flex items-center gap-1 font-medium", q.text)}>
              <Icon className="w-3.5 h-3.5" strokeWidth={2} />
              Researched · {q.label}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatRelative(provenance.retrievedAt)}</span>
          </div>
          {isStale && (
            <p
              data-testid="provenance-stale-line"
              className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug"
            >
              Last refreshed {provenance.daysOld ?? "?"} day{provenance.daysOld === 1 ? "" : "s"} ago — consider refreshing.
            </p>
          )}
          {provenance.quality === "partial" && (
            <p className="text-[11px] text-muted-foreground leading-snug">
              Some items in this section were dropped during validation (drift in source URLs, deadlines, or
              predicates). The remaining content is still source-attributed.
            </p>
          )}
          {provenance.quality === "fallback" && (
            <p className="text-[11px] text-muted-foreground leading-snug">
              The researched specialist could not produce usable output
              {provenance.fallbackReason ? ` (${provenance.fallbackReason.replaceAll("_", " ")})` : ""}. This section is
              showing generic checklist content instead.
            </p>
          )}
          {provenance.sources.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Sources ({provenance.sources.length})
              </div>
              <ul className="space-y-1">
                {provenance.sources.slice(0, 6).map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-foreground hover:underline"
                    >
                      <span className="text-[10px] uppercase text-muted-foreground tabular-nums w-[64px] shrink-0">
                        {s.kind}
                      </span>
                      <span className="truncate">{s.title ?? s.domain}</span>
                      <ExternalLink className="w-3 h-3 opacity-60 shrink-0" strokeWidth={2} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No sources fetched this run.</p>
          )}
          <RefreshControls domain={domain} isLegacy={false} onRefreshed={onRefreshed} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
