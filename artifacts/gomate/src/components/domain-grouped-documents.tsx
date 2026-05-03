import { useEffect, useMemo, useState } from "react"
import {
  User, Users, GraduationCap, Briefcase, ShieldCheck, PawPrint, Car, LogOut,
  Stamp, Languages, Clock, MapPin, FileText, AlertTriangle, CheckCircle2, Circle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  normalizeDocumentStatus,
  type DocumentStatus,
  type DocumentStatusEntry,
} from "@/lib/gomate/types/document-status"
import { cn } from "@/lib/utils"

export type DocumentDomain =
  | "personal" | "family" | "school" | "work"
  | "posted_worker" | "pet" | "vehicle" | "departure_side"

export interface DetailedDocument {
  id: string
  name: string
  domain: DocumentDomain
  phase: "before_move" | "visa_appointment" | "first_weeks" | "first_months"
  whyNeeded: string
  whereToObtain: string
  needsApostille: boolean
  needsTranslation: boolean
  submissionDestination: string
  leadTimeDays: number | null
  issuingAuthority: string
  appliesWhen: string
}

const DOMAIN_META: Record<DocumentDomain, { label: string; icon: typeof User; tint: string }> = {
  personal:       { label: "Personal IDs",         icon: User,         tint: "text-sky-600" },
  family:         { label: "Family & Partner",     icon: Users,        tint: "text-rose-600" },
  school:         { label: "School & Children",    icon: GraduationCap,tint: "text-violet-600" },
  work:           { label: "Work & Employment",    icon: Briefcase,    tint: "text-amber-600" },
  posted_worker:  { label: "Posted-Worker",        icon: ShieldCheck,  tint: "text-orange-600" },
  pet:            { label: "Pets",                 icon: PawPrint,     tint: "text-emerald-600" },
  vehicle:        { label: "Vehicles",             icon: Car,          tint: "text-slate-600" },
  departure_side: { label: "Departure (origin)",   icon: LogOut,       tint: "text-fuchsia-600" },
}

const DOMAIN_ORDER: DocumentDomain[] = [
  "personal", "family", "school", "work",
  "posted_worker", "pet", "vehicle", "departure_side",
]

const STATUS_CYCLE: DocumentStatus[] = ["not_started", "gathering", "ready", "submitted"]
const STATUS_LABEL: Record<DocumentStatus, string> = {
  not_started: "Not started",
  gathering: "Gathering",
  ready: "Ready",
  submitted: "Submitted",
  expiring: "Expiring",
  expired: "Expired",
}
const STATUS_TONE: Record<DocumentStatus, string> = {
  not_started: "text-muted-foreground",
  gathering: "text-amber-600 dark:text-amber-300",
  ready: "text-emerald-600 dark:text-emerald-300",
  submitted: "text-sky-600 dark:text-sky-300",
  expiring: "text-amber-600 dark:text-amber-300",
  expired: "text-red-600 dark:text-red-300",
}

interface Props {
  planId: string | null
  documents: DetailedDocument[]
  initialStatuses: Record<string, unknown>
  warnings?: string[]
  onStatusChange?: (id: string, status: DocumentStatus) => void
}

