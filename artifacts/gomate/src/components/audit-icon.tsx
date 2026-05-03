import { useCallback, useEffect, useState } from "react"
import { Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  AuditTrailPopoverContent,
  type AuditPayload,
} from "./audit-trail-popover"
import { useDashboardAudit } from "@/lib/audit-context"

export type AuditIconSize = "xs" | "sm" | "md"

export interface AuditIconProps {
  /** For profile fields — passed to /api/agent-audit?profile_id=…&field_key=…. */
  fieldKey?: string
  /** For research outputs — passed to /api/agent-audit?guide_id=…&section_key=…&paragraph_idx=…. */
  outputKey?: string
  size?: AuditIconSize
  /** Override ambient profile id (defaults to DashboardAuditProvider). */
  profileId?: string
  /** Override ambient guide id (defaults to DashboardAuditProvider). */
  guideId?: string
  /** Static payload — skips the network fetch. Used by previews and locally-derived values. */
  payload?: AuditPayload
  /** Force the popover open on mount. Used for previews/screenshots. */
  defaultOpen?: boolean
  /** Visual hint for accessibility / tooltip. */
  label?: string
  className?: string
}

const SIZE_CLASS: Record<AuditIconSize, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
}

/**
 * Audit-trail trigger. Renders a small Info icon button; on click opens a
 * shadcn Popover that displays the source/derivation of the adjacent value.
 *
 *   <AuditIcon fieldKey="annual_income" />          // profile field
 *   <AuditIcon outputKey="visa.0" />                // research output
 *   <AuditIcon payload={derivedAudit} />            // pre-computed payload
 */
export function AuditIcon({
  fieldKey,
  outputKey,
  size = "sm",
  profileId: profileIdProp,
  guideId: guideIdProp,
  payload: staticPayload,
  defaultOpen = false,
  label = "Audit trail",
  className,
}: AuditIconProps) {
  const ambient = useDashboardAudit()
  const profileId = profileIdProp ?? ambient.profileId
  const guideId = guideIdProp ?? ambient.guideId

  const [open, setOpen] = useState(defaultOpen)
  const [payload, setPayload] = useState<AuditPayload | null>(staticPayload ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(!!staticPayload)

  const fetchAudit = useCallback(async () => {
    if (staticPayload) return // never fetch when caller provides explicit data
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (fieldKey && profileId) {
        params.set("profile_id", profileId)
        params.set("field_key", fieldKey)
      } else if (outputKey && guideId) {
        // Strict contract: outputKey must be "<sectionKey>.<integerParagraphIdx>".
        // Bail out silently for malformed keys so we don't 400 the API.
        const [sectionKey, paraIdx] = outputKey.split(".")
        if (!sectionKey || !paraIdx || !/^\d+$/.test(paraIdx)) {
          setLoading(false)
          setFetched(true)
          return
        }
        params.set("guide_id", guideId)
        params.set("section_key", sectionKey)
        params.set("paragraph_idx", paraIdx)
      } else {
        setLoading(false)
        setFetched(true)
        return
      }

      const res = await fetch(`/api/agent-audit?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Audit API returned ${res.status}`)
      }
      const data = (await res.json()) as { audit: AuditPayload | null }
      setPayload(data.audit ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit trail")
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }, [staticPayload, fieldKey, outputKey, profileId, guideId])

  useEffect(() => {
    if (open && !fetched && !staticPayload) {
      void fetchAudit()
    }
  }, [open, fetched, staticPayload, fetchAudit])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`inline-flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${className ?? ""}`}
        >
          <Info className={SIZE_CLASS[size]} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] p-4"
        sideOffset={6}
      >
        <AuditTrailPopoverContent payload={payload} loading={loading} error={error} />
      </PopoverContent>
    </Popover>
  )
}
