import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, AlertTriangle, Info, type LucideIcon } from "lucide-react"
import type { Citation, SpecialistQuality } from "@/lib/gomate/specialist-types"
import { AuditIcon } from "@/components/audit-icon"
import type { AuditPayload } from "@/components/audit-trail-popover"

export type ShellQuality = SpecialistQuality | "pending"

export interface SpecialistCardShellProps {
  title: string
  Icon: LucideIcon
  reason?: string
  quality?: ShellQuality
  retrievedAt?: string
  contentParagraphs?: string[]
  citations?: Citation[]
  fallbackReason?: string
  children?: ReactNode
  emptyState?: ReactNode
}

const QUALITY_BADGE: Record<ShellQuality, { label: string; className: string }> = {
  full: { label: "Live research", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  partial: { label: "Partial sources", className: "bg-amber-100 text-amber-800 border-amber-200" },
  fallback: { label: "AI knowledge only", className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  pending: { label: "Coming soon", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
}

/**
 * Inline citation marker rendering. Phase 6 will replace this naive renderer
 * with parsed [n] tokens emitted by the synthesiser. For now we render a
 * trailing superscript [1][2]... so the audit-icon hook (next prompt) has a
 * stable target.
 */
function CitationMarkers({ count }: { count: number }) {
  if (count <= 0) return null
  const visible = Math.min(count, 3)
  return (
    <sup className="ml-1 text-[10px] font-medium text-emerald-700">
      {Array.from({ length: visible }, (_, i) => `[${i + 1}]`).join("")}
    </sup>
  )
}

export function SpecialistCardShell({
  title,
  Icon,
  reason,
  quality = "pending",
  retrievedAt,
  contentParagraphs,
  citations = [],
  fallbackReason,
  children,
  emptyState,
}: SpecialistCardShellProps) {
  const badge = QUALITY_BADGE[quality]
  const hasContent = (contentParagraphs?.length ?? 0) > 0 || !!children

  return (
    <Card
      className="p-5 md:p-6 flex flex-col gap-4"
      data-card-state={hasContent ? "ready" : "empty"}
      data-specialist-card={title}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center h-10 w-10 rounded-xl shrink-0"
            style={{
              background: "rgba(34, 197, 94, 0.12)",
              color: "var(--gm-forest, #1B3A2D)",
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight truncate">{title}</h3>
            {reason && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{reason}</p>
            )}
          </div>
        </div>
        <Badge variant="outline" className={`text-[11px] shrink-0 ${badge.className}`}>
          {badge.label}
        </Badge>
      </div>

      {!hasContent &&
        (emptyState ?? (
          <p className="text-sm text-muted-foreground">
            Research hasn’t run yet for this card. It will populate after the next research
            dispatch.
          </p>
        ))}

      {hasContent && (() => {
        // Whole-card collapse: dashboard tiles show ONLY a 2-sentence
        // preview by default. The "Read full briefing ▾" disclosure
        // expands EVERYTHING — full prose, key-facts children, sources
        // panel — keeping the dashboard scannable while preserving the
        // depth one click away.
        const first = (contentParagraphs?.[0] ?? "")
        const sentences = first.split(/(?<=[.!?])\s+/)
        const preview = sentences.slice(0, 2).join(" ")
        const shortened = preview.length > 360 ? preview.slice(0, 357) + "…" : preview
        const hasParagraphs = (contentParagraphs?.length ?? 0) > 0
        return (
          <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
            {hasParagraphs && <p>{shortened}</p>}
            <details className="group">
              <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 mt-1">
                Read full briefing
                <span className="transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-3 space-y-3 text-foreground/85">
                {hasParagraphs && (
                  <div className="space-y-2.5 border-l-2 border-emerald-500/30 pl-3">
                    {contentParagraphs!.map((p, i) => (
                      <p key={i}>
                        {p}
                        {i === contentParagraphs!.length - 1 && (
                          <CitationMarkers count={citations.length} />
                        )}
                      </p>
                    ))}
                  </div>
                )}
                {children && <div className="space-y-3 pt-1">{children}</div>}
              </div>
            </details>
          </div>
        )
      })()}

      {fallbackReason && (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{fallbackReason}</span>
        </div>
      )}

      {citations.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Info className="h-3 w-3" /> View source ({citations.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {citations.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-700 font-medium shrink-0">[{i + 1}]</span>
                <div className="min-w-0 flex-1">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 break-all"
                  >
                    {c.label} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  {c.note && <p className="text-muted-foreground mt-0.5">{c.note}</p>}
                  {!c.scraped && (
                    <p className="text-amber-700 mt-0.5">
                      Whitelist URL — not scraped this run.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {retrievedAt && (
        <p className="text-[11px] text-muted-foreground/70">
          Retrieved {new Date(retrievedAt).toLocaleString()}
        </p>
      )}
    </Card>
  )
}

/**
 * Audit-icon hook — placeholder for the audit-trail-popover system arriving
 * in the next prompt. For now renders a subtle help icon next to the value.
 */
export function FactRow({
  label,
  value,
  hint,
  fieldKey,
  outputKey,
  audit,
}: {
  label: string
  value: ReactNode
  hint?: string
  /** Profile-field audit key — fetched via /api/agent-audit. */
  fieldKey?: string
  /** Research-output audit key (e.g. "schools.0"). */
  outputKey?: string
  /** Pre-computed audit payload (skips fetch). */
  audit?: AuditPayload
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm border-b border-border/50 last:border-b-0 py-1.5">
      <div className="text-muted-foreground">
        {label}
        {hint && <span className="text-muted-foreground/60 ml-1.5">({hint})</span>}
      </div>
      <div className="font-medium text-right text-foreground inline-flex items-center gap-1.5">
        {value}
        <AuditIcon
          size="xs"
          fieldKey={fieldKey}
          outputKey={outputKey}
          payload={audit}
          label={`Audit trail for ${label}`}
        />
      </div>
    </div>
  )
}

export function StatusPill({
  ok,
  okLabel,
  badLabel,
}: {
  ok: boolean
  okLabel: string
  badLabel: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
        ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      <span className="font-bold">{ok ? "✓" : "!"}</span>
      {ok ? okLabel : badLabel}
    </span>
  )
}

export function WarningsList({ warnings }: { warnings?: string[] }) {
  if (!warnings || warnings.length === 0) return null
  return (
    <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1">
      {warnings.map((w, i) => (
        <li key={i}>• {w}</li>
      ))}
    </ul>
  )
}
