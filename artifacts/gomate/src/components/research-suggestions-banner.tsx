// =============================================================
// ResearchSuggestionsBanner — Phase E3-B
// =============================================================
// Surfaces /api/research/suggestions on /pre-move + /post-move.
// When the user has changed profile fields that affect any cached
// researched domain, the banner appears with per-domain chips
// listing what changed + a one-click "Refresh suggested" button.
//
// Honesty rules baked in:
//   - Renders nothing when there are no suggestions (server says
//     fresh-state). No noisy banner when profile hasn't drifted.
//   - The button text + post-refresh hint explicitly mention
//     Regenerate, mirroring E2's refresh-vs-regenerate copy. The
//     refresh updates the cache; rebuilding the visible
//     timeline/checklist is a separate user action.
//   - Showing changedFields per chip lets the user see WHY each
//     domain was suggested. No mystery "your data is stale".
// =============================================================

import { useCallback, useEffect, useState } from "react"
import {
  RefreshCw,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  FlaskConical,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ---- Public types --------------------------------------------------

export interface ResearchSuggestion {
  domain: string
  changedFields: string[]
  reason: string
  lastResearchedAt: string
}

interface SuggestionsResponse {
  suggestions: ResearchSuggestion[]
  lastResearchedAt: string | null
}

// ---- Internal state machine ---------------------------------------

type RefreshState =
  | { tag: "idle" }
  | { tag: "refreshing"; domains: string[] }
  | { tag: "success"; refreshedCount: number }
  | { tag: "error"; message: string }

// ---- Domain labels for chips --------------------------------------

const DOMAIN_LABEL: Record<string, string> = {
  registration: "Registration",
  banking: "Banking",
  documents: "Documents",
  housing: "Housing",
  healthcare: "Healthcare",
  visa: "Visa",
  tax: "Tax",
  cost: "Cost",
  cultural: "Cultural",
  pet: "Pet",
  transport_id: "Transport / Licence",
  departure_tax: "Departure Tax",
}

function labelFor(domain: string): string {
  return DOMAIN_LABEL[domain] ?? domain
}

// ---- Component ----------------------------------------------------

interface Props {
  /** Lets the parent surface refresh its own data (timeline, settling-in
   *  tasks) after a successful refresh. The banner does NOT regenerate
   *  the visible timeline — that's the user's explicit action. */
  onAfterRefresh?: () => void
  /** Used in copy to nudge the user toward the right action on this
   *  surface. Pre-move says "click Regenerate"; post-move says the same.
   *  Both surfaces have an existing "Regenerate" button the user can
   *  reach. */
  surface: "pre_move" | "post_move"
}

export function ResearchSuggestionsBanner({ onAfterRefresh, surface }: Props) {
  const [suggestions, setSuggestions] = useState<ResearchSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<RefreshState>({ tag: "idle" })

  const fetchSuggestions = useCallback(async () => {
    try {
      const r = await fetch("/api/research/suggestions", { credentials: "include" })
      if (!r.ok) {
        setSuggestions([])
        setLoading(false)
        return
      }
      const json = (await r.json()) as SuggestionsResponse | null
      setSuggestions(json?.suggestions ?? [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSuggestions()
  }, [fetchSuggestions])

  // Hide entirely while loading the first response so the surface
  // doesn't flash an empty card. Also hide when there's nothing to
  // suggest UNLESS we just successfully refreshed (so the user sees
  // the success state for a moment).
  if (loading) return null
  if (suggestions.length === 0 && state.tag !== "success") return null

  async function handleRefresh(): Promise<void> {
    if (suggestions.length === 0) return
    const domains = suggestions.map((s) => s.domain)
    setState({ tag: "refreshing", domains })
    try {
      const r = await fetch("/api/research/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => null)
        setState({ tag: "error", message: body?.error ?? `HTTP ${r.status}` })
        return
      }
      const body = (await r.json()) as { refreshed?: Array<{ domain: string }> }
      setState({ tag: "success", refreshedCount: body.refreshed?.length ?? 0 })
      // Tell the parent — it may want to re-fetch its own state so
      // the user sees freshly-bridged values where applicable.
      onAfterRefresh?.()
      // Re-fetch suggestions; on success they should now be empty.
      await fetchSuggestions()
    } catch (err) {
      setState({ tag: "error", message: err instanceof Error ? err.message : String(err) })
    }
  }

  // ---- Render -------------------------------------------------

  const isRefreshing = state.tag === "refreshing"
  const isSuccess = state.tag === "success"
  const isError = state.tag === "error"

  return (
    <div
      data-testid="research-suggestions-banner"
      data-surface={surface}
      data-state={state.tag}
      className={cn(
        "rounded-md border px-4 py-3.5 space-y-2.5",
        isSuccess
          ? "bg-emerald-500/10 border-emerald-500/30"
          : isError
            ? "bg-rose-500/10 border-rose-500/30"
            : "bg-amber-500/10 border-amber-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {isSuccess ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" strokeWidth={2} />
          ) : isError ? (
            <AlertTriangle className="w-4 h-4 mt-0.5 text-rose-700 dark:text-rose-400 shrink-0" strokeWidth={2} />
          ) : (
            <FlaskConical className="w-4 h-4 mt-0.5 text-amber-700 dark:text-amber-400 shrink-0" strokeWidth={2} />
          )}
          <div className="min-w-0">
            {isSuccess ? (
              <>
                <p className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-300">
                  Refreshed {state.refreshedCount} domain{state.refreshedCount === 1 ? "" : "s"}.
                </p>
                <p className="text-[11.5px] text-emerald-700/90 dark:text-emerald-400/90 leading-snug mt-0.5">
                  Click <strong>Regenerate</strong> on this page to apply the new research to your{" "}
                  {surface === "pre_move" ? "timeline" : "checklist"}.
                </p>
              </>
            ) : isError ? (
              <>
                <p className="text-[13px] font-semibold text-rose-800 dark:text-rose-300">
                  Refresh failed.
                </p>
                <p className="text-[11.5px] text-rose-700/90 dark:text-rose-400/90 leading-snug mt-0.5">
                  {state.message}. Try again or refresh individual domains from the chip popovers.
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">
                  Your profile changed since the last research run.
                </p>
                <p className="text-[11.5px] text-amber-800/90 dark:text-amber-300/90 leading-snug mt-0.5">
                  Suggested refresh:
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5" data-testid="suggestions-chips">
                  {suggestions.map((s) => (
                    <li
                      key={s.domain}
                      data-testid={`suggestion-chip-${s.domain}`}
                      data-domain={s.domain}
                      data-changed-fields={s.changedFields.join(",")}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
                        "bg-white/60 dark:bg-white/10",
                        "border-amber-500/30 text-amber-900 dark:text-amber-200",
                        "text-[10.5px] uppercase tracking-wide font-medium",
                      )}
                      title={s.reason}
                    >
                      {labelFor(s.domain)}
                      <span className="text-[9.5px] normal-case tracking-normal opacity-75 ml-0.5">
                        ({s.changedFields.join(", ")})
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        {!isSuccess && !isError && (
          <Button
            type="button"
            data-testid="research-suggestions-refresh"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            size="sm"
            className={cn(
              "shrink-0 gap-1.5 h-8 rounded-md",
              "bg-amber-600 hover:bg-amber-700 text-white",
              isRefreshing && "opacity-70 cursor-not-allowed",
            )}
          >
            {isRefreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {isRefreshing ? "Refreshing…" : "Refresh suggested"}
          </Button>
        )}
      </div>
      {isRefreshing && (
        <p
          data-testid="research-suggestions-refreshing-hint"
          className="text-[10.5px] text-amber-800/80 dark:text-amber-300/80 leading-snug pl-6"
        >
          This can take up to 90 seconds — researched specialists run in parallel.
        </p>
      )}
    </div>
  )
}
