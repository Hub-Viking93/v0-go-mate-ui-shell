import { History, AlertTriangle } from "lucide-react"
import { SpecialistCardShell } from "./specialist-card-shell"
import type { PriorVisaHistoryData } from "@/lib/gomate/specialist-types"

/**
 * Prior immigration history. No specialist runs for this — the card just
 * surfaces profile fields the user already provided so the user (and any
 * advisors they share the plan with) can see the context that will affect
 * the new application.
 */
export function PriorVisaHistoryCard({
  data,
  reason,
}: {
  data?: PriorVisaHistoryData
  reason?: string
}) {
  const hasAny =
    !!data?.visa_rejections ||
    !!data?.prior_visa_countries ||
    !!data?.prior_visa_types ||
    !!data?.rejection_details

  const wasRejected =
    typeof data?.visa_rejections === "string" &&
    data.visa_rejections.toLowerCase() === "yes"

  const countries = data?.prior_visa_countries
    ? data.prior_visa_countries
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const types = data?.prior_visa_types
    ? data.prior_visa_types
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  return (
    <SpecialistCardShell
      title="Prior Visa History"
      Icon={History}
      reason={reason}
      quality={hasAny ? "full" : "pending"}
      emptyState={
        <p className="text-sm text-muted-foreground">
          No prior visa history captured. Add it in your profile so we can flag any
          carryover risks.
        </p>
      }
    >
      {wasRejected && (
        <div className="flex items-start gap-2 text-sm rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Prior visa rejection on record</p>
            <p className="text-xs mt-0.5">
              Most destinations require you to disclose prior refusals on the new
              application. We’ll prepare a transparent narrative when you reach the
              application step.
            </p>
            {data?.rejection_details && (
              <p className="text-xs mt-1.5">
                <strong>Details: </strong>
                {data.rejection_details}
              </p>
            )}
          </div>
        </div>
      )}

      {countries.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1.5">Prior visa countries</h4>
          <div className="flex flex-wrap gap-1.5">
            {countries.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-foreground/80"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {types.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1.5">Prior visa types held</h4>
          <ul className="text-sm text-foreground/90 space-y-1">
            {types.map((t, i) => (
              <li key={i}>• {t}</li>
            ))}
          </ul>
        </div>
      )}

      {hasAny && !wasRejected && countries.length === 0 && types.length === 0 && (
        <p className="text-sm text-muted-foreground">
          History on file — surfaced here for transparency only. No action required.
        </p>
      )}
    </SpecialistCardShell>
  )
}