export function DomainGroupedDocumentsChecklist({
  planId,
  documents,
  initialStatuses,
  warnings = [],
  onStatusChange,
}: Props) {
  const [statuses, setStatuses] = useState<Record<string, DocumentStatusEntry>>(() => {
    const out: Record<string, DocumentStatusEntry> = {}
    for (const [k, v] of Object.entries(initialStatuses ?? {})) {
      out[k] = normalizeDocumentStatus(v)
    }
    return out
  })

  useEffect(() => {
    const out: Record<string, DocumentStatusEntry> = {}
    for (const [k, v] of Object.entries(initialStatuses ?? {})) {
      out[k] = normalizeDocumentStatus(v)
    }
    setStatuses(out)
  }, [initialStatuses])

  const grouped = useMemo(() => {
    const map = new Map<DocumentDomain, DetailedDocument[]>()
    for (const d of documents) {
      const arr = map.get(d.domain) ?? []
      arr.push(d)
      map.set(d.domain, arr)
    }
    return DOMAIN_ORDER
      .map((d) => ({ domain: d, items: map.get(d) ?? [] }))
      .filter((g) => g.items.length > 0)
  }, [documents])

  const totals = useMemo(() => {
    let ready = 0
    for (const d of documents) {
      const s = statuses[d.id]?.status
      if (s === "ready" || s === "submitted") ready++
    }
    return { ready, total: documents.length }
  }, [documents, statuses])

  async function cycleStatus(doc: DetailedDocument) {
    if (!planId) return
    const current = statuses[doc.id]?.status ?? "not_started"
    const idx = STATUS_CYCLE.indexOf(current)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    const previous = statuses[doc.id]
    setStatuses((s) => ({
      ...s,
      [doc.id]: { ...(s[doc.id] ?? { status: "not_started" }), status: next, documentName: doc.name },
    }))
    try {
      const res = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          documentId: doc.id,
          status: next,
          notes: previous?.notes ?? null,
          externalLink: previous?.externalLink ?? null,
        }),
      })
      if (!res.ok) {
        setStatuses((s) => ({ ...s, [doc.id]: previous ?? { status: "not_started" } }))
      } else {
        onStatusChange?.(doc.id, next)
      }
    } catch {
      setStatuses((s) => ({ ...s, [doc.id]: previous ?? { status: "not_started" } }))
    }
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground mb-1">No document research yet</h3>
        <p className="text-sm text-muted-foreground">
          Run the destination research from the Dashboard to generate your personalised document list.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Documents by domain</h2>
          <p className="text-xs text-muted-foreground">
            {totals.ready} of {totals.total} ready · grouped by where the document belongs in your move
          </p>
        </div>
        <Badge variant="outline" className="font-mono">
          {totals.total > 0 ? Math.round((totals.ready / totals.total) * 100) : 0}%
        </Badge>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">Important warnings</p>
              <ul className="text-xs text-amber-800/90 dark:text-amber-200/90 space-y-1 list-disc pl-4">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {grouped.map(({ domain, items }) => {
        const meta = DOMAIN_META[domain]
        const Icon = meta.icon
        const groupReady = items.filter((d) => {
          const s = statuses[d.id]?.status
          return s === "ready" || s === "submitted"
        }).length
        return (
          <section key={domain} className="rounded-2xl border border-border bg-card overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Icon className={cn("w-4 h-4", meta.tint)} />
                <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{groupReady}/{items.length}</span>
            </header>
            <ul className="divide-y divide-border">
              {items.map((doc) => {
                const status = statuses[doc.id]?.status ?? "not_started"
                const done = status === "ready" || status === "submitted"
                return (
                  <li key={doc.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => cycleStatus(doc)}
                        className="mt-0.5 shrink-0"
                        aria-label={`Cycle status for ${doc.name}`}
                      >
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={cn(
                            "text-sm font-medium",
                            done ? "text-muted-foreground line-through" : "text-foreground",
                          )}>{doc.name}</h4>
                          <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_TONE[status])}>
                            {STATUS_LABEL[status]}
                          </Badge>
                          {doc.appliesWhen && (
                            <Badge variant="secondary" className="text-[10px]">{doc.appliesWhen}</Badge>
                          )}
                        </div>
                        {doc.whyNeeded && (
                          <p className="text-xs text-muted-foreground mt-1">{doc.whyNeeded}</p>
                        )}
                        <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {doc.whereToObtain && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                              <span><span className="text-muted-foreground">Where: </span>{doc.whereToObtain}</span>
                            </div>
                          )}
                          {doc.submissionDestination && (
                            <div className="flex items-start gap-1.5">
                              <FileText className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                              <span><span className="text-muted-foreground">Submit to: </span>{doc.submissionDestination}</span>
                            </div>
                          )}
                          {doc.leadTimeDays != null && (
                            <div className="flex items-start gap-1.5">
                              <Clock className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                              <span><span className="text-muted-foreground">Lead time: </span>{doc.leadTimeDays} days</span>
                            </div>
                          )}
                          {doc.needsApostille && (
                            <div className="flex items-start gap-1.5">
                              <Stamp className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                              <span className="text-amber-700 dark:text-amber-300">Apostille required</span>
                            </div>
                          )}
                          {doc.needsTranslation && (
                            <div className="flex items-start gap-1.5">
                              <Languages className="w-3 h-3 text-violet-600 mt-0.5 shrink-0" />
                              <span className="text-violet-700 dark:text-violet-300">Certified translation</span>
                            </div>
                          )}
                        </dl>
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => cycleStatus(doc)}
                          >
                            Mark {STATUS_LABEL[STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length]]}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
