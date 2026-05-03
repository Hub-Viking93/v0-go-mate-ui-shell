import { ExternalLink, Edit3, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type AuditConfidence = "high" | "medium" | "low" | string

/** Profile-field audit payload (origin: agent_audit row). */
export interface ProfileFieldAudit {
  kind: "profile_field"
  fieldKey: string
  fieldLabel?: string
  agentName: string
  modelUsed: string | null
  confidence: AuditConfidence
  sourceUserMessage: string | null
  validationRulesApplied: string[] | null
  retrievedAt: string
  onEdit?: () => void
}

/** Research-output audit payload (origin: guide_section_citations + specialist meta). */
export interface ResearchOutputAudit {
  kind: "research_output"
  outputKey: string
  outputLabel?: string
  specialistName: string
  sourceUrl: string
  sourceName?: string | null
  retrievedAt: string
  quality: "full" | "partial" | "fallback" | string
  confidence: AuditConfidence
  verifyOnOfficialSiteUrl?: string | null
}

/** Derived/computed value audit payload. */
export interface DerivedValueAudit {
  kind: "derived_value"
  outputKey: string
  outputLabel?: string
  formula: string
  inputs: Array<{ label: string; value: string; auditTo?: string }>
  lastComputedAt: string
}

export type AuditPayload = ProfileFieldAudit | ResearchOutputAudit | DerivedValueAudit

const CONFIDENCE_BADGE: Record<string, { label: string; className: string }> = {
  high: { label: "Explicit", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  medium: { label: "Inferred", className: "bg-amber-100 text-amber-800 border-amber-200" },
  low: { label: "Assumed", className: "bg-rose-100 text-rose-800 border-rose-200" },
}

const QUALITY_BADGE: Record<string, { label: string; className: string }> = {
  full: { label: "Full sources", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  partial: { label: "Partial sources", className: "bg-amber-100 text-amber-800 border-amber-200" },
  fallback: { label: "AI knowledge only", className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
}

function relativeDays(iso: string): { days: number; stale: boolean; label: string } {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)))
  return { days, stale: days > 7, label: days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago` }
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Pure presentational popover content. The connected AuditIcon component
 * fetches `/api/agent-audit` on open and passes the result here. A `null`
 * payload renders the loading/empty state.
 */
export function AuditTrailPopoverContent({
  payload,
  loading,
  error,
}: {
  payload: AuditPayload | null
  loading?: boolean
  error?: string | null
}) {
  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">Loading audit trail…</div>
    )
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Couldn’t load audit trail</p>
          <p className="text-xs mt-0.5 text-rose-600">{error}</p>
        </div>
      </div>
    )
  }
  if (!payload) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No audit trail available for this value yet.
      </div>
    )
  }

  if (payload.kind === "profile_field") return <ProfileFieldView a={payload} />
  if (payload.kind === "research_output") return <ResearchOutputView a={payload} />
  return <DerivedValueView a={payload} />
}

function ProfileFieldView({ a }: { a: ProfileFieldAudit }) {
  const conf = CONFIDENCE_BADGE[a.confidence] ?? {
    label: a.confidence,
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  }
  const rel = relativeDays(a.retrievedAt)

  return (
    <div className="space-y-3 text-sm">
      <div>
        <h4 className="font-semibold text-foreground">How we got this</h4>
        {a.fieldLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{a.fieldLabel}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">Extracted by</span>
          <span className="font-medium text-xs">{a.agentName}</span>
        </div>
        {a.modelUsed && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">Model</span>
            <span className="font-mono text-xs">{a.modelUsed}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">Confidence</span>
          <Badge variant="outline" className={`text-[10px] ${conf.className}`}>
            {conf.label}
          </Badge>
        </div>
      </div>

      {a.sourceUserMessage && (
        <div className="rounded-md border border-border/60 bg-muted/40 p-2.5">
          <p className="text-[11px] text-muted-foreground mb-1 font-medium">From your message</p>
          <p className="text-xs italic text-foreground/80 leading-relaxed">
            “{a.sourceUserMessage.length > 200
              ? `${a.sourceUserMessage.slice(0, 200)}…`
              : a.sourceUserMessage}”
          </p>
        </div>
      )}

      {a.validationRulesApplied && a.validationRulesApplied.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-1 font-medium">Validated</p>
          <ul className="text-xs space-y-0.5">
            {a.validationRulesApplied.map((rule, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600" />
                <span className="text-foreground/80">{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> {formatTimestamp(a.retrievedAt)} ({rel.label})
        </span>
        {a.onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={a.onEdit}
          >
            <Edit3 className="h-3 w-3" /> Edit
          </Button>
        )}
      </div>
    </div>
  )
}

function ResearchOutputView({ a }: { a: ResearchOutputAudit }) {
  const qual = QUALITY_BADGE[a.quality] ?? {
    label: a.quality,
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  }
  const conf = CONFIDENCE_BADGE[a.confidence] ?? {
    label: a.confidence,
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  }
  const rel = relativeDays(a.retrievedAt)

  return (
    <div className="space-y-3 text-sm">
      <div>
        <h4 className="font-semibold text-foreground">Source for this claim</h4>
        {a.outputLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{a.outputLabel}</p>
        )}
      </div>

      <p className="text-xs text-foreground/80">
        <span className="font-medium">{a.specialistName}</span> researched this.
      </p>

      <div className="rounded-md border border-border/60 bg-muted/40 p-2.5 space-y-1.5">
        <p className="text-[11px] text-muted-foreground font-medium">Source</p>
        <a
          href={a.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-start gap-1 break-all"
        >
          {a.sourceName || a.sourceUrl} <ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground text-[11px] mb-0.5">Quality</p>
          <Badge variant="outline" className={`text-[10px] ${qual.className}`}>
            {qual.label}
          </Badge>
        </div>
        <div>
          <p className="text-muted-foreground text-[11px] mb-0.5">Confidence</p>
          <Badge variant="outline" className={`text-[10px] ${conf.className}`}>
            {conf.label}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1 text-[11px] border-t pt-2">
        <Clock className={`h-3 w-3 ${rel.stale ? "text-amber-600" : "text-muted-foreground"}`} />
        <span className={rel.stale ? "text-amber-700" : "text-muted-foreground"}>
          Retrieved {formatTimestamp(a.retrievedAt)} ({rel.label})
          {rel.stale && " — may be outdated"}
        </span>
      </div>

      {a.verifyOnOfficialSiteUrl && (
        <Button asChild variant="outline" size="sm" className="w-full text-xs gap-1.5">
          <a
            href={a.verifyOnOfficialSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Verify on official site <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      )}
    </div>
  )
}

function DerivedValueView({ a }: { a: DerivedValueAudit }) {
  const rel = relativeDays(a.lastComputedAt)
  return (
    <div className="space-y-3 text-sm">
      <div>
        <h4 className="font-semibold text-foreground">How this was calculated</h4>
        {a.outputLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{a.outputLabel}</p>
        )}
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground font-medium mb-1">Formula</p>
        <code className="block text-[11px] bg-muted/60 rounded px-2 py-1.5 font-mono text-foreground/90">
          {a.formula}
        </code>
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground font-medium mb-1">Inputs</p>
        <ul className="space-y-1">
          {a.inputs.map((inp, i) => (
            <li
              key={i}
              className="text-xs flex items-baseline justify-between gap-2 border-b border-border/40 last:border-b-0 pb-1 last:pb-0"
            >
              <span className="text-muted-foreground">{inp.label}</span>
              <span className="font-medium text-right">
                {inp.value}
                {inp.auditTo && (
                  <a
                    href={inp.auditTo}
                    className="text-primary hover:underline ml-1.5 text-[10px]"
                  >
                    →
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-1 text-[11px] text-muted-foreground border-t pt-2">
        <Clock className="h-3 w-3" />
        Last computed {formatTimestamp(a.lastComputedAt)} ({rel.label})
      </div>
    </div>
  )
}
